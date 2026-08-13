'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/components/ui/Dialogo';
import { accionEliminarCliente, accionGuardarCliente } from '@/lib/acciones/clientes';
import {
  CADENCIA_NOMINA,
  ETIQUETA_NOMINA,
  PERIODICIDADES_NOMINA,
  type PeriodicidadNomina,
} from '@/lib/dominio';
import { cn } from '@/lib/utils';

export type ClienteEditable = {
  id: string;
  nombreEmpresa: string;
  correo: string | null;
  contactoNombre: string | null;
  telefono: string | null;
  periodicidadNomina: PeriodicidadNomina | null;
  notas: string | null;
};

export function FichaCliente({
  abierta,
  alCerrar,
  cliente,
}: {
  abierta: boolean;
  alCerrar: () => void;
  cliente: ClienteEditable | null;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nombreEmpresa, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [contactoNombre, setContacto] = useState('');
  const [telefono, setTelefono] = useState('');
  const [nomina, setNomina] = useState<PeriodicidadNomina | ''>('');
  const [notas, setNotas] = useState('');

  useEffect(() => {
    if (!abierta) return;
    setNombre(cliente?.nombreEmpresa ?? '');
    setCorreo(cliente?.correo ?? '');
    setContacto(cliente?.contactoNombre ?? '');
    setTelefono(cliente?.telefono ?? '');
    setNomina(cliente?.periodicidadNomina ?? '');
    setNotas(cliente?.notas ?? '');
    setError(null);
  }, [abierta, cliente]);

  function guardar() {
    if (!nombreEmpresa.trim()) {
      setError('El nombre de la empresa es obligatorio.');
      return;
    }
    setError(null);

    iniciar(async () => {
      const r = await accionGuardarCliente(cliente?.id ?? null, {
        nombreEmpresa,
        correo,
        contactoNombre,
        telefono,
        periodicidadNomina: nomina || null,
        notas,
      });

      if (!r.ok) setError(r.error);
      else {
        router.refresh();
        alCerrar();
      }
    });
  }

  function eliminar() {
    if (!cliente) return;
    if (!confirm(`¿Eliminar a ${cliente.nombreEmpresa} de tu cartera?`)) return;

    iniciar(async () => {
      const r = await accionEliminarCliente(cliente.id);
      if (!r.ok) setError(r.error);
      else {
        router.refresh();
        router.push('/clientes');
        alCerrar();
      }
    });
  }

  return (
    <Dialogo
      abierto={abierta}
      alCerrar={alCerrar}
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion="Este cliente será parte de tu cartera. Nadie más lo verá."
      ancho="sm"
      pie={
        <>
          {cliente ? (
            <button type="button" onClick={eliminar} disabled={guardando} className="btn-peligro mr-auto">
              Eliminar
            </button>
          ) : null}
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando} className="btn-primario">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="c-nombre" className="etiqueta-campo">
            Nombre de la empresa <span className="text-terracota">*</span>
          </label>
          <input
            id="c-nombre"
            value={nombreEmpresa}
            onChange={(e) => setNombre(e.target.value)}
            className="campo"
            placeholder="Textil Norte"
          />
        </div>

        <div>
          <label htmlFor="c-contacto" className="etiqueta-campo">
            Nombre del contacto
          </label>
          <input
            id="c-contacto"
            value={contactoNombre}
            onChange={(e) => setContacto(e.target.value)}
            className="campo"
            placeholder="Luis Peña"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="c-correo" className="etiqueta-campo">
              Correo
            </label>
            <input
              id="c-correo"
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="campo"
              placeholder="contacto@empresa.mx"
            />
          </div>

          <div>
            <label htmlFor="c-tel" className="etiqueta-campo">
              Teléfono
            </label>
            <input
              id="c-tel"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="campo"
              placeholder="81 1234 5678"
            />
          </div>
        </div>

        {/* Periodicidad de nómina */}
        <fieldset>
          <legend className="etiqueta-campo">
            Periodicidad de nómina{' '}
            <span className="font-normal normal-case text-texto-4">(opcional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {PERIODICIDADES_NOMINA.map((p) => (
              <label
                key={p}
                className={cn(
                  'cursor-pointer rounded-forja border px-3 py-1.5 text-sm font-medium transition-colors',
                  nomina === p
                    ? 'border-terracota bg-terracota text-hueso'
                    : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
                )}
              >
                <input
                  type="radio"
                  name="nomina"
                  value={p}
                  checked={nomina === p}
                  onChange={() => setNomina(p)}
                  className="sr-only"
                />
                {ETIQUETA_NOMINA[p]}
              </label>
            ))}
            {nomina ? (
              <button
                type="button"
                onClick={() => setNomina('')}
                className="btn-fantasma px-3 py-1.5 text-sm"
              >
                Quitar
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-texto-4">
            {nomina
              ? `Su nómina corre ${CADENCIA_NOMINA[nomina]}.`
              : 'Cada cuánto corre la nómina de esta empresa.'}
          </p>
        </fieldset>

        <div>
          <label htmlFor="c-notas" className="etiqueta-campo">
            Notas <span className="font-normal normal-case text-texto-4">(opcional)</span>
          </label>
          <textarea
            id="c-notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className="campo resize-y"
            placeholder="Preferencias, historial, acuerdos…"
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-forja border border-terracota/40 bg-terracota/10 px-3 py-2 text-sm text-terracota"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialogo>
  );
}
