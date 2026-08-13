import Link from 'next/link';

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-firma text-texto-4">Error 404</p>
      <h1 className="mt-2 text-2xl font-semibold text-texto">Esto no existe</h1>
      <p className="mt-2 text-sm text-texto-3">
        La página o el registro que buscas ya no está aquí.
      </p>
      <Link href="/" className="btn-secundario mt-6">
        Volver al inicio
      </Link>
    </div>
  );
}
