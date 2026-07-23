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

## Estado (2026-07-23)

**ANÁLISIS HECHO · RIG CONSTRUIDO · LEVER 1 (CAP SEMANAL) SHIPPED · FALTA CORRER LA BASELINE.**
Los números están medidos (A4 + thinking-share, read-only vs prod). El **benchmark de costo ya
existe** ([`benchmarks/`](benchmarks/README.md)): el eval runner guarda el desglose de tokens por
caso y `scripts/agent-cost-benchmark.ts` lo precia y registra el Δ build-a-build.

**Lever 1 aplicado (2026-07-23):** el cap pasó de DIARIO 500k ($45/mes peor caso) a **SEMANAL 2M**
(~$26/mes) — la exposición que motivó la carpeta. Detalle + smoke read-only en
[`02-BITACORA`](02-BITACORA-experimentos.md). Se hizo ANTES que TTL-1h a propósito: TTL-1h es una
apuesta al timing de doctor real que el rig (dr-prueba) no puede validar y que obliga a re-ponderar
el costo (write ×2); el cap ataca la exposición directamente y no depende de datos que no tenemos.

**BASELINE MEDIDA (2026-07-23)** — `63/65 PASS · 0 FAIL` · **$1.436/corrida** · **$0.022/pregunta
tibia** · **$0.083/pregunta fría** (piso). 🔑 La pregunta fría cuesta **4.1×** la tibia, y
**el 82% de ella es escribir el prefijo** en caché.

**PREFIJO MEDIDO EXACTO: 27,151 tok** (system 12,126 · tools 15,025) con
`scripts/measure-agent-prefix.ts` — **+10% sobre la estimación de ~24.7k que citaban los docs**.
Y **3 de 5 módulos exceden** el presupuesto de ~2-3k del blueprint: **facturas 8,706 · agenda
7,255** · flujo 3,032. Ambas entradas, con los blancos de poda tool por tool, en
[`02-BITACORA`](02-BITACORA-experimentos.md).

**Siguiente:** **podar el prefijo (lever 2b)** — es la palanca con mejor relación esfuerzo/beneficio
*medida* (ataca el 82% del costo frío) y ahora tiene blancos concretos en vez de "hay grasa".
Cortar ~5k tok (−18%) baja la pregunta fría de $0.083 a ~$0.070. Toca prompt/tools ⇒ **exige
re-correr la suite completa** y comparar contra la baseline con la MISMA `--price`. TTL-1h (2a)
sigue esperando una señal de uso real.

*Índice general: [`../README.md`](../README.md).*
