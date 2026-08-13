'use server';

import { revalidatePath } from 'next/cache';
import { requerirUsuario } from '@/lib/auth/guard';
import * as repo from '@/lib/repos/recordatorios';
import { MINUTOS_POSPONER } from '@/lib/dominio';

export type ResultadoRecordatorio = { ok: true } | { ok: false; error: string };

async function envolver(fn: () => Promise<unknown>): Promise<ResultadoRecordatorio> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
    console.error('[recordatorios]', mensaje);
    return { ok: false, error: mensaje };
  }
}

/** Despacha un recordatorio: no vuelve a sonar. */
export async function accionDescartarRecordatorio(
  id: string,
): Promise<ResultadoRecordatorio> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.descartar(user, id);
    revalidatePath('/');
  });
}

export async function accionDescartarTodos(): Promise<ResultadoRecordatorio> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.descartarTodos(user);
    revalidatePath('/');
  });
}

/** Que vuelva a sonar en un rato. */
export async function accionPosponerRecordatorio(
  id: string,
  minutos: number = MINUTOS_POSPONER,
): Promise<ResultadoRecordatorio> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.posponer(user, id, minutos);
    revalidatePath('/');
  });
}
