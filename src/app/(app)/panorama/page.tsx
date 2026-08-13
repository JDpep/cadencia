import Link from 'next/link';
import { requerirRol } from '@/lib/auth/guard';
import { panoramaOrganizacional } from '@/lib/repos/panorama';
import { vacantesDelMes } from '@/lib/repos/vacantes';
import { TablaPanorama } from '@/components/panorama/TablaPanorama';
import { ResumenVacantes } from '@/components/vacantes/ResumenVacantes';
import { fmtClave } from '@/lib/tiempo';

export const dynamic = 'force-dynamic';

export default async function PaginaPanorama() {
  // El servidor manda: si el rol no alcanza, esto lanza 403 antes de leer nada.
  const usuario = await requerirRol('admin', 'direccion');

  const [datos, vacantes] = await Promise.all([
    panoramaOrganizacional(usuario),
    vacantesDelMes(usuario),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-texto">Panorama organizacional</h1>
          <p className="mt-1 text-sm text-texto-3">
            Carga por persona · semana del {fmtClave(datos.semanaDe, "d 'de' MMMM")}.
          </p>
          <p className="editorial mt-1.5 text-base text-texto-4">
            Quién trae más peso encima esta semana.
          </p>
        </div>
        <Link href="/ausencias" className="btn-secundario">
          Calendario de ausencias
        </Link>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0">
          <TablaPanorama datos={datos} />
        </div>
        <ResumenVacantes resumen={vacantes} />
      </div>
    </div>
  );
}
