# Cadencia

**Agenda digital de ejecutivos** · *By Forja Estudio* — «Diseñado para fluir»

Un lugar ordenado para que cada ejecutivo maneje su día a día: sus actividades con nivel de
prioridad, un dashboard con lo de hoy, su cartera de clientes (sólo la suya), un calendario
donde agenda actividades puntuales o recurrentes, sus **vacaciones** sin fricción, y el
**histórico de vacantes** que se llena solo con las entrevistas que de verdad se completaron.
El foco son **tareas y responsabilidades**, no reuniones: las juntas son una categoría más.

> **Regla de oro:** que en 10 segundos veas qué te toca hoy y qué es lo más urgente, que tu
> cartera sea privada, que pedir vacaciones no cueste trabajo, que el histórico de vacantes
> cuente **sólo** entrevistas realmente completadas, y que **ninguna** actividad recurrente
> caiga en fin de semana.

Esta es la **versión LOCAL**: corre entera en tu máquina, sin cuentas ni servicios en la nube,
guardando todo en un SQLite local. La ruta para llevarla a la nube está al final.

---

## Requisitos

- **Node.js 20 o superior** (probado con Node 22). Nada más.
- No hace falta Docker, ni base de datos instalada, ni llaves de ningún servicio.

## Cómo correrlo

```bash
npm install     # instala dependencias y genera el cliente de Prisma
npm run seed    # crea la base y carga datos de prueba
npm run dev     # http://localhost:3000
```

Abre <http://localhost:3000> y entra con cualquiera de los usuarios de abajo.

> `npm run dev` también crea la base si no existe, así que si te saltas el `seed` la app
> levanta igual — sólo que vacía. Con `seed` puedes probar todo de inmediato.

## Usuarios de prueba

| Correo | Contraseña | Rol | Qué ve |
|---|---|---|---|
| `ana@cadencia.mx` | `cadencia123` | Ejecutiva | **Empieza aquí.** Tablero completo, 4 clientes propios, series recurrentes |
| `carlos@cadencia.mx` | `cadencia123` | Ejecutivo | Otra cartera — sirve para comprobar que no se cruzan |
| `mariana@cadencia.mx` | `cadencia123` | Ejecutiva | Cartera pequeña |
| `admin@cadencia.mx` | `admin123` | Administración | Usuarios, catálogos, directorio completo, bitácora |
| `direccion@cadencia.mx` | `direccion123` | Dirección | Panorama de lectura, directorio y catálogos en lectura |

En la pantalla de acceso y en el menú de usuario hay un **conmutador de pruebas**: entra como
cualquiera de ellos sin escribir contraseña, para saltar entre roles rápido. Sólo existe en
desarrollo local; en producción desaparece.

**Los datos de muestra son ficticios y están para reemplazarse por los reales.**

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run seed` | Crea/actualiza la base y siembra los datos de prueba |
| `npm run db:reset` | **Borra** la base, la vuelve a crear y la siembra desde cero |
| `npm run build` / `npm start` | Compilación y arranque de producción |
| `npm run test:recurrencia` | Prueba el motor de recurrencia (no requiere servidor) |
| `npm run test:recordatorios` | Prueba el cálculo de recordatorios (no requiere servidor) |
| `npm run test:ausencias` | Prueba los días hábiles y el saldo de vacaciones (no requiere servidor) |
| `npm run test:agenda` | Prueba la agenda expandida contra el servidor (requiere `npm run dev`) |

La base es el archivo `prisma/dev.db`. Borrarlo equivale a `db:reset`.

> Si vienes de una copia anterior a vacaciones y vacantes, corre **`npm run db:reset`** una vez:
> el esquema creció (`VacationRequest`, `VacationBalance`, `Notification`, `Category.esEntrevista`)
> y `prisma db push` se niega a aplicar algunos cambios sobre la base vieja.

---

## Los módulos

### Actividades — el corazón

Alta rápida escribiendo el título y Enter. Cada actividad puede llevar nota, categoría con
color, **prioridad** (Baja · Media · Alta · **Urgente**), estado (Por hacer → En proceso →
Hecha), fecha y hora, **recordatorio**, cliente vinculado, sub-actividades que suman porcentaje
de avance, y recurrencia.

Dos vistas con conmutador arriba: **Lista** (agrupable por estado, prioridad, categoría o
cliente) y **Kanban** (tarjetas arrastrables entre columnas). El calendario es el módulo
Agenda. Hay filtros por prioridad, categoría, cliente y fecha, más buscador.

Al palomear, la interfaz responde al instante y el servidor confirma después; si algo falla,
se revierte.

### Dashboard

**Hoy** ordenado por prioridad (Urgente arriba), **Vencidas** en terracota con días de atraso,
**Próximas** de los siguientes siete días, resumen del día, distribución por prioridad y la
agenda con hora del día. Esa lista es un repaso de lo que hay hoy; los avisos que suenan son
otra cosa y viven en la campana del encabezado (ver **Recordatorios**).

Accesos rápidos arriba: nueva actividad, agenda, clientes y **solicitar vacaciones**.

Dirección entra directo a su **Panorama**: carga por persona, vencidas y urgentes por
ejecutivo, cumplimiento de la semana y las **vacantes del mes** con quién las atendió. Sólo
cifras agregadas.

### Agenda

Vistas **Día · Semana · Mes**. Día y Semana son rejilla horaria con una línea fina terracota
en la hora actual; Mes es la cuadrícula clásica. Hoy va resaltado y los festivos marcados.

- Clic en un hueco → crea una actividad ahí.
- Arrastrar una actividad → la mueve de día y de hora.
- Panel lateral con la agenda del día enfocado.
- Teclado: `←` `→` mover · `T` hoy · `D` `S` `M` cambiar vista.
- Tus **vacaciones aprobadas** salen marcadas como bloque de ausencia: no impiden agendar, pero
  la agenda dice en voz alta que ese día no estás.

### Recordatorios

En la ficha de cada actividad hay un campo **Recordarme**: a la hora, 5 · 15 · 30 minutos,
1 · 2 horas o 1 día antes. El aviso aparece en la **campana del encabezado**, con el número de
pendientes en terracota. Desde ahí se puede **posponer 10 minutos**, dar **Listo**, o hacer clic
en el título para ir al día en que la actividad cae.

- **Una serie recurrente avisa en cada ocurrencia**, no una sola vez. Las ocurrencias saltadas y
  las que ya diste por hechas no avisan.
- El aviso se cuenta desde la hora **efectiva** de esa ocurrencia: si el motor la recorrió a día
  hábil, o si la moviste a mano, el recordatorio se va con ella.
- Si la actividad **no tiene hora**, el aviso se cuenta desde las **08:00** de su día — avisar
  «a la hora» de una actividad de día completo sería avisar a medianoche.
- Completar la actividad, saltar la ocurrencia o quitarle el recordatorio **retira el aviso** de
  la campana, aunque ya hubiera sonado.

**Cómo está implementado.** A diferencia de las ocurrencias —que se generan por ventana y no se
guardan— los recordatorios **sí se materializan** en la tabla `Notification`, con un horizonte de
30 días que se rueda solo. Es lo que permitirá que en la nube una función programada los lea por
`programadaPara` y los mande, sin recorrer la app entera.

La pieza que lo mantiene sano es que **la sincronización es idempotente**: se rehace completa en
cada escritura de la actividad y sólo borra los avisos que aún no han sonado. Los que ya sonaron
son estado del usuario —pospuestos, descartados— y se respetan; sólo se retiran cuando pierden su
razón de ser. La llave es `activityId + fechaOriginal`, así que resincronizar mil veces no
duplica ni resucita nada.

El cálculo vive aparte de la base en `src/lib/recordatorios.ts`, igual que el motor de
recurrencia, para poder probarse solo: `npm run test:recordatorios` cubre las antelaciones, el
día completo, la ventana de materialización, las series y el retiro de avisos.

> El aviso «1 día antes» de una actividad del lunes cae en domingo. Es a propósito: la campana no
> es una notificación push, es una bandeja: el recordatorio espera ahí y lo ves el lunes al abrir.
> La regla de oro es sobre las **actividades**, y ninguna cae en fin de semana.

### Clientes

Cada ejecutivo administra **su propia** cartera: nombre de la empresa, correo, nombre del
contacto, teléfono, **periodicidad de nómina** (semanal · quincenal · mensual) y notas. Al abrir
un cliente se ven sus datos y las actividades vinculadas.

La periodicidad sale como píldora en el directorio, así que se lee la cadencia de toda la cartera
de un vistazo. Es opcional: un cliente sin ella simplemente no la muestra. El valor se valida en
el servidor y no sólo en el desplegable — por API también entra por ahí, y cualquier cosa fuera
de las tres opciones se ignora.

Administración puede reasignar la cartera (traspaso) y ver el directorio completo; Dirección lo
ve en lectura. Hay un **interruptor de privacidad total** en Administración → Catálogos: con él
activado, nadie ve carteras ajenas, ni Administración ni Dirección.

### Vacaciones y ausencias

El ejecutivo pide desde su portal; Administración aprueba o rechaza.

**Portal del ejecutivo (`Vacaciones`).** Botón **Solicitar vacaciones** con tipo (Vacaciones ·
Permiso · Incapacidad · Día económico), fechas, motivo y comprobante opcional. Mientras eliges
las fechas, la ficha te dice **cuántos días hábiles son** y **cuántos te quedarían** — y si algo
no cuadra, te lo dice antes de enviar, no después. Abajo, el historial con su estatus y el saldo
del año. Puedes **cancelar** mientras siga pendiente, o si ya está aprobada pero aún no empieza.

**Portal de Administración (`Administración → Vacaciones`).** Las pendientes arriba, cada una
con quién, tipo, fechas, días, motivo y —lo que hace falta para decidir— el **aviso de
traslape**: quién más estará fuera esas fechas. **Aprobar** descuenta del saldo y bloquea las
fechas; **Rechazar** exige comentario y no descuenta nada. Abajo, la tabla de **saldos anuales**,
editable.

**Calendario de ausencias (`Ausencias`).** Quién está o estará fuera, por mes y filtrable por
tipo. Administración lo ve completo; Dirección en lectura; un ejecutivo, el suyo. Las vacaciones
aprobadas también aparecen como **bloque de ausencia** en su propia agenda.

Tres decisiones que sostienen el módulo:

- **Los días hábiles son los mismos que los de la recurrencia.** `contarDiasHabiles()` reutiliza
  `esHabil()` del §6, así que «5 días hábiles» significa lo mismo en una serie recurrente que en
  una solicitud, y los festivos del catálogo salen de la cuenta en las dos.
- **El saldo disponible no se guarda: se deriva** (asignados − tomados − pendientes). Y cada
  movimiento va en la misma transacción que el cambio de estatus, para que no exista un instante
  en que una solicitud esté aprobada y el saldo no.
- **Una incapacidad no se come las vacaciones.** Bloquea la agenda, pero sólo los tipos marcados
  `descuentaSaldo` tocan el saldo anual.

Los comprobantes se guardan **fuera de `public/`**, en `almacen/adjuntos/`, y se entregan por
`/api/adjuntos/[id]`, que sí comprueba permisos: un certificado de incapacidad no puede quedar
accesible por URL a quien la adivine. Sólo lo abren su dueño y Administración; a cualquier otro
—Dirección incluida— le responde **403**.

`npm run test:ausencias` cubre el conteo de días hábiles, los festivos, el saldo derivado, las
reglas por tipo y la detección de traslapes en los bordes.

### Histórico de vacantes

**Una vacante es una entrevista realizada.** El tablero (`Vacantes`) trae una gráfica de barras
por mes, la tabla histórica con el desglose por ejecutivo, tarjetas de resumen, filtros por año ·
ejecutivo · rango de meses, y **Exportar CSV**. Al hacer clic en un mes —en la barra o en la
fila— se abre la lista de las entrevistas que se contaron.

**El histórico no se captura: se deriva.** Basta con que el ejecutivo palomee su entrevista para
que suba; desmarcarla la resta. Las reglas del conteo:

- Cuenta una actividad de la categoría marcada como **entrevista** (Administración → Catálogos)
  que esté en estado **Hecha** con su `completadaEn`.
- El **mes** sale de `completadaEn` en America/Mexico_City.
- Se atribuye al **dueño** de la actividad: ése es «quién se encargó».
- Si la entrevista es **recurrente**, cada **ocurrencia** completada cuenta como una vacante
  independiente. Para una serie se leen las ocurrencias y **no** el estado de la actividad madre:
  contar además la madre haría que una serie de diez entrevistas valiera once.

Por eso no hay tabla de vacantes ni escritura: es una consulta agregada, siempre consistente con
las actividades reales. **Admin y Dirección** ven el histórico completo con el desglose de quién
atendió cada una; un **ejecutivo** ve sólo el suyo, y el recorte lo hace el servidor antes de
mandar nada — los filtros de la pantalla trabajan sobre lo ya permitido.

La gráfica es de **una sola serie** (el total del mes), así que lleva un solo color: terracota,
la firma de esa pantalla. El desglose por persona vive en la tabla, que además es la vista
accesible de la gráfica; el globo al pasar el cursor lo repite. Los colores se validaron contra
las dos superficies —clara y oscura— antes de fijarlos.

---

## Recurrencia con días hábiles

Es la pieza que más cuidado tiene, porque de ella depende la regla de oro.

**Frecuencias:** días hábiles (L–V) · cada N días hábiles · semanal con días específicos ·
quincenal · mensual por día del mes · mensual por posición («primer lunes», «último viernes»).

**Cómo se garantiza que nada caiga en sábado o domingo,** en dos capas:

1. «Días hábiles» y «cada N días hábiles» **cuentan sólo días laborables**: el fin de semana
   no existe para ellas, así que nunca llegan a generar uno.
2. El resto se genera con RRULE y luego pasa por el reajuste: lo que caiga en fin de semana
   —o en festivo, si está activado— se mueve al **siguiente día hábil** (configurable a
   *día hábil anterior* o a *no generarla*).

Si dos ocurrencias terminan empujadas al mismo día hábil, se conserva una sola.

**Festivos:** catálogo editable por Administración (vienen cargados los oficiales de México
2026–2027). Una ocurrencia en festivo se recorre igual que una de fin de semana.

**Terminación:** sin fin, hasta una fecha, o tras N ocurrencias.

**Editar una serie:** sólo esta ocurrencia · esta y las siguientes · toda la serie. También se
puede mover o saltar una ocurrencia suelta sin romper la serie, y completar una ocurrencia no
completa las demás.

**Una ocurrencia puede tener su propia hora.** El día y la hora siguen reglas distintas y eso es
deliberado: el día sólo se abandona si la moviste tú, porque si se tomara siempre de la excepción
una ocurrencia reajustada de sábado a lunes volvería a su sábado en cuanto le editaras cualquier
cosa — y ahí se cae la regla de oro. La hora, en cambio, se respeta siempre que la ocurrencia
tenga una propia. Las dos mitades viven en `ocurrenciaEfectiva()`, en un solo sitio: cuando la
regla estaba copiada en la agenda y en los recordatorios, los dos tenían el mismo error.

**Cómo está implementado:** la regla se guarda como JSON (frecuencia + `omitirFinDeSemana` +
`reglaReajuste` + `respetarFestivos` + terminación) y las ocurrencias **se generan por ventana**
—sólo el rango que el calendario está mostrando—, no se materializan en la base. En
`ActivityOccurrence` viven únicamente las excepciones: las movidas, las saltadas y las
completadas. `src/lib/recurrence.ts` expone además `aTextoRRule()`, la representación iCal
estándar de la regla, para cuando haya que compartirla con otros calendarios.

Verifícalo con `npm run test:recurrencia`: cubre las seis frecuencias, las tres reglas de
reajuste, las tres terminaciones y afirma que ninguna ocurrencia cae en fin de semana ni en
festivo.

---

## Roles y permisos

| Capacidad | Admin | Ejecutivo | Dirección |
|---|:--:|:--:|:--:|
| Su dashboard y sus actividades | ✔ | ✔ | ✔ (propias) |
| Crear/editar/completar actividades | ✔ | ✔ | ✔ (propias) |
| Directorio de clientes | Todos | **Sólo los suyos** | Todos (lectura) |
| Alta/baja de usuarios y roles | ✔ | ✘ | ✘ |
| Configurar categorías y festivos | ✔ | ✘ | Ver |
| Panorama organizacional | ✔ | ✘ | ✔ (lectura) |
| Bitácora | Toda | Propia | Toda (lectura) |
| Recordatorios | Propios | Propios | Propios |
| Solicitar vacaciones | ✔ | ✔ | ✘ |
| Aprobar/rechazar vacaciones | ✔ | ✘ | ✘ |
| Calendario de ausencias | Todos | Propias | Todos (lectura) |
| Histórico de vacantes | Todos | **Sólo el suyo** | Todos (lectura) |

Dos reglas que conviene tener claras:

- **Las actividades son privadas para todos.** Ni Administración ni Dirección pueden abrir la
  actividad de otra persona; Dirección sólo consume agregados en el Panorama. Un recordatorio
  nace de una actividad, así que hereda la misma regla: cada quien ve y despacha los suyos.
- **El histórico de vacantes respeta lo mismo.** Un ejecutivo sólo ve sus propias vacantes;
  Admin y Dirección ven el agregado del equipo, nunca el detalle de una actividad ajena que no
  sea la entrevista contada.
- **Los clientes son privados por dueño.** El ejecutivo ve y edita únicamente aquellos de los
  que es `ownerUserId`. Administración y Dirección ven el directorio para administrarlo, salvo
  que se active la privacidad total.

Los permisos se aplican **en el servidor**, no escondiendo botones: toda lectura y escritura
pasa por `src/lib/auth/guard.ts`. Forzar por API un recurso ajeno responde **403**:

```bash
# Con la sesión de Ana, pidiendo un cliente de Carlos:
curl -i http://localhost:3000/api/clientes/<id-de-carlos>   # → 403
curl -i http://localhost:3000/api/actividades/<id-de-carlos> # → 403 (incluso siendo Admin)
curl -i http://localhost:3000/api/recordatorios              # → 401 sin sesión; con ella, sólo los propios
curl -i http://localhost:3000/api/adjuntos/<solicitud-de-ana> # → 403 para Carlos y para Dirección
```

En **páginas** (no API) el guard lanza y la frontera de error muestra «Error 403 · Sin acceso»
con el motivo. La respuesta HTTP en ese caso es la del error boundary de Next, no un 403 literal:
lo que importa es que la página no llega a leer ni un dato.

---

## Cómo está organizado

```
prisma/
  schema.prisma        Modelo de datos (SQLite)
  seed.ts              Datos de muestra
pruebas/
  recurrencia.ts       Motor de recurrencia (aislado)
  recordatorios.ts     Cálculo de recordatorios (aislado)
  ausencias.ts         Días hábiles y saldo de vacaciones (aislado)
  agenda.ts            Agenda expandida, contra el servidor
  sesion-cookie.ts     Utilidad: cookies de sesión para probar por API
src/
  app/
    (app)/             Pantallas con sesión: dashboard, actividades, agenda,
                       clientes, vacaciones, ausencias, vacantes, panorama,
                       administración, bitácora
    login/             Acceso + conmutador de pruebas
    api/               Endpoints de lectura (buscar, agenda, clientes,
                       actividades, recordatorios, adjuntos)
    globals.css        Tokens FORJA
  components/
    marca/             Isotipo, wordmark y la firma del estudio
    ui/                Piezas base: diálogo, casilla de palomear, insignias
    chasis/            Encabezado, navegación, tema, buscador ⌘K, campana
    actividades/ agenda/ clientes/ admin/ panorama/
    vacaciones/        Portal del ejecutivo, bandeja de Admin, calendario de ausencias
    vacantes/          Histórico con gráfica y tabla, resumen del Panorama
  lib/
    auth/              Sesión (cookie firmada) y guard de permisos
    repos/             Acceso a datos — la ÚNICA capa que habla con Prisma
    acciones/          Server actions
    recurrence.ts      Motor de recurrencia
    recordatorios.ts   Cálculo de recordatorios (qué avisa y cuándo)
    ausencias.ts       Días hábiles, saldo y validación de una solicitud
    vacantes.ts        Agregación del histórico (servidor y cliente comparten esto)
    tiempo.ts          Todo lo de zona horaria (America/Mexico_City)
    dominio.ts         Vocabulario: prioridades, estados, colores
```

Tres decisiones que sostienen el resto:

- **Ningún componente consulta Prisma.** Todo pasa por `src/lib/repos/`.
- **Un solo lugar decide permisos:** `src/lib/auth/guard.ts`.
- **Las reglas del dominio se calculan sin base de datos.** `recurrence.ts` y
  `recordatorios.ts` son funciones puras; los repositorios sólo las persisten. Por eso las dos
  piezas delicadas se prueban sin levantar nada.

## Identidad visual

Los tokens FORJA viven en un único archivo, `src/app/globals.css`, como canales RGB para que
Tailwind pueda componer opacidades (`bg-terracota/10`). Ajustar la identidad es tocar ese
archivo.

`tinta` #1A1A1A · `hueso` #F4F1EA · `hueso-2` #FAF8F2 · `terracota` #C4622D ·
`verde-forja` #3E5C50 · `ocre` #C8892E · bordes #E4DDCB / #E3DCC9 ·
texto #3E3A31 / #5C574C / #8A8375

Neutros cálidos en cerca del 90 % de cada superficie; **terracota con intención**, una firma
por pantalla. Tipografía **Archivo** para todo y **Newsreader Italic** para un solo acento
editorial por pantalla. Modo claro y oscuro (en oscuro los acentos se aclaran para mantener
contraste AA). Las tipografías se cargan por `<link>`: si la máquina está sin red, la app
funciona igual con Helvetica Neue y Georgia.

El logo es un componente SVG reutilizable (`src/components/marca/Logo.tsx`) y **debajo siempre
va la firma «By Forja Estudio»**.

---

## Qué revisar en la primera vuelta

1. Entra como **Ana** y mira el dashboard: hoy ordenado por prioridad, una urgente vencida en
   terracota, avance y distribución.
2. Escribe un título en la alta rápida y Enter. Palomea algo: el avance sube al instante.
3. Cambia a **Kanban** y arrastra una tarjeta entre columnas.
4. Abre una actividad y vincúlala a un cliente: sólo aparecen los de Ana.
5. Ve a **Agenda**, alterna Día/Semana/Mes, crea una actividad desde un hueco y arrastra otra.
6. Busca «Seguimiento a cuentas activas» en el calendario: es la semanal L/Mi/V —
   **nunca en sábado ni domingo**. La del 16 de septiembre aparece el 17: es festivo.
7. En la **Agenda**, abre una ocurrencia de la serie «Seguimiento a cuentas activas» y cámbiale
   **sólo la hora**: se queda en su día y con la hora nueva, y el resto de la serie no se mueve.
8. Mira la **campana** del encabezado: Ana trae recordatorios sembrados. Abre uno, **posponlo**
   10 minutos y verás que vuelve; dale **Listo** a otro y se va. Si a esta hora todavía no ha
   sonado ninguno, aparecerán bajo «Por venir» — o edita una actividad y ponle una hora que
   acabe de pasar.
9. Ve a **Vacaciones** y pide unos días: mira cómo el conteo de **días hábiles** ignora el fin
   de semana y cómo el saldo baja en vivo. Envíala.
10. Con el conmutador, entra como **Admin** → **Vacaciones**: la solicitud de Ana está arriba, con
   el aviso de traslape si alguien más estará fuera. **Rechaza** una (te exige comentario) y
   **aprueba** otra: el saldo se mueve y la ausencia aparece en **Ausencias** y en la agenda de
   quien la pidió.
11. Abre **Vacantes**: la gráfica por mes y la tabla con el desglose por ejecutivo. Ahora entra
    como **Ana**, busca «Entrevista · Ejecutivo de cuenta senior» y **paloméala**: vuelve a
    Vacantes y verás **+1** ese mes, atribuida a ella. Desmárcala y baja.
12. Con **Carlos**: no ve nada de Ana, ni sus recordatorios ni sus vacantes. Con **Dirección**,
    abre el Panorama (trae las vacantes del mes). Con **Admin**, da de alta un usuario y agrega
    un festivo.
13. Prueba el modo oscuro y `⌘K`.

---

## Migración a la nube (después)

El código ya está preparado; los cambios son acotados:

1. **Base de datos.** En `prisma/schema.prisma`, cambia `provider = "sqlite"` por
   `"postgresql"` y `url` por `env("DATABASE_URL")`. Los campos JSON guardados como `String`
   (`recurrenceRule`, `antes`/`despues` de la bitácora) pueden pasar a `Json`. Ningún
   componente cambia, porque nadie consulta Prisma directamente.

2. **Autenticación.** Sustituye `src/lib/auth/session.ts` por Supabase Auth. Lo único que debe
   seguir en pie es `usuarioActual()` en `guard.ts`: todo lo demás consume esa función. El
   conmutador de pruebas se elimina.

3. **RLS.** `guard.ts` es el espejo de las políticas que hay que escribir:
   - `activities`: `ownerUserId = auth.uid()` para lectura y escritura, **sin excepción de
     rol** — así están hoy.
   - `clients`: `ownerUserId = auth.uid()`, más una policy adicional de lectura para
     `admin`/`direccion` condicionada al ajuste `privacidad_total_clientes`.
   - `vacation_requests`: `userId = auth.uid()` para lectura y escritura del dueño, más una
     policy de lectura y de update sólo para `admin` (aprobar/rechazar). `direccion` **no** entra.
   - `vacation_balances`: lectura del propio dueño; lectura de todos y escritura sólo `admin`.
   - `notifications`: `userId = auth.uid()` para lectura y escritura, sin excepción de rol.
   - Vacantes: no necesita policy propia — se deriva de `activities`, así que hereda la suya.
     El desglose por persona que ven Admin y Dirección es agregado, no detalle.
   - Catálogos: lectura para todos, escritura sólo `admin`.

4. **Tiempo real.** Suscríbete a `activities` y `activity_occurrences` con Realtime. Hoy la app
   usa actualización optimista más revalidación; el enganche va donde ahora se llama
   `router.refresh()`.

5. **Adjuntos.** Los comprobantes de ausencia hoy viven en `almacen/adjuntos/` y se sirven por
   `/api/adjuntos/[id]`. En la nube pasan a **Supabase Storage** en un bucket privado; la ruta
   guardada en `adjuntoRuta` se convierte en la llave del objeto y el route handler devuelve una
   URL firmada de corta vida. La comprobación de permiso no cambia: ya está en el repositorio.

6. **Recordatorios.** Ya están materializados en `Notification` con `programadaPara`, así que el
   trabajo pendiente es sólo el envío: una Edge Function programada que consulte
   `programadaPara <= now() AND enviadaEn IS NULL`, mande el correo o el push, y selle
   `enviadaEn`. El cálculo, el horizonte y el retiro ya están hechos y no cambian. En la policy
   de `notifications`: `userId = auth.uid()` para lectura y escritura, sin excepción de rol.

Lo que **no** hace falta tocar: el motor de recurrencia, el cálculo de recordatorios, los
repositorios, las server actions, los componentes y los tokens visuales.
