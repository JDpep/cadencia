import { claveDia, type ClaveDia } from './tiempo';

/**
 * Agregación del histórico de vacantes — la parte pura, sin base de datos.
 *
 * Vive aparte por la misma razón que el motor de recurrencia: para probarse
 * sola. Y además la comparten el servidor (que arma la vista inicial) y el
 * cliente (que rehace los filtros sin ir y volver). Al ser la misma función,
 * la gráfica, la tabla y el detalle no pueden discrepar entre sí.
 */

export const NOMBRES_MES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

export const NOMBRES_MES_LARGO = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export type Vacante = {
  /** `activityId` o `activityId::fechaOriginal` si vino de una ocurrencia. */
  llave: string;
  activityId: string;
  titulo: string;
  /** ISO — viaja por JSON hasta el cliente. */
  completadaEn: string;
  clave: ClaveDia;
  anio: number;
  /** 1–12. */
  mes: number;
  userId: string;
  persona: string;
  cliente: string | null;
  esOcurrencia: boolean;
};

export type FiltroVacantes = {
  anio?: number;
  userId?: string;
  /** 1–12, inclusive. */
  mesDesde?: number;
  mesHasta?: number;
};

export type MesVacantes = {
  mes: number;
  etiqueta: string;
  total: number;
  /** userId → cuántas atendió esa persona ese mes. */
  porPersona: Record<string, number>;
};

export type HistoricoVacantes = {
  anio: number;
  aniosDisponibles: number[];
  /** Quienes aparecen en el periodo filtrado — las columnas del desglose. */
  personas: { id: string; nombre: string }[];
  porMes: MesVacantes[];
  totalPeriodo: number;
  totalMesEnCurso: number;
  lider: { id: string; nombre: string; total: number } | null;
  detalle: Vacante[];
};

export function anioDeHoy(ahora = new Date()): number {
  return Number(claveDia(ahora).slice(0, 4));
}

export function mesDeHoy(ahora = new Date()): number {
  return Number(claveDia(ahora).slice(5, 7));
}

/** Agrega un conjunto de vacantes según el filtro. */
export function agregar(
  todas: Vacante[],
  filtro: FiltroVacantes = {},
  ahora = new Date(),
): HistoricoVacantes {
  const aniosDisponibles = [...new Set(todas.map((v) => v.anio))].sort((a, b) => b - a);
  const anioHoy = anioDeHoy(ahora);
  const anio = filtro.anio ?? aniosDisponibles[0] ?? anioHoy;

  const mesDesde = Math.max(1, filtro.mesDesde ?? 1);
  const mesHasta = Math.min(12, filtro.mesHasta ?? 12);

  const detalle = todas
    .filter(
      (v) =>
        v.anio === anio &&
        v.mes >= mesDesde &&
        v.mes <= mesHasta &&
        (!filtro.userId || v.userId === filtro.userId),
    )
    .sort((a, b) => (a.completadaEn < b.completadaEn ? 1 : -1));

  const porMes: MesVacantes[] = [];
  for (let mes = mesDesde; mes <= mesHasta; mes++) {
    const delMes = detalle.filter((v) => v.mes === mes);
    const porPersona: Record<string, number> = {};
    for (const v of delMes) porPersona[v.userId] = (porPersona[v.userId] ?? 0) + 1;
    porMes.push({ mes, etiqueta: NOMBRES_MES[mes - 1], total: delMes.length, porPersona });
  }

  const personas = [...new Map(detalle.map((v) => [v.userId, v.persona])).entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const totales = new Map<string, number>();
  for (const v of detalle) totales.set(v.userId, (totales.get(v.userId) ?? 0) + 1);

  const mejor = [...totales.entries()].sort((a, b) => b[1] - a[1])[0];

  const mesHoy = mesDeHoy(ahora);

  return {
    anio,
    aniosDisponibles: aniosDisponibles.length ? aniosDisponibles : [anioHoy],
    personas,
    porMes,
    totalPeriodo: detalle.length,
    totalMesEnCurso:
      anio === anioHoy ? detalle.filter((v) => v.mes === mesHoy).length : 0,
    lider: mejor
      ? {
          id: mejor[0],
          nombre: personas.find((p) => p.id === mejor[0])?.nombre ?? '—',
          total: mejor[1],
        }
      : null,
    detalle,
  };
}

/** Exportación a CSV. Se arma en el cliente: los datos ya están ahí. */
export function aCSV(vacantes: Vacante[]): string {
  const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const cabecera = [
    'Fecha de completado',
    'Año',
    'Mes',
    'Entrevista',
    'Ejecutivo',
    'Cliente',
    'Origen',
  ];

  const filas = vacantes.map((v) =>
    [
      v.clave,
      String(v.anio),
      NOMBRES_MES_LARGO[v.mes - 1],
      v.titulo,
      v.persona,
      v.cliente ?? '',
      v.esOcurrencia ? 'ocurrencia de serie' : 'actividad',
    ]
      .map(escapar)
      .join(','),
  );

  return [cabecera.map(escapar).join(','), ...filas].join('\n');
}
