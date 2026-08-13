import 'server-only';
import { prisma } from '@/lib/prisma';
import type { UsuarioSesion } from '@/lib/auth/guard';
import { esAdmin } from '@/lib/auth/guard';

/** Bitácora de auditoría. Nunca falla la operación principal por un log. */
export async function registrar(
  actorId: string,
  entidad: string,
  entidadId: string,
  accion: string,
  antes?: unknown,
  despues?: unknown,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        entidad,
        entidadId,
        accion,
        antes: antes === undefined ? null : JSON.stringify(antes),
        despues: despues === undefined ? null : JSON.stringify(despues),
      },
    });
  } catch (e) {
    console.error('[bitacora] no se pudo registrar', e);
  }
}

/**
 * Admin y Dirección ven toda la bitácora; el ejecutivo sólo la propia.
 * (Dirección en modo lectura, según la matriz de permisos.)
 */
export async function listarBitacora(user: UsuarioSesion, limite = 200) {
  const where = user.rol === 'usuario' ? { actorId: user.id } : {};

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limite,
    include: { actor: { select: { nombre: true, email: true, rol: true } } },
  });
}

export function puedeVerTodaLaBitacora(user: UsuarioSesion) {
  return esAdmin(user) || user.rol === 'direccion';
}
