import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { obtenerActividad } from '@/lib/repos/actividades';
import { noEncontrado, respuestaError } from '@/lib/api';

/**
 * Lectura de una actividad por API. Las actividades son privadas para TODOS
 * los roles: forzar el id de otra persona responde 403, incluso siendo Admin.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requerirUsuario();

    const actividad = await obtenerActividad(user, id);
    if (!actividad) return noEncontrado('Esa actividad no existe.');

    return NextResponse.json({ actividad });
  } catch (e) {
    return respuestaError(e);
  }
}
