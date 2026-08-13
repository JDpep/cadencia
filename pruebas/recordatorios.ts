import {
  planDe,
  programadosDe,
  GRACIA_HORAS,
  HORIZONTE_DIAS,
  type ActividadParaRecordar,
} from '../src/lib/recordatorios';
import { serializarRegla, type ReglaRecurrencia } from '../src/lib/recurrence';
import { deClaveDia, esFinDeSemana, fmt, type ClaveDia } from '../src/lib/tiempo';

/**
 * Prueba del cálculo de recordatorios. No toca la base ni necesita servidor:
 * `programadosDe()` es puro, así que se le puede fijar el "ahora".
 *
 * Lo que se afirma:
 *  · un aviso suena a la hora de la actividad menos su antelación;
 *  · una serie avisa en CADA ocurrencia, y nunca en fin de semana ni festivo;
 *  · saltar, completar o mover una ocurrencia se refleja en su aviso;
 *  · nada se materializa fuera de la ventana [ahora − gracia, ahora + horizonte].
 */

const festivos = new Set(['2026-09-16', '2026-11-16', '2026-08-17']);

// Miércoles 12 de agosto de 2026, 07:00 en México — el "ahora" de toda la prueba.
const AHORA = deClaveDia('2026-08-12', '07:00');

const reglaBase = {
  intervalo: 1,
  dias: [1, 3, 5],
  omitirFinDeSemana: true,
  reglaReajuste: 'siguiente_habil' as const,
  respetarFestivos: true,
  terminacion: 'nunca' as const,
};

function actividad(over: Partial<ActividadParaRecordar> = {}): ActividadParaRecordar {
  return {
    titulo: 'Actividad de prueba',
    fecha: deClaveDia('2026-08-12', '10:00'),
    allDay: false,
    estado: 'por_hacer',
    archivada: false,
    recordatorioMinutos: 15,
    recurrenceRule: null,
    cliente: null,
    excepciones: [],
    ...over,
  };
}

function conRegla(regla: Partial<ReglaRecurrencia> & { frecuencia: ReglaRecurrencia['frecuencia'] }) {
  return serializarRegla({ ...reglaBase, ...regla } as ReglaRecurrencia);
}

let fallos = 0;

function afirmar(nombre: string, ok: boolean, detalle: string) {
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${nombre.padEnd(44)} ${detalle}`);
}

const hm = (d: Date) => fmt(d, 'yyyy-MM-dd HH:mm');

// ---------------------------------------------------------------------------
// Actividad suelta
// ---------------------------------------------------------------------------

{
  const p = programadosDe(actividad(), festivos, AHORA);
  afirmar(
    '15 min antes de las 10:00',
    p.length === 1 && hm(p[0].programadaPara) === '2026-08-12 09:45',
    p.map((x) => hm(x.programadaPara)).join(' ') || '(ninguno)',
  );
}

{
  const p = programadosDe(actividad({ recordatorioMinutos: 0 }), festivos, AHORA);
  afirmar(
    'a la hora exacta',
    p.length === 1 && hm(p[0].programadaPara) === '2026-08-12 10:00',
    p.map((x) => hm(x.programadaPara)).join(' ') || '(ninguno)',
  );
}

{
  // Sin hora la actividad se guarda a las 00:00: el aviso se cuenta desde las 08:00.
  const p = programadosDe(
    actividad({ fecha: deClaveDia('2026-08-13', '00:00'), allDay: true, recordatorioMinutos: 30 }),
    festivos,
    AHORA,
  );
  afirmar(
    'día completo → 30 min antes de las 08:00',
    p.length === 1 && hm(p[0].programadaPara) === '2026-08-13 07:30',
    p.map((x) => hm(x.programadaPara)).join(' ') || '(ninguno)',
  );
}

{
  const p = programadosDe(actividad({ recordatorioMinutos: null }), festivos, AHORA);
  afirmar('sin recordatorio → no avisa', p.length === 0, `${p.length} avisos`);
}

{
  const p = programadosDe(actividad({ estado: 'hecha' }), festivos, AHORA);
  afirmar('actividad hecha → no avisa', p.length === 0, `${p.length} avisos`);
}

{
  const p = programadosDe(actividad({ archivada: true }), festivos, AHORA);
  afirmar('actividad archivada → no avisa', p.length === 0, `${p.length} avisos`);
}

{
  const p = programadosDe(actividad({ fecha: null }), festivos, AHORA);
  afirmar('sin fecha → no avisa', p.length === 0, `${p.length} avisos`);
}

// ---------------------------------------------------------------------------
// Ventana: ni lo muy viejo ni lo muy lejano se materializa
// ---------------------------------------------------------------------------

{
  // Tres días atrás: fuera de la gracia de 24 h.
  const p = programadosDe(
    actividad({ fecha: deClaveDia('2026-08-09', '10:00') }),
    festivos,
    AHORA,
  );
  afirmar(
    `vencida hace 3 días → fuera de la gracia (${GRACIA_HORAS} h)`,
    p.length === 0,
    `${p.length} avisos`,
  );
}

{
  // Ayer a las 10:00 → el aviso sonó hace ~21 h: sigue dentro de la gracia.
  const p = programadosDe(
    actividad({ fecha: deClaveDia('2026-08-11', '10:00') }),
    festivos,
    AHORA,
  );
  afirmar(
    'vencida ayer → se conserva dentro de la gracia',
    p.length === 1,
    p.map((x) => hm(x.programadaPara)).join(' ') || '(ninguno)',
  );
}

{
  const p = programadosDe(
    actividad({ fecha: deClaveDia('2026-11-12', '10:00') }),
    festivos,
    AHORA,
  );
  afirmar(
    `a 3 meses → fuera del horizonte (${HORIZONTE_DIAS} días)`,
    p.length === 0,
    `${p.length} avisos`,
  );
}

// ---------------------------------------------------------------------------
// Series recurrentes
// ---------------------------------------------------------------------------

const serieHabiles = actividad({
  titulo: 'Revisar bandeja',
  recurrenceRule: conRegla({ frecuencia: 'dias_habiles' }),
  recordatorioMinutos: 15,
});

{
  const p = programadosDe(serieHabiles, festivos, AHORA);
  const enFinde = p.filter((x) => esFinDeSemana(x.claveObjetivo));
  const enFestivo = p.filter((x) => festivos.has(x.claveObjetivo));
  const horas = new Set(p.map((x) => fmt(x.programadaPara, 'HH:mm')));

  afirmar(
    'serie días hábiles → un aviso por ocurrencia',
    p.length > 15 && enFinde.length === 0 && enFestivo.length === 0 && horas.size === 1,
    `${p.length} avisos, todos a las ${[...horas].join('/')}`,
  );
  if (enFinde.length) console.log('    ✗ FIN DE SEMANA:', enFinde.map((x) => x.claveObjetivo));
  if (enFestivo.length) console.log('    ✗ FESTIVO:', enFestivo.map((x) => x.claveObjetivo));
}

{
  // El 17 de agosto es festivo en este catálogo: esa ocurrencia se recorre y su
  // aviso tiene que irse con ella, no quedarse en el día festivo.
  const p = programadosDe(serieHabiles, festivos, AHORA);
  const claves = p.map((x) => x.claveObjetivo);
  afirmar(
    'ocurrencia en festivo → el aviso se mueve con ella',
    !claves.includes('2026-08-17') && claves.includes('2026-08-18'),
    `17-ago ausente, 18-ago presente`,
  );
}

{
  const saltada = programadosDe(
    { ...serieHabiles, excepciones: [ex('2026-08-13', { saltada: true })] },
    festivos,
    AHORA,
  );
  const completa = programadosDe(serieHabiles, festivos, AHORA);
  afirmar(
    'ocurrencia saltada → no avisa',
    saltada.length === completa.length - 1 &&
      !saltada.some((x) => x.fechaOriginal === '2026-08-13'),
    `${completa.length} → ${saltada.length} avisos`,
  );
}

{
  const hecha = programadosDe(
    { ...serieHabiles, excepciones: [ex('2026-08-13', { estado: 'hecha' })] },
    festivos,
    AHORA,
  );
  afirmar(
    'ocurrencia ya hecha → no avisa',
    !hecha.some((x) => x.fechaOriginal === '2026-08-13'),
    '13-ago ausente',
  );
}

{
  // Movida del jueves 13 al viernes 14 a las 16:00 → el aviso la sigue.
  const movida = programadosDe(
    {
      ...serieHabiles,
      excepciones: [
        ex('2026-08-13', { movida: true, fecha: deClaveDia('2026-08-14', '16:00') }),
      ],
    },
    festivos,
    AHORA,
  );
  const x = movida.find((o) => o.fechaOriginal === '2026-08-13');
  afirmar(
    'ocurrencia movida → el aviso la sigue',
    Boolean(x) && x!.claveObjetivo === '2026-08-14' && hm(x!.programadaPara) === '2026-08-14 15:45',
    x ? `${x.fechaOriginal} → ${hm(x.programadaPara)}` : '(no encontrada)',
  );
}

{
  // Cada ocurrencia es un recordatorio distinto: sus llaves no se repiten.
  const p = programadosDe(serieHabiles, festivos, AHORA);
  const llaves = new Set(p.map((x) => x.fechaOriginal));
  afirmar(
    'las llaves de ocurrencia son únicas',
    llaves.size === p.length,
    `${llaves.size} llaves / ${p.length} avisos`,
  );
}

{
  // Semanal en sábado: la ocurrencia se reajusta al lunes y el aviso también.
  const sabatina = actividad({
    recurrenceRule: conRegla({ frecuencia: 'semanal', dias: [6] }),
    fecha: deClaveDia('2026-08-15', '09:00'),
    recordatorioMinutos: 60,
  });
  const p = programadosDe(sabatina, festivos, AHORA);
  const enFinde = p.filter((x) => esFinDeSemana(x.claveObjetivo));
  afirmar(
    'serie en sábado → ningún aviso cae en fin de semana',
    p.length > 0 && enFinde.length === 0,
    p.map((x) => x.claveObjetivo.slice(5)).join(' ') || '(ninguno)',
  );
}

{
  // Serie terminada antes de la ventana: no debe quedar ningún aviso vivo.
  const terminada = actividad({
    recurrenceRule: conRegla({
      frecuencia: 'dias_habiles',
      terminacion: 'hasta',
      hasta: '2026-08-10',
    }),
    fecha: deClaveDia('2026-08-03', '10:00'),
  });
  const p = programadosDe(terminada, festivos, AHORA);
  afirmar('serie ya terminada → no avisa', p.length === 0, `${p.length} avisos`);
}

// ---------------------------------------------------------------------------
// Retiro activo: un aviso que YA sonó y perdió su razón de ser hay que quitarlo
// de la campana, no sólo dejar de programarlo.
// ---------------------------------------------------------------------------

{
  const plan = planDe(actividad({ estado: 'hecha' }), festivos, AHORA);
  afirmar(
    'hecha → retira sus avisos ya sonados',
    plan.cancelarTodo && plan.programados.length === 0,
    `cancelarTodo=${plan.cancelarTodo}`,
  );
}

{
  const plan = planDe(actividad({ recordatorioMinutos: null }), festivos, AHORA);
  afirmar('quitar el recordatorio → retira los avisos', plan.cancelarTodo, 'cancelarTodo=true');
}

{
  const plan = planDe(actividad({ archivada: true }), festivos, AHORA);
  afirmar('archivar → retira los avisos', plan.cancelarTodo, 'cancelarTodo=true');
}

{
  const plan = planDe(actividad({ fecha: null }), festivos, AHORA);
  afirmar('quitar la fecha → retira los avisos', plan.cancelarTodo, 'cancelarTodo=true');
}

{
  // Una serie NO se cancela entera porque una ocurrencia esté hecha.
  const plan = planDe(
    {
      ...serieHabiles,
      excepciones: [ex('2026-08-13', { estado: 'hecha' }), ex('2026-08-14', { saltada: true })],
    },
    festivos,
    AHORA,
  );
  afirmar(
    'serie: sólo se retiran las ocurrencias hechas o saltadas',
    !plan.cancelarTodo &&
      plan.cancelados.length === 2 &&
      plan.programados.length > 15,
    `cancelados=[${plan.cancelados.join(' ')}] · ${plan.programados.length} vigentes`,
  );
}

{
  // Lo que sólo se salió de la ventana NO se cancela: es historia del usuario.
  const plan = planDe(
    actividad({ fecha: deClaveDia('2026-08-09', '10:00') }),
    festivos,
    AHORA,
  );
  afirmar(
    'fuera de ventana → no se cancela, sólo no se reprograma',
    !plan.cancelarTodo && plan.cancelados.length === 0 && plan.programados.length === 0,
    'sin cancelaciones',
  );
}

// ---------------------------------------------------------------------------

function ex(
  fechaOriginal: ClaveDia,
  over: Partial<ActividadParaRecordar['excepciones'][number]> = {},
): ActividadParaRecordar['excepciones'][number] {
  return {
    fechaOriginal,
    fecha: null,
    estado: 'por_hacer',
    movida: false,
    saltada: false,
    titulo: null,
    ...over,
  };
}

console.log(
  fallos === 0
    ? '\n✓ TODO EN ORDEN — cada aviso sale a su hora y ninguno cae en fin de semana.'
    : `\n✗ ${fallos} fallos`,
);
process.exit(fallos === 0 ? 0 : 1);
