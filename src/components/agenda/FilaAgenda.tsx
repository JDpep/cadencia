'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Palomear } from '@/components/ui/Palomear';
import {
  ChipCategoria,
  ChipCliente,
  ChipRecurrente,
  PildoraPrioridad,
} from '@/components/ui/Insignias';
import { accionCambiarEstado, accionEstadoOcurrencia } from '@/lib/acciones/actividades';
import type { ItemAgenda } from '@/lib/repos/actividades';
import { cn } from '@/lib/utils';

/**
 * Fila de agenda. Sirve igual para una actividad suelta que para una
 * ocurrencia de serie: al palomear, la ocurrencia se completa sola y la serie
 * sigue viva.
 */
export function FilaAgenda({
  item,
  alAbrir,
  mostrarFecha,
  etiquetaFecha,
  destacarAtraso,
  diasAtraso,
  compacta = false,
}: {
  item: ItemAgenda;
  alAbrir?: (item: ItemAgenda) => void;
  mostrarFecha?: boolean;
  etiquetaFecha?: string;
  destacarAtraso?: boolean;
  diasAtraso?: number;
  compacta?: boolean;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();

  const hecha = item.estado === 'hecha';

  function palomear(marcada: boolean) {
    const estado = marcada ? 'hecha' : 'por_hacer';

    iniciar(async () => {
      const r = item.fechaOriginal
        ? await accionEstadoOcurrencia(item.activityId, item.fechaOriginal, estado)
        : await accionCambiarEstado(item.activityId, estado);

      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        'group flex items-start gap-3 border-b border-borde py-2.5 last:border-b-0',
        compacta ? 'px-0' : 'px-1',
      )}
    >
      <Palomear
        hecha={hecha}
        alCambiar={palomear}
        tamano={compacta ? 'sm' : 'md'}
        etiqueta={`Marcar «${item.titulo}» como hecha`}
        className="mt-0.5"
      />

      {/* La hora es el ancla visual de la agenda */}
      <span
        className={cn(
          'mt-0.5 w-11 shrink-0 text-right text-xs font-semibold tabular-nums',
          hecha ? 'text-texto-4' : 'text-texto-3',
        )}
      >
        {item.hora ?? '—'}
      </span>

      <button
        type="button"
        onClick={() => alAbrir?.(item)}
        disabled={!alAbrir}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            'block text-sm leading-snug',
            hecha ? 'text-texto-4 line-through' : 'font-medium text-texto',
          )}
        >
          {item.titulo}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <PildoraPrioridad prioridad={item.prioridad} />

          {item.categoria ? (
            <ChipCategoria
              nombre={item.categoria.nombre}
              colorToken={item.categoria.colorToken}
              icono={item.categoria.icono}
            />
          ) : null}

          {item.cliente ? <ChipCliente nombre={item.cliente.nombreEmpresa} /> : null}

          {item.esSerie ? <ChipRecurrente reajustada={item.reajustada} /> : null}

          {destacarAtraso && diasAtraso ? (
            <span className="inline-flex items-center rounded-full border border-terracota/40 bg-terracota/10 px-2 py-0.5 text-[11px] font-semibold text-terracota">
              {diasAtraso} {diasAtraso === 1 ? 'día' : 'días'} de atraso
            </span>
          ) : mostrarFecha && etiquetaFecha ? (
            <span className="inline-flex items-center rounded-full border border-borde bg-superficie px-2 py-0.5 text-[11px] text-texto-3">
              {etiquetaFecha}
            </span>
          ) : null}

          {item.subtotal.total ? (
            <span className="text-[11px] text-texto-4">
              ☑ {item.subtotal.hechas}/{item.subtotal.total}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
