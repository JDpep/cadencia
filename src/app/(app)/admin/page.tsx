import { requerirRol } from '@/lib/auth/guard';
import { listarUsuarios } from '@/lib/repos/usuarios';
import { GestorUsuarios } from '@/components/admin/GestorUsuarios';

export const dynamic = 'force-dynamic';

export default async function PaginaAdminUsuarios() {
  await requerirRol('admin');
  const usuarios = await listarUsuarios();

  return <GestorUsuarios usuarios={usuarios} />;
}
