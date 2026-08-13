import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma único (evita agotar conexiones con el hot-reload de Next).
 * Al migrar a Postgres/Supabase sólo cambia el datasource en schema.prisma;
 * este archivo no se toca.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
