import 'server-only';
import { NextResponse } from 'next/server';
import { ErrorAutenticacion, ErrorPermiso } from '@/lib/auth/guard';

/**
 * Traduce los errores del guard a HTTP. Es lo que hace que forzar por API
 * un recurso ajeno devuelva 403 y no una página cualquiera.
 */
export function respuestaError(e: unknown): NextResponse {
  if (e instanceof ErrorPermiso) {
    return NextResponse.json({ error: e.message }, { status: 403 });
  }
  if (e instanceof ErrorAutenticacion) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }

  console.error('[api]', e);
  const mensaje = e instanceof Error ? e.message : 'Error inesperado';
  return NextResponse.json({ error: mensaje }, { status: 500 });
}

export function noEncontrado(mensaje = 'No encontrado') {
  return NextResponse.json({ error: mensaje }, { status: 404 });
}
