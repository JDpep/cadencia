import Link from 'next/link';
import { requerirSesion } from '@/lib/auth/guard';
import { resumenDashboard } from '@/lib/repos/dashboard';
import { panoramaOrganizacional } from '@/lib/repos/panorama';
import { vacantesDelMes } from '@/lib/repos/vacantes';
import { FilaAgenda } from '@/components/agenda/FilaAgenda';
import { TablaPanorama } from '@/components/panorama/TablaPanorama';
import { ResumenVacantes } from '@/components/vacantes/ResumenVacantes';
import {
  ESTILO_PRIORIDAD,
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  type Estado,
} from '@/lib/dominio';
import { fechaRelativa, fmtClave, hoyClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PaginaInicio() {
  const usuario = await requerirSesion();

  // Dirección entra directo a su Panorama de lectura.
  if (usuario.rol === 'direccion') {
    const [panorama, vacantes] = await Promise.all([
      panoramaOrganizacional(usuario),
      vacantesDelMes(usuario),
    ]);

    return (
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-texto">Panorama</h1>
            <p className="mt-1 text-sm text-texto-3">
              Carga por persona · semana del {fmtClave(panorama.semanaDe, "d 'de' MMMM")}. Vista
              de lectura: el detalle de cada actividad es privado.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/vacantes" className="btn-secundario">
              Histórico de vacantes
            </Link>
            <Link href="/ausencias" className="btn-secundario">
              Ausencias del equipo
            </Link>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            <TablaPanorama datos={panorama} />
          </div>
          <ResumenVacantes resumen={vacantes} />
        </div>
      </div>
    );
  }

  const r = await resumenDashboard(usuario);
  const hoy = hoyClave();
  const maxDistribucion = Math.max(1, ...r.distribucion.map((d) => d.abiertas));
  const primerNombre = usuario.nombre.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Saludo + accesos rápidos */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-texto-4">
            {fmtClave(hoy, "EEEE d 'de' MMMM")}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-texto">
            Buen día, {primerNombre}
          </h1>
          <p className="editorial mt-1.5 text-base text-texto-3">
            {r.hoy.length === 0
              ? 'Hoy tienes la agenda despejada.'
              : `Hoy te tocan ${r.hoy.length} ${r.hoy.length === 1 ? 'actividad' : 'actividades'}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/actividades" className="btn-primario">
            Nueva actividad
          </Link>
          <Link href="/agenda" className="btn-secundario">
            Ir a mi agenda
          </Link>
          <Link href="/clientes" className="btn-secundario">
            Mis clientes
          </Link>
          <Link href="/vacaciones" className="btn-secundario">
            Solicitar vacaciones
          </Link>
        </div>
      </header>

      {/* Resumen del día */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          etiqueta="Avance total"
          valor={`${r.avance}%`}
          detalle={`${r.conteos.hecha} hechas de ${r.conteos.hecha + r.totalAbiertas}`}
          barra={r.avance}
        />
        {(['por_hacer', 'en_proceso', 'hecha'] as Estado[]).map((e) => (
          <Tarjeta
            key={e}
            etiqueta={ETIQUETA_ESTADO[e]}
            valor={String(r.conteos[e])}
            detalle={
              e === 'por_hacer' && r.sinFecha > 0 ? `${r.sinFecha} sin fecha` : undefined
            }
            acento={e === 'hecha' ? 'verde' : undefined}
          />
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Hoy */}
        <section className="tarjeta shadow-forja lg:col-span-2">
          <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-base font-semibold text-texto">
              Hoy
              <span className="ml-2 text-xs font-normal text-texto-4">
                ordenadas por prioridad
              </span>
            </h2>
            <span className="text-xs text-texto-4">{r.hoy.length}</span>
          </header>

          {r.hoy.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-texto-4">
              Nada agendado para hoy.{' '}
              <Link href="/actividades" className="text-terracota underline underline-offset-2">
                Agrega una actividad
              </Link>
              .
            </p>
          ) : (
            <ul className="px-4 py-1">
              {r.hoy.map((i) => (
                <FilaAgenda key={i.llave} item={i} />
              ))}
            </ul>
          )}
        </section>

        {/* Distribución por prioridad */}
        <section className="tarjeta p-4 shadow-forja">
          <h2 className="text-base font-semibold text-texto">Distribución por prioridad</h2>
          <p className="mt-0.5 text-xs text-texto-4">Actividades abiertas</p>

          <ul className="mt-4 space-y-3">
            {r.distribucion.map((d) => (
              <li key={d.prioridad}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      'font-medium',
                      d.prioridad === 'urgente' ? 'text-terracota' : 'text-texto-2',
                    )}
                  >
                    {ETIQUETA_PRIORIDAD[d.prioridad]}
                  </span>
                  <span className="tabular-nums text-texto-4">{d.abiertas}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-superficie-3">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      ESTILO_PRIORIDAD[d.prioridad].barra,
                    )}
                    style={{ width: `${(d.abiertas / maxDistribucion) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* Recordatorios */}
          <div className="mt-5 border-t border-borde pt-4">
            <h3 className="text-sm font-semibold text-texto">Recordatorios de hoy</h3>
            {r.recordatorios.length === 0 ? (
              <p className="mt-2 text-xs text-texto-4">Sin actividades con hora pendiente.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {r.recordatorios.map((i) => (
                  <li key={i.llave} className="flex items-baseline gap-2 text-sm">
                    <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-terracota">
                      {i.hora}
                    </span>
                    <span className="truncate text-texto-2">{i.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Vencidas */}
        <section className="tarjeta shadow-forja">
          <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-base font-semibold text-terracota">Vencidas</h2>
            <span className="text-xs text-texto-4">{r.vencidas.length}</span>
          </header>

          {r.vencidas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-texto-4">
              Nada vencido. Bien ahí.
            </p>
          ) : (
            <ul className="px-4 py-1">
              {r.vencidas.map((i) => (
                <FilaAgenda key={i.llave} item={i} destacarAtraso diasAtraso={i.diasAtraso} />
              ))}
            </ul>
          )}
        </section>

        {/* Próximas */}
        <section className="tarjeta shadow-forja">
          <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-base font-semibold text-texto">Próximas</h2>
            <span className="text-xs text-texto-4">siguientes 7 días</span>
          </header>

          {r.proximas.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-texto-4">
              Nada agendado esta semana.
            </p>
          ) : (
            <ul className="px-4 py-1">
              {r.proximas.map((i) => (
                <FilaAgenda key={i.llave} item={i} mostrarFecha etiquetaFecha={fechaRelativa(i.clave)} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  barra,
  acento,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  barra?: number;
  acento?: 'verde';
}) {
  return (
    <div className="tarjeta p-4 shadow-forja">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-4">{etiqueta}</p>
      <p
        className={cn(
          'mt-1.5 text-3xl font-semibold tabular-nums',
          acento === 'verde' ? 'text-verde-forja' : 'text-texto',
        )}
      >
        {valor}
      </p>
      {detalle ? <p className="mt-0.5 text-xs text-texto-4">{detalle}</p> : null}
      {barra !== undefined ? (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-superficie-3">
          <div
            className="h-full rounded-full bg-verde-forja transition-all duration-500"
            style={{ width: `${barra}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
