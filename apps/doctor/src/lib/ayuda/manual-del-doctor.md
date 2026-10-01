# Manual del doctor

<!--
FUENTE ÚNICA del widget de Ayuda (docs/DESDE JUNIO/AYUDA WIDGET/01-ARQUITECTURA §2).
Reglas para quien edite esto:
  1. Se escribe desde el CÓDIGO, no desde la memoria ni desde las guías de /dashboard/ayuda
     (auditoría 2026-09-22: la de Citas estaba obsoleta desde abril).
  2. Los encabezados ## y ### son CITABLES: el widget responde "según Agenda > Agendar una
     cita". Renombrar uno rompe citas viejas — hazlo sólo a propósito.
  3. Cada nombre de botón va entre «» y debe existir TAL CUAL en la pantalla.
  4. Si algo depende del plan o es sólo del titular, dilo con las marcas de abajo.
  5. Lo que no está aquí, el widget contesta "no lo sé". No rellenes huecos adivinando.
Cubre hoy: Agenda y Expediente. Última revisión contra el código: 2026-09-22.
-->

**Marcas que usa este manual:**

- **Depende de tu plan** — algunos planes no la incluyen; si no está en el tuyo verás un candado
  o el botón no aparece.
- **Sólo el titular** — la hace el dueño de la cuenta, no un asistente o miembro del equipo.

---

## Antes de empezar

### Lo que conviene tener configurado

Para agendar necesitas **al menos un servicio**. Sin servicios, el paso «Servicio» del modal
dice «No hay servicios configurados.» y no puedes seguir.

| Qué | Dónde |
|---|---|
| Servicios (nombre, duración, precio) | **Perfil Público** → pestaña «Servicios» |
| Consultorios (si tienes más de uno) | **Perfil Público** → pestaña «Clinica» |
| Google Calendar | **Mi Cuenta** → pestaña «Integraciones» |
| Avisos por Telegram | **Mi Cuenta** → pestaña «Integraciones» |
| Nombre, cédula y firma de la receta | **Expedientes Médicos** → «Receta PDF» (sólo el titular) |

### Los correos a tus pacientes

Los correos de confirmación y de cancelación **se envían desde tu cuenta de Google**, la misma
con la que entras a la plataforma. Para que salgan hacen falta dos cosas: que el paciente tenga
correo, y que tu cuenta de Google siga conectada. Si falta cualquiera de las dos, la cita queda
sin correo y en ella verás «Enviar confirmación» para mandarlo tú (ver
[Confirmar la cita con el paciente](#confirmar-la-cita-con-el-paciente)).

---

## Agenda

Menú lateral: **Mis Citas**. La pantalla se llama «Gestión de Citas».

### Qué hay en la pantalla

De arriba a abajo:

1. **La barra de botones:** «Formulario libre» · «Agendar Cita» · «Campos de Cita» · «Más» ·
   «Ayuda».
2. **Recordatorio automático por correo** — un interruptor (ver
   [Recordatorios](#recordatorios)).
3. **Tres contadores:** Pendientes · Agendadas · Vencidas.
4. **«Todas las Citas»** — la tabla de citas, con filtros.
5. **El calendario** — vistas Día, Semana, Mes y Año.

En el teléfono, la tabla se muestra como tarjetas.

### Los estados de una cita

| Estado | Qué significa |
|---|---|
| **Pendiente** | La pidió un paciente desde tu perfil público y todavía no la confirmas |
| **Agendada** | Confirmada. Las que agendas tú nacen así |
| **Vencida** | Una Pendiente o Agendada cuya hora ya pasó sin que registraras qué pasó. No es un estado aparte: es un aviso de que falta cerrarla |
| **Completada** | Viste al paciente |
| **No asistió** | El paciente no llegó |
| **Cancelada** | Se canceló |

**Completada, No asistió y Cancelada son finales**: la cita ya no cambia de estado.

**Los contadores** de arriba cuentan Pendientes, Agendadas y Vencidas. Una cita Vencida sólo
cuenta como Vencida, no en los otros dos.

### Agendar una cita

1. **«Agendar Cita»** (en el teléfono dice «Agendar»).
2. **Paso 1 — Horario:**
   - **Servicio.** Elige uno; define cuánto dura la cita.
   - **Fecha.**
   - **Hora.** Escríbela en el campo «Escribe la hora». Puede ser **cualquier minuto**
     (16:07 también), dentro o fuera de tus rangos. El modal te dice al momento si está libre:
     - «Libre. Confirma con el botón o con Enter.» → aprieta «Usar …» o Enter.
     - «Esa hora no está libre. Más cerca:» → te ofrece las horas libres más cercanas como
       botones.
     - «Esa hora no está libre: hay una cita, un bloqueo, o la consulta no alcanza a terminar
       en el día.»
   - Si ese día tienes rangos publicados, sus horas aparecen también como botones arriba del
     campo, y el campo se llama «¿Otra hora?».
3. **Paso 2 — Datos del paciente:**
   - **Tipo de visita:** «Primera vez» o «Recurrente». Con Recurrente puedes buscar al
     paciente en tus expedientes y se llenan sus datos.
   - **Modalidad:** Presencial o Telemedicina.
   - **Consultorio** — sólo aparece si tienes más de uno.
   - Nombre(s), apellidos, correo, teléfono, WhatsApp y **Notas** (opcional: «trae estudios
     previos», etc.). Cuáles de correo/teléfono/WhatsApp son obligatorios lo decides tú en
     [Campos de Cita](#campos-de-cita).
4. **«Confirmar cita».** La cita nace **Agendada** y, si se puede, el paciente recibe su correo
   de confirmación (ver [Los correos a tus pacientes](#los-correos-a-tus-pacientes)).

Para volver a elegir la hora desde el paso 2: «← Cambiar horario».

### Agendar desde el calendario

En las vistas **Día** y **Semana**, **haz clic en un espacio libre** del calendario: se abre el
mismo modal con la fecha y la hora ya puestas (la hora se ajusta al cuarto de hora donde hiciste
clic). Sólo falta elegir el servicio y llenar los datos. La hora sigue siendo una propuesta: si
no está libre, el modal te ofrece las cercanas.

- No hay clic para agendar en las horas que ya pasaron.
- En **Mes**, el clic en un día te lleva a ese día. **Año** sólo muestra qué tan cargado estuvo
  cada mes.
- Para una hora fuera de lo que se ve en el calendario (por ejemplo 06:00), usa «Agendar Cita»
  y escríbela.

### Citas que piden tus pacientes

Tus pacientes pueden pedir cita desde tu **perfil público**, en los horarios de tus
[rangos](#rangos-de-disponibilidad). Esas citas llegan **Pendientes**. Si tienes Telegram
conectado en Integraciones, te llega un aviso.

Una cita Pendiente sólo se puede **«Confirmar»** o **«Cancelar»**. Al confirmarla pasa a
Agendada y el paciente recibe su correo de confirmación.

> ⚠️ En una Pendiente también se ven «Completar» y «No asistió», pero **no funcionan**: el
> sistema responde que la transición no está permitida. Confírmala primero.

### La tabla de citas

Cada fila muestra paciente y servicio, fecha y hora, expediente y contacto, precio, la casilla
«¿Necesita factura?» y el estado. **Haz clic en la fila** (o en la flecha de la derecha) para
abrir sus acciones y sus notas.

**Filtros:**

- **‹ fecha ›** — la tabla abre en **hoy**. Las flechas cambian de día.
- **«Todas las fechas»** — quita el filtro de fecha. Apriétalo otra vez para volver a hoy.
- **«Buscar paciente…»** — por nombre o correo.
- **«Citas Agendadas»** — el filtro con el que entras: Pendientes y Agendadas (incluye las
  vencidas).
- **«Por Facturar»** — citas con «¿Necesita factura?» marcada que todavía no tienen factura,
  de cualquier estado. Respeta la fecha elegida: para verlas todas, enciende también «Todas las
  fechas».
- **«Más estados…»** — para ver «Todos los estados» o uno solo: Pendiente, Agendada,
  Completada, No asistió, Cancelada.
- **«Limpiar»** — aparece cuando cambiaste algo; regresa a hoy + Citas Agendadas.

> Las citas **Canceladas y Completadas no se ven** con el filtro de entrada. Para encontrarlas
> usa «Más estados…».

Puedes ordenar por PACIENTE · SERVICIO, FECHA Y HORA o ESTADO haciendo clic en el encabezado.

**Clic en una cita del calendario** abre las mismas acciones en una ventana.

### Qué puedes hacer con cada cita

Al abrir una cita, las acciones vienen en grupos. Qué grupos aparecen depende del estado:

| Grupo | Pendiente | Agendada | Vencida | Completada | No asistió / Cancelada |
|---|---|---|---|---|---|
| **Estado** (Confirmar, Completar, No asistió, Cancelar, Reagendar) | ✓ | ✓ | ✓ | — | — |
| **Confirmación cita** (correo, WhatsApp, Meet) | — | ✓ | ✓ | — | — |
| **Cobro** (link de pago) | ✓ | ✓ | ✓ | ✓ | sólo si ya hay un link activo o pagado |
| **Factura** (con «¿Necesita factura?» marcada) | ✓ | ✓ | ✓ | ✓ | — |
| **Documentos** (formulario pre-consulta) | — | ✓ | ✓ | sólo si el paciente ya lo contestó | — |
| **Eliminar** | — | — | — | ✓ | ✓ |

Dentro del grupo Estado: «Confirmar» sólo en Pendientes, y «Reagendar» sólo en Agendadas y
Vencidas. En una Vencida, «Confirmación cita» y «Documentos» sólo aparecen si estaba Agendada
(no si seguía Pendiente).

**Completada no cierra el papeleo**: después de completar puedes seguir cobrando y facturando
esa cita.

### Completar una cita

«Completar» abre la ventana **«Completar cita»**, que pide:

- **Precio** de la consulta.
- **Forma de pago:** Efectivo · Transferencia · Tarjeta · Cheque · Depósito.

Al confirmar, la cita queda Completada y **el ingreso se registra en Flujo de Dinero**. Si el
paciente ya había pagado con un link de pago, el ingreso ya estaba registrado y no se duplica.
Si la cita tiene expediente, en su perfil aparece su **visita** (ver [Visitas](#visitas)).

### Cancelar, No asistió y Eliminar

- **«Cancelar»** pide confirmación. El paciente recibe un correo avisando que su cita se canceló
  (si tiene correo y tu cuenta de Google está conectada). El horario vuelve a quedar libre.
- **«No asistió»** marca la cita así, sin avisar al paciente.
- **«Eliminar»** sólo aparece en citas finales, pide confirmación y **no se puede deshacer**.

Una cita cancelada desaparece del calendario, pero sigue en la tabla con «Más estados…» →
Cancelada.

### Reagendar una cita

**«Reagendar»** (en Agendadas y Vencidas) abre el modal de agendar con el paciente ya puesto.
Eliges la nueva fecha y hora y confirmas. Entonces:

1. Se crea la cita nueva, **Agendada**.
2. La cita anterior se **cancela** sola.

El paciente recibe **dos correos**: el aviso de que la cita anterior se canceló y la
confirmación de la nueva.

### Confirmar la cita con el paciente

En una cita Agendada, el grupo **«Confirmación cita»** tiene:

| Botón | Qué hace |
|---|---|
| «Enviar confirmación» | Manda el correo de confirmación. Aparece cuando todavía no se ha enviado (por ejemplo, si al agendar tu cuenta de Google no estaba conectada) |
| «Reenviar confirmación» | Lo mismo, si ya se había enviado. Pasa el cursor para ver cuándo fue el último envío |
| «Confirmación por WhatsApp» | Abre WhatsApp con el mensaje listo; tú lo envías. La plataforma no se entera de si lo mandaste |
| «Entrar a Meet» | Sólo telemedicina, cuando ya hay videollamada creada |
| «Necesita correo» / «Necesita WhatsApp» | Falta ese dato del paciente. Te lleva a su expediente para capturarlo |

**Telemedicina:** al enviarse la confirmación (sola o con el botón) se crea la videollamada de **Google Meet** y el
enlace va en el correo. Reenviar manda el mismo enlace, no crea otro.

### Bloqueo extendido

Una cita Agendada ocupa en tu agenda lo que dura el servicio. Si necesitas más tiempo (por
ejemplo, para notas), abre la cita y en **«Bloqueo: 10:00–10:30 · Editar»** cambia la hora de
fin. Esa hora queda ocupada y nadie más puede agendar en ella.

### Cobrar una cita

Grupo **«Cobro»** → **«Link de pago»**: eliges el proveedor (Stripe o Mercado Pago) y el monto.
Después puedes copiar el link o mandarlo por WhatsApp, y cuando el paciente paga la cita muestra
«Pagado».

- Necesitas tener conectado Stripe o Mercado Pago en **Pagos**.
- La cita necesita **expediente vinculado**; si no, el botón dice «Requiere expediente» (ver
  [Vincular la cita a un expediente](#vincular-la-cita-a-un-expediente)).

### Facturar una cita

1. Marca **«¿Necesita factura?»** en la cita (se puede desde la fila, sin abrirla). Aparece el
   grupo **«Factura»**.
2. **«Facturación»** crea un formulario para que el paciente capture sus **datos fiscales**. Lo
   copias o lo mandas por WhatsApp. Cuando el paciente lo llena, el botón dice «Datos fiscales».
3. La factura se emite desde el **expediente del paciente**, sección «Citas e Ingresos», botón
   «Facturar» (ver [Facturar desde el expediente](#facturar-desde-el-expediente)).

**Depende de tu plan:** facturación.

La cita necesita expediente vinculado; si no, dice «Requiere expediente».

### Vincular la cita a un expediente

En la columna EXPEDIENTE de la cita:

- **«+ Crear expediente»** — crea el expediente con los datos de la cita y los vincula.
- **Buscar** — vincula un expediente que ya existe.
- Si la cita se marcó como **Primera vez**, se ofrece primero crear; si el paciente sí tenía
  expediente, usa **«¿Ya tiene expediente?»** para buscarlo y no duplicarlo.
- La **✕** junto al nombre desvincula (no se puede mientras haya un formulario recibido
  vinculado).

Cobrar, facturar y los datos de contacto dependen de que la cita tenga expediente.

### Formulario pre-consulta

Para que el paciente conteste preguntas antes de la cita:

1. Necesitas una **plantilla** con «Usar como formulario pre-cita» marcado (ver
   [Plantillas](#plantillas)). Si no tienes, el modal te ofrece «Crear plantilla pre-cita →».
2. En una cita Agendada, grupo «Documentos» → **«Crear formulario»**.
3. Elige la plantilla → «Generar enlace». Cópialo o mándalo por WhatsApp.
4. Cuando el paciente lo contesta, el botón dice **«Formulario recibido»** y abre sus
   respuestas. También quedan en el expediente, sección «Formularios».

**«Formulario libre»** (barra de arriba) hace lo mismo **sin cita**: eliges un paciente de tus
expedientes y una plantilla pre-cita, y generas el enlace.

### Recordatorios

La tarjeta **«Recordatorio automático por correo»** tiene un interruptor. Encendido, el paciente
recibe un correo antes de su cita. Tú eliges cuánto antes: 15 min, 30 min, 1 hora, 2 horas,
4 horas o 1 día. Aplica a todas tus citas, no a una sola.

### Campos de Cita

**«Campos de Cita»** decide qué datos son **obligatorios** — correo, teléfono y WhatsApp — en
tres situaciones:

- **«Reserva pública»** — cuando el paciente agenda desde tu perfil.
- **«Horarios disponibles»** y **«Nuevo horario»** — cuando agendas tú. Al agendar desde
  «Agendar Cita» se aplica **«Nuevo horario»**.

### Rangos de disponibilidad

Un **rango** es una ventana de horario que publicas para que **los pacientes** puedan pedir cita
desde tu perfil público. **No los necesitas para agendar tú**: puedes agendar a cualquier hora
libre.

Todo lo de rangos está en el menú **«Más»**, sección Disponibilidad:

- **«Crear Rango»** abre «Crear Disponibilidad»:
  - «Día Único» (una fecha) o «Recurrente» (días de la semana entre dos fechas).
  - Hora de inicio y de fin.
  - «Intervalo entre citas»: 15, 30, 45 o 60 minutos.
  - Consultorio, si tienes más de uno.
  - Revisa la «Vista previa» y confirma con «Crear N Rangos».
- **«Eliminar Rangos»** — borra rangos en bloque.

En el calendario, los rangos se ven como fondo azul.

### Bloquear horarios

**«Más» → «Bloquear horario»** abre **«Gestionar Bloqueos»**:

- Pestaña **«Bloquear»**: eliges fechas (y, si quieres, sólo una franja del día) y confirmas con
  «Bloquear N día(s)». En un horario bloqueado no se puede agendar.
- Pestaña **«Desbloquear»**: eliges bloqueos existentes y los quitas.

### Enlace de reseña

**«Más» → «Enlace Reseña»**: escribe el nombre del paciente (opcional) → «Generar Enlace» →
cópialo o mándalo por WhatsApp. El paciente deja su opinión en tu perfil público. Cada enlace es
distinto.

---

## Expediente

Menú lateral: **Expedientes Médicos**.

### La lista de pacientes

Barra de arriba: «Plantillas» · «Receta PDF» · «Importar» · «Nuevo Paciente». («Receta PDF» e
«Importar» sólo los ve el titular.)

- **Buscar** — «Buscar por nombre o ID…».
- **Estado:** Activos · Inactivos · Archivados.
- **Vista:** «Filas» o «Tarjetas».
- **Cupo del plan** — si tu plan tiene tope de pacientes, junto al número verás
  «N / M activos». Sólo cuentan los activos: **archivar libera lugar**.

### Crear un paciente

«Nuevo Paciente» → llena el formulario → «Crear Paciente».

- **Obligatorios:** Nombres, Apellidos, Fecha de Nacimiento, Sexo.
- **ID Interno** es opcional: si lo dejas vacío se genera solo. Después puedes cambiarlo desde
  «Editar» (no puede repetir el de otro paciente); las recetas o documentos ya impresos
  conservan el anterior.
- Además: Tipo de Sangre, Teléfono, Email, Dirección, Ciudad, Estado, Código Postal, contacto
  de emergencia (Nombre, Teléfono, Relación), Alergias, Condiciones Crónicas, Medicamentos
  Actuales, Notas Generales y Etiquetas (separadas por comas).

También puedes crear el expediente **desde una cita**: «+ Crear expediente» (ver
[Vincular la cita a un expediente](#vincular-la-cita-a-un-expediente)).

### El perfil del paciente

Botones de arriba: «Nueva Visita» · «Recetas» · «Informe» · «Línea de Tiempo» ·
«Docs y Galería» · «Notas» · «Archivar».

**Columna izquierda:** Información de Contacto (con «Editar» para cambiar sus datos; la **flecha**
de abajo abre su Contacto de Emergencia y sus Notas Generales — sin ninguno de los dos no hay
flecha) · **Visitas** · **Consultas sin visita** (sólo si hay) · **Tratamientos** · Formularios (los
pre-consulta que contestó) · Notas Recientes.

**Columna derecha:**

- **Resumen Paciente** — un resumen del expediente hecho con IA: «Generar Resumen» /
  «Regenerar Resumen». **Depende de tu plan.**
- **Datos Fiscales** — RFC, Código Postal Fiscal, Razón Social, Régimen Fiscal, Uso CFDI.
  «Agregar» o «Editar».
- **Citas e Ingresos** — sus citas, con si están pagadas y facturadas.

Visitas, Consultas sin visita, Formularios, Notas Recientes y Citas e Ingresos enseñan sólo las
**3 más recientes**; Tratamientos enseña **3, los activos primero**. El botón **«Ver N más»** debajo
abre los demás y «Ver menos» los vuelve a cerrar.

### Visitas

Una **visita** junta lo que pasó **un día con un paciente**: sus plantillas (consultas), fotos y
documentos, notas, recetas e informes, la cita y un comentario.

**Cómo nace una visita:**

- **Sola, al completar una cita** de un paciente con expediente: aparece «Visita del …» vacía, con
  la fecha, hora y cobro de la cita. Si el expediente se vincula a la cita **después** de
  completarla, la visita aparece al vincularlo.
- **«Nueva Visita»** en el perfil: pregunta **«¿De qué cita?»** (la de hoy ya viene elegida) o
  «Sin cita» con su **Fecha**, y se crea al picar **«Crear visita»**. Si esa cita ya tiene su
  visita, el botón dice **«Abrir su visita»** y no crea otra. Un ayudante sin permiso de citas no ve
  «¿De qué cita?»: su visita se crea sin cita.

**La pantalla de la visita** (clic en «Visita del …»):

- **Cita** — fecha, hora, servicio y si está pagada y facturada. Sin cita, puedes **«Ligar una
  cita…»** o corregir la **Fecha**. La visita que nació de una cita no se desliga.
- **Plantillas** («Agregar plantilla») · **Fotos y documentos** («Subir») · **Notas** («Nueva
  nota») · **Recetas** («Nueva receta») · **Comentario** («Guardar comentario»). Lo que agregas
  desde aquí queda en esta visita. Los **Informes médicos** se hacen desde su plantilla y aparecen
  aquí cuando existen.
- **«Mover a…»** en una plantilla la pasa a otra visita **del mismo día** (o a «Sin visita»), y
  se lleva sus fotos, recetas e informes. **«Traerla aquí…»** trae una consulta sin visita del
  mismo día. La fecha de una plantilla es la de su visita y no cambia (tampoco al editarla): por eso
  sólo se mueve entre visitas de su día, y una visita con plantillas ya no cambia de fecha.
- **«Borrar visita»** sólo aparece mientras está vacía.
- Si la visita es una sesión de un tratamiento, debajo del nombre del paciente dice **«Sesión 3 de
  6 — (nombre del tratamiento)»**; clic para abrir el tratamiento.

**Consultas sin visita** — las registradas fuera de una visita (por ejemplo, las de antes de que
existieran las visitas). Se ven en su propia tarjeta; desde una visita del mismo día puedes
traerlas.

### Tratamientos

Un **tratamiento** es un plan de **varias sesiones** con un paciente (por ejemplo, fisioterapia en
10 sesiones o un injerto en 6). Cada sesión puede tener su **cita** (en la agenda) y su **visita**
(lo que pasó ese día).

**Crear uno:** en el perfil, tarjeta **Tratamientos** → **«Nuevo tratamiento»** (o «Crear un
tratamiento» si no hay ninguno). Escribe el **Nombre**, las **Sesiones planeadas** (opcional: se
crean esas sesiones «Por agendar»; vacío = sin número fijo) y **Notas**, y pica **«Crear
tratamiento»**.

**La pantalla del tratamiento** (clic en uno de la tarjeta) enseña sus sesiones en orden. Cada
sesión dice en qué va:

- **Por agendar** — sin cita, o su cita se canceló o el paciente no asistió (se dice por qué).
- **Agendada** — tiene una cita pendiente o confirmada (con su fecha y hora).
- **Hecha** — ya tiene su visita, o su cita se completó.
- **Cancelada** — la cancelaste tú.

Lo que puedes hacer en cada sesión:

- **«Ligar una cita…»** — elige una cita del paciente; **«Desligar cita»** la suelta (la cita sigue
  en la agenda). Si la cita de la sesión se canceló, puedes ligar otra.
- **«Ligar una visita…»** — sólo si la sesión no tiene cita; **«Abrir su visita»** la abre.
- **«Cancelar sesión»** — si tiene una cita activa, pregunta qué hacer con ella: **«Cancelar la
  sesión y la cita»** (se cancela como desde la agenda, con los mismos avisos al paciente),
  **«Cancelar sólo la sesión (la cita se queda)»** o **«No cancelar nada»**. Una sesión cancelada
  se puede **«Reactivar»**.
- **«Notas»** de la sesión, y **«Borrar»** mientras no tenga cita ni visita.
- **«Agregar sesión»** agrega la siguiente. Cambiar las sesiones planeadas (en **«Editar»**) no
  crea ni borra sesiones.

**«Agendar sesiones…»** agenda varias de golpe: eliges cuáles de las «Por agendar», la **Primera**
fecha, la **Hora**, **Cada (días)**, el **Servicio** y la **Modalidad**; ves cómo quedan y picas
**«Agendar N citas»**. Cada cita se crea como si la agendaras en la agenda. Si alguna no se puede
(por ejemplo, ya hay una cita a esa hora), las demás sí se agendan y ésa se queda «Por agendar»;
la ventana te dice cuál y por qué. Sólo aparece en tratamientos activos. En presencial, al paciente le llega **un solo correo** con todas sus citas (si
tiene correo y tu cuenta de Google está conectada); en telemedicina, cada cita manda el suyo con
su liga de Meet.

**Precio del paquete** (si cobras el tratamiento completo, no por sesión): en **«Editar»** pon el
**Precio del paquete**. Entonces la pantalla muestra **Precio · Pagado · Saldo**, y con
**«Registrar pago del paquete»** anotas cada pago (adelanto o abono: monto, forma de pago y fecha);
cada pago entra a Flujo de Dinero como ingreso. Al **completar** una sesión del paquete no se pide
precio: queda en $0 «cubierta por el paquete» (si hubo algo aparte, capturas el **cargo extra**). A
esas sesiones no se les puede generar link de pago, y lo que se factura es el pago del paquete, no la
sesión. Sin precio de paquete, cada sesión se cobra al completarla como siempre. Lo del paquete sólo
lo ve quien tiene permiso de Flujo de Dinero.

Del tratamiento completo: **«Editar»** (nombre, sesiones planeadas, notas), **«Terminar»**,
**«Cancelar tratamiento»** y **«Reactivar»**. **«Borrar»** sólo funciona mientras ninguna sesión
tenga cita ni visita; si no, cancélalo.

En la **agenda**, una cita que es sesión de un tratamiento dice **«Sesión 3 de 6 — (nombre del
tratamiento)»**; clic para abrir el tratamiento.

**Si reagendas la cita de una sesión** (desde la agenda o con el asistente), la sesión pasa sola a
la cita nueva y te avisa. Si la sesión ya tiene su visita o está cancelada, no se mueve: te avisa y
la ligas tú desde el tratamiento.

### Consultas

Una consulta (la **plantilla** llenada) se agrega **desde una visita**: «Agregar plantilla».

1. **«Plantilla:»** arriba de todo. Si marcaste una como predeterminada, ya viene puesta. Sin
   plantilla, el formulario es el estándar (SOAP y signos vitales).
2. **Tipo de Consulta** (Consulta · Seguimiento · Emergencia · Telemedicina), **Motivo de
   Consulta** (obligatorio), y los campos de la plantilla o SOAP. La fecha es la de la visita.
3. **Seguimiento** (opcional): fecha y notas de seguimiento.
4. **«Guardar en la visita».**

**«Chat IA»** (arriba a la derecha): le describes la consulta escribiendo o **dictando** con el
micrófono, y llena los campos del formulario. Revisas y guardas tú. **Depende de tu plan.**

**Una consulta guardada** tiene: «PDF» (con su configuración de impresión), «Editar»,
«Informe» (llenar el formato de una aseguradora con esa consulta) y «Eliminar».

### Recetas

«Recetas» en el perfil → lista con filtro Borradores · Emitidas · Canceladas.

**Nueva receta:**

1. **«Tipo de Receta»:** «Receta estándar (medicamentos y estudios)» o una de tus plantillas de
   receta.
2. Diagnóstico, Notas Clínicas, Fecha de Expiración, **«¿A qué visita pertenece?»** (sugiere la
   visita más reciente de los últimos 7 días; «Ninguna» la deja sin visita) y, si quieres,
   «Vincular a Consulta» (sólo ofrece las de esa visita). Desde el «Nueva receta» de una visita
   no pregunta: queda en ella.
3. Medicamentos, estudios de imagen y de laboratorio (receta estándar).
4. **«Guardar como Borrador»** o **«Guardar y Emitir».**

| Estado | Qué puedes hacer |
|---|---|
| **Borrador** | «Editar» · «Emitir Prescripción» · «Eliminar» |
| **Emitida** | «Descargar PDF» · «Cancelar Prescripción» (pide el motivo) · «Eliminar». **Ya no se puede editar** |
| **Cancelada** | Se ve el motivo |

**Su visita:** el detalle de la receta dice a qué visita pertenece. Un **Borrador** sin consulta
vinculada cambia de visita en «Editar»; con consulta, va con la visita de esa consulta. Una receta
emitida ya no cambia de visita.

- **Emitir es sólo del titular**: la receta lleva su firma y su cédula.
- Una receta estándar necesita al menos un medicamento para emitirse.
- «Chat IA» también ayuda a llenar la receta. **Depende de tu plan.**

**Cómo sale impresa** (nombre, cédulas, firma): **Expedientes Médicos → «Receta PDF»**. Sólo el
titular.

### Informe para aseguradora

«Informe» en el perfil (o en una consulta) llena el **formato oficial de una aseguradora** con
los datos del expediente. Formatos disponibles: **AXA, Allianz y GNP**.

1. Elige el formato y **de qué consulta** sale el informe.
2. **«Pre-llenar con el expediente»** — copia lo que ya está en la ficha y en esa consulta. Lo
   que no está, se queda vacío: no se inventa.
3. Revisa y corrige sobre la hoja. «Guardar».
4. Descarga el **borrador** cuando quieras. Para el **final** hay que marcar «El paciente
   autorizó enviar estos datos a su aseguradora» — sin eso no se genera.
5. **«Marcar como emitido»** cuando lo entregues. Un informe emitido ya no se edita; para
   corregirlo, «Generar un informe nuevo».

### Línea de tiempo

«Línea de Tiempo» — todo el historial del paciente en orden: consultas, recetas, documentos y
notas. **«Exportar PDF»** genera la historia clínica completa.

### Documentos y galería

«Docs y Galería» → «Subir Archivo». Tipos y tamaños:

| Tipo | Máximo |
|---|---|
| Imágenes | 16 MB |
| Videos | 128 MB |
| Audio | 32 MB |
| PDF | 32 MB |

Puedes ponerle «Categoría» (Herida, Rayos X, Dermatología, Cardiología, Resultado de
Laboratorio, Procedimiento, Consulta, Otro), «Área del Cuerpo», «Descripción», «Notas del
Doctor (Privadas)», **«¿A qué visita pertenece?»** (sugiere la más reciente de los últimos 7
días) y vincularlo a una consulta de esa visita. El espacio de almacenamiento **depende de tu
plan**.

Al abrir un archivo ves su **Visita**. Para cambiarla, el lápiz (editar) → «¿A qué visita
pertenece?» → guardar. Si el archivo está vinculado a una consulta de otra visita, se desvincula
de ella al moverlo; elegir una consulta pone el archivo en la visita de esa consulta.

### Notas del paciente

«Notas» → «Nueva Nota». A la izquierda, la lista; a la derecha, el editor. Si cambias de nota
sin guardar, te pregunta antes de descartar.

Arriba del editor, **«Visita:»** dice a qué visita pertenece la nota. En una nota nueva sugiere
la más reciente de los últimos 7 días; en una ya guardada, cambiarla la mueve (te pregunta
antes) sin tocar el texto.

### Plantillas

«Plantillas» en la lista de pacientes. (La página todavía está en inglés: «Custom Encounter
Templates» y el botón «Create Template».)

El constructor tiene: el **nombre** de la plantilla, «Vista previa», **«IA»** (un chat que agrega
o cambia campos; **depende de tu plan**) y «Guardar».

**9 tipos de campo:** Texto · Texto largo · Número · Fecha · Hora · Desplegable · Selección ·
Casilla · Archivo.

**Para qué sirve cada plantilla** (casillas debajo del nombre):

- Sin marcar — formulario de **consulta**.
- **«Usar como formulario pre-cita»** — aparece al crear un formulario pre-consulta.
- **«Usar como plantilla de receta»** — aparece en «Tipo de Receta».

En la lista puedes marcar una como **predeterminada**: se pone sola al abrir «Agregar plantilla».

### Importar pacientes

**Sólo el titular.** «Importar»:

1. **«Descargar plantilla»** — un Excel con las columnas y una hoja de instrucciones. Llénalo
   sin cambiarle el nombre a las hojas.
2. Sube el archivo (.xlsx o .csv) → **«Revisar archivo»**. Todavía no se guarda nada: te enseña
   cuántos pacientes y consultas van a entrar, qué renglones tienen error (esos no entran) y qué
   avisos revisar.
3. Confirma la importación.

Si tu plan tiene tope de pacientes, la importación lo respeta.

### Archivar un paciente

«Archivar» en el perfil, con confirmación. El expediente **no se borra**: queda en el filtro
«Archivados» y deja de contar para el cupo de tu plan.

> Hoy no hay un botón para **reactivar** un expediente archivado desde la pantalla.

### Facturar desde el expediente

Sección **«Citas e Ingresos»** del perfil. Cada cita muestra si está pagada y si está facturada.

- **«Facturar»** aparece cuando la cita ya tiene ingreso registrado (se completó con precio, o
  se pagó con link) y el paciente tiene sus **datos fiscales completos**.
- Si faltan, dice **«Faltan datos fiscales»**: captúralos en Datos Fiscales o pídeselos al
  paciente con el formulario desde la cita (ver [Facturar una cita](#facturar-una-cita)).
- Ya facturada: «Facturado · Folio N» y los archivos PDF y XML para descargar.
- Para una factura que **no viene de una cita** (insumos, un saldo aparte), usa el botón de
  arriba de la sección: abre Facturación con este paciente ya elegido.

**Depende de tu plan:** facturación.
