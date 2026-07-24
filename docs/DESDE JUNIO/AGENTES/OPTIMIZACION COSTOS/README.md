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

## 🔄 HANDOFF — estado al 2026-07-24 (3ª sesión)

**En una frase:** el **COSTO de Haiku está probado (−50%+)** y la pregunta de calidad **cambió de
forma**: con el runner que ahora RE-CORRE cada caso no-PASS, **ni Haiku ni Sonnet tienen UN solo
fallo ESTABLE** sobre la config de la rama — todo lo que falla pasa al re-correrlo (es ruido de la
suite, medido en los DOS modelos). Lo que queda es una decisión de RIESGO del usuario, no una
medición pendiente. Todo vive en la rama **`agent/haiku-viability`** (2 commits + cambios sin
commitear de esta sesión), **sin mergear, sin desplegar**.

> # 🛑 SI LLEGAS EN FRÍO, LEE ESTO ANTES QUE NADA
>
> Esta caja resume lo que de verdad se sabe al 2026-07-24:
>
> | | Estado |
> |---|---|
> | Costo de Haiku (−50% corrida, −59% fría, ~$8.9/mes al cap) | ✅ **Sólido.** Conteos de tokens, no juicio del modelo. |
> | Varianza de SONNET (la pregunta #1 del handoff anterior) | ✅ **MEDIDA.** Sonnet también flakea (su WARN histórico `vencida-cancel-warning` pasó al re-correrlo). El ruido es de la SUITE, no de un modelo. |
> | Fallos ESTABLES de Haiku (fallan siempre, aun re-corridos) | ✅ **CERO** en 2 corridas completas de la config con fixes (60/65 y 62/65 al 1er intento; los 8 no-PASS pasaron todos al re-correr). |
> | Diferencia real Haiku vs Sonnet | ⚠️ Haiku flakea MÁS al 1er intento (5 y 3 casos vs 1 de Sonnet). No es un fallo de capacidad estable; es más varianza por-respuesta. |
> | El miss real conocido (`plan-eliminar-antes-de-crear`) | ✅ **ARREGLADO** (descripción de tool que invitaba a pre-empatar el veredicto del servidor): PASA 2/2 con delete→create completo. |
>
> ### El instrumento cambió (leer antes de comparar con corridas viejas)
>
> `agenda-agent-evals.ts` ahora **re-corre automáticamente cada caso no-PASS hasta 2 veces**
> (`EVALS_RETRIES`, 0 = comportamiento viejo) y separa **estable** (falla siempre = señal) de
> **flaky** (pasa al re-correr = ruido). El número `X/65` sigue siendo el 1er intento (comparable
> con el ledger histórico y es lo que precia el benchmark); el exit code ahora gatea sobre FAILs
> **estables**. Esto implementa la lección de VARIANZA ("una corrida no distingue regresión de
> ruido") en el runner, en vez de depender de que alguien se acuerde.
>
> ### Trampa documental de esta carpeta
>
> Las entradas de [`02-BITACORA`](02-BITACORA-experimentos.md) están en orden cronológico inverso y
> algunas viejas **afirman cosas que después se desmintieron** (se conservan a propósito: la
> convención del repo es anotar la corrección, no borrar el error). **Lee las entradas de
> 2026-07-24 y VARIANZA antes de citar números de las anteriores.**

### Lo que SHIPPEÓ a `main` (4 commits, desplegados)

| Commit | Qué |
|---|---|
| `f68ccb78` | **Cap: diario 500k → SEMANAL 2M** (~$45 → ~$26/mes peor caso). Único cambio de runtime. |
| `322ec5e2` | Correcciones del benchmark (trampa de tablas de precio distintas, FAIL→WARN, `NEXTAUTH_SECRET`) |
| `0ed55f1b` | **Baseline medida** + hallazgos + auditoría anti-vacío |
| `a3146927` | **Prefijo medido exacto** (`measure-agent-prefix.ts`) + blancos de poda |

### Lo que está EN RAMA, medido, sin mergear (`agent/haiku-viability`)

Commiteado (`f914813a`):
- `anthropic.ts`: `thinking` **por modelo** (Haiku `enabled`+`budget_tokens`; Sonnet intacto).
- `dates.ts` + `run-turn.ts`: calendario de 14 días **resuelto server-side** (bloque volátil).

Sin commitear (sesión 2026-07-24):
- `agenda-agent-evals.ts`: **reintentos automáticos** de casos no-PASS (estable vs flaky — ver la
  caja 🛑) + regex de `create-sin-hueco` ensanchado (flaggeaba una respuesta correcta).
- `proposals.ts` + `modules/agenda.ts`: **fix del miss real** — la descripción de
  `propose_delete_range` decía "serán RECHAZADOS al ejecutar" y Haiku (literal) se detenía sin
  proponer; ahora dice explícito "propón igual con la advertencia, el veredicto es del servidor"
  y la prosa del domain model quedó alineada (regla 0 aplicada al lenguaje de las tools).
- `anthropic.ts`: `THINKING_BUDGET_TOKENS` 2048 → **4096** (la forma de fallo del 58/65 era
  "pregunta en vez de actuar" en planes multi-paso; +4.5% de budget, sigue −50% vs Sonnet).
- Gates ✅ · type-check apps/doctor ✅ (2026-07-24).
- 🔖 Tag de rollback: **`agent-sonnet-known-good-2026-07-23`** (runtime verificado
  byte-idéntico al de la baseline `63/65`).
- 🟢 **Mergear NO compromete el modelo:** el request de Sonnet quedó byte-idéntico y la tabla de
  fechas le sirve igual; el modelo sigue siendo un flip de env var.

### Los números vigentes (2026-07-24, config de la rama CON fixes, mismo prompt en ambos)

| | Sonnet 5 (control, prompt de la rama) | **Haiku 4.5 + thinking 4096 (rama)** |
|---|---|---|
| Calidad 1er intento | `64/65 · 1W · 0F` (n=1; histórico 63–64) | `60/65 · 4W · 1F` y `62/65 · 3W · 0F` (n=2; histórico 58–64) |
| **Fallos ESTABLES (re-corridos)** | **0** (su único WARN pasó al re-correr) | **0 en ambas corridas** (los 8 no-PASS pasaron todos) |
| Flaky por corrida | 1 | 5 y 3 — flakea más, pero nada estable |
| Pregunta fría | $0.0835 | **$0.0345** (−59%) |
| Corrida completa (65) | $1.538 | **$0.719 / $0.710** (−53%) |
| Latencia p50 | 10.4 s | 9.8 / 9.0 s |
| Prefijo estático | 27,151 tok | 22,141 tok (otro tokenizer) |
| Techo al cap 2M/sem | $17/mes (intro) · $26 (estándar) | **~$8.9/mes** |

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

**A) ⭐ DECIDIR el merge/rollout — ya es decisión de RIESGO del usuario, no medición pendiente**
- La varianza ya se caracterizó (caja 🛑): **cero fallos estables en ambos modelos**; Haiku solo
  flakea más al 1er intento (una respuesta subóptima ocasional, no una conducta equivocada
  estable). Contexto de riesgo: dr-prueba (no hay doctores reales), cap semanal acotado,
  rollback = flip de env var, y el 2026-09-01 Sonnet sube +50% de precio.
- ⚠️ **Al poner `AGENDA_AGENT_MODEL` en Railway, fijar `FORM_BUILDER_CHAT_MODEL=claude-sonnet-5`
  en la MISMA pasada** — `form-builder-chat` hereda esa var (`route.ts:30-33`) y tiene **0
  cobertura** en la suite. Y verificar el `commitHash` por servicio: un push puede saltarse el
  auto-deploy de UNO.
- Alternativa de menor riesgo: mergear solo la parte server-side (tabla de fechas + branch de
  thinking + fixes de tools/runner) **sin** cambiar el modelo default. Mejora a Sonnet igual
  (64/65 con el prompt de la rama), deja Haiku listo para un flip posterior.

**B) 🆕 Carga DIFERIDA de tools (lever 2d)** — el mayor ahorro que queda, y quizá TAMBIÉN calidad.
Las tools son el **55% del prefijo** en 39 definiciones y un turno real usa **0–3**.
✅ **Verificado 2026-07-24 (docs oficiales): tool search corre en Haiku 4.5** (regex y bm25, GA,
sin beta header), los schemas diferidos se APENDIZAN sin invalidar el caché, y Anthropic documenta
que la precisión de selección de tools **se degrada pasando 30–50 tools** — tenemos 39, así que
diferir puede MEJORAR a Haiku, no solo abaratarlo. Reglas duras: el tool de búsqueda no puede
llevar `defer_loading`; ≥1 tool sin diferir; un tool diferido no puede llevar `cache_control`.
⚠️ Sigue pendiente medir el viaje extra por turno. Detalle en [`01-PLAN`](01-PLAN-experimentos.md) §2d.

**C) Podar el prefijo** (lever 2b) — blancos medidos: **facturas 8,706** (~3× presupuesto),
**agenda 7,255** (~2.4×), compartido 4,616; tool más pesada `propose_create_cfdi` (1,276).
Hoy queda por detrás de (B): menos ahorro y ediciones permanentes de prompt/tools en la ruta
legal del CFDI. El blueprint §5.3 dice que un módulo sobre presupuesto = señal de que **sus
veredictos no están suficientemente server-side** ⇒ mirar arquitectura antes que prosa.

**D) ~~El WARN que queda~~ — ✅ ARREGLADO 2026-07-24.** `plan-eliminar-antes-de-crear`: la causa
era la DESCRIPCIÓN de `propose_delete_range` ("serán RECHAZADOS al ejecutar") que invitaba a un
modelo literal a detenerse en vez de proponer con advertencia. Corregida (+ prosa del domain model
alineada): PASA 2/2 con la secuencia delete→create completa.

**E) Parar aquí.** Nada está roto y la medición no caduca.

### Lo que sigue sin saberse (bloquea decisiones, no lo inventes)
1. **Uso de un doctor REAL** — hueco #1. Decide si TTL-1h sirve y si 2M/semana es el número
   correcto. Sin eso, TTL-1h es una apuesta (depende de ≥2 preguntas frías/hora).
2. **Precios oficiales** Moonshot/DeepSeek (los de la tabla son de agregadores).
3. ~~Si tool search corre en Haiku 4.5~~ — ✅ **CONTESTADO 2026-07-24: SÍ** (docs oficiales de
   tool search, tabla de compatibilidad de modelos — regex y bm25, GA). Ver (B).
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
