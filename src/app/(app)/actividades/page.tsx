import { Suspense } from 'react';
import { requerirSesion } from '@/lib/auth/guard';
import { listarActividades } from '@/lib/repos/actividades';
import { clientesVinculables } from '@/lib/repos/clientes';
import { listarCategorias } from '@/lib/repos/catalogos';
import { TableroActividades } from '@/components/actividades/TableroActividades';

export const dynamic = 'force-dynamic';

export default async function PaginaActividades() {
  const usuario = await requerirSesion();

  const [actividades, categorias, clientes] = await Promise.all([
    listarActividades(usuario),
    listarCategorias(),
    clientesVinculables(usuario),
  ]);

  return (
    <Suspense fallback={<p className="text-sm text-texto-4">Cargando actividades…</p>}>
      <TableroActividades
        actividades={actividades}
        categorias={categorias}
        clientes={clientes}
      />
    </Suspense>
  );
}
