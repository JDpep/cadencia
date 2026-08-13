'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export type Enlace = { href: string; texto: string };

/** Navegación principal. El activo se marca en terracota — una sola firma. */
export function Navegacion({ enlaces }: { enlaces: Enlace[] }) {
  const ruta = usePathname();

  return (
    <nav aria-label="Secciones" className="flex items-center gap-0.5 overflow-x-auto">
      {enlaces.map((e) => {
        const activo = e.href === '/' ? ruta === '/' : ruta.startsWith(e.href);
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo ? 'page' : undefined}
            className={cn(
              'relative shrink-0 rounded-forja px-3 py-2 text-sm font-medium transition-colors',
              activo
                ? 'text-terracota'
                : 'text-texto-3 hover:bg-superficie-3 hover:text-texto',
            )}
          >
            {e.texto}
            {activo ? (
              <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-terracota" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
