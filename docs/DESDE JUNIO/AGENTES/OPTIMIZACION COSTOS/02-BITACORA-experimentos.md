# 🧾 Bitácora de experimentos de costo

> Una fila por experimento corrido. Baseline arriba. Se llena al ejecutar el plan de `01`.
> Método: suite de 65 evals + medición de costo read-only vs prod (A4 / thinking-share).
>
> 📏 **El número comparable ya es automático.** El benchmark ([`benchmarks/`](benchmarks/README.md))
> corre las evals, precia cada corrida y escribe una fila en `benchmarks/ledger.csv` con
> calidad + USD + Δ vs la corrida anterior. **Esta bitácora es la PROSA** (qué se tocó,
> veredicto, notas); el ledger es la serie numérica. Cada experimento: corre el benchmark →
> pega el resumen aquí abajo.

## Baseline (2026-07-23, Sonnet 5)

| | |
|---|---|
| Modelo | `claude-sonnet-5` (sin `thinking`, sin `effort` → adaptive por default) |
| Prefijo estático | ~24.7k tokens (39 tools) |
| Suite evals | **63/65 PASS · 2 WARN · 0 FAIL** |
| Input/turno p50 | 39,706 tok · output p50 515 tok |
| Output como % del costo | 18.7% |
| Cap | 500k budget/día ≈ $1.50/día ≈ $45/mes peor caso |
| Caché | manual, TTL 5 min |
| Costo real medido | $18.16 (Jul 3–23, dr-prueba, precio estándar sin descuento caché) |

## Experimentos

### 2026-07-23 — BASELINE medida (Sonnet 5, TTL 5m, git f68ccb78) ⭐ la marca de referencia
- Cambio: ninguno — primera corrida real del benchmark. Es contra ESTA fila que se comparan
  todos los experimentos siguientes.
- Evals: **63/65 PASS · 2 WARN · 0 FAIL** (WARNs soft por datos vivos: `reschedule-noop`,
  `vencida-cancel-warning` — misma banda que el histórico).
- Costo (precio intro $2/$10): **$1.436 la corrida completa** · media **$0.022/pregunta** ·
  p50 $0.020 · p90 $0.035. Budget total 717,880 (≈$2.15 a estándar $3/M).
- Latencia p50: 9.5 s/turno.
- 🔑 **HALLAZGO — la pregunta FRÍA cuesta 4.1× la tibia, y casi todo es escribir caché:**
  fría = **41,331 budget ($0.083)** vs tibia p50 = 10,059 ($0.020). Desglose exacto de los
  41,331: `uncached 4 + cacheWrite 35,156 + cacheRead 2,726 + output 3,445`.
  ⚠️ **Precisión (corregido en review):** ese **85% es el WRITE TOTAL de caché**, NO solo el
  prefijo. De los 28,125 tokens escritos, ~24,700 son el prefijo estático y **~3,425 son writes
  de la capa MENSAJES** (los 2 breakpoints móviles). Entonces:
  **prefijo ≈ 75% del costo frío · writes de mensajes ≈ 10% · output ≈ 8%.**
  El 99% del input de una pregunta tibia se sirve de caché.
  → **Consecuencia para el plan:** podar el prefijo (lever 2b) ataca el **75%** (no el 85% —
  los writes de mensajes no se podan tensando descripciones de tools). Cada token cortado del
  prefijo se ahorra ×1.25 en CADA pregunta fría. Sigue siendo la palanca con mejor relación
  esfuerzo/beneficio *medida*, pero el techo del ahorro es 75%, no 85%.
- Capacidad al cap semanal 2M: **~198 preguntas tibias/sem** o **~48 frías/sem (~7/día)**.
  El techo de gasto al cap: **$17.4/mes** (intro) · **$26.1/mes** (estándar).
- ⚠️ **Caveats de fidelidad (leer antes de comparar):**
  1. **La corrida salió con `AUTH_SECRET` vacío** — la cabecera del runner decía
     `$vars.AUTH_SECRET` pero en Railway el secreto es **`NEXTAUTH_SECRET`**. Los 2 casos de
     catálogo SAT corrieron sin token. Re-corridos con el secreto correcto: **2/2 PASS** (la
     calidad no cambia) pero cuestan más → la baseline **subestima el costo ~1.4%**
     ($1.436 → $1.456 corregida). No se re-corrió la suite entera por 1.4%. Cabecera ya
     corregida en `agenda-agent-evals.ts` y en `benchmarks/README.md`.
  2. Todo es **dr-prueba** con la suite corriendo en continuo (99% cache-hit). Un doctor real
     pregunta esporádicamente → paga más veces el precio FRÍO. La media de $0.022 es el número
     TIBIO; el que manda para un doctor real está más cerca de $0.083.
  3. **El "cross-check" budget↔USD es una TAUTOLOGÍA a precio Sonnet-intro, no una validación
     independiente.** `budgetTokens` se define con pesos (1 · 0.1 · 1.25 · 5) que son
     exactamente los ratios del precio intro ($2 · $0.2 · $2.5 · $10 ÷ $2) → USD = budget ×
     $2/M por construcción (717,880 × $2/M = $1.43576 vs $1.43575 reportado). Sirve para probar
     que el benchmark NO tiene error de aritmética, pero no confirma el precio real. El valor
     añadido del benchmark está en (a) el desglose por caso frío/tibio y (b) preciar OTROS
     modelos, donde los ratios difieren y el número deja de ser derivable del budget.
  4. La "pregunta fría" medida es el caso 1 (`vencidas-flag-server-side`, 1 tool). Una pregunta
     fría con más iteraciones cuesta MÁS → $0.083 es piso del costo frío, no techo.
- ✅ **Auditoría anti-vacío del 63/65 (2ª pasada de review):** se verificó que los PASS no fueran
  triviales. Los **3 evals de inyección** tienen sus fixtures VIVAS y el agente rechazó los 3
  payloads como dato (explícito en `inj-descripcion-banco`); los **16 casos sin tool calls** son
  negativos/frontera donde declinar sin tocar datos ES lo correcto; **0 errores de tool**. Los 2
  WARN son fixtures driftados con conducta REAL correcta (detalle en
  `../AGENTE AGENDA/SESSION-REFRESCO`, corrida 2026-07-23). **El 63/65 es real, no vacío.**
- Veredicto: baseline VÁLIDA (con los 4 caveats). Ledger: `benchmarks/ledger.csv`.

### 2026-07-23 — Lever 1: cap DIARIO 500k → SEMANAL 2M (business dial, no toca el modelo)
- Cambio: `route.ts` pasa a `AGENDA_AGENT_WEEKLY_TOKEN_CAP` (default 2M) y agrega
  `budget_tokens` sobre la semana MX (lun–dom, corte lunes 00:00 MX) vía nuevo
  `mxWeekStartKey()` en `dates.ts`. Widget "Uso de hoy" → "Uso de la semana"
  (`AgentContext.tsx` + `AgendaAgentPanel.tsx`). El var viejo diario ya no se lee.
- Por qué primero (no TTL-1h): ataca la EXPOSICIÓN que motivó la carpeta (cap = suscripción
  completa), es la decisión ya tomada del usuario, y NO depende del timing de doctor real
  (que no tenemos). TTL-1h se descartó como primer paso: su beneficio es una apuesta a ≥2
  preguntas frías/hora que el rig (dr-prueba, 92–99% cached) no puede validar, y write ×2
  obligaría a re-ponderar `budgetTokens` (×1.25→×2) para no descontar mal el costo.
- Evals: N/A (no toca prompt/tools/modelo — el loop es byte-idéntico). type-check + gates OK.
- Smoke read-only vs prod (regla dura): shape semanal ejecuta, dr-prueba 312,567/sem = 15.6%
  del cap 2M; semana ≥ día confirmado; ningún doctor cerca del cap (solo dr-prueba usa el agente).
- Costo: peor caso baja de 500k/día ($45/mes) → 2M/sem (~$26/mes) a precio estándar. El número
  2M es punto de partida (plan `01`); se afina con datos de doctores reales.
- Veredicto: SHIPPED (pendiente push+OK). Reversible (env var + un query). Nivel 1 de la escalera
  `00-BLUEPRINT §5.3` ("subir/re-formar el cap — es un número").
- Notas: benchmark de costo (`benchmarks/`) NO mide este cambio — es exposición, no eficiencia
  por-pregunta. La baseline de calidad+USD sigue pendiente de correr (primer comando de la
  próxima sesión con `railway run`).

### Plantilla

```
### <fecha> — <experimento> (<modelo/config>)
- Cambio: <qué se tocó>
- Evals: <X/65 · WARN · FAIL> (vs baseline 63/65)
- Costo por pregunta: fría <$> / templada <$>
- Tools: <llamó bien / thrashing / inventó / respetó propuesta→card>
- Latencia: <s/turno>
- $/doctor/mes proyectado: <$> al cap <valor>
- Veredicto: <sigue / descarta / necesita más>
- Notas:
```

---

*Cuando un experimento cambie el modelo o el cap en prod, el estado vigente va en
`../GENERAL AGENTES/02-CAPACIDADES` §4 (modelo/cap) y este doc queda como el registro.*
