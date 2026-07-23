# 📊 Análisis de costos del agente — dónde va el dinero (medido)

> Todas las cifras son **read-only vs prod, 2026-07-23** (A4 + medición de thinking-share),
> método TOOLING (`../AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`). ⚠️ **TODO es dr-prueba**
> — un doctor de prueba martillado por dev/evals, NO representa a un doctor real. Los números
> acotan y orientan; el costo por doctor REAL sigue sin medirse (no hay uso real todavía).

## 1. El negocio

- Revenue: **$37–50 USD/mes por doctor**, por TODA la app. El LLM es un renglón dentro de eso.
- Meta implícita: LLM ≤ un % cómodo de esa suscripción (p. ej. ≤10% = ~$4.50/mes/doctor).

## 2. A dónde va el dinero — INPUT, ~99%

| Métrica (endpoint=agenda-agent) | Valor |
|---|---|
| p50 **input**/turno | **39,706 tok** |
| avg input/turno | 49,643 tok |
| p50 **output**/turno | **515 tok** |
| output como % del COSTO (completion×5 ÷ budget) | **18.7%** |
| turnos con >2k output (de ~85) | 3 |
| input vs output CRUDO (todo el periodo) | 5.57M vs 96.6k → output = 1.7% |

**Conclusión:** el costo es re-mandar el **prefijo estático de 27,151 tokens** (system 12,126 +
39 tools 15,025) + historial + resultados de tools, **hasta 8 iteraciones/turno**, cada iteración
cuenta su input.

> 📏 **El prefijo ya está MEDIDO exacto (2026-07-23), no estimado** — `count_tokens` vía
> `apps/doctor/scripts/measure-agent-prefix.ts`. Corrige el "~24.7k" que se citaba antes (venía
> del piso de `prompt_tokens`): el real es **+10% mayor**. Validado de forma independiente contra
> el `cache_read` que reportó la API en la corrida de la baseline (27,257 — 0.39% de diferencia).
> Es EL número que gobierna el costo: **82% de cada pregunta fría es escribir este prefijo.**
> Desglose por módulo/tool y blancos de poda: [`02-BITACORA`](02-BITACORA-experimentos.md).

## 3. Hallazgo clave: thinking NO es la palanca

Hipótesis inicial (2026-07-23): "Sonnet 5 corre thinking adaptativo por default (no se pasa el
param `thinking` en `anthropic.ts`) → puede estar quemando output ×5". **MEDIDO: FALSO.** El
thinking adaptativo ya decide NO pensar en los turnos de lectura (output p50 = 515 tok). Desactivar
thinking ahorra una fracción del 18.7%, y buena parte de ese 18.7% es texto de respuesta real
(viñetas/tablas), no thinking. **Descartado como palanca principal.** (Lección: se midió antes de
cambiar — se evitó una "optimización" sin efecto.)

## 4. El cap actual = la suscripción completa

- Cap: **500k budget/día ≈ $1.50/día ≈ $45/mes en el peor caso.** Eso es TODA la suscripción de
  un doctor, en LLM solo. El cap se dimensionó para validación, nunca se re-ajustó al negocio.
- Peor día real medido: **61.2% del cap** (~$0.90/día ≈ $27/mes) — y fue durante validación
  INTENSA (16 turnos). Un doctor real será mucho menos.
- `budget_tokens` pondera por costo: uncached ×1 · cache-read ×0.1 · cache-write ×1.25 · output ×5.
  500k budget ≈ $1.50 → 1 budget tok ≈ $0.000003. Cap semanal 2000k ≈ **$6/semana ≈ $26/mes** peor caso.

## 5. Costo real hasta ahora (referencia, NO representativo)

`agenda-agent`, Jul 3–23, precio ESTÁNDAR $3/$15 SIN descuento de caché: **$18.16** (5.57M input
+ 96.6k output). El bill real es menor (caché read ×0.1 + intro $2/$10). Es dev/eval sobre
dr-prueba, no un doctor.

## 6. Tabla de precios por proveedor (2026-07, por 1M tokens)

Como el costo es ~99% input, importa la columna de input. Fuentes: agregadores de terceros
(pricepertoken, tokenmix, nxcode, cloudzero) — **confirmar en la página oficial antes de commitear.**

| Modelo | Input (cache-miss) | Output | Input (cache-hit) | Caché | Fuerza en tools/agentic |
|---|---|---|---|---|---|
| **Sonnet 5** — hoy (intro) | $2 | $10 | ~$0.20 | manual, TTL 5m/1h | baseline (el que corre) |
| **Sonnet 5** — desde 2026-09-01 | **$3** | **$15** | ~$0.30 | — | **+50% automático** |
| Haiku 4.5 | $1 | $5 | ~$0.10 | igual que Sonnet | más débil; ok para lecturas |
| **Kimi K2.6** (Moonshot) | ~$0.60–0.95 | ~$2.50–4.00 | ~$0.15 | auto, ~85% off | fuerte (hecho para agentic) |
| **DeepSeek V4 Flash** | **$0.14** | $0.28 | **$0.0028** | auto, ~98% off | bueno; menos probado en loops complejos |
| DeepSeek V4 Pro | $0.435 | $0.87 | $0.0036 | auto | intermedio |

**Directional:** Kimi ≈ 3–5× más barato input que Sonnet; DeepSeek V4 Flash ≈ 15–20× en
cache-miss y ~70–100× en cache-hit. **Ambos tienen prompt caching** (mi duda previa: sí lo tienen),
así que el patrón cache-pesado del agente sobrevive el cambio.

### Proyección gruesa de $/doctor/mes (peor caso al cap semanal 2000k ≈ $26/mes a $3/$15)

Escalando por precio de input relativo (aproximación; el cap se define en budget, así que en la
práctica el cap ACOTA el gasto y el modelo barato hace que se llegue menos al cap):

| Modelo | ~$/mes peor caso al mismo cap | Notas |
|---|---|---|
| Sonnet 5 (Sept) | ~$26 | baseline caro |
| Sonnet 5 (intro) | ~$17 | vence 2026-08-31 |
| Haiku 4.5 | ~$9 | 3× input |
| Kimi K2.6 | ~$5–9 | 3–5× |
| DeepSeek V4 Flash | ~$1–2 | 15–20× |

## 7. Lo que aún no sabemos (crítico)

- **Uso de un doctor REAL** — todo es dr-prueba. Es la diferencia entre "$2/doctor, relax" y
  "$15/doctor, actúa ya". Por eso el cap (lever 1) fue el movimiento seguro: acota el downside
  sin importar cuál resulte cierto. **Sigue siendo el hueco #1** y es lo que bloquea decidir
  TTL-1h (su beneficio depende de la frecuencia con que el doctor pregunta).
- **Confirmación de precios oficiales** Moonshot/DeepSeek (los de arriba son de agregadores).
- ~~Cuánto mide exactamente el prefijo~~ → ✅ **RESUELTO 2026-07-23: 27,151 tok medidos**
  (`scripts/measure-agent-prefix.ts`), validado contra el `cache_read` de la API (0.39%).
- ~~Si el costo real por corrida cuadra con la teoría~~ → ✅ **RESUELTO: baseline $1.436/corrida,
  $0.022 tibia / $0.083 fría, calidad 63/65 · 0 FAIL** ([`02-BITACORA`](02-BITACORA-experimentos.md)).

## 8. Decisiones tomadas

- **Compliance NO es issue (usuario, 2026-07-23)** — datos de paciente a proveedor chino aprobado.
- **Thinking NO se toca** como palanca de costo (medido, §3).
- **Emisión de CFDI (tier legal)** — mantener en un modelo confiable pase lo que pase; no es
  donde se ahorra (decisión de diseño; validar duro cualquier modelo ahí).

---

*Relacionado: `../GENERAL AGENTES/00-BLUEPRINT` §5 (escalera de escalamiento — niveles 0-3, ya
anticipaba model-routing en nivel 2), `../GENERAL AGENTES/02-CAPACIDADES` §4 (prefijo 27,151
medido, cap semanal, modelo). Métrica del cap: `../AGENTE AGENDA/05-REFERENCIA-TECNICA` §8
(budget ponderado por costo). Herramientas: `scripts/measure-agent-prefix.ts` (prefijo exacto) ·
`scripts/agent-cost-benchmark.ts` + [`benchmarks/`](benchmarks/README.md) (calidad + USD).*
