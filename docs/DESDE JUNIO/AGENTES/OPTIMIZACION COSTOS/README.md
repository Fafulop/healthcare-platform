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

El costo del agente es **~99% INPUT** (el loop re-manda el prefijo de ~24.7k tokens + tools +
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

## Estado (2026-07-23)

**ANÁLISIS HECHO, NADA CONSTRUIDO.** Los números están medidos (A4 + thinking-share, ambos
2026-07-23, read-only vs prod). Siguiente: correr los experimentos del `01` (empezar por el cap
semanal + TTL 1h, que son baratos y no tocan el modelo). Handoff a sesión nueva por límite de
contexto.

*Índice general: [`../README.md`](../README.md).*
