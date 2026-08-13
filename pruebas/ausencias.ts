import {
  contarDiasHabiles,
  contieneDia,
  diasHabilesDe,
  saldoDe,
  seTraslapan,
  validarSolicitud,
} from '../src/lib/ausencias';
import { esFinDeSemana } from '../src/lib/tiempo';

/**
 * Prueba del cálculo de ausencias. No toca la base ni necesita servidor.
 *
 * Lo que se afirma:
 *  · «días hábiles» significa lo mismo aquí que en la recurrencia: ni fin de
 *    semana ni festivos;
 *  · el saldo disponible se deriva y no se puede desincronizar;
 *  · las reglas por tipo (motivo obligatorio, descuento de saldo) se aplican;
 *  · el traslape entre ausencias se detecta en los bordes.
 */

// Semana del 10 al 16 de agosto de 2026: lunes a domingo.
// 17 de agosto marcado festivo a propósito, para verlo salir del conteo.
const festivos = new Set(['2026-08-17', '2026-09-16', '2026-11-16']);

let fallos = 0;

function afirmar(nombre: string, ok: boolean, detalle: string) {
  if (!ok) fallos++;
  console.log(`${ok ? '✓' : '✗'} ${nombre.padEnd(46)} ${detalle}`);
}

// ---------------------------------------------------------------------------
// Días hábiles
// ---------------------------------------------------------------------------

{
  // Lunes 10 → viernes 14: cinco hábiles corridos.
  const d = diasHabilesDe({ inicio: '2026-08-10', fin: '2026-08-14' }, festivos);
  afirmar('semana completa L–V → 5 días', d.length === 5, d.map((x) => x.slice(5)).join(' '));
}

{
  // Lunes 10 → domingo 16: el fin de semana no cuenta.
  const d = diasHabilesDe({ inicio: '2026-08-10', fin: '2026-08-16' }, festivos);
  afirmar(
    'incluye sábado y domingo → siguen siendo 5',
    d.length === 5 && d.every((x) => !esFinDeSemana(x)),
    d.map((x) => x.slice(5)).join(' '),
  );
}

{
  // El lunes 17 es festivo: dos semanas dan 9, no 10.
  const d = diasHabilesDe({ inicio: '2026-08-10', fin: '2026-08-21' }, festivos);
  afirmar(
    'festivo dentro del rango → no cuenta',
    d.length === 9 && !d.includes('2026-08-17'),
    `${d.length} días, 17-ago ausente`,
  );
}

{
  // Sábado y domingo solos: cero.
  const d = contarDiasHabiles({ inicio: '2026-08-15', fin: '2026-08-16' }, festivos);
  afirmar('sólo fin de semana → 0 días', d === 0, `${d} días`);
}

{
  const d = contarDiasHabiles({ inicio: '2026-08-12', fin: '2026-08-12' }, festivos);
  afirmar('un solo día hábil → 1', d === 1, `${d} día`);
}

{
  const d = contarDiasHabiles({ inicio: '2026-08-14', fin: '2026-08-10' }, festivos);
  afirmar('rango invertido → 0', d === 0, `${d} días`);
}

// ---------------------------------------------------------------------------
// Saldo
// ---------------------------------------------------------------------------

{
  const s = saldoDe({ anio: 2026, diasAsignados: 12, diasTomados: 3, diasPendientes: 2 });
  afirmar(
    'disponibles = asignados − tomados − pendientes',
    s.disponibles === 7,
    `12 − 3 − 2 = ${s.disponibles}`,
  );
}

// ---------------------------------------------------------------------------
// Validación de la solicitud
// ---------------------------------------------------------------------------

const base = {
  tipo: 'vacaciones' as const,
  rango: { inicio: '2026-08-10', fin: '2026-08-14' },
  motivo: null,
  diasHabiles: 5,
  disponibles: 10,
};

afirmar('solicitud válida → sin problema', validarSolicitud(base) === null, 'ok');

afirmar(
  'rango invertido → rango_invalido',
  validarSolicitud({ ...base, rango: { inicio: '2026-08-14', fin: '2026-08-10' } }) ===
    'rango_invalido',
  'rango_invalido',
);

afirmar(
  'rango sin hábiles → sin_dias_habiles',
  validarSolicitud({ ...base, rango: { inicio: '2026-08-15', fin: '2026-08-16' }, diasHabiles: 0 }) ===
    'sin_dias_habiles',
  'sin_dias_habiles',
);

afirmar(
  'pedir más de lo disponible → saldo_insuficiente',
  validarSolicitud({ ...base, diasHabiles: 11 }) === 'saldo_insuficiente',
  'saldo_insuficiente',
);

afirmar(
  'incapacidad sin motivo → motivo_requerido',
  validarSolicitud({ ...base, tipo: 'incapacidad' }) === 'motivo_requerido',
  'motivo_requerido',
);

afirmar(
  'incapacidad no compite por el saldo de vacaciones',
  validarSolicitud({ ...base, tipo: 'incapacidad', motivo: 'Certificado médico', diasHabiles: 30, disponibles: 2 }) === null,
  'pasa con saldo 2 y 30 días',
);

afirmar(
  'día económico sí descuenta saldo',
  validarSolicitud({ ...base, tipo: 'economico', diasHabiles: 11 }) === 'saldo_insuficiente',
  'saldo_insuficiente',
);

// ---------------------------------------------------------------------------
// Traslapes
// ---------------------------------------------------------------------------

const r = (inicio: string, fin: string) => ({ inicio, fin });

afirmar(
  'traslape parcial se detecta',
  seTraslapan(r('2026-08-10', '2026-08-14'), r('2026-08-13', '2026-08-18')),
  'sí',
);

afirmar(
  'traslape de un solo día (borde) se detecta',
  seTraslapan(r('2026-08-10', '2026-08-14'), r('2026-08-14', '2026-08-20')),
  'sí',
);

afirmar(
  'rangos consecutivos NO se traslapan',
  !seTraslapan(r('2026-08-10', '2026-08-14'), r('2026-08-15', '2026-08-20')),
  'no',
);

afirmar(
  'contenido completo se detecta',
  seTraslapan(r('2026-08-10', '2026-08-28'), r('2026-08-13', '2026-08-14')),
  'sí',
);

afirmar(
  'contieneDia respeta ambos bordes',
  contieneDia(r('2026-08-10', '2026-08-14'), '2026-08-10') &&
    contieneDia(r('2026-08-10', '2026-08-14'), '2026-08-14') &&
    !contieneDia(r('2026-08-10', '2026-08-14'), '2026-08-15'),
  '10 sí · 14 sí · 15 no',
);

console.log(
  fallos === 0
    ? '\n✓ TODO EN ORDEN — los días hábiles excluyen fin de semana y festivos.'
    : `\n✗ ${fallos} fallos`,
);
process.exit(fallos === 0 ? 0 : 1);
