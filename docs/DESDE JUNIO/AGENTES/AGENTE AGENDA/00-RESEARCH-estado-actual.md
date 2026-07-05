# Research — estado actual de la agenda y su IA (verificado contra el código, 2026-07-03)

> **Propósito.** Mapa de lo que YA existe en producción alrededor de `/appointments` (agenda de
> pacientes) y de la IA que la toca (chat de agenda + asistente RAG), como base para diseñar el
> **agente de agenda desde cero**. Los números de línea/rutas se desfasan — verificar contra el
> código antes de construir.

---

## 1. Hallazgo principal: DOS modelos de agenda conviven, y el chat IA quedó en el viejo

| | Modelo VIEJO (slots) | Modelo ACTUAL (rangos) |
|---|---|---|
| Concepto | Horarios pre-generados (`AppointmentSlot`): filas discretas de 30/60 min con `maxBookings`, `isOpen` | Ventanas de disponibilidad (`AvailabilityRange`): "lunes 09:00–14:00, intervalos de 30" + `BlockedTime` como overlay |
| Página | `apps/doctor/src/app/appointments/v1/page.tsx` | `appointments/page.tsx` (default, lo que sirve `/appointments`) y `v2/page.tsx` (copia casi idéntica del default) |
| Bookings | `Booking.slotId` apunta al slot | **Freeform**: `slotId=null`, el booking guarda `date/startTime/endTime/duration` directamente |
| Endpoints | `appointments/slots` (+`[id]`, `bulk`, `purge`, `block-range`), `appointments/bookings` | `appointments/ranges` (+`[id]`, `bulk`, `block`), `appointments/range-bookings` (+`instant`), `blocked_times` vía hooks |
| Cálculo de disponibilidad | implícito en los slots | `lib/availability-calculator.ts` (resta blocked times y bookings de las ventanas) |

**⚠️ El chat IA existente (`AppointmentChatPanel` + `/api/appointments-chat`) solo está montado en
`v1`** — la página legacy de slots. La página default (rangos), que es la que ve el doctor hoy en
`doctor.tusalud.pro/appointments`, **no tiene chat**. Además el contexto que el chat inyecta al
modelo es 100% slots (`prisma.appointmentSlot.findMany`), así que aunque se montara en la página
actual, razonaría sobre el modelo equivocado.

> Esto **confirma la decisión de construir desde cero**: el chat existente está huérfano del modelo
> de datos vigente. Rescatamos sus *patrones* (ver §4), no su código.

### Historia confirmada por git (2026-07-03)

1. La página original era la de **slots** → se movió a `v1/` (`648a0be7`).
2. El rewrite por **rangos** se construyó como `v2/`; las features de v1 se portaron a v2
   (`e72f66c6`).
3. **v2 se promovió a default** (`d8399bf7` "make v2 range-based page the default appointments
   page") — `page.tsx` es copia de v2. Diff actual v2↔default: solo imports relativos, nombre de
   función y **`onEmitCfdi`** (auto-CFDI al completar, solo en el default; v2 quedó stale).

**No hay un tercer modelo.** `v1/` (slots, obsoleto) y `v2/` (duplicado stale del default) siguen
en el bundle como rutas propias — **candidatos a limpieza** junto con el stack del chat huérfano
(`appointments-chat`, `useAppointmentsChat`, `AppointmentChatPanel`) cuando exista el agente nuevo.
Antes de borrar v1: verificar que ningún doctor tenga slots legacy con citas futuras (query #5 del
[`TOOLING`](TOOLING-acceso-railway-db-agenda.md)).

---

## 2. El dominio de agenda — modelos de datos (schema `public`)

| Modelo | Tabla | Qué es / campos clave |
|---|---|---|
| `Booking` | `bookings` | La cita. `status` (PENDING→CONFIRMED→COMPLETED/NO_SHOW/CANCELLED), datos del paciente (nombre/email/tel/whatsapp), `serviceId/serviceName`, `finalPrice`, `isFirstTime`, `appointmentMode` (PRESENCIAL/TELEMEDICINA), `confirmationCode @unique`, `patientId` (link opcional al expediente), `slotId` null = freeform (modelo rangos), `extendedBlockMinutes`, `isRescheduled`, `googleEventId`, `meetLink`, `reviewToken`. Relaciones: `paymentLink` (Stripe), `mpPaymentPreference` (MercadoPago), `formLink` (formulario pre-consulta), `ledgerEntry` (**el puente a Flujo de Dinero**: completar cita → crea LedgerEntry, `bookingId @unique`). |
| `AvailabilityRange` | `availability_ranges` | Ventana de disponibilidad por día: `date`, `startTime/endTime`, `intervalMinutes` (15/30/45/60), `locationId`, `googleEventId`. `@@unique([doctorId, date, startTime])`. |
| `BlockedTime` | `blocked_times` | Bloqueos overlay (no modifican rangos): `date`, `startTime/endTime`, `reason`. Desbloquear = borrar la fila. |
| `AppointmentSlot` | `appointment_slots` | **Legacy.** Slot discreto: `date`, `startTime/endTime`, `duration`, `maxBookings`, `isOpen`, `locationId`. |
| `ClinicLocation` | `clinic_locations` | Multi-consultorio: nombre, dirección, teléfono, horarios, geo, `isDefault`. |
| `Service` | (catálogo) | Servicio con duración/precio — el booking lo referencia. |

Config del doctor que afecta agenda: `appointmentBufferMinutes`, requisitos de campos por canal
(`bookingPublicEmailRequired` vs `bookingHorariosEmailRequired`, etc.), `telegramChatId` +
`telegramNotifyBooking`, `defaultIntervalMinutes`.

## 3. Superficie de acciones (endpoints en `apps/api`) y sus efectos secundarios

| Acción | Endpoint | Efectos secundarios (⚠️ importantes para el agente) |
|---|---|---|
| Crear booking (rango) | `POST appointments/range-bookings` | Auth opcional: público→PENDING, doctor/admin→CONFIRMED. Dispara **SMS** paciente/doctor, **Telegram**, **email de confirmación**, **evento en Google Calendar**, activity log. Valida buffer + requisitos de campos. |
| Booking instantáneo | `POST .../range-bookings/instant` y `bookings/instant` | alta rápida del doctor |
| Modificar/cancelar/completar booking | `PATCH/DELETE appointments/bookings/[id]` | completar → **crea el LedgerEntry** (puente a Flujo de Dinero, `useBookings.ts`); cancelar/reagendar notifica |
| Crear/borrar rangos | `POST/DELETE appointments/ranges` (+`bulk`, `block`) | **ninguno hacia GCal** — el campo `googleEventId` de rangos existe en el schema pero NADA lo escribe (verificado 2026-07-05: cero llamadas a Google Calendar en las rutas de rangos; solo las citas sincronizan) |
| Bloquear tiempo | (blocked_times vía UI) | overlay, reversible borrando |
| Slots legacy | `appointments/slots*` | solo v1 |
| Re-enviar confirmación | `bookings/[id]/send-email` | email |
| Formulario pre-consulta | `bookings/[id]/form-link`, `form-links` | link al paciente |
| Datos fiscales | `appointments/fiscal-form-link` | link de captura fiscal (conecta con la captura temprana de `03-arquitectura-anclas` de flujo) |
| Stats | `bookings/stats` | lectura |

**Diferencia clave vs Flujo de Dinero:** aquí muchas acciones tienen **efectos externos no
reversibles** (SMS/email/Telegram enviados, evento de Calendar, paciente notificado). En el ledger
casi todo era snapshot-restore; en agenda "deshacer" una cita creada ya dejó un SMS en el teléfono
del paciente. → La política de autonomía debe ser **más conservadora que la del agente de flujo**
para acciones que notifican.

## 4. La IA que ya existe (antecedente, no base)

### 4.1 `appointments-chat` (el chat de agenda actual — v1/slots)
`apps/doctor/src/app/api/appointments-chat/route.ts` + `hooks/useAppointmentsChat.ts` +
`_components/AppointmentChatPanel.tsx`.

- **Arquitectura:** context-stuffing — mete **toda la agenda de hoy−7 a hoy+60** (slots+citas) como
  JSON en el system prompt; gpt-4o con `jsonMode`; responde `{reply, actions[]}`.
- **Acciones tipadas** (el catálogo ya diseñado, reutilizable como spec de tools): `create_slots`
  (único/recurrente), `book_patient`, `close_slot`, `open_slot`, `delete_slot`, `cancel_booking`,
  `confirm_booking`, `complete_booking`, `reschedule_booking`.
- **Patrones que valen oro (conservar en el agente nuevo):**
  1. El endpoint de chat **no muta nada** — el modelo propone, el **cliente valida y ejecuta** tras
     confirmación explícita del doctor ("Toda acción no vacía requiere confirmación").
  2. Reglas de negocio en el prompt que reflejan invariantes reales (no borrar/cerrar slots con
     citas; conflictos bloquean el lote entero; nunca IDs inventados).
  3. Voz integrada (`useVoiceRecording` → transcribe → chat).
  4. `logTokenUsage` por doctor y endpoint.
- **Limitaciones que el agente nuevo corrige:**
  1. Modelo de datos equivocado (slots, no rangos) y montado solo en v1.
  2. Context-stuffing de 67 días de agenda en cada turno = caro, no escala, y limita el horizonte
     ("si preguntan fuera del rango, indícalo") → con **tool-calling** el agente consulta lo que
     necesita (get_availability(fecha), find_booking(paciente), etc.).
  3. Un solo turno de razonamiento (JSON out) — sin loop plan→consultar→actuar→verificar.
  4. gpt-4o hardcodeado (aunque `getChatProvider()` ya soporta Anthropic por env).

### 4.2 El asistente RAG (`llm-assistant`)
`apps/doctor/src/lib/llm-assistant/` (pipeline: capability map determinista + chunks RAG con
embeddings pgvector + contexto de UI + cache + memoria de conversación; schema `llm_assistant`).

- Es el bot de **ayuda/documentación** ("¿cómo hago X en la app?") — **no** un agente de acción.
- **¿RAG obsoleto?** Para el *agente de acción*: sí, en el sentido de que el agente no necesita
  recuperar documentos — necesita **datos vivos** (via tools a la BD) y **acciones** (via tools a
  los endpoints). Para el *bot de ayuda* sigue siendo válido, y una versión moderna sería un tool
  más del agente (`search_docs`) en vez de un pipeline aparte. No hay que tirarlo, pero tampoco
  construir el agente encima de él.

### 4.3 Infra IA compartida (reutilizable tal cual)
- `lib/ai/` — factory de providers (OpenAI/**Anthropic**) por `LLM_PROVIDER`; falta tool-calling
  nativo en la interfaz `ChatProvider` (hoy es chat-completion plano). **Extender esto es el
  prerequisito técnico #1 del agente nuevo.**
- `lib/ai/log-token-usage.ts` + `LlmTokenUsage` — presupuesto/telemetría por doctor.
- `requireDoctorAuth` — el patrón de scoping por sesión (el `doctorId` nunca viene del modelo).

## 5. Implicaciones para el diseño del agente de agenda (resumen)

1. **Construir sobre el modelo de RANGOS** (ranges + blocked times + freeform bookings +
   availability-calculator), no slots. El catálogo de acciones del chat v1 se re-mapea:
   `create_slots` → `create_range`, `close_slot` → `block_time`, etc.
2. **Tool-calling en vez de context-stuffing:** tools de lectura (`get_availability`,
   `get_bookings`, `find_patient_bookings`, `get_locations`, `get_services`) + tools de acción
   (los endpoints de §3), con loop multi-paso.
3. **Misma arquitectura de seguridad que el diseño de Motor 4 de flujo**
   (`../../flujo de dinero permutaciones/06-agente-motor4-diseno.md`): niveles de autonomía en
   código, propuesta→confirmación, doctorId server-side, tools allowlisted.
4. **Política más conservadora en acciones que notifican** (crear/cancelar/reagendar cita →
   SMS/email/Calendar): probablemente TODO lo que toca a un paciente real requiere confirmación
   del doctor; la autonomía se reserva a lo interno (rangos, bloqueos, consultas).
5. **El puente a Flujo de Dinero ya existe** (completar cita → LedgerEntry): el agente de agenda
   termina donde empieza el de flujo — buena costura natural para el merge futuro.
6. **Prompt injection:** nombres de paciente y notas de booking son input externo (el portal
   público los captura) — mismas mitigaciones que en flujo (schema de acciones acotado, IDs
   validados server-side).

---

*Estado:* research inicial 2026-07-03, verificado contra el código. Siguiente paso: diseñar el
catálogo de tools del agente de agenda (doc `01`). Verificación de datos en prod: ver
[`TOOLING-acceso-railway-db-agenda.md`](TOOLING-acceso-railway-db-agenda.md).
