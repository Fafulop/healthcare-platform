# AGENTE AGENDA — carpeta de trabajo

> **Qué es esto.** La carpeta donde nació **el asistente**. Empezó como "el agente de la agenda"
> (primer bloque de la estrategia de agentes por módulo) y terminó siendo el tronco común: el
> loop, el sistema de propuestas, el método de verificación y la bitácora de fallos en vivo que
> hoy usan los 5 módulos. Por eso esta carpeta contiene tanto lo específico de agenda como el
> **playbook compartido**.
>
> Decisión de arranque (2026-07-03): **se construye desde cero** con tecnología de agentes actual
> (tool-calling), no sobre el chat existente (`appointments-chat`, context-stuffing + gpt-4o) ni
> sobre el asistente RAG de docs — ambos se estudian como antecedente, no como base.

> 🔄 **Cada sesión, lee primero [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md)** (estado, bitácora
> y próximos pasos). El mapa de TODOS los agentes está en
> [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md);
> los conteos vigentes (tools/módulos/evals) en
> [`../GENERAL AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.

## Estado (2026-07-22)

**PR 1 (lecturas) · PR 2 (rangos/bloqueos) · PR 3 (citas) — los tres VIVOS en prod y validados
en vivo.** Después de PR 3, el trabajo se movió a los otros módulos (facturas, fiscal, flujo,
expediente) y a las capas transversales (panel copilot, capa de conocimiento, auditoría).
**PR 4 (voz + retiro del ChatWidget v1 + limpieza de `/v1` `/v2`) sigue pendiente** y no tiene
carpeta propia todavía.

Bugs conocidos abiertos (conducta del modelo, no de código): **#23 card fantasma** (PENDIENTE) y
**#24 over-claim del member** (DIFERIDO) — bitácora del `SESSION-REFRESCO`.

## Archivos

### Vivos (se actualizan)

| Archivo | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, decisiones, **la bitácora de fallos en vivo de TODO el asistente** (numerada hasta #24; #24 vive en su propia sección, no en la tabla) y próximos pasos. |
| [`05-REFERENCIA-TECNICA-AGENTE.md`](05-REFERENCIA-TECNICA-AGENTE.md) | **Referencia del SISTEMA**: filosofía (regla 0, propone→confirma), estructura de archivos, flujo punta a punta, catálogo de tools, ciclo de vida de propuestas, presupuesto/caché, límites conocidos. |
| [`TOOLING-acceso-railway-db-agenda.md`](TOOLING-acceso-railway-db-agenda.md) | **Método de verificación:** consultar la BD de prod (Railway, solo lectura) durante las pruebas. Tablas y queries de agenda. |

### Snapshots históricos (congelados — no se actualizan)

| Archivo | Qué capturó, y para qué sirve hoy |
|---|---|
| [`00-RESEARCH-estado-actual.md`](00-RESEARCH-estado-actual.md) | 2026-07-03 · El mapa de lo que existía antes del agente (dos modelos de agenda conviviendo, el chat v1 huérfano en `/v1`, la infra IA compartida). Sigue siendo la mejor explicación de **por qué** se construyó desde cero y por qué `/v1` `/v2` son deuda. |
| [`01-AUDIT-agenda-rangos.md`](01-AUDIT-agenda-rangos.md) | 2026-07-03 · Auditoría del sustrato: 4 hallazgos (cross-tenant, carrera de doble-booking, buffer no aplicado, retícula) + las 2 rondas de fixes. F1/F2/F3 cerrados; **F4 sigue abierto** (neutralizado por diseño del tool). |
| [`02-DISENO-tools-y-arquitectura.md`](02-DISENO-tools-y-arquitectura.md) | 2026-07-03 · El diseño original + la revisión con 11 gaps (G1–G11). Valor hoy: los gaps y su resolución — G1 (el ledger se crea desde el frontend) explica decisiones que siguen vivas. |
| [`03-EDGE-CASES-lectura.md`](03-EDGE-CASES-lectura.md) | 2026-07-03 · Los 7 edge cases de la fase lectura (E1–E7) + los límites que el agente ADMITE (L1–L5). E7 es la lección canónica: un campo derivado se calcula con la fórmula del motor canónico, nunca con una interpretación. |
| [`04-PERMUTACIONES-agenda.md`](04-PERMUTACIONES-agenda.md) | 2026-07-04 · Catálogo exhaustivo actor×acción + matriz completa de transiciones + resultados de la campaña de validación. El descubrimiento RNG-11/12 (dos políticas de borrado de rangos) sigue gobernando `delete_range`. |
| [`06-PR3-DISENO-citas.md`](06-PR3-DISENO-citas.md) | 2026-07-06 · Diseño de PR 3: decisiones D1–D6, GAP-1..5, los contratos verificados y los dos code-reviews. PR 3 shippeó y se validó — el doc queda como el registro de por qué cada tool de citas es como es. |

## Relación con otras carpetas

- [`../GENERAL AGENTES/`](../GENERAL%20AGENTES/) — el mapa de arriba: blueprint, matriz de
  capacidades, método de review, mapa de la superficie IA, convenciones de estos docs.
- [`../AGENTE FACTURAS/`](../AGENTE%20FACTURAS/) · [`../AGENTE FLUJOS/`](../AGENTE%20FLUJOS/) ·
  [`../AGENTE EXPEDIENTE/`](../AGENTE%20EXPEDIENTE/) — los otros módulos, construidos con el
  playbook de esta carpeta.
- [`../AGENTE KNOWLEDGE LAYER/`](../AGENTE%20KNOWLEDGE%20LAYER/) — la capa de conocimiento
  (qué HABLA el agente vs qué RUTEA a la guía).
- [`../../flujo de dinero permutaciones/`](../../flujo%20de%20dinero%20permutaciones/) — el
  sustrato del dominio dinero, y en particular
  [`06-agente-motor4-diseno.md`](../../flujo%20de%20dinero%20permutaciones/06-agente-motor4-diseno.md),
  que es el diseño **F2+ del dominio flujo** (propuestas/autonomía sobre el ledger). Nota
  histórica: ese doc definió los principios de agentes ANTES de que existiera el blueprint —
  hoy los principios compartidos viven en `GENERAL AGENTES/00-BLUEPRINT`.
- [`../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md)
  — el método base de acceso a la BD (mismo mecanismo, distintas tablas).

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md) · Convenciones de estos
docs (qué se actualiza, qué se congela): [`../GENERAL AGENTES/07-CONVENCIONES-docs.md`](../GENERAL%20AGENTES/07-CONVENCIONES-docs.md).*
