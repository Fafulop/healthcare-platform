# 🧠 AGENTE KNOWLEDGE LAYER — dónde estamos (inventario real)

> 🔒 **SNAPSHOT — 2026-07-14.** No se actualiza. Es el resultado del paso **K1 (inventario)**:
> el hallazgo de que NO hay un sistema de ayuda sino **cuatro superficies disjuntas**. Sigue
> siendo válido como mapa del punto de partida; el estado de la capa está en
> [`README.md`](README.md).

> **Qué es este doc.** El mapa de la CAPA DE CONOCIMIENTO del asistente: qué existe HOY en el
> código (no lo que dicen los planes), qué está vivo/muerto/desactualizado, y cómo se relaciona
> con las otras carpetas de `AGENTES/`. Es el resultado del paso **K1 (inventario y verificación
> de fuentes)** hecho leyendo el código el 2026-07-14. La verdad es el código; este doc es el
> mapa. Los otros 3 docs de esta carpeta cubren principios (01), la frontera conocimiento↔tools
> (02, la preocupación #1) y la investigación + enfoque (03).

---

## 1. El punto de partida honesto: NO hay UN sistema de ayuda, hay CUATRO

El plan viejo (`../GENERAL AGENTES/04-PLAN-capa-de-conocimiento.md`) describe bien la META pero
subestima el PUNTO DE PARTIDA. Al leer el código aparecen **cuatro superficies de conocimiento,
en tres formatos distintos, cubriendo temas DISJUNTOS**:

| Superficie | Qué es | Formato | Estado |
|---|---|---|---|
| **Tool `get_guia`** | 3 temas: `facturacion`, `pagos`, `sat_descarga` | Strings planos ~700 tokens hardcodeados en `facturas.ts:839-877` | Vivo, validado en F1.5 |
| **`/dashboard/ayuda`** | Ayuda por flujos: Citas, Expedientes | React rico (acordeones, workflow steps, íconos) — 1,141 + 678 líneas | Vivo, en el sidebar |
| **Pestañas "Guía" dentro de dashboards** | Guías fiscales dentro de `/facturacion`, `/sat-descarga`, `/pagos` | JSX inline (el `GuiaTab` de facturación son ~260 líneas, `page.tsx:2627-2885`) | Vivo — es a DONDE apunta `get_guia` |
| **RAG de ChatWidget v1** | `llm-assistant/`: embeddings + `search_chunks` (pgvector) | Corpus markdown en `docs/llm-assistant/` + `CAPABILITY_MAP` (642 líneas TS) | Corpus tocado por última vez **2026-02-19** (5 meses viejo) |

## 2. Los tres hallazgos que cambian el plan

1. **Hoy hay CERO solapamiento entre `get_guia` y la UI a la que "apunta".** `get_guia` cubre los
   3 temas fiscales y dirige a las pestañas Guía DENTRO de los dashboards. `/dashboard/ayuda`
   cubre Citas + Expedientes. No comparten ningún tema. Entonces "fuente única, dos consumidores"
   del plan 04 no está unificando una duplicación existente — está construyendo la capa compartida
   por primera vez.

2. **La "fuente única" es más difícil de lo que suena, porque los dos consumidores quieren FORMAS
   distintas.** Las guías de UI son JSX rico (acordeones, badges de color, tablas, pasos con
   íconos) — 1,000+ líneas cada una, NO prosa. `get_guia` quiere un resumen plano de ~700 tokens.
   Un solo archivo markdown no puede renderizar ambos. La pregunta real de diseño es QUÉ es la
   fuente canónica: un objeto de datos estructurado lo bastante rico para renderizar la guía
   visual Y producir el resumen del agente, vs. co-locar un "resumen para el asistente" plano
   junto a cada guía JSX hecha a mano. → se decide en `03`.

3. **Hay contenido ya construido, muerto, para cosechar.** `PagosGuide.tsx` existe (¡1,492 líneas!)
   pero **NO está enganchado** en la página de ayuda (solo se renderizan Citas + Expedientes; las
   pestañas Perfil y Práctica están `disabled: true`). Y `CAPABILITY_MAP` (642 líneas de
   estados/acciones/reglas por entidad) es buena materia prima que el plan viejo ya marcó para
   rescatar.

## 3. Aclaración: RAG está DESCARTADO — no re-litigar

El pipeline RAG (`llm-assistant/`, embeddings, `retrieveChunks`) existe SOLO para el ChatWidget v1
(el chat viejo, NO el AGENTE modular que construimos). Se **retira** con el ChatWidget v1 (era el
paso K4). Cuando este folder menciona RAG es para BORRARLO, nunca para usarlo. La razón:
corpus chico (~12 temas) donde retrieval es puro overhead — detalle y respaldo de industria en
`03`.

## 4. Cómo se relaciona con las otras carpetas de `AGENTES/`

- **`GENERAL AGENTES/00-BLUEPRINT`** — la estrategia global (UN asistente, módulos de dominio, la
  escalera de escalamiento). La capa de conocimiento es la **tercera capacidad** junto a datos
  (lecturas F1) y acciones (propuestas F2).
- **`GENERAL AGENTES/02-CAPACIDADES-matriz`** — la matriz de datos/acciones por módulo. Esta capa
  le agrega la dimensión de CONOCIMIENTO. Cuando se construya, esa matriz se amplía.
- **`GENERAL AGENTES/04-PLAN-capa-de-conocimiento`** — el plan ORIGINAL de esta capa. Este folder
  lo REFINA con (a) el inventario real de código y (b) la reformulación desde primeros principios
  (ver `01`). El 04 sigue válido para la secuencia K1-K4 y la decisión NO-RAG.
- **`AGENTE AGENDA` / `FACTURAS` / `FLUJOS` / `EXPEDIENTE`** — docs de tools por dominio. La capa
  de conocimiento agrega la dimensión "cómo funciona / cómo navegar" a cada dominio. **Empezamos
  por AGENDA (appointments)** porque es el dominio con tools más desarrolladas.

## 5. Estado y siguiente paso

- **K1 (inventario):** ✅ hecho aquí (2026-07-14). Falta la sub-tarea de verificar FRESCURA de las
  pestañas Guía in-dashboard y de `PagosGuide` contra el código antes de canonizar nada (el review
  de F1.5 ya cazó 2 errores factuales en `get_guia` así — el contenido que AFIRMA HECHOS siempre
  lleva review contra código).
- **Decisión de arquitectura: ✅ RESUELTA** (2026-07-14) — híbrido dividido por TIPO: el agente
  HABLA la capa concepto/flujo, RUTEA a la guía determinista los pasos de UI (`03` §5). Validada
  empíricamente por el diagnóstico de appointments (`04`).
- **Diagnóstico de appointments:** ✅ hecho (`04`) — 9/12 ya bien, la frontera estado→tools se
  sostuvo, el único hueco es navegación de UI (a veces improvisa). El destino "rutear" (CitasGuide)
  YA existe.
- **PR de appointments: ✅ SHIPPED + VALIDADO EN VIVO EN PROD** (2026-07-14, `a9e57907`+`5ac3d4ca`)
  — guardarraíl en `RESILIENCE` + 3 evals `kl-*`, suite 48/49 PASS · 0 FAIL; validado en prod por
  el usuario (concepto se habla, UI-nav se rutea sin improvisar). Detalle en
  [`05-PLAN-appointments-PR.md`](05-PLAN-appointments-PR.md) §9. Sin corpus, sin tool nueva, sin
  que el agente LEA guías (route-first — la fuente-única quedó parqueada por riesgo de alucinación,
  `05` §6.1).
- **Siguiente:** el guardarraíl es GLOBAL (RESILIENCE) → el ruteo YA aplica a todas las secciones
  en prod (expedientes incluido) SIN trabajo de agente; lo único que varía por sección es si existe
  la guía destino en `/dashboard/ayuda` (trabajo de UI, no de prompt — detalle en `05` §8:
  expedientes=listo · Pagos=enganchar `PagosGuide` · Perfil/Práctica=autorar). **O** facturas PR
  F2 (el siguiente original del blueprint). Ninguno bloquea al otro.
- **Preocupación #1 (cómo sabe el agente cuándo usar conocimiento vs tools):** ver `02`. El
  diagnóstico confirmó que la frontera ya se sostiene en appointments.

---

*Relacionado: [`01-QUE-NECESITAMOS-principios.md`](01-QUE-NECESITAMOS-principios.md) ·
[`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) ·
[`03-INVESTIGACION-y-enfoque.md`](03-INVESTIGACION-y-enfoque.md) ·
[`../GENERAL AGENTES/04-PLAN-capa-de-conocimiento.md`](../GENERAL%20AGENTES/04-PLAN-capa-de-conocimiento.md)
(plan original). Creado 2026-07-14.*
