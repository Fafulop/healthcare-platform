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
| Prefijo estático | **27,151 tok MEDIDO** (system 12,126 + 39 tools 15,025) |
| Suite evals | **63/65 PASS · 2 WARN · 0 FAIL** |
| **Costo/pregunta** | **tibia $0.020 (p50) · fría $0.083** (precio intro $2/$10) |
| **Costo/corrida (65)** | **$1.436** · 717,880 budget · latencia p50 9.5 s |
| Input/turno p50 | 39,706 tok · output p50 515 tok |
| Output como % del costo | 18.7% |
| Cap | **semanal 2M budget ≈ $17/mes (intro) · $26/mes (estándar)** — era diario 500k |
| Caché | manual, TTL 5 min |
| Costo real medido | $18.16 (Jul 3–23, dr-prueba, precio estándar sin descuento caché) |

*Reproducir: `scripts/measure-agent-prefix.ts` (prefijo) · evals + `scripts/agent-cost-benchmark.ts
--label <x> --price claude-sonnet-5-intro` (calidad + USD). Ledger: [`benchmarks/`](benchmarks/README.md).*

## Experimentos

### 2026-07-23 — MEDICIÓN del prefijo con `count_tokens` (no es un experimento: es la regla del 2b)
- Herramienta nueva: `apps/doctor/scripts/measure-agent-prefix.ts` (no toca BD, no consume
  generación). Reproducible con solo `ANTHROPIC_API_KEY`.
- **Prefijo REAL = 27,151 tok** (system 12,126 · tools 15,025). ⚠️ Los docs decían "~24.7k, y el
  real es un poco MENOR": es **+10% MAYOR**. La estimación venía del piso de `prompt_tokens`;
  medir la desmintió en magnitud y en dirección.
- Consecuencia inmediata: el prefijo es el **82%** del costo de una pregunta fría (no 75%; ver la
  corrección en la entrada de la baseline). Escribirlo cuesta **33,939 budget ≈ $0.068** (intro) /
  **$0.102** (estándar) cada vez que un doctor pregunta en frío.
- 🎯 **Blancos de poda (lever 2b), medidos:**
  - **3 de 5 módulos exceden el presupuesto de ~2-3k** del blueprint §5.3: **facturas 8,706**
    (~3×), **agenda 7,255** (~2.4×), flujo 3,032 (apenas). fiscal (1,590) y expediente (1,598) ✅.
    El blueprint dice que un módulo sobre presupuesto = señal de que "sus veredictos no están
    suficientemente server-side" → hay dónde mirar, no solo texto que apretar.
  - Tools más pesadas: `propose_create_cfdi` **1,276** · `propose_prepare_factura_borrador` 969 ·
    `get_movimientos` 807 · `propose_create_booking` 716 · `propose_create_range` 618. El
    **top-10 concentra el 46%** de los 15,025 tok de tools.
  - Prompt COMPARTIDO + overhead = 4,970 (intro/resilience/reglas globales; el overhead fijo del
    bloque de tools es 354).
- Aritmética del ahorro: cortar 5,000 tok del prefijo (−18%) ahorra 6,250 budget por pregunta
  fría ≈ **$0.0125 (intro) / $0.019 (estándar)**, y baja el costo frío de $0.083 a ~$0.070.
- ✅ **Verificación de la medición (bug hunt):**
  1. **Validación CRUZADA e independiente:** `count_tokens` dice 27,151; el `cache_read` que
     reportó la API en la corrida de la baseline (otra fuente, otro día del pipeline) dice
     **27,257 — 0.39% de diferencia**, y el gap de 106 tok es exactamente la cola de mensajes de
     la iteración 1. Esto NO es tautológico (a diferencia del cross-check budget↔USD).
  2. **El desglose cuadra al token:** system 12,126 + tools 15,025 = 27,151; tools = 14,671
     (módulos) + 354 (overhead); módulos 22,181 + resto 4,970 = compartido 4,616 + overhead 354.
  3. **Supuesto del overhead constante — FALSIFICABLE y probado:** los pesos netos por tool
     salen de despejar `OH` con 2 ecuaciones, asumiendo que `OH` no depende de cuántas tools se
     manden. Se probó prediciendo el conteo de 2, 3 y 4 tools: **error 0 en los tres casos** ⇒
     los pesos por tool son exactos, no aproximados.
  - ⚠️ **Lo único aproximado:** el reparto prompt-por-módulo se mide con el texto del módulo EN
    AISLAMIENTO (`domainModel`+`domainRules`), que puede diferir en unos pocos tokens de su
    contribución dentro del prompt compuesto; el "compartido" (4,616) es un RESIDUO y absorbe
    ese error. El total (27,151) y el split system/tools NO dependen de esto.
- ⚠️ Nada podado todavía — esto es la MEDICIÓN. Cualquier poda vuelve a correr la suite completa
  (toca prompt/tools ⇒ riesgo de conducta) y se compara contra la baseline con la MISMA `--price`.

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
  **Desglose definitivo** (con el prefijo ya MEDIDO — ver la entrada de abajo, 27,151 tok):
  de los 28,125 tokens escritos a caché, **27,151 son el prefijo** y solo **974 son writes de la
  capa MENSAJES**. Entonces del costo de una pregunta fría:
  **prefijo 82.1% · writes de mensajes 2.9% · output 8.3% · lecturas de caché 6.6%.**
  El 99% del input de una pregunta tibia se sirve de caché.
  > 🔁 **Historial de esta cifra (dos correcciones, la 1ª mal):** se publicó "85% es el prefijo";
  > el 1er review lo "corrigió" a 75% razonando sobre la estimación de ~24.7k de los docs; al
  > MEDIR el prefijo resultó 27,151 → el número real es **82%**, o sea la 1ª cifra estaba más
  > cerca que su corrección. **Lección: no se corrige un número medido con otro estimado.**
  → **Consecuencia para el plan:** podar el prefijo (lever 2b) ataca el **82%** del costo frío.
  Cada token cortado se ahorra ×1.25 en CADA pregunta fría. Es la palanca con mejor relación
  esfuerzo/beneficio medida — y ahora con blancos concretos (abajo).
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
