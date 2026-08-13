'use server';

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { revalidatePath } from 'next/cache';
import { requerirUsuario } from '@/lib/auth/guard';
import * as repo from '@/lib/repos/vacaciones';
import { registrar } from '@/lib/repos/bitacora';
import { subirComprobante } from '@/lib/almacenamiento';
import { esTipoAusencia } from '@/lib/dominio';

export type Resultado = { ok: true } | { ok: false; error: string };

async function envolver(fn: () => Promise<unknown>): Promise<Resultado> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'Ocurrió un error inesperado.';
    console.error('[accion:vacaciones]', mensaje);
    return { ok: false, error: mensaje };
  }
}

function refrescar() {
  revalidatePath('/');
  revalidatePath('/vacaciones');
  revalidatePath('/ausencias');
  revalidatePath('/agenda');
  revalidatePath('/admin/vacaciones');
  revalidatePath('/panorama');
}

// ---------------------------------------------------------------------------
// Adjuntos
// ---------------------------------------------------------------------------

/**
 * Los comprobantes van a un bucket PRIVADO de Supabase Storage.
 *
 * No al disco: en Vercel el filesystem es de solo lectura y efímero. Y no a un
 * bucket público: un certificado de incapacidad no puede quedar servible por
 * URL a quien la adivine. Se entregan por `/api/adjuntos/[id]`, que comprueba
 * permisos antes de pedir el archivo.
 */
const TIPOS_PERMITIDOS = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const TAMANO_MAXIMO = 2 * 1024 * 1024; // 2 MB — el límite de server actions

async function guardarAdjunto(archivo: File | null) {
  if (!archivo || archivo.size === 0) return null;

  if (!TIPOS_PERMITIDOS.has(archivo.type)) {
    throw new Error('El comprobante debe ser PDF, PNG, JPG o WEBP.');
  }
  if (archivo.size > TAMANO_MAXIMO) {
    throw new Error('El comprobante no puede pesar más de 2 MB.');
  }

  // Nombre generado: el que trae el usuario sólo se guarda como etiqueta,
  // nunca se usa para construir la ruta.
  const extension = path.extname(archivo.name).slice(0, 10).replace(/[^.\w]/g, '');
  const ruta = `${randomUUID()}${extension}`;

  await subirComprobante(ruta, await archivo.arrayBuffer(), archivo.type);

  return {
    nombre: archivo.name.slice(0, 180),
    tipo: archivo.type,
    ruta,
  };
}

// ---------------------------------------------------------------------------
// Acciones del ejecutivo
// ---------------------------------------------------------------------------

export async function accionSolicitarAusencia(datos: FormData): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();

    const tipo = String(datos.get('tipo') ?? '');
    const fechaInicio = String(datos.get('fechaInicio') ?? '');
    const fechaFin = String(datos.get('fechaFin') ?? '');
    const motivo = String(datos.get('motivo') ?? '');

    if (!esTipoAusencia(tipo)) throw new Error('Elige un tipo de ausencia.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      throw new Error('Elige la fecha de inicio y la de fin.');
    }

    const adjuntoCrudo = datos.get('adjunto');
    const adjunto = await guardarAdjunto(
      adjuntoCrudo instanceof File ? adjuntoCrudo : null,
    );

    const creada = await repo.solicitar(user, {
      tipo,
      fechaInicio,
      fechaFin,
      motivo,
      adjunto,
    });

    await registrar(user.id, 'vacation', creada.id, 'solicitar', undefined, {
      tipo,
      fechaInicio,
      fechaFin,
      diasHabiles: creada.diasHabiles,
    });
    refrescar();
  });
}

export async function accionCancelarAusencia(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.cancelar(user, id);
    if (!r) throw new Error('La solicitud ya no existe.');

    await registrar(
      user.id,
      'vacation',
      id,
      'cancelar',
      { estatus: r.antes.estatus },
      { estatus: 'cancelada' },
    );
    refrescar();
  });
}

// ---------------------------------------------------------------------------
// Acciones de Administración
// ---------------------------------------------------------------------------

export async function accionAprobarAusencia(id: string): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.aprobar(user, id);
    if (!r) throw new Error('La solicitud ya no existe.');

    await registrar(
      user.id,
      'vacation',
      id,
      'aprobar',
      { estatus: r.antes.estatus },
      { estatus: 'aprobada', dias: r.antes.diasHabiles },
    );
    refrescar();
  });
}

export async function accionRechazarAusencia(
  id: string,
  comentario: string,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.rechazar(user, id, comentario);
    if (!r) throw new Error('La solicitud ya no existe.');

    await registrar(
      user.id,
      'vacation',
      id,
      'rechazar',
      { estatus: r.antes.estatus },
      { estatus: 'rechazada', comentario },
    );
    refrescar();
  });
}

export async function accionFijarSaldo(
  userId: string,
  anio: number,
  dias: number,
): Promise<Resultado> {
  return envolver(async () => {
    const user = await requerirUsuario();
    const r = await repo.fijarDiasAsignados(user, userId, anio, dias);

    await registrar(
      user.id,
      'vacation_balance',
      `${userId}:${anio}`,
      'fijar_saldo',
      { asignados: r.antes.asignados },
      { asignados: r.despues.asignados },
    );
    refrescar();
  });
}
