import { REGLAS_AUSENCIA, type TipoAusencia } from './dominio';
import { esHabil } from './recurrence';
import { diferenciaDias, sumarDias, type ClaveDia } from './tiempo';

/**
 * Cálculo de ausencias — la parte pura, sin base de datos.
 *
 * El mismo criterio de día hábil que usa la recurrencia (§6): fin de semana
 * fuera, y festivos fuera si el catálogo los marca. Reutilizar `esHabil()` no
 * es un ahorro de líneas: es lo que garantiza que «5 días hábiles» signifique
 * lo mismo en una serie recurrente y en una solicitud de vacaciones.
 *
 * Igual que `recurrence.ts` y `recordatorios.ts`, vive aparte del repositorio
 * para poder probarse solo (`npm run test:ausencias`).
 */

/** Tope de seguridad: nadie pide una ausencia de más de dos años. */
const TOPE_DIAS = 730;

export type RangoAusencia = { inicio: ClaveDia; fin: ClaveDia };

/**
 * Los días hábiles de un rango, inclusive en ambos extremos.
 * Devuelve las claves, no sólo el conteo: la UI las pinta y el traslape las usa.
 */
export function diasHabilesDe(
  rango: RangoAusencia,
  festivos: Set<string> = new Set(),
): ClaveDia[] {
  const largo = diferenciaDias(rango.inicio, rango.fin);
  if (largo < 0 || largo > TOPE_DIAS) return [];

  const salida: ClaveDia[] = [];
  for (let i = 0; i <= largo; i++) {
    const clave = sumarDias(rango.inicio, i);
    if (esHabil(clave, festivos, true)) salida.push(clave);
  }
  return salida;
}

export function contarDiasHabiles(
  rango: RangoAusencia,
  festivos: Set<string> = new Set(),
): number {
  return diasHabilesDe(rango, festivos).length;
}

/** Todos los días del rango, hábiles o no — para pintar el bloque en la agenda. */
export function diasDe(rango: RangoAusencia): ClaveDia[] {
  const largo = diferenciaDias(rango.inicio, rango.fin);
  if (largo < 0 || largo > TOPE_DIAS) return [];
  return Array.from({ length: largo + 1 }, (_, i) => sumarDias(rango.inicio, i));
}

export function seTraslapan(a: RangoAusencia, b: RangoAusencia): boolean {
  return diferenciaDias(a.inicio, b.fin) >= 0 && diferenciaDias(b.inicio, a.fin) >= 0;
}

export function contieneDia(rango: RangoAusencia, clave: ClaveDia): boolean {
  return diferenciaDias(rango.inicio, clave) >= 0 && diferenciaDias(clave, rango.fin) >= 0;
}

export type SaldoVacaciones = {
  anio: number;
  asignados: number;
  tomados: number;
  pendientes: number;
  /** Derivado, nunca guardado: asignados − tomados − pendientes. */
  disponibles: number;
};

export function saldoDe(fila: {
  anio: number;
  diasAsignados: number;
  diasTomados: number;
  diasPendientes: number;
}): SaldoVacaciones {
  return {
    anio: fila.anio,
    asignados: fila.diasAsignados,
    tomados: fila.diasTomados,
    pendientes: fila.diasPendientes,
    disponibles: fila.diasAsignados - fila.diasTomados - fila.diasPendientes,
  };
}

export type ProblemaSolicitud =
  | 'rango_invalido'
  | 'sin_dias_habiles'
  | 'motivo_requerido'
  | 'saldo_insuficiente';

export const MENSAJE_PROBLEMA: Record<ProblemaSolicitud, string> = {
  rango_invalido: 'La fecha de fin no puede ser anterior a la de inicio.',
  sin_dias_habiles: 'El rango elegido no tiene ningún día hábil.',
  motivo_requerido: 'Este tipo de ausencia necesita un motivo.',
  saldo_insuficiente: 'No te quedan suficientes días disponibles.',
};

/**
 * Valida una solicitud. La misma función corre en el cliente para avisar en
 * vivo y en el servidor para decidir: es el servidor el que manda, pero así
 * el usuario no descubre el problema hasta después de enviar.
 */
export function validarSolicitud(entrada: {
  tipo: TipoAusencia;
  rango: RangoAusencia;
  motivo?: string | null;
  diasHabiles: number;
  disponibles: number;
}): ProblemaSolicitud | null {
  if (diferenciaDias(entrada.rango.inicio, entrada.rango.fin) < 0) return 'rango_invalido';
  if (entrada.diasHabiles <= 0) return 'sin_dias_habiles';

  const regla = REGLAS_AUSENCIA[entrada.tipo];
  if (regla.motivoObligatorio && !entrada.motivo?.trim()) return 'motivo_requerido';

  // Sólo los tipos que descuentan compiten por el saldo anual.
  if (regla.descuentaSaldo && entrada.diasHabiles > entrada.disponibles) {
    return 'saldo_insuficiente';
  }

  return null;
}
