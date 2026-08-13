import { cn } from '@/lib/utils';

/**
 * Isotipo Cadencia — tres trazos que fluyen. Fondo transparente.
 * El trazo grueso claro es el "hueco" que separa la onda terracota, así que
 * hereda el color de la superficie sobre la que se dibuja.
 */
export function Isotipo({
  className,
  colorFondo = 'rgb(var(--superficie))',
  colorTinta = 'rgb(var(--texto))',
}: {
  className?: string;
  colorFondo?: string;
  colorTinta?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path
        d="M12 48 C46 48 54 34 84 34"
        stroke={colorTinta}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M12 76 C46 76 54 48 84 48"
        stroke={colorTinta}
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M12 20 C50 20 42 62 84 62"
        stroke={colorFondo}
        strokeWidth="15"
        strokeLinecap="round"
      />
      <path
        d="M12 20 C50 20 42 62 84 62"
        stroke="rgb(var(--terracota))"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Marca completa: isotipo + wordmark y, debajo, la firma del estudio.
 * La firma va SIEMPRE bajo el logo — es parte de la identidad, no un extra.
 */
export function Marca({
  tamano = 'md',
  className,
  colorFondo,
}: {
  tamano?: 'sm' | 'md' | 'lg';
  className?: string;
  colorFondo?: string;
}) {
  const medidas = {
    sm: { iso: 'h-7 w-7', nombre: 'text-lg', firma: 'text-[8px]' },
    md: { iso: 'h-9 w-9', nombre: 'text-2xl', firma: 'text-[10px]' },
    lg: { iso: 'h-16 w-16', nombre: 'text-4xl', firma: 'text-[11px]' },
  }[tamano];

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Isotipo className={medidas.iso} colorFondo={colorFondo} />
      <span className="flex flex-col leading-none">
        <span
          className={cn('font-semibold tracking-marca text-texto', medidas.nombre)}
          style={{ lineHeight: 1 }}
        >
          Cadencia
        </span>
        <span className={cn('firma-forja mt-1', medidas.firma)}>By Forja Estudio</span>
      </span>
    </span>
  );
}
