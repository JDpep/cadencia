'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { FilaActividad } from './FilaActividad';
import { TarjetaKanban } from './TarjetaKanban';
import { FichaActividad } from './FichaActividad';
import {
  accionCambiarEstado,
  accionCrearRapida,
  accionMoverTablero,
  accionReordenar,
} from '@/lib/acciones/actividades';
import {
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  PESO_PRIORIDAD,
  PRIORIDADES,
  type Estado,
  type Prioridad,
} from '@/lib/dominio';
import type { ActividadVista } from '@/lib/repos/actividades';
import { cn } from '@/lib/utils';

type Categoria = { id: string; nombre: string; colorToken: string; icono: string | null };
type ClienteMini = { id: string; nombreEmpresa: string };

type Vista = 'lista' | 'kanban';
type Agrupacion = 'ninguno' | 'estado' | 'prioridad' | 'categoria' | 'cliente';

const ETIQUETA_AGRUPACION: Record<Agrupacion, string> = {
  ninguno: 'Sin agrupar',
  estado: 'Estado',
  prioridad: 'Prioridad',
  categoria: 'Categoría',
  cliente: 'Cliente',
};

export function TableroActividades({
  actividades,
  categorias,
  clientes,
}: {
  actividades: ActividadVista[];
  categorias: Categoria[];
  clientes: ClienteMini[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, iniciar] = useTransition();

  const [items, setItems] = useState(actividades);
  const [vista, setVista] = useState<Vista>('lista');
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('estado');

  const [busqueda, setBusqueda] = useState('');
  const [fPrioridad, setFPrioridad] = useState<Prioridad | 'todas'>('todas');
  const [fCategoria, setFCategoria] = useState('todas');
  const [fCliente, setFCliente] = useState('todos');
  const [fFecha, setFFecha] = useState<'todas' | 'con_fecha' | 'sin_fecha'>('todas');
  const [verHechas, setVerHechas] = useState(true);

  const [ficha, setFicha] = useState<{ abierta: boolean; actividad: ActividadVista | null }>({
    abierta: false,
    actividad: null,
  });
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [nuevoTitulo, setNuevoTitulo] = useState('');

  // Los datos del servidor mandan; el estado local sólo adelanta la UI.
  useEffect(() => setItems(actividades), [actividades]);

  // El buscador global (⌘K) puede pedir abrir una actividad concreta.
  useEffect(() => {
    const abrir = params.get('abrir');
    if (!abrir) return;
    const a = actividades.find((x) => x.id === abrir);
    if (a) setFicha({ abierta: true, actividad: a });
  }, [params, actividades]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // --- Filtrado ------------------------------------------------------------
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();

    return items.filter((a) => {
      if (!verHechas && a.estado === 'hecha') return false;
      if (fPrioridad !== 'todas' && a.prioridad !== fPrioridad) return false;
      if (fCategoria !== 'todas' && a.categoria?.id !== fCategoria) return false;
      if (fCliente !== 'todos' && a.cliente?.id !== fCliente) return false;
      if (fFecha === 'con_fecha' && !a.clave) return false;
      if (fFecha === 'sin_fecha' && a.clave) return false;
      if (q) {
        const heno = `${a.titulo} ${a.descripcion ?? ''} ${a.cliente?.nombreEmpresa ?? ''}`;
        if (!heno.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, busqueda, fPrioridad, fCategoria, fCliente, fFecha, verHechas]);

  const avance = useMemo(() => {
    const total = items.length;
    const hechas = items.filter((a) => a.estado === 'hecha').length;
    return { total, hechas, pct: total ? Math.round((hechas / total) * 100) : 0 };
  }, [items]);

  // --- Agrupación ----------------------------------------------------------
  const grupos = useMemo(() => {
    if (agrupacion === 'ninguno') {
      return [{ llave: 'todo', titulo: 'Todas', items: filtradas }];
    }

    if (agrupacion === 'estado') {
      return ESTADOS.map((e) => ({
        llave: e,
        titulo: ETIQUETA_ESTADO[e],
        items: filtradas.filter((a) => a.estado === e),
      }));
    }

    if (agrupacion === 'prioridad') {
      return [...PRIORIDADES]
        .sort((a, b) => PESO_PRIORIDAD[a] - PESO_PRIORIDAD[b])
        .map((p) => ({
          llave: p,
          titulo: ETIQUETA_PRIORIDAD[p],
          items: filtradas.filter((a) => a.prioridad === p),
        }));
    }

    if (agrupacion === 'categoria') {
      return [
        ...categorias.map((c) => ({
          llave: c.id,
          titulo: c.nombre,
          items: filtradas.filter((a) => a.categoria?.id === c.id),
        })),
        { llave: 'sin', titulo: 'Sin categoría', items: filtradas.filter((a) => !a.categoria) },
      ];
    }

    return [
      ...clientes.map((c) => ({
        llave: c.id,
        titulo: c.nombreEmpresa,
        items: filtradas.filter((a) => a.cliente?.id === c.id),
      })),
      { llave: 'sin', titulo: 'Sin cliente', items: filtradas.filter((a) => !a.cliente) },
    ];
  }, [agrupacion, filtradas, categorias, clientes]);

  const gruposVisibles = grupos.filter((g) => g.items.length > 0 || agrupacion === 'estado');

  // --- Acciones ------------------------------------------------------------
  function palomear(a: ActividadVista, hecha: boolean) {
    const estado: Estado = hecha ? 'hecha' : 'por_hacer';
    setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, estado } : x)));

    iniciar(async () => {
      const r = await accionCambiarEstado(a.id, estado);
      if (!r.ok) {
        setItems(actividades); // revierte
        alert(r.error);
      }
      router.refresh();
    });
  }

  function altaRapida() {
    const titulo = nuevoTitulo.trim();
    if (!titulo) return;
    setNuevoTitulo('');

    iniciar(async () => {
      const r = await accionCrearRapida(titulo);
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  function alIniciarArrastre(e: DragStartEvent) {
    setArrastrando(String(e.active.id));
  }

  function alTerminarArrastre(e: DragEndEvent) {
    setArrastrando(null);
    const { active, over } = e;
    if (!over) return;

    const activoId = String(active.id);
    const sobreId = String(over.id);
    if (activoId === sobreId) return;

    // --- Kanban: puede cambiar de columna ---
    if (vista === 'kanban') {
      const destino: Estado | null = sobreId.startsWith('col:')
        ? (sobreId.slice(4) as Estado)
        : (items.find((x) => x.id === sobreId)?.estado ?? null);
      if (!destino) return;

      const actual = items.find((x) => x.id === activoId);
      if (!actual) return;

      const sinActivo = items.filter((x) => x.id !== activoId);
      const movida = { ...actual, estado: destino };

      // Se inserta justo donde se soltó.
      const idx = sobreId.startsWith('col:')
        ? sinActivo.length
        : sinActivo.findIndex((x) => x.id === sobreId);

      const nuevos = [...sinActivo];
      nuevos.splice(idx < 0 ? nuevos.length : idx, 0, movida);
      setItems(nuevos);

      const idsColumna = nuevos.filter((x) => x.estado === destino).map((x) => x.id);

      iniciar(async () => {
        const r = await accionMoverTablero(activoId, destino, idsColumna);
        if (!r.ok) {
          setItems(actividades);
          alert(r.error);
        }
        router.refresh();
      });
      return;
    }

    // --- Lista: sólo reordena ---
    const desde = items.findIndex((x) => x.id === activoId);
    const hasta = items.findIndex((x) => x.id === sobreId);
    if (desde < 0 || hasta < 0) return;

    const nuevos = arrayMove(items, desde, hasta);
    setItems(nuevos);

    iniciar(async () => {
      const r = await accionReordenar(nuevos.map((x) => x.id));
      if (!r.ok) {
        setItems(actividades);
        alert(r.error);
      }
      router.refresh();
    });
  }

  const enArrastre = arrastrando ? items.find((x) => x.id === arrastrando) : null;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Actividades</h1>
          <p className="mt-1 text-sm text-texto-3">
            {avance.hechas} de {avance.total} hechas · {avance.pct}% de avance
          </p>
          <div className="mt-2 h-1.5 w-56 max-w-full overflow-hidden rounded-full bg-superficie-3">
            <div
              className="h-full rounded-full bg-verde-forja transition-all duration-500"
              style={{ width: `${avance.pct}%` }}
            />
          </div>
        </div>

        {/* Cambio de vista */}
        <div className="flex items-center gap-1 rounded-forja border border-borde bg-superficie-2 p-1">
          {(['lista', 'kanban'] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={cn(
                'rounded-[9px] px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                vista === v ? 'bg-terracota text-hueso' : 'text-texto-3 hover:bg-superficie-3',
              )}
            >
              {v}
            </button>
          ))}
          <Link
            href="/agenda"
            className="rounded-[9px] px-3 py-1.5 text-sm font-medium text-texto-3 transition-colors hover:bg-superficie-3"
          >
            Calendario
          </Link>
        </div>
      </div>

      {/* Alta rápida */}
      <div className="tarjeta flex items-center gap-2 p-2 shadow-forja">
        <span className="pl-2 text-texto-4" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
        </span>
        <input
          value={nuevoTitulo}
          onChange={(e) => setNuevoTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              altaRapida();
            }
          }}
          placeholder="Escribe una actividad y presiona Enter…"
          aria-label="Nueva actividad"
          className="flex-1 bg-transparent py-2 text-sm text-texto placeholder:text-texto-4 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setFicha({ abierta: true, actividad: null })}
          className="btn-secundario shrink-0 py-1.5 text-xs"
        >
          Ficha completa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar…"
          aria-label="Buscar actividades"
          className="campo w-48"
        />

        <select
          value={fPrioridad}
          onChange={(e) => setFPrioridad(e.target.value as Prioridad | 'todas')}
          aria-label="Filtrar por prioridad"
          className="campo w-auto"
        >
          <option value="todas">Toda prioridad</option>
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {ETIQUETA_PRIORIDAD[p]}
            </option>
          ))}
        </select>

        <select
          value={fCategoria}
          onChange={(e) => setFCategoria(e.target.value)}
          aria-label="Filtrar por categoría"
          className="campo w-auto"
        >
          <option value="todas">Toda categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select
          value={fCliente}
          onChange={(e) => setFCliente(e.target.value)}
          aria-label="Filtrar por cliente"
          className="campo w-auto"
        >
          <option value="todos">Todo cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombreEmpresa}
            </option>
          ))}
        </select>

        <select
          value={fFecha}
          onChange={(e) => setFFecha(e.target.value as typeof fFecha)}
          aria-label="Filtrar por fecha"
          className="campo w-auto"
        >
          <option value="todas">Con y sin fecha</option>
          <option value="con_fecha">Con fecha</option>
          <option value="sin_fecha">Sin fecha</option>
        </select>

        {vista === 'lista' ? (
          <select
            value={agrupacion}
            onChange={(e) => setAgrupacion(e.target.value as Agrupacion)}
            aria-label="Agrupar por"
            className="campo w-auto"
          >
            {(Object.keys(ETIQUETA_AGRUPACION) as Agrupacion[]).map((a) => (
              <option key={a} value={a}>
                Agrupar: {ETIQUETA_AGRUPACION[a]}
              </option>
            ))}
          </select>
        ) : null}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-texto-3">
          <input
            type="checkbox"
            checked={verHechas}
            onChange={(e) => setVerHechas(e.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--verde-forja))]"
          />
          Ver hechas
        </label>
      </div>

      {/* Tablero */}
      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={alIniciarArrastre}
        onDragEnd={alTerminarArrastre}
      >
        {vista === 'lista' ? (
          <div className="space-y-4">
            {gruposVisibles.map((g) => (
              <section key={g.llave} className="tarjeta overflow-hidden shadow-forja">
                <header className="flex items-center justify-between gap-3 border-b border-borde bg-superficie-3/50 px-4 py-2.5">
                  <h2 className="text-sm font-semibold text-texto">{g.titulo}</h2>
                  <span className="text-xs text-texto-4">{g.items.length}</span>
                </header>

                {g.items.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-texto-4">
                    Nada por aquí.
                  </p>
                ) : (
                  <SortableContext
                    items={g.items.map((a) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul>
                      {g.items.map((a) => (
                        <FilaActividad
                          key={a.id}
                          actividad={a}
                          alAbrir={() => setFicha({ abierta: true, actividad: a })}
                          alPalomear={(h) => palomear(a, h)}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {ESTADOS.map((e) => (
              <ColumnaKanban
                key={e}
                estado={e}
                items={filtradas.filter((a) => a.estado === e)}
                alAbrir={(a) => setFicha({ abierta: true, actividad: a })}
                alPalomear={palomear}
              />
            ))}
          </div>
        )}

        <DragOverlay dropAnimation={null}>
          {enArrastre ? (
            <div className="rounded-forja border border-terracota/40 bg-superficie-2 px-3 py-2 text-sm font-medium text-texto shadow-forja-alto">
              {enArrastre.titulo}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {filtradas.length === 0 ? (
        <p className="tarjeta px-4 py-10 text-center text-sm text-texto-4">
          No hay actividades con estos filtros.
        </p>
      ) : null}

      <FichaActividad
        abierta={ficha.abierta}
        alCerrar={() => setFicha({ abierta: false, actividad: null })}
        actividad={ficha.actividad}
        categorias={categorias}
        clientes={clientes}
      />
    </div>
  );
}

function ColumnaKanban({
  estado,
  items,
  alAbrir,
  alPalomear,
}: {
  estado: Estado;
  items: ActividadVista[];
  alAbrir: (a: ActividadVista) => void;
  alPalomear: (a: ActividadVista, hecha: boolean) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${estado}` });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-[12rem] flex-col rounded-forja border bg-superficie-3/40 p-2.5 transition-colors',
        isOver ? 'border-terracota bg-terracota/10' : 'border-borde',
      )}
    >
      <header className="mb-2.5 flex items-center justify-between gap-2 px-1.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-texto">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              estado === 'hecha'
                ? 'bg-verde-forja'
                : estado === 'en_proceso'
                  ? 'bg-ocre'
                  : 'bg-texto-4',
            )}
          />
          {ETIQUETA_ESTADO[estado]}
        </h2>
        <span className="text-xs text-texto-4">{items.length}</span>
      </header>

      <SortableContext items={items.map((a) => a.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-1 flex-col gap-2">
          {items.map((a) => (
            <TarjetaKanban
              key={a.id}
              actividad={a}
              alAbrir={() => alAbrir(a)}
              alPalomear={(h) => alPalomear(a, h)}
            />
          ))}
          {items.length === 0 ? (
            <li className="flex flex-1 items-center justify-center rounded-forja border border-dashed border-borde py-8 text-xs text-texto-4">
              Arrastra aquí
            </li>
          ) : null}
        </ul>
      </SortableContext>
    </section>
  );
}
