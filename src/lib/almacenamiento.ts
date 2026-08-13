import 'server-only';

/**
 * Almacenamiento de comprobantes de ausencia.
 *
 * En Vercel el sistema de archivos es de SOLO LECTURA y efímero: escribir en
 * disco falla, y lo que se escribiera en /tmp desaparece con la instancia. Por
 * eso los adjuntos viven en un bucket PRIVADO de Supabase Storage.
 *
 * Privado, no público, a propósito: un certificado de incapacidad no puede
 * quedar accesible por URL a quien la adivine. La descarga sigue pasando por
 * `/api/adjuntos/[id]`, que comprueba permisos y sólo entonces pide el archivo
 * con la llave de servicio.
 */

export const BUCKET = 'comprobantes';

function config() {
  const url = process.env.SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !llave) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY: sin ellas no se pueden guardar comprobantes.',
    );
  }
  return { url: url.replace(/\/$/, ''), llave };
}

/** ¿Está configurado el almacenamiento? La UI lo usa para no ofrecer adjuntos. */
export function almacenamientoDisponible(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Sube un archivo al bucket privado y devuelve su ruta.
 *
 * Se usa la API REST directamente en vez del SDK de Supabase: es una sola
 * petición y ahorra una dependencia entera en el bundle del servidor.
 */
export async function subirComprobante(
  ruta: string,
  contenido: ArrayBuffer,
  tipo: string,
): Promise<void> {
  const { url, llave } = config();

  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${llave}`,
      'Content-Type': tipo || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: contenido,
  });

  if (!r.ok) {
    throw new Error(`No se pudo guardar el comprobante (${r.status}): ${await r.text()}`);
  }
}

/** Descarga un comprobante. Quien llama YA comprobó que puede verlo. */
export async function leerComprobante(
  ruta: string,
): Promise<{ contenido: ArrayBuffer; tipo: string } | null> {
  const { url, llave } = config();

  const r = await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
    headers: { Authorization: `Bearer ${llave}` },
  });

  if (!r.ok) return null;

  return {
    contenido: await r.arrayBuffer(),
    tipo: r.headers.get('content-type') || 'application/octet-stream',
  };
}

/** Se llama al descartar una subida a medias; que falle no debe romper nada. */
export async function borrarComprobante(ruta: string): Promise<void> {
  try {
    const { url, llave } = config();
    await fetch(`${url}/storage/v1/object/${BUCKET}/${ruta}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${llave}` },
    });
  } catch (e) {
    console.error('[almacenamiento] no se pudo borrar', ruta, e);
  }
}
