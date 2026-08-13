import { requerirSesion } from '@/lib/auth/guard';
import { historicoInicial, veTodoElEquipo } from '@/lib/repos/vacantes';
import { TableroVacantes } from '@/components/vacantes/TableroVacantes';

export const dynamic = 'force-dynamic';

/**
 * Histórico de vacantes.
 *
 * Admin y Dirección reciben el histórico completo con el desglose por
 * ejecutivo; un ejecutivo recibe únicamente el suyo. El recorte lo hace el
 * repositorio antes de mandar nada al cliente: los filtros de la pantalla
 * trabajan sobre lo que ya está permitido, así que no pueden destapar de más.
 */
export default async function PaginaVacantes() {
  const usuario = await requerirSesion();
  const { todas, historico } = await historicoInicial(usuario);

  return (
    <TableroVacantes
      todas={todas}
      inicial={historico}
      veTodoElEquipo={veTodoElEquipo(usuario)}
    />
  );
}
