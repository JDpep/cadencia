'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/components/ui/Dialogo';
import { accionReagendar } from '@/lib/acciones/actividades';
import type { ItemAgenda } from '@/lib/repos/actividades';
import { diferenciaDias, fmtClave, hoyClave, sumarDias } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

/**
 * Reagendar una actividad: para cuándo y por qué.
 *
 * El motivo es obligatorio a propósito. Mover una fecha sin dejar rastro es lo
 * que vuelve inútil la bitácora: al mes nadie recuerda si algo se recorrió por
 * el cliente, por una urgencia o porque no dio tiempo. Queda registrado.
 *
 * Si la actividad es una ocurrencia de una serie, se mueve SÓLO esa: la serie
 * sigue con su ritmo.
 */
export function DialogoReagendar({
  item,
  alCerrar,
}: {
  item: ItemAgenda | null;
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clave, setClave] = useState('');
  const [hora, setHora] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!item) return;
    // Arranca en el día siguiente al que estaba: reagendar casi siempre es
    // empujar hacia adelante, y así el caso común es un solo clic.
    setClave(sumarDias(item.clave, 1));
    setHora(item.hora ?? '');
    setMotivo('');
    setError(null);
  }, [item]);

  if (!item) return null;

  const dias = clave ? diferenciaDias(item.clave, clave) : 0;

  function guardar() {
    if (!item) return;
    if (!clave) {
      setError('Elige la nueva fecha.');
      return;
    }
    if (!motivo.trim()) {
      setError('Escribe por qué se reagenda.');
      return;
    }
    setError(null);

    iniciar(async () => {
      const r = await accionReagendar(
        item.activityId,
        item.fechaOriginal,
        clave,
        hora || null,
        motivo,
      );

      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      alCerrar();
    });
  }

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      ancho="sm"
      titulo="Reagendar"
      descripcion={item.titulo}
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !motivo.trim() || !clave}
            className="btn-primario"
          >
            {guardando ? 'Reagendando…' : 'Reagendar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="rounded-forja border border-borde bg-superficie px-3 py-2 text-xs text-texto-3">
          Estaba para el{' '}
          <span className="font-semibold text-texto-2">
            {fmtClave(item.clave, "EEEE d 'de' MMMM")}
            {item.hora ? ` a las ${item.hora}` : ''}
          </span>
          {item.esSerie ? (
            <span className="mt-1 block text-texto-4">
              Es parte de una serie: se mueve sólo esta ocurrencia.
            </span>
          ) : null}
        </p>

        {/* Para cuándo */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="rg-fecha" className="etiqueta-campo">
              Nueva fecha
            </label>
            <input
              id="rg-fecha"
              type="date"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="rg-hora" className="etiqueta-campo">
              Hora <span className="font-normal normal-case text-texto-4">(opcional)</span>
            </label>
            <input
              id="rg-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="campo"
            />
          </div>
        </div>

        {/* Atajos: el caso común no debería costar abrir el calendario */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { texto: 'Mañana', clave: sumarDias(hoyClave(), 1) },
            { texto: 'En 3 días', clave: sumarDias(hoyClave(), 3) },
            { texto: 'La próxima semana', clave: sumarDias(hoyClave(), 7) },
          ].map((a) => (
            <button
              key={a.texto}
              type="button"
              onClick={() => setClave(a.clave)}
              className={cn(
                'rounded-forja border px-2.5 py-1 text-xs transition-colors',
                clave === a.clave
                  ? 'border-terracota bg-terracota text-hueso'
                  : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
              )}
            >
              {a.texto}
            </button>
          ))}
        </div>

        {clave ? (
          <p className="text-xs text-texto-4">
            Queda para el{' '}
            <span className="font-medium text-texto-2">
              {fmtClave(clave, "EEEE d 'de' MMMM")}
            </span>
            {dias !== 0 ? (
              <span className={cn(dias > 0 ? 'text-texto-4' : 'text-terracota')}>
                {' '}
                · {dias > 0 ? `${dias} día${dias === 1 ? '' : 's'} después` : `${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'} antes`}
              </span>
            ) : null}
          </p>
        ) : null}

        {/* Por qué */}
        <div>
          <label htmlFor="rg-motivo" className="etiqueta-campo">
            Por qué se reagenda
          </label>
          <textarea
            id="rg-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            autoFocus
            placeholder="El cliente pidió moverla, entró algo urgente, faltó información…"
            className="campo resize-y"
          />
          <p className="mt-1 text-xs text-texto-4">
            Queda en la bitácora. Es lo que permite entender después por qué se movió.
          </p>
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
