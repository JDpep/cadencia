import 'server-only';
import { prisma } from '@/lib/prisma';
import { ErrorPermiso, type UsuarioSesion } from '@/lib/auth/guard';
import {
  esTipoAusencia,
  REGLAS_AUSENCIA,
  type EstatusAusencia,
  type TipoAusencia,
} from '@/lib/dominio';
import {
  contarDiasHabiles,
  MENSAJE_PROBLEMA,
  saldoDe,
  validarSolicitud,
  type SaldoVacaciones,
} from '@/lib/ausencias';
import { diferenciaDias, hoyClave, type ClaveDia } from '@/lib/tiempo';
import { conjuntoFestivos, leerAjuste } from './catalogos';

/**
 * Vacaciones y ausencias.
 *
 * El cálculo (días hábiles, saldo, validación) vive en `src/lib/ausencias.ts`,
 * puro y probado aparte. Aquí está la persistencia y —lo importante— el
 * movimiento del saldo, que es lo único que se puede desincronizar:
 *
 *   solicitar  → pendientes += días
 *   aprobar    → pendientes −= días,  tomados += días
 *   rechazar   → pendientes −= días
 *   cancelar   → suelta lo que hubiera reservado, según en qué estatus estaba
 *
 * `disponibles` NUNCA se guarda: se deriva. Así el saldo no puede mentir.
 * Cada movimiento va en una transacción con el cambio de estatus, para que no
 * exista un instante en que una solicitud esté aprobada y el saldo no.
 *
 * Sólo los tipos marcados `descuentaSaldo` mueven el saldo anual: una
 * incapacidad bloquea la agenda pero no se come las vacaciones.
 */

const CLAVE_DIAS_DEFAULT = 'dias_vacaciones_default';
const DIAS_DEFAULT = 12;

const esAdmin = (u: UsuarioSesion) => u.rol === 'admin';

function exigirAdmin(user: UsuarioSesion, accion = 'resolver solicitudes') {
  if (!esAdmin(user)) {
    throw new ErrorPermiso(`Sólo Administración puede ${accion}.`);
  }
}

/** Dirección no pide vacaciones: no tiene saldo que administrar. */
function exigirPuedeSolicitar(user: UsuarioSesion) {
  if (user.rol === 'direccion') {
    throw new ErrorPermiso(
      'Sólo quienes tienen saldo solicitan vacaciones; Dirección no.',
    );
  }
}

export const anioDe = (clave: ClaveDia) => Number(clave.slice(0, 4));
export const anioActual = () => anioDe(hoyClave());

// ---------------------------------------------------------------------------
// Saldos
// ---------------------------------------------------------------------------

async function diasPorDefecto(): Promise<number> {
  const v = await leerAjuste(CLAVE_DIAS_DEFAULT);
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : DIAS_DEFAULT;
}

/** El saldo del año, creándolo la primera vez que hace falta. */
export async function saldoDelUsuario(
  userId: string,
  anio = anioActual(),
): Promise<SaldoVacaciones> {
  const existente = await prisma.vacationBalance.findUnique({
    where: { userId_anio: { userId, anio } },
  });
  if (existente) return saldoDe(existente);

  const creado = await prisma.vacationBalance.create({
    data: { userId, anio, diasAsignados: await diasPorDefecto() },
  });
  return saldoDe(creado);
}

/** Todos los saldos del año — pantalla de configuración de Admin. */
export async function saldosDelEquipo(user: UsuarioSesion, anio = anioActual()) {
  if (!esAdmin(user) && user.rol !== 'direccion') {
    throw new ErrorPermiso(
      'Los saldos del equipo son sólo para Administración y Dirección.',
    );
  }

  const personas = await prisma.user.findMany({
    where: { activo: true, rol: { in: ['usuario', 'admin'] } },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, email: true, rol: true, puesto: true },
  });

  return Promise.all(
    personas.map(async (p) => ({ ...p, saldo: await saldoDelUsuario(p.id, anio) })),
  );
}

export async function fijarDiasAsignados(
  user: UsuarioSesion,
  userId: string,
  anio: number,
  dias: number,
) {
  exigirAdmin(user, 'configurar saldos');
  if (!Number.isFinite(dias) || dias < 0 || dias > 365) {
    throw new Error('Los días asignados deben estar entre 0 y 365.');
  }

  const actual = await saldoDelUsuario(userId, anio);
  if (dias < actual.tomados + actual.pendientes) {
    throw new Error(
      `Ya hay ${actual.tomados + actual.pendientes} días comprometidos: no puedes asignar menos.`,
    );
  }

  const fila = await prisma.vacationBalance.update({
    where: { userId_anio: { userId, anio } },
    data: { diasAsignados: Math.round(dias) },
  });

  return { antes: actual, despues: saldoDe(fila) };
}

// ---------------------------------------------------------------------------
// Lectura de solicitudes
// ---------------------------------------------------------------------------

const SELECT_SOLICITUD = {
  id: true,
  userId: true,
  tipo: true,
  fechaInicio: true,
  fechaFin: true,
  diasHabiles: true,
  motivo: true,
  adjuntoNombre: true,
  adjuntoRuta: true,
  estatus: true,
  resueltoEn: true,
  comentarioResolucion: true,
  createdAt: true,
  user: { select: { id: true, nombre: true, email: true, puesto: true } },
} as const;

export type SolicitudVista = {
  id: string;
  userId: string;
  persona: { id: string; nombre: string; email: string; puesto: string | null };
  tipo: TipoAusencia;
  fechaInicio: ClaveDia;
  fechaFin: ClaveDia;
  diasHabiles: number;
  motivo: string | null;
  adjuntoNombre: string | null;
  tieneAdjunto: boolean;
  estatus: EstatusAusencia;
  resueltoEn: Date | null;
  comentarioResolucion: string | null;
  createdAt: Date;
  /** Personas que estarán fuera al mismo tiempo. Sólo se calcula para Admin. */
  traslapes?: { nombre: string; fechaInicio: ClaveDia; fechaFin: ClaveDia }[];
};

type FilaSolicitud = {
  id: string;
  userId: string;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  diasHabiles: number;
  motivo: string | null;
  adjuntoNombre: string | null;
  adjuntoRuta: string | null;
  estatus: string;
  resueltoEn: Date | null;
  comentarioResolucion: string | null;
  createdAt: Date;
  user: { id: string; nombre: string; email: string; puesto: string | null };
};

function aVista(f: FilaSolicitud): SolicitudVista {
  return {
    id: f.id,
    userId: f.userId,
    persona: f.user,
    tipo: (esTipoAusencia(f.tipo) ? f.tipo : 'vacaciones') as TipoAusencia,
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    diasHabiles: f.diasHabiles,
    motivo: f.motivo,
    adjuntoNombre: f.adjuntoNombre,
    tieneAdjunto: Boolean(f.adjuntoRuta),
    estatus: f.estatus as EstatusAusencia,
    resueltoEn: f.resueltoEn,
    comentarioResolucion: f.comentarioResolucion,
    createdAt: f.createdAt,
  };
}

/** Las propias. Todo ejecutivo ve su historial completo. */
export async function misSolicitudes(user: UsuarioSesion): Promise<SolicitudVista[]> {
  const filas = await prisma.vacationRequest.findMany({
    where: { userId: user.id },
    orderBy: [{ fechaInicio: 'desc' }],
    select: SELECT_SOLICITUD,
  });
  return filas.map(aVista);
}

/**
 * Bandeja de Administración: las pendientes arriba y, para cada una, quién más
 * estará fuera esas fechas. El traslape es la información que hace falta para
 * decidir, así que se calcula aquí y no se deja a la vista.
 */
export async function bandejaSolicitudes(user: UsuarioSesion): Promise<SolicitudVista[]> {
  exigirAdmin(user, 'ver la bandeja de solicitudes');

  const filas = await prisma.vacationRequest.findMany({
    orderBy: [{ estatus: 'asc' }, { fechaInicio: 'asc' }],
    select: SELECT_SOLICITUD,
  });

  // 'pendiente' primero; el resto por fecha descendente (lo reciente arriba).
  const pendientes = filas.filter((f) => f.estatus === 'pendiente');
  const resueltas = filas
    .filter((f) => f.estatus !== 'pendiente')
    .sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));

  const vivas = filas.filter(
    (f) => f.estatus === 'aprobada' || f.estatus === 'pendiente',
  );

  return [...pendientes, ...resueltas].map((f) => {
    const v = aVista(f);
    if (f.estatus === 'pendiente') {
      v.traslapes = vivas
        .filter(
          (o) =>
            o.id !== f.id &&
            o.userId !== f.userId &&
            diferenciaDias(f.fechaInicio, o.fechaFin) >= 0 &&
            diferenciaDias(o.fechaInicio, f.fechaFin) >= 0,
        )
        .map((o) => ({
          nombre: o.user.nombre,
          fechaInicio: o.fechaInicio,
          fechaFin: o.fechaFin,
        }));
    }
    return v;
  });
}

/**
 * Ausencias aprobadas que tocan un rango.
 * Ejecutivo: las suyas. Admin y Dirección: las de todo el equipo.
 */
export async function ausenciasEnRango(
  user: UsuarioSesion,
  desde: ClaveDia,
  hasta: ClaveDia,
  soloPropias = false,
): Promise<SolicitudVista[]> {
  const verTodas = !soloPropias && (esAdmin(user) || user.rol === 'direccion');

  const filas = await prisma.vacationRequest.findMany({
    where: {
      estatus: 'aprobada',
      ...(verTodas ? {} : { userId: user.id }),
      // Se traslapa con [desde, hasta]: empieza antes del fin y termina después del inicio.
      fechaInicio: { lte: hasta },
      fechaFin: { gte: desde },
    },
    orderBy: [{ fechaInicio: 'asc' }],
    select: SELECT_SOLICITUD,
  });

  return filas.map(aVista);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export type EntradaSolicitud = {
  tipo: TipoAusencia;
  fechaInicio: ClaveDia;
  fechaFin: ClaveDia;
  motivo?: string | null;
  adjunto?: { nombre: string; tipo: string; ruta: string } | null;
};

export async function solicitar(user: UsuarioSesion, entrada: EntradaSolicitud) {
  exigirPuedeSolicitar(user);
  if (!esTipoAusencia(entrada.tipo)) throw new Error('Tipo de ausencia inválido.');

  const festivos = await conjuntoFestivos();
  const rango = { inicio: entrada.fechaInicio, fin: entrada.fechaFin };
  const diasHabiles = contarDiasHabiles(rango, festivos);

  // El saldo del año en que ARRANCA la ausencia.
  const anio = anioDe(entrada.fechaInicio);
  const saldo = await saldoDelUsuario(user.id, anio);

  const problema = validarSolicitud({
    tipo: entrada.tipo,
    rango,
    motivo: entrada.motivo,
    diasHabiles,
    disponibles: saldo.disponibles,
  });
  if (problema) throw new Error(MENSAJE_PROBLEMA[problema]);

  const descuenta = REGLAS_AUSENCIA[entrada.tipo].descuentaSaldo;

  return prisma.$transaction(async (tx) => {
    const creada = await tx.vacationRequest.create({
      data: {
        userId: user.id,
        tipo: entrada.tipo,
        fechaInicio: entrada.fechaInicio,
        fechaFin: entrada.fechaFin,
        diasHabiles,
        motivo: entrada.motivo?.trim() || null,
        adjuntoNombre: entrada.adjunto?.nombre ?? null,
        adjuntoTipo: entrada.adjunto?.tipo ?? null,
        adjuntoRuta: entrada.adjunto?.ruta ?? null,
      },
    });

    if (descuenta) {
      await tx.vacationBalance.update({
        where: { userId_anio: { userId: user.id, anio } },
        data: { diasPendientes: { increment: diasHabiles } },
      });
    }

    return creada;
  });
}

/** Suelta la reserva del saldo. Se usa al rechazar y al cancelar. */
function movimientoSaldo(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  fila: { userId: string; tipo: string; fechaInicio: string; diasHabiles: number },
  data: { diasPendientes?: { increment: number }; diasTomados?: { increment: number } },
) {
  if (!REGLAS_AUSENCIA[fila.tipo as TipoAusencia]?.descuentaSaldo) return null;
  return tx.vacationBalance.update({
    where: { userId_anio: { userId: fila.userId, anio: anioDe(fila.fechaInicio) } },
    data,
  });
}

export async function aprobar(user: UsuarioSesion, id: string) {
  exigirAdmin(user);

  const fila = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!fila) return null;
  if (fila.estatus !== 'pendiente') {
    throw new Error('Esta solicitud ya fue resuelta.');
  }

  const despues = await prisma.$transaction(async (tx) => {
    // La reserva se convierte en días tomados: sale de pendientes, entra a tomados.
    await movimientoSaldo(tx, fila, {
      diasPendientes: { increment: -fila.diasHabiles },
      diasTomados: { increment: fila.diasHabiles },
    });

    return tx.vacationRequest.update({
      where: { id },
      data: {
        estatus: 'aprobada',
        resueltoPor: user.id,
        resueltoEn: new Date(),
        comentarioResolucion: null,
      },
    });
  });

  return { antes: fila, despues };
}

export async function rechazar(user: UsuarioSesion, id: string, comentario: string) {
  exigirAdmin(user);

  const texto = comentario.trim();
  if (!texto) throw new Error('Al rechazar hay que decir por qué.');

  const fila = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!fila) return null;
  if (fila.estatus !== 'pendiente') {
    throw new Error('Esta solicitud ya fue resuelta.');
  }

  const despues = await prisma.$transaction(async (tx) => {
    // No se descuenta nada: la reserva se libera entera.
    await movimientoSaldo(tx, fila, {
      diasPendientes: { increment: -fila.diasHabiles },
    });

    return tx.vacationRequest.update({
      where: { id },
      data: {
        estatus: 'rechazada',
        resueltoPor: user.id,
        resueltoEn: new Date(),
        comentarioResolucion: texto,
      },
    });
  });

  return { antes: fila, despues };
}

/**
 * Cancelar: la puede pedir el dueño (o Admin). Se permite mientras siga
 * pendiente, o si ya está aprobada pero aún no empieza — cancelar unas
 * vacaciones que ya arrancaron no tendría sentido.
 */
export async function cancelar(user: UsuarioSesion, id: string) {
  const fila = await prisma.vacationRequest.findUnique({ where: { id } });
  if (!fila) return null;

  if (fila.userId !== user.id && !esAdmin(user)) {
    throw new ErrorPermiso('Esta solicitud es de otra persona.');
  }

  if (fila.estatus === 'cancelada' || fila.estatus === 'rechazada') {
    throw new Error('Esta solicitud ya no está activa.');
  }

  const yaEmpezo = diferenciaDias(fila.fechaInicio, hoyClave()) >= 0;
  if (fila.estatus === 'aprobada' && yaEmpezo) {
    throw new Error('No se puede cancelar una ausencia que ya empezó.');
  }

  const despues = await prisma.$transaction(async (tx) => {
    // Se devuelve exactamente de donde estaba reservado.
    await movimientoSaldo(
      tx,
      fila,
      fila.estatus === 'aprobada'
        ? { diasTomados: { increment: -fila.diasHabiles } }
        : { diasPendientes: { increment: -fila.diasHabiles } },
    );

    return tx.vacationRequest.update({
      where: { id },
      data: { estatus: 'cancelada', resueltoPor: user.id, resueltoEn: new Date() },
    });
  });

  return { antes: fila, despues };
}

/**
 * El adjunto lo abre su dueño o Administración, nadie más.
 *
 * El permiso se comprueba ANTES de mirar si hay comprobante: si el orden fuera
 * al revés, un extraño recibiría 404 en vez de 403 y de paso averiguaría si esa
 * solicitud lleva certificado médico o no.
 */
export async function adjuntoDe(user: UsuarioSesion, id: string) {
  const fila = await prisma.vacationRequest.findUnique({
    where: { id },
    select: {
      userId: true,
      adjuntoNombre: true,
      adjuntoTipo: true,
      adjuntoRuta: true,
    },
  });
  if (!fila) return null;

  if (fila.userId !== user.id && !esAdmin(user)) {
    throw new ErrorPermiso('Este comprobante es de otra persona.');
  }

  return fila.adjuntoRuta ? fila : null;
}
