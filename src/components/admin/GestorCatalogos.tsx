'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChipCategoria } from '@/components/ui/Insignias';
import {
  accionAgregarFestivo,
  accionAlternarCategoria,
  accionEliminarFestivo,
  accionGuardarCategoria,
  accionPrivacidadTotal,
} from '@/lib/acciones/admin';
import { TOKENS_COLOR, estiloCategoria } from '@/lib/dominio';
import { fmtClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

type Categoria = {
  id: string;
  nombre: string;
  colorToken: string;
  icono: string | null;
  activo: boolean;
  esEntrevista: boolean;
};

type Festivo = { id: string; fecha: string; nombre: string };

export function GestorCatalogos({
  categorias,
  festivos,
  privacidadTotal,
  soloLectura,
}: {
  categorias: Categoria[];
  festivos: Festivo[];
  privacidadTotal: boolean;
  soloLectura: boolean;
}) {
  return (
    <div className="space-y-8">
      <SeccionCategorias categorias={categorias} soloLectura={soloLectura} />
      <SeccionFestivos festivos={festivos} soloLectura={soloLectura} />
      {!soloLectura ? <SeccionPrivacidad activada={privacidadTotal} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SeccionCategorias({
  categorias,
  soloLectura,
}: {
  categorias: Categoria[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    colorToken: 'arena',
    icono: '',
    esEntrevista: false,
  });

  function guardar(id: string | null) {
    if (!form.nombre.trim()) {
      setError('La categoría necesita un nombre.');
      return;
    }

    iniciar(async () => {
      const r = await accionGuardarCategoria(id, form);
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        setEditandoId(null);
        setForm({ nombre: '', colorToken: 'arena', icono: '', esEntrevista: false });
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-texto">Categorías</h2>
        <p className="mt-0.5 text-sm text-texto-3">
          Las etiquetas con las que cada ejecutivo clasifica sus actividades. La marcada como
          <span className="font-medium text-texto-2"> entrevista</span> alimenta el histórico de
          vacantes: cada actividad suya que se complete cuenta como una.
        </p>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categorias.map((c) => (
          <li
            key={c.id}
            className={cn(
              'tarjeta flex items-center justify-between gap-3 p-3',
              !c.activo && 'opacity-55',
            )}
          >
            {editandoId === c.id ? (
              <div className="flex-1 space-y-2">
                <input
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  aria-label="Nombre de la categoría"
                  className="campo text-sm"
                />
                <SelectorColor
                  valor={form.colorToken}
                  alCambiar={(colorToken) => setForm({ ...form, colorToken })}
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-texto-2">
                  <input
                    type="checkbox"
                    checked={form.esEntrevista}
                    onChange={(e) => setForm({ ...form, esEntrevista: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  Cuenta como vacante
                </label>
                <div className="flex gap-2">
                  <input
                    value={form.icono}
                    onChange={(e) => setForm({ ...form, icono: e.target.value })}
                    aria-label="Ícono"
                    placeholder="◆"
                    className="campo w-16 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => guardar(c.id)}
                    disabled={guardando}
                    className="btn-primario py-1.5 text-xs"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoId(null)}
                    className="btn-secundario py-1.5 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <ChipCategoria nombre={c.nombre} colorToken={c.colorToken} icono={c.icono} />
                  {c.esEntrevista ? (
                    <span
                      title="Sus actividades completadas cuentan como vacante"
                      className="rounded-full border border-terracota/30 bg-terracota/10 px-1.5 py-0.5 text-[10px] font-semibold text-terracota"
                    >
                      vacante
                    </span>
                  ) : null}
                </span>

                {!soloLectura ? (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoId(c.id);
                        setForm({
                          nombre: c.nombre,
                          colorToken: c.colorToken,
                          icono: c.icono ?? '',
                          esEntrevista: c.esEntrevista,
                        });
                      }}
                      className="btn-fantasma px-2 py-1 text-xs"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        iniciar(async () => {
                          const r = await accionAlternarCategoria(c.id);
                          if (!r.ok) alert(r.error);
                          router.refresh();
                        })
                      }
                      className="btn-fantasma px-2 py-1 text-xs"
                    >
                      {c.activo ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </li>
        ))}
      </ul>

      {!soloLectura && editandoId === null ? (
        <div className="tarjeta space-y-2 p-3">
          <p className="text-sm font-semibold text-texto">Nueva categoría</p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre"
              aria-label="Nombre de la nueva categoría"
              className="campo w-44"
            />
            <input
              value={form.icono}
              onChange={(e) => setForm({ ...form, icono: e.target.value })}
              placeholder="◆"
              aria-label="Ícono"
              className="campo w-16"
            />
            <SelectorColor
              valor={form.colorToken}
              alCambiar={(colorToken) => setForm({ ...form, colorToken })}
            />
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-xs text-texto-2">
              <input
                type="checkbox"
                checked={form.esEntrevista}
                onChange={(e) => setForm({ ...form, esEntrevista: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              Cuenta como vacante
            </label>
            <button
              type="button"
              onClick={() => guardar(null)}
              disabled={guardando}
              className="btn-secundario"
            >
              Agregar
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-terracota">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SelectorColor({
  valor,
  alCambiar,
}: {
  valor: string;
  alCambiar: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label="Color de la categoría">
      {TOKENS_COLOR.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={valor === t}
          aria-label={t}
          title={t}
          onClick={() => alCambiar(t)}
          className={cn(
            'h-7 w-7 rounded-full border-2 transition-all',
            estiloCategoria(t).punto,
            valor === t ? 'border-texto scale-110' : 'border-transparent hover:border-borde-2',
          )}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SeccionFestivos({
  festivos,
  soloLectura,
}: {
  festivos: Festivo[];
  soloLectura: boolean;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [fecha, setFecha] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  function agregar() {
    iniciar(async () => {
      const r = await accionAgregarFestivo(fecha, nombre);
      if (!r.ok) setError(r.error);
      else {
        setError(null);
        setFecha('');
        setNombre('');
        router.refresh();
      }
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-texto">Días festivos</h2>
        <p className="mt-0.5 text-sm text-texto-3">
          Las actividades recurrentes que caigan en estas fechas se recorren al siguiente día
          hábil.
        </p>
      </div>

      {!soloLectura ? (
        <div className="tarjeta flex flex-wrap items-end gap-2 p-3">
          <div>
            <label htmlFor="fest-fecha" className="etiqueta-campo">Fecha</label>
            <input
              id="fest-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo w-44"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="fest-nombre" className="etiqueta-campo">Nombre</label>
            <input
              id="fest-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Día de la Constitución"
              className="campo"
            />
          </div>
          <button type="button" onClick={agregar} disabled={guardando} className="btn-secundario">
            Agregar
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-terracota">
          {error}
        </p>
      ) : null}

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {festivos.map((f) => (
          <li key={f.id} className="tarjeta flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-texto-2">{f.nombre}</p>
              <p className="text-xs tabular-nums text-texto-4">
                {fmtClave(f.fecha, "EEE d 'de' MMMM yyyy")}
              </p>
            </div>
            {!soloLectura ? (
              <button
                type="button"
                aria-label={`Eliminar ${f.nombre}`}
                onClick={() =>
                  iniciar(async () => {
                    const r = await accionEliminarFestivo(f.id);
                    if (!r.ok) alert(r.error);
                    router.refresh();
                  })
                }
                className="shrink-0 rounded p-1 text-texto-4 transition-colors hover:text-terracota"
              >
                <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" strokeLinecap="round" />
                </svg>
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SeccionPrivacidad({ activada }: { activada: boolean }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [valor, setValor] = useState(activada);

  function alternar(nuevo: boolean) {
    setValor(nuevo);
    iniciar(async () => {
      const r = await accionPrivacidadTotal(nuevo);
      if (!r.ok) {
        setValor(!nuevo);
        alert(r.error);
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-texto">Privacidad de clientes</h2>
        <p className="mt-0.5 text-sm text-texto-3">
          Por omisión, Administración y Dirección ven todo el directorio para poder
          administrarlo.
        </p>
      </div>

      <label className="tarjeta flex cursor-pointer items-start gap-3 p-4">
        <input
          type="checkbox"
          checked={valor}
          disabled={guardando}
          onChange={(e) => alternar(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>
          <span className="block text-sm font-semibold text-texto">
            Privacidad total de carteras
          </span>
          <span className="mt-0.5 block text-sm text-texto-3">
            Con esto activado, cada ejecutivo ve <strong>únicamente</strong> sus propios
            clientes — nadie más, ni Administración ni Dirección. El traspaso de cartera sigue
            disponible para Administración.
          </span>
        </span>
      </label>
    </section>
  );
}
