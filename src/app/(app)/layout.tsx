import Link from 'next/link';
import { requerirSesion } from '@/lib/auth/guard';
import { usuariosParaConmutador } from '@/lib/repos/usuarios';
import { Marca } from '@/components/marca/Logo';
import { Navegacion, type Enlace } from '@/components/chasis/Navegacion';
import { InterruptorTema } from '@/components/chasis/InterruptorTema';
import { MenuUsuario } from '@/components/chasis/MenuUsuario';
import { BuscadorGlobal } from '@/components/chasis/BuscadorGlobal';
import { CampanaRecordatorios } from '@/components/chasis/CampanaRecordatorios';

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requerirSesion();
  const enDesarrollo = process.env.NODE_ENV !== 'production';
  const usuarios = enDesarrollo ? await usuariosParaConmutador() : [];

  // La navegación se arma según el rol; además el servidor bloquea cada ruta.
  const enlaces: Enlace[] = [
    { href: '/', texto: usuario.rol === 'direccion' ? 'Panorama' : 'Dashboard' },
  ];

  if (usuario.rol !== 'direccion') {
    enlaces.push(
      { href: '/actividades', texto: 'Actividades' },
      { href: '/agenda', texto: 'Agenda' },
    );
  } else {
    enlaces.push(
      { href: '/actividades', texto: 'Mis actividades' },
      { href: '/agenda', texto: 'Mi agenda' },
    );
  }

  enlaces.push({ href: '/clientes', texto: 'Clientes' });

  // Dirección no solicita vacaciones; sí ve el calendario de ausencias.
  if (usuario.rol !== 'direccion') {
    enlaces.push({ href: '/vacaciones', texto: 'Vacaciones' });
  } else {
    enlaces.push({ href: '/ausencias', texto: 'Ausencias' });
  }

  enlaces.push({ href: '/vacantes', texto: 'Vacantes' });

  if (usuario.rol === 'admin' || usuario.rol === 'direccion') {
    enlaces.push({ href: '/panorama', texto: 'Panorama' });
  }
  if (usuario.rol === 'direccion') {
    enlaces.push({ href: '/catalogos', texto: 'Catálogos' });
  }
  if (usuario.rol === 'admin') {
    enlaces.push({ href: '/admin', texto: 'Administración' });
  }
  enlaces.push({ href: '/bitacora', texto: 'Bitácora' });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie/85 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Cadencia, inicio">
            <Marca tamano="sm" />
          </Link>

          <div className="ml-1 hidden flex-1 md:block">
            <Navegacion enlaces={enlaces} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <BuscadorGlobal />
            <CampanaRecordatorios />
            <InterruptorTema />
            <MenuUsuario
              usuario={usuario}
              usuarios={usuarios}
              mostrarConmutador={enDesarrollo}
            />
          </div>
        </div>

        {/* En móvil la navegación baja a su propia franja */}
        <div className="border-t border-borde px-2 py-1 md:hidden">
          <Navegacion enlaces={enlaces} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="border-t border-borde px-4 py-5 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-texto-4">
            Cadencia · <span className="firma-forja">By Forja Estudio</span>
          </p>
          <p className="editorial text-sm text-texto-4">Diseñado para fluir</p>
        </div>
      </footer>
    </div>
  );
}
