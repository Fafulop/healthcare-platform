# 📁 AGENTE FACTURAS — índice

> Documentación del **módulo facturas/pagos** del asistente — el más grande de todos: es donde
> el asistente pasó de solo leer a **escribir un documento fiscal legal** (emitir CFDIs).
> Cubre el sustrato (links de pago, ledger, expediente↔factura), el conocimiento de facturación
> verificado contra código, y los tres PRs de la serie F2.
>
> 🔄 **Cada sesión, lee primero [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).**
> El mapa de todos los agentes: [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).
> Conteos vigentes de tools/evals: [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.

## Estado (2026-07-19)

Todo el track está **shippeado y validado en vivo**: sustrato (H1/H2/H7/H8/H10) → F1 + F1.5
(lectura) → **F2a** (experto lector) → **F2b** (emisión, folio 8) → **F2c** (factura compuesta
vía borrador, folio 9) → **money-model #5** (patrón de separación, folio 10).
**Siguiente: F3** (`propose_email_cfdi` / `propose_send_fiscal_form`).

⚠️ **Facturama apunta a SANDBOX en prod — intencional.** Todo timbrado es de prueba, y
**cancelar CFDIs seguirá fallando hasta salir de sandbox** (diagnosticado 2026-07-18: el
ambiente de pruebas del SAT no conoce el CSD real del doctor; no es bug nuestro).
El agente **NO sabe** que es sandbox — deliberado: trata toda emisión como legalmente real.

## Vivos (se actualizan)

| Doc | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, decisiones, próximos pasos y el handoff |
| [`06-KNOWLEDGE-BASE-facturacion.md`](06-KNOWLEDGE-BASE-facturacion.md) | **LA base de conocimiento**: flujo de emisión endpoint-por-endpoint, la fórmula de impuestos, reglas SAT operativas (claves, uso×régimen, IVA, PUE/PPD, cancelación), catálogos, el grafo de datos — todo verificado contra código. Incluye el **drift-log docs↔código** (§8), el patrón que ahora es convención general |

## Snapshots históricos (congelados — no se actualizan)

| Doc | Qué capturó, y para qué sirve hoy |
|---|---|
| [`00-FACTIBILIDAD-Y-ARQUITECTURA.md`](00-FACTIBILIDAD-Y-ARQUITECTURA.md) | 2026-07-08 · El veredicto **UN asistente con módulos, NO A2A** (vigente, no re-litigar) + el descubrimiento de que la cadena expediente↔factura ya existía transitiva vía `LedgerEntry` + los tiers de riesgo. Sus preguntas abiertas §8 ya están respondidas en el propio doc |
| [`01-CONTEXTO-SAT-DESCARGA.md`](01-CONTEXTO-SAT-DESCARGA.md) | 2026-07-08 · Por qué los CFDIs tienen **fuente DUAL** (Facturama = solo lo emitido en plataforma; SAT Descarga = todo el RFC) y sus gotchas (UUID mayúsculas vs minúsculas, frescura, cancelaciones) |
| [`02-FLUJO-SISTEMA-cita-paciente-factura-pago.md`](02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) | 2026-07-10 · El **grafo de datos** (LedgerEntry = hub) + la matriz de 6 preguntas que ES el spec de `get_billing_status` + la decisión del tier de privacidad |
| [`03-PERMUTACIONES-paciente-dinero-factura.md`](03-PERMUTACIONES-paciente-dinero-factura.md) | 2026-07-10 · Catálogo E×M×F×O y los huecos H1–H10. El §6 ("el expediente es vista PARCIAL para dinero") sigue gobernando cómo leen los tools |
| [`04-FIXES-links-de-pago-ligados.md`](04-FIXES-links-de-pago-ligados.md) | 2026-07-10/11 · Los fixes de sustrato con sus lecciones. La gorda: **`isActive` ≠ no-pagado** (MP lo pone false al pagar, Stripe lo deja true) |
| [`05-ANALISIS-arquitectura-especializado-vs-modulo.md`](05-ANALISIS-arquitectura-especializado-vs-modulo.md) | 2026-07-15 · La re-apertura de la decisión de arquitectura con requisitos nuevos → **re-decidido: módulo enriquecido**, con los triggers honestos de cuándo SÍ convendría separar |
| [`07-PLAN-F2a-experto-lectura.md`](07-PLAN-F2a-experto-lectura.md) | 2026-07-15/16 · F2a completo: plan → build (§10) → review de 8 ángulos (§11) → validación 5/5 (§12) |
| [`08-PLAN-F2b-emision.md`](08-PLAN-F2b-emision.md) | 2026-07-16 · F2b: la primera escritura fuera de agenda. Plan → build (§10) → review inline (§11) → **folio 8 timbrado** (§12). El §12.4 documenta un guardrail EMERGENTE endosado: el agente rehúsa subfacturar aunque le digan "es de prueba" |
| [`09-DISENO-F2c-factura-compuesta-borrador.md`](09-DISENO-F2c-factura-compuesta-borrador.md) | 2026-07-16/17 · F2c: el agente PREPARA un borrador y el doctor emite en el form. La validación (§9) probó la tesis dos veces: el doctor corrigió el uso CFDI y el CP tras un rechazo REAL del SAT |

## Dónde vive lo demás

- **Reglas legales/fiscales canónicas:** `docs/TODO FACTURAS/UNIFIED-FISCAL-REFERENCE.md`
  (tiene las erratas de los otros docs de junio — citar ese, no los corregidos).
- **El código:** `apps/doctor/src/lib/agenda-agent/modules/facturas.ts` (módulo) ·
  `cfdi-builder.ts` (impuestos server-side) · `apps/api/src/lib/facturama.ts` (cliente) ·
  `apps/api/src/app/api/facturacion/*` (endpoints).
- **Convenciones de estos docs:** [`../GENERAL AGENTES/07-CONVENCIONES-docs.md`](../GENERAL%20AGENTES/07-CONVENCIONES-docs.md).

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md).*
