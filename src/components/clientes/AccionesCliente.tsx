'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FichaCliente, type ClienteEditable } from './FichaCliente';
import { accionReasignarCliente } from '@/lib/acciones/clientes';

export function BotonEditarCliente({ cliente }: { cliente: ClienteEditable }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className="btn-secundario">
        Editar
      </button>
      <FichaCliente abierta={abierta} alCerrar={() => setAbierta(false)} cliente={cliente} />
    </>
  );
}

/** Traspaso de cartera. Sólo se muestra a Admin; el servidor lo vuelve a validar. */
export function TraspasoCartera({
  clienteId,
  ownerActual,
  ejecutivos,
}: {
  clienteId: string;
  ownerActual: string;
  ejecutivos: { id: string; nombre: string; email: string }[];
}) {
  const router = useRouter();
  const [destino, setDestino] = useState(ownerActual);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function traspasar() {
    if (destino === ownerActual) return;

    const nombre = ejecutivos.find((e) => e.id === destino)?.nombre ?? 'ese ejecutivo';
    if (
      !confirm(
        `¿Traspasar este cliente a ${nombre}? Las actividades vinculadas se desvincularán, porque pertenecen a otra persona.`,
      )
    ) {
      return;
    }

    iniciar(async () => {
      const r = await accionReasignarCliente(clienteId, destino);
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="tarjeta p-4">
      <h2 className="text-sm font-semibold text-texto">Traspaso de cartera</h2>
      <p className="mt-0.5 text-xs text-texto-4">
        Reasigna este cliente a otro ejecutivo. Sólo Administración puede hacerlo.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          aria-label="Nuevo ejecutivo responsable"
          className="campo w-auto"
        >
          {ejecutivos.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={traspasar}
          disabled={guardando || destino === ownerActual}
          className="btn-secundario"
        >
          {guardando ? 'Traspasando…' : 'Traspasar'}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-terracota">
          {error}
        </p>
      ) : null}
    </div>
  );
}
