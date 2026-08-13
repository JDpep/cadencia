import { HORA_RECORDATORIO_DIA_COMPLETO } from './dominio';
import { generarOcurrencias, ocurrenciaEfectiva, parsearRegla } from './recurrence';
import { claveDia, deClaveDia, fmtClave, horaDe, sumarDias, type ClaveDia } from './tiempo';

/**
 * Cálculo de recordatorios — la parte pura, sin base de datos.
 *
 * Igual que el motor de recurrencia, vive aparte del repositorio para poder
 * probarse sola (`npm run test:recordatorios`). El repositorio
 * (`src/lib/repos/recordatorios.ts`) es quien la persiste en `Notification`.
 *
 * Dos reglas que sostienen lo demás:
 *  1. Un recordatorio se ancla a una OCURRENCIA, no a la serie: una actividad
 *     recurrente avisa cada vez, y las saltadas o ya hechas no avisan.
 *  2. Se cuenta desde la hora efectiva de esa ocurrencia —la reajustada a día
 *     hábil, o la movida a mano—, nunca desde el día teórico.
 */

/** Cuánto se adelanta la materialización. Se rueda hacia adelante al consultar. */
export const HORIZONTE_DIAS = 30;

/** Los ya vencidos se conservan y regeneran dentro de esta ventana hacia atrás. */
export const GRACIA_HORAS = 24;

/** Holgura de expansión: atrapa ocurrencias movidas hacia el horizonte. */
const HOLGURA = 10;

/** Lo mínimo que hay que saber de una actividad para calcular sus avisos. */
export type ActividadParaRecordar = {
  titulo: string;
  fecha: Date | null;
  allDay: boolean;
  estado: string;
  archivada: boolean;
  recordatorioMinutos: number | null;
  recurrenceRule: string | null;
  cliente: string | null;
  excepciones: {
    fechaOriginal: string;
    fecha: Date | null;
    estado: string;
    movida: boolean;
    saltada: boolean;
    titulo: string | null;
  }[];
};

export type Programado = {
  /** Identidad estable del recordatorio: el día teórico de la ocurrencia. */
  fechaOriginal: ClaveDia;
  /** Día en que la actividad cae de verdad — a donde apunta el aviso. */
  claveObjetivo: ClaveDia;
  programadaPara: Date;
  titulo: string;
  cuerpo: string;
};

/**
 * «mié 12 de ago · 14:30 · Grupo Ferra».
 *
 * Absoluto a propósito: el recordatorio puede crearse hoy y dispararse dentro
 * de tres semanas, así que un «mañana» guardado nacería caducado.
 */
export function cuerpoDe(
  clave: ClaveDia,
  hora: string | null,
  cliente: string | null,
): string {
  const partes = [fmtClave(clave, "EEE d 'de' MMM"), hora ?? 'todo el día'];
  if (cliente) partes.push(cliente);
  return partes.join(' · ');
}

/**
 * Instante en que debe sonar: la hora de la actividad menos la antelación.
 *
 * Una actividad de día completo se guarda a las 00:00, así que avisar «a la
 * hora» sería avisar a medianoche: para ellas se cuenta desde la mañana.
 */
export function instante(clave: ClaveDia, hora: string | null, minutos: number): Date {
  const base = deClaveDia(clave, hora ?? HORA_RECORDATORIO_DIA_COMPLETO);
  return new Date(base.getTime() - minutos * 60_000);
}

/**
 * Lo que el repositorio tiene que dejar escrito para una actividad.
 *
 * `cancelarTodo` y `cancelados` existen porque no basta con dejar de programar:
 * un aviso que YA sonó sigue en la campana esperando respuesta, y la
 * resincronización lo respeta a propósito (es lo que hace que «posponer»
 * aguante). Cuando la razón de ser del aviso desaparece —la actividad se dio
 * por hecha, se saltó la ocurrencia, se le quitó el recordatorio— hay que
 * retirarlo activamente. Lo que simplemente se salió de la ventana NO se
 * cancela: eso es historia del usuario, no basura.
 */
export type PlanRecordatorios = {
  programados: Programado[];
  /** La actividad entera dejó de merecer avisos. */
  cancelarTodo: boolean;
  /** Ocurrencias concretas cuyo aviso hay que retirar. */
  cancelados: ClaveDia[];
};

/**
 * Los recordatorios que le corresponden a una actividad dentro del horizonte.
 * Para una serie hay uno por ocurrencia viva.
 */
export function planDe(
  actividad: ActividadParaRecordar,
  festivos: Set<string>,
  ahora: Date,
): PlanRecordatorios {
  const cancelados = actividad.excepciones
    .filter((e) => e.saltada || e.estado === 'hecha')
    .map((e) => e.fechaOriginal);

  const sinRazon =
    actividad.recordatorioMinutos === null ||
    actividad.archivada ||
    !actividad.fecha ||
    (!actividad.recurrenceRule && actividad.estado === 'hecha');

  if (sinRazon) return { programados: [], cancelarTodo: true, cancelados: [] };

  return {
    programados: programadosDe(actividad, festivos, ahora),
    cancelarTodo: false,
    cancelados,
  };
}

/**
 * Los avisos que hay que dejar programados. Para una serie hay uno por
 * ocurrencia viva: las saltadas y las ya hechas no avisan.
 */
export function programadosDe(
  actividad: ActividadParaRecordar,
  festivos: Set<string>,
  ahora: Date,
): Programado[] {
  const minutos = actividad.recordatorioMinutos;
  if (minutos === null || actividad.archivada || !actividad.fecha) return [];

  const cliente = actividad.cliente;
  const claveBase = claveDia(actividad.fecha);
  const horaBase = horaDe(actividad.fecha, actividad.allDay);
  const regla = parsearRegla(actividad.recurrenceRule);

  const desde = ahora.getTime() - GRACIA_HORAS * 3_600_000;
  const hasta = ahora.getTime() + HORIZONTE_DIAS * 86_400_000;
  const enVentana = (p: Programado) =>
    p.programadaPara.getTime() >= desde && p.programadaPara.getTime() <= hasta;

  // --- Actividad suelta ---
  if (!regla) {
    if (actividad.estado === 'hecha') return [];
    return [
      {
        fechaOriginal: claveBase,
        claveObjetivo: claveBase,
        programadaPara: instante(claveBase, horaBase, minutos),
        titulo: actividad.titulo,
        cuerpo: cuerpoDe(claveBase, horaBase, cliente),
      },
    ].filter(enVentana);
  }

  // --- Serie recurrente ---
  const hoy = claveDia(ahora);
  const excepciones = new Map(actividad.excepciones.map((o) => [o.fechaOriginal, o]));

  const ocurrencias = generarOcurrencias(
    claveBase,
    regla,
    sumarDias(hoy, -HOLGURA),
    sumarDias(hoy, HORIZONTE_DIAS + HOLGURA),
    festivos,
  );

  const salida: Programado[] = [];

  for (const oc of ocurrencias) {
    const exc = excepciones.get(oc.fechaOriginal);
    if (exc?.saltada) continue;
    if (exc?.estado === 'hecha') continue;

    const { clave, hora } = ocurrenciaEfectiva(oc, exc, horaBase, actividad.allDay);

    salida.push({
      fechaOriginal: oc.fechaOriginal,
      claveObjetivo: clave,
      programadaPara: instante(clave, hora, minutos),
      titulo: exc?.titulo ?? actividad.titulo,
      cuerpo: cuerpoDe(clave, hora, cliente),
    });
  }

  return salida.filter(enVentana);
}
