# 🧪 Plan de experimentos — bajar el costo del agente

> Orden: primero lo barato y sin riesgo (cap + eficiencia, no toca el modelo), luego la matriz
> de modelos/proveedores. Métrica común: **calidad (suite de 65 evals) + costo por pregunta**.
> Cada experimento se registra en [`02-BITACORA-experimentos.md`](02-BITACORA-experimentos.md).

## Lever 1 — cap SEMANAL en vez de diario (decisión del usuario)

**Qué:** cambiar el cap de **500k budget/DÍA** a **~2000k budget/SEMANA**. Racional del usuario:
hay días sin uso; una ventana semanal los promedia (un doctor puede tener un día pesado si otros
fueron cero). 2000k/sem ≈ $6/sem ≈ **$26/mes peor caso** a precio estándar — se afina el número.

**Diseño (verificar contra código antes de construir):**
- Hoy el cap es diario con corte a **medianoche MX** (`AGENDA_AGENT_DAILY_TOKEN_CAP`, chequeo en
  `run-turn.ts` que suma `budget_tokens` de `llm_token_usage` del día). Ver `05-REFERENCIA-TECNICA` §8.
- Opciones de ventana: (a) **semana calendario** (lun–dom MX, más simple, reset predecible) vs
  (b) **rolling 7 días** (más justo, sin "reset de lunes" que un doctor podría explotar). Recomendado:
  empezar con semana calendario MX (más simple, igual que el corte diario actual).
- Cambio: la query del budget agrega sobre los últimos 7 días / la semana en curso en vez del día;
  el env var pasa a `AGENDA_AGENT_WEEKLY_TOKEN_CAP` (o se reinterpreta el existente). El widget
  "Uso de hoy" del panel pasa a "Uso de la semana".
- ⚠️ **Smoke read-only del nuevo query shape vs prod ANTES del push** (regla dura; ver
  `feedback-smoke-test-raw-sql`). Es agregación sobre `llm_token_usage` — read-only, seguro.
- Riesgo: bajo. Reversible (env var + un query). No toca el loop ni el modelo.

**Cómo elegir el número:** definir el % de la suscripción que el LLM puede costar (p. ej. 10% de
$45 = $4.50/mes = ~$1/semana ≈ ~350k budget/semana) y poner el cap ahí. 2000k/sem es el punto de
partida del usuario; ajustar con datos de doctores reales.

## Lever 2 — eficiencia (no toca el modelo)

| # | Experimento | Cómo | Métrica |
|---|---|---|---|
| 2a | **TTL de caché 1h** | cambiar `cache_control: {type:'ephemeral'}` → `{type:'ephemeral', ttl:'1h'}` en `anthropic.ts` (el prefijo estable). Write pasa a ×2 pero convierte preguntas frías esporádicas en cache-reads (×0.1). | costo por pregunta fría antes/después (re-correr A4) |
| 2b | **Podar el prefijo** (27,151 MEDIDO) | tensar descripciones de tools, mover reglas raras server-side. Cada token cortado se paga ×1.25 en cada pregunta fría. **Ya no es "hay grasa": hay blancos** (abajo). | `npx tsx scripts/measure-agent-prefix.ts` antes/después + suite completa + benchmark con la MISMA `--price` |
| 2c | **Menos iteraciones/turno** | mejores descripciones para reducir tool-choice thrashing; ¿bajar el cap de 8 iteraciones? | avg iteraciones/turno (de los logs) |

### 🎯 Blancos de poda del 2b (medidos 2026-07-23 — ya no se adivina)

Prefijo **27,151** = system 12,126 (45%) + tools 15,025 (55%). Escribirlo es el **82%** del costo
de cada pregunta fría, así que este es el lever con mejor relación esfuerzo/beneficio medida.

| Módulo | Total | tools | prompt | vs presupuesto ~2-3k |
|---|---|---|---|---|
| **facturas** | 8,706 | 5,796 (12) | 2,910 | ⚠️ **~3×** |
| **agenda** | 7,255 | 5,531 (18) | 1,724 | ⚠️ **~2.4×** |
| flujo | 3,032 | 1,889 (5) | 1,143 | ⚠️ apenas |
| expediente | 1,598 | 792 (2) | 806 | ✅ |
| fiscal | 1,590 | 663 (2) | 927 | ✅ |

Compartido (intro/resilience/reglas globales) 4,616 + overhead del bloque de tools 354.
Tools más pesadas: `propose_create_cfdi` **1,276** · `propose_prepare_factura_borrador` 969 ·
`get_movimientos` 807 · `propose_create_booking` 716 · `propose_create_range` 618 — el **top-10
concentra el 46%** de los tokens de tools.

**Orden sugerido de ataque** (mayor retorno primero, y el blueprint §5.3 dice que un módulo sobre
presupuesto es señal de que *sus veredictos no están suficientemente server-side* — o sea, mirar
arquitectura antes que prosa):
1. **facturas** (8,706): el desvío más grande. Empezar por `propose_create_cfdi` (1,276, la tool
   más pesada del sistema) y `propose_prepare_factura_borrador` (969).
2. **agenda** (7,255): 18 tools es el set más grande — candidato a fusionar tools delgadas en el
   compuesto del dominio (nivel 1 del blueprint).
3. **Prompt compartido** (4,616): lo paga TODO doctor y todo member; revisar INTRO/RESILIENCE
   (que además hardcodean el set completo de capacidades — ver blueprint §5.2 punto 6).

**Aritmética:** cortar 5,000 tok (−18%) baja la pregunta fría de $0.083 a **~$0.070**
(ahorro ≈ $0.0125 intro / $0.019 estándar por pregunta fría).

⚠️ **Toca prompt/tools ⇒ riesgo de conducta.** Toda poda: `measure-agent-prefix.ts` antes/después
+ **suite completa de 65** + benchmark contra la baseline con la MISMA `--price`. Un ahorro que
mueve el `63/65` no es un ahorro.

## Lever 3 — MATRIZ de modelos y proveedores

**Objetivo:** correr el MISMO trabajo con cada modelo, medir calidad + costo + fiabilidad de tools.

### Modelos a probar

| Proveedor | Modelo | Por qué | Precio input (miss/hit) |
|---|---|---|---|
| Anthropic | Sonnet 5 | baseline (el que corre) | $2–3 / ~$0.20 |
| Anthropic | **Haiku 4.5** | 3× más barato, mismo SDK/caché/DPA, cero fricción de integración | $1 / ~$0.10 |
| Moonshot | **Kimi K2.6** | 3–5× barato, fuerte en agentic/tools | ~$0.60–0.95 / ~$0.15 |
| DeepSeek | **V4 Flash** | 15–20× barato, caché 98% off | $0.14 / $0.0028 |

### El rig de pruebas

- **La suite de 65 evals (`agenda-agent-evals.ts`) es el banco de pruebas.** Corre el loop real
  contra prod read-only y mide comportamiento. Es como se valida cualquier cambio de modelo.
- ⚠️ **Prerrequisito de integración:** `anthropic.ts` (`callClaude`) es raw-fetch SOLO a Anthropic.
  Para DeepSeek/Kimi hace falta un **adaptador de proveedor**: ambos exponen endpoints
  **compatibles con OpenAI** (incl. tool-calling en formato OpenAI). Opciones:
  (a) una capa `callModel` que enrute por `provider` (anthropic | deepseek | kimi) traduciendo
  request/response de tools; (b) un branch de prueba que apunte el eval runner a cada endpoint.
  Empezar con Haiku (cero integración — mismo SDK, solo cambia `AGENDA_AGENT_MODEL`).
- **Ojo tool-calling:** el agente es 100% loop de tools. El riesgo real de cambiar proveedor no es
  el precio, es si el modelo llama tools de forma fiable y respeta el patrón propuesta→card. Medir
  esto explícitamente (no solo pass/fail de texto).

### Métricas a capturar por modelo (en la bitácora)

1. **Calidad:** pass/WARN/FAIL de la suite 65 (baseline Sonnet 5 = 63/65 · 0 FAIL, 2026-07-23).
   OJO especial: los evals de escritura (propuestas, emisión CFDI) y los de inyección (`inj-*`).
2. **Costo por pregunta:** fría (prefijo re-escrito) y templada (cache-read), en USD.
3. **Fiabilidad de tools:** ¿llamó las tools correctas? ¿respetó propuesta→card? ¿inventó?
4. **Latencia** por turno.
5. **$/doctor/mes proyectado** al cap elegido.

### Secuencia sugerida

1. **Haiku 4.5** primero (cero integración): flip `AGENDA_AGENT_MODEL`, corre la suite, mide.
   Decide si Haiku-para-lecturas + Sonnet-para-propuestas (routing) vale la pena.
2. **Kimi K2.6** y **DeepSeek V4 Flash**: construir el adaptador OpenAI-compat, correr la suite.
3. Comparar en la bitácora. Decidir arquitectura final (¿un solo modelo? ¿routing por tier?
   emisión CFDI se queda en el más confiable).

## Fuera de alcance técnico (anotado, decisión de producto)

El agente como **tier/add-on** en vez de incluido en el plan base — la palanca más grande y no es
de tokens. Documentado para que el dueño lo decida aparte.

---

*Relacionado: [`00-ANALISIS-costos-y-hallazgos.md`](00-ANALISIS-costos-y-hallazgos.md) (los números),
`../GENERAL AGENTES/00-BLUEPRINT` §5.3 (la escalera: nivel 1 = TTL 1h/poda, nivel 2 = model routing),
`../GENERAL AGENTES/05-METODO-code-review` (cómo se revisa un cambio de modelo — lógica que afirma
comportamiento). Método de evals: `../AGENTE AGENDA/SESSION-REFRESCO`.*
