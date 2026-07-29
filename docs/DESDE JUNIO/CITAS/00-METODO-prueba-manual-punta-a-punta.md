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

## G. Casilla Factura

- [ ] **G-1.** Marcar persiste tras recargar; si el PATCH falla, **revierte**.
- [ ] **G-2.** Marcada **+ expediente** ⇒ botón de Datos fiscales. **Sin** expediente ⇒ ni botón
      ni grupo Documentos vacío.
- [ ] **G-3.** Desmarcada ⇒ la fila se comporta como antes de esta feature.
- [ ] ⚠️ **G-4.** El agente **ignora** esta casilla (deuda ya anotada, FACTURAS §8.1). Confirmar
      y seguir.

## H. Expediente y bloqueo de horario

- [ ] **H-1.** La **✕** de desvincular está deshabilitada si el formulario está SUBMITTED.
- [ ] **H-2.** Sin expediente se ofrecen **siempre las dos** opciones (buscar y crear), incluidas
      las citas del **agente** (`isFirstTime` null), que antes rendían un "—" muerto.
- [ ] **H-2b.** **Duplicado por correo.** En **+ Crear expediente**, con un correo que YA es de
      otro expediente **activo**, sale el aviso ámbar nombrándolo + **"Vincular ese expediente"**.
      ⚠️ Solo aparece en citas **SIN** expediente (con expediente no hay botón de crear) y el
      match es **exacto**: un correo con typo no dispara nada. Es **aviso, NO bloqueo** —
      "Crear y vincular" sigue habilitado (cuatro expedientes comparten un correo en prod a
      propósito: familias, cuidadores).
- [ ] **H-3.** El bloqueo solo aparece en CONFIRMED y al expandir. Fin ≤ inicio ⇒ **OK
      deshabilitado con tooltip**. **Vaciar** el campo **no** borra el bloqueo guardado.
- [ ] **H-4.** El bloqueo se refleja en la disponibilidad: ese rango deja de ofrecerse.

## I. Cierre — verificar en la BD (read-only, método de los `TOOLING-*`)

- [ ] `patient_id` e `is_rescheduled` de las reagendadas · `factura_solicitada` ·
      `confirmation_email_sent_at` · `extended_block_minutes` · el correo del **expediente** de
      los pacientes cuyo contacto corregiste.

---

**Fuera de este guion:** el agente (sus 3 deudas van juntas en `AGENTE FACTURAS/SESSION-REFRESCO`
§8, una sola corrida de 81 casos), recordatorios, envío de formularios por correo, y el acomodo
final de la fila.

**Deudas a confirmar, no a descubrir:** `notes` al reagendar (E-7) · el agente ignora la casilla
Factura (G-4) · el agente lee el contacto de la CITA (#30) · `formulariosPreConsulta` cuenta los
FISCALES · vincular expediente sigue sin ser obligatorio · el formulario pre-cita dice "Crear
formulario" y su `wa.me` va sin número.
