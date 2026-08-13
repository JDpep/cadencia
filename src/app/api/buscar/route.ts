import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { listarActividades } from '@/lib/repos/actividades';
import { listarClientes } from '@/lib/repos/clientes';
import { respuestaError } from '@/lib/api';

/** Buscador global (⌘K). Sólo devuelve lo que el usuario tiene permitido ver. */
export async function GET(req: Request) {
  try {
    const user = await requerirUsuario();
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';

    if (q.length < 2) return NextResponse.json({ actividades: [], clientes: [] });

    const [actividades, clientes] = await Promise.all([
      listarActividades(user, { busqueda: q }),
      listarClientes(user, q),
    ]);

    return NextResponse.json({
      actividades: actividades.slice(0, 8).map((a) => ({
        id: a.id,
        titulo: a.titulo,
        prioridad: a.prioridad,
        estado: a.estado,
        clave: a.clave,
        cliente: a.cliente?.nombreEmpresa ?? null,
      })),
      clientes: clientes.slice(0, 6).map((c) => ({
        id: c.id,
        nombreEmpresa: c.nombreEmpresa,
        contactoNombre: c.contactoNombre,
      })),
    });
  } catch (e) {
    return respuestaError(e);
  }
}
