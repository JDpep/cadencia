import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Sesión local: una cookie firmada con HMAC. Sin servicios externos.
 * Al migrar a la nube, este archivo se sustituye por Supabase Auth y el resto
 * de la app no cambia, porque todo consume `usuarioActual()` de guard.ts.
 */

const NOMBRE_COOKIE = 'cadencia_sesion';
const DURACION_DIAS = 30;

function secreto(): string {
  return process.env.SESSION_SECRET || 'cadencia-local-dev-secret';
}

function firmar(valor: string): string {
  return createHmac('sha256', secreto()).update(valor).digest('base64url');
}

function verificar(valor: string, firma: string): boolean {
  const esperada = Buffer.from(firmar(valor));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

export async function crearSesion(userId: string): Promise<void> {
  const emitida = Date.now().toString(36);
  const payload = `${userId}.${emitida}`;
  const token = `${payload}.${firmar(payload)}`;

  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_DIAS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function leerSesion(): Promise<string | null> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [userId, emitida, firma] = partes;
  if (!verificar(`${userId}.${emitida}`, firma)) return null;

  const emitidaMs = parseInt(emitida, 36);
  if (Number.isNaN(emitidaMs)) return null;
  if (Date.now() - emitidaMs > DURACION_DIAS * 24 * 60 * 60 * 1000) return null;

  return userId;
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE);
}
