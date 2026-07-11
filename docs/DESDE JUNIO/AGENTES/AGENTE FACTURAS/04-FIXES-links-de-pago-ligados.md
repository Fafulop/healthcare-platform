# Fixes de sustrato: el grafo del ingreso dice la verdad (H1/H2/H7/H8/H10) — qué se hizo y por qué

> **Qué es esto.** Registro de la pasada COMPLETA de fixes de sustrato que salió del catálogo de
> permutaciones ([`03-PERMUTACIONES`](03-PERMUTACIONES-paciente-dinero-factura.md) §7): links de
> pago ligados a la cita (H10) + H1, los fixes de sus dos code-reviews, y la segunda tanda
> (expediente obligatorio, celda Paciente, H2, H7, H8 — ver **§6**). Escrito 2026-07-10,
> actualizado 2026-07-11. **Estado: TODO desplegado en prod** (commits `7e7d031d`, `bd811606`,
> `5e123efb`, `7d9964ab`, `cf42c67b`); validación en vivo del flujo completo pendiente (§4).
>
> **La propiedad que esta pasada compró:** el grafo `Booking ← LedgerEntry → CfdiEmitted`
> **converge a la verdad sin importar el orden** de las acciones (pagar ↔ vincular expediente ↔
> completar ↔ cancelar/reemitir CFDI) — la base sobre la que `get_billing_status` puede leer.

---

## 1. El problema (por qué hicimos esto)

Descubierto al mapear las permutaciones paciente×pago×factura: **todo link de pago real nacía
SUELTO** (H10). El plumbing existía a medias —

| Capa | Stripe | Mercado Pago |
|---|---|---|
| Columna `booking_id` (@unique) en el schema | ✅ | ✅ |
| El endpoint POST acepta `bookingId` | ✅ (validado, nadie lo mandaba) | ❌ ni lo aceptaba |
| Alguna UI lo manda | ❌ | ❌ |

Consecuencias en cadena: el ingreso del webhook (`origin:'webhook_pago'`) nacía **huérfano**
(sin bookingId → sin paciente, sin RFC), invisible en el expediente y en la cita; y si el doctor
luego completaba la cita, el ingreso se **duplicaba** (la idempotencia del webhook está keyed en
`bookingId`, que era null). Además el helper del webhook no denormalizaba identidad del paciente
ni con booking ligado (H1) — rompiendo la trazabilidad ingreso↔paciente y el matching SAT por
RFC que el Agente Facturas necesita (la cadena `Booking ← LedgerEntry → CfdiEmitted` de
[`02-FLUJO-SISTEMA`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) §1).

**Por qué antes del agente:** patrón F1/F2 de agenda — el sustrato se arregla ANTES de construir
tools encima, porque el agente amplifica los huecos. `get_billing_status` no puede responder
"¿ya está pagada?" si los pagos electrónicos no se conectan a nada; y `propose_payment_link`
(fase 2) ejecutará exactamente estos endpoints.

## 2. Lo que se construyó

1. **`POST /api/mercadopago/preferences` acepta `bookingId`** — valida pertenencia al doctor y
   lo guarda (antes la columna era plumbing muerto: el webhook la leía, nadie la escribía).
2. **Botón "Link de pago" en la UI, dos superficies, un componente**
   (`apps/doctor/src/components/payments/PaymentLinkButton.tsx`, patrón `FiscalFormButton`):
   - Grupo **"Cobro"** en la celda de acciones de `/appointments` (`BookingsSection`).
   - Fila **"Cobro"** en "Citas e Ingresos" del expediente (`patients/[id]`) — de paso cierra
     parte de H9 (el estado de pago ahora es visible en el expediente).
   - Estados: sin link → botón → modal (proveedor conectado + monto pre-llenado del precio de
     la cita) · link activo → "Link enviado" + Copiar + WhatsApp · pagado → chip "Pagado".
3. **Los GET de bookings** (apps/api y la ruta del expediente) incluyen `paymentLink` +
   `mpPaymentPreference` para que cada fila conozca su estado de cobro.
4. **H1:** `createPaymentLedgerEntry` (webhooks Stripe/MP) denormaliza `patientId` +
   `counterpartyRfc` + `counterpartyName` desde el booking ligado — espejo de
   `completeBooking`, para que el matcher SAT y las consultas por paciente vean estos ingresos.

## 3. Los 5 fixes del code-review (y la lección de cada uno)

El `/code-review` (8 ángulos, 29 candidatos, 8 hallazgos verificados) cazó un bug serio que la
implementación original tenía:

| # | Hallazgo | Fix | Por qué importa |
|---|---|---|---|
| 1 | **El guard "un link activo por cita" solo miraba `isActive` — pero el webhook de MP pone `isActive:false` al PAGAR** (`mercadopago/webhook/route.ts:170`). Una cita YA PAGADA por MP pasaba el guard: se podía emitir un segundo link (doble cobro) y el "liberar slot" le quitaba el `bookingId` al registro PAGADO — matando el chip "Pagado", la idempotencia del ledger y el historial | Helper compartido **`apps/api/src/lib/payment-link-guard.ts`** (`checkBookingLinkSlot`): bloquea si CUALQUIER proveedor tiene link con `status='PAID'` ("Esta cita ya fue pagada…") O activo; NUNCA libera el slot de un registro PAID | **`isActive` no significa "no pagado"** — cada proveedor maneja el flag distinto (Stripe deja true al pagar; MP pone false). La definición de "cita ya cobrada" es `status`, no el flag. Misma clase que E7 v2 de agenda: leer la semántica real del código, no asumirla |
| 2 | El "liberar slot" (update `bookingId:null` del link viejo) corría ANTES de las llamadas externas a Stripe/MP y fuera de transacción — un fallo a media ruta dejaba la asociación cita↔link destruida sin rollback; y un pago tardío sobre el link liberado creaba ingreso huérfano sin dedupe | El update de liberación va DENTRO de un `prisma.$transaction` junto con el create de la fila nueva, DESPUÉS de que el proveedor externo respondió OK | Escrituras que rompen una invariante ("la cita conserva su link") no se hacen antes de pasos que pueden fallar. Liberar y re-ocupar el slot = una operación atómica |
| 3 | Carrera guard→create: dos requests simultáneos para la misma cita pasaban ambos el guard; el perdedor moría en el `@unique` con **500 genérico** | `catch` de `P2002` → **400** con el mensaje real ("Ya existe un link de pago activo…"); en Stripe además se desactiva best-effort el link recién creado en Stripe (que quedaría vivo y SIN registro en nuestra BD — pagable sin que el webhook lo encuentre) | El unique constraint es la defensa real contra la carrera; el código debe traducirlo a la respuesta correcta, no dejarlo explotar. Y un artefacto externo creado por el perdedor se limpia |
| 4 | `showCobroGroup = !isTerminal \|\| hasLink`: una cita CANCELADA cuyo único link estaba desactivado-y-no-pagado volvía a mostrar el botón de CREAR link | Ambas superficies (agenda y expediente) muestran la sección en citas terminales solo con link **PAGADO o ACTIVO** | La condición de visibilidad debe expresar la intención ("ver el estado de un cobro que existe"), no un proxy ("existe alguna fila") |
| 5 | El guard + liberación estaba duplicado casi línea-por-línea en las dos rutas | Consolidado en el helper único del fix 1 | La invariante cross-provider vive en UN lugar; el fix del hallazgo 1 se aplicó una vez, no dos. (Es donde aterrizará también un tercer proveedor) |

**Deferred del review (cleanup, no bloquea):** (a) el modal consulta `stripe/connect/status`
(2 llamadas remotas a Stripe) en cada apertura — debería leer los flags cacheados del doctor;
(b) Copiar/WhatsApp/formato de moneda duplican `FiscalFormButton` y no usan `formatCurrency` —
extraer helper de compartir; (c) los dos GET devuelven el link en shapes distintos (crudo vs
renombrado `stripeLink/mpLink`) — unificar al shape canónico.

## 4. Verificación hecha / pendiente

- ✅ Type-check limpio en ambas apps (solo los 3 errores pre-existentes de `openai`).
- ✅ Todos los query shapes nuevos smoke-tested **read-only contra prod** (regla dura, no hay
  staging): includes de links en bookings, `findUnique` por `bookingId` con `status`, el
  `Promise.all` del guard, el select ampliado de booking+patient del helper H1.
- ✅ Cero migraciones: las columnas `booking_id` ya existían en prod (verificado por
  `information_schema`).
- 🟡 **Validación en vivo (dr-prueba) — EN CURSO:** ✅ link MP creado desde la cita "test 7"
  (2026-07-11) y verificado en prod: `booking_id` correcto en `mp_payment_preferences`, monto
  $10, PENDING — el primer link ligado a cita en la historia de la plataforma (todos los
  anteriores tienen `booking_id NULL`, confirmando H10 en los datos). Pendiente: vincular
  expediente a test 7 (ejercita 6.2 y, tras el pago, H7) → pagar el link → verificar ledger
  (`bookingId + patientId`; RFC solo si el expediente lo tiene) + chip "Pagado" → segundo link
  sobre la cita pagada → "ya fue pagada" → completar la cita → camino H2 ("el ingreso ya
  estaba registrado", sin duplicar).
- ⬜ Marcar PERM-A4/A4b/A5 y ORD-1/2 del catálogo `03` cuando la validación en vivo pase.

## 5. Lo que sigue

- ~~H2 / H7 / H8~~ → **HECHOS** (§6).
- ~~Refactor de módulos~~ → **HECHO 2026-07-11** (registry en `lib/agenda-agent/modules/`,
  byte-idéntico por sha256, evals 19/19 — detalle en `00-FACTIBILIDAD` §1).
- **Siguiente: PR F1** (tools de lectura, incl. `get_billing_status`) → `propose_payment_link`
  en fase 2 usando exactamente estos endpoints.

## 6. Segunda tanda (2026-07-10/11) — expediente obligatorio, celda Paciente, H2, H7, H8

### 6.1 Link de pago REQUIERE expediente (`bd811606`)

Detectado por el usuario en la primera prueba en vivo: el primer link se creó sobre "test 7",
una cita **sin expediente** — un cobro imposible de rastrear/facturar. Regla nueva en el guard
compartido (`payment-link-guard.ts`): sin `booking.patientId` no hay link ("La cita no tiene
expediente vinculado…"); los checks PAGADO/activo corren PRIMERO para que el mensaje refleje el
bloqueador real. UI: chip gris "Requiere expediente" en vez del botón de crear; los links
pagados/activos existentes (grandfathered, como el de test 7) siguen mostrando su estado.

### 6.2 Celda Paciente sin estado muerto (`bd811606`)

Mismo hallazgo del usuario, causa distinta: `ExpedienteCell` ramificaba por `isFirstTime`
(true → solo "+ Crear expediente"; false → solo buscador; **null → "—" muerto**). Las citas
creadas por el AGENTE llevan `isFirstTime` null salvo que el doctor lo mencione → sin camino
para vincular ni crear. Fix: toda cita sin expediente ofrece SIEMPRE ambas opciones;
`isFirstTime` queda como hint de orden. (De paso habilita el flujo 6.1 para cualquier cita.)

### 6.3 H2 — completar una cita ya pagada por link (`7d9964ab`, 4 capas)

El link pagado crea el ingreso vía webhook ANTES de completar; el POST ledger del completar
chocaba con `@unique(booking_id)` → 409 genérico "El ID interno ya existe" + toast de error.

| Capa | Fix |
|---|---|
| Endpoint ledger | pre-check por `bookingId` → **409 distintivo** `code: BOOKING_LEDGER_EXISTS` + `existingEntry`; el catch P2002 distingue `booking_id` (carrera) de `internal_id`; cross-tenant → 404 sin filtrar el entry |
| `useBookings.completeBooking` | ese 409 = **éxito** ("el ingreso ya estaba registrado") y devuelve el `ledgerEntryId` existente (el auto-CFDI sigue ligando) |
| `propose_complete_booking` | pre-check detecta el entry existente → card "el ingreso YA está registrado, no se crea otro", `ledger: null`, y **formaDePago deja de exigirse** cuando el ingreso ya existe (schema relajado; el pre-check la pide solo si hace falta — regla 0). Prompt 2c actualizado |
| Executor del agente | salta el POST con `ledger: null`; el 409 de carrera también es éxito, no "regístralo manualmente" |

**Evals 19/19 PASS** contra prod con el prompt+schema modificados (93–98% cache).

### 6.4 H7 — vincular paciente post-hoc backfillea el ingreso (`cf42c67b`)

La vinculación tardía ("Buscar paciente" / crear expediente desde la cita) dejaba el ledger
entry huérfano para siempre (sin patientId/RFC). Ahora, en el PATCH de vinculación:

- **(Re)vincular = REESCRITURA completa de identidad** en el entry: `patientId` +
  `counterpartyRfc` (del expediente, o null) + `counterpartyName` (razonSocial → fallback al
  nombre de la cita). **Nunca merge parcial** — el review propio cazó que un merge dejaría el
  RFC del paciente ANTERIOR pegado al ingreso del nuevo (el matcher SAT ligaría los CFDIs de A
  al ingreso de B).
- **Desvincular** = solo se desprende `patientId` (el counterparty era verdad al momento del
  ingreso).
- Solo entries nacidos de cita (`origin: cita | webhook_pago`) — jamás toca SAT/manual.
  Fire-and-forget no fatal (patrón formLink).
- Trade-off deliberado: un `counterpartyRfc` editado a mano en Flujo de Dinero se sobreescribe
  al re-vincular — **el expediente vinculado es la autoridad de identidad**.

### 6.5 H8 — cancelar CFDI resetea `hasFactura` (`cf42c67b`)

Cancelar no revertía el flag → la killer query "consultas sin factura" se perdía las
canceladas-sin-reemitir y el asistente diría "ya está facturada". Ahora, en cancelación
**definitiva** (no `cancellation_pending` — el receptor puede rechazar): reset de `hasFactura`
salvo que quede OTRA señal de factura (otro CFDI activo del mismo entry, o `satCfdiUuid` que no
sea este mismo CFDI — comparación case-insensitive, SAT MAYÚSCULAS vs plataforma minúsculas).
Motivo 01 con reemplazo ya ligado → no resetea (hay otro activo). Re-emitir tras cancelar
vuelve a poner el flag (el POST /cfdi ya lo hacía) — el flag hace round-trip.

**Limitaciones honestas (pre-existentes, ahora documentadas):** (a) `cancellation_pending`
no se finaliza en NINGÚN lado — si el receptor acepta después, nuestra BD se queda en pending
y `hasFactura` en true (futuro: job de status-refresh); (b) un CFDI cancelado FUERA de la
plataforma sigue sin resetear nada (la clase H5/satStatus, trabajo futuro). Por esto la
definición de *facturada* para los tools del asistente sigue siendo **compuesta**:
`hasFactura ∧ (cfdi activo ∨ satCfdiUuid vigente)`.

### 6.6 Bonus UI de la misma sesión (`5e123efb`)

Tabla de citas compactada (las filas eran demasiado altas por los 5 grupos apilados de
ACCIONES): PACIENTE·SERVICIO fusionados; ACCIONES dividida en dos columnas (gestión ·
comunicación/cobro); `StatusActions` gana prop `layout` ("table" = dos `<td>`, "card" = móvil
sin cambios). Afecta también /v1 y /v2 (comparten el componente).

---

*Relacionado: [`02-FLUJO-SISTEMA`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) (el grafo),
[`03-PERMUTACIONES`](03-PERMUTACIONES-paciente-dinero-factura.md) (H1–H10 y las permutaciones
que estos fixes habilitan), [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(el playbook: sustrato antes que agente).*
