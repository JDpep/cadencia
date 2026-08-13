'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * La casilla grande de Cadencia. Es la interacción más repetida del producto,
 * así que se optimiza: área generosa, animación breve al marcar y estado
 * optimista — la UI cambia al instante y el servidor confirma después.
 */
export function Palomear({
  hecha,
  alCambiar,
  tamano = 'md',
  etiqueta,
  className,
}: {
  hecha: boolean;
  alCambiar: (nueva: boolean) => void | Promise<void>;
  tamano?: 'sm' | 'md' | 'lg';
  etiqueta: string;
  className?: string;
}) {
  const [optimista, setOptimista] = useState<boolean | null>(null);
  const [animando, setAnimando] = useState(false);

  const marcada = optimista ?? hecha;

  const medidas = {
    sm: 'h-5 w-5 rounded-[7px]',
    md: 'h-6 w-6 rounded-[8px]',
    lg: 'h-7 w-7 rounded-[9px]',
  }[tamano];

  async function alternar(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const nueva = !marcada;
    setOptimista(nueva);
    if (nueva) {
      setAnimando(true);
      setTimeout(() => setAnimando(false), 280);
    }

    try {
      await alCambiar(nueva);
    } catch {
      setOptimista(null); // Se revierte si el servidor rechaza.
    }
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={etiqueta}
      onClick={alternar}
      className={cn(
        'group inline-flex shrink-0 items-center justify-center border-2 transition-all duration-150',
        medidas,
        marcada
          ? 'border-verde-forja bg-verde-forja text-hueso'
          : 'border-borde-2 bg-superficie-2 hover:border-verde-forja/60 hover:bg-verde-forja/10',
        animando && 'animate-palomear',
        className,
      )}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(
          'h-[62%] w-[62%] transition-opacity duration-150',
          marcada ? 'opacity-100' : 'opacity-0 group-hover:opacity-25',
        )}
        aria-hidden="true"
      >
        <path d="M4.5 10.5l3.8 3.8L15.5 6.5" />
      </svg>
    </button>
  );
}
