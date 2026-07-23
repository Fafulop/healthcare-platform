# 📁 AGENTE KNOWLEDGE LAYER — índice

> La **tercera capacidad** del asistente, junto a datos (tools de lectura) y acciones
> (propuestas): que el agente **sepa cómo funciona el sistema** para guiar al doctor.
> Esta carpeta refina el plan original de
> [`../GENERAL AGENTES/04-PLAN-capa-de-conocimiento.md`](../GENERAL%20AGENTES/04-PLAN-capa-de-conocimiento.md)
> con el inventario REAL del código, la reformulación desde primeros principios, la
> investigación de industria, y la frontera conocimiento↔tools. Creada 2026-07-14.

## Estado (2026-07-14) — la parte de AGENTE está HECHA

**El PR de appointments SHIPPED y fue validado en vivo en prod** (`a9e57907` + `5ac3d4ca`):
un guardarraíl en `RESILIENCE` + 3 evals `kl-*`. Resultó **mucho más chico de lo esperado**
porque el diagnóstico (`04`) mostró que el agente ya era experto en concepto/flujo y que el
destino al cual rutear ya existía.

> ⚠️ **Clave para no re-hacer trabajo:** el guardarraíl vive en una sección **COMPARTIDA** del
> prompt → es **GLOBAL, ya aplica a todas las secciones en prod**. No hay trabajo de agente
> pendiente para "extenderlo" a otros dominios. Lo único que varía por sección es si EXISTE la
> guía destino en `/dashboard/ayuda` — eso es **trabajo de UI/contenido, no de prompt**
> (`05` §8): expedientes ya está · **Pagos: `PagosGuide` está construida (1,492 líneas) pero
> NO enganchada** — solo hay que habilitar la pestaña · Perfil/Práctica: falta autorar.

## Las dos decisiones que gobiernan todo

1. **Estado → TOOLS. Cómo-funciona → CONOCIMIENTO.** Nunca responder una pregunta de estado
   con prosa. Es la misma frontera que la industria identificó como el guardarraíl #1 (`02`).
2. **Híbrido dividido por TIPO, route-first:** el agente **HABLA** la capa de concepto/flujo
   (ya vive en el prompt, es barata y de alto valor) y **RUTEA** los pasos de UI a la guía
   determinista (son volátiles, de alta alucinación y bajo valor de hablar). **El agente NO
   lee el contenido de las guías** — la fuente-única compartida se DESCARTÓ por riesgo de
   alucinación por volumen (`05` §6.1).

## Los docs (leer en orden)

| Doc | Qué es |
|---|---|
| [`00-OVERVIEW-donde-estamos.md`](00-OVERVIEW-donde-estamos.md) | **Empieza aquí.** El inventario REAL (K1): hay **CUATRO** superficies de conocimiento disjuntas, no una — y el plan viejo subestimaba el punto de partida. Incluye contenido ya construido y muerto para cosechar |
| [`01-QUE-NECESITAMOS-principios.md`](01-QUE-NECESITAMOS-principios.md) | Desde primeros principios: UN punto de contacto, y "experto" partido en **2 dimensiones** — conocimiento (TODAS las secciones) vs tools (solo algunas). Regla de default: toda sección arranca solo-conocimiento; las tools se ganan |
| [`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) | **La preocupación #1 y la decisión más importante.** Los 3 casos borrosos, los 5 mecanismos apilados que sostienen la frontera, y las clases de eval que la hacen cumplir |
| [`03-INVESTIGACION-y-enfoque.md`](03-INVESTIGACION-y-enfoque.md) | Qué hacen Agentforce/Copilot/Fin, dónde divergimos (RAG) y por qué está bien, y la doctrina que vale robar: **"control vs comportamiento"** = nuestra regla 0 enunciada como principio |
| [`04-DIAGNOSTICO-appointments.md`](04-DIAGNOSTICO-appointments.md) | La **evidencia**: 12 sondas al agente vivo → 9 ya bien, la frontera estado→tools se sostuvo perfecta, y el único hueco fue navegación de UI (inconsistente: a veces declinaba, una vez improvisó un click-path) |
| [`05-PLAN-appointments-PR.md`](05-PLAN-appointments-PR.md) | El PR que cerró el hueco. Diseño + la regla exacta + evals + **§9 cómo quedó y su validación en vivo**. Sin corpus, sin tool nueva |

*Todos son snapshots del 2026-07-14 y describen trabajo ya cerrado; se mantienen como el
razonamiento detrás de las dos decisiones de arriba. Si la capa se retoma (K2-K4), el estado
nuevo va en un `SESSION-REFRESCO.md` de esta carpeta.*

## Dónde vive lo demás

- **El mapa de todos los agentes:** [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md)
- **El plan original de esta capa (NO-RAG, secuencia K1-K4):** [`../GENERAL AGENTES/04-PLAN-capa-de-conocimiento.md`](../GENERAL%20AGENTES/04-PLAN-capa-de-conocimiento.md)
- **El código:** `apps/doctor/src/lib/agenda-agent/prompt.ts` (`RESILIENCE`) ·
  `scripts/agenda-agent-evals.ts` (casos `kl-*`) · `app/dashboard/ayuda/` (las guías destino)

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md) · Convenciones de estos
docs: [`../GENERAL AGENTES/07-CONVENCIONES-docs.md`](../GENERAL%20AGENTES/07-CONVENCIONES-docs.md).*
