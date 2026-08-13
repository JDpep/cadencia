'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Frontera de error de la app. Los errores de permiso llegan aquí cuando se
 * lanzan desde una página; el mensaje ya viene redactado desde el guard.
 */
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[cadencia]', error);
  }, [error]);

  const esPermiso = /permiso|pertenece|sólo para|Sólo/i.test(error.message);

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-firma text-terracota">
        {esPermiso ? 'Error 403' : 'Algo se atoró'}
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-texto">
        {esPermiso ? 'Sin acceso' : 'No se pudo cargar esta pantalla'}
      </h1>
      <p className="mt-2 text-sm text-texto-3">
        {esPermiso
          ? error.message
          : 'Intenta de nuevo. Si sigue pasando, revisa la consola del servidor.'}
      </p>

      <div className="mt-6 flex justify-center gap-2">
        {!esPermiso ? (
          <button type="button" onClick={reset} className="btn-primario">
            Reintentar
          </button>
        ) : null}
        <Link href="/" className="btn-secundario">
          Ir a mi dashboard
        </Link>
      </div>
    </div>
  );
}
