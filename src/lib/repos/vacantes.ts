import 'server-only';
import { prisma } from '@/lib/prisma';
import { ErrorPermiso, type UsuarioSesion } from '@/lib/auth/guard';
import { agregar, anioDeHoy, mesDeHoy, NOMBRES_MES, type Vacante } from '@/lib/vacantes';
import { claveDia } from '@/lib/tiempo';

/**
 * Histórico de vacantes — lectura.
 *
 * Definición de negocio: **una vacante es una entrevista realizada**. No se
 * captura a mano: se DERIVA de las actividades, así que basta con que el
 * ejecutivo palomee su entrevista para que el histórico se llene solo, y
 * desmarcarla la resta. Por eso aquí no hay tabla propia ni escritura: es una
 * consulta agregada que no puede desincronizarse de la realidad.
 *
 * Qué cuenta:
 *  · actividad de una categoría marcada `esEntrevista`,
 *  · en estado `hecha`, con `completadaEn`,
 *  · el mes sale de `completadaEn` en America/Mexico_City,
 *  · se atribuye al `ownerUserId` — ése es «quién se encargó».
 *
 * Series recurrentes: cuenta **cada ocurrencia completada** como una vacante
 * independiente. Para una serie se leen de `ActivityOccurrence` y NO del estado
 * de la actividad madre: contar además la madre haría que una serie con diez
 * entrevistas valiera once.
 *
 * La agregación vive en `src/lib/vacantes.ts`, pura y compartida con el cliente.
 */

/**
 * Alcance de lectura: Admin y Dirección ven a todo el equipo con el desglose de
 * quién atendió cada vacante; el ejecutivo ve únicamente las suyas.
 */
export function veTodoElEquipo(user: UsuarioSesion): boolean {
  return user.rol === 'admin' || user.rol === 'direccion';
}

function filtroPersona(user: UsuarioSesion): { ownerUserId?: string } {
  return veTodoElEquipo(user) ? {} : { ownerUserId: user.id };
}

/** Todas las vacantes visibles para este usuario, ya normalizadas. */
export async function listarVacantes(user: UsuarioSesion): Promise<Vacante[]> {
  const actividades = await prisma.activity.findMany({
    where: {
      ...filtroPersona(user),
      archivada: false,
      category: { esEntrevista: true },
    },
    select: {
      id: true,
      titulo: true,
      estado: true,
      completadaEn: true,
      recurrenceRule: true,
      ownerUserId: true,
      owner: { select: { nombre: true } },
      client: { select: { nombreEmpresa: true } },
      occurrences: {
        where: { estado: 'hecha', completadaEn: { not: null } },
        select: { fechaOriginal: true, completadaEn: true, titulo: true },
      },
    },
  });

  const salida: Vacante[] = [];

  for (const a of actividades) {
    const base = {
      activityId: a.id,
      userId: a.ownerUserId,
      persona: a.owner.nombre,
      cliente: a.client?.nombreEmpresa ?? null,
    };

    if (a.recurrenceRule) {
      // Serie: manda la ocurrencia. La madre no se cuenta.
      for (const oc of a.occurrences) {
        if (!oc.completadaEn) continue;
        salida.push({
          ...base,
          ...fechasDe(oc.completadaEn),
          llave: `${a.id}::${oc.fechaOriginal}`,
          titulo: oc.titulo ?? a.titulo,
          completadaEn: oc.completadaEn.toISOString(),
          esOcurrencia: true,
        });
      }
      continue;
    }

    if (a.estado !== 'hecha' || !a.completadaEn) continue;
    salida.push({
      ...base,
      ...fechasDe(a.completadaEn),
      llave: a.id,
      titulo: a.titulo,
      completadaEn: a.completadaEn.toISOString(),
      esOcurrencia: false,
    });
  }

  return salida.sort((x, y) => (x.completadaEn < y.completadaEn ? 1 : -1));
}

function fechasDe(fecha: Date) {
  const clave = claveDia(fecha);
  return {
    clave,
    anio: Number(clave.slice(0, 4)),
    mes: Number(clave.slice(5, 7)),
  };
}

/** Vacantes del mes en curso, para el Panorama de Dirección. */
export async function vacantesDelMes(user: UsuarioSesion) {
  if (!veTodoElEquipo(user)) {
    throw new ErrorPermiso(
      'El resumen de vacantes es sólo para Administración y Dirección.',
    );
  }

  const anio = anioDeHoy();
  const mes = mesDeHoy();

  const todas = await listarVacantes(user);
  const delMes = todas.filter((v) => v.anio === anio && v.mes === mes);

  const porPersona = new Map<string, { nombre: string; total: number }>();
  for (const v of delMes) {
    const actual = porPersona.get(v.userId) ?? { nombre: v.persona, total: 0 };
    porPersona.set(v.userId, { ...actual, total: actual.total + 1 });
  }

  return {
    anio,
    mes,
    etiqueta: NOMBRES_MES[mes - 1],
    total: delMes.length,
    totalAnio: todas.filter((v) => v.anio === anio).length,
    porPersona: [...porPersona.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.total - a.total),
  };
}

/** Vista inicial ya agregada, para que la primera pintura no dependa del cliente. */
export async function historicoInicial(user: UsuarioSesion) {
  const todas = await listarVacantes(user);
  return { todas, historico: agregar(todas) };
}
