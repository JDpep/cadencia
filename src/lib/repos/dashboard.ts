import 'server-only';
import { prisma } from '@/lib/prisma';
import { filtroActividades, type UsuarioSesion } from '@/lib/auth/guard';
import { PRIORIDADES, type Estado, type Prioridad } from '@/lib/dominio';
import { diferenciaDias, hoyClave, sumarDias, type ClaveDia } from '@/lib/tiempo';
import { expandirRango, ordenarPorPrioridad, type ItemAgenda } from './actividades';

/** Ventana de lectura del dashboard: dos meses atrás para vencidas, uno adelante. */
const DIAS_ATRAS = 60;
const DIAS_ADELANTE = 30;
const DIAS_PROXIMAS = 7;

export type ResumenDashboard = {
  hoy: ItemAgenda[];
  vencidas: (ItemAgenda & { diasAtraso: number })[];
  proximas: ItemAgenda[];
  recordatorios: ItemAgenda[];
  sinFecha: number;
  conteos: Record<Estado, number>;
  totalAbiertas: number;
  avance: number; // 0–100, sobre el total de actividades vivas
  distribucion: { prioridad: Prioridad; abiertas: number }[];
};

export async function resumenDashboard(user: UsuarioSesion): Promise<ResumenDashboard> {
  const hoy = hoyClave();

  const [items, conteosCrudos, sinFecha] = await Promise.all([
    expandirRango(user, sumarDias(hoy, -DIAS_ATRAS), sumarDias(hoy, DIAS_ADELANTE)),
    prisma.activity.groupBy({
      by: ['estado'],
      where: { ...filtroActividades(user), archivada: false },
      _count: { _all: true },
    }),
    prisma.activity.count({
      where: {
        ...filtroActividades(user),
        archivada: false,
        fecha: null,
        estado: { not: 'hecha' },
      },
    }),
  ]);

  const conteos: Record<Estado, number> = { por_hacer: 0, en_proceso: 0, hecha: 0 };
  for (const c of conteosCrudos) {
    if (c.estado in conteos) conteos[c.estado as Estado] = c._count._all;
  }

  const total = conteos.por_hacer + conteos.en_proceso + conteos.hecha;
  const avance = total === 0 ? 0 : Math.round((conteos.hecha / total) * 100);

  const deHoy = items.filter((i) => i.clave === hoy);
  const vencidas = items
    .filter((i) => i.estado !== 'hecha' && diferenciaDias(i.clave, hoy) > 0)
    .map((i) => ({ ...i, diasAtraso: diferenciaDias(i.clave, hoy) }))
    .sort((a, b) => b.diasAtraso - a.diasAtraso);

  const proximas = items.filter((i) => {
    const d = diferenciaDias(hoy, i.clave);
    return d > 0 && d <= DIAS_PROXIMAS && i.estado !== 'hecha';
  });

  const recordatorios = ordenarPorHora(
    deHoy.filter((i) => i.hora !== null && i.estado !== 'hecha'),
  );

  const distribucion = PRIORIDADES.map((prioridad) => ({
    prioridad,
    abiertas: items.filter((i) => i.prioridad === prioridad && i.estado !== 'hecha').length,
  }));

  return {
    hoy: ordenarPorPrioridad(deHoy),
    vencidas: vencidas.slice(0, 25),
    proximas: proximas.slice(0, 25),
    recordatorios,
    sinFecha,
    conteos,
    totalAbiertas: conteos.por_hacer + conteos.en_proceso,
    avance,
    distribucion,
  };
}

function ordenarPorHora(items: ItemAgenda[]) {
  return [...items].sort((a, b) => (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99'));
}

/** Resumen de un solo día, para el panel lateral de la agenda. */
export async function resumenDia(user: UsuarioSesion, clave: ClaveDia) {
  const items = await expandirRango(user, clave, clave);
  return {
    clave,
    items,
    hechas: items.filter((i) => i.estado === 'hecha').length,
    total: items.length,
  };
}
