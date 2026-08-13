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

export const FALTA_SECRETO =
  'Falta SESSION_SECRET en el servidor. Sin él, cualquiera podría firmar una ' +
  'sesión válida para cualquier usuario, así que no se emiten sesiones. ' +
  'Configúralo en las variables de entorno y vuelve a desplegar.';

/**
 * El secreto que firma la cookie, o `null` si no hay uno utilizable.
 *
 * En producción no vale el de desarrollo: la cookie es `userId.emitida.firma`,
 * así que quien conozca el secreto puede fabricar una sesión para CUALQUIER
 * usuario, administrador incluido. Y ese valor está en el repo.
 */
function secreto(): string | null {
  const valor = process.env.SESSION_SECRET;

  if (!valor || valor === SECRETO_DE_DESARROLLO) {
    return process.env.NODE_ENV === 'production' ? null : SECRETO_DE_DESARROLLO;
  }

  return valor;
}

function firmar(valor: string, clave: string): string {
  return createHmac('sha256', clave).update(valor).digest('base64url');
}

function verificar(valor: string, firma: string, clave: string): boolean {
  const esperada = Buffer.from(firmar(valor, clave));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length) return false;
  return timingSafeEqual(esperada, recibida);
}

/**
 * Emitir una sesión sin secreto sí es un error duro: es el momento en que la
 * falta de configuración importa, y el login puede decirlo con claridad.
 */
export async function crearSesion(userId: string): Promise<void> {
  const clave = secreto();
  if (!clave) throw new Error(FALTA_SECRETO);

  const emitida = Date.now().toString(36);
  const payload = `${userId}.${emitida}`;
  const token = `${payload}.${firmar(payload, clave)}`;

  const almacen = await cookies();
  almacen.set(NOMBRE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: DURACION_DIAS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Leer una sesión sin secreto NO tira la app: devuelve «no hay sesión».
 *
 * Fallar cerrado aquí significa negar el acceso, no romper todas las páginas.
 * Si esto lanzara, cualquiera con una cookie vieja se toparía con un 500 en
 * toda la aplicación en vez de acabar, tranquilamente, en el login.
 */
export async function leerSesion(): Promise<string | null> {
  const almacen = await cookies();
  const token = almacen.get(NOMBRE_COOKIE)?.value;
  if (!token) return null;

  const clave = secreto();
  if (!clave) {
    console.error('[sesion]', FALTA_SECRETO);
    return null;
  }

  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const [userId, emitida, firma] = partes;
  if (!verificar(`${userId}.${emitida}`, firma, clave)) return null;

  const emitidaMs = parseInt(emitida, 36);
  if (Number.isNaN(emitidaMs)) return null;
  if (Date.now() - emitidaMs > DURACION_DIAS * 24 * 60 * 60 * 1000) return null;

  return userId;
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE);
}
