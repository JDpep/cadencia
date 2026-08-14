import { cn } from '@/lib/utils';

export type Cifra = {
  etiqueta: string;
  valor: string | number;
  detalle?: string;
  /** 0–100. Pinta una barra fina bajo el número. */
  barra?: number;
  tono?: 'terracota' | 'verde' | 'neutro';
};

/**
 * Cifras de cabecera en UNA tira, no en cuatro tarjetas altas.
 *
 * Cuatro tarjetas con su propio padding ocupaban media pantalla para enseñar
 * cuatro números. Aquí comparten una sola superficie y se separan con filetes:
 * misma información, un tercio del alto, y se leen de corrido.
 *
 * Dos columnas en móvil, cuatro a partir de `lg`. Los filetes se colocan por
 * posición: a la izquierda salvo en la primera de cada fila, y arriba en la
 * segunda fila mientras haya dos columnas.
 */
export function TiraCifras({ cifras }: { cifras: Cifra[] }) {
  return (
    <section className="tarjeta grid grid-cols-2 overflow-hidden shadow-forja lg:grid-cols-4">
      {cifras.map((c, i) => (
        <div
          key={c.etiqueta}
          className={cn(
            'border-borde px-3.5 py-2.5',
            'border-l',
            i % 2 === 0 && 'border-l-0',
            'lg:border-l',
            i === 0 && 'lg:border-l-0',
            i >= 2 && 'border-t lg:border-t-0',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-texto-4">
            {c.etiqueta}
          </p>

          <p
            className={cn(
              'mt-0.5 text-2xl font-semibold leading-none tabular-nums',
              c.tono === 'terracota'
                ? 'text-terracota'
                : c.tono === 'verde'
                  ? 'text-verde-forja'
                  : 'text-texto',
            )}
          >
            {c.valor}
          </p>

          {c.detalle ? (
            <p className="mt-1 truncate text-[11px] leading-tight text-texto-4">{c.detalle}</p>
          ) : null}

          {c.barra !== undefined ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-superficie-3">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  c.tono === 'terracota' ? 'bg-terracota' : 'bg-verde-forja',
                )}
                style={{ width: `${Math.min(100, Math.max(0, c.barra))}%` }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </section>
  );
}
