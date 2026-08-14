import Link from 'next/link';
import { requerirSesion, type UsuarioSesion } from '@/lib/auth/guard';
import { resumenDashboard, type ResumenDashboard } from '@/lib/repos/dashboard';
import { panoramaOrganizacional } from '@/lib/repos/panorama';
import { vacantesDelMes } from '@/lib/repos/vacantes';
import { FilaAgenda } from '@/components/agenda/FilaAgenda';
import { TablaPanorama } from '@/components/panorama/TablaPanorama';
import { EquipoCompacto } from '@/components/panorama/EquipoCompacto';
import { ResumenVacantes } from '@/components/vacantes/ResumenVacantes';
import { TiraCifras, type Cifra } from '@/components/chasis/TiraCifras';
import {
  ESTILO_PRIORIDAD,
  ETIQUETA_ESTADO,
  ETIQUETA_PRIORIDAD,
  type Estado,
} from '@/lib/dominio';
import { fechaRelativa, fmtClave, hoyClave } from '@/lib/tiempo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function PaginaInicio() {
  const usuario = await requerirSesion();

  // Dirección entra directo a su Panorama de lectura.
  if (usuario.rol === 'direccion') {
    const [panorama, vacantes] = await Promise.all([
      panoramaOrganizacional(usuario),
      vacantesDelMes(usuario),
    ]);

    return (
      <div className="space-y-4">
        <Encabezado
          fecha={hoyClave()}
          titulo="Panorama"
          frase={`Carga por persona · semana del ${fmtClave(panorama.semanaDe, "d 'de' MMMM")}.`}
          acciones={
            <>
              <Link href="/vacantes" className="btn-secundario">
                Histórico de vacantes
              </Link>
              <Link href="/ausencias" className="btn-secundario">
                Ausencias del equipo
              </Link>
            </>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
          <div className="min-w-0">
            <TablaPanorama datos={panorama} />
          </div>
          <ResumenVacantes resumen={vacantes} />
        </div>
      </div>
    );
  }

  const r = await resumenDashboard(usuario);

  // Administración lidera con el equipo: su propio tablero personal suele estar
  // vacío —no lleva cartera— y cuatro ceros no le dicen nada.
  if (usuario.rol === 'admin') {
    const [panorama, vacantes] = await Promise.all([
      panoramaOrganizacional(usuario),
      vacantesDelMes(usuario),
    ]);

    const { totales } = panorama;
    const ejecutivos = panorama.filas.filter((f) => f.rol === 'usuario');

    return (
      <div className="space-y-4">
        <Encabezado
          fecha={hoyClave()}
          titulo={`Buen día, ${usuario.nombre.split(' ')[0]}`}
          frase={
            totales.vencidas > 0
              ? `El equipo trae ${totales.vencidas} ${totales.vencidas === 1 ? 'actividad vencida' : 'actividades vencidas'}.`
              : 'El equipo va al día.'
          }
          acciones={
            <>
              <Link href="/admin/vacaciones" className="btn-primario">
                Solicitudes
              </Link>
              <Link href="/admin" className="btn-secundario">
                Usuarios
              </Link>
              <Link href="/actividades" className="btn-secundario">
                Mis actividades
              </Link>
            </>
          }
        />

        <TiraCifras
          cifras={[
            { etiqueta: 'Abiertas del equipo', valor: totales.abiertas },
            {
              etiqueta: 'Vencidas',
              valor: totales.vencidas,
              tono: totales.vencidas > 0 ? 'terracota' : 'neutro',
            },
            {
              etiqueta: 'Urgentes abiertas',
              valor: totales.urgentes,
              tono: totales.urgentes > 0 ? 'terracota' : 'neutro',
            },
            {
              etiqueta: 'Hechas esta semana',
              valor: totales.hechasSemana,
              tono: 'verde',
            },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_19rem]">
          <div className="min-w-0 space-y-4">
            <EquipoCompacto filas={ejecutivos.length ? ejecutivos : panorama.filas} />

            {/* Lo propio de Renata, en segundo plano */}
            <ListaAgenda
              titulo="Mis actividades de hoy"
              nota="ordenadas por prioridad"
              conteo={r.hoy.length}
              vacio="No tienes nada agendado para hoy."
            >
              {r.hoy.map((i) => (
                <FilaAgenda key={i.llave} item={i} />
              ))}
            </ListaAgenda>
          </div>

          <ResumenVacantes resumen={vacantes} />
        </div>
      </div>
    );
  }

  return <DashboardEjecutivo usuario={usuario} r={r} />;
}

// ---------------------------------------------------------------------------

function DashboardEjecutivo({
  usuario,
  r,
}: {
  usuario: UsuarioSesion;
  r: ResumenDashboard;
}) {
  const hoy = hoyClave();
  const maxDistribucion = Math.max(1, ...r.distribucion.map((d) => d.abiertas));

  const cifras: Cifra[] = [
    {
      etiqueta: 'Avance total',
      valor: `${r.avance}%`,
      detalle: `${r.conteos.hecha} de ${r.conteos.hecha + r.totalAbiertas}`,
      barra: r.avance,
      tono: 'verde',
    },
    ...(['por_hacer', 'en_proceso', 'hecha'] as Estado[]).map<Cifra>((e) => ({
      etiqueta: ETIQUETA_ESTADO[e],
      valor: r.conteos[e],
      detalle: e === 'por_hacer' && r.sinFecha > 0 ? `${r.sinFecha} sin fecha` : undefined,
      tono: e === 'hecha' ? 'verde' : 'neutro',
    })),
  ];

  return (
    <div className="space-y-4">
      <Encabezado
        fecha={hoy}
        titulo={`Buen día, ${usuario.nombre.split(' ')[0]}`}
        frase={
          r.hoy.length === 0
            ? 'Hoy tienes la agenda despejada.'
            : `Hoy te tocan ${r.hoy.length} ${r.hoy.length === 1 ? 'actividad' : 'actividades'}.`
        }
        acciones={
          <>
            <Link href="/actividades" className="btn-primario">
              Nueva actividad
            </Link>
            <Link href="/agenda" className="btn-secundario">
              Mi agenda
            </Link>
            <Link href="/clientes" className="btn-secundario">
              Mis clientes
            </Link>
            <Link href="/vacaciones" className="btn-secundario">
              Vacaciones
            </Link>
          </>
        }
      />

      <TiraCifras cifras={cifras} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListaAgenda
            titulo="Hoy"
            nota="ordenadas por prioridad"
            conteo={r.hoy.length}
            vacio="Nada agendado para hoy."
            enlaceVacio={{ href: '/actividades', texto: 'Agrega una actividad' }}
          >
            {r.hoy.map((i) => (
              <FilaAgenda key={i.llave} item={i} />
            ))}
          </ListaAgenda>
        </div>

        {/* Distribución + recordatorios */}
        <section className="tarjeta p-3.5 shadow-forja">
          <h2 className="text-sm font-semibold text-texto">Por prioridad</h2>
          <p className="text-[11px] text-texto-4">Actividades abiertas</p>

          <ul className="mt-2.5 space-y-1.5">
            {r.distribucion.map((d) => (
              <li key={d.prioridad}>
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={cn(
                      'font-medium',
                      d.prioridad === 'urgente' ? 'text-terracota' : 'text-texto-2',
                    )}
                  >
                    {ETIQUETA_PRIORIDAD[d.prioridad]}
                  </span>
                  <span className="tabular-nums text-texto-4">{d.abiertas}</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-superficie-3">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      ESTILO_PRIORIDAD[d.prioridad].barra,
                    )}
                    style={{ width: `${(d.abiertas / maxDistribucion) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 border-t border-borde pt-3">
            <h3 className="text-sm font-semibold text-texto">Recordatorios de hoy</h3>
            {r.recordatorios.length === 0 ? (
              <p className="mt-1 text-[11px] text-texto-4">Sin actividades con hora pendiente.</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {r.recordatorios.map((i) => (
                  <li key={i.llave} className="flex items-baseline gap-2 text-[13px]">
                    <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums text-terracota">
                      {i.hora}
                    </span>
                    <span className="truncate text-texto-2">{i.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListaAgenda
          titulo="Vencidas"
          alerta
          conteo={r.vencidas.length}
          vacio="Nada vencido. Bien ahí."
        >
          {r.vencidas.map((i) => (
            <FilaAgenda key={i.llave} item={i} destacarAtraso diasAtraso={i.diasAtraso} />
          ))}
        </ListaAgenda>

        <ListaAgenda
          titulo="Próximas"
          nota="siguientes 7 días"
          conteo={r.proximas.length}
          vacio="Nada agendado esta semana."
        >
          {r.proximas.map((i) => (
            <FilaAgenda
              key={i.llave}
              item={i}
              mostrarFecha
              etiquetaFecha={fechaRelativa(i.clave)}
            />
          ))}
        </ListaAgenda>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Saludo, fecha y accesos rápidos. Una sola línea editorial por pantalla. */
function Encabezado({
  fecha,
  titulo,
  frase,
  acciones,
}: {
  fecha: string;
  titulo: string;
  frase: string;
  acciones: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-texto-4">
          {fmtClave(fecha, "EEEE d 'de' MMMM")}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold text-texto">{titulo}</h1>
        <p className="editorial mt-0.5 text-sm text-texto-3">{frase}</p>
      </div>
      <div className="flex flex-wrap gap-2">{acciones}</div>
    </header>
  );
}

/**
 * Tarjeta de lista con encabezado y estado vacío.
 *
 * Estaba repetida cuatro veces con paddings distintos; unificarla es lo que
 * permite bajarlos de golpe sin que cada bloque quede de un alto diferente.
 */
function ListaAgenda({
  titulo,
  nota,
  conteo,
  vacio,
  enlaceVacio,
  alerta,
  children,
}: {
  titulo: string;
  nota?: string;
  conteo: number;
  vacio: string;
  enlaceVacio?: { href: string; texto: string };
  alerta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="tarjeta shadow-forja">
      <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-2.5">
        <h2
          className={cn(
            'text-sm font-semibold',
            alerta && conteo > 0 ? 'text-terracota' : 'text-texto',
          )}
        >
          {titulo}
          {nota ? <span className="ml-2 text-[11px] font-normal text-texto-4">{nota}</span> : null}
        </h2>
        <span className="text-[11px] tabular-nums text-texto-4">{conteo}</span>
      </header>

      {conteo === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-texto-4">
          {vacio}
          {enlaceVacio ? (
            <>
              {' '}
              <Link
                href={enlaceVacio.href}
                className="text-terracota underline underline-offset-2"
              >
                {enlaceVacio.texto}
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : (
        <ul className="px-4 py-0.5">{children}</ul>
      )}
    </section>
  );
}
