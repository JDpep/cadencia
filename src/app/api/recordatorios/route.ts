import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { bandejaRecordatorios } from '@/lib/repos/recordatorios';
import { respuestaError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * Bandeja de recordatorios del usuario de la sesión: los que ya sonaron y los
 * que están por sonar. La campana la consulta cada minuto.
 *
 * Devuelve SÓLO los del usuario — un recordatorio nace de una actividad, y las
 * actividades son privadas para todos los roles.
 *
 * De paso rueda el horizonte de materialización (como mucho cada 10 minutos),
 * que es lo que mantiene vivos los avisos de las series sin fin.
 */
export async function GET() {
  try {
    const user = await requerirUsuario();
    const bandeja = await bandejaRecordatorios(user);

    return NextResponse.json(bandeja, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return respuestaError(e);
  }
}
