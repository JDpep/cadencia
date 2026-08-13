'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Diálogo modal accesible: cierra con Escape o clic fuera, atrapa el foco
 * dentro y devuelve el foco al elemento que lo abrió.
 */
export function Dialogo({
  abierto,
  alCerrar,
  titulo,
  descripcion,
  ancho = 'md',
  children,
  pie,
}: {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  descripcion?: string;
  ancho?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  pie?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    previo.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    const primerFoco = panel.current?.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    );
    primerFoco?.focus();

    function alTeclear(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        alCerrar();
        return;
      }
      if (e.key !== 'Tab' || !panel.current) return;

      const focos = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focos.length) return;

      const primero = focos[0];
      const ultimo = focos[focos.length - 1];

      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alTeclear, true);
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
      document.body.style.overflow = '';
      previo.current?.focus?.();
    };
  }, [abierto, alCerrar]);

  if (!abierto) return null;

  const anchos = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' }[ancho];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-tinta/35 p-0 backdrop-blur-[2px] sm:items-start sm:p-6 sm:pt-[6vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cn(
          'w-full animate-aparecer rounded-t-forja-lg border border-borde bg-superficie-2 shadow-forja-alto sm:rounded-forja-lg',
          anchos,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-borde px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-texto">{titulo}</h2>
            {descripcion ? (
              <p className="mt-0.5 text-sm text-texto-3">{descripcion}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 rounded-forja p-2 text-texto-4 transition-colors hover:bg-superficie-3 hover:text-texto"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 py-4">{children}</div>

        {pie ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-borde px-5 py-3.5">
            {pie}
          </div>
        ) : null}
      </div>
    </div>
  );
}
