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

## 🔄 HANDOFF — estado al 2026-07-23 (sesión cerrada aquí)

**En una frase:** el cap ya está acotado y **todo está MEDIDO** (calidad, costo por pregunta,
prefijo exacto); **no se ha podado ni cambiado el modelo todavía** — la próxima sesión elige
palanca con datos, no con intuición.

### Lo que SHIPPEÓ (4 commits, todos en `main` y desplegados)

| Commit | Qué |
|---|---|
| `f68ccb78` | **Cap: diario 500k → SEMANAL 2M** (~$45 → ~$26/mes peor caso). Único cambio de runtime. |
| `322ec5e2` | Correcciones del benchmark (trampa de tablas de precio distintas, FAIL→WARN, `NEXTAUTH_SECRET`) |
| `0ed55f1b` | **Baseline medida** + hallazgos + auditoría anti-vacío |
| `a3146927` | **Prefijo medido exacto** (`measure-agent-prefix.ts`) + blancos de poda |

### Los números vigentes (todos medidos, no estimados)

| | |
|---|---|
| Calidad baseline | **63/65 PASS · 2 WARN · 0 FAIL** (auditada: no es vacía) |
| Costo por pregunta | **tibia $0.020 · fría $0.083** (intro $2/$10) |
| Corrida completa (65) | $1.436 · latencia p50 9.5 s |
| Prefijo estático | **27,151 tok** (system 12,126 + tools 15,025) |
| De una pregunta fría | **82% es escribir el prefijo** |
| Cap vigente | semanal 2M ≈ **$17/mes** (intro) · **$26/mes** (estándar) |

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

## 👉 QUÉ SIGUE — 4 opciones, con la recomendación

> **Nada de esto es urgente: HOY NO HAY DOCTORES REALES usando el agente.** Todo es dr-prueba y
> el cap ya acota el peor caso. Optimizar ahora es optimizar una hipótesis. Dicho eso, hay un
> reloj real: **el 2026-09-01 Sonnet 5 pasa de $2/$10 a $3/$15 (+50% automático).**

**A) ⭐ RECOMENDADA — probar Haiku 4.5** (lever 3, secuencia del [`01-PLAN`](01-PLAN-experimentos.md))
- **Por qué primero:** es una MEDICIÓN, no un compromiso. **Cero código** (flip
  `AGENDA_AGENT_MODEL=claude-haiku-4-5`), reversible, y el input cuesta **3× menos**. Una corrida
  (~$1.44) dice si aguanta el 63/65 y **exactamente qué casos rompe**.
- **Hipótesis a registrar ANTES de correr** (para no racionalizar después): aguanta lecturas y
  casos frontera; lo más probable que se degrade son los flujos de escritura multi-paso
  (emisión CFDI, borrador compuesto) y los `inj-*`.
- **Si rompe donde se espera → routing** (Haiku lecturas / Sonnet escrituras), que el §8 de
  [`00-ANALISIS`](00-ANALISIS-costos-y-hallazgos.md) ya anticipa: *emisión de CFDI se queda en un
  modelo confiable pase lo que pase*.

**B) Podar el prefijo** (lever 2b) — blancos ya medidos: **facturas 8,706** (~3× presupuesto),
**agenda 7,255** (~2.4×), compartido 4,616; tool más pesada `propose_create_cfdi` (1,276).
Ahorro ~16% del costo frío ($0.083 → ~$0.070). **Contra:** ediciones permanentes de prompt/tools
(riesgo de conducta en la ruta legal de CFDI) para menos ahorro que (A). El blueprint §5.3 dice
que un módulo sobre presupuesto = señal de que **sus veredictos no están suficientemente
server-side** ⇒ mirar arquitectura antes que prosa.

**C) Parar aquí.** Nada está roto, el cap acota, la medición ya está hecha y no caduca.
Retomar cuando existan doctores reales.

**D) Fix del root de la over-declaración del member** (blueprint §5.2 punto 6): INTRO/RESILIENCE
compartidos hardcodean el set COMPLETO de capacidades — es la FUENTE del bug #24, hoy parchado
con un contra-nudge que "lo reduce, no lo elimina". Se difirió porque exige suite completa…
que (A) y (B) también exigen ⇒ **sale casi gratis si se hace junto con uno de ellos.** Arregla un
bug real; ahorro de tokens ~0 para el owner (sí para members).

### Lo que sigue sin saberse (bloquea decisiones, no lo inventes)
1. **Uso de un doctor REAL** — hueco #1. Es lo que decide si TTL-1h sirve y si 2M/semana es el
   número correcto. Sin eso, TTL-1h es una apuesta (su beneficio depende de ≥2 preguntas frías/hora).
2. **Precios oficiales** Moonshot/DeepSeek (los de la tabla son de agregadores).

### Reglas duras al retomar (no re-litigar)
- Cualquier cambio de prompt/tools/modelo ⇒ **suite completa de 65** + benchmark con la MISMA
  `--price`. **Un ahorro que mueve el 63/65 no es un ahorro.**
- Los 2 WARN de la baseline son **fixtures driftados con conducta correcta**, no regresiones
  (`reschedule-noop`, `vencida-cancel-warning` — detalle en `../AGENTE AGENDA/SESSION-REFRESCO`).
- Lección del `02-BITACORA`: **no corrijas un número medido con uno estimado** (pasó con el 85%
  → "75%" → medido 82%).

*Índice general: [`../README.md`](../README.md).*
