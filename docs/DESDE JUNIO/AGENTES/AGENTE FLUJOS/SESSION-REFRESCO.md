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

**✅ SHIPPED (`f1789cc1`) Y VALIDADO EN VIVO 5/5** (panel de prod, dr-prueba, mismo día):
1. "¿cómo voy con mi conciliación?" → 5 estados / 53 sin conciliar / lista top EXACTOS vs BD.
2. "¿quién me debe?" → LAS DOS lecturas sin pedirlo: PPD $226,815 (18/15) y POR_COBRAR
   $154,142 (15) — ambos exactos; hasta señaló que las listas se traslapan y las comisiones
   recurrentes de $58.
3. "¿cuánto gasté en junio?" → UNA cifra CON fuente (ledger $52,440.51 ✓) + la otra lectura
   nombrada (deducciones $46,743.69 ✓ verificado read-only, PPD sin complemento $1,215.75 ✓)
   — el desempate espejeado del review funcionando.
4. "¿por qué EGR-2026-352 está incompleto?" → evidencia fiel (PDF sin CFDI, sin banco,
   PENDING $0/$500) + diagnóstico accionable.
5. NEGATIVO "concíliame junio" → declinó, CERO cards, dirigió a Conciliación Bancaria y
   ofreció solo follow-ups de lectura. Frontera F1 sostenida.

- Módulo `apps/doctor/src/lib/agenda-agent/modules/flujo.ts` registrado en `AGENT_MODULES`:
  `get_flujo_status` (compuesto de diagnóstico) · `get_movimientos` (filtros + estatusPago
  POR_COBRAR) · `get_balance` · `get_movimiento_detail` (evidencia fiscal+bancaria+pago online,
  incl. heurística de huérfanos) · `get_conciliacion_bancaria`.
- Prompt: INTRO capacidad 6, RESILIENCE con el alcance de flujo, `FLUJO_DOMAIN_MODEL` +
  `FLUJO_RULES` (desempates fiscal↔flujo espejeados — también se editó `fiscal.ts` para la
  consistencia). Panel: sugerencia nueva + copy del empty state.
- Asistente: **33 tools / 4 módulos** *(medición del 2026-07-12 — hoy son más; conteo vigente
  en [`../GENERAL AGENTES/02-CAPACIDADES`](../GENERAL%20AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4)*;
  prefijo de entonces ~19.4k tokens (+~3.3k).
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

## Fix post-validación (auditoría A3, 2026-07-14)

**POR_COBRAR devolvía también egresos** — la réplica de la alerta solo copiaba
`paymentStatus IN (PENDING,PARTIAL)` sin `entryType='ingreso'` ni `porRealizar=false`; el
smoke original ("=15= la alerta") pasó por coincidencia de datos y meses de sync SAT crearon
cientos de egresos pendientes → 331 filas con $2.19M de "por pagar" en la respuesta de
"¿quién me debe?". Corregido con paridad exacta verificada (16 = 16 = 16, $157,592: tool =
alerta = SQL crudo); suite completa 43/43 PASS · 0 WARN. Post-mortem en `00` §hallazgos #2.

## Próximos pasos

1. ✅ **Expediente F1 CONSTRUIDO (2026-07-12, misma sesión)** — "F1 everywhere" completo;
   ver [`../AGENTE EXPEDIENTE/SESSION-REFRESCO.md`](../AGENTE%20EXPEDIENTE/SESSION-REFRESCO.md).
   Después: PR F2 de facturas (blueprint §4).
2. Radar (no urgente): fix API-side del undercount de settlements en completeness (ver `00` §5);
   si se hace, actualizar la réplica y su nota.

## Método (heredado, no negociable)

Sustrato antes que agente · smoke de cada query shape vs prod ANTES de push · suite de evals
completa antes de push · nunca commit/push sin explicar y recibir OK · validación en vivo =
usuario actúa en prod, LLM verifica read-only (`../../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`).

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO).*
