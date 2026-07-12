# 📁 AGENTE FLUJOS — índice

> Documentación del **módulo flujo de dinero** del asistente (F1: tools de LECTURA sobre el
> ledger y la conciliación bancaria). Cuarto módulo del asistente modular
> (agenda → facturas → fiscal → **flujo**). Creado 2026-07-12.

| Doc | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, decisiones, próximos pasos |
| [`00-DISENO-F1-tools-lectura.md`](00-DISENO-F1-tools-lectura.md) | Los 5 tools: qué endpoint replican, campos, fronteras, reglas de prompt, hallazgos del review |

## Dónde vive lo demás

- **El mapa de todos los agentes:** [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md)
- **El playbook (cómo se construye un módulo):** blueprint §2 + [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
- **El SUSTRATO de este dominio** (modelo de dinero, permutaciones, test log, motores):
  [`../../flujo de dinero permutaciones/`](../../flujo%20de%20dinero%20permutaciones/) — en
  particular `00-modelo-consolidado.md` (el modelo), `05-test-log.md` (el sobre de competencia)
  y `06-agente-motor4-diseno.md` (el diseño F2+ de propuestas/autonomía, PRE-existente a este
  módulo)
- **El código:** `apps/doctor/src/lib/agenda-agent/modules/flujo.ts` (módulo completo),
  `registry.ts` (enchufe), `apps/doctor/scripts/flujo-smoke.ts` (smoke read-only vs prod),
  `apps/doctor/scripts/agenda-agent-evals.ts` (casos `flujo-*` y `xdom-*`)
