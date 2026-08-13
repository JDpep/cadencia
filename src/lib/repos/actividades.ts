import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  ErrorPermiso,
  exigirPropiedadEstricta,
  filtroActividades,
  type UsuarioSesion,
} from '@/lib/auth/guard';
import {
  esEstado,
  esPrioridad,
  PESO_PRIORIDAD,
  type AlcanceEdicion,
  type Estado,
  type Prioridad,
} from '@/lib/dominio';
import {
  claveDia,
  deClaveDia,
  diferenciaDias,
  hoyClave,
  horaDe,
  sumarDias,
  type ClaveDia,
} from '@/lib/tiempo';
import {
  generarOcurrencias,
  ocurrenciaEfectiva,
  parsearRegla,
  serializarRegla,
  type ReglaRecurrencia,
} from '@/lib/recurrence';
import { conjuntoFestivos } from './catalogos';

/**
 * Actividades: el corazón de Cadencia.
 *
 * Privacidad: SIEMPRE filtradas por `ownerUserId`. Ni Admin ni Dirección leen
 * las actividades de un ejecutivo; Dirección sólo consume agregados (panorama).
 */

export type SubtareaVista = {
  id: string;
  texto: string;
  hecha: boolean;
  orden: number;
};

export type ActividadVista = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  estado: Estado;
  fecha: Date | null;
  clave: ClaveDia | null;
  hora: string | null;
  allDay: boolean;
  orden: number;
  completadaEn: Date | null;
  categoria: { id: string; nombre: string; colorToken: string; icono: string | null } | null;
  cliente: { id: string; nombreEmpresa: string } | null;
  subtareas: SubtareaVista[];
  recurrencia: ReglaRecurrencia | null;
  recurrenceParentId: string | null;
  /** Minutos de antelación del recordatorio; null = sin recordatorio. */
  recordatorioMinutos: number | null;
};

export type DatosActividad = {
  titulo: string;
  descripcion?: string | null;
  categoryId?: string | null;
  prioridad?: Prioridad;
  estado?: Estado;
  clave?: ClaveDia | null;
  hora?: string | null;
  clientId?: string | null;
  recurrencia?: ReglaRecurrencia | null;
  recordatorioMinutos?: number | null;
};

export type FiltrosActividad = {
  busqueda?: string;
  prioridad?: Prioridad | 'todas';
  categoryId?: string | 'todas';
  clientId?: string | 'todos';
  fecha?: 'todas' | 'con_fecha' | 'sin_fecha' | 'vencidas' | 'hoy';
  incluirHechas?: boolean;
};

const INCLUDE_ACTIVIDAD = {
  category: { select: { id: true, nombre: true, colorToken: true, icono: true } },
  client: { select: { id: true, nombreEmpresa: true } },
  subtasks: { orderBy: { orden: 'asc' } },
} as const;

type FilaActividad = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: string;
  estado: string;
  fecha: Date | null;
  allDay: boolean;
  orden: number;
  completadaEn: Date | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
  recordatorioMinutos: number | null;
  category: { id: string; nombre: string; colorToken: string; icono: string | null } | null;
  client: { id: string; nombreEmpresa: string } | null;
  subtasks: { id: string; texto: string; hecha: boolean; orden: number }[];
};

function aVista(a: FilaActividad): ActividadVista {
  return {
    id: a.id,
    titulo: a.titulo,
    descripcion: a.descripcion,
    prioridad: (esPrioridad(a.prioridad) ? a.prioridad : 'media') as Prioridad,
    estado: (esEstado(a.estado) ? a.estado : 'por_hacer') as Estado,
    fecha: a.fecha,
    clave: a.fecha ? claveDia(a.fecha) : null,
    hora: horaDe(a.fecha, a.allDay),
    allDay: a.allDay,
    orden: a.orden,
    completadaEn: a.completadaEn,
    categoria: a.category,
    cliente: a.client,
    subtareas: a.subtasks,
    recurrencia: parsearRegla(a.recurrenceRule),
    recurrenceParentId: a.recurrenceParentId,
    recordatorioMinutos: a.recordatorioMinutos,
  };
}

/**
 * Sin fecha no hay a qué anclar el aviso, así que el recordatorio se cae solo.
 * Se normaliza aquí y no en la UI: la regla tiene que valer también por API.
 */
function recordatorioValido(
  minutos: number | null | undefined,
  clave: ClaveDia | null | undefined,
): number | null {
  if (!clave) return null;
  if (minutos === null || minutos === undefined) return null;
  if (!Number.isFinite(minutos) || minutos < 0) return null;
  return Math.min(Math.round(minutos), 60 * 24 * 30);
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export async function listarActividades(
  user: UsuarioSesion,
  filtros: FiltrosActividad = {},
): Promise<ActividadVista[]> {
  const q = filtros.busqueda?.trim();
  const hoy = hoyClave();

  const where: Record<string, unknown> = {
    ...filtroActividades(user),
    archivada: false,
  };

  if (q) {
    where.OR = [{ titulo: { contains: q } }, { descripcion: { contains: q } }];
  }
  if (filtros.prioridad && filtros.prioridad !== 'todas') {
    where.prioridad = filtros.prioridad;
  }
  if (filtros.categoryId && filtros.categoryId !== 'todas') {
    where.categoryId = filtros.categoryId;
  }
  if (filtros.clientId && filtros.clientId !== 'todos') {
    where.clientId = filtros.clientId;
  }
  if (filtros.incluirHechas === false) {
    where.estado = { not: 'hecha' };
  }

  switch (filtros.fecha) {
    case 'con_fecha':
      where.fecha = { not: null };
      break;
    case 'sin_fecha':
      where.fecha = null;
      break;
    case 'hoy':
      where.fecha = { gte: deClaveDia(hoy), lt: deClaveDia(sumarDias(hoy, 1)) };
      break;
    case 'vencidas':
      where.fecha = { lt: deClaveDia(hoy) };
      where.estado = { not: 'hecha' };
      break;
  }

  const filas = await prisma.activity.findMany({
    where,
    include: INCLUDE_ACTIVIDAD,
    orderBy: [{ orden: 'asc' }, { createdAt: 'desc' }],
  });

  return filas.map(aVista);
}

export async function obtenerActividad(
  user: UsuarioSesion,
  id: string,
): Promise<ActividadVista | null> {
  const fila = await prisma.activity.findUnique({ where: { id }, include: INCLUDE_ACTIVIDAD });
  if (!fila) return null;
  exigirPropiedadEstricta(user, fila.ownerUserId);
  return aVista(fila);
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** El cliente vinculado tiene que ser del propio ejecutivo. Se valida siempre. */
async function validarCliente(user: UsuarioSesion, clientId?: string | null) {
  if (!clientId) return null;
  const cliente = await prisma.client.findFirst({
    where: { id: clientId, ownerUserId: user.id, activo: true },
    select: { id: true },
  });
  if (!cliente) {
    throw new ErrorPermiso('Sólo puedes vincular actividades a tus propios clientes.');
  }
  return cliente.id;
}

function fechaDesde(clave?: ClaveDia | null, hora?: string | null): Date | null {
  if (!clave) return null;
  return deClaveDia(clave, hora || '00:00');
}

export async function crearActividad(user: UsuarioSesion, datos: DatosActividad) {
  const titulo = datos.titulo.trim();
  if (!titulo) throw new Error('La actividad necesita un título.');

  const clientId = await validarCliente(user, datos.clientId);

  const primero = await prisma.activity.findFirst({
    where: { ownerUserId: user.id },
    orderBy: { orden: 'asc' },
    select: { orden: true },
  });

  return prisma.activity.create({
    data: {
      ownerUserId: user.id,
      titulo,
      descripcion: datos.descripcion?.trim() || null,
      categoryId: datos.categoryId || null,
      prioridad: datos.prioridad ?? 'media',
      estado: datos.estado ?? 'por_hacer',
      fecha: fechaDesde(datos.clave, datos.hora),
      allDay: !datos.hora,
      clientId,
      recurrenceRule: datos.recurrencia ? serializarRegla(datos.recurrencia) : null,
      recordatorioMinutos: recordatorioValido(datos.recordatorioMinutos, datos.clave),
      // Nuevas al principio de la lista.
      orden: (primero?.orden ?? 0) - 1,
    },
    include: INCLUDE_ACTIVIDAD,
  });
}

export async function actualizarActividad(
  user: UsuarioSesion,
  id: string,
  datos: DatosActividad,
) {
  const actual = await prisma.activity.findUnique({ where: { id } });
  if (!actual) return null;
  exigirPropiedadEstricta(user, actual.ownerUserId);

  const clientId = await validarCliente(user, datos.clientId);
  const estado = datos.estado ?? (actual.estado as Estado);

  const despues = await prisma.activity.update({
    where: { id },
    data: {
      titulo: datos.titulo.trim(),
      descripcion: datos.descripcion?.trim() || null,
      categoryId: datos.categoryId || null,
      prioridad: datos.prioridad ?? (actual.prioridad as Prioridad),
      estado,
      fecha: fechaDesde(datos.clave, datos.hora),
      allDay: !datos.hora,
      clientId,
      recurrenceRule: datos.recurrencia ? serializarRegla(datos.recurrencia) : null,
      recordatorioMinutos: recordatorioValido(datos.recordatorioMinutos, datos.clave),
      completadaEn:
        estado === 'hecha' ? (actual.completadaEn ?? new Date()) : null,
    },
    include: INCLUDE_ACTIVIDAD,
  });

  return { antes: actual, despues };
}

export async function cambiarEstado(user: UsuarioSesion, id: string, estado: Estado) {
  const actual = await prisma.activity.findUnique({ where: { id } });
  if (!actual) return null;
  exigirPropiedadEstricta(user, actual.ownerUserId);

  const despues = await prisma.activity.update({
    where: { id },
    data: {
      estado,
      completadaEn: estado === 'hecha' ? new Date() : null,
    },
    include: INCLUDE_ACTIVIDAD,
  });

  return { antes: actual, despues };
}

/** Reordena por arrastre. Los ids llegan en el orden final deseado. */
export async function reordenarActividades(user: UsuarioSesion, ids: string[]) {
  const propias = await prisma.activity.findMany({
    where: { id: { in: ids }, ownerUserId: user.id },
    select: { id: true },
  });
  const permitidos = new Set(propias.map((p) => p.id));
  if (permitidos.size !== ids.length) {
    throw new ErrorPermiso('Hay actividades que no son tuyas en el reordenamiento.');
  }

  await prisma.$transaction(
    ids.map((id, i) => prisma.activity.update({ where: { id }, data: { orden: i } })),
  );
}

/** Mover una tarjeta a otra columna del Kanban, respetando el orden final. */
export async function moverEnTablero(
  user: UsuarioSesion,
  id: string,
  estado: Estado,
  idsColumna: string[],
) {
  const actual = await prisma.activity.findUnique({ where: { id } });
  if (!actual) return null;
  exigirPropiedadEstricta(user, actual.ownerUserId);

  await prisma.activity.update({
    where: { id },
    data: { estado, completadaEn: estado === 'hecha' ? new Date() : null },
  });

  if (idsColumna.length) await reordenarActividades(user, idsColumna);

  return { antes: actual, estado };
}

export async function eliminarActividad(user: UsuarioSesion, id: string) {
  const actual = await prisma.activity.findUnique({ where: { id } });
  if (!actual) return null;
  exigirPropiedadEstricta(user, actual.ownerUserId);

  await prisma.activity.delete({ where: { id } });
  return actual;
}

/** Cambia sólo la fecha (arrastre en el calendario). */
export async function reprogramar(
  user: UsuarioSesion,
  id: string,
  clave: ClaveDia,
  hora?: string | null,
) {
  const actual = await prisma.activity.findUnique({ where: { id } });
  if (!actual) return null;
  exigirPropiedadEstricta(user, actual.ownerUserId);

  const horaFinal = hora ?? horaDe(actual.fecha, actual.allDay);

  const despues = await prisma.activity.update({
    where: { id },
    data: { fecha: deClaveDia(clave, horaFinal || '00:00'), allDay: !horaFinal },
  });

  return { antes: actual, despues };
}

// ---------------------------------------------------------------------------
// Sub-actividades
// ---------------------------------------------------------------------------

async function exigirActividadPropia(user: UsuarioSesion, activityId: string) {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { ownerUserId: true },
  });
  if (!a) throw new Error('La actividad no existe.');
  exigirPropiedadEstricta(user, a.ownerUserId);
}

export async function agregarSubtarea(user: UsuarioSesion, activityId: string, texto: string) {
  await exigirActividadPropia(user, activityId);
  const t = texto.trim();
  if (!t) return null;

  const ultima = await prisma.activitySubtask.findFirst({
    where: { activityId },
    orderBy: { orden: 'desc' },
    select: { orden: true },
  });

  return prisma.activitySubtask.create({
    data: { activityId, texto: t, orden: (ultima?.orden ?? -1) + 1 },
  });
}

export async function alternarSubtarea(user: UsuarioSesion, subtareaId: string) {
  const sub = await prisma.activitySubtask.findUnique({ where: { id: subtareaId } });
  if (!sub) return null;
  await exigirActividadPropia(user, sub.activityId);

  return prisma.activitySubtask.update({
    where: { id: subtareaId },
    data: { hecha: !sub.hecha },
  });
}

export async function eliminarSubtarea(user: UsuarioSesion, subtareaId: string) {
  const sub = await prisma.activitySubtask.findUnique({ where: { id: subtareaId } });
  if (!sub) return null;
  await exigirActividadPropia(user, sub.activityId);

  await prisma.activitySubtask.delete({ where: { id: subtareaId } });
  return sub;
}

// ---------------------------------------------------------------------------
// Series recurrentes: expansión por ventana
// ---------------------------------------------------------------------------

export type ItemAgenda = {
  /** Llave única en la agenda: `id` o `id::fechaOriginal` si es ocurrencia. */
  llave: string;
  activityId: string;
  fechaOriginal: ClaveDia | null;
  clave: ClaveDia;
  hora: string | null;
  titulo: string;
  descripcion: string | null;
  prioridad: Prioridad;
  estado: Estado;
  categoria: { id: string; nombre: string; colorToken: string; icono: string | null } | null;
  cliente: { id: string; nombreEmpresa: string } | null;
  esSerie: boolean;
  reajustada: boolean;
  subtotal: { hechas: number; total: number };
};

/** Días de holgura a cada lado: captura ocurrencias movidas hacia la ventana. */
const HOLGURA = 10;

export async function expandirRango(
  user: UsuarioSesion,
  desde: ClaveDia,
  hasta: ClaveDia,
): Promise<ItemAgenda[]> {
  const [filas, festivos] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...filtroActividades(user),
        archivada: false,
        fecha: { not: null },
      },
      include: { ...INCLUDE_ACTIVIDAD, occurrences: true },
      orderBy: { fecha: 'asc' },
    }),
    conjuntoFestivos(),
  ]);

  const desdeHolgado = sumarDias(desde, -HOLGURA);
  const hastaHolgado = sumarDias(hasta, HOLGURA);
  const items: ItemAgenda[] = [];

  for (const fila of filas) {
    const vista = aVista(fila);
    const base = {
      activityId: fila.id,
      hora: vista.hora,
      descripcion: fila.descripcion,
      categoria: vista.categoria,
      cliente: vista.cliente,
      subtotal: {
        hechas: fila.subtasks.filter((s) => s.hecha).length,
        total: fila.subtasks.length,
      },
    };

    // --- Actividad suelta ---
    if (!vista.recurrencia || !vista.clave) {
      if (!vista.clave) continue;
      if (dentro(vista.clave, desde, hasta)) {
        items.push({
          ...base,
          llave: fila.id,
          fechaOriginal: null,
          clave: vista.clave,
          titulo: fila.titulo,
          prioridad: vista.prioridad,
          estado: vista.estado,
          esSerie: false,
          reajustada: false,
        });
      }
      continue;
    }

    // --- Serie recurrente ---
    const excepciones = new Map(fila.occurrences.map((o) => [o.fechaOriginal, o]));

    const ocurrencias = generarOcurrencias(
      vista.clave,
      vista.recurrencia,
      desdeHolgado,
      hastaHolgado,
      festivos,
    );

    for (const oc of ocurrencias) {
      const exc = excepciones.get(oc.fechaOriginal);
      if (exc?.saltada) continue;

      const { clave, hora } = ocurrenciaEfectiva(oc, exc, vista.hora, fila.allDay);
      if (!dentro(clave, desde, hasta)) continue;

      items.push({
        ...base,
        llave: `${fila.id}::${oc.fechaOriginal}`,
        fechaOriginal: oc.fechaOriginal,
        clave,
        hora,
        titulo: exc?.titulo ?? fila.titulo,
        prioridad: (esPrioridad(exc?.prioridad) ? exc!.prioridad : vista.prioridad) as Prioridad,
        estado: (esEstado(exc?.estado) ? exc!.estado : 'por_hacer') as Estado,
        esSerie: true,
        reajustada: oc.reajustada,
      });
    }
  }

  return ordenarAgenda(items);
}

function dentro(clave: ClaveDia, desde: ClaveDia, hasta: ClaveDia) {
  return diferenciaDias(desde, clave) >= 0 && diferenciaDias(clave, hasta) >= 0;
}

/** Orden canónico de la agenda: día, luego hora, luego prioridad. */
export function ordenarAgenda(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => {
    if (a.clave !== b.clave) return a.clave < b.clave ? -1 : 1;
    const ha = a.hora ?? '99:99';
    const hb = b.hora ?? '99:99';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
  });
}

/** Orden del dashboard: primero lo urgente, luego la hora. */
export function ordenarPorPrioridad(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => {
    const p = PESO_PRIORIDAD[a.prioridad] - PESO_PRIORIDAD[b.prioridad];
    if (p !== 0) return p;
    const ha = a.hora ?? '99:99';
    const hb = b.hora ?? '99:99';
    if (ha !== hb) return ha < hb ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, 'es');
  });
}

// ---------------------------------------------------------------------------
// Edición de ocurrencias de una serie
// ---------------------------------------------------------------------------

/** Marca / desmarca una sola ocurrencia sin tocar el resto de la serie. */
export async function cambiarEstadoOcurrencia(
  user: UsuarioSesion,
  activityId: string,
  fechaOriginal: ClaveDia,
  estado: Estado,
) {
  await exigirActividadPropia(user, activityId);

  return prisma.activityOccurrence.upsert({
    where: { activityId_fechaOriginal: { activityId, fechaOriginal } },
    create: {
      activityId,
      fechaOriginal,
      estado,
      completadaEn: estado === 'hecha' ? new Date() : null,
    },
    update: {
      estado,
      completadaEn: estado === 'hecha' ? new Date() : null,
    },
  });
}

/** Mueve una ocurrencia a otro día sin romper la serie. */
export async function moverOcurrencia(
  user: UsuarioSesion,
  activityId: string,
  fechaOriginal: ClaveDia,
  nuevaClave: ClaveDia,
  hora?: string | null,
) {
  await exigirActividadPropia(user, activityId);
  const fecha = deClaveDia(nuevaClave, hora || '00:00');

  return prisma.activityOccurrence.upsert({
    where: { activityId_fechaOriginal: { activityId, fechaOriginal } },
    create: { activityId, fechaOriginal, fecha, movida: true },
    update: { fecha, movida: true, saltada: false },
  });
}

/** Salta una ocurrencia (no se genera ese día). */
export async function saltarOcurrencia(
  user: UsuarioSesion,
  activityId: string,
  fechaOriginal: ClaveDia,
) {
  await exigirActividadPropia(user, activityId);

  return prisma.activityOccurrence.upsert({
    where: { activityId_fechaOriginal: { activityId, fechaOriginal } },
    create: { activityId, fechaOriginal, saltada: true },
    update: { saltada: true },
  });
}

/**
 * Edita una serie con alcance:
 *  - `esta`       → excepción sobre esa ocurrencia
 *  - `siguientes` → corta la serie el día anterior y abre una nueva desde aquí
 *  - `serie`      → edita la actividad madre
 */
export async function editarSerie(
  user: UsuarioSesion,
  activityId: string,
  fechaOriginal: ClaveDia,
  alcance: AlcanceEdicion,
  datos: DatosActividad,
) {
  const madre = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!madre) return null;
  exigirPropiedadEstricta(user, madre.ownerUserId);

  if (alcance === 'esta') {
    const cambiaDia = Boolean(datos.clave && datos.clave !== fechaOriginal);

    // Sólo se guarda fecha propia si la ocurrencia se va a otro día o si trae
    // hora propia. Guardarla siempre metería un 00:00 inventado para las
    // ediciones sin hora — y como ahora la hora de la excepción SÍ se respeta,
    // eso mandaría la ocurrencia a medianoche.
    const fecha =
      datos.clave && (cambiaDia || datos.hora)
        ? deClaveDia(datos.clave, datos.hora || '00:00')
        : null;
    const movida = cambiaDia;

    await prisma.activityOccurrence.upsert({
      where: { activityId_fechaOriginal: { activityId, fechaOriginal } },
      create: {
        activityId,
        fechaOriginal,
        titulo: datos.titulo.trim(),
        prioridad: datos.prioridad ?? null,
        estado: datos.estado ?? 'por_hacer',
        fecha,
        movida,
      },
      update: {
        titulo: datos.titulo.trim(),
        prioridad: datos.prioridad ?? null,
        estado: datos.estado ?? 'por_hacer',
        ...(fecha ? { fecha, movida } : {}),
      },
    });

    return { alcance, activityId };
  }

  if (alcance === 'siguientes') {
    const reglaOriginal = parsearRegla(madre.recurrenceRule);
    const clientId = await validarCliente(user, datos.clientId);

    // 1) La serie original termina el día anterior a esta ocurrencia.
    if (reglaOriginal) {
      const cortada: ReglaRecurrencia = {
        ...reglaOriginal,
        terminacion: 'hasta',
        hasta: sumarDias(fechaOriginal, -1),
      };
      await prisma.activity.update({
        where: { id: activityId },
        data: { recurrenceRule: serializarRegla(cortada) },
      });
    }

    // 2) Nace una serie nueva desde esta fecha, ligada a la madre.
    const nueva = await prisma.activity.create({
      data: {
        ownerUserId: user.id,
        titulo: datos.titulo.trim(),
        descripcion: datos.descripcion?.trim() || null,
        categoryId: datos.categoryId || null,
        prioridad: datos.prioridad ?? (madre.prioridad as Prioridad),
        estado: 'por_hacer',
        fecha: deClaveDia(datos.clave ?? fechaOriginal, datos.hora || '00:00'),
        allDay: !datos.hora,
        clientId,
        recurrenceRule: datos.recurrencia
          ? serializarRegla(datos.recurrencia)
          : madre.recurrenceRule,
        recordatorioMinutos: recordatorioValido(
          datos.recordatorioMinutos,
          datos.clave ?? fechaOriginal,
        ),
        recurrenceParentId: madre.recurrenceParentId ?? madre.id,
        orden: madre.orden,
      },
    });

    // 3) Las excepciones de esta fecha en adelante se mudan con la serie nueva.
    await prisma.activityOccurrence.deleteMany({
      where: { activityId, fechaOriginal: { gte: fechaOriginal } },
    });

    return { alcance, activityId: nueva.id };
  }

  // alcance === 'serie'
  const resultado = await actualizarActividad(user, activityId, datos);
  return { alcance, activityId, ...resultado };
}

/** Borra la serie completa o sólo una ocurrencia. */
export async function eliminarSerie(
  user: UsuarioSesion,
  activityId: string,
  fechaOriginal: ClaveDia | null,
  alcance: AlcanceEdicion,
) {
  const madre = await prisma.activity.findUnique({ where: { id: activityId } });
  if (!madre) return null;
  exigirPropiedadEstricta(user, madre.ownerUserId);

  if (alcance === 'esta' && fechaOriginal) {
    return saltarOcurrencia(user, activityId, fechaOriginal);
  }

  if (alcance === 'siguientes' && fechaOriginal) {
    const regla = parsearRegla(madre.recurrenceRule);
    if (regla) {
      const cortada: ReglaRecurrencia = {
        ...regla,
        terminacion: 'hasta',
        hasta: sumarDias(fechaOriginal, -1),
      };
      return prisma.activity.update({
        where: { id: activityId },
        data: { recurrenceRule: serializarRegla(cortada) },
      });
    }
  }

  await prisma.activity.delete({ where: { id: activityId } });
  return madre;
}
