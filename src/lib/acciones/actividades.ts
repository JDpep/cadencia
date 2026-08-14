'use server';

import { revalidatePath } from 'next/cache';
import { requerirUsuario } from '@/lib/auth/guard';
import * as repo from '@/lib/repos/actividades';
import { registrar } from '@/lib/repos/bitacora';
import { sincronizarActividad } from '@/lib/repos/recordatorios';
import type { UsuarioSesion } from '@/lib/auth/guard';
import type { AlcanceEdicion, Estado, Prioridad } from '@/lib/dominio';
import type { ReglaRecurrencia } from '@/lib/recurrence';
import type { ClaveDia } from '@/lib/tiempo';

export type Resultado<T = void> = { ok: true; datos?: T } | { ok: false; error: string };

/** Toda acción devuelve un resultado; los errores de permiso llegan como texto. */
async function envolver<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    const datos = await fn();
    return { ok: true, datos };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
    console.error('[accion]', mensaje);
    return { ok: false, error: mensaje };
  }
}

function refrescar() {
  revalidatePath('/');
  revalidatePath('/actividades');
  revalidatePath('/agenda');
  revalidatePath('/clientes');
}

/**
 * Rehace los recordatorios de la actividad tocada. Como la bitácora, no puede
 * tumbar la operación principal: si algo falla se anota y sigue — la próxima
 * pasada de `asegurarRecordatorios` lo corrige.
 */
async function sincronizar(user: UsuarioSesion, ...ids: (string | null | undefined)[]) {
  for (const id of new Set(ids.filter(Boolean) as string[])) {
    try {
      await sincronizarActividad(user, id);
    } catch (e) {
      console.error('[recordatorios] no se pudo sincronizar', id, e);
    }
  }
}

export type EntradaActividad = {
  titulo: string;
  descripcion?: string | null;
  categoryId?: string | null;
  prioridad?: Prioridad;
  estado?: Estado;
  clave?: ClaveDia | null;
  hora?: string | null;
  clientId?: string | null;
  recurrencia?: ReglaRecurrencia | null;
  recordatorioMinutos?: number | null;
};

/** Alta rápida: título + Enter. */
export async function accionCrearRapida(
  titulo: string,
  extras?: { clave?: ClaveDia | null; hora?: string | null; prioridad?: Prioridad },
): Promise<Resultado<string>> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const creada = await repo.crearActividad(user, {
      titulo,
      clave: extras?.clave ?? null,
      hora: extras?.hora ?? null,
      prioridad: extras?.prioridad ?? 'media',
    });
    await registrar(user.id, 'activity', creada.id, 'crear', undefined, { titulo: creada.titulo });
    refrescar();
    return creada.id;
  });
}

export async function accionGuardarActividad(
  id: string | null,
  entrada: EntradaActividad,
): Promise<Resultado<string>> {
  return envolver(async () => {
    const user = await requerirUsuario();

    if (!id) {
      const creada = await repo.crearActividad(user, entrada);
      await registrar(user.id, 'activity', creada.id, 'crear', undefined, entrada);
      await sincronizar(user, creada.id);
      refrescar();
      return creada.id;
    }

    const r = await repo.actualizarActividad(user, id, entrada);
    if (!r) throw new Error('La actividad ya no existe.');
    await registrar(user.id, 'activity', id, 'editar', r.antes, r.despues);
    await sincronizar(user, id);
    refrescar();
    return id;
  });
}

export async function accionCambiarEstado(id: string, estado: Estado): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.cambiarEstado(user, id, estado);
    if (!r) throw new Error('La actividad ya no existe.');
    await registrar(user.id, 'activity', id, `estado:${estado}`, { estado: r.antes.estado }, { estado });
    // Al darla por hecha, su recordatorio deja de tener sentido.
    await sincronizar(user, id);
    refrescar();
  });
}

export async function accionReordenar(ids: string[]): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.reordenarActividades(user, ids);
    refrescar();
  });
}

export async function accionMoverTablero(
  id: string,
  estado: Estado,
  idsColumna: string[],
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.moverEnTablero(user, id, estado, idsColumna);
    if (!r) throw new Error('La actividad ya no existe.');
    await registrar(user.id, 'activity', id, `tablero:${estado}`, { estado: r.antes.estado }, { estado });
    await sincronizar(user, id);
    refrescar();
  });
}

export async function accionEliminarActividad(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const a = await repo.eliminarActividad(user, id);
    if (!a) throw new Error('La actividad ya no existe.');
    await registrar(user.id, 'activity', id, 'eliminar', { titulo: a.titulo }, undefined);
    refrescar();
  });
}

export async function accionReprogramar(
  id: string,
  clave: ClaveDia,
  hora?: string | null,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.reprogramar(user, id, clave, hora);
    if (!r) throw new Error('La actividad ya no existe.');
    await registrar(user.id, 'activity', id, 'reprogramar', { fecha: r.antes.fecha }, { clave, hora });
    // Cambió la fecha: el aviso se re-ancla a la nueva.
    await sincronizar(user, id);
    refrescar();
  });
}

/**
 * Reagendar con motivo.
 *
 * Distinto de `accionReprogramar`, que es el arrastre en el calendario: aquí el
 * usuario dice a propósito POR QUÉ se mueve, y esa razón se guarda en la
 * bitácora. Mover una fecha sin dejar rastro es justo lo que vuelve inútil un
 * historial: al mes nadie recuerda si algo se recorrió por el cliente, por una
 * urgencia o porque no dio tiempo.
 *
 * Sirve igual para una actividad suelta que para una ocurrencia de serie: en el
 * segundo caso se mueve SÓLO esa ocurrencia y la serie sigue intacta.
 */
export async function accionReagendar(
  activityId: string,
  fechaOriginal: ClaveDia | null,
  nuevaClave: ClaveDia,
  hora: string | null,
  motivo: string,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();

    const razon = motivo.trim();
    if (!razon) throw new Error('Escribe por qué se reagenda.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nuevaClave)) throw new Error('Elige la nueva fecha.');

    const antes = fechaOriginal
      ? { fechaOriginal }
      : { fecha: (await repo.obtenerActividad(user, activityId))?.fecha ?? null };

    if (fechaOriginal) {
      await repo.moverOcurrencia(user, activityId, fechaOriginal, nuevaClave, hora);
    } else {
      const r = await repo.reprogramar(user, activityId, nuevaClave, hora);
      if (!r) throw new Error('La actividad ya no existe.');
    }

    await registrar(
      user.id,
      fechaOriginal ? 'occurrence' : 'activity',
      fechaOriginal ? `${activityId}::${fechaOriginal}` : activityId,
      'reagendar',
      antes,
      { nuevaClave, hora, motivo: razon },
    );

    await sincronizar(user, activityId);
    refrescar();
  });
}

// --- Sub-actividades -------------------------------------------------------

export async function accionAgregarSubtarea(
  activityId: string,
  texto: string,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.agregarSubtarea(user, activityId, texto);
    refrescar();
  });
}

export async function accionAlternarSubtarea(subtareaId: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.alternarSubtarea(user, subtareaId);
    refrescar();
  });
}

export async function accionEliminarSubtarea(subtareaId: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.eliminarSubtarea(user, subtareaId);
    refrescar();
  });
}

// --- Series recurrentes ----------------------------------------------------

export async function accionEstadoOcurrencia(
  activityId: string,
  fechaOriginal: ClaveDia,
  estado: Estado,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.cambiarEstadoOcurrencia(user, activityId, fechaOriginal, estado);
    await registrar(user.id, 'occurrence', `${activityId}::${fechaOriginal}`, `estado:${estado}`);
    await sincronizar(user, activityId);
    refrescar();
  });
}

export async function accionMoverOcurrencia(
  activityId: string,
  fechaOriginal: ClaveDia,
  nuevaClave: ClaveDia,
  hora?: string | null,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.moverOcurrencia(user, activityId, fechaOriginal, nuevaClave, hora);
    await registrar(user.id, 'occurrence', `${activityId}::${fechaOriginal}`, 'mover', undefined, {
      nuevaClave,
    });
    await sincronizar(user, activityId);
    refrescar();
  });
}

export async function accionSaltarOcurrencia(
  activityId: string,
  fechaOriginal: ClaveDia,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.saltarOcurrencia(user, activityId, fechaOriginal);
    await registrar(user.id, 'occurrence', `${activityId}::${fechaOriginal}`, 'saltar');
    // Una ocurrencia saltada no avisa.
    await sincronizar(user, activityId);
    refrescar();
  });
}

export async function accionGuardarSerie(
  activityId: string,
  fechaOriginal: ClaveDia,
  alcance: AlcanceEdicion,
  entrada: EntradaActividad,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.editarSerie(user, activityId, fechaOriginal, alcance, entrada);
    if (!r) throw new Error('La serie ya no existe.');
    await registrar(user.id, 'activity', activityId, `serie:${alcance}`, undefined, entrada);
    // Con alcance «siguientes» nace una serie nueva: hay que sincronizar las dos.
    await sincronizar(user, activityId, r.activityId);
    refrescar();
  });
}

export async function accionEliminarSerie(
  activityId: string,
  fechaOriginal: ClaveDia | null,
  alcance: AlcanceEdicion,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    await repo.eliminarSerie(user, activityId, fechaOriginal, alcance);
    await registrar(user.id, 'activity', activityId, `serie:eliminar:${alcance}`);
    // Si la serie sobrevivió (esta / siguientes) se reajustan sus avisos; si se
    // borró entera, sus recordatorios se fueron en cascada y esto no hace nada.
    await sincronizar(user, activityId);
    refrescar();
  });
}
