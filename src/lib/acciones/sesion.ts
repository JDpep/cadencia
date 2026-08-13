'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { crearSesion, cerrarSesion } from '@/lib/auth/session';
import { verificarCredenciales } from '@/lib/repos/usuarios';

export type EstadoFormulario = { error?: string; ok?: boolean };

export async function accionIniciarSesion(
  _previo: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const email = String(datos.get('email') ?? '');
  const password = String(datos.get('password') ?? '');

  if (!email || !password) return { error: 'Escribe tu correo y contraseña.' };

  const user = await verificarCredenciales(email, password);
  if (!user) return { error: 'Correo o contraseña incorrectos.' };

  // El try envuelve SÓLO a crearSesion: `redirect()` funciona lanzando una
  // excepción especial, y atraparla rompería la navegación.
  try {
    await crearSesion(user.id);
  } catch (e) {
    console.error('[sesion] no se pudo emitir', e);
    return { error: e instanceof Error ? e.message : 'No se pudo iniciar sesión.' };
  }

  redirect('/');
}

/**
 * Conmutador de usuario para pruebas: entra como cualquier usuario del seed
 * sin escribir contraseña. Es una comodidad de la versión LOCAL y desaparece
 * al migrar a la nube (ahí manda Supabase Auth).
 */
export async function accionConmutarUsuario(datos: FormData): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El conmutador de pruebas sólo existe en desarrollo local.');
  }

  const userId = String(datos.get('userId') ?? '');
  const user = await prisma.user.findFirst({
    where: { id: userId, activo: true },
    select: { id: true },
  });
  if (!user) throw new Error('Ese usuario de prueba no existe.');

  await crearSesion(user.id);
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function accionCerrarSesion(): Promise<void> {
  await cerrarSesion();
  revalidatePath('/', 'layout');
  redirect('/login');
}
