import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  ErrorPermiso,
  exigirPropiedadEstricta,
  filtroActividades,
  type UsuarioSesion,
} from '@/lib/auth/guard';
import { MINUTOS_POSPONER } from '@/lib/dominio';
import type { ClaveDia } from '@/lib/tiempo';
import {
  planDe,
  type ActividadParaRecordar,
  type PlanRecordatorios,
} from '@/lib/recordatorios';
import { conjuntoFestivos, escribirAjuste, leerAjuste } from './catalogos';

/**
 * Recordatorios — persistencia.
 *
 * El cálculo de qué avisa y cuándo vive aparte, en `src/lib/recordatorios.ts`,
 * para poder probarse sin base de datos. Aquí sólo se guarda y se lee.
 *
 * A diferencia de las ocurrencias —que se generan por ventana y no se guardan—
 * los recordatorios SÍ se materializan en `Notification`: es lo que permite que
 * en la nube una función programada los lea por `programadaPara` y los envíe
 * sin tener que recorrer la app entera.
 *
 * La regla que lo mantiene sano: la sincronización es IDEMPOTENTE. Se rehace
 * completa en cada escritura y sólo borra los que siguen pendientes de mostrar;
 * los ya mostrados o descartados se respetan (`activityId + fechaOriginal` es la
 * llave). Así resincronizar mil veces no duplica ni resucita nada.
 *
 * Privacidad: un recordatorio es del `userId` que lo posee y de nadie más.
 * Ni Admin ni Dirección tocan los ajenos — las actividades son privadas.
 */

/** Cada cuánto se rueda el horizonte al consultar la campana. */
const MINUTOS_ENTRE_SYNC = 10;

const claveSync = (userId: string) => `recordatorios_sync:${userId}`;

const INCLUDE_SYNC = {
  client: { select: { nombreEmpresa: true } },
  occurrences: true,
} as const;

type FilaSync = {
  titulo: string;
  fecha: Date | null;
  allDay: boolean;
  estado: string;
  archivada: boolean;
  recordatorioMinutos: number | null;
  recurrenceRule: string | null;
  client: { nombreEmpresa: string } | null;
  occurrences: ActividadParaRecordar['excepciones'];
};

/** Traduce la fila de Prisma a lo que el cálculo puro necesita. */
function paraRecordar(fila: FilaSync): ActividadParaRecordar {
  return {
    titulo: fila.titulo,
    fecha: fila.fecha,
    allDay: fila.allDay,
    estado: fila.estado,
    archivada: fila.archivada,
    recordatorioMinutos: fila.recordatorioMinutos,
    recurrenceRule: fila.recurrenceRule,
    cliente: fila.client?.nombreEmpresa ?? null,
    excepciones: fila.occurrences,
  };
}

// ---------------------------------------------------------------------------
// Sincronización
// ---------------------------------------------------------------------------

/**
 * Reescribe los recordatorios de una actividad según su plan.
 *
 * Tres pasos, en este orden:
 *  1. se borran los que aún no se han mostrado (son estado, no historia);
 *  2. se retiran los que ya sonaron pero perdieron su razón de ser —la
 *     actividad se dio por hecha, la ocurrencia se saltó—, porque el borrado
 *     anterior no los toca a propósito (es lo que hace que «posponer» aguante);
 *  3. se programan los vigentes.
 *
 * El `upsert` con update vacío es lo que evita duplicar o revivir lo que el
 * usuario ya despachó. Por eso volver a llamarla mil veces da lo mismo.
 */
async function reescribir(
  userId: string,
  activityId: string,
  plan: PlanRecordatorios,
): Promise<void> {
  await prisma.notification.deleteMany({
    where: { activityId, userId, leido: false, enviadaEn: null },
  });

  if (plan.cancelarTodo) {
    await prisma.notification.updateMany({
      where: { activityId, userId, leido: false },
      data: { leido: true, enviadaEn: new Date() },
    });
  } else if (plan.cancelados.length) {
    await prisma.notification.updateMany({
      where: {
        activityId,
        userId,
        leido: false,
        fechaOriginal: { in: plan.cancelados },
      },
      data: { leido: true, enviadaEn: new Date() },
    });
  }

  for (const p of plan.programados) {
    await prisma.notification.upsert({
      where: {
        activityId_fechaOriginal: { activityId, fechaOriginal: p.fechaOriginal },
      },
      create: {
        userId,
        activityId,
        fechaOriginal: p.fechaOriginal,
        claveObjetivo: p.claveObjetivo,
        titulo: p.titulo,
        cuerpo: p.cuerpo,
        programadaPara: p.programadaPara,
      },
      // Ya existía: se mostró o se descartó. Se respeta tal cual.
      update: {},
    });
  }
}

/** Resincroniza una sola actividad. Se llama después de cada escritura. */
export async function sincronizarActividad(
  user: UsuarioSesion,
  activityId: string,
): Promise<void> {
  const fila = await prisma.activity.findUnique({
    where: { id: activityId },
    include: INCLUDE_SYNC,
  });

  // Si se eliminó, sus recordatorios se fueron en cascada.
  if (!fila) return;
  exigirPropiedadEstricta(user, fila.ownerUserId);

  const festivos = await conjuntoFestivos();
  await reescribir(
    fila.ownerUserId,
    fila.id,
    planDe(paraRecordar(fila), festivos, new Date()),
  );
}

/**
 * Resincroniza todas las actividades del usuario. Es lo que rueda el horizonte
 * hacia adelante: una serie sin fin sólo tiene materializados los próximos 30
 * días, y esta pasada crea los siguientes conforme avanza el calendario.
 */
export async function sincronizarUsuario(user: UsuarioSesion): Promise<void> {
  const [filas, festivos] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...filtroActividades(user),
        archivada: false,
        recordatorioMinutos: { not: null },
        fecha: { not: null },
      },
      include: INCLUDE_SYNC,
    }),
    conjuntoFestivos(),
  ]);

  const vivas = [...new Set(filas.map((f) => f.id))];
  const ahora = new Date();

  // Las que dejaron de tener recordatorio (o se archivaron) sueltan los suyos:
  // se borran los que no habían sonado y se retiran los que sí.
  const huerfanos = {
    userId: user.id,
    leido: false,
    activityId: { notIn: vivas },
  } as const;

  await prisma.notification.deleteMany({ where: { ...huerfanos, enviadaEn: null } });
  await prisma.notification.updateMany({
    where: huerfanos,
    data: { leido: true, enviadaEn: ahora },
  });

  for (const fila of filas) {
    await reescribir(user.id, fila.id, planDe(paraRecordar(fila), festivos, ahora));
  }
}

/**
 * Rueda el horizonte, pero no en cada consulta: la campana pregunta cada minuto
 * y resincronizar todo cada vez sería absurdo. Se hace como mucho cada
 * `MINUTOS_ENTRE_SYNC`.
 */
export async function asegurarRecordatorios(user: UsuarioSesion): Promise<void> {
  const ultimo = await leerAjuste(claveSync(user.id));
  const marca = ultimo ? Date.parse(ultimo) : 0;

  if (Number.isFinite(marca) && Date.now() - marca < MINUTOS_ENTRE_SYNC * 60_000) return;

  await sincronizarUsuario(user);
  await escribirAjuste(claveSync(user.id), new Date().toISOString());
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export type RecordatorioVista = {
  id: string;
  titulo: string;
  cuerpo: string | null;
  programadaPara: string; // ISO — viaja por JSON hasta la campana
  activityId: string | null;
  fechaOriginal: ClaveDia | null;
  claveObjetivo: ClaveDia | null;
};

type FilaNotificacion = {
  id: string;
  titulo: string;
  cuerpo: string | null;
  programadaPara: Date;
  activityId: string | null;
  fechaOriginal: string | null;
  claveObjetivo: string | null;
};

function aVista(n: FilaNotificacion): RecordatorioVista {
  return {
    id: n.id,
    titulo: n.titulo,
    cuerpo: n.cuerpo,
    programadaPara: n.programadaPara.toISOString(),
    activityId: n.activityId,
    fechaOriginal: n.fechaOriginal,
    claveObjetivo: n.claveObjetivo,
  };
}

const SELECT_VISTA = {
  id: true,
  titulo: true,
  cuerpo: true,
  programadaPara: true,
  activityId: true,
  fechaOriginal: true,
  claveObjetivo: true,
} as const;

/**
 * Los que ya sonaron y siguen sin despachar. Al leerlos se marcan como
 * entregados: a partir de ahí la resincronización deja de tocarlos.
 */
export async function recordatoriosVencidos(
  user: UsuarioSesion,
  limite = 20,
): Promise<RecordatorioVista[]> {
  const ahora = new Date();

  const filas = await prisma.notification.findMany({
    where: { userId: user.id, leido: false, programadaPara: { lte: ahora } },
    orderBy: { programadaPara: 'desc' },
    take: limite,
    select: SELECT_VISTA,
  });

  if (filas.length) {
    await prisma.notification.updateMany({
      where: { id: { in: filas.map((f) => f.id) }, enviadaEn: null },
      data: { enviadaEn: ahora },
    });
  }

  return filas.map(aVista);
}

/** Los que están por sonar, para que la campana no sea sólo una alarma. */
export async function proximosRecordatorios(
  user: UsuarioSesion,
  limite = 5,
): Promise<RecordatorioVista[]> {
  const filas = await prisma.notification.findMany({
    where: { userId: user.id, leido: false, programadaPara: { gt: new Date() } },
    orderBy: { programadaPara: 'asc' },
    take: limite,
    select: SELECT_VISTA,
  });

  return filas.map(aVista);
}

export async function contarVencidos(user: UsuarioSesion): Promise<number> {
  return prisma.notification.count({
    where: { userId: user.id, leido: false, programadaPara: { lte: new Date() } },
  });
}

/** Lo que consume la campana de un tirón. */
export async function bandejaRecordatorios(user: UsuarioSesion) {
  await asegurarRecordatorios(user);

  const [vencidos, proximos] = await Promise.all([
    recordatoriosVencidos(user),
    proximosRecordatorios(user),
  ]);

  return { vencidos, proximos, total: vencidos.length };
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Un recordatorio es de su dueño y de nadie más, ni del Admin. */
async function exigirPropio(user: UsuarioSesion, id: string) {
  const n = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!n) return null;
  if (n.userId !== user.id) {
    throw new ErrorPermiso('Este recordatorio es de otro usuario.');
  }
  return n;
}

export async function descartar(user: UsuarioSesion, id: string) {
  const n = await exigirPropio(user, id);
  if (!n) return null;

  return prisma.notification.update({
    where: { id },
    data: { leido: true, enviadaEn: new Date() },
  });
}

export async function descartarTodos(user: UsuarioSesion): Promise<number> {
  const r = await prisma.notification.updateMany({
    where: { userId: user.id, leido: false, programadaPara: { lte: new Date() } },
    data: { leido: true, enviadaEn: new Date() },
  });
  return r.count;
}

/**
 * Vuelve a sonar en unos minutos. Se re-agenda el mismo registro, no se duplica.
 *
 * `enviadaEn` se mantiene marcado a propósito: es lo que protege al pospuesto de
 * la resincronización, que borraría un pendiente sin entregar y lo recrearía en
 * su hora original —deshaciendo el posponer.
 */
export async function posponer(
  user: UsuarioSesion,
  id: string,
  minutos = MINUTOS_POSPONER,
) {
  const n = await exigirPropio(user, id);
  if (!n) return null;

  return prisma.notification.update({
    where: { id },
    data: {
      programadaPara: new Date(Date.now() + Math.max(1, minutos) * 60_000),
      leido: false,
      enviadaEn: new Date(),
    },
  });
}
