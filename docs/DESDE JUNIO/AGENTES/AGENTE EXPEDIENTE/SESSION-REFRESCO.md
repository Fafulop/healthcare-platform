# 🔄 Refresco de sesión — AGENTE EXPEDIENTE — LÉEME PRIMERO

> Snapshot del estado del **módulo expediente** del asistente. Para una sesión/LLM en frío:
> lee este archivo, luego [`00-DISENO-F1-metadatos.md`](00-DISENO-F1-metadatos.md).
> Última actualización: **2026-07-12**.
> El mapa de todos los agentes: [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).

---

## En una frase

El asistente ganó su **quinto módulo** — metadatos de expedientes (resumen administrativo
por paciente + vista de cartera/reactivación), con el contenido clínico estructuralmente
fuera — y con esto **"F1 everywhere" queda COMPLETO**: los 5 dominios tienen lectura.

## Estado (2026-07-12)

**✅ SHIPPED (`e04b9268` + fix de fechas) Y VALIDADO EN VIVO 5/5** (panel de prod, dr-prueba,
mismo día):
1. P-007: 3 consultas / última follow-up completed ✓ — y FLAGGEÓ el seguimiento vencido
   (2024-10-18 sin cita), el fix del review funcionando.
2. Reactivación: 16/19 ✓, distinguiendo "sin consulta registrada" de "consulta previa
   hace >6 meses" — la semántica corregida de lastVisitDate funcionando.
3. Nuevos: 3 ✓ (y aclaró honesto que midió 30 días rodantes, no julio calendario).
4. NEGATIVO recetas: declinó el contenido, ofreció metadatos, dirigió al expediente ✓.
5. Cross-módulo: veredictos fiscales + última consulta en una respuesta ✓ — **y CAZÓ un bug
   real**: find_patient decía 2024-10-14 vs expediente 2024-10-13. Causa: las fechas médicas
   se guardan a medianoche UTC y la UI renderiza la parte de fecha UTC; el módulo las
   renderizaba en TZ México (un día atrás). Fix: `dayOf` = parte de fecha UTC (igual que la
   UI y find_patient); verificado vs prod + suite completa re-corrida (41/43, 0 FAIL).
   Cuarta vez que el asistente funciona como herramienta de validación inversa.

- Módulo `apps/doctor/src/lib/agenda-agent/modules/expediente.ts` registrado:
  `get_expediente_resumen` (ficha + conteos/fechas de consultas·recetas·documentos·notas·
  formularios, borradores, seguimientos próximos Y vencidos, flags de baseline) y
  `get_pacientes_overview` (totales por estatus, nuevos, reactivación, tags).
- Prompt: INTRO capacidad 7, RESILIENCE (metadatos SÍ / contenido NO), domain model con la
  semántica REAL de última consulta (encounters, no citas), reglas con reparto de tools.
- Asistente: **35 tools / 5 módulos** *(medición del 2026-07-12 — hoy son más; conteo vigente
  en [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4)*;
  prefijo de entonces ~21.2k (+~1.9k, dentro de presupuesto).
- Smoke vs prod: 9 shapes + **tripwire de privacidad** (escanea el output por campos
  clínicos) — limpio en expediente rico (P-007) y vacío.
- Review privacidad+correctness: 6 hallazgos, 6 corregidos (detalle en `00` §5) — el gordo:
  `firstVisitDate`/"nunca ha venido" habrían mentido (la estampa crear el expediente/el
  encounter, no las citas).
- Evals: suite 43 = **41 PASS + 2 WARN soft + 0 FAIL**; los 4 casos nuevos PASS.

## Decisiones (no re-litigar sin motivo)

- **Tier de privacidad v1** (heredada de AGENTE FACTURAS 02 §7): solo metadatos +
  demográficos/administrativos. La frontera vive en los selects; única excepción auditada =
  baseline reducido a booleanos. Tripwire en el smoke.
- **Tags SÍ se devuelven** (2026-07-12): etiquetas administrativas del doctor, visibles
  abiertas en su UI — pueden codificar condición ("epoc"); racional en el header del módulo.
  **Veto disponible**: quitar `tags` de los 2 selects si se revoca.
- `ultimaConsultaRegistrada` = encounters, NO citas — no renombrar de vuelta a "visita".
- `firstVisitDate` NO se expone (se estampa al crear el expediente; mentiría como "primera
  consulta").

## Próximos pasos

1. **PR F2 de facturas** (propose_create_cfdi + builder de impuestos server-side — leer
   primero qué taxes arma `useBookings.emitCfdi`) — el siguiente escalón de riesgo del mapa
   (blueprint §4); PR 4 voz sigue independiente.
2. Radar heredado: undercount de settlements en completeness (API-side, ver AGENTE FLUJOS),
   prose-count cosmético (vigilar), borrar páginas v1/v2 muertas (follow-up del merge).

## Método (heredado, no negociable)

Smoke de cada query shape vs prod ANTES de push · tripwire de privacidad en cada cambio del
módulo · suite de evals completa antes de push · nunca commit/push sin explicar y recibir
OK · validación en vivo = usuario actúa en prod, LLM verifica read-only.

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO).*
