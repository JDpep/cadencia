import 'server-only';
import { prisma } from '@/lib/prisma';
import { ErrorPermiso, type UsuarioSesion } from '@/lib/auth/guard';
import { deClaveDia, hoyClave, inicioSemana, sumarDias } from '@/lib/tiempo';

/**
 * Panorama organizacional: carga por persona. Sólo Admin y Dirección.
 *
 * Importante: aquí NO se leen actividades individuales, sólo agregados. La
 * privacidad del detalle se mantiene incluso para Dirección.
 *
 * Se resuelve con CINCO consultas agrupadas, no con seis por cada persona.
 * La versión anterior hacía `Promise.all` de seis `count()` dentro de otro
 * `Promise.all` sobre el equipo: con tres ejecutivos eran dieciocho consultas
 * simultáneas, suficientes para agotar el pool del pooler y tumbar la pantalla
 * con un timeout. Y el número crecía con cada alta de personal.
 */
const vacio = () => ({
  abiertas: 0,
  hechas: 0,
  vencidas: 0,
  urgentes: 0,
  hechasSemana: 0,
  clientes: 0,
});

export async function panoramaOrganizacional(user: UsuarioSesion) {
  if (user.rol !== 'admin' && user.rol !== 'direccion') {
    throw new ErrorPermiso('El panorama es sólo para Administración y Dirección.');
  }

  const hoy = hoyClave();
  const inicioSem = deClaveDia(inicioSemana(hoy));
  const finSem = deClaveDia(sumarDias(inicioSemana(hoy), 7));
  const hoyInstante = deClaveDia(hoy);

  const ejecutivos = await prisma.user.findMany({
    where: { activo: true, rol: { in: ['usuario', 'admin', 'direccion'] } },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, email: true, rol: true, puesto: true },
  });

  const ids = ejecutivos.map((e) => e.id);
  if (ids.length === 0) {
    return { filas: [], totales: vacio(), semanaDe: inicioSemana(hoy) };
  }

  const vivas = { ownerUserId: { in: ids }, archivada: false };
  const agrupar = (where: Record<string, unknown>) =>
    prisma.activity.groupBy({ by: ['ownerUserId'], where, _count: { _all: true } });

  const [porEstado, vencidas, urgentes, hechasSemana, clientes] = await Promise.all([
    prisma.activity.groupBy({
      by: ['ownerUserId', 'estado'],
      where: vivas,
      _count: { _all: true },
    }),
    agrupar({ ...vivas, estado: { not: 'hecha' }, fecha: { lt: hoyInstante } }),
    agrupar({ ...vivas, estado: { not: 'hecha' }, prioridad: 'urgente' }),
    agrupar({ ...vivas, estado: 'hecha', completadaEn: { gte: inicioSem, lt: finSem } }),
    prisma.client.groupBy({
      by: ['ownerUserId'],
      where: { ownerUserId: { in: ids }, activo: true },
      _count: { _all: true },
    }),
  ]);

  /** Convierte un groupBy en un mapa userId → conteo. */
  const mapa = (filas: { ownerUserId: string; _count: { _all: number } }[]) =>
    new Map(filas.map((f) => [f.ownerUserId, f._count._all]));

  const mVencidas = mapa(vencidas);
  const mUrgentes = mapa(urgentes);
  const mSemana = mapa(hechasSemana);
  const mClientes = mapa(clientes);

  const mAbiertas = new Map<string, number>();
  const mHechas = new Map<string, number>();
  for (const f of porEstado) {
    const destino = f.estado === 'hecha' ? mHechas : mAbiertas;
    destino.set(f.ownerUserId, (destino.get(f.ownerUserId) ?? 0) + f._count._all);
  }

  const filas = ejecutivos.map((e) => {
    const abiertas = mAbiertas.get(e.id) ?? 0;
    const hechasSem = mSemana.get(e.id) ?? 0;
    const totalSemana = abiertas + hechasSem;

    return {
      ...e,
      abiertas,
      hechas: mHechas.get(e.id) ?? 0,
      vencidas: mVencidas.get(e.id) ?? 0,
      urgentes: mUrgentes.get(e.id) ?? 0,
      hechasSemana: hechasSem,
      clientes: mClientes.get(e.id) ?? 0,
      cumplimiento: totalSemana === 0 ? 0 : Math.round((hechasSem / totalSemana) * 100),
    };
  });

  const totales = filas.reduce(
    (acc, f) => ({
      abiertas: acc.abiertas + f.abiertas,
      hechas: acc.hechas + f.hechas,
      vencidas: acc.vencidas + f.vencidas,
      urgentes: acc.urgentes + f.urgentes,
      hechasSemana: acc.hechasSemana + f.hechasSemana,
      clientes: acc.clientes + f.clientes,
    }),
    vacio(),
  );

  return { filas, totales, semanaDe: inicioSemana(hoy) };
}
