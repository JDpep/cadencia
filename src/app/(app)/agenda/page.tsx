import { requerirSesion } from '@/lib/auth/guard';
import { expandirRango } from '@/lib/repos/actividades';
import { clientesVinculables } from '@/lib/repos/clientes';
import { listarCategorias, listarFestivos } from '@/lib/repos/catalogos';
import { ausenciasEnRango } from '@/lib/repos/vacaciones';
import { diasDe } from '@/lib/ausencias';
import { ETIQUETA_AUSENCIA } from '@/lib/dominio';
import { Calendario, type VistaCalendario } from '@/components/agenda/Calendario';
import {
  hoyClave,
  inicioMes,
  inicioSemana,
  rejillaMes,
  sumarDias,
  type ClaveDia,
} from '@/lib/tiempo';

export const dynamic = 'force-dynamic';

function normalizarVista(v?: string): VistaCalendario {
  return v === 'dia' || v === 'semana' || v === 'mes' ? v : 'semana';
}

function normalizarFecha(f?: string): ClaveDia {
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoyClave();
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; fecha?: string }>;
}) {
  const usuario = await requerirSesion();
  const params = await searchParams;

  const vista = normalizarVista(params.vista);
  const foco = normalizarFecha(params.fecha);

  // Ventana visible: es lo único que se expande de las series recurrentes.
  let desde: ClaveDia;
  let hasta: ClaveDia;

  if (vista === 'dia') {
    desde = foco;
    hasta = foco;
  } else if (vista === 'semana') {
    desde = inicioSemana(foco);
    hasta = sumarDias(desde, 6);
  } else {
    const rejilla = rejillaMes(inicioMes(foco));
    desde = rejilla[0];
    hasta = rejilla[rejilla.length - 1];
  }

  const [items, festivos, categorias, clientes, ausencias] = await Promise.all([
    expandirRango(usuario, desde, hasta),
    listarFestivos(),
    listarCategorias(),
    clientesVinculables(usuario),
    // Sólo las PROPIAS: la agenda es de uno, aunque Admin pueda ver el
    // calendario de ausencias del equipo en su pantalla.
    ausenciasEnRango(usuario, desde, hasta, true),
  ]);

  const mapaFestivos = Object.fromEntries(festivos.map((f) => [f.fecha, f.nombre]));

  // Un día puede caer dentro de varias ausencias; se etiqueta con la primera.
  const mapaAusencias: Record<string, string> = {};
  for (const a of ausencias) {
    for (const clave of diasDe({ inicio: a.fechaInicio, fin: a.fechaFin })) {
      mapaAusencias[clave] ??= ETIQUETA_AUSENCIA[a.tipo];
    }
  }

  return (
    <Calendario
      items={items}
      vista={vista}
      foco={foco}
      festivos={mapaFestivos}
      ausencias={mapaAusencias}
      categorias={categorias}
      clientes={clientes}
    />
  );
}
