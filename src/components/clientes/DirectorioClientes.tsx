'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FichaCliente, type ClienteEditable } from './FichaCliente';
import { CADENCIA_NOMINA, ETIQUETA_NOMINA } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type ClienteFila = ClienteEditable & {
  ownerUserId: string;
  ownerNombre?: string;
  actividadesAbiertas?: number;
};

export function DirectorioClientes({
  clientes,
  usuarioId,
  puedeCrear,
  verDeOtros,
  privacidadTotal,
}: {
  clientes: ClienteFila[];
  usuarioId: string;
  puedeCrear: boolean;
  verDeOtros: boolean;
  privacidadTotal: boolean;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [ficha, setFicha] = useState<{ abierta: boolean; cliente: ClienteEditable | null }>({
    abierta: false,
    cliente: null,
  });

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((c) =>
      [c.nombreEmpresa, c.contactoNombre, c.correo, c.telefono]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [clientes, busqueda]);

  const propios = filtrados.filter((c) => c.ownerUserId === usuarioId).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">
            {verDeOtros ? 'Directorio de clientes' : 'Mis clientes'}
          </h1>
          <p className="mt-1 text-sm text-texto-3">
            {verDeOtros
              ? `${clientes.length} en el directorio · ${propios} tuyos`
              : `${clientes.length} en tu cartera · sólo tú los ves`}
          </p>
        </div>

        {puedeCrear ? (
          <button
            type="button"
            onClick={() => setFicha({ abierta: true, cliente: null })}
            className="btn-primario"
          >
            Nuevo cliente
          </button>
        ) : null}
      </header>

      {privacidadTotal ? (
        <p className="rounded-forja border border-ocre/40 bg-ocre/15 px-3 py-2 text-sm text-texto-2">
          Privacidad total activada: cada quien ve únicamente su propia cartera, incluidas
          Administración y Dirección.
        </p>
      ) : null}

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por empresa, contacto, correo o teléfono…"
        aria-label="Buscar clientes"
        className="campo max-w-lg"
      />

      {filtrados.length === 0 ? (
        <div className="tarjeta px-4 py-12 text-center">
          <p className="text-sm text-texto-3">
            {clientes.length === 0
              ? 'Tu cartera está vacía.'
              : `Nada que coincida con «${busqueda}».`}
          </p>
          {puedeCrear && clientes.length === 0 ? (
            <button
              type="button"
              onClick={() => setFicha({ abierta: true, cliente: null })}
              className="btn-secundario mt-3"
            >
              Dar de alta el primero
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((c) => {
            const esMio = c.ownerUserId === usuarioId;
            return (
              <li key={c.id} className="tarjeta group flex flex-col p-4 shadow-forja transition-colors hover:border-texto-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/clientes/${c.id}`}
                    className="min-w-0 flex-1 text-base font-semibold leading-snug text-texto hover:text-terracota"
                  >
                    {c.nombreEmpresa}
                  </Link>
                  {esMio ? (
                    <button
                      type="button"
                      onClick={() => setFicha({ abierta: true, cliente: c })}
                      aria-label={`Editar ${c.nombreEmpresa}`}
                      className="shrink-0 rounded p-1 text-texto-4 opacity-0 transition-opacity hover:text-terracota focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {c.contactoNombre ? (
                  <p className="mt-1 text-sm text-texto-3">{c.contactoNombre}</p>
                ) : null}

                <dl className="mt-2.5 space-y-1 text-xs text-texto-4">
                  {c.correo ? (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Correo</dt>
                      <dd className="truncate">
                        <a href={`mailto:${c.correo}`} className="hover:text-terracota">
                          {c.correo}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {c.telefono ? (
                    <div className="flex items-center gap-1.5">
                      <dt className="sr-only">Teléfono</dt>
                      <dd>
                        <a href={`tel:${c.telefono.replace(/\s/g, '')}`} className="hover:text-terracota">
                          {c.telefono}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3 text-[11px]">
                  {c.periodicidadNomina ? (
                    <span
                      title={`Nómina ${CADENCIA_NOMINA[c.periodicidadNomina]}`}
                      className="rounded-full border border-verde-forja/30 bg-verde-forja/10 px-2 py-0.5 font-medium text-verde-forja"
                    >
                      Nómina {ETIQUETA_NOMINA[c.periodicidadNomina].toLowerCase()}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5',
                      (c.actividadesAbiertas ?? 0) > 0
                        ? 'border-borde bg-superficie text-texto-3'
                        : 'border-borde bg-superficie text-texto-4',
                    )}
                  >
                    {c.actividadesAbiertas ?? 0} abiertas
                  </span>

                  {verDeOtros && !esMio && c.ownerNombre ? (
                    <span className="rounded-full border border-borde bg-superficie px-2 py-0.5 text-texto-4">
                      {c.ownerNombre}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FichaCliente
        abierta={ficha.abierta}
        alCerrar={() => setFicha({ abierta: false, cliente: null })}
        cliente={ficha.cliente}
      />
    </div>
  );
}
