'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FilaAgenda } from './FilaAgenda';
import { FichaActividad, type ContextoOcurrencia } from '@/components/actividades/FichaActividad';
import { DialogoReagendar } from '@/components/actividades/DialogoReagendar';
import {
  accionEliminarActividad,
  accionEliminarSerie,
} from '@/lib/acciones/actividades';
import type { ActividadVista, ItemAgenda } from '@/lib/repos/actividades';

type Categoria = { id: string; nombre: string; colorToken: string; icono: string | null };

/**
 * El servidor ya trae calculado lo que la fila necesita mostrar.
 *
 * No se reciben funciones: una función no puede cruzar de un componente de
 * servidor a uno de cliente, así que la etiqueta de fecha y los días de atraso
 * viajan como datos junto a cada actividad.
 */
export type ItemConAdorno = ItemAgenda & {
  etiquetaFecha?: string;
  diasAtraso?: number;
};

/**
 * Lista de actividades con acciones: editar, reagendar y eliminar.
 *
 * Vive aquí y no en la fila porque los tres diálogos son estado compartido de
 * la lista: si cada fila cargara el suyo, una pantalla con veinte actividades
 * montaría veinte fichas.
 */
export function ListaAccionable({
  items,
  categorias,
  clientes,
  mostrarFecha,
  destacarAtraso,
}: {
  items: ItemConAdorno[];
  categorias: Categoria[];
  clientes: { id: string; nombreEmpresa: string }[];
  mostrarFecha?: boolean;
  destacarAtraso?: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  const [reagendando, setReagendando] = useState<ItemAgenda | null>(null);
  const [ficha, setFicha] = useState<{
    actividad: ActividadVista | null;
    ocurrencia: ContextoOcurrencia;
  } | null>(null);

  /** La fila sólo conoce el agregado; la ficha necesita la actividad completa. */
  async function abrirFicha(item: ItemAgenda) {
    const r = await fetch(`/api/actividades/${item.activityId}`);
    if (!r.ok) {
      alert('No se pudo abrir la actividad.');
      return;
    }
    const { actividad } = await r.json();

    setFicha({
      actividad,
      ocurrencia: item.fechaOriginal
        ? {
            activityId: item.activityId,
            fechaOriginal: item.fechaOriginal,
            hora: item.hora,
          }
        : null,
    });
  }

  function eliminar(item: ItemAgenda) {
    // En una serie, borrar una ocurrencia es saltarla: la serie sigue viva.
    const mensaje = item.esSerie
      ? `¿Saltar «${item.titulo}» de este día? La serie sigue igual.`
      : `¿Eliminar «${item.titulo}»?`;

    if (!confirm(mensaje)) return;

    iniciar(async () => {
      const r =
        item.esSerie && item.fechaOriginal
          ? await accionEliminarSerie(item.activityId, item.fechaOriginal, 'esta')
          : await accionEliminarActividad(item.activityId);

      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <>
      <ul className="px-4 py-0.5">
        {items.map((i) => (
          <FilaAgenda
            key={i.llave}
            item={i}
            alAbrir={abrirFicha}
            alEditar={abrirFicha}
            alReagendar={setReagendando}
            alEliminar={eliminar}
            mostrarFecha={mostrarFecha}
            etiquetaFecha={i.etiquetaFecha}
            destacarAtraso={destacarAtraso}
            diasAtraso={i.diasAtraso}
          />
        ))}
      </ul>

      <DialogoReagendar item={reagendando} alCerrar={() => setReagendando(null)} />

      <FichaActividad
        abierta={ficha !== null}
        alCerrar={() => setFicha(null)}
        actividad={ficha?.actividad ?? null}
        ocurrencia={ficha?.ocurrencia ?? null}
        categorias={categorias}
        clientes={clientes}
      />
    </>
  );
}
