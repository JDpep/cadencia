import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/auth/guard';
import { usuariosParaConmutador } from '@/lib/repos/usuarios';
import { Marca } from '@/components/marca/Logo';
import { InterruptorTema } from '@/components/chasis/InterruptorTema';
import { FormularioAcceso } from './FormularioAcceso';

export default async function PaginaLogin() {
  if (await usuarioActual()) redirect('/');

  const enDesarrollo = process.env.NODE_ENV !== 'production';
  const usuarios = enDesarrollo ? await usuariosParaConmutador() : [];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex justify-end p-4">
        <InterruptorTema />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <Marca tamano="lg" className="flex-col gap-3 [&>span:last-child]:items-center" />
            <p className="editorial mt-5 text-lg text-texto-3">
              Qué te toca hoy, y qué es lo más urgente.
            </p>
          </div>

          <FormularioAcceso usuarios={usuarios} mostrarConmutador={enDesarrollo} />

          <p className="mt-6 text-center text-xs text-texto-4">
            Versión local · los datos viven en tu máquina
          </p>
        </div>
      </div>
    </div>
  );
}
