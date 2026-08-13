'use client';

import {
  ETIQUETA_FRECUENCIA,
  ETIQUETA_REAJUSTE,
  FRECUENCIAS,
  REGLAS_REAJUSTE,
  type Frecuencia,
  type ReglaReajuste,
  type Terminacion,
} from '@/lib/dominio';
import { describirRegla, REGLA_POR_DEFECTO, type ReglaRecurrencia } from '@/lib/recurrence';
import { cn } from '@/lib/utils';

const DIAS = [
  { valor: 1, corto: 'L', largo: 'Lunes', habil: true },
  { valor: 2, corto: 'M', largo: 'Martes', habil: true },
  { valor: 3, corto: 'X', largo: 'Miércoles', habil: true },
  { valor: 4, corto: 'J', largo: 'Jueves', habil: true },
  { valor: 5, corto: 'V', largo: 'Viernes', habil: true },
  { valor: 6, corto: 'S', largo: 'Sábado', habil: false },
  { valor: 0, corto: 'D', largo: 'Domingo', habil: false },
];

const POSICIONES = [
  { valor: 1, texto: 'primer' },
  { valor: 2, texto: 'segundo' },
  { valor: 3, texto: 'tercer' },
  { valor: 4, texto: 'cuarto' },
  { valor: -1, texto: 'último' },
];

export function EditorRecurrencia({
  regla,
  alCambiar,
}: {
  regla: ReglaRecurrencia | null;
  alCambiar: (r: ReglaRecurrencia | null) => void;
}) {
  const activa = regla !== null;
  const r = regla ?? REGLA_POR_DEFECTO;

  const set = (parcial: Partial<ReglaRecurrencia>) => alCambiar({ ...r, ...parcial });

  const porDias = r.frecuencia === 'semanal' || r.frecuencia === 'quincenal';
  const cuentaHabiles =
    r.frecuencia === 'dias_habiles' || r.frecuencia === 'cada_n_habiles';

  return (
    <div className="rounded-forja border border-borde bg-superficie p-3.5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={activa}
          onChange={(e) => alCambiar(e.target.checked ? REGLA_POR_DEFECTO : null)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--terracota))]"
        />
        <span>
          <span className="block text-sm font-semibold text-texto">Se repite</span>
          <span className="block text-xs text-texto-4">
            Nunca cae en sábado ni domingo.
          </span>
        </span>
      </label>

      {!activa ? null : (
        <div className="mt-4 space-y-4 border-t border-borde pt-4">
          {/* Frecuencia */}
          <div>
            <label htmlFor="rec-frecuencia" className="etiqueta-campo">
              Frecuencia
            </label>
            <select
              id="rec-frecuencia"
              value={r.frecuencia}
              onChange={(e) => set({ frecuencia: e.target.value as Frecuencia })}
              className="campo"
            >
              {FRECUENCIAS.map((f) => (
                <option key={f} value={f}>
                  {ETIQUETA_FRECUENCIA[f]}
                </option>
              ))}
            </select>
          </div>

          {/* Cada N días hábiles */}
          {r.frecuencia === 'cada_n_habiles' ? (
            <div>
              <label htmlFor="rec-intervalo" className="etiqueta-campo">
                Cada cuántos días hábiles
              </label>
              <input
                id="rec-intervalo"
                type="number"
                min={1}
                max={60}
                value={r.intervalo}
                onChange={(e) => set({ intervalo: Math.max(1, Number(e.target.value) || 1) })}
                className="campo w-28"
              />
              <p className="mt-1 text-xs text-texto-4">
                Sólo cuenta días laborables: sábado y domingo no suman.
              </p>
            </div>
          ) : null}

          {/* Días de la semana */}
          {porDias ? (
            <fieldset>
              <legend className="etiqueta-campo">Días</legend>
              <div className="flex flex-wrap gap-1.5">
                {DIAS.map((d) => {
                  const elegido = r.dias.includes(d.valor);
                  const bloqueado = !d.habil && r.omitirFinDeSemana;
                  return (
                    <button
                      key={d.valor}
                      type="button"
                      disabled={bloqueado}
                      title={
                        bloqueado
                          ? `${d.largo} está desactivado porque se omite el fin de semana`
                          : d.largo
                      }
                      aria-pressed={elegido}
                      onClick={() =>
                        set({
                          dias: elegido
                            ? r.dias.filter((x) => x !== d.valor)
                            : [...r.dias, d.valor].sort(),
                        })
                      }
                      className={cn(
                        'h-9 w-9 rounded-forja border text-sm font-semibold transition-all',
                        elegido
                          ? 'border-terracota bg-terracota text-hueso'
                          : 'border-borde bg-superficie-2 text-texto-3 hover:border-texto-4',
                        bloqueado && 'cursor-not-allowed opacity-35 hover:border-borde',
                      )}
                    >
                      <span aria-hidden="true">{d.corto}</span>
                      <span className="sr-only">{d.largo}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-texto-4">
                Sábado y domingo vienen desactivados. Se habilitan si apagas «Evitar fin
                de semana».
              </p>
            </fieldset>
          ) : null}

          {/* Mensual por día del mes */}
          {r.frecuencia === 'mensual_dia' ? (
            <div>
              <label htmlFor="rec-diames" className="etiqueta-campo">
                Día del mes
              </label>
              <input
                id="rec-diames"
                type="number"
                min={1}
                max={31}
                value={r.diaMes ?? 1}
                onChange={(e) =>
                  set({ diaMes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
                }
                className="campo w-28"
              />
            </div>
          ) : null}

          {/* Mensual por posición */}
          {r.frecuencia === 'mensual_posicion' ? (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="rec-posicion" className="etiqueta-campo">
                  Posición
                </label>
                <select
                  id="rec-posicion"
                  value={r.posicion ?? 1}
                  onChange={(e) => set({ posicion: Number(e.target.value) })}
                  className="campo w-36"
                >
                  {POSICIONES.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.texto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="rec-diapos" className="etiqueta-campo">
                  Día
                </label>
                <select
                  id="rec-diapos"
                  value={r.diaSemanaPos ?? 1}
                  onChange={(e) => set({ diaSemanaPos: Number(e.target.value) })}
                  className="campo w-40"
                >
                  {DIAS.map((d) => (
                    <option key={d.valor} value={d.valor}>
                      {d.largo}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          {/* Regla de fin de semana */}
          <div className="rounded-forja border border-borde bg-superficie-2 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={r.omitirFinDeSemana}
                onChange={(e) => set({ omitirFinDeSemana: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--terracota))]"
              />
              <span className="text-sm text-texto-2">
                Evitar fin de semana
                <span className="block text-xs text-texto-4">
                  {cuentaHabiles
                    ? 'Esta frecuencia sólo cuenta días hábiles: nunca genera sábados ni domingos.'
                    : 'Lo que caiga en sábado o domingo se recorre.'}
                </span>
              </span>
            </label>

            {r.omitirFinDeSemana && !cuentaHabiles ? (
              <div className="mt-3">
                <label htmlFor="rec-reajuste" className="etiqueta-campo">
                  Si cae en fin de semana
                </label>
                <select
                  id="rec-reajuste"
                  value={r.reglaReajuste}
                  onChange={(e) => set({ reglaReajuste: e.target.value as ReglaReajuste })}
                  className="campo"
                >
                  {REGLAS_REAJUSTE.map((rr) => (
                    <option key={rr} value={rr}>
                      {ETIQUETA_REAJUSTE[rr]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="mt-3 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={r.respetarFestivos}
                onChange={(e) => set({ respetarFestivos: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--terracota))]"
              />
              <span className="text-sm text-texto-2">
                Respetar días festivos
                <span className="block text-xs text-texto-4">
                  Usa el catálogo de festivos que configura Administración.
                </span>
              </span>
            </label>
          </div>

          {/* Terminación */}
          <div>
            <label htmlFor="rec-termina" className="etiqueta-campo">
              Termina
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                id="rec-termina"
                value={r.terminacion}
                onChange={(e) => set({ terminacion: e.target.value as Terminacion })}
                className="campo w-44"
              >
                <option value="nunca">Sin fin</option>
                <option value="hasta">En una fecha</option>
                <option value="conteo">Tras N ocurrencias</option>
              </select>

              {r.terminacion === 'hasta' ? (
                <input
                  type="date"
                  aria-label="Fecha de término"
                  value={r.hasta ?? ''}
                  onChange={(e) => set({ hasta: e.target.value || undefined })}
                  className="campo w-44"
                />
              ) : null}

              {r.terminacion === 'conteo' ? (
                <input
                  type="number"
                  aria-label="Número de ocurrencias"
                  min={1}
                  max={999}
                  value={r.conteo ?? 10}
                  onChange={(e) => set({ conteo: Math.max(1, Number(e.target.value) || 1) })}
                  className="campo w-28"
                />
              ) : null}
            </div>
          </div>

          <p className="rounded-forja bg-superficie-3 px-3 py-2 text-xs text-texto-3">
            <span className="font-semibold text-texto-2">Resumen: </span>
            {describirRegla(r)}
          </p>
        </div>
      )}
    </div>
  );
}
