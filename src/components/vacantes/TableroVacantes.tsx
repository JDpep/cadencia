'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  aCSV,
  agregar,
  NOMBRES_MES_LARGO,
  type HistoricoVacantes,
  type Vacante,
} from '@/lib/vacantes';
import { fmtClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

/**
 * Histórico de vacantes.
 *
 * Los filtros se resuelven en el cliente con la MISMA función pura que usó el
 * servidor (`agregar`), sobre el conjunto que este usuario tiene permitido ver.
 * El permiso ya se aplicó al cargar: aquí no se puede destapar nada.
 *
 * La gráfica es de una sola serie —el total del mes—, así que lleva un solo
 * color: terracota, la firma de la pantalla. El desglose de quién atendió cada
 * vacante vive en la tabla, que además es la vista accesible de la gráfica.
 */
export function TableroVacantes({
  todas,
  inicial,
  veTodoElEquipo,
}: {
  todas: Vacante[];
  inicial: HistoricoVacantes;
  veTodoElEquipo: boolean;
}) {
  const [anio, setAnio] = useState(inicial.anio);
  const [userId, setUserId] = useState<string>('');
  const [mesDesde, setMesDesde] = useState(1);
  const [mesHasta, setMesHasta] = useState(12);
  const [mesAbierto, setMesAbierto] = useState<number | null>(null);

  const h = useMemo(
    () =>
      agregar(todas, {
        anio,
        userId: userId || undefined,
        mesDesde,
        mesHasta: Math.max(mesDesde, mesHasta),
      }),
    [todas, anio, userId, mesDesde, mesHasta],
  );

  // Todas las personas que existen en el histórico, para el selector.
  const personasTodas = useMemo(
    () =>
      [...new Map(todas.map((v) => [v.userId, v.persona])).entries()]
        .map(([id, nombre]) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    [todas],
  );

  const detalleAbierto = useMemo(
    () => (mesAbierto === null ? [] : h.detalle.filter((v) => v.mes === mesAbierto)),
    [h.detalle, mesAbierto],
  );

  function exportar() {
    const csv = aCSV(h.detalle);
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vacantes-${anio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Histórico de vacantes</h1>
          <p className="editorial mt-1 text-base text-texto-3">
            {veTodoElEquipo
              ? 'Cada entrevista completada cuenta como una vacante.'
              : 'Tus entrevistas completadas, mes a mes.'}
          </p>
        </div>
        <button
          type="button"
          onClick={exportar}
          disabled={h.detalle.length === 0}
          className="btn-secundario"
        >
          Exportar CSV
        </button>
      </header>

      {/* Filtros — una sola fila sobre las gráficas */}
      <div className="flex flex-wrap items-end gap-3">
        <Campo etiqueta="Año" id="f-anio">
          <select
            id="f-anio"
            value={anio}
            onChange={(e) => {
              setAnio(Number(e.target.value));
              setMesAbierto(null);
            }}
            className="campo w-28"
          >
            {h.aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </Campo>

        {veTodoElEquipo ? (
          <Campo etiqueta="Ejecutivo" id="f-persona">
            <select
              id="f-persona"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setMesAbierto(null);
              }}
              className="campo w-52"
            >
              <option value="">Todos</option>
              {personasTodas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}

        <Campo etiqueta="De" id="f-desde">
          <select
            id="f-desde"
            value={mesDesde}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMesDesde(v);
              if (v > mesHasta) setMesHasta(v);
              setMesAbierto(null);
            }}
            className="campo w-32"
          >
            {NOMBRES_MES_LARGO.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="A" id="f-hasta">
          <select
            id="f-hasta"
            value={mesHasta}
            onChange={(e) => {
              setMesHasta(Number(e.target.value));
              setMesAbierto(null);
            }}
            className="campo w-32"
          >
            {NOMBRES_MES_LARGO.map((m, i) => (
              <option key={m} value={i + 1} disabled={i + 1 < mesDesde}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {/* Resumen */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Tarjeta
          etiqueta="Vacantes del mes en curso"
          valor={h.totalMesEnCurso}
          detalle={h.anio === new Date().getFullYear() ? undefined : `Mostrando ${h.anio}`}
          acento
        />
        <Tarjeta etiqueta={`Vacantes del periodo`} valor={h.totalPeriodo} />
        <Tarjeta
          etiqueta={veTodoElEquipo ? 'Quien más atendió' : 'Tu mejor mes'}
          valor={veTodoElEquipo ? (h.lider?.total ?? 0) : mejorMes(h).total}
          detalle={
            veTodoElEquipo
              ? (h.lider?.nombre ?? 'Sin vacantes en el periodo')
              : mejorMes(h).etiqueta
          }
          texto
        />
      </section>

      {/* Gráfica */}
      <section className="tarjeta p-4 shadow-forja">
        <h2 className="text-base font-semibold text-texto">Vacantes por mes · {h.anio}</h2>
        <p className="mt-0.5 text-xs text-texto-4">
          Entrevistas completadas. Haz clic en una barra para ver cuáles.
        </p>

        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={h.porMes}
              margin={{ top: 16, right: 8, bottom: 4, left: -20 }}
              barCategoryGap="22%"
            >
              {/* Rejilla recesiva: sólo horizontales, en el color de borde. */}
              <CartesianGrid
                vertical={false}
                className="[stroke:rgb(var(--borde))]"
                strokeDasharray="2 4"
              />
              <XAxis
                dataKey="etiqueta"
                tickLine={false}
                axisLine={false}
                className="[&_text]:fill-[rgb(var(--texto-4))]"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={44}
                className="[&_text]:fill-[rgb(var(--texto-4))]"
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                cursor={{ className: '[fill:rgb(var(--superficie-3))]', radius: 4 }}
                content={<Globo personas={h.personas} />}
              />
              <Bar
                dataKey="total"
                // Extremos redondeados anclados a la línea base.
                radius={[4, 4, 0, 0]}
                className="[fill:rgb(var(--terracota))]"
                onClick={(d: unknown) => {
                  const mes = (d as { mes?: number })?.mes;
                  if (mes) setMesAbierto((v) => (v === mes ? null : mes));
                }}
              >
                {h.porMes.map((m) => (
                  <Cell
                    key={m.mes}
                    className={cn(
                      'cursor-pointer transition-opacity',
                      mesAbierto !== null && mesAbierto !== m.mes && 'opacity-35',
                    )}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabla histórica — también es la vista accesible de la gráfica */}
      <section className="tarjeta shadow-forja">
        <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
          <h2 className="text-base font-semibold text-texto">Tabla histórica</h2>
          <span className="text-xs text-texto-4">
            {h.totalPeriodo} {h.totalPeriodo === 1 ? 'vacante' : 'vacantes'}
          </span>
        </header>

        {h.totalPeriodo === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-texto-4">
            No hay entrevistas completadas en este periodo.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <caption className="sr-only">
                Vacantes por mes en {h.anio}
                {veTodoElEquipo ? ', con el desglose por ejecutivo' : ''}
              </caption>
              <thead>
                <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-4">
                  <th scope="col" className="px-4 py-2 font-semibold">
                    Mes
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">
                    Total
                  </th>
                  {veTodoElEquipo
                    ? h.personas.map((p) => (
                        <th key={p.id} scope="col" className="px-4 py-2 text-right font-semibold">
                          {p.nombre}
                        </th>
                      ))
                    : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-borde">
                {h.porMes.map((m) => (
                  <tr
                    key={m.mes}
                    onClick={() => m.total > 0 && setMesAbierto((v) => (v === m.mes ? null : m.mes))}
                    className={cn(
                      m.total > 0 && 'cursor-pointer hover:bg-superficie-3/50',
                      mesAbierto === m.mes && 'bg-terracota/[0.07]',
                    )}
                  >
                    <th
                      scope="row"
                      className="px-4 py-2 text-left font-medium capitalize text-texto"
                    >
                      {NOMBRES_MES_LARGO[m.mes - 1]}
                    </th>
                    <td
                      className={cn(
                        'px-4 py-2 text-right font-semibold tabular-nums',
                        m.total > 0 ? 'text-terracota' : 'text-texto-4',
                      )}
                    >
                      {m.total}
                    </td>
                    {veTodoElEquipo
                      ? h.personas.map((p) => (
                          <td
                            key={p.id}
                            className="px-4 py-2 text-right tabular-nums text-texto-3"
                          >
                            {m.porPersona[p.id] ?? '—'}
                          </td>
                        ))
                      : null}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-borde-2 font-semibold">
                  <th scope="row" className="px-4 py-2 text-left text-texto">
                    Total
                  </th>
                  <td className="px-4 py-2 text-right tabular-nums text-texto">
                    {h.totalPeriodo}
                  </td>
                  {veTodoElEquipo
                    ? h.personas.map((p) => (
                        <td key={p.id} className="px-4 py-2 text-right tabular-nums text-texto">
                          {h.detalle.filter((v) => v.userId === p.id).length}
                        </td>
                      ))
                    : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Detalle del mes elegido */}
      {mesAbierto !== null ? (
        <section className="tarjeta shadow-forja">
          <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
            <h2 className="text-base font-semibold capitalize text-texto">
              {NOMBRES_MES_LARGO[mesAbierto - 1]} de {h.anio}
              <span className="ml-2 text-xs font-normal text-texto-4">
                {detalleAbierto.length}{' '}
                {detalleAbierto.length === 1 ? 'entrevista' : 'entrevistas'}
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setMesAbierto(null)}
              className="btn-fantasma px-3 py-1 text-xs"
            >
              Cerrar
            </button>
          </header>

          {detalleAbierto.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-texto-4">
              Ninguna entrevista completada este mes.
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {detalleAbierto.map((v) => (
                <li key={v.llave} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-texto-4">
                    {fmtClave(v.clave, "d 'de' MMM")}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-texto">{v.titulo}</span>
                  {veTodoElEquipo ? (
                    <span className="text-xs text-texto-3">{v.persona}</span>
                  ) : null}
                  {v.cliente ? (
                    <span className="text-xs text-texto-4">· {v.cliente}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

/** El mes con más vacantes — sólo se usa en la vista de un ejecutivo. */
function mejorMes(h: HistoricoVacantes) {
  const mejor = [...h.porMes].sort((a, b) => b.total - a.total)[0];
  if (!mejor || mejor.total === 0) return { total: 0, etiqueta: 'Sin vacantes aún' };
  return { total: mejor.total, etiqueta: NOMBRES_MES_LARGO[mejor.mes - 1] };
}

function Campo({
  etiqueta,
  id,
  children,
}: {
  etiqueta: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="etiqueta-campo">
        {etiqueta}
      </label>
      {children}
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  detalle,
  acento,
  texto,
}: {
  etiqueta: string;
  valor: number;
  detalle?: string;
  acento?: boolean;
  texto?: boolean;
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
      {detalle ? (
        <p className={cn('mt-0.5 text-xs', texto ? 'text-texto-2' : 'text-texto-4')}>
          {detalle}
        </p>
      ) : null}
    </div>
  );
}

/** Globo de la gráfica: el total del mes y, si aplica, quién lo atendió. */
function Globo({
  active,
  payload,
  personas,
}: {
  active?: boolean;
  payload?: { payload: { mes: number; total: number; porPersona: Record<string, number> } }[];
  personas: { id: string; nombre: string }[];
}) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;

  const desglose = personas
    .map((p) => ({ nombre: p.nombre, n: m.porPersona[p.id] ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);

  return (
    <div className="rounded-forja border border-borde bg-superficie-2 px-3 py-2 shadow-forja-alto">
      <p className="text-xs font-semibold capitalize text-texto">
        {NOMBRES_MES_LARGO[m.mes - 1]}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-terracota">
        {m.total} {m.total === 1 ? 'vacante' : 'vacantes'}
      </p>
      {desglose.length > 1 ? (
        <ul className="mt-1.5 space-y-0.5 border-t border-borde pt-1.5">
          {desglose.map((d) => (
            <li key={d.nombre} className="flex gap-3 text-[11px] text-texto-3">
              <span className="flex-1">{d.nombre}</span>
              <span className="tabular-nums">{d.n}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
