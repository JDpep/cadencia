'use server';

import { revalidatePath } from 'next/cache';
import { requerirUsuario } from '@/lib/auth/guard';
import * as repo from '@/lib/repos/clientes';
import { registrar } from '@/lib/repos/bitacora';

export type Resultado = { ok: true; id?: string } | { ok: false; error: string };

async function envolver(fn: () => Promise<string | void>): Promise<Resultado> {
  try {
    const id = await fn();
    return { ok: true, id: id ?? undefined };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
    console.error('[accion:clientes]', mensaje);
    return { ok: false, error: mensaje };
  }
}

export type EntradaCliente = {
  nombreEmpresa: string;
  correo?: string | null;
  contactoNombre?: string | null;
  telefono?: string | null;
  /** semanal | quincenal | mensual. El repositorio valida el valor. */
  periodicidadNomina?: string | null;
  notas?: string | null;
};

function refrescar() {
  revalidatePath('/clientes');
  revalidatePath('/actividades');
  revalidatePath('/');
}

export async function accionGuardarCliente(
  id: string | null,
  entrada: EntradaCliente,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();

    if (!entrada.nombreEmpresa?.trim()) {
      throw new Error('El nombre de la empresa es obligatorio.');
    }

    if (!id) {
      const c = await repo.crearCliente(user, entrada);
      await registrar(user.id, 'client', c.id, 'crear', undefined, entrada);
      refrescar();
      return c.id;
    }

    const r = await repo.actualizarCliente(user, id, entrada);
    if (!r) throw new Error('El cliente ya no existe.');
    await registrar(user.id, 'client', id, 'editar', r.antes, r.despues);
    refrescar();
    revalidatePath(`/clientes/${id}`);
    return id;
  });
}

export async function accionEliminarCliente(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const c = await repo.eliminarCliente(user, id);
    if (!c) throw new Error('El cliente ya no existe.');
    await registrar(user.id, 'client', id, 'eliminar', { nombreEmpresa: c.nombreEmpresa });
    refrescar();
  });
}

/** Traspaso de cartera — sólo Admin (se valida en el repositorio). */
export async function accionReasignarCliente(
  id: string,
  nuevoOwnerId: string,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.reasignarCliente(user, id, nuevoOwnerId);
    if (!r) throw new Error('El cliente ya no existe.');
    await registrar(user.id, 'client', id, 'reasignar', r.antes, r.despues);
    refrescar();
    revalidatePath(`/clientes/${id}`);
  });
}
