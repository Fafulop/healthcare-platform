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
- **ID Interno** es opcional: si lo dejas vacío se genera solo.
- Además: Tipo de Sangre, Teléfono, Email, Dirección, Ciudad, Estado, Código Postal, contacto
  de emergencia (Nombre, Teléfono, Relación), Alergias, Condiciones Crónicas, Medicamentos
  Actuales, Notas Generales y Etiquetas (separadas por comas).

También puedes crear el expediente **desde una cita**: «+ Crear expediente» (ver
[Vincular la cita a un expediente](#vincular-la-cita-a-un-expediente)).

### El perfil del paciente

Botones de arriba: «Nueva Consulta» · «Recetas» · «Informe» · «Línea de Tiempo» ·
«Docs y Galería» · «Notas» · «Archivar».

**Columna izquierda:** Información de Contacto (con «Editar» para cambiar sus datos) ·
Contacto de Emergencia · Historial de Consultas · Formularios (los pre-consulta que contestó) ·
Notas Generales · Notas Recientes.

**Columna derecha:**

- **Resumen Paciente** — un resumen del expediente hecho con IA: «Generar Resumen» /
  «Regenerar Resumen». **Depende de tu plan.**
- **Datos Fiscales** — RFC, Código Postal Fiscal, Razón Social, Régimen Fiscal, Uso CFDI.
  «Agregar» o «Editar».
- **Citas e Ingresos** — sus citas, con si están pagadas y facturadas.

### Consultas

**«Nueva Consulta»:**

1. **«Plantilla:»** arriba de todo. Si marcaste una como predeterminada, ya viene puesta. Sin
   plantilla, el formulario es el estándar (SOAP y signos vitales).
2. Fecha de Consulta, **Tipo de Consulta** (Consulta · Seguimiento · Emergencia ·
   Telemedicina), **Motivo de Consulta** (obligatorio), y los campos de la plantilla o SOAP.
3. **Seguimiento** (opcional): fecha y notas de seguimiento.
4. **«Crear Consulta».**

**«Chat IA»** (arriba a la derecha): le describes la consulta escribiendo o **dictando** con el
micrófono, y llena los campos del formulario. Revisas y guardas tú. **Depende de tu plan.**

**Una consulta guardada** tiene: «PDF» (con su configuración de impresión), «Editar»,
«Informe» (llenar el formato de una aseguradora con esa consulta) y «Eliminar».

### Recetas

«Recetas» en el perfil → lista con filtro Borradores · Emitidas · Canceladas.

**Nueva receta:**

1. **«Tipo de Receta»:** «Receta estándar (medicamentos y estudios)» o una de tus plantillas de
   receta.
2. Diagnóstico, Notas Clínicas, Fecha de Expiración y, si quieres, «Vincular a Consulta».
3. Medicamentos, estudios de imagen y de laboratorio (receta estándar).
4. **«Guardar como Borrador»** o **«Guardar y Emitir».**

| Estado | Qué puedes hacer |
|---|---|
| **Borrador** | «Editar» · «Emitir Prescripción» · «Eliminar» |
| **Emitida** | «Descargar PDF» · «Cancelar Prescripción» (pide el motivo) · «Eliminar». **Ya no se puede editar** |
| **Cancelada** | Se ve el motivo |

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
Doctor (Privadas)» y vincularlo a una consulta. El espacio de almacenamiento **depende de tu
plan**.

### Notas del paciente

«Notas» → «Nueva Nota». A la izquierda, la lista; a la derecha, el editor. Si cambias de nota
sin guardar, te pregunta antes de descartar.

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

En la lista puedes marcar una como **predeterminada**: se pone sola al abrir «Nueva Consulta».

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
