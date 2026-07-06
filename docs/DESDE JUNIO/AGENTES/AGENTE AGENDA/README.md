# AGENTE AGENDA — carpeta de trabajo

> **Qué es esto.** Carpeta de trabajo para diseñar y construir el **agente de IA de la agenda**
> (`https://doctor.tusalud.pro/appointments`). Es el **primer bloque** de la estrategia de agentes
> por módulo: *agente de agenda* → *agente de flujo de dinero* → *agente de expediente médico* →
> merge final en un solo agente.
>
> Decisión de arranque (2026-07-03): **se construye desde cero** con tecnología de agentes actual
> (tool-calling), no sobre el chat existente (`appointments-chat`, context-stuffing + gpt-4o) ni
> sobre el asistente RAG de docs — ambos se estudian como antecedente, no como base.

> 🔄 **Cada sesión, lee primero [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md)** (estado, decisiones
> y próximos pasos actualizados).

## Archivos

| Archivo | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **Estado vivo del proyecto** — qué está construido (PR 1 read-only ✅), bloqueadores (API key + push), decisiones y próximos pasos. |
| [`00-RESEARCH-estado-actual.md`](00-RESEARCH-estado-actual.md) | **Investigación del código** (verificada 2026-07-03): qué existe en producción de agenda (modelos, endpoints, UI) y qué IA ya hay (appointments-chat, RAG). Punto de partida del diseño. |
| [`01-AUDIT-agenda-rangos.md`](01-AUDIT-agenda-rangos.md) | **Auditoría del código de rangos** (2026-07-03): 4 hallazgos (cross-tenant en range-bookings, carrera de doble-booking, buffer no aplicado al crear, startTime sin retícula) + lo que sí está sólido. F1/F2 arreglar ANTES del agente. |
| [`02-DISENO-tools-y-arquitectura.md`](02-DISENO-tools-y-arquitectura.md) | **Diseño del agente:** decisiones de arquitectura (tool-calling nativo, Claude, propone→doctor confirma), catálogo de tools de lectura/acción con tiers, reglas duras, y plan de build en 4 PRs. |
| [`03-EDGE-CASES-lectura.md`](03-EDGE-CASES-lectura.md) | **Catálogo de edge cases** (fase lectura): 6 arreglados (E1–E6, disponibilidad sin servicio, conteos, próxima cita, acentos, precio, weekday) + límites reales que el agente debe admitir (L1–L5). |
| [`04-PERMUTACIONES-agenda.md`](04-PERMUTACIONES-agenda.md) | **Catálogo exhaustivo de permutaciones + resultados de la validación en vivo** (2026-07-04): matriz actor×acción, matriz completa de transiciones, checklist por acción (BLK/EDT completos ✅, RNG casi ✅, CIT pendiente de buffer>0), permutaciones de orden, efectos secundarios, y requisitos §7 para PR 2 (incl. las dos políticas de borrado de rangos RNG-11/12). |
| [`05-REFERENCIA-TECNICA-AGENTE.md`](05-REFERENCIA-TECNICA-AGENTE.md) | **Referencia técnica del sistema**: filosofía (regla 0, propone→confirma), estructura de archivos, flujo punta a punta, catálogo de tools (lectura + propuestas) con sus endpoints/pre-checks, ciclo de vida de propuestas, presupuesto/límites, prompt, método de verificación. |
| [`06-PR3-DISENO-citas.md`](06-PR3-DISENO-citas.md) | **Diseño de PR 3** (2026-07-06, contratos verificados contra código): decisiones D1–D6 (CIT-6 = ruta normal, reschedule en una card, complete con doble-call de ledger, tier 🔴), catálogo de 6 tools de citas con pre-checks, cambios por archivo, reglas de prompt y evals nuevos. |
| [`TOOLING-acceso-railway-db-agenda.md`](TOOLING-acceso-railway-db-agenda.md) | **Herramienta de verificación:** consultar la BD de prod (Railway, solo lectura) para verificar datos de agenda durante las pruebas — el equivalente al TOOLING de flujo de dinero. |

## Relación con otras carpetas

- `../../flujo de dinero permutaciones/` — el bloque hermano (Flujo de Dinero). Su
  [`06-agente-motor4-diseno.md`](../../flujo%20de%20dinero%20permutaciones/06-agente-motor4-diseno.md)
  define los principios compartidos de los agentes (niveles de autonomía, propuestas, seguridad) que
  este bloque también seguirá.
- `../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md` — el método base de acceso a
  la BD (mismo mecanismo, distintas tablas).

*Estado:* carpeta creada 2026-07-03. **PR 1 y PR 2 en prod, validados en vivo; prerequisitos de
PR 3 cerrados el 2026-07-05** (campaña CIT ✅, evals G11 12/12 ✅ en
`apps/doctor/scripts/agenda-agent-evals.ts`, invariantes en el prompt ✅). Siguiente: **PR 3**
(propuestas de citas) — decisiones de arranque en `SESSION-REFRESCO` → Próximos pasos.
