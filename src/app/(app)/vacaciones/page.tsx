import { redirect } from 'next/navigation';
import { requerirSesion } from '@/lib/auth/guard';
import { misSolicitudes, saldoDelUsuario } from '@/lib/repos/vacaciones';
import { listarFestivos } from '@/lib/repos/catalogos';
import { almacenamientoDisponible } from '@/lib/almacenamiento';
import { PortalVacaciones } from '@/components/vacaciones/PortalVacaciones';

export const dynamic = 'force-dynamic';

/**
 * Portal de vacaciones del ejecutivo. Cada quien ve y pide lo suyo.
 *
 * Dirección no solicita vacaciones, así que aquí no hay nada que enseñarle:
 * se le manda al calendario de ausencias, que es su equivalente. Es una
 * redirección y no un 403 a propósito — no es que se le niegue algo, es que su
 * pantalla es otra. El servidor sigue negando la ACCIÓN de solicitar.
 */
export default async function PaginaVacaciones() {
  const usuario = await requerirSesion();

  if (usuario.rol === 'direccion') redirect('/ausencias');

  const [saldo, solicitudes, festivos] = await Promise.all([
    saldoDelUsuario(usuario.id),
    misSolicitudes(usuario),
    listarFestivos(),
  ]);

  return (
    <PortalVacaciones
      saldo={saldo}
      solicitudes={solicitudes}
      festivos={festivos.map((f) => f.fecha)}
      // El comprobante es opcional: si el almacenamiento no está configurado,
      // no se ofrece adjuntar en vez de dejar que la subida falle al enviar.
      puedeAdjuntar={almacenamientoDisponible()}
    />
  );
}
