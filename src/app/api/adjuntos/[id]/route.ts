import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { adjuntoDe } from '@/lib/repos/vacaciones';
import { leerComprobante } from '@/lib/almacenamiento';
import { noEncontrado, respuestaError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Entrega el comprobante de una solicitud de ausencia.
 *
 * El archivo vive en un bucket PRIVADO de Supabase Storage, así que no hay URL
 * que se pueda adivinar: la única puerta es ésta, y comprueba que quien pide
 * sea el dueño de la solicitud o Administración. Cualquier otro —Dirección
 * incluida— recibe 403, y el permiso se mira ANTES de saber si hay archivo.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requerirUsuario();
    const { id } = await params;

    const adjunto = await adjuntoDe(user, id);
    if (!adjunto?.adjuntoRuta) return noEncontrado('Esta solicitud no tiene comprobante.');

    const archivo = await leerComprobante(adjunto.adjuntoRuta);
    if (!archivo) return noEncontrado('El comprobante ya no está disponible.');

    return new NextResponse(archivo.contenido, {
      headers: {
        'Content-Type': adjunto.adjuntoTipo || archivo.tipo,
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          adjunto.adjuntoNombre || 'comprobante',
        )}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return respuestaError(e);
  }
}
