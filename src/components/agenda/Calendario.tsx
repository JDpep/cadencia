'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  FichaActividad,
  type ContextoOcurrencia,
} from '@/components/actividades/FichaActividad';
import { FilaAgenda } from './FilaAgenda';
import { PuntoPrioridad } from '@/components/ui/Insignias';
import {
  accionMoverOcurrencia,
  accionReprogramar,
} from '@/lib/acciones/actividades';
import { estiloCategoria } from '@/lib/dominio';
import type { ActividadVista, ItemAgenda } from '@/lib/repos/actividades';
import {
  fmtClave,
  hoyClave,
  inicioSemana,
  NOMBRES_DIA,
  rangoSemana,
  rejillaMes,
  sumarDias,
  type ClaveDia,
} from '@/lib/tiempo';
import { cn } from '@/lib/utils';

export type VistaCalendario = 'dia' | 'semana' | 'mes';

const HORA_INICIO = 7;
const HORA_FIN = 21;
const ALTO_HORA = 56; // px por hora en las vistas de rejilla

type Categoria = { id: string; nombre: string; colorToken: string; icono: string | null };

export function Calendario({
  items,
  vista,
  foco,
  festivos,
  /**
   * Días en que el ejecutivo está fuera (vacaciones aprobadas), clave → tipo.
   * No bloquea la interacción a propósito: se puede seguir agendando sobre una
   * ausencia, pero la agenda lo dice en voz alta.
   */
  ausencias,
  categorias,
  clientes,
}: {
  items: ItemAgenda[];
  vista: VistaCalendario;
  foco: ClaveDia;
  festivos: Record<string, string>;
  ausencias: Record<string, string>;
  categorias: Categoria[];
  clientes: { id: string; nombreEmpresa: string }[];
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const hoy = hoyClave();

  const [arrastrando, setArrastrando] = useState<ItemAgenda | null>(null);
  const [minutosAhora, setMinutosAhora] = useState<number | null>(null);
  const [ficha, setFicha] = useState<{
    abierta: boolean;
    actividad: ActividadVista | null;
    ocurrencia: ContextoOcurrencia;
    clave: ClaveDia | null;
    hora: string | null;
  }>({ abierta: false, actividad: null, ocurrencia: null, clave: null, hora: null });

  // Línea de "ahora" — se recalcula cada minuto.
  useEffect(() => {
    function actualizar() {
      const local = new Date().toLocaleTimeString('es-MX', {
        timeZone: 'America/Mexico_City',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });
      const [h, m] = local.split(':').map(Number);
      setMinutosAhora(h * 60 + m);
    }
    actualizar();
    const t = setInterval(actualizar, 60_000);
    return () => clearInterval(t);
  }, []);

  const dias = useMemo(() => {
    if (vista === 'dia') return [foco];
    if (vista === 'semana') return rangoSemana(foco);
    return rejillaMes(foco);
  }, [vista, foco]);

  const porDia = useMemo(() => {
    const mapa = new Map<ClaveDia, ItemAgenda[]>();
    for (const i of items) {
      const lista = mapa.get(i.clave) ?? [];
      lista.push(i);
      mapa.set(i.clave, lista);
    }
    return mapa;
  }, [items]);

  // --- Navegación ----------------------------------------------------------
  const navegar = useCallback(
    (nuevaVista: VistaCalendario, nuevoFoco: ClaveDia) => {
      router.push(`/agenda?vista=${nuevaVista}&fecha=${nuevoFoco}`, { scroll: false });
    },
    [router],
  );

  const mover = useCallback(
    (direccion: -1 | 1) => {
      const salto = vista === 'dia' ? 1 : vista === 'semana' ? 7 : 0;
      if (salto) {
        navegar(vista, sumarDias(foco, salto * direccion));
      } else {
        const [a, m] = foco.split('-').map(Number);
        const d = new Date(Date.UTC(a, m - 1 + direccion, 1));
        navegar(vista, d.toISOString().slice(0, 10));
      }
    },
    [vista, foco, navegar],
  );

  // Atajos: ← → mover · T hoy · D/S/M cambiar vista
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      const destino = e.target as HTMLElement;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino?.tagName)
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'arrowleft':
          e.preventDefault();
          mover(-1);
          break;
        case 'arrowright':
          e.preventDefault();
          mover(1);
          break;
        case 't':
          navegar(vista, hoy);
          break;
        case 'd':
          navegar('dia', foco);
          break;
        case 's':
          navegar('semana', foco);
          break;
        case 'm':
          navegar('mes', foco);
          break;
      }
    }

    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [mover, navegar, vista, foco, hoy]);

  // --- Abrir ficha ---------------------------------------------------------
  async function abrirItem(item: ItemAgenda) {
    const r = await fetch(`/api/actividades/${item.activityId}`);
    if (!r.ok) {
      alert('No se pudo abrir la actividad.');
      return;
    }
    const { actividad } = await r.json();

    setFicha({
      abierta: true,
      actividad,
      ocurrencia: item.fechaOriginal
        ? {
            activityId: item.activityId,
            fechaOriginal: item.fechaOriginal,
            // La hora YA resuelta de esta ocurrencia — la suya, no la de la serie.
            hora: item.hora,
          }
        : null,
      clave: null,
      hora: null,
    });
  }

  function crearEn(clave: ClaveDia, hora: string | null) {
    setFicha({ abierta: true, actividad: null, ocurrencia: null, clave, hora });
  }

  // --- Arrastre ------------------------------------------------------------
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function alSoltar(e: DragEndEvent) {
    const item = arrastrando;
    setArrastrando(null);
    if (!item || !e.over) return;

    const destino = String(e.over.id); // slot:<clave> | slot:<clave>:<HH:mm>
    if (!destino.startsWith('slot:')) return;

    const partes = destino.split(':');
    const clave = partes[1];
    const hora = partes.length > 3 ? `${partes[2]}:${partes[3]}` : (item.hora ?? null);

    if (clave === item.clave && hora === item.hora) return;

    iniciar(async () => {
      const r = item.fechaOriginal
        ? await accionMoverOcurrencia(item.activityId, item.fechaOriginal, clave, hora)
        : await accionReprogramar(item.activityId, clave, hora);

      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  const titulo =
    vista === 'dia'
      ? fmtClave(foco, "EEEE d 'de' MMMM yyyy")
      : vista === 'semana'
        ? `${fmtClave(inicioSemana(foco), 'd MMM')} – ${fmtClave(sumarDias(inicioSemana(foco), 6), "d MMM yyyy")}`
        : fmtClave(foco, 'MMMM yyyy');

  const itemsDelFoco = porDia.get(foco) ?? [];

  return (
    <div className="space-y-4">
      {/* Barra de control */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-forja border border-borde bg-superficie-2">
            <button
              type="button"
              onClick={() => mover(-1)}
              aria-label="Anterior"
              className="px-2.5 py-2 text-texto-3 transition-colors hover:text-texto"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => navegar(vista, hoy)}
              className="border-x border-borde px-3 py-2 text-sm font-medium text-texto-2 transition-colors hover:bg-superficie-3"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              aria-label="Siguiente"
              className="px-2.5 py-2 text-texto-3 transition-colors hover:text-texto"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <h1 className="text-lg font-semibold capitalize text-texto">{titulo}</h1>
        </div>

        <div className="flex items-center gap-1 rounded-forja border border-borde bg-superficie-2 p-1">
          {(
            [
              ['dia', 'Día'],
              ['semana', 'Semana'],
              ['mes', 'Mes'],
            ] as [VistaCalendario, string][]
          ).map(([v, texto]) => (
            <button
              key={v}
              type="button"
              onClick={() => navegar(v, foco)}
              aria-pressed={vista === v}
              className={cn(
                'rounded-[9px] px-3 py-1.5 text-sm font-medium transition-colors',
                vista === v ? 'bg-terracota text-hueso' : 'text-texto-3 hover:bg-superficie-3',
              )}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-texto-4">
        Atajos: <kbd className="rounded border border-borde px-1">←</kbd>{' '}
        <kbd className="rounded border border-borde px-1">→</kbd> mover ·{' '}
        <kbd className="rounded border border-borde px-1">T</kbd> hoy ·{' '}
        <kbd className="rounded border border-borde px-1">D</kbd>{' '}
        <kbd className="rounded border border-borde px-1">S</kbd>{' '}
        <kbd className="rounded border border-borde px-1">M</kbd> cambiar vista. Arrastra para
        mover una actividad; haz clic en un hueco para crearla ahí.
      </p>

      <DndContext
        sensors={sensores}
        collisionDetection={pointerWithin}
        onDragStart={(e) => {
          const llave = String(e.active.id);
          setArrastrando(items.find((i) => i.llave === llave) ?? null);
        }}
        onDragEnd={alSoltar}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <div className="min-w-0">
            {vista === 'mes' ? (
              <VistaMes
                dias={dias}
                foco={foco}
                hoy={hoy}
                porDia={porDia}
                festivos={festivos}
                ausencias={ausencias}
                alAbrir={abrirItem}
                alCrear={crearEn}
              />
            ) : (
              <VistaRejilla
                dias={dias}
                hoy={hoy}
                porDia={porDia}
                festivos={festivos}
                ausencias={ausencias}
                minutosAhora={minutosAhora}
                alAbrir={abrirItem}
                alCrear={crearEn}
              />
            )}
          </div>

          {/* Panel del día */}
          <aside className="tarjeta h-fit shadow-forja">
            <header className="border-b border-borde px-4 py-3">
              <h2 className="text-sm font-semibold capitalize text-texto">
                Agenda de {fmtClave(foco, "EEEE d 'de' MMMM")}
              </h2>
              <p className="mt-0.5 text-xs text-texto-4">
                {itemsDelFoco.length === 0
                  ? 'Sin actividades'
                  : `${itemsDelFoco.filter((i) => i.estado === 'hecha').length} de ${itemsDelFoco.length} hechas`}
              </p>
              {festivos[foco] ? (
                <p className="mt-1.5 inline-flex rounded-full border border-ocre/40 bg-ocre/15 px-2 py-0.5 text-[11px] text-texto-2">
                  Festivo · {festivos[foco]}
                </p>
              ) : null}
              {ausencias[foco] ? (
                <p className="mt-1.5 inline-flex rounded-full border border-verde-forja/30 bg-verde-forja/10 px-2 py-0.5 text-[11px] font-medium text-verde-forja">
                  No disponible · {ausencias[foco]}
                </p>
              ) : null}
            </header>

            {itemsDelFoco.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-texto-4">Este día está libre.</p>
                <button
                  type="button"
                  onClick={() => crearEn(foco, null)}
                  className="btn-secundario mt-3 py-1.5 text-xs"
                >
                  Agregar actividad
                </button>
              </div>
            ) : (
              <ul className="px-4 py-1">
                {itemsDelFoco.map((i) => (
                  <FilaAgenda key={i.llave} item={i} alAbrir={abrirItem} compacta />
                ))}
              </ul>
            )}
          </aside>
        </div>

        <DragOverlay dropAnimation={null}>
          {arrastrando ? (
            <div className="rounded-forja border border-terracota/40 bg-superficie-2 px-2.5 py-1.5 text-xs font-medium text-texto shadow-forja-alto">
              {arrastrando.titulo}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <FichaActividad
        abierta={ficha.abierta}
        alCerrar={() =>
          setFicha({ abierta: false, actividad: null, ocurrencia: null, clave: null, hora: null })
        }
        actividad={ficha.actividad}
        ocurrencia={ficha.ocurrencia}
        categorias={categorias}
        clientes={clientes}
        claveInicial={ficha.clave}
        horaInicial={ficha.hora}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vista Mes
// ---------------------------------------------------------------------------

function VistaMes({
  dias,
  foco,
  hoy,
  porDia,
  festivos,
  ausencias,
  alAbrir,
  alCrear,
}: {
  dias: ClaveDia[];
  foco: ClaveDia;
  hoy: ClaveDia;
  porDia: Map<ClaveDia, ItemAgenda[]>;
  festivos: Record<string, string>;
  ausencias: Record<string, string>;
  alAbrir: (i: ItemAgenda) => void;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  const mesFoco = foco.slice(0, 7);

  return (
    <div className="overflow-hidden rounded-forja border border-borde bg-superficie-2 shadow-forja">
      <div className="grid grid-cols-7 border-b border-borde bg-superficie-3/50">
        {NOMBRES_DIA.map((d, i) => (
          <div
            key={d}
            className={cn(
              'px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide',
              i >= 5 ? 'text-texto-4' : 'text-texto-3',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((clave) => (
          <CeldaMes
            key={clave}
            clave={clave}
            deOtroMes={clave.slice(0, 7) !== mesFoco}
            esHoy={clave === hoy}
            esFoco={clave === foco}
            festivo={festivos[clave]}
            ausencia={ausencias[clave]}
            items={porDia.get(clave) ?? []}
            alAbrir={alAbrir}
            alCrear={alCrear}
          />
        ))}
      </div>
    </div>
  );
}

function CeldaMes({
  clave,
  deOtroMes,
  esHoy,
  esFoco,
  festivo,
  ausencia,
  items,
  alAbrir,
  alCrear,
}: {
  clave: ClaveDia;
  deOtroMes: boolean;
  esHoy: boolean;
  esFoco: boolean;
  festivo?: string;
  ausencia?: string;
  items: ItemAgenda[];
  alAbrir: (i: ItemAgenda) => void;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${clave}` });
  const finDeSemana = [0, 6].includes(new Date(`${clave}T12:00:00Z`).getUTCDay());

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCrear(clave, null);
      }}
      className={cn(
        'min-h-[7rem] border-b border-r border-borde p-1.5 transition-colors last:border-r-0',
        deOtroMes && 'bg-superficie-3/30',
        finDeSemana && !deOtroMes && 'bg-superficie-3/20',
        esFoco && 'ring-1 ring-inset ring-terracota/40',
        ausencia && 'bg-verde-forja/[0.07]',
        isOver && 'bg-terracota/10',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => alCrear(clave, null)}
          className={cn(
            'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold transition-colors',
            esHoy
              ? 'bg-terracota text-hueso'
              : deOtroMes
                ? 'text-texto-4 hover:bg-superficie-3'
                : 'text-texto-2 hover:bg-superficie-3',
          )}
          title={`Agregar actividad el ${clave}`}
        >
          {Number(clave.slice(8, 10))}
        </button>
        {festivo ? (
          <span className="truncate text-[9px] text-ocre" title={festivo}>
            {festivo}
          </span>
        ) : null}
      </div>

      {ausencia ? (
        <p
          title={`Estás fuera: ${ausencia}`}
          className="mb-1 truncate rounded-[6px] border border-verde-forja/30 bg-verde-forja/15 px-1.5 py-0.5 text-[10px] font-medium text-verde-forja"
        >
          {ausencia}
        </p>
      ) : null}

      <ul className="space-y-1">
        {items.slice(0, 4).map((i) => (
          <ChipCalendario key={i.llave} item={i} alAbrir={alAbrir} />
        ))}
        {items.length > 4 ? (
          <li className="px-1 text-[10px] text-texto-4">+{items.length - 4} más</li>
        ) : null}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vistas Día y Semana (rejilla de horas)
// ---------------------------------------------------------------------------

function VistaRejilla({
  dias,
  hoy,
  porDia,
  festivos,
  ausencias,
  minutosAhora,
  alAbrir,
  alCrear,
}: {
  dias: ClaveDia[];
  hoy: ClaveDia;
  porDia: Map<ClaveDia, ItemAgenda[]>;
  festivos: Record<string, string>;
  ausencias: Record<string, string>;
  minutosAhora: number | null;
  alAbrir: (i: ItemAgenda) => void;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  const horas = Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i);
  const altoTotal = horas.length * ALTO_HORA;

  const topAhora =
    minutosAhora !== null && minutosAhora >= HORA_INICIO * 60 && minutosAhora <= HORA_FIN * 60
      ? ((minutosAhora - HORA_INICIO * 60) / 60) * ALTO_HORA
      : null;

  return (
    <div className="overflow-hidden rounded-forja border border-borde bg-superficie-2 shadow-forja">
      {/* Encabezado de días */}
      <div
        className="grid border-b border-borde bg-superficie-3/50"
        style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))` }}
      >
        <div />
        {dias.map((clave) => (
          <div
            key={clave}
            className={cn(
              'border-l border-borde px-2 py-2 text-center',
              clave === hoy && 'bg-terracota/10',
            )}
          >
            <p className="text-[11px] uppercase tracking-wide text-texto-4">
              {fmtClave(clave, 'EEE')}
            </p>
            <p
              className={cn(
                'text-sm font-semibold',
                clave === hoy ? 'text-terracota' : 'text-texto-2',
              )}
            >
              {Number(clave.slice(8, 10))}
            </p>
            {festivos[clave] ? (
              <p className="truncate text-[9px] text-ocre" title={festivos[clave]}>
                {festivos[clave]}
              </p>
            ) : null}
            {ausencias[clave] ? (
              <p
                className="truncate text-[9px] font-medium text-verde-forja"
                title={`Estás fuera: ${ausencias[clave]}`}
              >
                {ausencias[clave]}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {/* Franja de "todo el día" */}
      <div
        className="grid border-b border-borde"
        style={{ gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))` }}
      >
        <div className="px-1.5 py-2 text-right text-[10px] uppercase tracking-wide text-texto-4">
          Todo el día
        </div>
        {dias.map((clave) => {
          const sueltas = (porDia.get(clave) ?? []).filter((i) => !i.hora);
          return (
            <FranjaDia key={clave} clave={clave} items={sueltas} alAbrir={alAbrir} alCrear={alCrear} />
          );
        })}
      </div>

      {/* Rejilla horaria */}
      <div className="relative overflow-y-auto" style={{ maxHeight: '60vh' }}>
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `3.5rem repeat(${dias.length}, minmax(0, 1fr))`,
            height: altoTotal,
          }}
        >
          {/* Columna de horas */}
          <div className="relative">
            {horas.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-texto-4"
                style={{ top: (h - HORA_INICIO) * ALTO_HORA }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {dias.map((clave) => (
            <ColumnaDia
              key={clave}
              clave={clave}
              horas={horas}
              esHoy={clave === hoy}
              items={(porDia.get(clave) ?? []).filter((i) => i.hora)}
              topAhora={clave === hoy ? topAhora : null}
              alAbrir={alAbrir}
              alCrear={alCrear}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FranjaDia({
  clave,
  items,
  alAbrir,
  alCrear,
}: {
  clave: ClaveDia;
  items: ItemAgenda[];
  alAbrir: (i: ItemAgenda) => void;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${clave}` });

  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) alCrear(clave, null);
      }}
      className={cn(
        'min-h-[2.75rem] space-y-1 border-l border-borde p-1 transition-colors',
        isOver && 'bg-terracota/10',
      )}
    >
      {items.map((i) => (
        <ChipCalendario key={i.llave} item={i} alAbrir={alAbrir} />
      ))}
    </div>
  );
}

function ColumnaDia({
  clave,
  horas,
  esHoy,
  items,
  topAhora,
  alAbrir,
  alCrear,
}: {
  clave: ClaveDia;
  horas: number[];
  esHoy: boolean;
  items: ItemAgenda[];
  topAhora: number | null;
  alAbrir: (i: ItemAgenda) => void;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  return (
    <div className={cn('relative border-l border-borde', esHoy && 'bg-terracota/[0.04]')}>
      {horas.map((h) => (
        <HuecoHora key={h} clave={clave} hora={h} alCrear={alCrear} />
      ))}

      {/* Línea fina de la hora actual */}
      {topAhora !== null ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: topAhora }}
          aria-hidden="true"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-terracota" />
          <span className="h-px flex-1 bg-terracota" />
        </div>
      ) : null}

      {items.map((item) => {
        const [h, m] = (item.hora ?? '00:00').split(':').map(Number);
        const top = ((h * 60 + m - HORA_INICIO * 60) / 60) * ALTO_HORA;
        if (top < 0 || top > (HORA_FIN - HORA_INICIO) * ALTO_HORA) return null;

        return (
          <div key={item.llave} className="absolute inset-x-1 z-10" style={{ top: top + 1 }}>
            <ChipCalendario item={item} alAbrir={alAbrir} conHora />
          </div>
        );
      })}
    </div>
  );
}

function HuecoHora({
  clave,
  hora,
  alCrear,
}: {
  clave: ClaveDia;
  hora: number;
  alCrear: (c: ClaveDia, h: string | null) => void;
}) {
  const etiqueta = `${String(hora).padStart(2, '0')}:00`;
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${clave}:${etiqueta}` });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => alCrear(clave, etiqueta)}
      aria-label={`Crear actividad el ${clave} a las ${etiqueta}`}
      className={cn(
        'block w-full border-b border-borde/60 transition-colors hover:bg-superficie-3/60',
        isOver && 'bg-terracota/15',
      )}
      style={{ height: ALTO_HORA }}
    />
  );
}

// ---------------------------------------------------------------------------
// Chip arrastrable
// ---------------------------------------------------------------------------

function ChipCalendario({
  item,
  alAbrir,
  conHora,
}: {
  item: ItemAgenda;
  alAbrir: (i: ItemAgenda) => void;
  conHora?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.llave });
  const hecha = item.estado === 'hecha';

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => alAbrir(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          alAbrir(item);
        }
      }}
      title={`${item.hora ? `${item.hora} · ` : ''}${item.titulo}`}
      className={cn(
        'cursor-grab touch-none truncate rounded-[7px] border-l-[3px] bg-superficie px-1.5 py-1 text-[11px] shadow-sm transition-all active:cursor-grabbing',
        estiloCategoria(item.categoria?.colorToken).barraCalendario,
        hecha ? 'text-texto-4 line-through opacity-70' : 'text-texto-2',
        item.prioridad === 'urgente' && !hecha && 'font-semibold',
        isDragging && 'opacity-40',
      )}
    >
      <span className="flex items-center gap-1">
        <PuntoPrioridad prioridad={item.prioridad} className="h-1.5 w-1.5" />
        {conHora && item.hora ? (
          <span className="shrink-0 tabular-nums text-texto-4">{item.hora}</span>
        ) : null}
        <span className="truncate">{item.titulo}</span>
      </span>
    </div>
  );
}
