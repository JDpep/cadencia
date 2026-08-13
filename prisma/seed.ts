/**
 * Semilla de Cadencia · By Forja Estudio
 *
 * Datos de muestra para poder probar TODO de inmediato. Son ficticios y están
 * pensados para reemplazarse por los reales: `npm run db:reset` borra y vuelve
 * a sembrar.
 *
 * Las fechas se calculan relativas al día en que corres la semilla, para que
 * "hoy", "vencida" y "próxima" siempre tengan sentido.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { deClaveDia, hoyClave, sumarDias, diaSemana } from '../src/lib/tiempo';
import { serializarRegla, type ReglaRecurrencia } from '../src/lib/recurrence';
import { contarDiasHabiles } from '../src/lib/ausencias';

const prisma = new PrismaClient();

const HOY = hoyClave();

/** Desplaza `dias` naturales desde hoy. */
const d = (dias: number) => sumarDias(HOY, dias);

/** Primer día hábil desde hoy + `dias` (para que la muestra no caiga en sábado). */
function habil(dias: number): string {
  let clave = d(dias);
  while (diaSemana(clave) === 0 || diaSemana(clave) === 6) clave = sumarDias(clave, 1);
  return clave;
}

async function limpiar() {
  // Orden inverso a las dependencias.
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.vacationRequest.deleteMany();
  await prisma.vacationBalance.deleteMany();
  await prisma.activityOccurrence.deleteMany();
  await prisma.activitySubtask.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.client.deleteMany();
  await prisma.category.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('◐ Sembrando Cadencia…');
  await limpiar();

  // -------------------------------------------------------------------------
  // Usuarios
  // -------------------------------------------------------------------------
  const hash = (p: string) => bcrypt.hash(p, 10);

  const admin = await prisma.user.create({
    data: {
      nombre: 'Renata Salazar',
      email: 'admin@cadencia.mx',
      passwordHash: await hash('admin123'),
      rol: 'admin',
      puesto: 'Administración de la plataforma',
    },
  });

  const ana = await prisma.user.create({
    data: {
      nombre: 'Ana Lozano',
      email: 'ana@cadencia.mx',
      passwordHash: await hash('cadencia123'),
      rol: 'usuario',
      puesto: 'Ejecutiva de cuenta senior',
    },
  });

  const carlos = await prisma.user.create({
    data: {
      nombre: 'Carlos Rivas',
      email: 'carlos@cadencia.mx',
      passwordHash: await hash('cadencia123'),
      rol: 'usuario',
      puesto: 'Ejecutivo comercial',
    },
  });

  const mariana = await prisma.user.create({
    data: {
      nombre: 'Mariana Ortiz',
      email: 'mariana@cadencia.mx',
      passwordHash: await hash('cadencia123'),
      rol: 'usuario',
      puesto: 'Ejecutiva de nuevos negocios',
    },
  });

  const direccion = await prisma.user.create({
    data: {
      nombre: 'Eduardo Fuentes',
      email: 'direccion@cadencia.mx',
      passwordHash: await hash('direccion123'),
      rol: 'direccion',
      puesto: 'Dirección general',
    },
  });

  // -------------------------------------------------------------------------
  // Catálogos
  // -------------------------------------------------------------------------
  const categorias = await Promise.all(
    [
      { nombre: 'Tarea', colorToken: 'tinta', icono: '◆', orden: 0 },
      { nombre: 'Pendiente', colorToken: 'ocre', icono: '◇', orden: 1 },
      { nombre: 'Seguimiento', colorToken: 'verde', icono: '↻', orden: 2 },
      { nombre: 'Recordatorio', colorToken: 'arena', icono: '◔', orden: 3 },
      { nombre: 'Revisión', colorToken: 'ciruela', icono: '◈', orden: 4 },
      { nombre: 'Junta', colorToken: 'terracota', icono: '◎', orden: 5 },
      // La única marcada `esEntrevista`: cada actividad suya que se complete
      // cuenta como una vacante en el histórico. Ver src/lib/repos/vacantes.ts.
      { nombre: 'Entrevista', colorToken: 'verde', icono: '◑', orden: 6, esEntrevista: true },
    ].map((c) => prisma.category.create({ data: c })),
  );

  const cat = Object.fromEntries(categorias.map((c) => [c.nombre, c.id])) as Record<
    string,
    string
  >;

  // Festivos oficiales de México (descanso obligatorio).
  await prisma.holiday.createMany({
    data: [
      { fecha: '2026-01-01', nombre: 'Año Nuevo' },
      { fecha: '2026-02-02', nombre: 'Día de la Constitución' },
      { fecha: '2026-03-16', nombre: 'Natalicio de Benito Juárez' },
      { fecha: '2026-05-01', nombre: 'Día del Trabajo' },
      { fecha: '2026-09-16', nombre: 'Independencia de México' },
      { fecha: '2026-11-16', nombre: 'Revolución Mexicana' },
      { fecha: '2026-12-25', nombre: 'Navidad' },
      { fecha: '2027-01-01', nombre: 'Año Nuevo' },
      { fecha: '2027-02-01', nombre: 'Día de la Constitución' },
      { fecha: '2027-03-15', nombre: 'Natalicio de Benito Juárez' },
      { fecha: '2027-05-01', nombre: 'Día del Trabajo' },
      { fecha: '2027-09-16', nombre: 'Independencia de México' },
      { fecha: '2027-11-15', nombre: 'Revolución Mexicana' },
      { fecha: '2027-12-25', nombre: 'Navidad' },
    ],
  });

  await prisma.setting.create({
    data: { clave: 'privacidad_total_clientes', valor: 'false' },
  });

  // -------------------------------------------------------------------------
  // Cartera de Ana (la cuenta con la que conviene entrar primero)
  // -------------------------------------------------------------------------
  const [textilNorte, grupoAurora, cafeMonarca, hidraulicaDelBajio] = await Promise.all(
    [
      {
        nombreEmpresa: 'Textil Norte',
        correo: 'contacto@textilnorte.mx',
        contactoNombre: 'Luis Peña',
        telefono: '81 1234 5678',
        periodicidadNomina: 'semanal',
        notas: 'Renovación de contrato en octubre. Prefieren llamadas por la mañana.',
      },
      {
        nombreEmpresa: 'Grupo Aurora',
        correo: 'compras@grupoaurora.mx',
        contactoNombre: 'Paulina Vega',
        telefono: '55 8765 4321',
        periodicidadNomina: 'quincenal',
        notas: 'Cuenta más grande de la cartera. Reporte mensual el día 15.',
      },
      {
        nombreEmpresa: 'Café Monarca',
        correo: 'hola@cafemonarca.mx',
        contactoNombre: 'Diego Marín',
        telefono: '33 2211 9090',
        periodicidadNomina: 'mensual',
        notas: null,
      },
      {
        nombreEmpresa: 'Hidráulica del Bajío',
        correo: 'ventas@hidraulicabajio.mx',
        contactoNombre: 'Sofía Ramírez',
        telefono: '442 190 3344',
        periodicidadNomina: 'quincenal',
        notas: 'Pago pendiente de la factura 2291.',
      },
    ].map((c) => prisma.client.create({ data: { ...c, ownerUserId: ana.id } })),
  );

  // Cartera de Carlos — sirve para comprobar que Ana NO la ve.
  await Promise.all(
    [
      {
        nombreEmpresa: 'Aceros Peninsular',
        correo: 'info@acerospeninsular.mx',
        contactoNombre: 'Rodrigo Cano',
        telefono: '999 445 1212',
        periodicidadNomina: 'semanal',
        notas: 'Cartera de Carlos: no debe aparecerle a Ana.',
      },
      {
        nombreEmpresa: 'Editorial Cardinal',
        correo: 'direccion@cardinal.mx',
        contactoNombre: 'Ximena Duarte',
        telefono: '55 3030 7788',
        notas: null,
      },
    ].map((c) => prisma.client.create({ data: { ...c, ownerUserId: carlos.id } })),
  );

  await prisma.client.create({
    data: {
      ownerUserId: mariana.id,
      nombreEmpresa: 'Consultoría Vértice',
      correo: 'contacto@vertice.mx',
      contactoNombre: 'Andrés Lomelí',
      telefono: '55 6060 1010',
      periodicidadNomina: 'mensual',
    },
  });

  // -------------------------------------------------------------------------
  // Reglas de recurrencia de muestra
  // -------------------------------------------------------------------------
  const reglaDiasHabiles: ReglaRecurrencia = {
    frecuencia: 'dias_habiles',
    intervalo: 1,
    dias: [1, 2, 3, 4, 5],
    omitirFinDeSemana: true,
    reglaReajuste: 'siguiente_habil',
    respetarFestivos: true,
    terminacion: 'nunca',
  };

  const reglaSemanalLMV: ReglaRecurrencia = {
    frecuencia: 'semanal',
    intervalo: 1,
    dias: [1, 3, 5], // lunes, miércoles, viernes
    omitirFinDeSemana: true,
    reglaReajuste: 'siguiente_habil',
    respetarFestivos: true,
    terminacion: 'nunca',
  };

  const reglaMensualDia15: ReglaRecurrencia = {
    frecuencia: 'mensual_dia',
    intervalo: 1,
    dias: [],
    diaMes: 15,
    omitirFinDeSemana: true,
    reglaReajuste: 'siguiente_habil',
    respetarFestivos: true,
    terminacion: 'nunca',
  };

  // -------------------------------------------------------------------------
  // Tablero de Ana
  // -------------------------------------------------------------------------
  type Semilla = {
    titulo: string;
    descripcion?: string;
    categoria: string;
    prioridad: string;
    estado?: string;
    clave?: string | null;
    hora?: string | null;
    clientId?: string | null;
    recurrencia?: ReglaRecurrencia;
    /** Minutos de antelación del recordatorio. Los materializa la app sola. */
    recordatorio?: number;
    completadaHace?: number;
    subtareas?: string[];
    subHechas?: number;
  };

  const tableroAna: Semilla[] = [
    {
      // ← la Urgente VENCIDA que pide la verificación
      titulo: 'Enviar cotización de renovación a Textil Norte',
      descripcion:
        'Llevan dos semanas esperando el ajuste de precios. Va con descuento por volumen.',
      categoria: 'Pendiente',
      prioridad: 'urgente',
      estado: 'por_hacer',
      clave: d(-3),
      hora: '10:00',
      clientId: textilNorte.id,
      subtareas: ['Actualizar lista de precios', 'Validar descuento con Dirección', 'Enviar PDF'],
      subHechas: 1,
    },
    {
      // ← la EN PROCESO
      titulo: 'Preparar reporte mensual de Grupo Aurora',
      descripcion: 'Incluir comparativo trimestral y las tres cuentas nuevas.',
      categoria: 'Tarea',
      prioridad: 'alta',
      estado: 'en_proceso',
      clave: HOY,
      hora: '12:30',
      clientId: grupoAurora.id,
      recordatorio: 30,
      subtareas: [
        'Descargar cifras del trimestre',
        'Armar comparativo',
        'Revisar redacción',
        'Enviar a Paulina',
      ],
      subHechas: 2,
    },
    {
      // ← la HECHA
      titulo: 'Confirmar datos fiscales de Café Monarca',
      categoria: 'Seguimiento',
      prioridad: 'media',
      estado: 'hecha',
      clave: d(-1),
      clientId: cafeMonarca.id,
      completadaHace: 1,
    },
    {
      titulo: 'Llamar a Sofía por la factura 2291',
      descripcion: 'Sigue sin conciliarse el pago de julio.',
      categoria: 'Seguimiento',
      prioridad: 'urgente',
      estado: 'por_hacer',
      clave: HOY,
      hora: '09:15',
      clientId: hidraulicaDelBajio.id,
      recordatorio: 15,
    },
    {
      titulo: 'Revisar propuesta de Café Monarca antes de enviarla',
      categoria: 'Revisión',
      prioridad: 'alta',
      estado: 'por_hacer',
      clave: HOY,
      hora: '16:00',
      clientId: cafeMonarca.id,
      recordatorio: 60,
    },
    {
      titulo: 'Actualizar notas de la cartera',
      categoria: 'Tarea',
      prioridad: 'baja',
      estado: 'por_hacer',
      clave: HOY,
    },
    {
      titulo: 'Junta de seguimiento con Grupo Aurora',
      descripcion: 'Sala 2. Llevar impreso el comparativo.',
      categoria: 'Junta',
      prioridad: 'alta',
      estado: 'por_hacer',
      clave: habil(2),
      hora: '11:00',
      clientId: grupoAurora.id,
      // Un día antes: la junta se prepara con tiempo.
      recordatorio: 1440,
    },
    {
      titulo: 'Preparar visita a planta de Hidráulica del Bajío',
      categoria: 'Tarea',
      prioridad: 'media',
      estado: 'por_hacer',
      clave: habil(4),
      hora: '08:30',
      clientId: hidraulicaDelBajio.id,
    },
    {
      titulo: 'Ordenar pendientes de la semana',
      categoria: 'Pendiente',
      prioridad: 'baja',
      estado: 'por_hacer',
      clave: null,
    },
    {
      titulo: 'Definir metas del siguiente trimestre',
      categoria: 'Tarea',
      prioridad: 'media',
      estado: 'por_hacer',
      clave: null,
      subtareas: ['Revisar cifras del trimestre actual', 'Proponer tres objetivos'],
      subHechas: 0,
    },
    {
      // ← RECURRENTE: días hábiles. Nunca cae en sábado ni domingo.
      titulo: 'Revisar bandeja y priorizar el día',
      descripcion: 'Primeros 15 minutos del día. Se repite sólo en días hábiles.',
      categoria: 'Recordatorio',
      prioridad: 'media',
      estado: 'por_hacer',
      clave: habil(0),
      hora: '08:45',
      // Recurrente: avisa en CADA ocurrencia, no una sola vez.
      recordatorio: 15,
      recurrencia: reglaDiasHabiles,
    },
    {
      // ← RECURRENTE: semanal L / Mi / Vi
      titulo: 'Seguimiento a cuentas activas',
      descripcion: 'Lunes, miércoles y viernes. Repasar el estado de cada cuenta abierta.',
      categoria: 'Seguimiento',
      prioridad: 'alta',
      estado: 'por_hacer',
      clave: habil(0),
      hora: '17:00',
      recordatorio: 30,
      recurrencia: reglaSemanalLMV,
    },
    {
      // ← RECURRENTE mensual: si el 15 cae en fin de semana, se recorre al lunes
      titulo: 'Enviar reporte mensual a Grupo Aurora',
      categoria: 'Tarea',
      prioridad: 'alta',
      estado: 'por_hacer',
      clave: HOY.slice(0, 8) + '15',
      hora: '13:00',
      clientId: grupoAurora.id,
      recurrencia: reglaMensualDia15,
    },
  ];

  let orden = 0;
  for (const s of tableroAna) {
    const actividad = await prisma.activity.create({
      data: {
        ownerUserId: ana.id,
        titulo: s.titulo,
        descripcion: s.descripcion ?? null,
        categoryId: cat[s.categoria] ?? null,
        prioridad: s.prioridad,
        estado: s.estado ?? 'por_hacer',
        fecha: s.clave ? deClaveDia(s.clave, s.hora || '00:00') : null,
        allDay: !s.hora,
        clientId: s.clientId ?? null,
        recurrenceRule: s.recurrencia ? serializarRegla(s.recurrencia) : null,
        recordatorioMinutos: s.recordatorio ?? null,
        orden: orden++,
        completadaEn:
          s.estado === 'hecha'
            ? deClaveDia(d(-(s.completadaHace ?? 0)), '17:30')
            : null,
      },
    });

    if (s.subtareas?.length) {
      await prisma.activitySubtask.createMany({
        data: s.subtareas.map((texto, i) => ({
          activityId: actividad.id,
          texto,
          hecha: i < (s.subHechas ?? 0),
          orden: i,
        })),
      });
    }
  }

  // -------------------------------------------------------------------------
  // Tableros de Carlos y Mariana (para el Panorama y la prueba de privacidad)
  // -------------------------------------------------------------------------
  const otros: {
    user: string;
    titulo: string;
    prioridad: string;
    estado: string;
    clave: string | null;
    recordatorio?: number;
  }[] = [
    { user: carlos.id, titulo: 'Cerrar propuesta de Aceros Peninsular', prioridad: 'urgente', estado: 'por_hacer', clave: d(-2) },
    // Con recordatorio: sirve para comprobar que a Ana NO le suena el de Carlos.
    { user: carlos.id, titulo: 'Actualizar pipeline del trimestre', prioridad: 'alta', estado: 'en_proceso', clave: HOY, recordatorio: 30 },
    { user: carlos.id, titulo: 'Enviar contrato a Editorial Cardinal', prioridad: 'media', estado: 'por_hacer', clave: habil(1) },
    { user: carlos.id, titulo: 'Conciliar comisiones del mes', prioridad: 'media', estado: 'hecha', clave: d(-4) },
    { user: mariana.id, titulo: 'Prospectar tres cuentas nuevas', prioridad: 'alta', estado: 'en_proceso', clave: HOY },
    { user: mariana.id, titulo: 'Preparar guion de primera llamada', prioridad: 'baja', estado: 'por_hacer', clave: null },
    { user: mariana.id, titulo: 'Enviar material a Consultoría Vértice', prioridad: 'media', estado: 'hecha', clave: d(-2) },
  ];

  for (const [i, o] of otros.entries()) {
    await prisma.activity.create({
      data: {
        ownerUserId: o.user,
        titulo: o.titulo,
        categoryId: cat['Tarea'],
        prioridad: o.prioridad,
        estado: o.estado,
        fecha: o.clave ? deClaveDia(o.clave, '10:00') : null,
        allDay: false,
        recordatorioMinutos: o.recordatorio ?? null,
        orden: i,
        completadaEn: o.estado === 'hecha' ? deClaveDia(d(-1), '16:00') : null,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Entrevistas completadas → histórico de VACANTES
  //
  // El histórico no se captura: se deriva de estas actividades. Se siembran
  // repartidas en varios meses y entre los tres ejecutivos para que la gráfica
  // y el desglose por persona nazcan con algo que enseñar. Una de ellas es una
  // SERIE recurrente: ahí cada ocurrencia completada cuenta por separado.
  // -------------------------------------------------------------------------

  /** Día hábil `mesesAtras` meses antes de hoy, cerca del día `dia`. */
  function enMes(mesesAtras: number, dia: number): string {
    const [a, m] = HOY.split('-').map(Number);
    const total = (a * 12 + (m - 1)) - mesesAtras;
    const anio = Math.floor(total / 12);
    const mes = (total % 12) + 1;
    const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();

    let clave = `${anio}-${String(mes).padStart(2, '0')}-${String(
      Math.min(dia, ultimo),
    ).padStart(2, '0')}`;

    // Que no caiga en fin de semana: las entrevistas son en día hábil.
    while (diaSemana(clave) === 0 || diaSemana(clave) === 6) {
      clave = sumarDias(clave, -1);
    }
    return clave;
  }

  const entrevistas: { user: string; titulo: string; clave: string; cliente?: string }[] = [
    // Mes en curso
    { user: ana.id, titulo: 'Entrevista · Ejecutivo de cuenta junior', clave: enMes(0, 4) },
    { user: ana.id, titulo: 'Entrevista · Analista de datos', clave: enMes(0, 9) },
    { user: carlos.id, titulo: 'Entrevista · Vendedor de campo', clave: enMes(0, 6) },
    // Mes anterior
    { user: ana.id, titulo: 'Entrevista · Coordinadora de operaciones', clave: enMes(1, 12) },
    { user: carlos.id, titulo: 'Entrevista · Ejecutivo comercial', clave: enMes(1, 18) },
    { user: carlos.id, titulo: 'Entrevista · Asistente de dirección', clave: enMes(1, 22) },
    { user: mariana.id, titulo: 'Entrevista · Prospectador telefónico', clave: enMes(1, 8) },
    // Dos meses atrás
    { user: ana.id, titulo: 'Entrevista · Diseñador de propuestas', clave: enMes(2, 7) },
    { user: mariana.id, titulo: 'Entrevista · Ejecutiva de nuevos negocios', clave: enMes(2, 14) },
    { user: mariana.id, titulo: 'Entrevista · Community manager', clave: enMes(2, 21) },
    // Tres meses atrás
    { user: carlos.id, titulo: 'Entrevista · Gerente de zona', clave: enMes(3, 11) },
    { user: ana.id, titulo: 'Entrevista · Practicante de marketing', clave: enMes(3, 25) },
  ];

  for (const [i, e] of entrevistas.entries()) {
    await prisma.activity.create({
      data: {
        ownerUserId: e.user,
        titulo: e.titulo,
        categoryId: cat['Entrevista'],
        prioridad: 'media',
        estado: 'hecha',
        fecha: deClaveDia(e.clave, '11:00'),
        allDay: false,
        orden: 100 + i,
        completadaEn: deClaveDia(e.clave, '12:30'),
      },
    });
  }

  // Una entrevista PENDIENTE: no cuenta como vacante hasta palomearla.
  // Es la que sirve para ver el histórico subir en vivo (punto 9 del README).
  await prisma.activity.create({
    data: {
      ownerUserId: ana.id,
      titulo: 'Entrevista · Ejecutivo de cuenta senior',
      descripcion: 'Todavía no se realiza: al marcarla como Hecha suma una vacante.',
      categoryId: cat['Entrevista'],
      prioridad: 'alta',
      estado: 'por_hacer',
      fecha: deClaveDia(habil(1), '10:30'),
      allDay: false,
      orden: 130,
    },
  });

  // Una SERIE de entrevistas: cada ocurrencia completada cuenta por separado.
  const serieEntrevistas = await prisma.activity.create({
    data: {
      ownerUserId: mariana.id,
      titulo: 'Entrevistas de reclutamiento (bloque semanal)',
      descripcion: 'Cada semana se atiende un bloque. Cada ocurrencia hecha es una vacante.',
      categoryId: cat['Entrevista'],
      prioridad: 'media',
      estado: 'por_hacer',
      fecha: deClaveDia(enMes(2, 3), '09:00'),
      allDay: false,
      orden: 131,
      recurrenceRule: serializarRegla(reglaSemanalLMV),
    },
  });

  await prisma.activityOccurrence.createMany({
    data: [enMes(2, 3), enMes(1, 5), enMes(1, 19), enMes(0, 2)].map((clave) => ({
      activityId: serieEntrevistas.id,
      fechaOriginal: clave,
      estado: 'hecha',
      completadaEn: deClaveDia(clave, '13:00'),
    })),
  });

  // -------------------------------------------------------------------------
  // Vacaciones: saldos y tres solicitudes en distinto estatus
  // -------------------------------------------------------------------------
  const anioActual = Number(HOY.slice(0, 4));

  await prisma.setting.create({
    data: { clave: 'dias_vacaciones_default', valor: '12' },
  });

  const setFestivos = new Set(
    (await prisma.holiday.findMany({ select: { fecha: true } })).map((f) => f.fecha),
  );

  // Los días hábiles NO se escriben a mano: se cuentan con la misma función que
  // usa la app. Un número inventado aquí sería una mentira que las pantallas
  // repetirían sin poder detectarla.
  const solicitudes = [
    {
      // PENDIENTE — la que espera en la bandeja del Admin.
      userId: ana.id,
      tipo: 'vacaciones',
      fechaInicio: habil(24),
      fechaFin: habil(28),
      motivo: 'Puente familiar planeado desde hace meses.',
      estatus: 'pendiente',
    },
    {
      // APROBADA y futura — se ve como bloque de ausencia en la agenda de Ana
      // y en el calendario de ausencias del equipo.
      userId: ana.id,
      tipo: 'vacaciones',
      fechaInicio: habil(9),
      fechaFin: habil(13),
      estatus: 'aprobada',
      resueltoPor: admin.id,
      resueltoEn: deClaveDia(d(-2), '10:00'),
    },
    {
      // RECHAZADA con comentario — no descuenta saldo.
      userId: carlos.id,
      tipo: 'vacaciones',
      fechaInicio: habil(3),
      fechaFin: habil(6),
      motivo: 'Viaje corto.',
      estatus: 'rechazada',
      resueltoPor: admin.id,
      resueltoEn: deClaveDia(d(-1), '09:30'),
      comentarioResolucion:
        'Esa semana cierra el trimestre y necesitamos la cartera cubierta. Propón la siguiente.',
    },
    {
      // Incapacidad aprobada de Mariana: bloquea agenda pero NO descuenta del
      // saldo de vacaciones — por eso su saldo sigue entero.
      userId: mariana.id,
      tipo: 'incapacidad',
      fechaInicio: d(-9),
      fechaFin: d(-6),
      motivo: 'Certificado médico entregado a Administración.',
      estatus: 'aprobada',
      resueltoPor: admin.id,
      resueltoEn: deClaveDia(d(-9), '08:00'),
    },
  ].map((s) => ({
    ...s,
    diasHabiles: contarDiasHabiles(
      { inicio: s.fechaInicio, fin: s.fechaFin },
      setFestivos,
    ),
  }));

  await prisma.vacationRequest.createMany({ data: solicitudes });

  // El saldo también se DERIVA de las solicitudes, no se teclea: así el
  // tablero de saldos nace cuadrado con la bandeja.
  const descuenta = (tipo: string) => tipo === 'vacaciones' || tipo === 'economico';
  const suma = (userId: string, estatus: string) =>
    solicitudes
      .filter((s) => s.userId === userId && s.estatus === estatus && descuenta(s.tipo))
      .reduce((acc, s) => acc + s.diasHabiles, 0);

  await prisma.vacationBalance.createMany({
    data: [
      { user: ana, asignados: 12 },
      { user: carlos, asignados: 12 },
      { user: mariana, asignados: 14 },
      { user: admin, asignados: 12 },
    ].map(({ user, asignados }) => ({
      userId: user.id,
      anio: anioActual,
      diasAsignados: asignados,
      diasTomados: suma(user.id, 'aprobada'),
      diasPendientes: suma(user.id, 'pendiente'),
    })),
  });

  // Un par de entradas de bitácora para que la pantalla no nazca vacía.
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: admin.id,
        entidad: 'sistema',
        entidadId: 'seed',
        accion: 'sembrar_datos_de_muestra',
        despues: JSON.stringify({ usuarios: 5, categorias: categorias.length }),
      },
      {
        actorId: ana.id,
        entidad: 'client',
        entidadId: grupoAurora.id,
        accion: 'crear',
        despues: JSON.stringify({ nombreEmpresa: 'Grupo Aurora' }),
      },
    ],
  });

  console.log('✓ Listo. Usuarios de prueba:');
  console.log('  admin@cadencia.mx     / admin123      (Administración)');
  console.log('  ana@cadencia.mx       / cadencia123   (Ejecutiva — empieza aquí)');
  console.log('  carlos@cadencia.mx    / cadencia123   (Ejecutivo)');
  console.log('  mariana@cadencia.mx   / cadencia123   (Ejecutiva)');
  console.log('  direccion@cadencia.mx / direccion123  (Dirección)');
  console.log(`  · ${direccion.nombre} ve el Panorama en modo lectura.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
