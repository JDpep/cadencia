import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { ErrorPermiso, type UsuarioSesion } from '@/lib/auth/guard';
import { esRol, type Rol } from '@/lib/dominio';

export async function listarUsuarios(incluirInactivos = true) {
  return prisma.user.findMany({
    where: incluirInactivos ? {} : { activo: true },
    orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      puesto: true,
      activo: true,
      createdAt: true,
      _count: { select: { clients: true, activities: true } },
    },
  });
}

/** Lista mínima para el conmutador de pruebas y para reasignar cartera. */
export async function usuariosParaConmutador() {
  return prisma.user.findMany({
    where: { activo: true },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    select: { id: true, nombre: true, email: true, rol: true, puesto: true },
  });
}

export async function ejecutivosActivos() {
  return prisma.user.findMany({
    where: { activo: true, rol: { in: ['usuario', 'admin'] } },
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, email: true },
  });
}

export type DatosUsuario = {
  nombre: string;
  email: string;
  rol: Rol;
  puesto?: string | null;
  password?: string;
};

function exigirAdmin(user: UsuarioSesion) {
  if (user.rol !== 'admin') {
    throw new ErrorPermiso('Sólo Administración puede gestionar usuarios.');
  }
}

export async function crearUsuario(user: UsuarioSesion, datos: DatosUsuario) {
  exigirAdmin(user);
  if (!esRol(datos.rol)) throw new Error('Rol inválido.');

  const email = datos.email.trim().toLowerCase();
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) throw new Error('Ya existe un usuario con ese correo.');

  return prisma.user.create({
    data: {
      nombre: datos.nombre.trim(),
      email,
      rol: datos.rol,
      puesto: datos.puesto?.trim() || null,
      passwordHash: await bcrypt.hash(datos.password || 'cadencia123', 10),
    },
  });
}

export async function actualizarUsuario(
  user: UsuarioSesion,
  id: string,
  datos: Partial<DatosUsuario> & { activo?: boolean },
) {
  exigirAdmin(user);

  const actual = await prisma.user.findUnique({ where: { id } });
  if (!actual) return null;

  // Nadie puede quedarse sin administración.
  if ((datos.rol && datos.rol !== 'admin') || datos.activo === false) {
    if (actual.rol === 'admin') {
      const admins = await prisma.user.count({ where: { rol: 'admin', activo: true } });
      if (admins <= 1) throw new Error('Debe quedar al menos un administrador activo.');
    }
  }

  const despues = await prisma.user.update({
    where: { id },
    data: {
      ...(datos.nombre !== undefined ? { nombre: datos.nombre.trim() } : {}),
      ...(datos.email !== undefined ? { email: datos.email.trim().toLowerCase() } : {}),
      ...(datos.rol !== undefined ? { rol: datos.rol } : {}),
      ...(datos.puesto !== undefined ? { puesto: datos.puesto?.trim() || null } : {}),
      ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
      ...(datos.password ? { passwordHash: await bcrypt.hash(datos.password, 10) } : {}),
    },
  });

  return { antes: actual, despues };
}

export async function verificarCredenciales(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  if (!user || !user.activo) return null;

  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
