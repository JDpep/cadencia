'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Palomear } from '@/components/ui/Palomear';
import {
  ChipCategoria,
  ChipCliente,
  ChipRecurrente,
  PildoraPrioridad,
} from '@/components/ui/Insignias';
import { describirRegla } from '@/lib/recurrence';
import { fechaRelativa, diferenciaDias, hoyClave } from '@/lib/tiempo';
import type { ActividadVista } from '@/lib/repos/actividades';
import { cn } from '@/lib/utils';

/** Asa de arrastre — el resto de la fila queda libre para hacer clic. */
function Asa(props: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      role="button"
      tabIndex={0}
      aria-label="Reordenar"
      className="flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-texto-4 opacity-0 transition-opacity hover:text-texto-3 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
    >
      <svg viewBox="0 0 10 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1.2" />
        <circle cx="7" cy="3" r="1.2" />
        <circle cx="3" cy="8" r="1.2" />
        <circle cx="7" cy="8" r="1.2" />
        <circle cx="3" cy="13" r="1.2" />
        <circle cx="7" cy="13" r="1.2" />
      </svg>
    </span>
  );
}

export function FilaActividad({
  actividad,
  alAbrir,
  alPalomear,
  arrastrable = true,
}: {
  actividad: ActividadVista;
  alAbrir: () => void;
  alPalomear: (hecha: boolean) => void | Promise<void>;
  arrastrable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: actividad.id,
    disabled: !arrastrable,
  });

  const hecha = actividad.estado === 'hecha';
  const vencida =
    !hecha && actividad.clave ? diferenciaDias(actividad.clave, hoyClave()) > 0 : false;

  const sub = actividad.subtareas;
  const hechasSub = sub.filter((s) => s.hecha).length;
  const pct = sub.length ? Math.round((hechasSub / sub.length) * 100) : null;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative flex items-start gap-3 border-b border-borde px-3 py-3 transition-colors last:border-b-0 hover:bg-superficie-3/60',
        isDragging && 'z-10 rounded-forja bg-superficie-2 opacity-90 shadow-forja-alto',
      )}
    >
      {arrastrable ? <Asa {...attributes} {...listeners} /> : <span className="w-5" />}

      <Palomear
        hecha={hecha}
        alCambiar={alPalomear}
        etiqueta={`Marcar «${actividad.titulo}» como hecha`}
        className="mt-0.5"
      />

      <button
        type="button"
        onClick={alAbrir}
        className="min-w-0 flex-1 text-left"
      >
        <span
          className={cn(
            'block text-sm font-medium leading-snug',
            hecha ? 'text-texto-4 line-through' : 'text-texto',
          )}
        >
          {actividad.titulo}
        </span>

        {actividad.descripcion ? (
          <span className="mt-0.5 block truncate text-xs text-texto-4">
            {actividad.descripcion}
          </span>
        ) : null}

        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PildoraPrioridad prioridad={actividad.prioridad} />

          {actividad.categoria ? (
            <ChipCategoria
              nombre={actividad.categoria.nombre}
              colorToken={actividad.categoria.colorToken}
              icono={actividad.categoria.icono}
            />
          ) : null}

          {actividad.cliente ? <ChipCliente nombre={actividad.cliente.nombreEmpresa} /> : null}

          {actividad.clave ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                vencida
                  ? 'border-terracota/40 bg-terracota/10 font-semibold text-terracota'
                  : 'border-borde bg-superficie text-texto-3',
              )}
            >
              {fechaRelativa(actividad.clave)}
              {actividad.hora ? ` · ${actividad.hora}` : ''}
              {vencida ? ' · vencida' : ''}
            </span>
          ) : null}

          {actividad.recurrencia ? (
            <span title={describirRegla(actividad.recurrencia)}>
              <ChipRecurrente />
            </span>
          ) : null}

          {pct !== null ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-texto-4">
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-superficie-3">
                <span
                  className="block h-full rounded-full bg-verde-forja transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </span>
              {hechasSub}/{sub.length}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
