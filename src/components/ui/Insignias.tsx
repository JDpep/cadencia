import {
  ESTILO_PRIORIDAD,
  ETIQUETA_PRIORIDAD,
  estiloCategoria,
  type Prioridad,
} from '@/lib/dominio';
import { cn } from '@/lib/utils';

/** Punto de prioridad: la señal más pequeña, para listas densas. */
export function PuntoPrioridad({
  prioridad,
  className,
}: {
  prioridad: Prioridad;
  className?: string;
}) {
  return (
    <span
      title={`Prioridad ${ETIQUETA_PRIORIDAD[prioridad]}`}
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        ESTILO_PRIORIDAD[prioridad].punto,
        prioridad === 'urgente' && 'ring-2 ring-terracota/25',
        className,
      )}
    >
      <span className="sr-only">Prioridad {ETIQUETA_PRIORIDAD[prioridad]}</span>
    </span>
  );
}

export function PildoraPrioridad({
  prioridad,
  className,
}: {
  prioridad: Prioridad;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        ESTILO_PRIORIDAD[prioridad].pildora,
        className,
      )}
    >
      {prioridad === 'urgente' ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true">
          <path d="M6 0.5l1.6 3.4 3.7.5-2.7 2.6.7 3.7L6 9l-3.3 1.7.7-3.7L.7 4.4l3.7-.5L6 .5z" />
        </svg>
      ) : null}
      {ETIQUETA_PRIORIDAD[prioridad]}
    </span>
  );
}

export function ChipCategoria({
  nombre,
  colorToken,
  icono,
  className,
}: {
  nombre: string;
  colorToken: string;
  icono?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        estiloCategoria(colorToken).chip,
        className,
      )}
    >
      {icono ? <span aria-hidden="true">{icono}</span> : null}
      {nombre}
    </span>
  );
}

export function ChipCliente({
  nombre,
  className,
}: {
  nombre: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full border border-borde bg-superficie px-2 py-0.5 text-[11px] text-texto-3',
        className,
      )}
      title={nombre}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M1.5 10.5V3.2L6 1.5v9M6 10.5h4.5V5L6 3.7" strokeLinejoin="round" />
      </svg>
      <span className="truncate">{nombre}</span>
    </span>
  );
}

/** Marca de serie recurrente. */
export function ChipRecurrente({ reajustada }: { reajustada?: boolean }) {
  return (
    <span
      title={
        reajustada
          ? 'Ocurrencia movida a día hábil (caía en fin de semana o festivo)'
          : 'Actividad recurrente'
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
        reajustada
          ? 'border-ocre/40 bg-ocre/15 text-texto-2'
          : 'border-borde bg-superficie text-texto-4',
      )}
    >
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M10 4.5A4 4 0 1 0 10.5 7" strokeLinecap="round" />
        <path d="M10.5 1.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {reajustada ? 'movida' : 'repite'}
    </span>
  );
}
