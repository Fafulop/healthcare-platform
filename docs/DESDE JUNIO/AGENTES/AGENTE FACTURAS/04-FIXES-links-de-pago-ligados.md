# Fixes de sustrato: links de pago LIGADOS a la cita (H10 + H1) — qué se hizo y por qué

> **Qué es esto.** Registro de la primera pasada de fixes de sustrato que salió del catálogo de
> permutaciones ([`03-PERMUTACIONES`](03-PERMUTACIONES-paciente-dinero-factura.md) §7): links de
> pago ligados a la cita (H10), denormalización de paciente en los webhooks (H1), y los 5 fixes
> del code-review de esa implementación. Escrito 2026-07-10. **Estado: working tree, verificado
> (type-check + smoke read-only contra prod), pendiente de commit/deploy y validación en vivo.**

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
- ⬜ **Validación en vivo post-deploy (dr-prueba):** crear link MP desde una cita → verificar
  `booking_id` en `mp_payment_preferences` → pagar (o simular webhook) → verificar ledger con
  `bookingId + patientId + counterpartyRfc` → intentar segundo link sobre la cita pagada → debe
  rechazar con "ya fue pagada" → completar la cita → observar el 409 de H2.
- ⬜ Marcar PERM-A4/A4b/A5 y ORD-1/2 del catálogo `03` cuando la validación en vivo pase.

## 5. Lo que sigue (de §7 del catálogo)

- **H2** (siguiente fix): completar una cita que ya tiene ledger del webhook → 409 engañoso;
  el pre-check de `propose_complete_booking` tampoco lo detecta. Fix: detectar entry existente
  por `bookingId` y completar SIN doble-call (+ mensaje 409 específico en el endpoint).
- **H7** (misma pasada candidata): vincular paciente post-hoc no backfillea el ledger.
- **H8**: cancelar CFDI no revierte `hasFactura` → la definición de "facturada" para los tools
  es compuesta (`hasFactura ∧ (cfdi activo ∨ satCfdiUuid)`).
- Luego: refactor de módulos → PR F1 (tools de lectura, incl. `get_billing_status`) →
  `propose_payment_link` en fase 2 usando exactamente estos endpoints.

---

*Relacionado: [`02-FLUJO-SISTEMA`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) (el grafo),
[`03-PERMUTACIONES`](03-PERMUTACIONES-paciente-dinero-factura.md) (H1–H10 y las permutaciones
que estos fixes habilitan), [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(el playbook: sustrato antes que agente).*
