/**
 * Verifica la agenda expandida contra los datos sembrados, a través del
 * servidor real (GET /api/agenda). La regla de oro: ninguna ocurrencia puede
 * caer en sábado, domingo ni festivo.
 *
 * Requiere el servidor levantado (`npm run dev`):
 *   npm run test:agenda
 */
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { esFinDeSemana, hoyClave, sumarDias } from '../src/lib/tiempo';

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || 'http://localhost:3000';

type Item = {
  llave: string;
  titulo: string;
  clave: string;
  fechaOriginal: string | null;
  esSerie: boolean;
  reajustada: boolean;
};

function cookieDe(userId: string): string {
  const secreto = process.env.SESSION_SECRET || 'cadencia-local-dev-secret';
  const payload = `${userId}.${Date.now().toString(36)}`;
  const firma = createHmac('sha256', secreto).update(payload).digest('base64url');
  return `cadencia_sesion=${payload}.${firma}`;
}

function diaSemanaUTC(clave: string) {
  return new Date(`${clave}T12:00:00Z`).getUTCDay();
}

async function main() {
  const ana = await prisma.user.findUniqueOrThrow({ where: { email: 'ana@cadencia.mx' } });
  const festivos = new Set(
    (await prisma.holiday.findMany({ where: { activo: true } })).map((f) => f.fecha),
  );

  const desde = hoyClave();
  const hasta = sumarDias(desde, 90);

  const r = await fetch(`${BASE}/api/agenda?desde=${desde}&hasta=${hasta}`, {
    headers: { Cookie: cookieDe(ana.id) },
  });

  if (!r.ok) {
    console.error(`✗ ${BASE}/api/agenda respondió ${r.status}. ¿Está corriendo "npm run dev"?`);
    process.exit(1);
  }

  const { items } = (await r.json()) as { items: Item[] };

  const series = items.filter((i) => i.esSerie);
  const enFinDeSemana = items.filter((i) => esFinDeSemana(i.clave));
  const enFestivo = series.filter((i) => festivos.has(i.clave));
  const reajustadas = series.filter((i) => i.reajustada);

  let fallos = 0;
  const check = (ok: boolean, texto: string) => {
    console.log(`${ok ? '✓' : '✗'} ${texto}`);
    if (!ok) fallos++;
  };

  console.log(
    `Ventana ${desde} → ${hasta} · ${items.length} items (${series.length} de series)\n`,
  );

  check(items.length > 0, 'la agenda de Ana trae actividades');
  check(series.length > 0, 'las series recurrentes se expanden');
  check(enFinDeSemana.length === 0, 'NINGUNA actividad cae en sábado o domingo');
  check(enFestivo.length === 0, 'ninguna ocurrencia de serie cae en día festivo');

  if (enFinDeSemana.length) {
    console.log('   ', enFinDeSemana.map((i) => `${i.clave} ${i.titulo}`).join('\n    '));
  }
  if (enFestivo.length) {
    console.log('   ', enFestivo.map((i) => `${i.clave} ${i.titulo}`).join('\n    '));
  }

  for (const titulo of [
    'Revisar bandeja y priorizar el día',
    'Seguimiento a cuentas activas',
    'Enviar reporte mensual a Grupo Aurora',
  ]) {
    const n = series.filter((i) => i.titulo === titulo).length;
    check(n > 0, `serie «${titulo}» → ${n} ocurrencias`);
  }

  // La semanal cae en L/Mi/V, salvo las ocurrencias que un festivo empujó
  // a otro día hábil — que es exactamente lo que debe hacer.
  const lmv = series.filter((i) => i.titulo === 'Seguimiento a cuentas activas');
  check(
    lmv.every((i) => [1, 3, 5].includes(diaSemanaUTC(i.fechaOriginal ?? i.clave))),
    'la semanal se programa siempre en lunes, miércoles o viernes',
  );
  check(
    lmv.every((i) => [1, 3, 5].includes(diaSemanaUTC(i.clave)) || i.reajustada),
    'sólo se sale de L/Mi/V cuando un festivo la recorre a otro día hábil',
  );

  const diarias = series.filter((i) => i.titulo === 'Revisar bandeja y priorizar el día');
  check(
    diarias.every((i) => diaSemanaUTC(i.clave) >= 1 && diaSemanaUTC(i.clave) <= 5),
    'la de días hábiles cae sólo de lunes a viernes',
  );

  if (reajustadas.length) {
    console.log(
      `\n  ↷ ${reajustadas.length} ocurrencias movidas a día hábil: ` +
        reajustadas
          .slice(0, 6)
          .map((i) => `${i.fechaOriginal}→${i.clave}`)
          .join(', '),
    );
  }

  console.log(fallos === 0 ? '\n✓ AGENDA EN ORDEN' : `\n✗ ${fallos} fallos`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().finally(() => prisma.$disconnect());
