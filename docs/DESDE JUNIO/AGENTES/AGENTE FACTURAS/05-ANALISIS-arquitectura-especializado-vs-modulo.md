# ⚖️ Análisis — ¿agente especializado de facturas o módulo del asistente único?

> **Qué es este doc.** El usuario re-abrió (2026-07-15) la decisión de arquitectura ANTES de
> construir F2, con requisitos NUEVOS que el veredicto original (`00` §1, 2026-07-08) no
> contemplaba explícitamente: un agente EXPERTO en facturas que recomiende claves de catálogo
> SAT, entienda conceptos mixtos (consulta + insumos + quirófano), detecte pacientes con factura
> pendiente, y emita vía Facturama con aprobación del doctor. Este doc compara las dos
> arquitecturas con costos, riesgos y rutas de migración — y termina con una recomendación.
> La decisión es del usuario. Escrito contra el código real 2026-07-15.

---

## 1. Los requisitos nuevos, y qué necesita cada uno técnicamente

| # | Requisito (del usuario) | Qué lo implementa (independiente de la arquitectura) |
|---|---|---|
| R1 | Recomendar claves del catálogo SAT según el concepto ("consulta" → 85121502, "insumos" → 42xxxxxx) | **Tool de lectura sobre el catálogo real**: `searchProductCodes()/searchUnitCodes()` YA existen (`apps/api/src/lib/facturama.ts:472-480`, ruta `facturacion/catalogos/[tipo]` con auth + fallback offline). El modelo recomienda entre resultados REALES del SAT — grounded, nunca inventa claves. + conocimiento curado de los defaults médicos (tabla en `06-KNOWLEDGE-BASE` §5). |
| R2 | Entender conceptos mixtos en una factura (honorarios + insumos + quirófano) | Conocimiento de dominio (prompt del módulo: qué clave y qué tratamiento de IVA lleva cada tipo de concepto) + R1 para las claves + builder de impuestos server-side POR CONCEPTO (los flags withIva/withIsrRetention ya son por-item en la UI). |
| R3 | Ver qué pacientes necesitan factura y si su expediente está completo | Ya existe en gran parte: `get_patient_profile` → `listoParaFacturar`/`camposFaltantes` (veredicto server-side), `get_billing_status` → ¿facturada?, ledger → `hasFactura`. Falta UN tool compuesto de barrido ("ingresos sin factura de pacientes con requiereFactura"). |
| R4 | Emitir vía Facturama con aprobación del doctor | El PR F2 ya diseñado: `propose_create_cfdi` sobre la maquinaria propuesta→card→confirmación→executor (precedente exacto: `complete_booking` arma el payload completo server-side al proponer). |
| R5 | Conocimiento legal (reglas de facturación en México) | Capa de conocimiento: reglas duras EN CÓDIGO (el POST ya valida Público en General; ISR por régimen), conocimiento hablable en prompt/get_guia (PUE/PPD, D01 inválido para receptor RESICO, IVA exento Art. 15-XIV, REP). Fuente consolidada: `06-KNOWLEDGE-BASE`. |

**Observación central:** los 5 requisitos se implementan con **tools + conocimiento + pre-checks
server-side** — ninguno requiere, por sí mismo, un loop/agente separado. La pregunta de
arquitectura es entonces de *empaque*: ¿dónde viven esos tools y ese conocimiento?

## 2. Opción A — UN asistente, módulo facturas enriquecido

Extender `modules/facturas.ts`: +2 tools de lectura (catálogo SAT, barrido de pendientes),
+1-2 propuestas (create_cfdi, luego send_fiscal_form), + sección de conocimiento del dominio
en el prompt del módulo, + temas get_guia.

**Costos medidos (no estimados):**
- Prefijo: ~21.2k → ~24-25k tokens (+2-3k del módulo enriquecido). Dentro del presupuesto;
  la señal de nivel 2 del blueprint es >35-40k.
- Tools: 35 → ~39-40. Los modelos manejan 40-60 tools bien descritas; A4 (2026-07-14) re-midió
  y NINGUNA señal de escalamiento disparó (p50 +11.6% < 20%; peor día 40.7% del cap).
- Riesgo de confusión de dominio: mitigado con descripciones + desempates (ya probado:
  get_cfdis vs get_sat_cfdis, facturé-vs-ingresé) + evals cross-dominio (5 hoy, +2-3 por regla).

**Fortalezas:**
1. **Los flujos objetivo son cross-dominio POR NATURALEZA.** "Factúrale la consulta de hoy a
   García" = agenda (cita) + expediente (RFC) + facturas (emisión) EN EL MISMO TURNO (`00` §5).
   Un solo contexto lo resuelve nativo; dos agentes tendrían que serializar contexto.
2. Reusa TODO lo validado: loop, caching, tiers, executor, evals (49), telemetría, budget.
3. Es el patrón de industria: Agentforce = UN agente con **Topics** (dominios especializados
   con fronteras) — nuestros módulos son exactamente eso (`AGENTE KNOWLEDGE LAYER/03` §1).
4. Un solo punto de contacto (principio raíz de `AGENTE KNOWLEDGE LAYER/01` §1).

**Debilidades honestas:**
- El prefijo crece para TODOS los turnos, incluidos los que no tocan facturas (mitigado por
  caché; el costo real es el write frío ~×1.25).
- La "sensación de especialista" depende de prompt/knowledge, no viene gratis del empaque.
- Si facturas creciera mucho (10+ tools más), empuja hacia los límites del blueprint §5.3.

## 3. Opción B — agente especializado de facturas (dos botones en el chat)

Un segundo loop con su propio prompt (solo facturas, más profundo), sus tools, y un switch de
UI (botones "Agenda" / "Facturas" arriba del panel).

**Fortalezas honestas:**
- Prompt de facturas SIN el peso de los otros 4 dominios → puede ser más profundo por token.
- Cero riesgo de confusión inter-dominio DENTRO de cada agente.
- Identidad clara para el doctor ("estoy hablando con el experto en facturas").

**Costos y riesgos:**
1. **El problema de coordinación es el trabajo duro y no tiene solución barata.** "Factúrale
   la cita de hoy" en el agente-facturas necesita leer agenda: o duplicas tools de agenda en
   ambos (dos fuentes que mantener, dos comportamientos que evaluar), o construyes paso de
   mensajes A2A (serializar contexto entre loops: latencia, costo, pérdida de datos — lo que
   `00` §1 rechazó). El usuario mismo lo identificó: "we have to solve how they talk to each other".
2. **El doctor elige el agente equivocado.** "¿Cuánto me deben?" ¿es agenda, facturas o flujo?
   (la pregunta xdom real de la suite). Con dos botones, esa ambigüedad se vuelve UX del doctor
   en vez de routing del modelo — y el modelo YA la resuelve bien (evals xdom en verde).
3. **Dos de todo:** dos prefijos de caché (dos writes fríos), dos suites de evals, dos secciones
   RESILIENCE que mantener sincronizadas (el guardarraíl de UI-nav, anti-injection, E7…), dos
   presupuestos. La superficie de regresión ~se duplica.
4. Contradice el principio "un punto de contacto" YA decidido y validado con el panel persistente.
5. Los números NO lo piden: ninguna señal §5.3 disparada (A4).

**Cuándo SÍ ganaría la opción B** (los triggers honestos, del blueprint §5.3 nivel 3):
- Evals cross-dominio fallando persistentemente pese a nivel 1-2.
- Prefijo >35-40k con confusión de dominio real.
- Un dominio con requisitos de AISLAMIENTO genuino (tier de privacidad/logging/modelo distinto)
  — el caso clínico, no el fiscal.
- Workflows autónomos por lote (barrido nocturno que redacta 30 facturas) — y eso sería un JOB
  server-side reutilizando los mismos builders, no un chat agent.

## 4. El punto medio que captura lo mejor de B sin sus costos

- **UX de especialista sin split:** botón/chip "Facturas" en el panel que abre EL MISMO agente
  (opcionalmente pre-sembrando un mensaje o sugerencias de facturas). Un cerebro, dos puertas.
  Cero coordinación. (Y componible con screen-context — PR aparte ya identificado.)
- **Profundidad de conocimiento sin engordar el prefijo:** el conocimiento fiscal extenso va
  en `get_guia` (on-demand, ~700 tokens solo al preguntar) y las claves de catálogo van en el
  tool grounded (R1). El prompt del módulo solo lleva los invariantes cortos.
- **Migración no-destructiva:** los módulos son autocontenidos (1 archivo + 1 entrada en
  `AGENT_MODULES`). Si algún día los triggers de §3 disparan, extraer el módulo facturas a un
  loop propio reusa sus tools/prompt tal cual — elegir A hoy NO cierra la puerta a B mañana.
  Lo inverso (empezar en B y fusionar) sí tira trabajo (la coordinación construida).

## 5. Recomendación

**Opción A — un asistente, módulo facturas enriquecido**, con el punto medio de §4 (chip de
UI si se quiere la afordancia, conocimiento on-demand vía get_guia, catálogo grounded). Es la
única opción cuyos costos están medidos y en verde, resuelve los flujos cross-dominio nativos,
y mantiene abierta la ruta de migración a B si la evidencia cambia.

La secuencia concreta (✅ APROBADA por el usuario 2026-07-15), respetando el orden del playbook
(lectura ANTES de propuestas — los errores de lectura son texto; los de propuesta ejecutan):

1. **PR F2a — el experto (solo lectura + conocimiento):** `search_catalogo_sat` (R1, grounded) +
   `get_pendientes_factura` (R3, barrido hasFactura×requiereFactura) + conocimiento del dominio
   en prompt/get_guia (R2/R5, fuente: `06-KNOWLEDGE-BASE`). Valor inmediato ("¿a quién le falta
   factura?", "¿qué clave uso para insumos?") con riesgo mínimo.
2. **PR F2b — la emisión:** `propose_create_cfdi` + builder de impuestos server-side + card
   tier-máximo. Se construye sobre F2a ya validado en vivo.

Ambos con el playbook de siempre (permutaciones → evals con negativos → smoke vs prod →
validación en vivo con dr-prueba, que YA puede timbrar en sandbox).

---

*Relacionado: [`00-FACTIBILIDAD-Y-ARQUITECTURA.md`](00-FACTIBILIDAD-Y-ARQUITECTURA.md) (veredicto
original + flujo E2E §5), [`06-KNOWLEDGE-BASE-facturacion.md`](06-KNOWLEDGE-BASE-facturacion.md)
(el conocimiento consolidado), `../GENERAL AGENTES/00-BLUEPRINT` §5.3 (la escalera y sus señales),
`../AGENTE KNOWLEDGE LAYER/03` (patrón de industria). Creado 2026-07-15.*
