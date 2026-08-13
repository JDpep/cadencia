'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PuntoPrioridad } from '@/components/ui/Insignias';
import { fechaRelativa } from '@/lib/tiempo';
import type { Prioridad } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type Hallazgo =
  | { tipo: 'actividad'; id: string; titulo: string; prioridad: Prioridad; clave: string | null; cliente: string | null }
  | { tipo: 'cliente'; id: string; titulo: string; contacto: string | null };

/** Buscador global con ⌘K / Ctrl+K. Navega con ↑ ↓ y Enter. */
export function BuscadorGlobal() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const [hallazgos, setHallazgos] = useState<Hallazgo[]>([]);
  const [activo, setActivo] = useState(0);
  const [cargando, setCargando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAbierto((v) => !v);
      }
      if (e.key === 'Escape') setAbierto(false);
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  useEffect(() => {
    if (abierto) setTimeout(() => entrada.current?.focus(), 20);
    else {
      setQ('');
      setHallazgos([]);
      setActivo(0);
    }
  }, [abierto]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHallazgos([]);
      return;
    }

    const control = new AbortController();
    const t = setTimeout(async () => {
      setCargando(true);
      try {
        const r = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`, {
          signal: control.signal,
        });
        if (!r.ok) return;
        const datos = await r.json();

        setHallazgos([
          ...datos.actividades.map(
            (a: { id: string; titulo: string; prioridad: Prioridad; clave: string | null; cliente: string | null }): Hallazgo => ({
              tipo: 'actividad',
              id: a.id,
              titulo: a.titulo,
              prioridad: a.prioridad,
              clave: a.clave,
              cliente: a.cliente,
            }),
          ),
          ...datos.clientes.map(
            (c: { id: string; nombreEmpresa: string; contactoNombre: string | null }): Hallazgo => ({
              tipo: 'cliente',
              id: c.id,
              titulo: c.nombreEmpresa,
              contacto: c.contactoNombre,
            }),
          ),
        ]);
        setActivo(0);
      } catch {
        /* petición cancelada */
      } finally {
        setCargando(false);
      }
    }, 180);

    return () => {
      control.abort();
      clearTimeout(t);
    };
  }, [q]);

  function ir(h: Hallazgo) {
    setAbierto(false);
    if (h.tipo === 'cliente') router.push(`/clientes/${h.id}`);
    else router.push(`/actividades?abrir=${h.id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-2 rounded-forja border border-borde bg-superficie-2 px-3 py-2 text-sm text-texto-4 transition-colors hover:border-texto-4 hover:text-texto-3"
        aria-label="Buscar (Comando K)"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <span className="hidden lg:inline">Buscar</span>
        <kbd className="hidden rounded border border-borde bg-superficie px-1.5 py-0.5 font-sans text-[10px] text-texto-4 lg:inline">
          ⌘K
        </kbd>
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-tinta/35 p-4 pt-[12vh] backdrop-blur-[2px]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
        >
          <div className="w-full max-w-xl animate-aparecer overflow-hidden rounded-forja-lg border border-borde bg-superficie-2 shadow-forja-alto">
            <div className="flex items-center gap-3 border-b border-borde px-4">
              <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-texto-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5L14 14" strokeLinecap="round" />
              </svg>
              <input
                ref={entrada}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActivo((i) => Math.min(i + 1, hallazgos.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActivo((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && hallazgos[activo]) {
                    e.preventDefault();
                    ir(hallazgos[activo]);
                  }
                }}
                placeholder="Buscar actividades y clientes…"
                aria-label="Buscar"
                className="w-full bg-transparent py-4 text-base text-texto placeholder:text-texto-4 focus:outline-none"
              />
              {cargando ? <span className="text-xs text-texto-4">…</span> : null}
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-texto-4">
                  Escribe al menos dos letras.
                </p>
              ) : hallazgos.length === 0 && !cargando ? (
                <p className="px-3 py-6 text-center text-sm text-texto-4">
                  Nada por aquí con «{q}».
                </p>
              ) : (
                hallazgos.map((h, i) => (
                  <button
                    key={`${h.tipo}-${h.id}`}
                    type="button"
                    onMouseEnter={() => setActivo(i)}
                    onClick={() => ir(h)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-forja px-3 py-2.5 text-left transition-colors',
                      i === activo ? 'bg-superficie-3' : 'hover:bg-superficie-3',
                    )}
                  >
                    {h.tipo === 'actividad' ? (
                      <PuntoPrioridad prioridad={h.prioridad} />
                    ) : (
                      <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0 text-texto-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M1.5 10.5V3.2L6 1.5v9M6 10.5h4.5V5L6 3.7" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-texto">{h.titulo}</span>
                      <span className="block truncate text-xs text-texto-4">
                        {h.tipo === 'actividad'
                          ? [h.clave ? fechaRelativa(h.clave) : 'sin fecha', h.cliente]
                              .filter(Boolean)
                              .join(' · ')
                          : (h.contacto ?? 'Cliente')}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-texto-4">
                      {h.tipo}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
