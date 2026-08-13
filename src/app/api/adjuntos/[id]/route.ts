import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { adjuntoDe } from '@/lib/repos/vacaciones';
import { noEncontrado, respuestaError } from '@/lib/api';

export const dynamic = 'force-dynamic';

const CARPETA = path.join(process.cwd(), 'almacen', 'adjuntos');

/**
 * Entrega el comprobante de una solicitud de ausencia.
 *
 * Vive fuera de `public/` a propósito: un certificado de incapacidad no puede
 * quedar accesible por URL a quien la adivine. Aquí se comprueba que quien pide
 * sea el dueño de la solicitud o Administración; cualquier otro → 403.
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

    // La ruta guardada es un nombre generado; se normaliza igual por si acaso,
    // para que nada pueda salirse de la carpeta.
    const nombreEnDisco = path.basename(adjunto.adjuntoRuta);
    const completa = path.join(CARPETA, nombreEnDisco);
    if (!completa.startsWith(CARPETA + path.sep)) return noEncontrado();

    const contenido = await readFile(completa).catch(() => null);
    if (!contenido) return noEncontrado('El comprobante ya no está en el disco.');

    return new NextResponse(new Uint8Array(contenido), {
      headers: {
        'Content-Type': adjunto.adjuntoTipo || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(
          adjunto.adjuntoNombre || nombreEnDisco,
        )}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    return respuestaError(e);
  }
}
