'use client';

import { useEffect, useRef, useState } from 'react';
import { accionCerrarSesion, accionConmutarUsuario } from '@/lib/acciones/sesion';
import { ETIQUETA_ROL, type Rol } from '@/lib/dominio';
import { cn } from '@/lib/utils';

type UsuarioMini = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  puesto: string | null;
};

export function MenuUsuario({
  usuario,
  usuarios,
  mostrarConmutador,
}: {
  usuario: { id: string; nombre: string; email: string; rol: Rol; puesto: string | null };
  usuarios: UsuarioMini[];
  mostrarConmutador: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;

    function alClicFuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    function alEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false);
    }

    document.addEventListener('mousedown', alClicFuera);
    document.addEventListener('keydown', alEscape);
    return () => {
      document.removeEventListener('mousedown', alClicFuera);
      document.removeEventListener('keydown', alEscape);
    };
  }, [abierto]);

  const iniciales = usuario.nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-forja border border-borde bg-superficie-2 py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:border-texto-4"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-terracota text-[11px] font-bold text-hueso">
          {iniciales}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-xs font-semibold text-texto">{usuario.nombre}</span>
          <span className="block text-[10px] text-texto-4">{ETIQUETA_ROL[usuario.rol]}</span>
        </span>
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-texto-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 4.5L6 7.5l3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-72 animate-aparecer overflow-hidden rounded-forja border border-borde bg-superficie-2 shadow-forja-alto"
        >
          <div className="border-b border-borde px-4 py-3">
            <p className="text-sm font-semibold text-texto">{usuario.nombre}</p>
            <p className="text-xs text-texto-3">{usuario.email}</p>
            {usuario.puesto ? (
              <p className="mt-0.5 text-xs text-texto-4">{usuario.puesto}</p>
            ) : null}
          </div>

          {mostrarConmutador ? (
            <div className="border-b border-borde px-2 py-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-texto-4">
                Entrar como (pruebas)
              </p>
              {usuarios.map((u) => (
                <form key={u.id} action={accionConmutarUsuario}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    role="menuitem"
                    disabled={u.id === usuario.id}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-[9px] px-2 py-1.5 text-left text-sm transition-colors',
                      u.id === usuario.id
                        ? 'cursor-default bg-terracota/10 text-terracota'
                        : 'text-texto-2 hover:bg-superficie-3',
                    )}
                  >
                    <span className="truncate">{u.nombre}</span>
                    <span className="shrink-0 text-[10px] text-texto-4">
                      {ETIQUETA_ROL[u.rol as Rol] ?? u.rol}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          ) : null}

          <form action={accionCerrarSesion} className="p-2">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-[9px] px-2 py-2 text-left text-sm text-texto-2 transition-colors hover:bg-superficie-3"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M6 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2H6M10.5 11L14 8l-3.5-3M14 8H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
