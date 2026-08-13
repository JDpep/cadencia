import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  ErrorPermiso,
  exigirPropiedad,
  filtroClientes,
  type UsuarioSesion,
} from '@/lib/auth/guard';
import { esPeriodicidadNomina, type PeriodicidadNomina } from '@/lib/dominio';

/**
 * Cartera de clientes. Privacidad estricta: el ejecutivo sólo ve y edita
 * aquellos de los que es `ownerUserId`. El filtro se aplica SIEMPRE en el
 * servidor, aunque la UI ya haya limitado las opciones.
 */

export type ClienteVista = {
  id: string;
  ownerUserId: string;
  nombreEmpresa: string;
  correo: string | null;
  contactoNombre: string | null;
  telefono: string | null;
  /** Cada cuánto corre su nómina; null si todavía no se sabe. */
  periodicidadNomina: PeriodicidadNomina | null;
  notas: string | null;
  ownerNombre?: string;
  actividadesAbiertas?: number;
};

export type DatosCliente = {
  nombreEmpresa: string;
  correo?: string | null;
  contactoNombre?: string | null;
  telefono?: string | null;
  periodicidadNomina?: string | null;
  notas?: string | null;
};

/** Se valida en el servidor, no sólo en el desplegable: la API también entra por aquí. */
function nominaValida(v: unknown): PeriodicidadNomina | null {
  return esPeriodicidadNomina(v) ? v : null;
}

export async function listarClientes(
  user: UsuarioSesion,
  busqueda?: string,
): Promise<ClienteVista[]> {
  const filtro = await filtroClientes(user);
  const q = busqueda?.trim();

  const clientes = await prisma.client.findMany({
    where: {
      ...filtro,
      activo: true,
      ...(q
        ? {
            // Insensible a mayúsculas: en Postgres `contains` no lo es solo,
            // y en SQLite sí lo era. Sin esto la búsqueda se rompe al migrar.
            OR: [
              { nombreEmpresa: { contains: q, mode: 'insensitive' } },
              { contactoNombre: { contains: q, mode: 'insensitive' } },
              { correo: { contains: q, mode: 'insensitive' } },
              { telefono: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { nombreEmpresa: 'asc' },
    include: {
      owner: { select: { nombre: true } },
      _count: { select: { activities: { where: { estado: { not: 'hecha' }, archivada: false } } } },
    },
  });

  return clientes.map((c) => ({
    id: c.id,
    ownerUserId: c.ownerUserId,
    nombreEmpresa: c.nombreEmpresa,
    correo: c.correo,
    contactoNombre: c.contactoNombre,
    telefono: c.telefono,
    periodicidadNomina: nominaValida(c.periodicidadNomina),
    notas: c.notas,
    ownerNombre: c.owner.nombre,
    actividadesAbiertas: c._count.activities,
  }));
}

/** Sólo los clientes que el usuario puede vincular a una actividad: los suyos. */
export async function clientesVinculables(user: UsuarioSesion) {
  return prisma.client.findMany({
    where: { ownerUserId: user.id, activo: true },
    orderBy: { nombreEmpresa: 'asc' },
    select: { id: true, nombreEmpresa: true },
  });
}

export async function obtenerCliente(user: UsuarioSesion, id: string) {
  const filtro = await filtroClientes(user);

  const cliente = await prisma.client.findFirst({
    where: { id, activo: true, ...filtro },
    include: { owner: { select: { id: true, nombre: true, email: true } } },
  });

  // Se distingue "no existe" de "no es tuyo" sólo para el log; hacia fuera, 403.
  if (!cliente) {
    const existe = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (existe) throw new ErrorPermiso('Este cliente pertenece a otro ejecutivo.');
    return null;
  }

  return cliente;
}

export async function crearCliente(
  user: UsuarioSesion,
  datos: DatosCliente,
  ownerUserId?: string,
) {
  // Sólo Admin puede dar de alta un cliente a nombre de otro ejecutivo.
  const owner = ownerUserId && ownerUserId !== user.id ? ownerUserId : user.id;
  if (owner !== user.id && user.rol !== 'admin') {
    throw new ErrorPermiso('No puedes crear clientes para otro ejecutivo.');
  }

  return prisma.client.create({
    data: {
      ownerUserId: owner,
      nombreEmpresa: datos.nombreEmpresa.trim(),
      correo: limpiar(datos.correo),
      contactoNombre: limpiar(datos.contactoNombre),
      telefono: limpiar(datos.telefono),
      periodicidadNomina: nominaValida(datos.periodicidadNomina),
      notas: limpiar(datos.notas),
    },
  });
}

export async function actualizarCliente(
  user: UsuarioSesion,
  id: string,
  datos: DatosCliente,
) {
  const actual = await prisma.client.findUnique({ where: { id } });
  if (!actual || !actual.activo) return null;
  exigirPropiedad(user, actual.ownerUserId);

  const nuevo = await prisma.client.update({
    where: { id },
    data: {
      nombreEmpresa: datos.nombreEmpresa.trim(),
      correo: limpiar(datos.correo),
      contactoNombre: limpiar(datos.contactoNombre),
      telefono: limpiar(datos.telefono),
      periodicidadNomina: nominaValida(datos.periodicidadNomina),
      notas: limpiar(datos.notas),
    },
  });

  return { antes: actual, despues: nuevo };
}

/** Borrado lógico. Desvincula las actividades para no dejar referencias muertas. */
export async function eliminarCliente(user: UsuarioSesion, id: string) {
  const actual = await prisma.client.findUnique({ where: { id } });
  if (!actual || !actual.activo) return null;
  exigirPropiedad(user, actual.ownerUserId);

  await prisma.$transaction([
    prisma.activity.updateMany({ where: { clientId: id }, data: { clientId: null } }),
    prisma.client.update({ where: { id }, data: { activo: false } }),
  ]);

  return actual;
}

/** Traspaso de cartera — exclusivo de Admin. */
export async function reasignarCliente(
  user: UsuarioSesion,
  id: string,
  nuevoOwnerId: string,
) {
  if (user.rol !== 'admin') {
    throw new ErrorPermiso('Sólo Administración puede traspasar cartera.');
  }

  const actual = await prisma.client.findUnique({ where: { id } });
  if (!actual) return null;

  const destino = await prisma.user.findFirst({
    where: { id: nuevoOwnerId, activo: true },
    select: { id: true },
  });
  if (!destino) throw new ErrorPermiso('El ejecutivo destino no existe.');

  // Las actividades vinculadas quedarían cruzando carteras: se desvinculan.
  await prisma.$transaction([
    prisma.activity.updateMany({
      where: { clientId: id, ownerUserId: { not: nuevoOwnerId } },
      data: { clientId: null },
    }),
    prisma.client.update({ where: { id }, data: { ownerUserId: nuevoOwnerId } }),
  ]);

  return { antes: actual, despues: { ...actual, ownerUserId: nuevoOwnerId } };
}

function limpiar(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}
