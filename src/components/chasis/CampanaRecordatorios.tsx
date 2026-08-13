'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  accionDescartarRecordatorio,
  accionDescartarTodos,
  accionPosponerRecordatorio,
} from '@/lib/acciones/recordatorios';
import { MINUTOS_POSPONER } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type Recordatorio = {
  id: string;
  titulo: string;
  cuerpo: string | null;
  programadaPara: string;
  activityId: string | null;
  claveObjetivo: string | null;
};

type Bandeja = { vencidos: Recordatorio[]; proximos: Recordatorio[]; total: number };

const VACIA: Bandeja = { vencidos: [], proximos: [], total: 0 };

/** Cada cuánto se pregunta al servidor. Un minuto es la resolución del aviso. */
const INTERVALO_MS = 60_000;

/**
 * Campana de recordatorios.
 *
 * Consulta `/api/recordatorios` cada minuto y al volver a la pestaña. Los avisos
 * los materializa el servidor (`Notification`); aquí sólo se muestran, se
 * posponen o se despachan.
 */
export function CampanaRecordatorios() {
  const router = useRouter();
  const [bandeja, setBandeja] = useState<Bandeja>(VACIA);
  const [abierta, setAbierta] = useState(false);
  const [ocupado, iniciar] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch('/api/recordatorios', { cache: 'no-store' });
      if (!r.ok) return;
      setBandeja((await r.json()) as Bandeja);
    } catch {
      // Sin red o servidor reiniciándose: se reintenta en el siguiente ciclo.
    }
  }, []);

  // Sondeo periódico + al recuperar el foco de la pestaña.
  useEffect(() => {
    consultar();
    const t = setInterval(consultar, INTERVALO_MS);

    function alVolver() {
      if (document.visibilityState === 'visible') consultar();
    }
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);

    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [consultar]);

  // Cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!abierta) return;

    function alClicFuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false);
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierta(false);
    }

    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierta]);

  function despues(fn: () => Promise<unknown>) {
    iniciar(async () => {
      await fn();
      await consultar();
      router.refresh();
    });
  }

  const { vencidos, proximos } = bandeja;
  const hayAlgo = vencidos.length > 0 || proximos.length > 0;

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-haspopup="menu"
        aria-label={
          vencidos.length
            ? `Recordatorios: ${vencidos.length} por atender`
            : 'Recordatorios'
        }
        title="Recordatorios"
        className={cn(
          'relative rounded-forja border bg-superficie-2 p-2 transition-colors',
          vencidos.length
            ? 'border-terracota/50 text-terracota'
            : 'border-borde text-texto-3 hover:border-texto-4 hover:text-texto',
        )}
      >
        <svg
          viewBox="0 0 20 20"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path
            d="M15.2 13.5V9a5.2 5.2 0 1 0-10.4 0v4.5L3.5 15.2h13z"
            strokeLinejoin="round"
          />
          <path d="M8.1 17.4a2 2 0 0 0 3.8 0" strokeLinecap="round" />
        </svg>

        {vencidos.length > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracota px-1 text-[10px] font-bold tabular-nums text-hueso">
            {vencidos.length > 9 ? '9+' : vencidos.length}
          </span>
        ) : null}
      </button>

      {abierta ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-aparecer overflow-hidden rounded-forja border border-borde bg-superficie-2 shadow-forja-alto"
        >
          <div className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-sm font-semibold text-texto">Recordatorios</h2>
            {vencidos.length > 0 ? (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => despues(accionDescartarTodos)}
                className="text-xs text-texto-3 underline underline-offset-2 transition-colors hover:text-terracota disabled:opacity-50"
              >
                Descartar todos
              </button>
            ) : null}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {!hayAlgo ? (
              <p className="px-4 py-10 text-center text-sm text-texto-4">
                Nada que recordarte por ahora.
              </p>
            ) : null}

            {vencidos.map((r) => (
              <article
                key={r.id}
                className="border-b border-borde px-4 py-3 last:border-b-0"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-terracota"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <Enlace r={r} alNavegar={() => setAbierta(false)}>
                      {r.titulo}
                    </Enlace>
                    <p className="mt-0.5 truncate text-xs text-texto-4">{r.cuerpo}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-terracota">
                      {relativo(r.programadaPara)}
                    </p>

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() =>
                          despues(() =>
                            accionPosponerRecordatorio(r.id, MINUTOS_POSPONER),
                          )
                        }
                        className="rounded-[9px] border border-borde px-2 py-1 text-xs text-texto-3 transition-colors hover:border-texto-4 hover:text-texto disabled:opacity-50"
                      >
                        Posponer {MINUTOS_POSPONER} min
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => despues(() => accionDescartarRecordatorio(r.id))}
                        className="rounded-[9px] bg-superficie-3 px-2 py-1 text-xs font-medium text-texto-2 transition-colors hover:bg-terracota hover:text-hueso disabled:opacity-50"
                      >
                        Listo
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}

            {proximos.length > 0 ? (
              <div className="bg-superficie px-4 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-texto-4">
                  Por venir
                </p>
              </div>
            ) : null}

            {proximos.map((r) => (
              <article
                key={r.id}
                className="border-b border-borde px-4 py-2.5 last:border-b-0"
              >
                <Enlace r={r} alNavegar={() => setAbierta(false)}>
                  {r.titulo}
                </Enlace>
                <p className="mt-0.5 truncate text-xs text-texto-4">
                  {r.cuerpo} · avisa {relativo(r.programadaPara)}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** El aviso lleva al día en que la actividad cae de verdad. */
function Enlace({
  r,
  alNavegar,
  children,
}: {
  r: Recordatorio;
  alNavegar: () => void;
  children: React.ReactNode;
}) {
  const destino = r.claveObjetivo
    ? `/agenda?vista=dia&fecha=${r.claveObjetivo}`
    : '/actividades';

  return (
    <Link
      href={destino}
      onClick={alNavegar}
      className="block truncate text-sm font-medium text-texto transition-colors hover:text-terracota"
    >
      {children}
    </Link>
  );
}

/** «hace 5 min», «en 2 h». Se calcula en el cliente: el reloj es el del usuario. */
function relativo(iso: string): string {
  const dif = Date.parse(iso) - Date.now();
  const min = Math.round(Math.abs(dif) / 60_000);

  let texto: string;
  if (min < 1) texto = 'ahora mismo';
  else if (min < 60) texto = `${min} min`;
  else if (min < 60 * 24) texto = `${Math.round(min / 60)} h`;
  else texto = `${Math.round(min / (60 * 24))} d`;

  if (texto === 'ahora mismo') return texto;
  return dif < 0 ? `hace ${texto}` : `en ${texto}`;
}
