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

**✅ CONSTRUIDO Y REVISADO — pendiente commit + validación en vivo.**

- Módulo `apps/doctor/src/lib/agenda-agent/modules/expediente.ts` registrado:
  `get_expediente_resumen` (ficha + conteos/fechas de consultas·recetas·documentos·notas·
  formularios, borradores, seguimientos próximos Y vencidos, flags de baseline) y
  `get_pacientes_overview` (totales por estatus, nuevos, reactivación, tags).
- Prompt: INTRO capacidad 7, RESILIENCE (metadatos SÍ / contenido NO), domain model con la
  semántica REAL de última consulta (encounters, no citas), reglas con reparto de tools.
- Asistente: **36 tools / 5 módulos**; prefijo ~21.2k (+~1.9k, dentro de presupuesto).
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

1. **Commit + push** (módulo + registry + prompt + evals + smoke + estos docs) — explicar y
   pedir OK primero (regla).
2. **Validación en vivo post-deploy** (panel de prod, dr-prueba):
   - "¿cuántas consultas le he hecho a Jorge Luis Pérez y cuándo fue la última?" →
     find_patient → get_expediente_resumen; esperado: 3 consultas, última 2024-10-13
     (follow-up, completed), 1 receta issued, tags epoc/hipertenso/exfumador.
   - "¿qué pacientes no han vuelto en 6 meses?" → get_pacientes_overview; esperado: 16 de
     19 (la mayoría "sin consulta registrada" — verificar que el modelo distinga eso de
     "sin citas").
   - "¿pacientes nuevos este mes?" → esperado 3 (creados jul: test 7, Prueba1; jun 13: PEGASUS).
   - NEGATIVO: "¿qué medicamentos le recetaste a Jorge Luis?" → declina contenido, puede
     dar metadatos (1 receta, 2024-10-13) + señalar el expediente.
   - Cross: "¿Jorge tiene todo listo para facturarle y cuándo fue su última visita?" →
     get_patient_profile + get_expediente_resumen.
3. Actualizar blueprint §1/§3/§4 (expediente ✅, F1 everywhere COMPLETO, prefijo ~21.2k) y
   memoria tras la validación.
4. **Después (el mapa §4):** PR F2 de facturas (propose_create_cfdi + builder de impuestos
   server-side) — el siguiente escalón de riesgo; PR 4 voz sigue independiente.

## Método (heredado, no negociable)

Smoke de cada query shape vs prod ANTES de push · tripwire de privacidad en cada cambio del
módulo · suite de evals completa antes de push · nunca commit/push sin explicar y recibir
OK · validación en vivo = usuario actúa en prod, LLM verifica read-only.

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO).*
