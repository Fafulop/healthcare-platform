# 📁 AGENTE EXPEDIENTE — índice

> Documentación del **módulo expediente** del asistente (F1: tools de LECTURA sobre METADATOS
> de expedientes médicos — nunca contenido clínico). Quinto y último módulo de
> "F1 everywhere" (agenda → facturas → fiscal → flujo → **expediente**). Creado 2026-07-12.

| Doc | Qué es |
|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, decisiones (incl. la de tags), próximos pasos |
| [`00-DISENO-F1-metadatos.md`](00-DISENO-F1-metadatos.md) | Los 2 tools, la frontera de privacidad, semántica de lastVisitDate, hallazgos del review |

## Dónde vive lo demás

- **El mapa de todos los agentes:** [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md)
- **La decisión del tier de privacidad** (v1 = solo metadatos + demográficos/fiscales):
  [`../AGENTE FACTURAS/02-FLUJO-SISTEMA-cita-paciente-factura-pago.md`](../AGENTE%20FACTURAS/02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) §7
- **El código:** `apps/doctor/src/lib/agenda-agent/modules/expediente.ts` (módulo completo),
  `registry.ts` (enchufe), `apps/doctor/scripts/expediente-smoke.ts` (smoke + tripwire de
  privacidad), `apps/doctor/scripts/agenda-agent-evals.ts` (casos `exped-*` y
  `xdom-expediente-cobro`)
