# 🧪 Prueba manual punta a punta — flujos de una CITA

> Guion de la prueba a mano pendiente tras el rediseño de `/dashboard/appointments`
> (2026-07-28/29). Casi todos los bugs de ese rediseño salieron de probar en vivo o de consultar
> la BD — **el `type-check` estuvo verde TODAS las veces que estuvo mal**. Por eso cada flujo se
> recorre COMPLETO, no por partes.
>
> Contexto: `AGENTE AGENDA/SESSION-REFRESCO` bitácoras **#29** y **#30**.
> Todo lo de aquí es por **rangos** (`range-bookings/instant`) — el picker de slots ya no se usa.

---

## 0. Antes de empezar

- [ ] **Hard refresh** (Ctrl+Shift+R). Ya pasó: se probó el bundle viejo y el bug "seguía ahí".
- [ ] Cuenta **con Google conectado** — sin token el envío de confirmación devuelve 422 y el
      botón falla en vez de desaparecer.
- [ ] Ten a la mano un paciente **cuyo correo viva SOLO en el expediente** (hay 20 en prod). Es
      el caso central de la sección C.

## A. Tabla y filtros

- [ ] **A-1.** Al cargar: fecha = hoy, estado = Activas, el contador coincide con las filas.
- [ ] **A-2.** "Todas las fechas" limpia **solo** la fecha. La consulta útil —**Completada +
      todas las fechas**— tiene que funcionar.
- [ ] **A-3.** Con Activas/Completada activos el desplegable dice **"Más estados…"**, no "Todos
      los estados".
- [ ] **A-4.** Ordenar por paciente, fecha y estado; buscar paciente; "Limpiar" vuelve al default.
- [ ] **A-5.** **Móvil (<640px):** tarjetas en vez de tabla, filtros que envuelven sin cortarse.

## B. Fila desplegable

- [ ] **B-0.** ⭐ **Separación entre citas** (`6b555447`). Colapsadas, la línea entre una cita y
      la siguiente se ve. **Abierta**, la cita se lee como UN bloque (fila sombreada + panel de
      acciones + UNA línea que cierra abajo), no como dos citas. Y la **última** cita de la lista
      no debe cerrar con una línea suelta.
- [ ] **B-1.** Clic en la fila abre/cierra; el chevron también, y con **teclado** (Tab + Enter).
- [ ] **B-2.** Editar precio, vincular expediente o marcar Factura desde la fila colapsada **no**
      la abre/cierra.
- [ ] **B-3.** **Móvil, el caso que rompía:** abrir tarjeta → Completar → hacer clic dentro del
      modal **no** debe colapsar la tarjeta ni desmontar el modal a media captura.

## C. Contacto — cita vs expediente (decisión #30)

Orden: **el EXPEDIENTE manda, la copia de la cita es el respaldo**
(`patient.email || booking.patientEmail`), igual en la fila, el botón, el link de pago y el
servidor. Si divergen, el botón promete un envío que la API rechaza — o al revés.

⚠️ **Este encabezado decía el orden CONTRARIO** ("cita primero, expediente de respaldo"), que es
el de ANTES de la decisión #30 del 2026-07-29. Los checks C-1…C-7 de abajo siempre describieron
el comportamiento bueno; era el encabezado el que se quedó viejo. Corregido 2026-08-03. Un
tester que se guiara por él habría reprobado una implementación correcta.

- [ ] **C-1.** Cita con el correo **solo en el expediente**: la fila lo **muestra**.
- [ ] **C-2.** Esa cita dice **"Enviar confirmación"**, no "Necesita correo".
- [ ] **C-3.** Y el envío **funciona**: al recargar dice "Reenviar confirmación" con el timestamp.
- [ ] **C-4.** Sin correo en ningún lado: **con** expediente "Necesita correo" es link al
      expediente; **sin** expediente es un span gris no clicable.
- [ ] **C-5.** Teléfono basura (5–8 dígitos, los hay en prod) ⇒ "Necesita WhatsApp", **no** un
      `wa.me/` sin destinatario.
- [ ] **C-6.** El enlace de WhatsApp abre con el mensaje listo (nombre, fecha, hora, Meet si es
      telemedicina).
- [ ] **C-7.** El modal de **link de pago** pre-llena correo y teléfono **resueltos**.

## D. Agendar

- [ ] **D-1.** Flujo feliz: elegir hora → paso 2 → Confirmar.
- [ ] **D-2.** **Recurrente** → buscar paciente: precarga **Nombre(s)**, **Apellidos**, correo y
      teléfono; los cuatro (los que el expediente traiga) quedan **bloqueados**; **WhatsApp
      siempre editable**.
- [ ] **D-3.** "Editar contacto" libera **solo** correo y teléfono. **Nombre(s) y Apellidos
      nunca** (una cita quedó "Gerardo Lopezzzz" con el expediente en "Gerardo Lopez").
- [ ] **D-4.** Expediente **sin correo**: el campo sigue escribible y el aviso dice "Estás
      agendando para X".
- [ ] **D-5.** Cambiar a **"Primera vez"** con paciente vinculado **desvincula** y desbloquea (si
      no, es una trampa sin salida).
- [ ] **D-6.** La **✕** del paciente borra nombre/correo/teléfono/WhatsApp pero **conserva Notas**.
- [ ] **D-7.** **Write-back:** corregir el correo al agendar → abrir el expediente → tiene el
      nuevo. Si el PATCH falla, sale toast y **la cita igual queda creada**.
- [ ] **D-8.** Al pasar de paso 1 a paso 2 el contenido arranca **arriba**, no a media forma.
- [ ] **D-9.** "Confirmar cita" deshabilitado hasta elegir servicio, tipo de visita y modalidad.
- [ ] **D-10.** ⭐ **Nombre y apellidos separados (`57859a37`) — el punto de todo el cambio.**
      Primera vez con un nombre de 4 palabras (p. ej. `Juan Carlos` / `García López`) → agendar
      → **+ Crear expediente** desde esa fila: los dos campos llegan **ya partidos**, sin
      adivinanza. El aviso azul debe decir *"Puedes corregirlos antes de guardar"* — si dice
      *"revisa que hayan quedado bien separados"*, es que cayó al split viejo ⇒ la cita nació
      sin los campos separados (revisar que `@healthcare/api` SÍ desplegó).
- [ ] **D-11.** **Apellidos VACÍO debe poder agendarse** — 124 de 366 citas (34%) tienen un
      nombre de una sola palabra. Es opcional a propósito; si el formulario lo exige, es
      regresión.
- [ ] **D-12.** Móvil: los dos campos se **apilan** (no quedan dos cajas ilegibles en 360px).

## E. Reagendar — donde salieron los dos bugs del 28

- [ ] **E-1.** El botón aparece en CONFIRMED **y** en vencidas; no en terminales.
- [ ] **E-2.** Se conservan servicio, tipo de visita y modalidad.
- [ ] **E-3.** **La cita nueva conserva el expediente** — verificar `patient_id` **en la BD**
      (`89872b42`: nacía huérfana ⇒ sin factura, sin link de pago, ingreso suelto en el ledger).
- [ ] **E-4.** **`is_rescheduled = true`** en la BD — era justo lo que la rama de rangos omitía
      (`e2d05528`).
- [ ] **E-5.** La pantalla de éxito dice **"reagendada"**, y el **correo al paciente** también.
- [ ] **E-6.** La cita **vieja queda CANCELLED**; si ese PATCH falla, toast (y la nueva ya existe).
- [ ] **E-7.** ⚠️ **Deuda conocida:** reagendar **pierde las `notes`**. Confirmar y decidir.

## F. Estado y ciclo de vida

- [ ] **F-1.** PENDING → Confirmar → aparece el grupo Confirmación.
- [ ] **F-2.** **Completar** → precio + forma de pago → ingreso en el ledger.
- [ ] **F-3.** **Ya completada:** sobreviven **Cobro** y **Documentos**; desaparecen Estado,
      Confirmación y el bloqueo (fix de #29 — el prompt del agente ya prometía ambos botones).
- [ ] **F-4.** Completada sin Factura y sin formulario SUBMITTED ⇒ Documentos **no se rinde
      vacío**. Con SUBMITTED ⇒ enlace de **lectura**, nunca "Crear formulario".
- [ ] **F-5.** Cobro tras completar **no duplica dinero** (guard server-side + ledger idempotente
      por `bookingId`). ⚠️ Conocido y aceptado: si ya había ingreso y luego se paga por link, el
      ledger **conserva la `formaDePago` original**. No tocar.
- [ ] **F-6.** CANCELLED / NO_SHOW: Cobro **solo** con link PAGADO o ACTIVO. Aparece **Eliminar**.

## G. ¿Necesita factura? y el grupo FACTURA

- [ ] **G-1.** Marcar persiste tras recargar; si el PATCH falla, **revierte**.
- [ ] **G-2.** Marcada ⇒ aparece el grupo **Factura**, **debajo de Cobro** (ya NO dentro de
      Documentos). Desmarcada ⇒ la fila se comporta como antes de esta feature.
- [ ] **G-3.** ⭐ **Marcada SIN expediente** ⇒ dice **"Requiere expediente"** — la misma etiqueta
      que usa Cobro. Antes no aparecía NADA y el doctor se quedaba sin saber qué faltaba.
- [ ] **G-4.** Con expediente y sin datos fiscales ⇒ botón **Facturación** → al crearlo, chip
      **"Esperando datos"** + Copiar + WhatsApp.
- [ ] **G-5.** ⭐⭐ **La falla silenciosa que se arregló (`eed733c2`) — el caso más importante de
      esta sección.** Crea el enlace, **copia la URL a un lado**, y **refresca la página**:
      1. el botón debe seguir diciendo **"Esperando datos"**, NO volver a "Facturación";
      2. vuelve a hacer clic y **la URL debe ser la MISMA** que guardaste, con un toast que diga
         que es el mismo enlace y sigue sirviendo.
      Antes: refrescar borraba el estado y el siguiente clic **invalidaba el enlace que el
      paciente ya tenía**, sin avisar a nadie.
- [ ] **G-6.** Cuando el paciente envía sus datos ⇒ el chip pasa a **"Datos fiscales"** verde.
- [ ] **G-7.** ⚠️ **"Esperando datos" sale en TODAS las citas de ese paciente** — el enlace es
      del PACIENTE, no de la cita. Es correcto; confirmar, no "arreglar".
- [ ] **G-8.** **Regenerar** un enlace fiscal **no tiene camino en la UI** todavía (el endpoint
      lo acepta, ningún botón lo manda). Confirmar que no hace falta para operar.
- [ ] **G-9.** El grupo **Documentos** queda SOLO con el formulario clínico, y no se rinde vacío.
- [ ] ⚠️ **G-10.** El agente **ignora** esta casilla (deuda ya anotada, FACTURAS §8.1). Confirmar
      y seguir.

## G2. Compartir enlaces — el destinatario

- [ ] **G2-1.** ⭐ **El formulario pre-consulta ya manda a ALGUIEN** (`eed733c2`). Abrir el modal
      **Formulario** en una cita con teléfono → WhatsApp abre **con el paciente ya seleccionado**.
      Antes iba `wa.me/?text=…` sin destinatario: abría WhatsApp vacío y el doctor lo daba por
      enviado.
- [ ] **G2-2.** Cita **sin** número usable ⇒ en vez del botón verde dice **"Sin WhatsApp — copia
      el enlace"**, y el botón **Copiar** sigue ahí. Igual en el botón fiscal: **"Sin WhatsApp"**
      con su tooltip, en vez de esconderse.
- [ ] **G2-3.** ⭐ **Teléfono que vive SOLO en el expediente** (no en la cita): la fila lo muestra
      **y** el botón de WhatsApp funciona. Antes la fila lo mostraba y el botón se escondía
      diciendo que no había número — se resolvía de dos maneras distintas
      (`lib/booking-contact.ts` lo unificó).
- [ ] **G2-4.** El modal pre-consulta avisa *"Ya existe un enlace activo. Generar uno nuevo
      invalidará el anterior."* antes de regenerar.
- [ ] **G2-5.** ❌ **Correo: NO existe** en ninguno de los tres enlaces. Confirmar que es así y no
      buscarlo (pendiente #2 del README, bloqueado por la decisión #30).

## H. Expediente y bloqueo de horario

- [ ] **H-1.** La **✕** de desvincular está deshabilitada si el formulario está SUBMITTED.
- [ ] **H-2.** Sin expediente se ofrecen **siempre las dos** opciones (buscar y crear), incluidas
      las citas del **agente** (`isFirstTime` null), que antes rendían un "—" muerto.
- [ ] **H-2b.** **Duplicado por correo.** En **+ Crear expediente**, con un correo que YA es de
      otro expediente **activo**, sale el aviso ámbar nombrándolo + **"Vincular ese expediente"**
      y **"(y N más con ese correo)"** si hay varios. ⚠️ Solo aparece en citas **SIN** expediente
      (con expediente no hay botón de crear) y el match es **exacto**: un correo con typo no
      dispara nada — ya pasó en la primera prueba en vivo. Es **aviso, NO bloqueo**: "Crear y
      vincular" sigue habilitado (cuatro expedientes comparten un correo en prod a propósito).
- [ ] **H-2c.** Mismo aviso en **`Expedientes → nuevo paciente`**: lista TODOS los expedientes
      con ese correo como links. Y en **Editar** un paciente existente **NO** debe salir (haría
      match consigo mismo).
- [ ] **H-2d.** ⭐ **Primera vez NO ofrece buscar expediente** (`4eb117da`). En una cita marcada
      Primera vez y sin expediente, la fila muestra **solo "+ Crear expediente"** más un enlace
      gris *"¿Ya tiene expediente?"* que despliega el buscador al hacer clic. En **Recurrente** y
      en las citas del **agente** (`isFirstTime` null) siguen apareciendo las dos opciones — ese
      caso null llegó a rendir un "—" muerto, así que vale probarlo.
- [ ] **H-2e.** El enlace *"¿Ya tiene expediente?"* **no** abre/cierra la fila (va en StopClick).
- [ ] **H-3.** El bloqueo solo aparece en CONFIRMED y al expandir. Fin ≤ inicio ⇒ **OK
      deshabilitado con tooltip**. **Vaciar** el campo **no** borra el bloqueo guardado.
- [ ] **H-4.** El bloqueo se refleja en la disponibilidad: ese rango deja de ofrecerse.

## I. Cierre — verificar en la BD (read-only, método de los `TOOLING-*`)

- [ ] `patient_id` e `is_rescheduled` de las reagendadas · `factura_solicitada` ·
      `confirmation_email_sent_at` · `extended_block_minutes` · el correo del **expediente** de
      los pacientes cuyo contacto corregiste.

## J. Calendario Día · Semana · Mes · Año (2026-08-02)

Reemplaza el par mini-calendario + panel de día. La tabla "Todas las Citas" **no cambió** —
si algo de las secciones A–I falla, no es de aquí.

- [ ] **J-1.** El selector cambia entre las 4 vistas y **Hoy** vuelve al día actual desde
      cualquiera. `‹ ›` avanzan de a 1 día / 1 semana / 1 mes / 1 año según la vista.
- [ ] **J-2.** El rótulo del periodo es honesto en una semana **a caballo entre dos meses**
      (p. ej. 30 nov – 6 dic) y entre **dos años** (28 dic – 3 ene): nombra los dos.
- [ ] **J-3.** Esa misma semana a caballo muestra los rangos y bloqueos de **los dos meses**.
      Es la regresión que motivó el cambio: antes media semana salía vacía.
- [ ] **J-4.** La **línea roja de ahora** cae en la hora real de Ciudad de México y sólo en
      la columna de hoy. ⚠️ Comprobar **después de las 18:00** — es la franja donde la hora
      del navegador y la de la clínica caen en días distintos.
- [ ] **J-5.** Una cita a las 6:00 o a las 22:00 (fuera de la franja 07–21 por defecto)
      **se ve**: la rejilla se estira para encuadrarla.
- [ ] **J-6.** Dos citas a la misma hora salen **lado a lado**, no una encima de la otra.
      Dos citas contiguas (09:00–09:30 y 09:30–10:00) salen a **ancho completo**.
- [ ] **J-7.** Una cita con **bloqueo extendido** dibuja la cola índigo hasta la hora del
      bloqueo, y ese tramo **no** se ofrece como hueco libre.
- [ ] **J-8.** Clic en un hueco libre abre Agendar (mismo comportamiento que el panel viejo).
      Los huecos < 15 min no se ofrecen.
- [ ] **J-9.** El bote de basura del chip en la franja **"Rangos"** (bajo los encabezados de
      día, NO dentro de la rejilla) **borra ese rango** (confirmación incluida) y la vista se
      refresca.
- [ ] **J-10.** Mes: máximo 3 citas por día y **"+N más"** baja a la vista de día. Los días
      de relleno del mes anterior/siguiente se ven atenuados **pero con sus citas**.
- [ ] **J-11.** Año: el tinte de densidad ignora **canceladas y no-asistió** pero **SÍ cuenta
      las COMPLETADAS**. ⚠️ Es el bug que se arregló: mirar **meses PASADOS** — si enero–julio
      salen en blanco, volvió. Clic en un día baja a Mes; clic en el nombre del mes también.
- [ ] **J-12.** Con el **panel del asistente acoplado**, la vista Semana se desplaza en
      horizontal y no deforma la página.
- [ ] **J-13.** Tras una escritura del **agente** (crear/cancelar cita), la vista se refresca
      sola — cuelga de los mismos hooks que el `subscribeAgendaChanged` de la página.
- [ ] **J-14.** El chip del rango (`09:00–13:00` · **cada N min** · ubicación · 🗑) vive en la
      franja **"Rangos"**, entre los encabezados de día y la rejilla — **fuera** de ella, así
      que nunca se monta sobre una cita. Se ve **sin pasar el cursor** y **en táctil**. En
      Semana se abrevia pero el intervalo **sigue visible** (no sólo en el tooltip). Es la
      única forma de borrar un rango en la página.
- [ ] **J-15.** En Mes, clic en un día de **relleno** (el "26" gris de julio viendo agosto):
      lo resalta **sin** cambiar la rejilla a julio ni recargar. Cambiar a vista Día después
      sí muestra el 26 de julio.
- [ ] **J-16.** Clics rápidos y repetidos en `›` (5+ seguidos): lo que queda en pantalla
      corresponde al periodo del rótulo, no a uno anterior que contestó tarde. Repetir
      pasando de Mes a **Año** a media carga.
- [ ] **J-17.** Un día/semana sin nada muestra "Sin disponibilidad este día/esta semana".
- [ ] **J-18.** **Cancela** una cita: su bloque **desaparece** del calendario (Día, Semana y
      Mes) y el horario queda como hueco libre. Clic ahí → abre Agendar. La cita sigue
      listada en la tabla "Todas las Citas" con el filtro **Todas**.
- [ ] **J-18b.** Marca una cita como **COMPLETADA**: **sigue dibujándose** (es registro de lo
      que pasó) y al pasar el cursor **muestra su tooltip** con paciente, hora y servicio.
      Comprobarlo en **Semana**, donde el nombre va truncado y el tooltip es la única forma
      de leerlo. Su bloque **sí** se queda el clic — es a propósito: no se agenda hacia atrás
      y el tooltip vale más.
- [ ] **J-19.** ⚠️ **INVERTIDO el 2026-08-06.** Decía: *"el aviso no promete fecha ni hora — el
      modal no las precarga"*. Hoy **sí** las precarga y el aviso desapareció, así que el check
      viejo codificaba el mundo anterior. Lo que hay que comprobar ahora vive en la
      sección **L**.

## K. Clic en una cita → modal con sus acciones (2026-08-03, `3447b9c3`)

El modal **no reimplementa** nada: rinde los mismos componentes que la fila desplegada
(`BookingActions.tsx`). Por eso lo que hay que probar aquí NO es si los botones funcionan
—eso lo cubren las secciones F/G/G2/H— sino **si el modal los monta y los desmonta bien**.
Si un botón falla igual desde la tabla, no es de aquí.

- [ ] **K-1.** **Día:** clic en el bloque de una cita abre el modal, y es la cita correcta
      (nombre, estado, fecha/hora, servicio en el encabezado).
- [ ] **K-2.** **Semana:** lo mismo. Es donde el bloque va más angosto y el nombre truncado.
- [ ] **K-3.** **Mes:** clic en el chip de una cita abre el modal **y no mueve el día
      resaltado** ni recarga la rejilla (la celda entera selecciona el día; el chip corta la
      propagación).
- [ ] **K-4.** **Año NO tiene clic por cita** — es tinte de densidad, no dibuja citas.
      Confirmar que es así y no buscarlo.
- [ ] **K-5.** ⭐⭐ **Modal dentro de modal — el check más importante de la sección.**
      Abrir el modal → **Completar** → hacer clic DENTRO del modal de precio (en el campo, en
      una forma de pago). El modal de precio **no** debe desmontarse ni cerrarse el de la
      cita a media captura. Es el bug que ya ocurrió en la tarjeta móvil (B-3) y que
      `StopClick` existe para evitar.
- [ ] **K-6.** ⭐ **Un bloque `COMPLETADA` o `NO ASISTIÓ` encima de un horario que el rango
      deja libre**: gana el **BLOQUE** (abre el modal), no el hueco de "agendar aquí" que
      está debajo. Es a propósito — z-10 sobre z-5.
- [ ] **K-7.** **El modal refleja lo que se escribe.** Editar el precio dentro del modal →
      el número nuevo se queda (no vuelve al viejo al re-renderizar). **Completar** → el
      modal pasa a **COMPLETADA** sin cerrarse, y aparecen Cobro y Documentos.
- [ ] **K-8.** **Eliminar** una cita terminal desde el modal → **el modal se cierra solo**
      (la cita deja de existir en la lista).
- [ ] **K-9.** ⚠️ **Cancelar desde el modal NO lo cierra** — la cita sigue en la lista con
      estado CANCELADA y el modal la muestra así, con su botón Eliminar. Lo que desaparece
      es su **bloque del calendario**. Es deliberado, igual que la fila de la tabla:
      confirmar, no "arreglar". (Si al doctor le resulta raro, es la decisión abierta §5.3
      del SESSION-REFRESCO.)
- [ ] **K-10.** **Reagendar** desde el modal → se cierra el de la cita y abre el de agendar.
      **No deben quedar dos modales apilados.**
- [ ] **K-11.** **Crear formulario** desde el modal → igual: se cierra el de la cita y abre
      el de formulario pre-consulta.
- [ ] **K-12.** ⭐⭐ **El buscador de expediente NO se recorta.** Buscar una cita
      **NO ASISTIÓ y SIN expediente** — es el modal más corto que existe, porque sólo rinde
      *Eliminar* — hacer clic en *"¿Ya tiene expediente?"*, teclear un **apellido común**, y
      comprobar que **los 5 resultados se ven y se pueden elegir**.
      Antes del arreglo el panel medía ~300px y su `overflow` recortaba la lista: `overflow`
      recorta descendientes absolutos **aunque la caja no necesite scroll**. En la tabla el
      caso no existe porque allí no hay ancestro con overflow.
- [ ] **K-13.** Clic en el **fondo oscuro** cierra el modal; clic **dentro del panel** no.
      Arrastrar desde dentro y soltar fuera **tampoco** debe cerrarlo.
- [ ] **K-14.** **Teclado:** con Tab se llega al bloque de una cita y **Enter lo abre**
      (el bloque es un `<button>` de verdad, no un `<div>` clicable).
- [ ] **K-15.** **Paridad con la fila:** para la MISMA cita, el modal ofrece los mismos
      grupos que su fila desplegada en la tabla (Estado · Confirmación · Cobro · Factura ·
      Documentos · Eliminar, los que apliquen a su estado). Cambia el acomodo —el modal los
      apila— no el contenido.
- [ ] **K-16.** El **bloqueo extendido** aparece en el modal sólo si la cita está
      **AGENDADA**, igual que en la tabla (H-3).

---

## L. Clic en el calendario para agendar, con y sin rango (2026-08-06)

Lo que se prueba aquí NO es si el modal agenda —eso lo cubre el picker (§B) y ya está probado—
sino **qué fecha y qué hora llegan** cuando el clic viene de la rejilla. Un fallo típico de esta
sección es una hora **plausible pero equivocada** (el inicio del hueco en vez de donde se clicó),
que no falla ni avisa: simplemente agenda mal.

Prepara un día **sin ningún rango publicado** y otro **con rango y dos citas**.

- [ ] **L-1.** Día SIN rangos: la columna es clicable. Clic a media tarde → el modal abre con
      **esa fecha** y **esa hora**, y el picker dice *"Libre"*.
- [ ] **L-2.** **Dónde se clicó, no el inicio del hueco.** Clic a la altura de las 16:20 → la
      hora precargada es **16:15**, no las 07:00 ni las 16:30. Es el bug que esta sección existe
      para atrapar.
- [ ] **L-3.** Con **2+ servicios**: clic → elegir el servicio → **la fecha y la hora siguen
      puestas**. (Antes, elegir servicio borraba la fecha.)
- [ ] **L-4.** Clic en un hueco **entre dos citas**: la hora propuesta cae dentro del hueco, no
      encima de ninguna cita, y respeta el **bloqueo extendido** si lo hay.
- [ ] **L-5.** **Hoy, arriba de la línea roja de "ahora"**: no hay nada clicable. Justo debajo,
      sí — y el picker **no** dice "ya pasó".
- [ ] **L-6.** Un día **anterior a hoy**: nada clicable en toda la columna.
- [ ] **L-7.** **La rejilla de 15 es la afordancia, no el límite.** Tras la precarga de 16:15,
      escribe **16:07**: debe seguir aceptándose y agendar a esa hora exacta.
- [ ] **L-8.** El hueco de un rango se comporta **igual** que uno fuera de rango (misma
      precarga, misma alineación). El fondo azul del rango sólo informa.
- [ ] **L-9.** Clic en un hueco de un día de **otro mes** (vista Semana a caballo entre dos, o
      navegando): el mini-calendario del modal abre en **ese** mes, con el día marcado.
- [ ] **L-10.** Abre el modal con el botón **"Agendar cita"** de siempre justo después de haber
      usado un hueco: debe abrir **vacío**, sin heredar el hueco anterior. Lo mismo al
      **Reagendar**.
- [ ] **L-11.** **Teclado:** llega con Tab a un hueco y activa con Enter. Debe abrir el modal
      con una hora del hueco (la primera marca de 15 min), no con una hora fuera de él.
- [ ] **L-12.** **Semana:** todo lo anterior sigue valiendo con 7 columnas angostas, y el clic
      en el **encabezado** del día sigue bajando a la vista de Día en vez de agendar.

---

**Fuera de este guion:** el agente (sus 3 deudas van juntas en `AGENTE FACTURAS/SESSION-REFRESCO`
§8, una sola corrida de 81 casos), recordatorios, envío de formularios por correo, y el acomodo
final de la fila.

**Deudas a confirmar, no a descubrir:** `notes` al reagendar (E-7) · el agente ignora la casilla
Factura (**G-10**) · `formulariosPreConsulta` cuenta los FISCALES · vincular expediente sigue sin
ser obligatorio · el formulario pre-cita dice "Crear formulario" y su `wa.me` va sin número.
~~`handleBookInGap` no precarga fecha ni hora (J-19)~~ — **pagada el 2026-08-06**; lo que queda
es probar la sección **L**.

⚠️ Esta lista decía también *"el agente lee el contacto de la CITA (#30)"*. **Ya no es cierto:**
se pagó el 2026-07-30 (`d1f9a4d3`), `get_booking_detail` resuelve `patient.email || patientEmail`
igual que la UI. Y la casilla Factura era **G-10**, no G-4. Corregido 2026-08-03.
