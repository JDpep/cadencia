'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Palomear } from '@/components/ui/Palomear';
import {
  ChipCategoria,
  ChipCliente,
  ChipRecurrente,
  PuntoPrioridad,
} from '@/components/ui/Insignias';
import { ESTILO_PRIORIDAD } from '@/lib/dominio';
import { diferenciaDias, fechaRelativa, hoyClave } from '@/lib/tiempo';
import type { ActividadVista } from '@/lib/repos/actividades';
import { cn } from '@/lib/utils';

export function TarjetaKanban({
  actividad,
  alAbrir,
  alPalomear,
}: {
  actividad: ActividadVista;
  alAbrir: () => void;
  alPalomear: (hecha: boolean) => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: actividad.id,
  });

  const hecha = actividad.estado === 'hecha';
  const vencida =
    !hecha && actividad.clave ? diferenciaDias(actividad.clave, hoyClave()) > 0 : false;

  const sub = actividad.subtareas;
  const hechasSub = sub.filter((s) => s.hecha).length;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'group cursor-grab touch-none rounded-forja border border-borde bg-superficie-2 p-3 shadow-forja transition-all active:cursor-grabbing',
        'border-l-[3px]',
        actividad.prioridad === 'urgente'
          ? 'border-l-terracota'
          : actividad.prioridad === 'alta'
            ? 'border-l-ocre'
            : 'border-l-borde-2',
        isDragging && 'rotate-1 opacity-90 shadow-forja-alto',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Palomear
          hecha={hecha}
          tamano="sm"
          alCambiar={alPalomear}
          etiqueta={`Marcar «${actividad.titulo}» como hecha`}
          className="mt-0.5"
        />
        <button
          type="button"
          onClick={alAbrir}
          onPointerDown={(e) => e.stopPropagation()}
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
        </button>
        <PuntoPrioridad prioridad={actividad.prioridad} className="mt-1.5" />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[30px]">
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
              'text-[11px]',
              vencida ? 'font-semibold text-terracota' : 'text-texto-4',
            )}
          >
            {fechaRelativa(actividad.clave)}
            {actividad.hora ? ` · ${actividad.hora}` : ''}
          </span>
        ) : null}

        {actividad.recurrencia ? <ChipRecurrente /> : null}

        {sub.length ? (
          <span className="text-[11px] text-texto-4">
            ☑ {hechasSub}/{sub.length}
          </span>
        ) : null}
      </div>

      {/* Barra fina de prioridad al pie: legible incluso de reojo */}
      <div className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full bg-superficie-3">
        <div
          className={cn('h-full rounded-full', ESTILO_PRIORIDAD[actividad.prioridad].barra)}
          style={{
            width:
              actividad.prioridad === 'urgente'
                ? '100%'
                : actividad.prioridad === 'alta'
                  ? '70%'
                  : actividad.prioridad === 'media'
                    ? '40%'
                    : '18%',
          }}
        />
      </div>
    </li>
  );
}
