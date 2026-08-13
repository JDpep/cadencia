import { ETIQUETA_ROL, type Rol } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type Fila = {
  id: string;
  nombre: string;
  email: string;
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
 * Carga por persona. Sólo agregados: aquí no se lee ni un título de actividad.
 * El terracota se reserva para lo que realmente importa (vencidas y urgentes).
 */
export function TablaPanorama({
  datos,
}: {
  datos: {
    filas: Fila[];
    totales: {
      abiertas: number;
      hechas: number;
      vencidas: number;
      urgentes: number;
      hechasSemana: number;
      clientes: number;
    };
    semanaDe: string;
  };
}) {
  const { filas, totales } = datos;
  const maxAbiertas = Math.max(1, ...filas.map((f) => f.abiertas));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra etiqueta="Abiertas" valor={totales.abiertas} />
        <Cifra etiqueta="Vencidas" valor={totales.vencidas} alerta={totales.vencidas > 0} />
        <Cifra etiqueta="Urgentes abiertas" valor={totales.urgentes} alerta={totales.urgentes > 0} />
        <Cifra etiqueta="Hechas esta semana" valor={totales.hechasSemana} verde />
      </section>

      <section className="tarjeta overflow-hidden shadow-forja">
        <header className="border-b border-borde px-4 py-3">
          <h2 className="text-base font-semibold text-texto">Carga por persona</h2>
          <p className="mt-0.5 text-xs text-texto-4">
            Sólo cifras agregadas — el detalle de cada actividad sigue siendo privado.
          </p>
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-4">
                <th scope="col" className="px-4 py-2.5 font-semibold">Persona</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Carga abierta</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Vencidas</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Urgentes</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Hechas</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Semana</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Clientes</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-borde last:border-b-0 hover:bg-superficie-3/50">
                  <td className="px-4 py-3">
                    <span className="block font-medium text-texto">{f.nombre}</span>
                    <span className="block text-xs text-texto-4">
                      {f.puesto ?? ETIQUETA_ROL[f.rol as Rol] ?? f.rol}
                    </span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-superficie-3">
                        <div
                          className="h-full rounded-full bg-texto-4"
                          style={{ width: `${(f.abiertas / maxAbiertas) * 100}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-texto-2">{f.abiertas}</span>
                    </div>
                  </td>

                  <td
                    className={cn(
                      'px-3 py-3 text-right tabular-nums',
                      f.vencidas > 0 ? 'font-semibold text-terracota' : 'text-texto-4',
                    )}
                  >
                    {f.vencidas}
                  </td>

                  <td
                    className={cn(
                      'px-3 py-3 text-right tabular-nums',
                      f.urgentes > 0 ? 'font-semibold text-terracota' : 'text-texto-4',
                    )}
                  >
                    {f.urgentes}
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums text-texto-3">{f.hechas}</td>

                  <td className="px-3 py-3 text-right">
                    <span className="tabular-nums text-verde-forja">{f.hechasSemana}</span>
                    <span className="ml-1.5 text-xs text-texto-4">{f.cumplimiento}%</span>
                  </td>

                  <td className="px-4 py-3 text-right tabular-nums text-texto-3">{f.clientes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Cifra({
  etiqueta,
  valor,
  alerta,
  verde,
}: {
  etiqueta: string;
  valor: number;
  alerta?: boolean;
  verde?: boolean;
}) {
  return (
    <div className="tarjeta p-4 shadow-forja">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-4">{etiqueta}</p>
      <p
        className={cn(
          'mt-1.5 text-3xl font-semibold tabular-nums',
          alerta ? 'text-terracota' : verde ? 'text-verde-forja' : 'text-texto',
        )}
      >
        {valor}
      </p>
    </div>
  );
}
