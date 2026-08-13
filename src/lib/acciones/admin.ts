'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requerirRol } from '@/lib/auth/guard';
import * as usuarios from '@/lib/repos/usuarios';
import { escribirAjuste } from '@/lib/repos/catalogos';
import { registrar } from '@/lib/repos/bitacora';
import { esRol, type Rol, TOKENS_COLOR } from '@/lib/dominio';

export type Resultado = { ok: true } | { ok: false; error: string };

async function envolver(fn: () => Promise<void>): Promise<Resultado> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
    console.error('[accion:admin]', mensaje);
    return { ok: false, error: mensaje };
  }
}

// --- Usuarios --------------------------------------------------------------

export async function accionCrearUsuario(entrada: {
  nombre: string;
  email: string;
  rol: string;
  puesto?: string;
  password?: string;
}): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    if (!esRol(entrada.rol)) throw new Error('Rol inválido.');
    if (!entrada.nombre.trim() || !entrada.email.trim()) {
      throw new Error('Nombre y correo son obligatorios.');
    }

    const creado = await usuarios.crearUsuario(user, {
      nombre: entrada.nombre,
      email: entrada.email,
      rol: entrada.rol as Rol,
      puesto: entrada.puesto,
      password: entrada.password,
    });

    await registrar(user.id, 'user', creado.id, 'crear', undefined, {
      nombre: creado.nombre,
      email: creado.email,
      rol: creado.rol,
    });
    revalidatePath('/admin/usuarios');
  });
}

export async function accionActualizarUsuario(
  id: string,
  entrada: { nombre?: string; email?: string; rol?: string; puesto?: string; activo?: boolean; password?: string },
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    if (entrada.rol && !esRol(entrada.rol)) throw new Error('Rol inválido.');

    const r = await usuarios.actualizarUsuario(user, id, {
      ...entrada,
      rol: entrada.rol as Rol | undefined,
    });
    if (!r) throw new Error('El usuario ya no existe.');

    await registrar(user.id, 'user', id, 'editar', r.antes, r.despues);
    revalidatePath('/admin/usuarios');
  });
}

// --- Categorías ------------------------------------------------------------

export async function accionGuardarCategoria(
  id: string | null,
  entrada: {
    nombre: string;
    colorToken: string;
    icono?: string;
    /** Marca la categoría cuyas actividades completadas cuentan como vacante. */
    esEntrevista?: boolean;
  },
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    const nombre = entrada.nombre.trim();
    if (!nombre) throw new Error('La categoría necesita un nombre.');
    if (!(TOKENS_COLOR as readonly string[]).includes(entrada.colorToken)) {
      throw new Error('Color no válido.');
    }

    const esEntrevista = Boolean(entrada.esEntrevista);

    const datos = {
      nombre,
      colorToken: entrada.colorToken,
      icono: entrada.icono?.trim() || null,
      esEntrevista,
    };

    if (id) {
      await prisma.category.update({ where: { id }, data: datos });
      await registrar(user.id, 'category', id, 'editar', undefined, entrada);
    } else {
      const ultima = await prisma.category.findFirst({
        orderBy: { orden: 'desc' },
        select: { orden: true },
      });
      const c = await prisma.category.create({
        data: { ...datos, orden: (ultima?.orden ?? -1) + 1 },
      });
      await registrar(user.id, 'category', c.id, 'crear', undefined, entrada);
    }

    revalidatePath('/admin/catalogos');
    revalidatePath('/actividades');
    // El histórico de vacantes se deriva de esta bandera: si cambia, cambia.
    revalidatePath('/vacantes');
    revalidatePath('/panorama');
  });
}

export async function accionAlternarCategoria(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    const c = await prisma.category.findUnique({ where: { id } });
    if (!c) throw new Error('La categoría ya no existe.');

    await prisma.category.update({ where: { id }, data: { activo: !c.activo } });
    await registrar(user.id, 'category', id, c.activo ? 'desactivar' : 'activar');
    revalidatePath('/admin/catalogos');
  });
}

// --- Festivos --------------------------------------------------------------

export async function accionAgregarFestivo(fecha: string, nombre: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida (usa aaaa-mm-dd).');
    if (!nombre.trim()) throw new Error('El festivo necesita un nombre.');

    await prisma.holiday.upsert({
      where: { fecha },
      create: { fecha, nombre: nombre.trim() },
      update: { nombre: nombre.trim(), activo: true },
    });

    await registrar(user.id, 'holiday', fecha, 'crear', undefined, { fecha, nombre });
    revalidatePath('/admin/catalogos');
    revalidatePath('/agenda');
  });
}

export async function accionEliminarFestivo(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    await prisma.holiday.delete({ where: { id } });
    await registrar(user.id, 'holiday', id, 'eliminar');
    revalidatePath('/admin/catalogos');
    revalidatePath('/agenda');
  });
}

// --- Ajustes ---------------------------------------------------------------

/** Interruptor de privacidad total: ni Admin ni Dirección ven carteras ajenas. */
export async function accionPrivacidadTotal(activada: boolean): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirRol('admin');
    await escribirAjuste('privacidad_total_clientes', activada ? 'true' : 'false');
    await registrar(user.id, 'setting', 'privacidad_total_clientes', 'editar', undefined, {
      activada,
    });
    revalidatePath('/admin/catalogos');
    revalidatePath('/clientes');
  });
}
