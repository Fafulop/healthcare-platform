# 🧾 Agente de Facturas — factibilidad y arquitectura (exploración 2026-07-08)

> **Pregunta que responde este doc:** ¿qué tan factible es un agente que cree una factura (CFDI)
> y la deje ligada al expediente del paciente — tocando agenda, expedientes y facturas — y cuál
> es la arquitectura correcta: extender el agente de agenda, o un agente de facturas que hable
> con los otros agentes?
>
> **Respuesta corta:** MUY factible — el sustrato de emisión ya existe completo (Facturama,
> timbrado real) y el modelo de datos ya anticipa este agente. La arquitectura correcta es
> **UN solo asistente con módulos de tools por dominio** — NO agentes que se hablan entre sí.
> Todo verificado contra el código el 2026-07-08 (lección de la fila 19: los docs alucinan;
> este doc cita archivos).

---

## 1. Veredicto de arquitectura: un asistente, módulos de tools — no A2A

El flujo objetivo es **UNA conversación**: *"factúrale la consulta de hoy a García"* necesita la
cita (agenda), los datos fiscales (expediente) y la emisión (facturas) **en el mismo contexto**.
Partirlo en agentes que se mensajean significa serializar contexto entre loops: más latencia,
más costo, más lugares donde se pierde un dato, y el doctor hablando con un comité.
Multi-agente compra aislamiento y paralelismo — este flujo no necesita ninguno de los dos.

Lo que hizo funcionar al agente de agenda es **agnóstico al dominio** y se reusa tal cual:

- `run-turn.ts` (385 líneas): loop de tool-calling, síntesis, caching, presupuesto — cero
  cambios necesarios.
- Patrón **propuesta → card → doctor confirma → el CLIENTE ejecuta el endpoint real con su
  token** — exactamente lo que una factura necesita (y más: ver tier legal, §6).
- `doctorId` inyectado server-side en cada tool; el modelo nunca aporta ids sin validar.
- Evals de fallos vivos + campañas de permutaciones ANTES de dar escritura.

**"Agentes por bloque, merged later" era el plan de siempre** (memoria del proyecto). Esto es
adelantar el *merge* como arquitectura: el "agente de agenda" se convierte en **el asistente**
con módulos de dominio (agenda / facturas / luego flujo y expediente), mismo panel, mismo
endpoint, mismo presupuesto.

**✅ Refactor HECHO (2026-07-11):** registry de módulos en
`apps/doctor/src/lib/agenda-agent/modules/` (types/registry/agenda) + `prompt.ts` (secciones
compartidas + composición por módulo). Verificado **byte-idéntico** (sha256 del prompt y del
array de tools antes/después) + type-check + evals 19/19 con el dispatch nuevo ejercitado.
Agregar el módulo facturas = un archivo en `modules/` + una entrada en `AGENT_MODULES`; el
prompt crece ~2-3k tokens pero sigue siendo UN bloque estable con UN breakpoint de cache.
Ningún cambio al loop ni al executor. (TODOs anotados en `prompt.ts`: el INTRO y el "fuera de
tu alcance" nombran agenda en específico — se ajustan cuando este módulo llegue.)

---

## 2. Sustrato verificado: la emisión YA existe completa

| Pieza | Dónde | Estado |
|---|---|---|
| Emisión (timbrado) | `POST /api/facturacion/cfdi` → `lib/facturama.ts` `createCFDI()` | ✅ vivo, con folio auto, reglas Público en General server-side, ISR por régimen (626→1.25%, otro→10%) |
| Cancelación | `POST /facturacion/cfdi/[id]/cancel` (motivo SAT) | ✅ |
| PDF / XML / email al paciente | `cfdi/[id]/pdf` · `xml` · `email` · `html` · `acuse` | ✅ |
| Egresos y REP (complemento de pago) | `cfdi/egreso` · `cfdi/rep` | ✅ |
| Catálogos SAT | `facturacion/catalogos/[tipo]` | ✅ |
| Perfil fiscal + CSD | `DoctorFiscalProfile` (schema ~2474) — gating: sin CSD activo no hay POST | ✅ |
| Datos fiscales del paciente | `Patient.rfc/razonSocial/regimenFiscal/usoCfdi/codigoPostalFiscal/requiereFactura/constanciaFiscal*` (schema ~1767) | ✅ |
| Formulario fiscal al paciente | `POST /appointments/fiscal-form-link` + `fiscal-form` (el paciente llena sus datos por link) | ✅ |
| Tenancy | `cfdi/[id]` resuelve por `{ id, fiscalProfileId: profile-de-la-sesión }`; POST valida `ledgerEntryId` contra `doctorId` | ✅ muestreado (auditoría completa pre-build, §7) |

**La UI ya tiene los dos flujos que el agente imitaría:**
- Desde la cita: `useBookings.emitCfdi()` (apps/doctor `_hooks/useBookings.ts:410`) — receptor +
  items + `ledgerEntryId` opcional.
- Desde el expediente: la página del paciente pre-llena receptor con los campos fiscales del
  paciente y navega a `/dashboard/facturacion` (patients/[id]/page.tsx:364).

---

## 3. El descubrimiento clave: la cadena expediente↔factura YA existe (transitiva)

`CfdiEmitted` NO tiene `patientId` ni `bookingId` directos — solo `ledgerEntryId?`. Pero
`LedgerEntry` tiene **todo lo demás** (schema ~1130-1140):

```
Booking ←(bookingId @unique)─ LedgerEntry ─(ledgerEntryId)→ CfdiEmitted
                                   │
                                   ├─ patientId    ← comentario del schema: "Lets an agent trace
                                   │                  income <-> patient directly (e.g. consults
                                   │                  missing a factura)"
                                   ├─ counterpartyRfc/Name  ← "for matching + AI-agent reasoning"
                                   └─ hasFactura   ← lo marca el POST /cfdi al ligar
```

El modelo de datos **fue diseñado esperando este agente**. Y el encadenamiento con PR 3 es
natural: cuando el agente completa una cita (TRX-6, validado en vivo), el hook crea el
LedgerEntry **con el RFC y patientId del paciente ya denormalizados**. Facturar es el paso
siguiente del mismo flujo: `completar cita → ledger entry → propose_create_cfdi(ledgerEntryId)`.

**Decisión de sustrato (única migración candidata):** ¿basta la cadena transitiva o se agregan
`patientId`/`bookingId` directos a `cfdis_emitted`?
- **Opción A (recomendada para v1): cadena transitiva, cero migración.** "Facturas del
  paciente" = `cfdis_emitted JOIN ledger_entries ON ledgerEntryId WHERE patientId = X`. Cubre
  las facturas creadas desde citas/ledger. Limita: una factura emitida SIN ligar a ledger no es
  rastreable a paciente — pero el agente SIEMPRE liga (regla de diseño), así que su propio
  output queda trazable.
- **Opción B (si se quiere en el expediente UI):** columna `patient_id` en `cfdis_emitted`
  (nullable, mismo patrón que ledger: link plano sin FK cross-schema). Migración aditiva
  trivial. Decidir cuando exista la pestaña "Facturas" en el expediente.

---

## 4. Los tools del módulo facturas (propuesta)

**Lectura (autónomos, como PR 1) — ✅ CONSTRUIDOS en PR F1 (2026-07-11, `modules/facturas.ts`)
con nombres/alcance finales que superan esta tabla original:**
| Tool final | Fuente | Para qué |
|---|---|---|
| `get_billing_status` | el grafo completo (booking+patient+ledger+links+cfdis+SAT) | LA estrella — diagnóstico de cobro/factura de una cita o paciente (matriz de `02` §3); cubre también la "killer query" por paciente (`ingresosSinFactura` en get_patient_profile) |
| `get_patient_profile` (era `get_patient_fiscal`) | `Patient` fiscal + counts | completitud fiscal server-side + `listoParaFacturar` (el gate del botón del expediente) |
| `get_cfdis` | `cfdis_emitted` (+ filtro por paciente vía relación ledger) | facturas de PLATAFORMA (declara su incompletitud) |
| `get_sat_cfdis` | `sat_cfdi_metadata` + frescura de `sat_sync_jobs` | el panorama COMPLETO del RFC (fuente dual de `01`); received = gastos |
| `get_fiscal_profile_status` | `DoctorFiscalProfile` | pre-check honesto: sin CSD activo, el agente lo dice ANTES de proponer |
| `get_payment_links` | `payment_links` + `mp_payment_preferences` | estado de cobros por link (counts reales, flag de links huérfanos) |

**Propuestas (card + confirmación, como PR 2/3):**
| Tool | Endpoint real | Notas |
|---|---|---|
| `propose_create_cfdi` | `POST /facturacion/cfdi` | receptor desde `get_patient_fiscal` o Público en General; items desde el servicio de la cita; SIEMPRE liga `ledgerEntryId` cuando existe |
| `propose_send_fiscal_form` | `POST /appointments/fiscal-form-link` | el camino cuando el paciente NO tiene datos fiscales: "no tengo su RFC — ¿le mando el formulario?" |
| `propose_email_cfdi` | `cfdi/[id]/email` | entregar la factura al paciente |
| `propose_cancel_cfdi` | `cfdi/[id]/cancel` | **tier máximo** — quizá NO dársela al agente en v1 (ver §6) |

**Regla clase-E7 (la más importante del diseño):** el agente **NUNCA arma los impuestos**. La
fórmula ISR/IVA por régimen vive hoy en la UI (`emitCfdi` arma `items[].taxes`). Dársela al
modelo = re-implementar una fórmula fiscal en prompt (exactamente el error E7/fila 11). Opciones,
en orden de preferencia: (1) endpoint helper server-side que arme los items desde
`serviceId + monto + régimen del perfil` (una sola fuente, la UI podría migrar a él); (2) el
executor client-side reusa la MISMA función que la UI. El modelo solo aporta: qué cita/servicio,
qué receptor, PUE/PPD y forma de pago — todo confirmable en la card.

---

## 5. El flujo objetivo, de punta a punta (como lo vería el doctor)

```
Dr: "factúrale la consulta de hoy a García"
 1. get_bookings / get_booking_detail        (módulo agenda — ya existe)
 2. ¿cita COMPLETED? si no → ofrece completarla primero (propose_complete_booking, PR 3)
 3. get_patient_fiscal(García)               (módulo facturas, nuevo)
    ├─ tiene datos → sigue
    └─ no tiene → "¿le mando el formulario fiscal?" (propose_send_fiscal_form) y FIN
 4. get_fiscal_profile_status                (CSD activo — si no, honesto y FIN)
 5. propose_create_cfdi → CARD: receptor completo, concepto, importe, IVA/ISR calculados
    server-side, PUE/PPD, "se timbrará con el SAT — documento legal"
 6. Doctor confirma → executor → POST /facturacion/cfdi (liga ledgerEntryId)
 7. Turno de verificación + "¿se la envío por correo?" (propose_email_cfdi)
```

Pasos 1-2 ya existen en prod. Lo nuevo son 4 tools de lectura + 2-3 de propuesta.

---

## 6. Riesgos y tiers — una factura NO es un bloqueo

| Riesgo | Realidad | Mitigación |
|---|---|---|
| **Timbrado = documento legal ante el SAT** | cancelar no es "undo": motivo SAT, plazos, posible aceptación del receptor | card con preview COMPLETO (receptor, RFC, concepto, montos, impuestos, PUE/PPD); tier propio por encima de "notifica al paciente" |
| Cancelación por el agente | proceso burocrático, irreversible en cascada | **v1 SIN `propose_cancel_cfdi`** — el agente explica el camino manual; se evalúa en v2 con evidencia de demanda |
| Impuestos mal armados | ISR 1.25% (RESICO 626) vs 10%; IVA exento en honorarios médicos vs gravado | fórmula server-side única (§4, regla clase-E7); el POST ya loggea rates atípicos |
| RFC/receptor equivocado | factura a nombre de otro = cancelar + re-emitir | receptor SOLO de `get_patient_fiscal` o Público en General explícito; nunca de texto libre del doctor sin confirmación en card |
| Público en General | reglas S01/616/GlobalInformation | ya viven server-side en el POST ✅ (validado en código) |
| PUE vs PPD | PPD exige REP después — deuda operativa | v1: default PUE; PPD solo si el doctor lo pide explícito y la card lo advierte ("requerirá complemento de pago") |
| Doble emisión | mismo ledgerEntry facturado 2 veces | pre-check server-side: `hasFactura=true` → el tool lo reporta y NO propone |

---

## 7. Método y secuencia (el playbook de agenda, replicado)

1. **Auditoría de sustrato** (como Fase 0): tenancy de TODOS los `/facturacion/*` (muestreado
   ✅ en `cfdi/[id]`; falta sistemático), validaciones del POST leídas (✅ este doc), y el
   inventario de qué arma la UI vs qué arma el server (impuestos).
2. **Catálogo de permutaciones** (como `04-PERMUTACIONES`): receptor con/sin datos, Público en
   General, RESICO vs otros regímenes, PUE/PPD, con/sin ledgerEntry, CSD vencido, paciente sin
   expediente, cita no completada, re-facturación.
3. **PR F1 — lectura** (los 4 tools read-only): "¿qué consultas me faltan facturar?" ya es
   valor real solo. Smoke-test de cada query shape contra prod ANTES de push (regla dura).
4. **PR F2 — `propose_create_cfdi` + `propose_send_fiscal_form`** con evals sembrados del
   catálogo ANTES de encender, validación en vivo con dr-prueba (Facturama sandbox si el perfil
   de prueba no tiene CSD real — verificar qué ambiente usa dr-prueba).
5. **PR F3 — entrega** (`propose_email_cfdi`) y lo que la validación en vivo pida.

**Prerrequisito organizativo:** ✅ HECHO 2026-07-11 — el refactor de módulos (ver §1) quedó
byte-idéntico y con evals 19/19. PR F1 puede empezar directo sobre `modules/`.

## 8. Preguntas abiertas (decidir antes de PR F1)

1. **¿dr-prueba puede timbrar?** ¿Tiene CSD/perfil Facturama activo, o hay sandbox? Sin esto no
   hay validación en vivo del camino feliz. (Revisar `facturamaStatus` del perfil de dr-prueba.)
2. **Opción A vs B** del link expediente↔factura (§3) — A alcanza para v1.
3. **¿Dónde vive el panel?** Mismo botón "Asistente" en `/appointments` (recomendado: un
   asistente) — pero el doctor también factura desde `/dashboard/facturacion`; ¿el panel se
   monta también ahí (mismo componente, mismo endpoint)?
4. **Orden vs PR 4 (voz):** independientes; facturas NO bloquea voz ni viceversa. El refactor
   de módulos beneficia a ambos.
5. IVA en servicios médicos: confirmar contra la UI actual qué taxes arma para honorarios
   (exentos típicamente) — la fuente de la fórmula server-side del §4.

---

*Relacionado: [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(playbook y estado), `docs/TODO FACTURAS/PLAN-FACTURACION-CFDI.md` y
`UNIFIED-FISCAL-REFERENCE.md` (el módulo de facturación en sí), memoria del proyecto
`project_agentes_por_bloque`.*
