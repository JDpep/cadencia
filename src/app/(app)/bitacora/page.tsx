import { requerirSesion } from '@/lib/auth/guard';
import { listarBitacora, puedeVerTodaLaBitacora } from '@/lib/repos/bitacora';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio';
import { fmt } from '@/lib/tiempo';

export const dynamic = 'force-dynamic';

const ETIQUETA_ENTIDAD: Record<string, string> = {
  activity: 'Actividad',
  occurrence: 'Ocurrencia',
  client: 'Cliente',
  user: 'Usuario',
  category: 'Categoría',
  holiday: 'Festivo',
  setting: 'Ajuste',
  sistema: 'Sistema',
};

export default async function PaginaBitacora() {
  const usuario = await requerirSesion();
  const registros = await listarBitacora(usuario);
  const completa = puedeVerTodaLaBitacora(usuario);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold text-texto">Bitácora</h1>
        <p className="mt-1 text-sm text-texto-3">
          {completa
            ? 'Movimientos de toda la organización, del más reciente al más antiguo.'
            : 'Tus propios movimientos, del más reciente al más antiguo.'}
        </p>
      </header>

      {registros.length === 0 ? (
        <p className="tarjeta px-4 py-12 text-center text-sm text-texto-4">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <div className="tarjeta overflow-hidden shadow-forja">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-4">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Cuándo</th>
                  {completa ? (
                    <th scope="col" className="px-3 py-2.5 font-semibold">Quién</th>
                  ) : null}
                  <th scope="col" className="px-3 py-2.5 font-semibold">Qué</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Sobre</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-borde last:border-b-0 hover:bg-superficie-3/50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-texto-4">
                      {fmt(r.createdAt, "d MMM yyyy · HH:mm")}
                    </td>

                    {completa ? (
                      <td className="px-3 py-2.5">
                        <span className="block text-texto-2">{r.actor.nombre}</span>
                        <span className="block text-[11px] text-texto-4">
                          {ETIQUETA_ROL[r.actor.rol as Rol] ?? r.actor.rol}
                        </span>
                      </td>
                    ) : null}

                    <td className="px-3 py-2.5">
                      <code className="rounded bg-superficie-3 px-1.5 py-0.5 text-[11px] text-texto-2">
                        {r.accion}
                      </code>
                    </td>

                    <td className="px-3 py-2.5 text-texto-3">
                      {ETIQUETA_ENTIDAD[r.entidad] ?? r.entidad}
                    </td>

                    <td className="max-w-sm px-4 py-2.5">
                      <span className="block truncate text-xs text-texto-4" title={r.despues ?? r.antes ?? ''}>
                        {resumir(r.despues ?? r.antes)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/** Muestra lo esencial del JSON sin llenar la pantalla de llaves. */
function resumir(json: string | null): string {
  if (!json) return '—';
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const interesa = ['titulo', 'nombreEmpresa', 'nombre', 'estado', 'email', 'clave', 'activada'];

    const partes = interesa
      .filter((k) => o[k] !== undefined && o[k] !== null)
      .map((k) => `${k}: ${String(o[k])}`);

    return partes.length ? partes.join(' · ') : json.slice(0, 90);
  } catch {
    return json.slice(0, 90);
  }
}
