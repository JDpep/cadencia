import {
  generarOcurrencias,
  ocurrenciaEfectiva,
  type ReglaRecurrencia,
} from '../src/lib/recurrence';
import { deClaveDia, esFinDeSemana } from '../src/lib/tiempo';

const festivos = new Set([
  '2026-09-16', '2026-11-16', '2026-12-25', '2026-05-01', '2026-08-17',
]);

const base = {
  intervalo: 1,
  dias: [1, 3, 5],
  omitirFinDeSemana: true,
  reglaReajuste: 'siguiente_habil' as const,
  respetarFestivos: true,
  terminacion: 'nunca' as const,
};

const casos: [string, ReglaRecurrencia, string, string, string][] = [
  ['días hábiles', { ...base, frecuencia: 'dias_habiles' }, '2026-08-12', '2026-08-12', '2026-09-01'],
  ['cada 3 hábiles', { ...base, frecuencia: 'cada_n_habiles', intervalo: 3 }, '2026-08-12', '2026-08-12', '2026-09-15'],
  ['semanal L/Mi/Vi', { ...base, frecuencia: 'semanal' }, '2026-08-10', '2026-08-10', '2026-09-10'],
  ['semanal incl. sábado (debe reajustar)', { ...base, frecuencia: 'semanal', dias: [6] }, '2026-08-08', '2026-08-08', '2026-09-15'],
  ['quincenal L/Mi', { ...base, frecuencia: 'quincenal', dias: [1, 3] }, '2026-08-10', '2026-08-10', '2026-10-01'],
  ['mensual día 15', { ...base, frecuencia: 'mensual_dia', diaMes: 15 }, '2026-08-15', '2026-08-01', '2027-02-01'],
  ['mensual último viernes', { ...base, frecuencia: 'mensual_posicion', posicion: -1, diaSemanaPos: 5 }, '2026-08-28', '2026-08-01', '2027-02-01'],
  ['mensual 1er lunes', { ...base, frecuencia: 'mensual_posicion', posicion: 1, diaSemanaPos: 1 }, '2026-09-07', '2026-09-01', '2027-03-01'],
];

let fallos = 0;

for (const [nombre, regla, inicio, desde, hasta] of casos) {
  const ocs = generarOcurrencias(inicio, regla, desde, hasta, festivos);
  const finde = ocs.filter((o) => esFinDeSemana(o.fecha));
  const enFestivo = ocs.filter((o) => festivos.has(o.fecha));
  const dup = ocs.length !== new Set(ocs.map((o) => o.fecha)).size;

  const ok = finde.length === 0 && enFestivo.length === 0 && !dup && ocs.length > 0;
  if (!ok) fallos++;

  console.log(
    `${ok ? '✓' : '✗'} ${nombre.padEnd(38)} ${String(ocs.length).padStart(3)} ocurrencias  ${ocs.slice(0, 6).map((o) => o.fecha.slice(5)).join(' ')}${ocs.length > 6 ? ' …' : ''}`,
  );
  if (finde.length) console.log('    ✗ FIN DE SEMANA:', finde.map((o) => o.fecha));
  if (enFestivo.length) console.log('    ✗ FESTIVO:', enFestivo.map((o) => o.fecha));
  if (dup) console.log('    ✗ FECHAS DUPLICADAS');
}

// Terminaciones
const conteo = generarOcurrencias('2026-08-12', { ...base, frecuencia: 'dias_habiles', terminacion: 'conteo', conteo: 5 }, '2026-08-01', '2026-12-01', festivos);
console.log(`${conteo.length === 5 ? '✓' : '✗'} terminación por conteo (5)          → ${conteo.length}: ${conteo.map(o => o.fecha.slice(5)).join(' ')}`);
if (conteo.length !== 5) fallos++;

const hasta = generarOcurrencias('2026-08-12', { ...base, frecuencia: 'dias_habiles', terminacion: 'hasta', hasta: '2026-08-20' }, '2026-08-01', '2026-12-01', festivos);
const ultimoOk = hasta.every(o => o.fecha <= '2026-08-20');
console.log(`${ultimoOk ? '✓' : '✗'} terminación hasta 2026-08-20        → ${hasta.map(o => o.fecha.slice(5)).join(' ')}`);
if (!ultimoOk) fallos++;

// Reajuste hacia atrás
const atras = generarOcurrencias('2026-08-08', { ...base, frecuencia: 'semanal', dias: [6], reglaReajuste: 'anterior_habil' }, '2026-08-01', '2026-09-15', festivos);
const atrasOk = atras.every(o => !esFinDeSemana(o.fecha)) && atras.every(o => o.fecha < o.fechaOriginal);
console.log(`${atrasOk ? '✓' : '✗'} sábado → viernes anterior           → ${atras.map(o => `${o.fechaOriginal.slice(5)}→${o.fecha.slice(5)}`).join(' ')}`);
if (!atrasOk) fallos++;

// Omitir
const omitir = generarOcurrencias('2026-08-08', { ...base, frecuencia: 'semanal', dias: [6], reglaReajuste: 'omitir' }, '2026-08-01', '2026-09-15', festivos);
console.log(`${omitir.length === 0 ? '✓' : '✗'} regla "omitir" descarta sábados     → ${omitir.length} ocurrencias`);
if (omitir.length !== 0) fallos++;

// ---------------------------------------------------------------------------
// Excepciones: qué día y qué hora acaba enseñando una ocurrencia
//
// El día y la hora siguen reglas distintas: el día sólo cambia si el usuario la
// MOVIÓ (si no, una ocurrencia reajustada volvería a su sábado); la hora se
// respeta siempre que la ocurrencia tenga una propia.
// ---------------------------------------------------------------------------

const oc = { fecha: '2026-08-17' as const }; // lunes: reajustada desde el sábado 15

function caso(
  nombre: string,
  exc: { fecha: Date | null; movida: boolean } | undefined,
  allDay: boolean,
  esperado: { clave: string; hora: string | null },
) {
  const r = ocurrenciaEfectiva(oc, exc, '17:00', allDay);
  const ok = r.clave === esperado.clave && r.hora === esperado.hora;
  if (!ok) fallos++;
  console.log(
    `${ok ? '✓' : '✗'} ${nombre.padEnd(46)} → ${r.clave} ${r.hora ?? '(sin hora)'}${
      ok ? '' : `   ESPERABA ${esperado.clave} ${esperado.hora ?? '(sin hora)'}`
    }`,
  );
}

console.log('');
caso('sin excepción → día y hora de la serie', undefined, false, {
  clave: '2026-08-17',
  hora: '17:00',
});

caso(
  'cambiar SÓLO la hora → mismo día, hora nueva',
  { fecha: deClaveDia('2026-08-15', '19:45'), movida: false },
  false,
  // Conserva el lunes reajustado, pero toma la hora que le puso el usuario.
  { clave: '2026-08-17', hora: '19:45' },
);

caso(
  'movida a otro día → día y hora de la excepción',
  { fecha: deClaveDia('2026-08-19', '08:30'), movida: true },
  false,
  { clave: '2026-08-19', hora: '08:30' },
);

caso(
  'serie de día completo → nunca inventa hora',
  { fecha: deClaveDia('2026-08-19', '00:00'), movida: true },
  true,
  { clave: '2026-08-19', hora: null },
);

console.log(fallos === 0 ? '\n✓ TODO EN ORDEN — ninguna ocurrencia cae en fin de semana.' : `\n✗ ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
