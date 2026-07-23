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
| 2b | **Podar el prefijo** (~24.7k) | tensar descripciones de tools, mover reglas raras server-side. Blueprint §5.3 nivel 1 dice que hay "grasa". Cada token cortado se paga en cada pregunta fría. | prefijo medido (count_tokens sobre `buildSystemPrompt(AGENT_MODULES)`+`ALL_TOOLS`) |
| 2c | **Menos iteraciones/turno** | mejores descripciones para reducir tool-choice thrashing; ¿bajar el cap de 8 iteraciones? | avg iteraciones/turno (de los logs) |

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
