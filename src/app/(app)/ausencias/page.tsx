import { requerirSesion } from '@/lib/auth/guard';
import { ausenciasEnRango } from '@/lib/repos/vacaciones';
import { listarFestivos } from '@/lib/repos/catalogos';
import { CalendarioAusencias } from '@/components/vacaciones/CalendarioAusencias';
import { hoyClave, inicioMes, rejillaMes, sumarDias } from '@/lib/tiempo';

export const dynamic = 'force-dynamic';

/**
 * Calendario de ausencias.
 *
 * Admin y Dirección ven a todo el equipo; el ejecutivo ve las suyas. El filtro
 * lo aplica el repositorio, no esta pantalla: pedir la ruta a mano no enseña de más.
 */
export default async function PaginaAusencias() {
  const usuario = await requerirSesion();

  // Ventana amplia alrededor del mes actual, para poder navegar sin recargar.
  const hoy = hoyClave();
  const rejilla = rejillaMes(inicioMes(hoy));
  const desde = sumarDias(rejilla[0], -186);
  const hasta = sumarDias(rejilla[rejilla.length - 1], 186);

  const [ausencias, festivos] = await Promise.all([
    ausenciasEnRango(usuario, desde, hasta),
    listarFestivos(),
  ]);

  return (
    <CalendarioAusencias
      ausencias={ausencias}
      festivos={Object.fromEntries(festivos.map((f) => [f.fecha, f.nombre]))}
      mesInicial={hoy}
      puedeAdministrar={usuario.rol === 'admin'}
    />
  );
}
