import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { leerSesion } from './session';
import type { Rol } from '@/lib/dominio';

/**
 * Punto único de control de permisos. TODO acceso a datos pasa por aquí.
 *
 * Este archivo es el espejo de las políticas RLS que se activarán en Supabase:
 * cada función corresponde a una policy (`ownerUserId = auth.uid()`, rol
 * elevado para admin/dirección). Mientras corre en local, la regla se aplica
 * en el servidor de Next: esconder botones en la UI no cuenta como permiso.
 */

export type UsuarioSesion = {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  puesto: string | null;
  avatarUrl: string | null;
};

/** Error de autorización. Los route handlers lo traducen a HTTP 403. */
export class ErrorPermiso extends Error {
  readonly status = 403;
  constructor(mensaje = 'No tienes permiso para esta acción.') {
    super(mensaje);
    this.name = 'ErrorPermiso';
  }
}

export class ErrorAutenticacion extends Error {
  readonly status = 401;
  constructor(mensaje = 'Necesitas iniciar sesión.') {
    super(mensaje);
    this.name = 'ErrorAutenticacion';
  }
}

/** Usuario de la petición actual, o null. Memoizado por render. */
export const usuarioActual = cache(async (): Promise<UsuarioSesion | null> => {
  const id = await leerSesion();
  if (!id) return null;

  const user = await prisma.user.findFirst({
    where: { id, activo: true },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      puesto: true,
      avatarUrl: true,
    },
  });

  return user ? ({ ...user, rol: user.rol as Rol }) : null;
});

/** Para páginas: si no hay sesión, manda al login. */
export async function requerirSesion(): Promise<UsuarioSesion> {
  const user = await usuarioActual();
  if (!user) redirect('/login');
  return user;
}

/** Para acciones y APIs: si no hay sesión, lanza 401. */
export async function requerirUsuario(): Promise<UsuarioSesion> {
  const user = await usuarioActual();
  if (!user) throw new ErrorAutenticacion();
  return user;
}

export async function requerirRol(...roles: Rol[]): Promise<UsuarioSesion> {
  const user = await requerirUsuario();
  if (!roles.includes(user.rol)) {
    throw new ErrorPermiso(`Esta sección es sólo para: ${roles.join(', ')}.`);
  }
  return user;
}

// ---------------------------------------------------------------------------
// Reglas de propiedad — el corazón de la privacidad
// ---------------------------------------------------------------------------

/**
 * ¿Está activada la privacidad total de clientes? Si sí, ni Admin ni Dirección
 * ven las carteras ajenas. Interruptor en Admin → Configuración.
 */
export async function privacidadTotalClientes(): Promise<boolean> {
  const ajuste = await prisma.setting.findUnique({
    where: { clave: 'privacidad_total_clientes' },
  });
  return ajuste?.valor === 'true';
}

/**
 * Filtro de owner para consultas de CLIENTES.
 * - Ejecutivo: siempre y sólo los suyos.
 * - Admin / Dirección: todos, salvo que la privacidad total esté activada.
 */
export async function filtroClientes(
  user: UsuarioSesion,
): Promise<{ ownerUserId?: string }> {
  if (user.rol === 'usuario') return { ownerUserId: user.id };
  if (await privacidadTotalClientes()) return { ownerUserId: user.id };
  return {};
}

/**
 * Filtro de owner para ACTIVIDADES. Aquí no hay excepciones: las actividades
 * son privadas para todos los roles. Dirección sólo ve agregados en Panorama.
 */
export function filtroActividades(user: UsuarioSesion): { ownerUserId: string } {
  return { ownerUserId: user.id };
}

/** ¿Puede escribir sobre un recurso cuyo dueño es `ownerUserId`? */
export function puedeEditarDe(user: UsuarioSesion, ownerUserId: string): boolean {
  if (user.id === ownerUserId) return true;
  return user.rol === 'admin';
}

export function exigirPropiedad(user: UsuarioSesion, ownerUserId: string): void {
  if (!puedeEditarDe(user, ownerUserId)) {
    throw new ErrorPermiso('Este registro pertenece a otro ejecutivo.');
  }
}

/** Las actividades no las edita nadie más, ni el Admin. */
export function exigirPropiedadEstricta(user: UsuarioSesion, ownerUserId: string): void {
  if (user.id !== ownerUserId) {
    throw new ErrorPermiso('Esta actividad pertenece a otro ejecutivo.');
  }
}

export const esAdmin = (u: UsuarioSesion) => u.rol === 'admin';
export const esDireccion = (u: UsuarioSesion) => u.rol === 'direccion';
export const esEjecutivo = (u: UsuarioSesion) => u.rol === 'usuario';
