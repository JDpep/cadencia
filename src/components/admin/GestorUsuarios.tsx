'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialogo } from '@/components/ui/Dialogo';
import { accionActualizarUsuario, accionCrearUsuario } from '@/lib/acciones/admin';
import { ETIQUETA_ROL, ROLES, type Rol } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type UsuarioFila = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  puesto: string | null;
  activo: boolean;
  _count: { clients: number; activities: number };
};

export function GestorUsuarios({ usuarios }: { usuarios: UsuarioFila[] }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<UsuarioFila | null>(null);
  const [nuevo, setNuevo] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    rol: 'usuario' as Rol,
    puesto: '',
    password: '',
  });

  function abrirNuevo() {
    setForm({ nombre: '', email: '', rol: 'usuario', puesto: '', password: '' });
    setError(null);
    setNuevo(true);
  }

  function abrirEdicion(u: UsuarioFila) {
    setForm({
      nombre: u.nombre,
      email: u.email,
      rol: u.rol as Rol,
      puesto: u.puesto ?? '',
      password: '',
    });
    setError(null);
    setEditando(u);
  }

  function guardar() {
    if (!form.nombre.trim() || !form.email.trim()) {
      setError('Nombre y correo son obligatorios.');
      return;
    }

    iniciar(async () => {
      const r = editando
        ? await accionActualizarUsuario(editando.id, {
            nombre: form.nombre,
            email: form.email,
            rol: form.rol,
            puesto: form.puesto,
            ...(form.password ? { password: form.password } : {}),
          })
        : await accionCrearUsuario(form);

      if (!r.ok) setError(r.error);
      else {
        setNuevo(false);
        setEditando(null);
        router.refresh();
      }
    });
  }

  function alternarActivo(u: UsuarioFila) {
    iniciar(async () => {
      const r = await accionActualizarUsuario(u.id, { activo: !u.activo });
      if (!r.ok) alert(r.error);
      router.refresh();
    });
  }

  const abierto = nuevo || editando !== null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-texto">Usuarios</h2>
          <p className="mt-0.5 text-sm text-texto-3">
            Altas, bajas y roles. Siempre debe quedar al menos un administrador activo.
          </p>
        </div>
        <button type="button" onClick={abrirNuevo} className="btn-primario">
          Nuevo usuario
        </button>
      </div>

      <div className="tarjeta overflow-hidden shadow-forja">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-texto-4">
                <th scope="col" className="px-4 py-2.5 font-semibold">Persona</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Rol</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Clientes</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Actividades</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Estado</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b border-borde last:border-b-0 hover:bg-superficie-3/50',
                    !u.activo && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="block font-medium text-texto">{u.nombre}</span>
                    <span className="block text-xs text-texto-4">{u.email}</span>
                    {u.puesto ? (
                      <span className="block text-xs text-texto-4">{u.puesto}</span>
                    ) : null}
                  </td>

                  <td className="px-3 py-3">
                    <span className="rounded-full border border-borde bg-superficie px-2 py-0.5 text-[11px] text-texto-3">
                      {ETIQUETA_ROL[u.rol as Rol] ?? u.rol}
                    </span>
                  </td>

                  <td className="px-3 py-3 text-right tabular-nums text-texto-3">
                    {u._count.clients}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-texto-3">
                    {u._count.activities}
                  </td>

                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs',
                        u.activo ? 'text-verde-forja' : 'text-texto-4',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          u.activo ? 'bg-verde-forja' : 'bg-texto-4',
                        )}
                      />
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => abrirEdicion(u)}
                        className="btn-fantasma px-2 py-1 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarActivo(u)}
                        disabled={guardando}
                        className="btn-fantasma px-2 py-1 text-xs"
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialogo
        abierto={abierto}
        alCerrar={() => {
          setNuevo(false);
          setEditando(null);
        }}
        titulo={editando ? 'Editar usuario' : 'Nuevo usuario'}
        ancho="sm"
        pie={
          <>
            <button
              type="button"
              onClick={() => {
                setNuevo(false);
                setEditando(null);
              }}
              className="btn-secundario"
            >
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando} className="btn-primario">
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="u-nombre" className="etiqueta-campo">Nombre</label>
            <input
              id="u-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="u-email" className="etiqueta-campo">Correo</label>
            <input
              id="u-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="campo"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="u-rol" className="etiqueta-campo">Rol</label>
              <select
                id="u-rol"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
                className="campo"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ETIQUETA_ROL[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="u-puesto" className="etiqueta-campo">Puesto</label>
              <input
                id="u-puesto"
                value={form.puesto}
                onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                className="campo"
                placeholder="Ejecutiva de cuenta"
              />
            </div>
          </div>

          <div>
            <label htmlFor="u-pass" className="etiqueta-campo">
              Contraseña{' '}
              <span className="font-normal normal-case text-texto-4">
                {editando ? '(en blanco = no cambiar)' : '(por omisión: cadencia123)'}
              </span>
            </label>
            <input
              id="u-pass"
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="campo"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-forja border border-terracota/40 bg-terracota/10 px-3 py-2 text-sm text-terracota">
              {error}
            </p>
          ) : null}
        </div>
      </Dialogo>
    </div>
  );
}
