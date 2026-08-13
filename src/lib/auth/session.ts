import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * Sesión: una cookie firmada con HMAC contra la tabla `User`.
 *
 * Todo el resto de la app consume `usuarioActual()` de guard.ts, así que si
 * algún día se cambia por Supabase Auth sólo se toca este archivo.
 */

const NOMBRE_COOKIE = 'cadencia_sesion';
const DURACION_DIAS = 30;

const SECRETO_DE_DESARROLLO = 'cadencia-local-dev-secret';

/**
 * En producción NO hay secreto por defecto.
 *
 * La cookie de sesión es `userId.emitida.firma`: quien conozca el secreto
 * puede fabricar una cookie válida para CUALQUIER usuario, incluido el
 * administrador. Un valor por defecto que además está en el repo equivale a no
 * tener autenticación. Por eso aquí se falla en vez de arrancar inseguro.
 */
function secreto(): string {
  const valor = process.env.SESSION_SECRET;

  if (!valor || valor === SECRETO_DE_DESARROLLO) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Falta SESSION_SECRET. Sin él, cualquiera puede firmar una sesión válida ' +
          'para cualquier usuario. Configúralo en las variables de entorno.',
      );
    }
    return SECRETO_DE_DESARROLLO;
  }

  return valor;
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
