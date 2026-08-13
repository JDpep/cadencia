'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/components/ui/Dialogo';
import {
  accionCancelarAusencia,
  accionSolicitarAusencia,
} from '@/lib/acciones/vacaciones';
import {
  diasHabilesDe,
  MENSAJE_PROBLEMA,
  validarSolicitud,
  type SaldoVacaciones,
} from '@/lib/ausencias';
import {
  ESTILO_ESTATUS_AUSENCIA,
  ETIQUETA_AUSENCIA,
  ETIQUETA_ESTATUS_AUSENCIA,
  REGLAS_AUSENCIA,
  TIPOS_AUSENCIA,
  type TipoAusencia,
} from '@/lib/dominio';
import type { SolicitudVista } from '@/lib/repos/vacaciones';
import { diferenciaDias, fmtClave, hoyClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

/**
 * Portal de vacaciones del ejecutivo.
 *
 * El conteo de días hábiles y la validación se hacen aquí en vivo con las
 * MISMAS funciones puras que corren en el servidor (`src/lib/ausencias.ts`).
 * No es duplicar la regla: es que el usuario vea el problema mientras elige las
 * fechas, no después de enviar. Quien decide sigue siendo el servidor.
 */
export function PortalVacaciones({
  saldo,
  solicitudes,
  festivos,
  puedeAdjuntar,
}: {
  saldo: SaldoVacaciones;
  solicitudes: SolicitudVista[];
  festivos: string[];
  /** false cuando el almacenamiento de comprobantes no está configurado. */
  puedeAdjuntar: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const setFestivos = useMemo(() => new Set(festivos), [festivos]);

  const pendientes = solicitudes.filter((s) => s.estatus === 'pendiente');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Vacaciones y ausencias</h1>
          <p className="editorial mt-1 text-base text-texto-3">
            {saldo.disponibles > 0
              ? `Te quedan ${saldo.disponibles} ${saldo.disponibles === 1 ? 'día' : 'días'} este año.`
              : 'Ya no te quedan días disponibles este año.'}
          </p>
        </div>
        <button type="button" onClick={() => setAbierto(true)} className="btn-primario">
          Solicitar vacaciones
        </button>
      </header>

      {/* Saldo */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta etiqueta={`Disponibles ${saldo.anio}`} valor={saldo.disponibles} acento />
        <Tarjeta etiqueta="Asignados" valor={saldo.asignados} />
        <Tarjeta etiqueta="Tomados" valor={saldo.tomados} />
        <Tarjeta
          etiqueta="Por aprobar"
          valor={saldo.pendientes}
          detalle={pendientes.length ? `${pendientes.length} solicitud(es)` : undefined}
        />
      </section>

      {/* Historial */}
      <section className="tarjeta shadow-forja">
        <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h2 className="text-base font-semibold text-texto">Mis solicitudes</h2>
          <span className="text-xs text-texto-4">{solicitudes.length}</span>
        </header>

        {solicitudes.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-texto-4">
            Todavía no has solicitado ninguna ausencia.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {solicitudes.map((s) => (
              <FilaSolicitud key={s.id} solicitud={s} alCambiar={() => router.refresh()} />
            ))}
          </ul>
        )}
      </section>

      <FormularioSolicitud
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        saldo={saldo}
        festivos={setFestivos}
        puedeAdjuntar={puedeAdjuntar}
      />
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  acento,
}: {
  etiqueta: string;
  valor: number;
  detalle?: string;
  acento?: boolean;
}) {
  return (
    <div className="tarjeta p-4 shadow-forja">
      <p className="text-xs font-semibold uppercase tracking-wide text-texto-4">{etiqueta}</p>
      <p
        className={cn(
          'mt-1.5 text-3xl font-semibold tabular-nums',
          acento ? 'text-terracota' : 'text-texto',
        )}
      >
        {valor}
      </p>
      {detalle ? <p className="mt-0.5 text-xs text-texto-4">{detalle}</p> : null}
    </div>
  );
}

function FilaSolicitud({
  solicitud: s,
  alCambiar,
}: {
  solicitud: SolicitudVista;
  alCambiar: () => void;
}) {
  const [ocupado, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const yaEmpezo = diferenciaDias(s.fechaInicio, hoyClave()) >= 0;
  const sePuedeCancelar =
    s.estatus === 'pendiente' || (s.estatus === 'aprobada' && !yaEmpezo);

  function cancelar() {
    if (!confirm('¿Cancelar esta solicitud?')) return;
    iniciar(async () => {
      const r = await accionCancelarAusencia(s.id);
      if (!r.ok) setError(r.error);
      else alCambiar();
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-texto">
              {ETIQUETA_AUSENCIA[s.tipo]}
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                ESTILO_ESTATUS_AUSENCIA[s.estatus],
              )}
            >
              {ETIQUETA_ESTATUS_AUSENCIA[s.estatus]}
            </span>
          </div>

          <p className="mt-1 text-sm text-texto-2">
            {fmtClave(s.fechaInicio, "d 'de' MMM")} – {fmtClave(s.fechaFin, "d 'de' MMM yyyy")}
            <span className="ml-2 text-texto-4">
              · {s.diasHabiles} {s.diasHabiles === 1 ? 'día hábil' : 'días hábiles'}
            </span>
          </p>

          {s.motivo ? <p className="mt-1 text-xs text-texto-3">{s.motivo}</p> : null}

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

          {s.comentarioResolucion ? (
            <p className="mt-1.5 rounded-forja border border-terracota/30 bg-terracota/10 px-2.5 py-1.5 text-xs text-terracota">
              <span className="font-semibold">Respuesta de Administración:</span>{' '}
              {s.comentarioResolucion}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="mt-1.5 text-xs text-terracota">
              {error}
            </p>
          ) : null}
        </div>

        {sePuedeCancelar ? (
          <button
            type="button"
            onClick={cancelar}
            disabled={ocupado}
            className="btn-secundario shrink-0 px-3 py-1.5 text-xs"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </li>
  );
}

function FormularioSolicitud({
  abierto,
  alCerrar,
  saldo,
  festivos,
  puedeAdjuntar,
}: {
  abierto: boolean;
  alCerrar: () => void;
  saldo: SaldoVacaciones;
  festivos: Set<string>;
  puedeAdjuntar: boolean;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tipo, setTipo] = useState<TipoAusencia>('vacaciones');
  const [inicio, setInicio] = useState('');
  const [fin, setFin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);

  const regla = REGLAS_AUSENCIA[tipo];

  // Cálculo en vivo con las mismas funciones que usa el servidor.
  const calculo = useMemo(() => {
    if (!inicio || !fin) return null;
    const rango = { inicio, fin };
    const dias = diasHabilesDe(rango, festivos);
    const problema = validarSolicitud({
      tipo,
      rango,
      motivo,
      diasHabiles: dias.length,
      disponibles: saldo.disponibles,
    });
    return {
      dias: dias.length,
      naturales: diferenciaDias(inicio, fin) + 1,
      problema,
      restante: regla.descuentaSaldo ? saldo.disponibles - dias.length : saldo.disponibles,
    };
  }, [inicio, fin, tipo, motivo, festivos, saldo.disponibles, regla.descuentaSaldo]);

  function limpiar() {
    setTipo('vacaciones');
    setInicio('');
    setFin('');
    setMotivo('');
    setArchivo(null);
    setError(null);
  }

  function enviar() {
    if (!inicio || !fin) {
      setError('Elige la fecha de inicio y la de fin.');
      return;
    }
    if (calculo?.problema) {
      setError(MENSAJE_PROBLEMA[calculo.problema]);
      return;
    }
    setError(null);

    const datos = new FormData();
    datos.set('tipo', tipo);
    datos.set('fechaInicio', inicio);
    datos.set('fechaFin', fin);
    datos.set('motivo', motivo);
    if (archivo) datos.set('adjunto', archivo);

    iniciar(async () => {
      const r = await accionSolicitarAusencia(datos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      limpiar();
      router.refresh();
      alCerrar();
    });
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Solicitar ausencia"
      descripcion="Se cuentan sólo días hábiles: fines de semana y festivos no se descuentan."
      pie={
        <>
          <button type="button" onClick={alCerrar} className="btn-secundario">
            Cancelar
          </button>
          <button
            type="button"
            onClick={enviar}
            disabled={enviando || Boolean(calculo?.problema)}
            className="btn-primario"
          >
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Tipo */}
        <fieldset>
          <legend className="etiqueta-campo">Tipo</legend>
          <div className="flex flex-wrap gap-2">
            {TIPOS_AUSENCIA.map((t) => (
              <label
                key={t}
                className={cn(
                  'cursor-pointer rounded-forja border px-3 py-1.5 text-sm font-medium transition-colors',
                  tipo === t
                    ? 'border-terracota bg-terracota text-hueso'
                    : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
                )}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t}
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  className="sr-only"
                />
                {ETIQUETA_AUSENCIA[t]}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-texto-4">
            {regla.descuentaSaldo
              ? 'Se descuenta de tu saldo anual de vacaciones.'
              : 'No se descuenta del saldo de vacaciones, pero sí bloquea tu agenda.'}
          </p>
        </fieldset>

        {/* Fechas */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="v-inicio" className="etiqueta-campo">
              Del
            </label>
            <input
              id="v-inicio"
              type="date"
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value);
                if (fin && e.target.value > fin) setFin(e.target.value);
              }}
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="v-fin" className="etiqueta-campo">
              Al
            </label>
            <input
              id="v-fin"
              type="date"
              value={fin}
              min={inicio || undefined}
              onChange={(e) => setFin(e.target.value)}
              className="campo"
            />
          </div>
        </div>

        {/* Cálculo en vivo */}
        {calculo ? (
          <div
            className={cn(
              'rounded-forja border px-3.5 py-3',
              calculo.problema
                ? 'border-terracota/40 bg-terracota/10'
                : 'border-verde-forja/30 bg-verde-forja/10',
            )}
          >
            <p className="text-sm font-semibold text-texto">
              {calculo.dias} {calculo.dias === 1 ? 'día hábil' : 'días hábiles'}
              <span className="ml-2 text-xs font-normal text-texto-3">
                de {calculo.naturales} naturales
              </span>
            </p>
            {calculo.problema ? (
              <p className="mt-1 text-xs font-medium text-terracota">
                {MENSAJE_PROBLEMA[calculo.problema]}
              </p>
            ) : (
              <p className="mt-1 text-xs text-texto-3">
                {regla.descuentaSaldo
                  ? `Te quedarían ${calculo.restante} ${calculo.restante === 1 ? 'día' : 'días'} disponibles.`
                  : 'No afecta tu saldo de vacaciones.'}
              </p>
            )}
          </div>
        ) : null}

        {/* Motivo */}
        <div>
          <label htmlFor="v-motivo" className="etiqueta-campo">
            Motivo{' '}
            <span className="font-normal normal-case text-texto-4">
              {regla.motivoObligatorio ? '(obligatorio para este tipo)' : '(opcional)'}
            </span>
          </label>
          <textarea
            id="v-motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Contexto para quien lo autorice…"
            className="campo resize-y"
          />
        </div>

        {/* Comprobante — sólo si hay dónde guardarlo */}
        <div className={puedeAdjuntar ? undefined : 'hidden'}>
          <label htmlFor="v-adjunto" className="etiqueta-campo">
            Comprobante <span className="font-normal normal-case text-texto-4">(opcional)</span>
          </label>
          <input
            id="v-adjunto"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="campo file:mr-3 file:rounded-[9px] file:border-0 file:bg-superficie-3 file:px-3 file:py-1 file:text-xs file:font-medium file:text-texto-2"
          />
          <p className="mt-1 text-xs text-texto-4">
            PDF o imagen, máximo 2 MB. Se guarda en tu máquina y sólo lo abren tú y
            Administración.
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
