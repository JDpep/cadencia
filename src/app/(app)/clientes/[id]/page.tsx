import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ErrorPermiso, requerirSesion } from '@/lib/auth/guard';
import { obtenerCliente } from '@/lib/repos/clientes';
import { listarActividades } from '@/lib/repos/actividades';
import { ejecutivosActivos } from '@/lib/repos/usuarios';
import {
  BotonEditarCliente,
  TraspasoCartera,
} from '@/components/clientes/AccionesCliente';
import { PildoraPrioridad, ChipCategoria } from '@/components/ui/Insignias';
import {
  CADENCIA_NOMINA,
  esPeriodicidadNomina,
  ETIQUETA_ESTADO,
  ETIQUETA_NOMINA,
  type Estado,
  type PeriodicidadNomina,
} from '@/lib/dominio';
import { fechaRelativa } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** SQLite guarda texto suelto; se valida antes de darlo por bueno. */
const nominaDe = (v: string | null): PeriodicidadNomina | null =>
  esPeriodicidadNomina(v) ? v : null;

export default async function PaginaCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await requerirSesion();

  let cliente;
  try {
    cliente = await obtenerCliente(usuario, id);
  } catch (e) {
    if (e instanceof ErrorPermiso) return <SinPermiso mensaje={e.message} />;
    throw e;
  }

  if (!cliente) notFound();

  const esMio = cliente.ownerUserId === usuario.id;

  // Las actividades son privadas: sólo se listan las del propio usuario.
  const actividades = esMio ? await listarActividades(usuario, { clientId: id }) : [];
  const ejecutivos = usuario.rol === 'admin' ? await ejecutivosActivos() : [];

  const abiertas = actividades.filter((a) => a.estado !== 'hecha');
  const hechas = actividades.filter((a) => a.estado === 'hecha');

  return (
    <div className="space-y-6">
      <nav className="text-sm">
        <Link href="/clientes" className="text-texto-4 hover:text-terracota">
          ← Clientes
        </Link>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">{cliente.nombreEmpresa}</h1>
          <p className="mt-1 text-sm text-texto-3">
            {esMio ? 'En tu cartera' : `Cartera de ${cliente.owner.nombre}`}
          </p>
        </div>

        {esMio || usuario.rol === 'admin' ? (
          <BotonEditarCliente
            cliente={{
              id: cliente.id,
              nombreEmpresa: cliente.nombreEmpresa,
              correo: cliente.correo,
              contactoNombre: cliente.contactoNombre,
              telefono: cliente.telefono,
              periodicidadNomina: nominaDe(cliente.periodicidadNomina),
              notas: cliente.notas,
            }}
          />
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        {/* Datos */}
        <div className="space-y-4">
          <section className="tarjeta p-4 shadow-forja">
            <h2 className="text-sm font-semibold text-texto">Datos de contacto</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Dato etiqueta="Contacto" valor={cliente.contactoNombre} />
              <Dato
                etiqueta="Correo"
                valor={cliente.correo}
                enlace={cliente.correo ? `mailto:${cliente.correo}` : undefined}
              />
              <Dato
                etiqueta="Teléfono"
                valor={cliente.telefono}
                enlace={cliente.telefono ? `tel:${cliente.telefono.replace(/\s/g, '')}` : undefined}
              />
              <Dato
                etiqueta="Nómina"
                valor={
                  nominaDe(cliente.periodicidadNomina)
                    ? `${ETIQUETA_NOMINA[nominaDe(cliente.periodicidadNomina)!]} · ${
                        CADENCIA_NOMINA[nominaDe(cliente.periodicidadNomina)!]
                      }`
                    : null
                }
              />
            </dl>
          </section>

          {cliente.notas ? (
            <section className="tarjeta p-4 shadow-forja">
              <h2 className="text-sm font-semibold text-texto">Notas</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-texto-3">
                {cliente.notas}
              </p>
            </section>
          ) : null}

          {usuario.rol === 'admin' && ejecutivos.length ? (
            <TraspasoCartera
              clienteId={cliente.id}
              ownerActual={cliente.ownerUserId}
              ejecutivos={ejecutivos}
            />
          ) : null}
        </div>

        {/* Actividades vinculadas */}
        <section className="tarjeta overflow-hidden shadow-forja">
          <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-base font-semibold text-texto">Actividades vinculadas</h2>
            <span className="text-xs text-texto-4">
              {abiertas.length} abiertas · {hechas.length} hechas
            </span>
          </header>

          {!esMio ? (
            <p className="px-4 py-10 text-center text-sm text-texto-4">
              Las actividades de {cliente.owner.nombre} son privadas. Aquí sólo se ve la ficha
              del cliente.
            </p>
          ) : actividades.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-texto-4">
              Todavía no hay actividades vinculadas a este cliente.{' '}
              <Link href="/actividades" className="text-terracota underline underline-offset-2">
                Crear una
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {[...abiertas, ...hechas].map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'mt-1 h-2 w-2 shrink-0 rounded-full',
                      a.estado === 'hecha'
                        ? 'bg-verde-forja'
                        : a.estado === 'en_proceso'
                          ? 'bg-ocre'
                          : 'bg-texto-4',
                    )}
                    title={ETIQUETA_ESTADO[a.estado as Estado]}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        a.estado === 'hecha' ? 'text-texto-4 line-through' : 'text-texto',
                      )}
                    >
                      {a.titulo}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <PildoraPrioridad prioridad={a.prioridad} />
                      {a.categoria ? (
                        <ChipCategoria
                          nombre={a.categoria.nombre}
                          colorToken={a.categoria.colorToken}
                          icono={a.categoria.icono}
                        />
                      ) : null}
                      {a.clave ? (
                        <span className="text-[11px] text-texto-4">
                          {fechaRelativa(a.clave)}
                          {a.hora ? ` · ${a.hora}` : ''}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  enlace,
}: {
  etiqueta: string;
  valor: string | null;
  enlace?: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-texto-4">{etiqueta}</dt>
      <dd className="mt-0.5 text-texto-2">
        {valor ? (
          enlace ? (
            <a href={enlace} className="hover:text-terracota">
              {valor}
            </a>
          ) : (
            valor
          )
        ) : (
          <span className="text-texto-4">—</span>
        )}
      </dd>
    </div>
  );
}

function SinPermiso({ mensaje }: { mensaje: string }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-firma text-terracota">Error 403</p>
      <h1 className="mt-2 text-2xl font-semibold text-texto">Sin acceso</h1>
      <p className="mt-2 text-sm text-texto-3">{mensaje}</p>
      <Link href="/clientes" className="btn-secundario mt-5">
        Volver a mis clientes
      </Link>
    </div>
  );
}
