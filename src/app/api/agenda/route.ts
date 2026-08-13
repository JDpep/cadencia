import { NextResponse } from 'next/server';
import { requerirUsuario } from '@/lib/auth/guard';
import { expandirRango } from '@/lib/repos/actividades';
import { respuestaError } from '@/lib/api';
import { hoyClave, sumarDias } from '@/lib/tiempo';

const CLAVE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Agenda expandida de una ventana: incluye las ocurrencias generadas de las
 * series recurrentes, ya reajustadas a día hábil.
 *
 * Devuelve únicamente lo del usuario de la sesión (las actividades son
 * privadas para todos los roles).
 */
export async function GET(req: Request) {
  try {
    const user = await requerirUsuario();
    const params = new URL(req.url).searchParams;

    const desdeCrudo = params.get('desde');
    const hastaCrudo = params.get('hasta');

    const desde = desdeCrudo && CLAVE.test(desdeCrudo) ? desdeCrudo : hoyClave();
    const hasta =
      hastaCrudo && CLAVE.test(hastaCrudo) ? hastaCrudo : sumarDias(desde, 30);

    const items = await expandirRango(user, desde, hasta);

    return NextResponse.json({ desde, hasta, items });
  } catch (e) {
    return respuestaError(e);
  }
}
