'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  accionAprobarAusencia,
  accionFijarSaldo,
  accionRechazarAusencia,
} from '@/lib/acciones/vacaciones';
import {
  ESTILO_ESTATUS_AUSENCIA,
  ETIQUETA_AUSENCIA,
  ETIQUETA_ESTATUS_AUSENCIA,
  REGLAS_AUSENCIA,
} from '@/lib/dominio';
import type { SaldoVacaciones } from '@/lib/ausencias';
import type { SolicitudVista } from '@/lib/repos/vacaciones';
import { fmtClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

type SaldoEquipo = {
  id: string;
  nombre: string;
  email: string;
  puesto: string | null;
  saldo: SaldoVacaciones;
};

/**
 * Bandeja de Administración.
 *
 * Las pendientes van arriba y cada una trae el **traslape**: quién más estará
 * fuera esas fechas. Es el dato que hace falta para decidir, así que se muestra
 * junto al botón de aprobar y no escondido en otra pantalla.
 */
export function BandejaSolicitudes({
  solicitudes,
  saldos,
  anio,
}: {
  solicitudes: SolicitudVista[];
  saldos: SaldoEquipo[];
  anio: number;
}) {
  const pendientes = solicitudes.filter((s) => s.estatus === 'pendiente');
  const resueltas = solicitudes.filter((s) => s.estatus !== 'pendiente');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-texto">Solicitudes de vacaciones</h2>
          <p className="mt-0.5 text-sm text-texto-3">
            {pendientes.length === 0
              ? 'No hay nada esperando respuesta.'
              : `${pendientes.length} ${pendientes.length === 1 ? 'solicitud espera' : 'solicitudes esperan'} tu respuesta.`}
          </p>
        </div>
        <Link href="/ausencias" className="btn-secundario">
          Calendario de ausencias
        </Link>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 ? (
        <section className="space-y-3">
          {pendientes.map((s) => (
            <TarjetaPendiente key={s.id} solicitud={s} />
          ))}
        </section>
      ) : null}

      {/* Resueltas */}
      <section className="tarjeta shadow-forja">
        <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h3 className="text-base font-semibold text-texto">Historial</h3>
          <span className="text-xs text-texto-4">{resueltas.length}</span>
        </header>

        {resueltas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-texto-4">
            Todavía no has resuelto ninguna solicitud.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {resueltas.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                <span className="text-sm font-medium text-texto">{s.persona.nombre}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    ESTILO_ESTATUS_AUSENCIA[s.estatus],
                  )}
                >
                  {ETIQUETA_ESTATUS_AUSENCIA[s.estatus]}
                </span>
                <span className="text-sm text-texto-3">
                  {ETIQUETA_AUSENCIA[s.tipo]} · {fmtClave(s.fechaInicio, "d MMM")} –{' '}
                  {fmtClave(s.fechaFin, "d MMM yyyy")} · {s.diasHabiles} d
                </span>
                {s.comentarioResolucion ? (
                  <span className="w-full text-xs text-texto-4">
                    «{s.comentarioResolucion}»
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <TablaSaldos saldos={saldos} anio={anio} />
    </div>
  );
}

function TarjetaPendiente({ solicitud: s }: { solicitud: SolicitudVista }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [comentario, setComentario] = useState('');

  const descuenta = REGLAS_AUSENCIA[s.tipo].descuentaSaldo;

  function resolver(fn: () => Promise<{ ok: boolean; error?: string }>) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? 'No se pudo resolver.');
      else {
        setRechazando(false);
        setComentario('');
        router.refresh();
      }
    });
  }

  return (
    <article className="tarjeta border-ocre/40 p-4 shadow-forja">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-texto">{s.persona.nombre}</span>
            {s.persona.puesto ? (
              <span className="text-xs text-texto-4">{s.persona.puesto}</span>
            ) : null}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                ESTILO_ESTATUS_AUSENCIA.pendiente,
              )}
            >
              {ETIQUETA_AUSENCIA[s.tipo]}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-texto-2">
            {fmtClave(s.fechaInicio, "EEEE d 'de' MMMM")} –{' '}
            {fmtClave(s.fechaFin, "EEEE d 'de' MMMM yyyy")}
          </p>
          <p className="mt-0.5 text-sm">
            <span className="font-semibold text-terracota">
              {s.diasHabiles} {s.diasHabiles === 1 ? 'día hábil' : 'días hábiles'}
            </span>
            <span className="ml-2 text-xs text-texto-4">
              {descuenta ? 'descuenta del saldo' : 'no descuenta del saldo'}
            </span>
          </p>

          {s.motivo ? (
            <p className="mt-1.5 text-sm text-texto-3">«{s.motivo}»</p>
          ) : null}

          {s.tieneAdjunto ? (
            <a
              href={`/api/adjuntos/${s.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-terracota underline underline-offset-2"
            >
              Ver comprobante{s.adjuntoNombre ? ` · ${s.adjuntoNombre}` : ''}
            </a>
          ) : null}

          {/* Aviso de traslape: quién más estará fuera */}
          {s.traslapes && s.traslapes.length > 0 ? (
            <div className="mt-2.5 rounded-forja border border-ocre/40 bg-ocre/15 px-3 py-2">
              <p className="text-xs font-semibold text-texto-2">
                Ojo: {s.traslapes.length === 1 ? 'alguien más estará' : 'otros estarán'} fuera
                esas fechas
              </p>
              <ul className="mt-1 space-y-0.5">
                {s.traslapes.map((t, i) => (
                  <li key={i} className="text-xs text-texto-3">
                    {t.nombre} · {fmtClave(t.fechaInicio, 'd MMM')} –{' '}
                    {fmtClave(t.fechaFin, 'd MMM')}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => resolver(() => accionAprobarAusencia(s.id))}
            className="btn-primario px-4 py-1.5 text-sm"
          >
            Aprobar
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setRechazando((v) => !v)}
            className="btn-peligro px-4 py-1.5 text-sm"
          >
            Rechazar
          </button>
        </div>
      </div>

      {/* El comentario es obligatorio al rechazar: nadie se queda sin saber por qué. */}
      {rechazando ? (
        <div className="mt-3 border-t border-borde pt-3">
          <label htmlFor={`r-${s.id}`} className="etiqueta-campo">
            Motivo del rechazo <span className="font-normal normal-case">(obligatorio)</span>
          </label>
          <textarea
            id={`r-${s.id}`}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            placeholder="Explica por qué, para que quede claro…"
            className="campo resize-y"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={ocupado || !comentario.trim()}
              onClick={() => resolver(() => accionRechazarAusencia(s.id, comentario))}
              className="btn-peligro px-3 py-1.5 text-sm"
            >
              Confirmar rechazo
            </button>
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="btn-fantasma px-3 py-1.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-terracota">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function TablaSaldos({ saldos, anio }: { saldos: SaldoEquipo[]; anio: number }) {
  return (
    <section className="tarjeta shadow-forja">
      <header className="border-b border-borde px-4 py-3">
        <h3 className="text-base font-semibold text-texto">Saldos de {anio}</h3>
        <p className="mt-0.5 text-xs text-texto-4">
          Los días disponibles se derivan: asignados − tomados − por aprobar.
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-4">
              <th className="px-4 py-2 font-semibold">Persona</th>
              <th className="px-4 py-2 text-right font-semibold">Asignados</th>
              <th className="px-4 py-2 text-right font-semibold">Tomados</th>
              <th className="px-4 py-2 text-right font-semibold">Por aprobar</th>
              <th className="px-4 py-2 text-right font-semibold">Disponibles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {saldos.map((p) => (
              <FilaSaldo key={p.id} persona={p} anio={anio} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilaSaldo({ persona, anio }: { persona: SaldoEquipo; anio: number }) {
  const router = useRouter();
  const [ocupado, iniciar] = useTransition();
  const [valor, setValor] = useState(String(persona.saldo.asignados));
  const [error, setError] = useState<string | null>(null);

  const cambiado = Number(valor) !== persona.saldo.asignados;

  function guardar() {
    iniciar(async () => {
      const r = await accionFijarSaldo(persona.id, anio, Number(valor));
      if (!r.ok) {
        setError(r.error);
        setValor(String(persona.saldo.asignados));
      } else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <tr>
      <td className="px-4 py-2">
        <span className="font-medium text-texto">{persona.nombre}</span>
        <span className="ml-2 text-xs text-texto-4">{persona.email}</span>
        {error ? (
          <span role="alert" className="block text-xs text-terracota">
            {error}
          </span>
        ) : null}
      </td>
      <td className="px-4 py-2 text-right">
        <span className="inline-flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={365}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-label={`Días asignados a ${persona.nombre}`}
            className="w-16 rounded-forja border border-borde bg-superficie px-2 py-1 text-right text-sm text-texto focus:border-terracota focus:outline-none"
          />
          {cambiado ? (
            <button
              type="button"
              onClick={guardar}
              disabled={ocupado}
              className="rounded-[9px] bg-terracota px-2 py-1 text-xs font-semibold text-hueso disabled:opacity-50"
            >
              Guardar
            </button>
          ) : null}
        </span>
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-texto-3">
        {persona.saldo.tomados}
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-texto-3">
        {persona.saldo.pendientes}
      </td>
      <td
        className={cn(
          'px-4 py-2 text-right font-semibold tabular-nums',
          persona.saldo.disponibles <= 0 ? 'text-terracota' : 'text-verde-forja',
        )}
      >
        {persona.saldo.disponibles}
      </td>
    </tr>
  );
}
