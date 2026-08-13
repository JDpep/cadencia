import 'server-only';
import { prisma } from '@/lib/prisma';

export type Categoria = {
  id: string;
  nombre: string;
  colorToken: string;
  icono: string | null;
  orden: number;
  activo: boolean;
  /** Sus actividades completadas cuentan como vacante (ver repos/vacantes.ts). */
  esEntrevista: boolean;
};

export async function listarCategorias(incluirInactivas = false): Promise<Categoria[]> {
  return prisma.category.findMany({
    where: incluirInactivas ? {} : { activo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  });
}

export async function listarFestivos(soloActivos = true) {
  return prisma.holiday.findMany({
    where: soloActivos ? { activo: true } : {},
    orderBy: { fecha: 'asc' },
  });
}

/** Set de claves yyyy-MM-dd que el motor de recurrencia consulta. */
export async function conjuntoFestivos(): Promise<Set<string>> {
  const festivos = await prisma.holiday.findMany({
    where: { activo: true },
    select: { fecha: true },
  });
  return new Set(festivos.map((f) => f.fecha));
}

export async function leerAjuste(clave: string): Promise<string | null> {
  const a = await prisma.setting.findUnique({ where: { clave } });
  return a?.valor ?? null;
}

export async function escribirAjuste(clave: string, valor: string): Promise<void> {
  await prisma.setting.upsert({
    where: { clave },
    create: { clave, valor },
    update: { valor },
  });
}
