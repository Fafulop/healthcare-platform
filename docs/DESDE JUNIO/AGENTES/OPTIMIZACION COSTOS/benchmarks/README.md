# 📏 La regla — benchmark de costo del agente

> Esta carpeta es el **instrumento de medición** del plan de optimización: corre el
> MISMO trabajo (las 65 evals) y produce un número comparable de **calidad + costo** por
> experimento, para poder decir *"build 1 bajó el costo 18% sin romper calidad"* con datos,
> no con fe. Es el paso 0 del [`../01-PLAN-experimentos.md`](../01-PLAN-experimentos.md):
> **medir antes de tocar cualquier palanca.**

## Cómo funciona (dos pasos, el caro se hace una vez)

El benchmark NO re-corre el loop. El paso caro (correr las evals contra Anthropic, ~65
preguntas reales) se hace **una vez por experimento**; el análisis/comparación es gratis y
re-ejecutable sobre el JSON que ya escribió el eval runner.

```powershell
# PASO 1 — correr las evals contra prod (read-only). Escribe agenda-evals-last-run.json
#          CON el desglose de tokens por caso. (desde apps/doctor)
$vars = railway variables --service "@healthcare/doctor" --json | ConvertFrom-Json
$env:ANTHROPIC_API_KEY = $vars.ANTHROPIC_API_KEY
$env:AUTH_SECRET       = $vars.AUTH_SECRET
railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts

# PASO 2 — priciar + registrar + comparar (sin credenciales, instantáneo)
npx tsx scripts/agent-cost-benchmark.ts --label baseline
```

El paso 2 imprime calidad + costo total + media/caso + **pregunta fría** (la que reescribió
el prefijo desde cero — el peor caso y el número que mueven TTL-1h y la poda), y el **Δ contra
la corrida anterior**.

## Qué mide (y qué NO)

- **Calidad:** `X/65 PASS · WARN · FAIL` (el X/Y autoritativo lo imprime el eval runner; el
  benchmark lo reconstruye del JSON). Un experimento que baja costo pero rompe evals **no sirve**.
- **Costo real** de la corrida: USD por caso desde el desglose de tokens
  (uncached/cacheRead/cacheWrite/output) × la tabla de precios de [`../00`](../00-ANALISIS-costos-y-hallazgos.md) §6.
- **Cross-check:** `budgetTokens × $3/1M` debe casar con el USD calculado a Sonnet estándar
  (valida que la aritmética de costo del `run-turn.ts` y la del benchmark concuerdan).
- **NO** mide un doctor real — corre sobre dr-prueba (mismo caveat que todo el análisis).
- **Proyección de otro modelo** (`--price haiku`) sobre los MISMOS tokens es **aproximación**:
  otro modelo produce otros conteos y otra caché. El número REAL sale corriendo ESE modelo
  (flip `AGENDA_AGENT_MODEL` y re-correr el paso 1).

## Los archivos

| Archivo | Qué es |
|---|---|
| `ledger.csv` | **append-only** — una fila por corrida (timestamp, label, precio, git, calidad, USD, budget). Es la serie histórica: aquí se ve la tendencia build-a-build. |
| `<timestamp>-<label>.json` | El record completo de una corrida (agregados + USD por caso). |

`ledger.csv` y los records se **commitean** — son la evidencia del progreso. Se generan; no se
editan a mano.

## Flujo por experimento

1. Corre el paso 1+2 con `--label baseline` **antes de tocar nada** → fija la línea base.
2. Aplica UNA palanca del `01` (p.ej. TTL 1h en `anthropic.ts`).
3. Corre el paso 1+2 con `--label ttl-1h` → el Δ te dice si mejoró y cuánto.
4. Anota el veredicto en [`../02-BITACORA-experimentos.md`](../02-BITACORA-experimentos.md)
   (prosa: qué se tocó, veredicto, notas). El ledger es el número; la bitácora es la historia.

## Herramientas

- **Eval runner** (mide): `apps/doctor/scripts/agenda-agent-evals.ts` — guarda `usage` por caso.
- **Benchmark** (precia + registra + compara): `apps/doctor/scripts/agent-cost-benchmark.ts`.

*Flags del benchmark: `--label <txt>` · `--price <clave>` (default `AGENDA_AGENT_MODEL`) ·
`--ttl <5m|1h>` (informativo) · `--in <archivo.json>`.*
