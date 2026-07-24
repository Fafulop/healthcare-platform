# 💸 OPTIMIZACIÓN DE COSTOS — el agente tiene que caber dentro de la suscripción

> **Por qué existe esta carpeta.** El doctor paga **$37–50 USD/mes** por TODA la app. El costo
> del LLM del asistente es UN renglón dentro de eso (junto a hosting, Stripe, SAT, WhatsApp,
> soporte, margen). Hoy el cap del agente es **500k budget/día ≈ $1.50/día ≈ $45/mes en el peor
> caso = la suscripción COMPLETA de un doctor**. Esta carpeta es el análisis + el plan de
> experimentos para bajar eso a un % cómodo de los $37–50.
>
> 🔄 **Sesión nueva: lee este README, luego [`00-ANALISIS-costos-y-hallazgos.md`](00-ANALISIS-costos-y-hallazgos.md).**
> Convenciones de docs: [`../GENERAL AGENTES/08-EMPIEZA-AQUI.md`](../GENERAL%20AGENTES/08-EMPIEZA-AQUI.md).

## El problema en una frase

El costo del agente es **~99% INPUT** (el loop re-manda el prefijo de **27.2k tokens medidos** + tools +
historial, hasta 8 iteraciones por turno). El OUTPUT/thinking NO es la palanca (medido: 18.7%
del costo, output p50 = 515 tokens). Bajar costo = bajar cuánto input se re-manda y a qué precio.

## Las 3 palancas (se apilan)

1. **Acotar la exposición** (dial de negocio, HOY): cambiar el cap. Decisión del usuario:
   **pasar de cap DIARIO 500k a cap SEMANAL ~2000k** (hay días sin uso; la ventana semanal
   los promedia). Es un cambio de CÓDIGO — plan en `01`.
2. **Bajar el costo por pregunta**: TTL de caché 1h · podar el prefijo · menos iteraciones ·
   **modelo más barato** (Haiku, o cambiar de proveedor).
3. **Producto** (fuera del alcance técnico, anotado): ¿el agente es del plan base o un tier/
   add-on? Es la palanca más grande y no es de tokens.

## Los experimentos (detalle en `01`)

Probar el mismo trabajo con **varios modelos y proveedores**, midiendo calidad (suite de 65
evals) + costo por pregunta:

- **Anthropic**: Sonnet 5 (baseline), **Haiku 4.5** (~3× más barato input).
- **DeepSeek** V4 Flash (~15–20× más barato input; caché ~98% off).
- **Kimi** (Moonshot) K2.6 (~3–5× más barato; fuerte en agentic/tools).

> ✅ **Compliance: DECIDIDO NO ES ISSUE (usuario, 2026-07-23).** Mandar metadatos de paciente a
> DeepSeek/Moonshot (empresas chinas) se evaluó y el usuario lo aprobó. No re-litigar sin motivo
> nuevo. (Contexto que se consideró: LFPDPPP, datos de salud — memoria `project_legal_compliance`.)

## Docs de esta carpeta

| Doc | Qué es | Tipo |
|---|---|---|
| [`00-ANALISIS-costos-y-hallazgos.md`](00-ANALISIS-costos-y-hallazgos.md) | **La medición**: a dónde va el dinero (read-only vs prod), la tabla de precios de todos los proveedores, el hallazgo de que thinking NO es la palanca | vivo |
| [`01-PLAN-experimentos.md`](01-PLAN-experimentos.md) | El cap semanal (diseño), los levers de eficiencia, y la MATRIZ de modelos: qué probar, cómo, con qué métrica | vivo |
| [`02-BITACORA-experimentos.md`](02-BITACORA-experimentos.md) | Log de resultados — se llena al correr cada experimento | vivo |
| [`benchmarks/`](benchmarks/README.md) | **La regla**: el rig que corre las 65 evals, precia cada corrida (calidad + USD) y registra el Δ build-a-build en `ledger.csv` | vivo |

## 🔄 HANDOFF — estado al 2026-07-23 (2ª sesión)

**En una frase:** el **COSTO de Haiku 4.5 está probado (−52%, sólido)**; su **CALIDAD NO está
establecida** — tres corridas completas de la MISMA config dieron **64, 63 y 58 de 65**, y ningún
fallo individual se reprodujo al re-correrlo. Todo vive en la rama **`agent/haiku-viability`**,
**sin commitear, sin mergear, sin desplegar**.

> # 🛑 SI LLEGAS EN FRÍO, LEE ESTO ANTES QUE NADA
>
> **El experimento NO está cerrado, aunque partes de estos docs suenen concluyentes.** Esta caja
> resume lo que de verdad se sabe al 2026-07-23:
>
> | | Estado |
> |---|---|
> | Costo de Haiku (−52% corrida, −58% fría, ~$8.70/mes al cap) | ✅ **Sólido.** Sale de conteos de tokens, no de juicio del modelo. |
> | "Haiku ≥ Sonnet en calidad" | ⚠️ **NO probado.** Se afirmó comparando **UNA corrida contra UNA corrida**. |
> | Estabilidad de la suite | ❌ **Sin caracterizar.** Misma config: 64, 63, 58. |
> | Fallos concretos de Haiku | ✅ **Ninguno reproducible.** Todo lo re-corrido pasó. |
>
> ### El error metodológico que hay que entender antes de tocar nada
>
> La baseline de Sonnet (`63/65`) es **UNA sola corrida**. La primera de Haiku fue **UNA sola
> corrida** (`64/65`). De ahí se concluyó "Haiku le gana a Sonnet". Después la MISMA config de
> Haiku dio `58/65`. O sea: **la diferencia que se declaró ganadora (63 vs 64) es más chica que
> el ruido que la propia suite produce (58–64).** Esa conclusión no se sostiene con los datos que
> hay, y este doc ya no la afirma.
>
> ⚠️ **Nunca se midió la varianza de SONNET** — la baseline también podría oscilar. Sin eso no se
> puede decir si Haiku es *más inestable* o si la suite es ruidosa **para cualquier modelo**.
> **Esa es la pregunta abierta #1** y la que decide el rollout.
>
> ### Qué hacer con esto (lo más barato primero)
>
> 1. **Correr la suite completa en Haiku 2–3 veces más** (~$0.69 c/u) y anotar cada resultado.
>    Da la varianza real de Haiku en vez de una banda inventada.
> 2. **Correr la suite completa en SONNET 2–3 veces** (~$1.44 c/u) **con el mismo prompt de la
>    rama**. Es el control que falta: si Sonnet también oscila, el ruido es de la SUITE (datos
>    vivos de dr-prueba + modelo no determinista) y Haiku no es peor; si Sonnet queda plano en 63,
>    entonces Haiku SÍ es más inestable y eso pesa más que el ahorro.
> 3. Recién con (1) y (2) se decide el merge. **No repetir el error de concluir con n=1.**
>
> ### Trampa documental de esta carpeta
>
> Las entradas de [`02-BITACORA`](02-BITACORA-experimentos.md) están en orden cronológico y las
> primeras **afirman cosas que después se desmintieron** (se conservan a propósito: la convención
> del repo es anotar la corrección, no borrar el error). **Lee la entrada de VARIANZA antes de
> citar cualquier número de las entradas anteriores.**

### Lo que SHIPPEÓ a `main` (4 commits, desplegados)

| Commit | Qué |
|---|---|
| `f68ccb78` | **Cap: diario 500k → SEMANAL 2M** (~$45 → ~$26/mes peor caso). Único cambio de runtime. |
| `322ec5e2` | Correcciones del benchmark (trampa de tablas de precio distintas, FAIL→WARN, `NEXTAUTH_SECRET`) |
| `0ed55f1b` | **Baseline medida** + hallazgos + auditoría anti-vacío |
| `a3146927` | **Prefijo medido exacto** (`measure-agent-prefix.ts`) + blancos de poda |

### Lo que está EN RAMA, medido, sin mergear (`agent/haiku-viability`)

- `anthropic.ts`: `thinking` **por modelo** (Haiku `enabled`+`budget_tokens`; Sonnet intacto).
- `dates.ts` + `run-turn.ts`: calendario de 14 días **resuelto server-side** (bloque volátil).
- 🔖 Tag de rollback: **`agent-sonnet-known-good-2026-07-23`** (runtime verificado
  byte-idéntico al de la baseline `63/65`).
- 🟢 **Mergear NO compromete el modelo:** el request de Sonnet quedó byte-idéntico y la tabla de
  fechas le sirve igual; el modelo sigue siendo un flip de env var.

### Los números vigentes (todos medidos, no estimados)

| | Sonnet 5 (prod) | **Haiku 4.5 + thinking (rama)** |
|---|---|---|
| Calidad | `63/65 · 2W · 0F` — ⚠️ **n=1, varianza desconocida** | ⚠️ **NO CONCLUYENTE**: `64/1W/0F`, `63/0W/2F`, `58/5W/2F` (n=3). **Ningún fallo se reprodujo al re-correrlo solo.** |
| Pregunta fría | $0.083 | **$0.0345** (−58%) |
| Pregunta tibia p50 | $0.020 | **$0.0097** |
| Corrida completa (65) | $1.436 | **$0.688** (−52%) |
| Latencia p50 | 9.5 s | 9.0 s |
| Prefijo estático | 27,151 tok | 22,141 tok (otro tokenizer) |
| Techo al cap 2M/sem | $17/mes (intro) · $26 (estándar) | **~$8.70/mes** |

De una pregunta fría, **82% es escribir el prefijo** (por eso el lever 2d, abajo).

### Las 2 herramientas (así se mide cualquier experimento)

```powershell
# 1. Prefijo exacto (sin BD, sin costo de generación)
$vars = railway variables --service "@healthcare/doctor" --json | ConvertFrom-Json
$env:ANTHROPIC_API_KEY = $vars.ANTHROPIC_API_KEY
npx tsx scripts/measure-agent-prefix.ts

# 2. Calidad + USD (la corrida cuesta ~$1.44 y ~10 min)
$env:AUTH_SECRET = $vars.NEXTAUTH_SECRET     # ⚠️ en Railway es NEXTAUTH_SECRET
railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts
npx tsx scripts/agent-cost-benchmark.ts --label <experimento> --price claude-sonnet-5-intro
```
⚠️ **Compara SIEMPRE con `--price claude-sonnet-5-intro`** (la baseline se corrió así). Con otra
tabla de precios el Δ es un espejismo — el benchmark avisa, no ignores el aviso.

---

## 👉 QUÉ SIGUE

> **Nada de esto es urgente: HOY NO HAY DOCTORES REALES usando el agente.** Todo es dr-prueba y
> el cap ya acota el peor caso. Dicho eso, hay un reloj real: **el 2026-09-01 Sonnet 5 pasa de
> $2/$10 a $3/$15 (+50% automático)** — que es precisamente el riesgo que Haiku desactiva.

**A) ⭐ CARACTERIZAR LA VARIANZA — bloquea todo lo demás** (ver la caja 🛑 de arriba)
- **No se puede decidir el rollout con los datos actuales.** No porque falte criterio de riesgo,
  sino porque la comparación que sustentaba "Haiku gana" era `n=1` contra `n=1`, y después la
  misma config dio 58. Se necesitan 2–3 corridas de Haiku **y** 2–3 de Sonnet con el mismo prompt.
- Costo de cerrar la pregunta: ~$2 de Haiku + ~$4.3 de Sonnet ≈ **$6.30 y una hora**. Es barato
  comparado con desplegar a prod una conclusión que no se sostiene.
- Si Sonnet oscila igual ⇒ el ruido es de la suite, Haiku no es peor, **y entonces sí** la
  decisión pasa a ser de riesgo (dr-prueba, no doctores reales; cap acotado; rollback por env var).
- ⚠️ **Al poner `AGENDA_AGENT_MODEL` en Railway, fijar `FORM_BUILDER_CHAT_MODEL=claude-sonnet-5`
  en la MISMA pasada** — `form-builder-chat` hereda esa var (`route.ts:30-33`) y tiene **0
  cobertura** en la suite. Y verificar el `commitHash` por servicio: un push puede saltarse el
  auto-deploy de UNO.
- Alternativa de menor riesgo: mergear solo la parte server-side (tabla de fechas + branch de
  thinking) **sin** cambiar el modelo. Mejora a Sonnet, deja Haiku listo para un flip posterior.

**B) 🆕 Carga DIFERIDA de tools (lever 2d)** — probablemente el mayor ahorro que queda.
Las tools son el **55% del prefijo** en 39 definiciones y un turno real usa **0–3**. Podar (2b)
daba ~16% del costo frío; esto ataca una porción mucho mayor del mismo 55%.
⚠️ Mete un viaje extra por turno (y el presupuesto cobra input en cada iteración) y **está sin
verificar en Haiku**. Detalle y reglas duras en [`01-PLAN`](01-PLAN-experimentos.md) §2d.

**C) Podar el prefijo** (lever 2b) — blancos medidos: **facturas 8,706** (~3× presupuesto),
**agenda 7,255** (~2.4×), compartido 4,616; tool más pesada `propose_create_cfdi` (1,276).
Hoy queda por detrás de (B): menos ahorro y ediciones permanentes de prompt/tools en la ruta
legal del CFDI. El blueprint §5.3 dice que un módulo sobre presupuesto = señal de que **sus
veredictos no están suficientemente server-side** ⇒ mirar arquitectura antes que prosa.

**D) El WARN que queda** — `plan-eliminar-antes-de-crear`: Haiku avisa del conflicto pero no
emite las propuestas delete→create (Sonnet sí). Es `soft` y la conducta es la cautelosa, pero es
un miss real; se arregla con descripciones de tools, o sea **sale junto con (B) o (C)**.

**E) Parar aquí.** Nada está roto y la medición no caduca.

### Lo que sigue sin saberse (bloquea decisiones, no lo inventes)
1. **Uso de un doctor REAL** — hueco #1. Decide si TTL-1h sirve y si 2M/semana es el número
   correcto. Sin eso, TTL-1h es una apuesta (depende de ≥2 preguntas frías/hora).
2. **Precios oficiales** Moonshot/DeepSeek (los de la tabla son de agregadores).
3. 🆕 **Si tool search corre en Haiku 4.5** — no aparece en `capabilities` de `/v1/models` para
   ningún modelo, así que ese endpoint no lo contesta. Probar antes de planear sobre (B).
4. 🆕 **El techo de 200K de contexto de Haiku** (Sonnet: 1M) no se ha topado en evals, pero una
   sesión larga real es otra cosa. Haiku sí soporta `clear_tool_uses_20250919` si hiciera falta.

### Reglas duras al retomar (no re-litigar)
- Cualquier cambio de prompt/tools/modelo ⇒ **suite completa de 65** + benchmark con la MISMA
  `--price`. **Un ahorro que mueve el 63/65 no es un ahorro.**
- Los 2 WARN de la baseline son **fixtures driftados con conducta correcta**, no regresiones
  (`reschedule-noop`, `vencida-cancel-warning` — detalle en `../AGENTE AGENDA/SESSION-REFRESCO`).
- Lección del `02-BITACORA`: **no corrijas un número medido con uno estimado** (pasó con el 85%
  → "75%" → medido 82%).

*Índice general: [`../README.md`](../README.md).*
