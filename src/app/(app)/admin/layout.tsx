import { requerirRol } from '@/lib/auth/guard';
import { Navegacion } from '@/components/chasis/Navegacion';

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  // Puerta única: Administración. Cada página vuelve a validar por su cuenta.
  await requerirRol('admin');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-texto">Administración</h1>
        <p className="mt-1 text-sm text-texto-3">
          Usuarios, catálogos y reglas de la organización.
        </p>
      </header>

      <div className="border-b border-borde pb-3">
        <Navegacion
          enlaces={[
            { href: '/admin', texto: 'Usuarios' },
            { href: '/admin/catalogos', texto: 'Catálogos' },
            { href: '/admin/vacaciones', texto: 'Vacaciones' },
          ]}
        />
      </div>

      {children}
    </div>
  );
}
