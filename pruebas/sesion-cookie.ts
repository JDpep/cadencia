/**
 * Utilidad de pruebas: imprime la cookie de sesión de cada usuario del seed,
 * junto con los ids que hacen falta para probar la privacidad por API.
 *
 *   npx tsx pruebas/sesion-cookie.ts
 */
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const secreto = process.env.SESSION_SECRET || 'cadencia-local-dev-secret';

function cookie(userId: string): string {
  const payload = `${userId}.${Date.now().toString(36)}`;
  const firma = createHmac('sha256', secreto).update(payload).digest('base64url');
  return `cadencia_sesion=${payload}.${firma}`;
}

async function main() {
  const usuarios = await prisma.user.findMany({ orderBy: { rol: 'asc' } });

  const salida: Record<string, unknown> = { usuarios: {}, clientes: {}, actividades: {} };

  for (const u of usuarios) {
    (salida.usuarios as Record<string, unknown>)[u.email] = {
      id: u.id,
      rol: u.rol,
      cookie: cookie(u.id),
    };
  }

  for (const c of await prisma.client.findMany({ include: { owner: true } })) {
    (salida.clientes as Record<string, unknown>)[c.nombreEmpresa] = {
      id: c.id,
      owner: c.owner.email,
    };
  }

  for (const a of await prisma.activity.findMany({
    include: { owner: true },
    take: 40,
  })) {
    (salida.actividades as Record<string, unknown>)[a.titulo] = {
      id: a.id,
      owner: a.owner.email,
    };
  }

  console.log(JSON.stringify(salida, null, 2));
}

main().finally(() => prisma.$disconnect());
