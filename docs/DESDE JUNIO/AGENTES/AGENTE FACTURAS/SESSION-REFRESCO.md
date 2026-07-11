# 🔄 Refresco de sesión — AGENTE FACTURAS / ASISTENTE — LÉEME PRIMERO

> Snapshot del estado, decisiones y próximos pasos de la **expansión del asistente** (facturas +
> expediente + pagos + SAT, sobre el agente de agenda). Para una sesión/LLM en frío: lee este
> archivo, luego `00` → `02` → `03` → `04` según necesites profundidad.
> Última actualización: **2026-07-11**.

---

## En una frase

El agente de agenda se expande a **UN asistente con módulos por dominio** (decisión de `00`:
NO agentes que se hablan). **El sustrato está CERRADO** (huecos H1/H2/H7/H8/H10 arreglados y
desplegados — el grafo del ingreso converge a la verdad en cualquier orden) y **el refactor de
módulos está HECHO** (byte-idéntico, evals 19/19). **Siguiente: PR F1 — los tools de LECTURA.**

## Mapa de documentos

| Doc | Qué es |
|---|---|
| `00-FACTIBILIDAD-Y-ARQUITECTURA.md` | Veredicto (un asistente, módulos, no A2A), sustrato Facturama, tools propuestos, tiers/riesgos, secuencia F1→F3 |
| `01-CONTEXTO-SAT-DESCARGA.md` | La fuente DUAL de CFDIs (Facturama vs SAT descarga) y sus gotchas (UUID case, frescura, cancelaciones) |
| `02-FLUJO-SISTEMA-cita-paciente-factura-pago.md` | El grafo real (LedgerEntry = hub) + **la matriz de 6 preguntas = el spec de `get_billing_status`** |
| `03-PERMUTACIONES-paciente-dinero-factura.md` | Catálogo E×M×F×O + huecos H1–H10 con su estado — **cada permutación es un eval candidato de PR F1** |
| `04-FIXES-links-de-pago-ligados.md` | Registro completo de los fixes de sustrato (2 tandas, con commits y lecciones) |

Playbook heredado: [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(método, bitácora, evals) y `05-REFERENCIA-TECNICA` (el sistema, incl. la estructura de módulos).

## Estado: qué está hecho (todo desplegado en prod)

**✅ Sustrato — sesión 2026-07-10/11, commits `7e7d031d`→`cf42c67b`:**
- **H10**: links de pago LIGADOS a citas (botón "Cobro" en /appointments y expediente; MP acepta
  bookingId; guard compartido `apps/api/src/lib/payment-link-guard.ts`). ⚠️ Lección clave:
  **`isActive` ≠ no-pagado** (el webhook MP pone isActive:false al PAGAR; Stripe lo deja true) —
  la definición de "cobrada" es `status`, cross-provider.
- Link de pago **requiere expediente vinculado** (server + UI "Requiere expediente").
- **H1**: webhooks denormalizan patientId/RFC al ledger. **H2**: completar una cita ya pagada
  por link = éxito sin duplicar (endpoint 409 `BOOKING_LEDGER_EXISTS` + UI + agente; formaDePago
  solo se exige si el ingreso no existe). **H7**: (re)vincular paciente = REESCRITURA de
  identidad en el entry (nunca merge). **H8**: cancelar CFDI resetea hasFactura salvo otra señal.
- Celda Paciente sin estado muerto (citas del agente con isFirstTime null → siempre ambas
  opciones buscar/crear). Tabla de citas compactada (2 columnas de acciones).

**✅ Refactor de módulos — commit `2fdbedd6`:**
`apps/doctor/src/lib/agenda-agent/modules/` (types/registry/agenda) + `prompt.ts`. run-turn.ts
= solo el loop. Byte-idéntico (sha256) + evals 19/19. **El prompt se edita en `prompt.ts`
(compartido) o `modules/agenda.ts` (agenda) — NUNCA en run-turn.ts.**

## Decisiones (no re-litigar)

- **UN asistente, módulos por dominio, NO A2A** (`00` §1).
- La cadena expediente↔factura es **transitiva vía LedgerEntry** (opción A, sin migración) —
  el agente SIEMPRE liga `ledgerEntryId` al emitir.
- **El modelo NUNCA arma impuestos** (regla clase-E7): builder server-side pendiente; hoy la
  fórmula vive en `useBookings.emitCfdi`.
- **v1 SIN `propose_cancel_cfdi`** (timbrado = documento legal); PPD solo a petición explícita;
  doble emisión bloqueada por `hasFactura`.
- *Facturada* es señal COMPUESTA: `hasFactura ∧ (cfdi activo ∨ satCfdiUuid vigente)` (por H8 y
  el limbo de `cancellation_pending` que nadie finaliza aún).
- "¿Cuánto facturé?" usa la fuente DUAL (`01`): sat_cfdi_metadata (todo el RFC) cuando existe,
  no solo cfdis_emitted; el tool declara fuente y frescura.
- El expediente es vista PARCIAL para dinero/facturas — los tools leen el GRAFO, no replican la
  query de la página (`03` §6).

## ⬜ Validación en vivo pendiente (dr-prueba) — hacer ANTES o durante PR F1

Ya hecho: link MP creado sobre la cita "test 7" (3 ago, walk-in) y verificado en BD
(`mp_payment_preferences.booking_id` correcto — el PRIMER link ligado de la plataforma).
Falta la secuencia (valida H2+H7+cadena completa en un solo flujo):
1. Vincular/crear expediente a "test 7" (la celda Paciente ya lo permite).
2. Pagar el link de $10 → verificar: `status→PAID`, `isActive→false`, ledger `webhook_pago` con
   `bookingId+patientId` (RFC solo si el expediente lo tiene), chip "Pagado" en agenda y expediente.
3. Intentar 2º link sobre la cita pagada → "Esta cita ya fue pagada con un link de pago".
4. Completar la cita → camino H2: "el ingreso ya estaba registrado", sin duplicar.
5. Marcar los checkboxes de `03` (PERM-A4/A5, ORD-1/2) con la evidencia.

## Próximos pasos

1. **PR F1 — tools de LECTURA (el siguiente trabajo).** Alcance definido por el usuario:
   `/dashboard/medical-records`, `/facturacion`, `/sat-descarga`, `/pagos` (+ subpáginas).
   - Nuevo módulo `modules/facturas.ts` (o `billing.ts`): un archivo + una entrada en
     `AGENT_MODULES` (registry.ts) + sus secciones de prompt.
   - Tools: `get_patient_profile` (perfil + completitud fiscal como ENUM server-side:
     completo/parcial/vacío/no-requiere), `get_fiscal_profile_status` (CSD del doctor),
     `get_cfdis` (emitidos plataforma), `get_sat_cfdis` (fuente dual + frescura de
     `sat_sync_jobs`), `get_payment_links`, y **`get_billing_status {bookingId|patientId}`**
     (la estrella — responde la matriz de 6 preguntas de `02` §3 con señales compuestas
     server-side, regla 0).
   - Al agregar el módulo: actualizar los 2 TODOs de `prompt.ts` (lista de capacidades del
     INTRO y "fuera de tu alcance" — facturas/pagos dejan de ser out-of-scope).
   - Método (regla dura): cada query shape smoke-tested read-only contra prod ANTES de push;
     evals sembrados del catálogo `03` ANTES de encender (mínimo los negativos: C2, D4, ORD-3,
     H2); suite completa debe pasar (baseline 19/19 + los nuevos).
2. **PR F2** — `propose_create_cfdi` + `propose_send_fiscal_form` (+ builder de impuestos
   server-side). **Fase 2 también:** `propose_payment_link` (los endpoints ya validan todo) y
   `propose_create_patient` (H3 — walk-in que pide factura).
3. **PR F3** — entrega (`propose_email_cfdi`).

## Preguntas abiertas (decidir en PR F1/F2)

1. **Profundidad clínica** de medical-records: recomendación v1 = SOLO metadatos + datos
   demográficos/fiscales, NADA de contenido de encounters/notas (otro tier de privacidad; es el
   bloque "agente de expediente médico" del plan original). **Confirmar con el usuario.**
2. ¿dr-prueba puede timbrar? (CSD/Facturama sandbox — revisar `facturamaStatus`). Bloquea la
   validación en vivo de PR F2, no PR F1.
3. ¿El panel del asistente se monta también en `/dashboard/facturacion`? (mismo componente).
4. Confirmar qué taxes arma la UI para honorarios médicos (fuente del builder server-side).

## Método de trabajo (heredado de agenda — no negociable)

- Sustrato antes que agente; pre-checks leyendo el ENDPOINT real, no asumiendo semántica.
- Todo SQL/query shape nuevo → smoke read-only contra prod ANTES de push (no hay staging).
- Prompt/tools tocados → correr la suite de evals ANTES de push
  (`railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts`, instrucciones en
  su cabecera).
- Nunca commit/push sin explicar y recibir OK; una aprobación = un commit.
- Verificación en vivo: usuario actúa en prod → LLM verifica read-only
  (TOOLING de agenda; queries de este dominio en `02`/`03`).

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO de agenda).*
