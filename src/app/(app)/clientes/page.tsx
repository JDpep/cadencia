import { privacidadTotalClientes, requerirSesion } from '@/lib/auth/guard';
import { listarClientes } from '@/lib/repos/clientes';
import { DirectorioClientes } from '@/components/clientes/DirectorioClientes';

export const dynamic = 'force-dynamic';

export default async function PaginaClientes() {
  const usuario = await requerirSesion();

  const [clientes, privacidad] = await Promise.all([
    listarClientes(usuario),
    privacidadTotalClientes(),
  ]);

  // Dirección entra en modo lectura; Admin sí puede administrar.
  const puedeCrear = usuario.rol !== 'direccion';
  const verDeOtros =
    !privacidad && (usuario.rol === 'admin' || usuario.rol === 'direccion');

  return (
    <DirectorioClientes
      clientes={clientes.map((c) => ({
        id: c.id,
        ownerUserId: c.ownerUserId,
        nombreEmpresa: c.nombreEmpresa,
        correo: c.correo,
        contactoNombre: c.contactoNombre,
        telefono: c.telefono,
        periodicidadNomina: c.periodicidadNomina,
        notas: c.notas,
        ownerNombre: c.ownerNombre,
        actividadesAbiertas: c.actividadesAbiertas,
      }))}
      usuarioId={usuario.id}
      puedeCrear={puedeCrear}
      verDeOtros={verDeOtros}
      privacidadTotal={privacidad}
    />
  );
}
