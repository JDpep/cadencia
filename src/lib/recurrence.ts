import { RRule, Weekday } from 'rrule';
import type { Frecuencia, ReglaReajuste, Terminacion } from './dominio';
import {
  type ClaveDia,
  claveDia,
  diaSemana,
  esFinDeSemana,
  horaDe,
  sumarDias,
  diferenciaDias,
} from './tiempo';

/**
 * Motor de recurrencia de Cadencia.
 *
 * Regla de oro del producto: NINGUNA ocurrencia puede caer en sábado o
 * domingo. Se consigue en dos capas:
 *
 *  1. Las frecuencias "días hábiles" y "cada N días hábiles" cuentan sólo
 *     L–V, así que nunca llegan a generar un fin de semana.
 *  2. El resto (semanal, quincenal, mensual) se genera con RRULE y después
 *     pasa por `reajustar()`, que empuja lo que caiga en fin de semana —y en
 *     festivo, si está activado— al día hábil que indique `reglaReajuste`.
 *
 * Las ocurrencias no se guardan en la base: se generan por ventana (el rango
 * que el calendario está mostrando). En `ActivityOccurrence` sólo viven las
 * excepciones: movidas, saltadas o completadas.
 */

export type ReglaRecurrencia = {
  frecuencia: Frecuencia;
  /** Cada N días hábiles / cada N semanas. */
  intervalo: number;
  /** Días de la semana, 0 = domingo … 6 = sábado. Para semanal/quincenal. */
  dias: number[];
  /** Día del mes 1–31, para `mensual_dia`. */
  diaMes?: number;
  /** Posición 1..4 o -1 (último), para `mensual_posicion`. */
  posicion?: number;
  /** Día de la semana de la posición, 0 = domingo … 6 = sábado. */
  diaSemanaPos?: number;

  omitirFinDeSemana: boolean;
  reglaReajuste: ReglaReajuste;
  respetarFestivos: boolean;

  terminacion: Terminacion;
  /** yyyy-MM-dd, si `terminacion === 'hasta'`. */
  hasta?: ClaveDia;
  /** Número de ocurrencias, si `terminacion === 'conteo'`. */
  conteo?: number;
};

export const REGLA_POR_DEFECTO: ReglaRecurrencia = {
  frecuencia: 'dias_habiles',
  intervalo: 1,
  dias: [1, 3, 5],
  omitirFinDeSemana: true,
  reglaReajuste: 'siguiente_habil',
  respetarFestivos: true,
  terminacion: 'nunca',
};

/** Tope duro de generación: evita que una serie "sin fin" muy vieja se dispare. */
const TOPE_CRUDO = 3000;

// ---------------------------------------------------------------------------
// Serialización
// ---------------------------------------------------------------------------

export function serializarRegla(regla: ReglaRecurrencia): string {
  return JSON.stringify(regla);
}

export function parsearRegla(raw: string | null | undefined): ReglaRecurrencia | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ReglaRecurrencia>;
    if (!parsed.frecuencia) return null;
    return { ...REGLA_POR_DEFECTO, ...parsed } as ReglaRecurrencia;
  } catch {
    return null;
  }
}

const DIAS_RRULE = [
  RRule.SU,
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
];

/**
 * Representación iCal de la parte estándar de la regla. Las banderas de días
 * hábiles/festivos viajan aparte porque RRULE no las sabe expresar; al migrar
 * a la nube esta cadena es lo que se comparte con otros calendarios.
 */
export function aTextoRRule(regla: ReglaRecurrencia, inicio: ClaveDia): string | null {
  const opciones = opcionesRRule(regla, inicio);
  if (!opciones) return null;
  return new RRule(opciones).toString();
}

function fechaUTC(clave: ClaveDia): Date {
  const [a, m, d] = clave.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function claveUTC(fecha: Date): ClaveDia {
  return fecha.toISOString().slice(0, 10);
}

function opcionesRRule(
  regla: ReglaRecurrencia,
  inicio: ClaveDia,
): ConstructorParameters<typeof RRule>[0] | null {
  const dtstart = fechaUTC(inicio);

  switch (regla.frecuencia) {
    case 'semanal':
      return {
        freq: RRule.WEEKLY,
        interval: Math.max(1, regla.intervalo || 1),
        byweekday: diasValidos(regla).map((d) => DIAS_RRULE[d]),
        dtstart,
        wkst: RRule.MO,
      };
    case 'quincenal':
      return {
        freq: RRule.WEEKLY,
        interval: 2,
        byweekday: diasValidos(regla).map((d) => DIAS_RRULE[d]),
        dtstart,
        wkst: RRule.MO,
      };
    case 'mensual_dia':
      return {
        freq: RRule.MONTHLY,
        interval: Math.max(1, regla.intervalo || 1),
        bymonthday: [clamp(regla.diaMes ?? Number(inicio.slice(8, 10)), 1, 31)],
        dtstart,
      };
    case 'mensual_posicion': {
      const dia = regla.diaSemanaPos ?? diaSemana(inicio);
      const pos = regla.posicion ?? 1;
      const weekday = DIAS_RRULE[dia] as Weekday;
      return {
        freq: RRule.MONTHLY,
        interval: Math.max(1, regla.intervalo || 1),
        byweekday: [weekday.nth(pos)],
        dtstart,
      };
    }
    default:
      // dias_habiles y cada_n_habiles no se expresan con RRULE: se cuentan.
      return null;
  }
}

/**
 * Días elegidos por el usuario, tal cual.
 *
 * No se filtra el fin de semana aquí a propósito: si se descartara, elegir
 * "sábado" se convertiría en silencio en "lunes". La ocurrencia se genera en
 * su día teórico y es `reajustar()` quien la mueve al día hábil que
 * corresponda. La UI ofrece L–V por defecto; el motor se mantiene general.
 */
function diasValidos(regla: ReglaRecurrencia): number[] {
  return regla.dias?.length ? regla.dias : [1];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ---------------------------------------------------------------------------
// Días hábiles
// ---------------------------------------------------------------------------

export function esHabil(
  clave: ClaveDia,
  festivos: Set<string>,
  respetarFestivos: boolean,
): boolean {
  if (esFinDeSemana(clave)) return false;
  if (respetarFestivos && festivos.has(clave)) return false;
  return true;
}

/** Primer día hábil desde `clave` avanzando (`+1`) o retrocediendo (`-1`). */
export function habilMasCercano(
  clave: ClaveDia,
  direccion: 1 | -1,
  festivos: Set<string>,
  respetarFestivos: boolean,
): ClaveDia {
  let actual = clave;
  for (let i = 0; i < 15; i++) {
    if (esHabil(actual, festivos, respetarFestivos)) return actual;
    actual = sumarDias(actual, direccion);
  }
  return actual;
}

/**
 * Aplica la regla de reajuste a una fecha cruda.
 * Devuelve `null` cuando la ocurrencia debe descartarse.
 */
function reajustar(
  clave: ClaveDia,
  regla: ReglaRecurrencia,
  festivos: Set<string>,
): ClaveDia | null {
  const debeAjustar =
    (regla.omitirFinDeSemana && esFinDeSemana(clave)) ||
    (regla.respetarFestivos && festivos.has(clave));

  if (!debeAjustar) return clave;

  switch (regla.reglaReajuste) {
    case 'siguiente_habil':
      return habilMasCercano(clave, 1, festivos, regla.respetarFestivos);
    case 'anterior_habil':
      return habilMasCercano(clave, -1, festivos, regla.respetarFestivos);
    case 'omitir':
      return null;
  }
}

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------

export type Ocurrencia = {
  /** Fecha teórica de la serie — llave estable de la ocurrencia. */
  fechaOriginal: ClaveDia;
  /** Fecha efectiva tras reajustar fin de semana / festivo. */
  fecha: ClaveDia;
  /** Índice 0-based dentro de la serie. */
  indice: number;
  /** true si el reajuste la movió de su día teórico. */
  reajustada: boolean;
};

/**
 * Genera las ocurrencias de una serie dentro de una ventana.
 *
 * @param inicio        fecha de la primera ocurrencia (yyyy-MM-dd)
 * @param regla         regla de recurrencia
 * @param ventanaDesde  primer día visible
 * @param ventanaHasta  último día visible
 * @param festivos      claves yyyy-MM-dd del catálogo de festivos
 */
export function generarOcurrencias(
  inicio: ClaveDia,
  regla: ReglaRecurrencia,
  ventanaDesde: ClaveDia,
  ventanaHasta: ClaveDia,
  festivos: Set<string> = new Set(),
): Ocurrencia[] {
  if (diferenciaDias(inicio, ventanaHasta) < 0) return [];

  const limite =
    regla.terminacion === 'hasta' && regla.hasta
      ? (diferenciaDias(regla.hasta, ventanaHasta) > 0 ? regla.hasta : ventanaHasta)
      : ventanaHasta;

  const crudas =
    regla.frecuencia === 'dias_habiles' || regla.frecuencia === 'cada_n_habiles'
      ? crudasPorDiasHabiles(inicio, regla, limite, festivos)
      : crudasPorRRule(inicio, regla, limite);

  const resultado: Ocurrencia[] = [];
  const ocupadas = new Set<string>();
  let indice = 0;

  for (const fechaOriginal of crudas) {
    if (regla.terminacion === 'conteo' && indice >= (regla.conteo ?? 1)) break;
    if (regla.terminacion === 'hasta' && regla.hasta && diferenciaDias(regla.hasta, fechaOriginal) > 0) {
      break;
    }

    const fecha = reajustar(fechaOriginal, regla, festivos);
    if (fecha === null) {
      // 'omitir': la ocurrencia se descarta pero sí consume su lugar en la serie.
      indice++;
      continue;
    }

    // Un reajuste puede empujar dos ocurrencias al mismo día hábil
    // (p. ej. viernes festivo + sábado → ambos al lunes). Se conserva la primera.
    if (ocupadas.has(fecha)) {
      indice++;
      continue;
    }
    ocupadas.add(fecha);

    resultado.push({
      fechaOriginal,
      fecha,
      indice,
      reajustada: fecha !== fechaOriginal,
    });
    indice++;
  }

  return resultado.filter(
    (o) =>
      diferenciaDias(ventanaDesde, o.fecha) >= 0 &&
      diferenciaDias(o.fecha, ventanaHasta) >= 0,
  );
}

/**
 * Día y hora efectivos de una ocurrencia, ya aplicada su excepción.
 *
 * Las dos mitades siguen reglas distintas a propósito:
 *
 *  · El **día** sólo se abandona si el usuario movió la ocurrencia a otro día
 *    (`movida`). Si se tomara siempre de la excepción, una ocurrencia que el
 *    motor reajustó de sábado a lunes volvería a su sábado original en cuanto
 *    se le editara cualquier cosa — y ahí se rompe la regla de oro.
 *
 *  · La **hora**, en cambio, se toma de la excepción siempre que la tenga.
 *    Cambiar sólo la hora de una ocurrencia no la «mueve» de día, y aun así
 *    tiene que respetarse: exigir `movida` para leerla hacía que el cambio se
 *    guardara y nadie lo mirara.
 */
export function ocurrenciaEfectiva(
  ocurrencia: { fecha: ClaveDia },
  excepcion: { fecha: Date | null; movida: boolean } | undefined,
  horaBase: string | null,
  allDay: boolean,
): { clave: ClaveDia; hora: string | null } {
  const propia = excepcion?.fecha ?? null;

  return {
    clave: excepcion?.movida && propia ? claveDia(propia) : ocurrencia.fecha,
    hora: propia ? horaDe(propia, allDay) : horaBase,
  };
}

/** L–V contados uno a uno; el fin de semana simplemente no existe. */
function crudasPorDiasHabiles(
  inicio: ClaveDia,
  regla: ReglaRecurrencia,
  limite: ClaveDia,
  festivos: Set<string>,
): ClaveDia[] {
  const paso = regla.frecuencia === 'cada_n_habiles' ? Math.max(1, regla.intervalo || 1) : 1;
  const salida: ClaveDia[] = [];

  // La serie arranca en el primer día hábil desde `inicio`.
  let actual = habilMasCercano(inicio, 1, festivos, regla.respetarFestivos);
  let guardia = 0;

  while (diferenciaDias(actual, limite) >= 0 && salida.length < TOPE_CRUDO && guardia < 20_000) {
    salida.push(actual);

    // Avanza `paso` días hábiles.
    let restantes = paso;
    while (restantes > 0 && guardia < 20_000) {
      actual = sumarDias(actual, 1);
      guardia++;
      if (esHabil(actual, festivos, regla.respetarFestivos)) restantes--;
    }
  }

  return salida;
}

function crudasPorRRule(
  inicio: ClaveDia,
  regla: ReglaRecurrencia,
  limite: ClaveDia,
): ClaveDia[] {
  const opciones = opcionesRRule(regla, inicio);
  if (!opciones) return [];

  const rule = new RRule(opciones);
  const fechas = rule.between(fechaUTC(inicio), fechaUTC(limite), true);
  return fechas.slice(0, TOPE_CRUDO).map(claveUTC);
}

// ---------------------------------------------------------------------------
// Texto legible
// ---------------------------------------------------------------------------

const NOMBRE_DIA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const POSICIONES: Record<number, string> = {
  1: 'primer',
  2: 'segundo',
  3: 'tercer',
  4: 'cuarto',
  [-1]: 'último',
};

export function describirRegla(regla: ReglaRecurrencia): string {
  let base: string;

  switch (regla.frecuencia) {
    case 'dias_habiles':
      base = 'Todos los días hábiles (L–V)';
      break;
    case 'cada_n_habiles':
      base = `Cada ${regla.intervalo} ${regla.intervalo === 1 ? 'día hábil' : 'días hábiles'}`;
      break;
    case 'semanal': {
      const dias = diasValidos(regla).map((d) => NOMBRE_DIA_CORTO[d]).join(', ');
      base = regla.intervalo > 1 ? `Cada ${regla.intervalo} semanas: ${dias}` : `Semanal: ${dias}`;
      break;
    }
    case 'quincenal':
      base = `Cada 2 semanas: ${diasValidos(regla).map((d) => NOMBRE_DIA_CORTO[d]).join(', ')}`;
      break;
    case 'mensual_dia':
      base = `Mensual, el día ${regla.diaMes ?? 1}`;
      break;
    case 'mensual_posicion':
      base = `Mensual, el ${POSICIONES[regla.posicion ?? 1] ?? 'primer'} ${
        NOMBRE_DIA_CORTO[regla.diaSemanaPos ?? 1]
      }`;
      break;
    default:
      base = 'Recurrente';
  }

  const partes = [base];

  if (regla.frecuencia !== 'dias_habiles' && regla.frecuencia !== 'cada_n_habiles') {
    if (regla.omitirFinDeSemana) {
      partes.push(
        regla.reglaReajuste === 'omitir'
          ? 'omitiendo fines de semana'
          : regla.reglaReajuste === 'anterior_habil'
            ? 'moviendo al viernes anterior'
            : 'moviendo al siguiente día hábil',
      );
    }
  }

  if (regla.respetarFestivos) partes.push('respetando festivos');

  if (regla.terminacion === 'hasta' && regla.hasta) partes.push(`hasta ${regla.hasta}`);
  else if (regla.terminacion === 'conteo' && regla.conteo) {
    partes.push(`${regla.conteo} ocurrencias`);
  }

  return partes.join(' · ');
}
