# 📁 AGENTE EXPEDIENTE — índice

> Documentación del **módulo expediente** del asistente (F1: tools de LECTURA sobre METADATOS
> de expedientes médicos — nunca contenido clínico). Quinto y último módulo de
> "F1 everywhere" (agenda → facturas → fiscal → flujo → **expediente**). Creado 2026-07-12.

## Estado (2026-07-12)

**F1 SHIPPED y validado en vivo 5/5** — y con esto "F1 everywhere" quedó completo. La validación
cazó un bug real (fechas médicas en día UTC, no TZ MX): cuarta vez que el asistente funciona como
herramienta de validación inversa de la UI.

| Doc | Qué es | Tipo |
|---|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | **LÉEME PRIMERO** — estado, decisiones (incl. la de tags, con veto disponible), próximos pasos | vivo |
| [`00-DISENO-F1-metadatos.md`](00-DISENO-F1-metadatos.md) | Los 2 tools, **cómo se hace cumplir la frontera de privacidad** (estructural en los selects + tripwire en el smoke), la semántica REAL de `lastVisitDate`, y los 6 hallazgos del review. Sus conteos de tools son del 2026-07-12 | snapshot técnico |

## Dónde vive lo demás

- **El mapa de todos los agentes:** [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md)
- **La decisión del tier de privacidad** (v1 = solo metadatos + demográficos/fiscales):
  [`../AGENTE FACTURAS/02-FLUJO-SISTEMA-cita-paciente-factura-pago.md`](../AGENTE%20FACTURAS/02-FLUJO-SISTEMA-cita-paciente-factura-pago.md) §7
- **El código:** `apps/doctor/src/lib/agenda-agent/modules/expediente.ts` (módulo completo),
  `registry.ts` (enchufe), `apps/doctor/scripts/expediente-smoke.ts` (smoke + tripwire de
  privacidad), `apps/doctor/scripts/agenda-agent-evals.ts` (casos `exped-*` y
  `xdom-expediente-cobro`)
- **Conteos vigentes de tools/evals:** [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md) · Convenciones de estos
docs: [`../GENERAL AGENTES/07-CONVENCIONES-docs.md`](../GENERAL%20AGENTES/07-CONVENCIONES-docs.md).*
