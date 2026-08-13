'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { contieneDia } from '@/lib/ausencias';
import { ETIQUETA_AUSENCIA, TIPOS_AUSENCIA, type TipoAusencia } from '@/lib/dominio';
import type { SolicitudVista } from '@/lib/repos/vacaciones';
import {
  esFinDeSemana,
  fmtClave,
  hoyClave,
  inicioMes,
  NOMBRES_DIA,
  rejillaMes,
  sumarDias,
  type ClaveDia,
} from '@/lib/tiempo';
import { cn } from '@/lib/utils';

/** Un color por tipo, para leer la rejilla sin ir a la leyenda. */
const COLOR_TIPO: Record<TipoAusencia, { barra: string; punto: string; chip: string }> = {
  vacaciones: {
    barra: 'bg-verde-forja/20 border-verde-forja/40',
    punto: 'bg-verde-forja',
    chip: 'bg-verde-forja/10 text-verde-forja border-verde-forja/30',
  },
  permiso: {
    barra: 'bg-ocre/20 border-ocre/40',
    punto: 'bg-ocre',
    chip: 'bg-ocre/15 text-texto-2 border-ocre/40',
  },
  incapacidad: {
    barra: 'bg-terracota/15 border-terracota/35',
    punto: 'bg-terracota',
    chip: 'bg-terracota/10 text-terracota border-terracota/30',
  },
  economico: {
    barra: 'bg-ciruela/15 border-ciruela/35',
    punto: 'bg-ciruela',
    chip: 'bg-ciruela/12 text-ciruela border-ciruela/30',
  },
};

/**
 * Calendario de ausencias del equipo: quién está o estará fuera.
 *
 * Es una vista de lectura — aprobar y rechazar vive en la bandeja de
 * Administración. Dirección llega aquí y no puede hacer nada más que mirar.
 */
export function CalendarioAusencias({
  ausencias,
  festivos,
  mesInicial,
  puedeAdministrar,
}: {
  ausencias: SolicitudVista[];
  festivos: Record<ClaveDia, string>;
  mesInicial: ClaveDia;
  puedeAdministrar: boolean;
}) {
  const [mes, setMes] = useState<ClaveDia>(inicioMes(mesInicial));
  const [filtro, setFiltro] = useState<TipoAusencia | 'todos'>('todos');

  const hoy = hoyClave();
  const rejilla = useMemo(() => rejillaMes(mes), [mes]);

  const visibles = useMemo(
    () => (filtro === 'todos' ? ausencias : ausencias.filter((a) => a.tipo === filtro)),
    [ausencias, filtro],
  );

  /** Ausencias que tocan cada día de la rejilla. */
  const porDia = useMemo(() => {
    const mapa = new Map<ClaveDia, SolicitudVista[]>();
    for (const clave of rejilla) {
      const delDia = visibles.filter((a) =>
        contieneDia({ inicio: a.fechaInicio, fin: a.fechaFin }, clave),
      );
      if (delDia.length) mapa.set(clave, delDia);
    }
    return mapa;
  }, [rejilla, visibles]);

  /** Quiénes están fuera hoy — el dato que más se consulta. */
  const fueraHoy = useMemo(
    () =>
      visibles.filter((a) => contieneDia({ inicio: a.fechaInicio, fin: a.fechaFin }, hoy)),
    [visibles, hoy],
  );

  const mesEnCurso = mes.slice(0, 7);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Calendario de ausencias</h1>
          <p className="editorial mt-1 text-base text-texto-3">
            {fueraHoy.length === 0
              ? 'Hoy no hay nadie fuera.'
              : `Hoy ${fueraHoy.length === 1 ? 'está' : 'están'} fuera ${fueraHoy
                  .map((a) => a.persona.nombre.split(' ')[0])
                  .join(', ')}.`}
          </p>
        </div>
        {puedeAdministrar ? (
          <Link href="/admin/vacaciones" className="btn-secundario">
            Ir a la bandeja de solicitudes
          </Link>
        ) : null}
      </header>

      {/* Controles */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMes(inicioMes(sumarDias(mes, -1)))}
            aria-label="Mes anterior"
            className="btn-secundario px-3 py-1.5"
          >
            ←
          </button>
          <span className="min-w-[11rem] px-2 text-center text-sm font-semibold text-texto">
            {fmtClave(mes, "MMMM 'de' yyyy")}
          </span>
          <button
            type="button"
            onClick={() => setMes(inicioMes(sumarDias(`${mesEnCurso}-28`, 7)))}
            aria-label="Mes siguiente"
            className="btn-secundario px-3 py-1.5"
          >
            →
          </button>
          <button
            type="button"
            onClick={() => setMes(inicioMes(hoy))}
            className="btn-fantasma px-3 py-1.5 text-sm"
          >
            Hoy
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Filtro activo={filtro === 'todos'} alElegir={() => setFiltro('todos')}>
            Todos
          </Filtro>
          {TIPOS_AUSENCIA.map((t) => (
            <Filtro key={t} activo={filtro === t} alElegir={() => setFiltro(t)} tipo={t}>
              {ETIQUETA_AUSENCIA[t]}
            </Filtro>
          ))}
        </div>
      </div>

      {/* Rejilla del mes */}
      <section className="tarjeta overflow-hidden shadow-forja">
        <div className="grid grid-cols-7 border-b border-borde bg-superficie">
          {NOMBRES_DIA.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-texto-4"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {rejilla.map((clave) => {
            const delMes = clave.slice(0, 7) === mesEnCurso;
            const esHoy = clave === hoy;
            const festivo = festivos[clave];
            const gente = porDia.get(clave) ?? [];

            return (
              <div
                key={clave}
                className={cn(
                  'min-h-[6.5rem] border-b border-r border-borde p-1.5 last:border-r-0',
                  !delMes && 'bg-superficie/60',
                  esFinDeSemana(clave) && 'bg-superficie',
                  esHoy && 'ring-1 ring-inset ring-terracota',
                )}
              >
                <div className="mb-1 flex items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      'text-xs tabular-nums',
                      esHoy
                        ? 'font-bold text-terracota'
                        : delMes
                          ? 'text-texto-3'
                          : 'text-texto-4/60',
                    )}
                  >
                    {Number(clave.slice(8, 10))}
                  </span>
                  {festivo ? (
                    <span
                      title={festivo}
                      className="truncate text-[9px] font-medium text-ocre"
                    >
                      festivo
                    </span>
                  ) : null}
                </div>

                <ul className="space-y-1">
                  {gente.slice(0, 3).map((a) => (
                    <li
                      key={a.id}
                      title={`${a.persona.nombre} · ${ETIQUETA_AUSENCIA[a.tipo]}`}
                      className={cn(
                        'truncate rounded-[6px] border px-1.5 py-0.5 text-[10px] font-medium text-texto-2',
                        COLOR_TIPO[a.tipo].barra,
                      )}
                    >
                      {a.persona.nombre.split(' ')[0]}
                    </li>
                  ))}
                  {gente.length > 3 ? (
                    <li className="px-1 text-[10px] text-texto-4">+{gente.length - 3} más</li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Lista del mes */}
      <section className="tarjeta shadow-forja">
        <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h2 className="text-base font-semibold text-texto">
            Ausencias de {fmtClave(mes, 'MMMM')}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_AUSENCIA.map((t) => (
              <span
                key={t}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                  COLOR_TIPO[t].chip,
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', COLOR_TIPO[t].punto)} />
                {ETIQUETA_AUSENCIA[t]}
              </span>
            ))}
          </div>
        </header>

        {(() => {
          const delMes = visibles.filter((a) =>
            rejilla.some(
              (c) =>
                c.slice(0, 7) === mesEnCurso &&
                contieneDia({ inicio: a.fechaInicio, fin: a.fechaFin }, c),
            ),
          );

          if (delMes.length === 0) {
            return (
              <p className="px-4 py-8 text-center text-sm text-texto-4">
                Nadie estará fuera este mes.
              </p>
            );
          }

          return (
            <ul className="divide-y divide-borde">
              {delMes.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                  <span
                    className={cn('h-2 w-2 shrink-0 rounded-full', COLOR_TIPO[a.tipo].punto)}
                    aria-hidden="true"
                  />
                  <span className="text-sm font-medium text-texto">{a.persona.nombre}</span>
                  <span className="text-sm text-texto-3">
                    {ETIQUETA_AUSENCIA[a.tipo]} · {fmtClave(a.fechaInicio, 'd MMM')} –{' '}
                    {fmtClave(a.fechaFin, "d MMM yyyy")}
                  </span>
                  <span className="text-xs text-texto-4">
                    {a.diasHabiles} {a.diasHabiles === 1 ? 'día hábil' : 'días hábiles'}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>
    </div>
  );
}

function Filtro({
  activo,
  alElegir,
  tipo,
  children,
}: {
  activo: boolean;
  alElegir: () => void;
  tipo?: TipoAusencia;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={alElegir}
      aria-pressed={activo}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-forja border px-2.5 py-1 text-xs font-medium transition-colors',
        activo
          ? 'border-terracota bg-terracota text-hueso'
          : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
      )}
    >
      {tipo && !activo ? (
        <span className={cn('h-1.5 w-1.5 rounded-full', COLOR_TIPO[tipo].punto)} />
      ) : null}
      {children}
    </button>
  );
}
