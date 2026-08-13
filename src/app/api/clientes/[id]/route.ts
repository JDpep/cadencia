import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { obtenerCliente } from '@/lib/repos/clientes';
import { noEncontrado, respuestaError } from '@/lib/api';

/**
 * Lectura de un cliente por API. Existe sobre todo para poder COMPROBAR la
 * privacidad forzando el id de un cliente ajeno: debe responder 403.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await requerirUsuario();

    const cliente = await obtenerCliente(user, id);
    if (!cliente) return noEncontrado('Ese cliente no existe.');

    return NextResponse.json({ cliente });
  } catch (e) {
    return respuestaError(e);
  }
}
