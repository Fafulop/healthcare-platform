# 🔄 Refresco de sesión — AGENTE FLUJOS — LÉEME PRIMERO

> Snapshot del estado del **módulo flujo de dinero** del asistente. Para una sesión/LLM en
> frío: lee este archivo, luego [`00-DISENO-F1-tools-lectura.md`](00-DISENO-F1-tools-lectura.md)
> para el detalle de los tools. Última actualización: **2026-07-12**.
> El mapa de todos los agentes: [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).

---

## En una frase

El asistente ganó su **cuarto módulo**: lectura completa del **flujo de dinero** (ledger,
balance, detalle con evidencia, conciliación bancaria) — 5 tools réplica de los endpoints
reales, cero escrituras. Es el paso "flujo de dinero" de la estrategia **F1 everywhere**
(blueprint §4); las propuestas/autonomía de este dominio (Motor 4) son F2+ y ya tienen diseño.

## Estado (2026-07-12)

**✅ CONSTRUIDO Y REVISADO — pendiente commit + validación en vivo.**

- Módulo `apps/doctor/src/lib/agenda-agent/modules/flujo.ts` registrado en `AGENT_MODULES`:
  `get_flujo_status` (compuesto de diagnóstico) · `get_movimientos` (filtros + estatusPago
  POR_COBRAR) · `get_balance` · `get_movimiento_detail` (evidencia fiscal+bancaria+pago online,
  incl. heurística de huérfanos) · `get_conciliacion_bancaria`.
- Prompt: INTRO capacidad 6, RESILIENCE con el alcance de flujo, `FLUJO_DOMAIN_MODEL` +
  `FLUJO_RULES` (desempates fiscal↔flujo espejeados — también se editó `fiscal.ts` para la
  consistencia). Panel: sugerencia nueva + copy del empty state.
- Asistente: **34 tools / 4 módulos**; prefijo ~19.4k tokens (+~3.3k).
- **Smoke vs prod (read-only)**: 13 shapes OK; cazó 2 bugs pre-push (fuga de TZ en fechas,
  drop silencioso de fecha malformada).
- **Code-review completo** (regla: lógica replicada + contenido que afirma hechos = review
  full): 14 candidatos → 11 corregidos. Detalle en `00-DISENO` §6.
- **Evals**: suite 39 casos = **37 PASS + 2 WARN soft (drift de datos de agenda) + 0 FAIL**;
  los 7 casos nuevos de flujo/xdom todos PASS por su camino canónico.

## Decisiones (no re-litigar)

- **F1 = solo lectura.** Conciliar/vincular/fusionar/ignorar = UI; las acciones asistidas son
  F2+ con el diseño de Motor 4 (niveles de autonomía EN CÓDIGO, tabla de propuestas,
  reversibilidad ya shipped como habilitador).
- `get_flujo_status` es **réplica fiel** de la pestaña (completeness) aunque esa pestaña
  undercuenta settlements — la divergencia se explica en la nota del tool, no se "corrige" en
  la réplica (regla 0: no inventar veredictos propios). El fix real es API-side (candidato).
- El filtro `estatusPago` es ADITIVO al endpoint (mismas columnas, misma clase que la alerta) —
  no existe en la UI; si la UI lo gana algún día, mantener paridad.
- Desempates cross-módulo espejeados en ambos prompts (lección del doble-steer F1.5).

## Próximos pasos

1. **Commit + push** (todo el changeset junto: módulo, registry, prompt, fiscal consistency,
   panel, evals, smoke script, estos docs) — explicar y pedir OK primero (regla).
2. **Validación en vivo post-deploy** (panel de prod, dr-prueba). Preguntas sugeridas:
   - "¿cómo voy con mi conciliación?" → get_flujo_status; verificar 663/659 con factura/1
     conciliado directo y que la nota de settlements se refleje.
   - "¿quién me debe?" → debe dar las DOS lecturas o pedir precisión (PPD $226,815 / ledger
     POR_COBRAR 15 ingresos $154,142).
   - "¿cuánto gasté en junio?" → UNA cifra CON fuente + mención de la otra lectura.
   - "¿por qué el movimiento EGR-2026-352 está incompleto?" → detalle con PDF sin banco.
   - NEGATIVO: "concíliame junio" → declina, dirige a Conciliación Bancaria, cero cards.
3. Actualizar blueprint §1/§3/§4 (flujo ✅, números de prefijo) tras la validación.
4. **Siguiente módulo F1: expediente (solo metadatos)** — último de "F1 everywhere"; después
   PR F2 de facturas.

## Método (heredado, no negociable)

Sustrato antes que agente · smoke de cada query shape vs prod ANTES de push · suite de evals
completa antes de push · nunca commit/push sin explicar y recibir OK · validación en vivo =
usuario actúa en prod, LLM verifica read-only (`../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`).

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO).*
