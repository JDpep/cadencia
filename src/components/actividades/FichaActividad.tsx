'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/components/ui/Dialogo';
import { Palomear } from '@/components/ui/Palomear';
import { EditorRecurrencia } from './EditorRecurrencia';
import {
  accionAgregarSubtarea,
  accionAlternarSubtarea,
  accionEliminarActividad,
  accionEliminarSerie,
  accionEliminarSubtarea,
  accionGuardarActividad,
  accionGuardarSerie,
} from '@/lib/acciones/actividades';
import {
  ALCANCES_EDICION,
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  ETIQUETA_RECORDATORIO,
  HORA_RECORDATORIO_DIA_COMPLETO,
  OFFSETS_RECORDATORIO,
  PRIORIDADES,
  type AlcanceEdicion,
  type Estado,
  type Prioridad,
} from '@/lib/dominio';
import type { ActividadVista } from '@/lib/repos/actividades';
import type { ReglaRecurrencia } from '@/lib/recurrence';
import { ESTILO_PRIORIDAD } from '@/lib/dominio';
import { cn } from '@/lib/utils';

export type ContextoOcurrencia = {
  activityId: string;
  fechaOriginal: string;
  /**
   * Hora efectiva de ESTA ocurrencia, que puede no ser la de la serie.
   * Sin esto la ficha mostraría la hora de la madre y al guardar pisaría la
   * que el usuario le había puesto a esta ocurrencia en concreto.
   */
  hora?: string | null;
} | null;

const ETIQUETA_ALCANCE: Record<AlcanceEdicion, string> = {
  esta: 'Sólo esta ocurrencia',
  siguientes: 'Esta y las siguientes',
  serie: 'Toda la serie',
};

export function FichaActividad({
  abierta,
  alCerrar,
  actividad,
  ocurrencia = null,
  categorias,
  clientes,
  claveInicial = null,
  horaInicial = null,
}: {
  abierta: boolean;
  alCerrar: () => void;
  actividad: ActividadVista | null;
  ocurrencia?: ContextoOcurrencia;
  categorias: { id: string; nombre: string; colorToken: string; icono: string | null }[];
  clientes: { id: string; nombreEmpresa: string }[];
  claveInicial?: string | null;
  horaInicial?: string | null;
}) {
  const router = useRouter();
  const [guardando, iniciarGuardado] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [prioridad, setPrioridad] = useState<Prioridad>('media');
  const [estado, setEstado] = useState<Estado>('por_hacer');
  const [clave, setClave] = useState('');
  const [hora, setHora] = useState('');
  const [clientId, setClientId] = useState('');
  const [recurrencia, setRecurrencia] = useState<ReglaRecurrencia | null>(null);
  const [recordatorio, setRecordatorio] = useState<number | null>(null);
  const [alcance, setAlcance] = useState<AlcanceEdicion>('esta');
  const [subtareas, setSubtareas] = useState(actividad?.subtareas ?? []);
  const [nuevaSub, setNuevaSub] = useState('');

  const esSerie = Boolean(actividad?.recurrencia);
  const editandoOcurrencia = Boolean(ocurrencia && esSerie);

  // Al abrir, la ficha se rehidrata con la actividad recibida.
  useEffect(() => {
    if (!abierta) return;

    setTitulo(actividad?.titulo ?? '');
    setDescripcion(actividad?.descripcion ?? '');
    setCategoryId(actividad?.categoria?.id ?? '');
    setPrioridad(actividad?.prioridad ?? 'media');
    setEstado(actividad?.estado ?? 'por_hacer');
    setClave(ocurrencia?.fechaOriginal ?? actividad?.clave ?? claveInicial ?? '');
    // Editando una ocurrencia manda SU hora, aunque sea distinta a la de la serie.
    setHora(
      editandoOcurrencia && ocurrencia?.hora !== undefined
        ? (ocurrencia.hora ?? '')
        : (actividad?.hora ?? horaInicial ?? ''),
    );
    setClientId(actividad?.cliente?.id ?? '');
    setRecurrencia(actividad?.recurrencia ?? null);
    setRecordatorio(actividad?.recordatorioMinutos ?? null);
    setSubtareas(actividad?.subtareas ?? []);
    setAlcance('esta');
    setNuevaSub('');
    setError(null);
  }, [abierta, actividad, ocurrencia, claveInicial, horaInicial, editandoOcurrencia]);

  const avance = useMemo(() => {
    if (!subtareas.length) return null;
    const hechas = subtareas.filter((s) => s.hecha).length;
    return { hechas, total: subtareas.length, pct: Math.round((hechas / subtareas.length) * 100) };
  }, [subtareas]);

  function cerrarYRefrescar() {
    router.refresh();
    alCerrar();
  }

  function guardar() {
    if (!titulo.trim()) {
      setError('La actividad necesita un título.');
      return;
    }
    setError(null);

    const entrada = {
      titulo,
      descripcion: descripcion || null,
      categoryId: categoryId || null,
      prioridad,
      estado,
      clave: clave || null,
      hora: hora || null,
      clientId: clientId || null,
      recurrencia,
      recordatorioMinutos: recordatorio,
    };

    iniciarGuardado(async () => {
      const r =
        editandoOcurrencia && ocurrencia
          ? await accionGuardarSerie(ocurrencia.activityId, ocurrencia.fechaOriginal, alcance, entrada)
          : await accionGuardarActividad(actividad?.id ?? null, entrada);

      if (!r.ok) setError(r.error);
      else cerrarYRefrescar();
    });
  }

  function eliminar() {
    if (!actividad) return;

    const mensaje = esSerie
      ? alcance === 'serie'
        ? '¿Eliminar toda la serie? Esto borra todas sus ocurrencias.'
        : alcance === 'siguientes'
          ? '¿Terminar la serie a partir de esta ocurrencia?'
          : '¿Saltar sólo esta ocurrencia?'
      : '¿Eliminar esta actividad?';

    if (!confirm(mensaje)) return;

    iniciarGuardado(async () => {
      const r =
        esSerie && ocurrencia
          ? await accionEliminarSerie(ocurrencia.activityId, ocurrencia.fechaOriginal, alcance)
          : await accionEliminarActividad(actividad.id);

      if (!r.ok) setError(r.error);
      else cerrarYRefrescar();
    });
  }

  async function agregarSub() {
    const texto = nuevaSub.trim();
    if (!texto || !actividad) return;

    setNuevaSub('');
    setSubtareas((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, texto, hecha: false, orden: prev.length },
    ]);

    const r = await accionAgregarSubtarea(actividad.id, texto);
    if (!r.ok) setError(r.error);
    router.refresh();
  }

  return (
    <Dialogo
      abierto={abierta}
      alCerrar={alCerrar}
      titulo={actividad ? 'Editar actividad' : 'Nueva actividad'}
      descripcion={
        editandoOcurrencia
          ? 'Esta actividad forma parte de una serie recurrente.'
          : undefined
      }
      pie={
        <>
          {actividad ? (
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
        {/* Alcance de edición de la serie */}
        {editandoOcurrencia ? (
          <fieldset className="rounded-forja border border-ocre/40 bg-ocre/15 p-3">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-texto-2">
              Qué quieres cambiar
            </legend>
            <div className="flex flex-wrap gap-2">
              {ALCANCES_EDICION.map((a) => (
                <label
                  key={a}
                  className={cn(
                    'cursor-pointer rounded-forja border px-3 py-1.5 text-sm transition-colors',
                    alcance === a
                      ? 'border-terracota bg-terracota text-hueso'
                      : 'border-borde bg-superficie-2 text-texto-2 hover:border-texto-4',
                  )}
                >
                  <input
                    type="radio"
                    name="alcance"
                    value={a}
                    checked={alcance === a}
                    onChange={() => setAlcance(a)}
                    className="sr-only"
                  />
                  {ETIQUETA_ALCANCE[a]}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {/* Título */}
        <div>
          <label htmlFor="f-titulo" className="etiqueta-campo">
            Título
          </label>
          <div className="flex items-center gap-3">
            {actividad ? (
              <Palomear
                hecha={estado === 'hecha'}
                tamano="lg"
                etiqueta="Marcar como hecha"
                alCambiar={(v) => setEstado(v ? 'hecha' : 'por_hacer')}
              />
            ) : null}
            <input
              id="f-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="¿Qué hay que hacer?"
              className="campo text-base"
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label htmlFor="f-desc" className="etiqueta-campo">
            Nota
          </label>
          <textarea
            id="f-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            placeholder="Detalles, contexto, siguiente paso…"
            className="campo resize-y"
          />
        </div>

        {/* Prioridad */}
        <fieldset>
          <legend className="etiqueta-campo">Prioridad</legend>
          <div className="flex flex-wrap gap-2">
            {PRIORIDADES.map((p) => (
              <label
                key={p}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-forja border px-3 py-1.5 text-sm font-medium transition-all',
                  prioridad === p
                    ? p === 'urgente'
                      ? 'border-terracota bg-terracota text-hueso'
                      : 'border-texto-4 bg-superficie-3 text-texto'
                    : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
                )}
              >
                <input
                  type="radio"
                  name="prioridad"
                  value={p}
                  checked={prioridad === p}
                  onChange={() => setPrioridad(p)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    prioridad === p && p === 'urgente' ? 'bg-hueso' : ESTILO_PRIORIDAD[p].punto,
                  )}
                />
                {ETIQUETA_PRIORIDAD[p]}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Categoría · Estado */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-cat" className="etiqueta-campo">
              Categoría
            </label>
            <select
              id="f-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="campo"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="f-estado" className="etiqueta-campo">
              Estado
            </label>
            <select
              id="f-estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value as Estado)}
              className="campo"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fecha · Hora */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="f-fecha" className="etiqueta-campo">
              Fecha
            </label>
            <div className="flex gap-2">
              <input
                id="f-fecha"
                type="date"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="campo"
              />
              {clave ? (
                <button
                  type="button"
                  onClick={() => {
                    setClave('');
                    setHora('');
                    setRecurrencia(null);
                    // Sin fecha no hay a qué anclar el aviso.
                    setRecordatorio(null);
                  }}
                  className="btn-secundario shrink-0 px-3"
                  title="Quitar fecha"
                >
                  Quitar
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label htmlFor="f-hora" className="etiqueta-campo">
              Hora
            </label>
            <input
              id="f-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              disabled={!clave}
              className="campo disabled:opacity-50"
            />
            {!clave ? (
              <p className="mt-1 text-xs text-texto-4">Primero ponle fecha.</p>
            ) : hora ? (
              <button
                type="button"
                onClick={() => setHora('')}
                className="mt-1 text-xs text-texto-4 underline underline-offset-2 hover:text-terracota"
              >
                Quitar la hora
              </button>
            ) : null}
          </div>
        </div>

        {/* Recordatorio — necesita fecha para tener a qué anclarse */}
        <div>
          <label htmlFor="f-recordatorio" className="etiqueta-campo">
            Recordarme
          </label>
          <select
            id="f-recordatorio"
            value={recordatorio === null ? '' : String(recordatorio)}
            onChange={(e) =>
              setRecordatorio(e.target.value === '' ? null : Number(e.target.value))
            }
            disabled={!clave}
            className="campo disabled:opacity-50"
          >
            <option value="">Sin recordatorio</option>
            {OFFSETS_RECORDATORIO.map((m) => (
              <option key={m} value={m}>
                {ETIQUETA_RECORDATORIO[m]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-texto-4">
            {!clave
              ? 'Ponle fecha a la actividad para poder recibir un aviso.'
              : recordatorio === null
                ? 'Aparece en la campana del encabezado cuando llegue la hora.'
                : hora
                  ? `Sonará ${ETIQUETA_RECORDATORIO[recordatorio]!.toLowerCase()} de las ${hora}.`
                  : `Sin hora, el aviso se cuenta desde las ${HORA_RECORDATORIO_DIA_COMPLETO} del día.`}
          </p>
          {recordatorio !== null && recurrencia ? (
            <p className="mt-1 text-xs text-texto-4">
              Al ser una serie, avisa en cada ocurrencia — las saltadas y las ya hechas no.
            </p>
          ) : null}
        </div>

        {/* Cliente — sólo los propios */}
        <div>
          <label htmlFor="f-cliente" className="etiqueta-campo">
            Cliente
          </label>
          <select
            id="f-cliente"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="campo"
          >
            <option value="">Sin cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombreEmpresa}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-texto-4">
            Sólo aparecen los clientes de tu cartera.
          </p>
        </div>

        {/* Recurrencia — necesita fecha de arranque */}
        {clave ? (
          <EditorRecurrencia regla={recurrencia} alCambiar={setRecurrencia} />
        ) : (
          <p className="rounded-forja border border-dashed border-borde px-3 py-2.5 text-xs text-texto-4">
            Ponle fecha a la actividad para poder hacerla recurrente.
          </p>
        )}

        {/* Sub-actividades */}
        {actividad ? (
          <div className="rounded-forja border border-borde bg-superficie p-3.5">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-texto">Sub-actividades</span>
              {avance ? (
                <span className="text-xs text-texto-3">
                  {avance.hechas}/{avance.total} · {avance.pct}%
                </span>
              ) : null}
            </div>

            {avance ? (
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-superficie-3">
                <div
                  className="h-full rounded-full bg-verde-forja transition-all duration-300"
                  style={{ width: `${avance.pct}%` }}
                />
              </div>
            ) : null}

            <ul className="space-y-1.5">
              {subtareas.map((s) => (
                <li key={s.id} className="group flex items-center gap-2.5">
                  <Palomear
                    hecha={s.hecha}
                    tamano="sm"
                    etiqueta={`Marcar «${s.texto}»`}
                    alCambiar={async () => {
                      setSubtareas((prev) =>
                        prev.map((x) => (x.id === s.id ? { ...x, hecha: !x.hecha } : x)),
                      );
                      if (!s.id.startsWith('tmp-')) await accionAlternarSubtarea(s.id);
                    }}
                  />
                  <span
                    className={cn(
                      'flex-1 text-sm',
                      s.hecha ? 'text-texto-4 line-through' : 'text-texto-2',
                    )}
                  >
                    {s.texto}
                  </span>
                  <button
                    type="button"
                    aria-label={`Eliminar «${s.texto}»`}
                    onClick={async () => {
                      setSubtareas((prev) => prev.filter((x) => x.id !== s.id));
                      if (!s.id.startsWith('tmp-')) await accionEliminarSubtarea(s.id);
                      router.refresh();
                    }}
                    className="rounded p-1 text-texto-4 opacity-0 transition-opacity hover:text-terracota focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>

            <input
              value={nuevaSub}
              onChange={(e) => setNuevaSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarSub();
                }
              }}
              placeholder="Agregar sub-actividad y Enter…"
              className="campo mt-2.5 text-sm"
            />
          </div>
        ) : null}

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
