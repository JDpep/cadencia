import { privacidadTotalClientes, requerirRol } from '@/lib/auth/guard';
import { listarCategorias, listarFestivos } from '@/lib/repos/catalogos';
import { GestorCatalogos } from '@/components/admin/GestorCatalogos';

export const dynamic = 'force-dynamic';

/**
 * Vista de catálogos para Dirección: sólo lectura, según la matriz de
 * permisos. Configurarlos sigue siendo exclusivo de Administración.
 */
export default async function PaginaCatalogosLectura() {
  const usuario = await requerirRol('direccion', 'admin');

  const [categorias, festivos, privacidad] = await Promise.all([
    listarCategorias(true),
    listarFestivos(false),
    privacidadTotalClientes(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-texto">Catálogos</h1>
        <p className="mt-1 text-sm text-texto-3">
          Categorías y días festivos vigentes. Vista de lectura — los configura
          Administración.
        </p>
      </header>

      <GestorCatalogos
        categorias={categorias}
        festivos={festivos}
        privacidadTotal={privacidad}
        soloLectura={usuario.rol !== 'admin'}
      />
    </div>
  );
}
