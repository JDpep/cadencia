import 'server-only';
import { prisma } from '@/lib/prisma';
import { ErrorPermiso, type UsuarioSesion } from '@/lib/auth/guard';
import { deClaveDia, hoyClave, inicioSemana, sumarDias } from '@/lib/tiempo';

/**
 * Panorama organizacional: carga por persona. Sólo Admin y Dirección.
 *
 * Importante: aquí NO se leen actividades individuales, sólo agregados. La
 * privacidad del detalle se mantiene incluso para Dirección.
 */
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

  const filas = await Promise.all(
    ejecutivos.map(async (e) => {
      const base = { ownerUserId: e.id, archivada: false };

      const [abiertas, hechas, vencidas, urgentes, hechasSemana, clientes] =
        await Promise.all([
          prisma.activity.count({ where: { ...base, estado: { not: 'hecha' } } }),
          prisma.activity.count({ where: { ...base, estado: 'hecha' } }),
          prisma.activity.count({
            where: { ...base, estado: { not: 'hecha' }, fecha: { lt: hoyInstante } },
          }),
          prisma.activity.count({
            where: { ...base, estado: { not: 'hecha' }, prioridad: 'urgente' },
          }),
          prisma.activity.count({
            where: { ...base, estado: 'hecha', completadaEn: { gte: inicioSem, lt: finSem } },
          }),
          prisma.client.count({ where: { ownerUserId: e.id, activo: true } }),
        ]);

      const totalSemana = abiertas + hechasSemana;

      return {
        ...e,
        abiertas,
        hechas,
        vencidas,
        urgentes,
        hechasSemana,
        clientes,
        cumplimiento: totalSemana === 0 ? 0 : Math.round((hechasSemana / totalSemana) * 100),
      };
    }),
  );

  const totales = filas.reduce(
    (acc, f) => ({
      abiertas: acc.abiertas + f.abiertas,
      hechas: acc.hechas + f.hechas,
      vencidas: acc.vencidas + f.vencidas,
      urgentes: acc.urgentes + f.urgentes,
      hechasSemana: acc.hechasSemana + f.hechasSemana,
      clientes: acc.clientes + f.clientes,
    }),
    { abiertas: 0, hechas: 0, vencidas: 0, urgentes: 0, hechasSemana: 0, clientes: 0 },
  );

  return { filas, totales, semanaDe: inicioSemana(hoy) };
}
