/**
 * Vocabulario del dominio. SQLite no tiene enums, así que los valores viven
 * aquí y se validan en el servidor antes de tocar la base.
 */

export const ROLES = ['admin', 'usuario', 'direccion'] as const;
export type Rol = (typeof ROLES)[number];

export const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'Administración',
  usuario: 'Ejecutivo',
  direccion: 'Dirección',
};

export const PRIORIDADES = ['baja', 'media', 'alta', 'urgente'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

/** Menor = más urgente. Es el orden canónico de todas las listas. */
export const PESO_PRIORIDAD: Record<Prioridad, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

/** Clases Tailwind por prioridad — el punto y la píldora. */
export const ESTILO_PRIORIDAD: Record<
  Prioridad,
  { punto: string; pildora: string; barra: string }
> = {
  urgente: {
    punto: 'bg-terracota',
    pildora: 'bg-terracota text-hueso',
    barra: 'bg-terracota',
  },
  alta: {
    punto: 'bg-ocre',
    pildora: 'bg-ocre/15 text-texto-2 border border-ocre/40',
    barra: 'bg-ocre',
  },
  media: {
    punto: 'bg-texto-4',
    pildora: 'bg-superficie-3 text-texto-3 border border-borde',
    barra: 'bg-texto-4',
  },
  baja: {
    punto: 'bg-borde-2',
    pildora: 'bg-superficie-3 text-texto-4 border border-borde',
    barra: 'bg-borde-2',
  },
};

export const ESTADOS = ['por_hacer', 'en_proceso', 'hecha'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  por_hacer: 'Por hacer',
  en_proceso: 'En proceso',
  hecha: 'Hecha',
};

/** Tokens de color disponibles para las categorías (Admin los asigna). */
export const TOKENS_COLOR = [
  'terracota',
  'verde',
  'ocre',
  'tinta',
  'arena',
  'ciruela',
] as const;
export type TokenColor = (typeof TOKENS_COLOR)[number];

export const ESTILO_CATEGORIA: Record<
  string,
  { chip: string; punto: string; barraCalendario: string }
> = {
  terracota: {
    chip: 'bg-terracota/10 text-terracota border-terracota/30',
    punto: 'bg-terracota',
    barraCalendario: 'border-l-terracota',
  },
  verde: {
    chip: 'bg-verde-forja/10 text-verde-forja border-verde-forja/30',
    punto: 'bg-verde-forja',
    barraCalendario: 'border-l-verde-forja',
  },
  ocre: {
    chip: 'bg-ocre/15 text-texto-2 border-ocre/40',
    punto: 'bg-ocre',
    barraCalendario: 'border-l-ocre',
  },
  tinta: {
    chip: 'bg-superficie-3 text-texto-2 border-borde-2',
    punto: 'bg-texto-2',
    barraCalendario: 'border-l-texto-2',
  },
  arena: {
    chip: 'bg-superficie-3 text-texto-3 border-borde',
    punto: 'bg-texto-4',
    barraCalendario: 'border-l-texto-4',
  },
  ciruela: {
    chip: 'bg-ciruela/12 text-ciruela border-ciruela/30',
    punto: 'bg-ciruela',
    barraCalendario: 'border-l-ciruela',
  },
};

export function estiloCategoria(token: string | null | undefined) {
  return ESTILO_CATEGORIA[token ?? 'arena'] ?? ESTILO_CATEGORIA.arena;
}

// --- Recurrencia ---------------------------------------------------------

export const FRECUENCIAS = [
  'dias_habiles',
  'cada_n_habiles',
  'semanal',
  'quincenal',
  'mensual_dia',
  'mensual_posicion',
] as const;
export type Frecuencia = (typeof FRECUENCIAS)[number];

export const ETIQUETA_FRECUENCIA: Record<Frecuencia, string> = {
  dias_habiles: 'Todos los días hábiles (L–V)',
  cada_n_habiles: 'Cada N días hábiles',
  semanal: 'Semanal, en días específicos',
  quincenal: 'Quincenal, en días específicos',
  mensual_dia: 'Mensual, por día del mes',
  mensual_posicion: 'Mensual, por posición (1er lunes…)',
};

/** Qué hacer si una ocurrencia cae en sábado, domingo o festivo. */
export const REGLAS_REAJUSTE = ['siguiente_habil', 'anterior_habil', 'omitir'] as const;
export type ReglaReajuste = (typeof REGLAS_REAJUSTE)[number];

export const ETIQUETA_REAJUSTE: Record<ReglaReajuste, string> = {
  siguiente_habil: 'Mover al siguiente día hábil',
  anterior_habil: 'Mover al día hábil anterior',
  omitir: 'No generar esa ocurrencia',
};

export const TERMINACIONES = ['nunca', 'hasta', 'conteo'] as const;
export type Terminacion = (typeof TERMINACIONES)[number];

export const ALCANCES_EDICION = ['esta', 'siguientes', 'serie'] as const;
export type AlcanceEdicion = (typeof ALCANCES_EDICION)[number];

// --- Clientes ------------------------------------------------------------

/** Cada cuánto corre la nómina del cliente. */
export const PERIODICIDADES_NOMINA = ['semanal', 'quincenal', 'mensual'] as const;
export type PeriodicidadNomina = (typeof PERIODICIDADES_NOMINA)[number];

export const ETIQUETA_NOMINA: Record<PeriodicidadNomina, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
};

/** Cada cuántos días cae, aproximado — para leer la cadencia de un vistazo. */
export const CADENCIA_NOMINA: Record<PeriodicidadNomina, string> = {
  semanal: 'cada semana',
  quincenal: 'cada 15 días',
  mensual: 'una vez al mes',
};

export function esPeriodicidadNomina(v: unknown): v is PeriodicidadNomina {
  return (
    typeof v === 'string' && (PERIODICIDADES_NOMINA as readonly string[]).includes(v)
  );
}

// --- Vacaciones y ausencias ----------------------------------------------

export const TIPOS_AUSENCIA = ['vacaciones', 'permiso', 'incapacidad', 'economico'] as const;
export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number];

export const ETIQUETA_AUSENCIA: Record<TipoAusencia, string> = {
  vacaciones: 'Vacaciones',
  permiso: 'Permiso',
  incapacidad: 'Incapacidad',
  economico: 'Día económico',
};

/**
 * Qué tipos descuentan del saldo anual y cuáles exigen motivo.
 *
 * Una incapacidad no se descuenta de las vacaciones —es otra cosa— pero sí
 * bloquea la agenda; por eso «cuenta» y «descuenta» son banderas distintas.
 */
export const REGLAS_AUSENCIA: Record<
  TipoAusencia,
  { descuentaSaldo: boolean; motivoObligatorio: boolean }
> = {
  vacaciones: { descuentaSaldo: true, motivoObligatorio: false },
  permiso: { descuentaSaldo: false, motivoObligatorio: true },
  incapacidad: { descuentaSaldo: false, motivoObligatorio: true },
  economico: { descuentaSaldo: true, motivoObligatorio: false },
};

export const ESTATUS_AUSENCIA = [
  'pendiente',
  'aprobada',
  'rechazada',
  'cancelada',
] as const;
export type EstatusAusencia = (typeof ESTATUS_AUSENCIA)[number];

export const ETIQUETA_ESTATUS_AUSENCIA: Record<EstatusAusencia, string> = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export const ESTILO_ESTATUS_AUSENCIA: Record<EstatusAusencia, string> = {
  pendiente: 'bg-ocre/15 text-texto-2 border border-ocre/40',
  aprobada: 'bg-verde-forja/10 text-verde-forja border border-verde-forja/30',
  rechazada: 'bg-terracota/10 text-terracota border border-terracota/30',
  cancelada: 'bg-superficie-3 text-texto-4 border border-borde',
};

export function esTipoAusencia(v: unknown): v is TipoAusencia {
  return typeof v === 'string' && (TIPOS_AUSENCIA as readonly string[]).includes(v);
}

export function esEstatusAusencia(v: unknown): v is EstatusAusencia {
  return typeof v === 'string' && (ESTATUS_AUSENCIA as readonly string[]).includes(v);
}

// --- Recordatorios -------------------------------------------------------

/** Minutos de antelación que ofrece la ficha. `null` = sin recordatorio. */
export const OFFSETS_RECORDATORIO = [0, 5, 15, 30, 60, 120, 1440] as const;
export type OffsetRecordatorio = (typeof OFFSETS_RECORDATORIO)[number];

export const ETIQUETA_RECORDATORIO: Record<number, string> = {
  0: 'A la hora',
  5: '5 minutos antes',
  15: '15 minutos antes',
  30: '30 minutos antes',
  60: '1 hora antes',
  120: '2 horas antes',
  1440: '1 día antes',
};

/**
 * Una actividad de día completo se guarda a las 00:00, así que avisar "a la
 * hora" sería avisar a medianoche. Para ellas el recordatorio se cuenta desde
 * esta hora de la mañana.
 */
export const HORA_RECORDATORIO_DIA_COMPLETO = '08:00';

/** Minutos que se posponen al darle «Posponer» en la campana. */
export const MINUTOS_POSPONER = 10;

export function esOffsetRecordatorio(v: unknown): v is OffsetRecordatorio {
  return typeof v === 'number' && (OFFSETS_RECORDATORIO as readonly number[]).includes(v);
}

// --- Validación ----------------------------------------------------------

export function esPrioridad(v: unknown): v is Prioridad {
  return typeof v === 'string' && (PRIORIDADES as readonly string[]).includes(v);
}
export function esEstado(v: unknown): v is Estado {
  return typeof v === 'string' && (ESTADOS as readonly string[]).includes(v);
}
export function esRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}
