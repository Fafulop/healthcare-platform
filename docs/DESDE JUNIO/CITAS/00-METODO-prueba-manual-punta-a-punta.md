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

## C. Contacto — cita vs expediente (bitácora #30)

Orden: **cita primero, expediente de respaldo**, igual en la fila, el botón, el link de pago y el
servidor. Si divergen, el botón promete un envío que la API rechaza — o al revés.

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
- [ ] **J-19.** Al hacer clic en un hueco, el aviso **no** promete fecha ni hora — el modal
      no las precarga (watch-item abierto).

---

**Fuera de este guion:** el agente (sus 3 deudas van juntas en `AGENTE FACTURAS/SESSION-REFRESCO`
§8, una sola corrida de 81 casos), recordatorios, envío de formularios por correo, y el acomodo
final de la fila.

**Deudas a confirmar, no a descubrir:** `notes` al reagendar (E-7) · el agente ignora la casilla
Factura (G-4) · el agente lee el contacto de la CITA (#30) · `formulariosPreConsulta` cuenta los
FISCALES · vincular expediente sigue sin ser obligatorio · el formulario pre-cita dice "Crear
formulario" y su `wa.me` va sin número.
