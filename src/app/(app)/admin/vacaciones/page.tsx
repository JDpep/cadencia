import { requerirRol } from '@/lib/auth/guard';
import {
  anioActual,
  bandejaSolicitudes,
  saldosDelEquipo,
} from '@/lib/repos/vacaciones';
import { BandejaSolicitudes } from '@/components/vacaciones/BandejaSolicitudes';

export const dynamic = 'force-dynamic';

export default async function PaginaAdminVacaciones() {
  const usuario = await requerirRol('admin');
  const anio = anioActual();

  const [solicitudes, saldos] = await Promise.all([
    bandejaSolicitudes(usuario),
    saldosDelEquipo(usuario, anio),
  ]);

  return <BandejaSolicitudes solicitudes={solicitudes} saldos={saldos} anio={anio} />;
}
