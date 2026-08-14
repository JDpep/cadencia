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
  alEditar,
  alReagendar,
  alEliminar,
  mostrarFecha,
  etiquetaFecha,
  destacarAtraso,
  diasAtraso,
  compacta = false,
}: {
  item: ItemAgenda;
  alAbrir?: (item: ItemAgenda) => void;
  /** Cada acción aparece sólo si quien usa la fila la proporciona. */
  alEditar?: (item: ItemAgenda) => void;
  alReagendar?: (item: ItemAgenda) => void;
  alEliminar?: (item: ItemAgenda) => void;
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

      {/*
        Acciones. Aparecen al pasar el cursor para no ensuciar la lista, pero
        se vuelven visibles al tabular: si sólo respondieran al ratón, con
        teclado serían inalcanzables.
      */}
      {alEditar || alReagendar || alEliminar ? (
        <span className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {alEditar ? (
            <BotonAccion etiqueta={`Editar «${item.titulo}»`} alPulsar={() => alEditar(item)}>
              <path d="M11.5 2.5l2 2L5 13l-2.5.5.5-2.5 8.5-8.5z" strokeLinejoin="round" />
            </BotonAccion>
          ) : null}

          {alReagendar ? (
            <BotonAccion
              etiqueta={`Reagendar «${item.titulo}»`}
              alPulsar={() => alReagendar(item)}
            >
              <rect x="2" y="3" width="12" height="11" rx="2" />
              <path d="M2 6.5h12M5.5 2v2M10.5 2v2" strokeLinecap="round" />
              <path d="M6 10.5h4M8.5 9l1.5 1.5L8.5 12" strokeLinecap="round" strokeLinejoin="round" />
            </BotonAccion>
          ) : null}

          {alEliminar ? (
            <BotonAccion
              etiqueta={`Eliminar «${item.titulo}»`}
              alPulsar={() => alEliminar(item)}
              peligro
            >
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 8.5h6l.5-8.5" strokeLinecap="round" strokeLinejoin="round" />
            </BotonAccion>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

/** Botón de icono de la fila: mismo tamaño y comportamiento para las tres. */
function BotonAccion({
  etiqueta,
  alPulsar,
  peligro,
  children,
}: {
  etiqueta: string;
  alPulsar: () => void;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        'rounded-[7px] p-1.5 text-texto-4 transition-colors',
        peligro ? 'hover:bg-terracota/10 hover:text-terracota' : 'hover:bg-superficie-3 hover:text-texto',
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
