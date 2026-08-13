import { format as formatFns } from 'date-fns';
import { es } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Toda la app razona en America/Mexico_City. En la base se guardan instantes
 * UTC; aquí están las únicas conversiones permitidas.
 *
 * Convención: una "clave de día" es un string `yyyy-MM-dd` en zona local.
 * Es la unidad con la que trabajan la recurrencia, los festivos y el calendario.
 */
export const ZONA = process.env.APP_TIMEZONE || 'America/Mexico_City';

export type ClaveDia = string; // yyyy-MM-dd

/** Instante actual. */
export function ahora(): Date {
  return new Date();
}

/** Convierte un instante a la fecha/hora "de pared" en México. */
export function enZona(fecha: Date): Date {
  return toZonedTime(fecha, ZONA);
}

/** Clave `yyyy-MM-dd` del día local al que pertenece un instante. */
export function claveDia(fecha: Date): ClaveDia {
  return formatFns(toZonedTime(fecha, ZONA), 'yyyy-MM-dd');
}

/** Clave del día de hoy en México. */
export function hoyClave(): ClaveDia {
  return claveDia(new Date());
}

/** Instante UTC correspondiente a `clave` + `hora` (HH:mm) en México. */
export function deClaveDia(clave: ClaveDia, hora = '00:00'): Date {
  return fromZonedTime(`${clave}T${hora}:00`, ZONA);
}

/** Suma días de calendario sobre una clave, sin tocar husos. */
export function sumarDias(clave: ClaveDia, dias: number): ClaveDia {
  const [a, m, d] = clave.split('-').map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado, para una clave de día. */
export function diaSemana(clave: ClaveDia): number {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function esFinDeSemana(clave: ClaveDia): boolean {
  const d = diaSemana(clave);
  return d === 0 || d === 6;
}

/** Diferencia en días entre dos claves (b - a). */
export function diferenciaDias(a: ClaveDia, b: ClaveDia): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Formato con locale español. */
export function fmt(fecha: Date, patron: string): string {
  return formatFns(toZonedTime(fecha, ZONA), patron, { locale: es });
}

export function fmtClave(clave: ClaveDia, patron: string): string {
  const [a, m, d] = clave.split('-').map(Number);
  return formatFns(new Date(a, m - 1, d), patron, { locale: es });
}

/** "14:30" o null si la actividad es de día completo. */
export function horaDe(fecha: Date | null, allDay: boolean): string | null {
  if (!fecha || allDay) return null;
  return fmt(fecha, 'HH:mm');
}

/** Texto humano: "hoy", "mañana", "hace 3 días", "vie 14 mar". */
export function fechaRelativa(clave: ClaveDia): string {
  const dif = diferenciaDias(hoyClave(), clave);
  if (dif === 0) return 'hoy';
  if (dif === 1) return 'mañana';
  if (dif === -1) return 'ayer';
  if (dif < 0) return `hace ${Math.abs(dif)} días`;
  if (dif <= 6) return fmtClave(clave, "EEEE").toLowerCase();
  return fmtClave(clave, "d 'de' MMM");
}

/** Lunes de la semana que contiene a `clave`. */
export function inicioSemana(clave: ClaveDia): ClaveDia {
  const d = diaSemana(clave);
  const retroceso = d === 0 ? 6 : d - 1; // semana inicia en lunes
  return sumarDias(clave, -retroceso);
}

/** Primer día del mes de `clave`. */
export function inicioMes(clave: ClaveDia): ClaveDia {
  return `${clave.slice(0, 7)}-01`;
}

/** Último día del mes de `clave`. */
export function finMes(clave: ClaveDia): ClaveDia {
  const [a, m] = clave.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${clave.slice(0, 7)}-${String(ultimo).padStart(2, '0')}`;
}

/** Rejilla de 6 semanas (42 días) que cubre el mes, empezando en lunes. */
export function rejillaMes(clave: ClaveDia): ClaveDia[] {
  const primero = inicioSemana(inicioMes(clave));
  return Array.from({ length: 42 }, (_, i) => sumarDias(primero, i));
}

export function rangoSemana(clave: ClaveDia): ClaveDia[] {
  const lunes = inicioSemana(clave);
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

export const NOMBRES_DIA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const NOMBRES_DIA_LARGO = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
];
