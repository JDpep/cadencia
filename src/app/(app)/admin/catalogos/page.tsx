import { privacidadTotalClientes, requerirRol } from '@/lib/auth/guard';
import { listarCategorias, listarFestivos } from '@/lib/repos/catalogos';
import { GestorCatalogos } from '@/components/admin/GestorCatalogos';

export const dynamic = 'force-dynamic';

export default async function PaginaAdminCatalogos() {
  await requerirRol('admin');

  const [categorias, festivos, privacidad] = await Promise.all([
    listarCategorias(true),
    listarFestivos(false),
    privacidadTotalClientes(),
  ]);

  return (
    <GestorCatalogos
      categorias={categorias}
      festivos={festivos}
      privacidadTotal={privacidad}
      soloLectura={false}
    />
  );
}
