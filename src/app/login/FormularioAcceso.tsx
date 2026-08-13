'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  accionConmutarUsuario,
  accionIniciarSesion,
  type EstadoFormulario,
} from '@/lib/acciones/sesion';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio';

type UsuarioMini = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  puesto: string | null;
};

function BotonEntrar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primario w-full">
      {pending ? 'Entrando…' : 'Entrar'}
    </button>
  );
}

export function FormularioAcceso({
  usuarios,
  mostrarConmutador,
}: {
  usuarios: UsuarioMini[];
  mostrarConmutador: boolean;
}) {
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(accionIniciarSesion, {});

  // Los campos vienen precargados SÓLO en desarrollo, para entrar rápido.
  // En producción no: por un lado la contraseña acabaría escrita en el HTML de
  // la página; por otro, quien escribiera otro correo sin tocar el campo de
  // contraseña se llevaría un «incorrecta» sin entender por qué.
  const correoInicial = mostrarConmutador ? 'ana@cadencia.mx' : '';
  const claveInicial = mostrarConmutador ? 'cadencia123' : '';

  return (
    <div className="tarjeta p-6 shadow-forja">
      <form action={accion} className="space-y-4">
        <div>
          <label htmlFor="email" className="etiqueta-campo">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={correoInicial}
            className="campo"
            placeholder="tu@empresa.mx"
          />
        </div>

        <div>
          <label htmlFor="password" className="etiqueta-campo">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            defaultValue={claveInicial}
            className="campo"
            placeholder="••••••••"
          />
        </div>

        {estado.error ? (
          <p
            role="alert"
            className="rounded-forja border border-terracota/40 bg-terracota/10 px-3 py-2 text-sm text-terracota"
          >
            {estado.error}
          </p>
        ) : null}

        <BotonEntrar />
      </form>

      {mostrarConmutador && usuarios.length ? (
        <div className="mt-6 border-t border-borde pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-texto-4">
            Entrar como (pruebas, sin contraseña)
          </p>
          <div className="grid gap-1.5">
            {usuarios.map((u) => (
              <form key={u.id} action={accionConmutarUsuario}>
                <input type="hidden" name="userId" value={u.id} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between gap-3 rounded-forja border border-borde bg-superficie px-3 py-2 text-left text-sm transition-colors hover:border-terracota hover:bg-terracota/10"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-texto">{u.nombre}</span>
                    <span className="block truncate text-xs text-texto-4">{u.email}</span>
                  </span>
                  <span className="shrink-0 rounded-full border border-borde px-2 py-0.5 text-[10px] text-texto-3">
                    {ETIQUETA_ROL[u.rol as Rol] ?? u.rol}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
