import Link from 'next/link';
import { NOMBRES_MES_LARGO } from '@/lib/vacantes';
import { cn } from '@/lib/utils';

type Resumen = {
  anio: number;
  mes: number;
  total: number;
  totalAnio: number;
  porPersona: { id: string; nombre: string; total: number }[];
};

/**
 * Vacantes del mes para el Panorama de Dirección.
 *
 * Es agregado puro —cuántas y de quién—, coherente con la regla del Panorama:
 * cifras sí, detalle de la actividad ajena no.
 */
export function ResumenVacantes({ resumen }: { resumen: Resumen }) {
  const maximo = Math.max(1, ...resumen.porPersona.map((p) => p.total));

  return (
    <section className="tarjeta p-4 shadow-forja">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-texto">
            Vacantes de <span className="capitalize">{NOMBRES_MES_LARGO[resumen.mes - 1]}</span>
          </h2>
          <p className="mt-0.5 text-xs text-texto-4">
            Entrevistas completadas · {resumen.totalAnio} en {resumen.anio}
          </p>
        </div>
        <Link
          href="/vacantes"
          className="text-xs text-terracota underline underline-offset-2"
        >
          Ver histórico
        </Link>
      </div>

      <p className="mt-2 text-3xl font-semibold tabular-nums text-terracota">
        {resumen.total}
      </p>

      {resumen.porPersona.length === 0 ? (
        <p className="mt-2 text-sm text-texto-4">
          Nadie ha completado entrevistas este mes.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {resumen.porPersona.map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-texto-2">{p.nombre}</span>
                <span className="tabular-nums text-texto-4">{p.total}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-superficie-3">
                <div
                  className={cn('h-full rounded-full bg-terracota transition-all duration-500')}
                  style={{ width: `${(p.total / maximo) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
