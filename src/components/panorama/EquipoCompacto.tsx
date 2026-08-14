import Link from 'next/link';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type Fila = {
  id: string;
  nombre: string;
  rol: string;
  puesto: string | null;
  abiertas: number;
  hechas: number;
  vencidas: number;
  urgentes: number;
  hechasSemana: number;
  clientes: number;
  cumplimiento: number;
};

/**
 * El equipo de un vistazo, para el dashboard de Administración.
 *
 * Una fila por persona en vez de una tabla ancha: cabe más en menos alto y no
 * obliga a desplazarse en horizontal. La versión completa, con todas las
 * columnas, sigue en /panorama.
 *
 * Sólo cifras agregadas. El detalle de una actividad ajena no se abre desde
 * aquí ni desde ningún lado: es privado incluso para Administración.
 */
export function EquipoCompacto({ filas }: { filas: Fila[] }) {
  const maxAbiertas = Math.max(1, ...filas.map((f) => f.abiertas));

  // Quien trae más encima, arriba: vencidas y urgentes pesan más que el volumen.
  const orden = [...filas].sort(
    (a, b) =>
      b.vencidas * 100 + b.urgentes * 10 + b.abiertas -
      (a.vencidas * 100 + a.urgentes * 10 + a.abiertas),
  );

  return (
    <section className="tarjeta overflow-hidden shadow-forja">
      <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-texto">Equipo</h2>
          <p className="text-[11px] text-texto-4">
            Carga por persona · el detalle de cada actividad es privado
          </p>
        </div>
        <Link
          href="/panorama"
          className="shrink-0 text-xs text-terracota underline underline-offset-2"
        >
          Panorama
        </Link>
      </header>

      {orden.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-texto-4">
          No hay ejecutivos activos todavía.
        </p>
      ) : (
        <ul className="divide-y divide-borde">
          {orden.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 transition-colors hover:bg-superficie-3/40"
            >
              {/* Persona */}
              <div className="min-w-[9rem] flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-texto">
                  {f.nombre}
                </span>
                <span className="block truncate text-[11px] leading-tight text-texto-4">
                  {f.puesto ?? ETIQUETA_ROL[f.rol as Rol] ?? f.rol}
                </span>
              </div>

              {/* Carga abierta */}
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-superficie-3">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      f.vencidas > 0 ? 'bg-terracota' : 'bg-texto-4',
                    )}
                    style={{ width: `${(f.abiertas / maxAbiertas) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-sm tabular-nums text-texto-2">
                  {f.abiertas}
                </span>
              </div>

              {/* Señales — sólo aparecen cuando hay algo que mirar */}
              <div className="flex w-[8.5rem] shrink-0 justify-end gap-1.5">
                {f.vencidas > 0 ? (
                  <Señal texto={`${f.vencidas} vencida${f.vencidas === 1 ? '' : 's'}`} alerta />
                ) : null}
                {f.urgentes > 0 ? <Señal texto={`${f.urgentes} urgente${f.urgentes === 1 ? '' : 's'}`} /> : null}
                {f.vencidas === 0 && f.urgentes === 0 ? (
                  <span className="text-[11px] text-texto-4">al día</span>
                ) : null}
              </div>

              {/* Cumplimiento de la semana */}
              <div className="w-16 shrink-0 text-right">
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    f.cumplimiento >= 50 ? 'text-verde-forja' : 'text-texto-3',
                  )}
                >
                  {f.cumplimiento}%
                </span>
                <span className="block text-[10px] leading-tight text-texto-4">semana</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Señal({ texto, alerta }: { texto: string; alerta?: boolean }) {
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium',
        alerta
          ? 'border-terracota/35 bg-terracota/10 text-terracota'
          : 'border-ocre/40 bg-ocre/15 text-texto-2',
      )}
    >
      {texto}
    </span>
  );
}
