# 🔬 ANÁLISIS — ¿conviene ESPECIALIZAR el agente por área (citas, facturas…)? (2026-08-01)

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día. **No sale trabajo pendiente de aquí**
> salvo los tres items del §6, que ya estaban documentados en otro lado.
>
> **La decisión, en una línea: NO se parte por ahora** — pero por razones distintas a las de
> [`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md), y con tres palancas más
> baratas sin ejercer.
>
> **Conteos citados = foto del 2026-08-01.** Los vigentes viven SOLO en
> [`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4.

---

## 1. La pregunta

> *«Tenemos dos flujos paralelos de LLM: los viejos especializados por pantalla (widget AZUL:
> pacientes, recetas, ventas…) y el agente general nuevo (widget VERDE, 39 tools). ¿Conviene
> partir el agente nuevo y especializarlo por área — sobre todo citas — para que sea más barato
> y más preciso? Desde que bajamos a Haiku se siente menos estable, y necesitamos Haiku por
> costo o no es negocio.»*

**No es la misma pregunta que [`09`](09-ANALISIS-recortar-superficie-del-agente.md).** Aquella
era *quitar tools de lectura*; ésta es *acotar el SCOPE por pantalla*. Se tocan en §7.1 de aquella
(«exprésalo como scope»), pero el eje es distinto.

**Aclaración del usuario que corrige una lectura previa:** los flujos AZULES **funcionan y
cumplen su propósito**. El único que no funciona bien es el de citas/appointments. No son un
ejemplo de arquitectura fallida.

---

## 2. ⚠️ La trampa de medición (lo más útil de este doc)

**Medir el prompt componiéndolo a mano da un número que NO existe en producción.**

Se corrió `buildSystemPrompt(scope)` + `JSON.stringify(scope.tools)` para comparar scopes:

| Scope | Tools | ~tok (medido así) |
|---|---|---|
| COMPLETO | 39 | 17,254 |
| solo agenda | 18 | 8,021 (−54%) |

**Ese −54% es falso.** Los esquemas de las tools **viajan diferidos** (`run-turn.ts` los marca
`defer_loading` detrás de `tool_search_tool_regex`): solo ~4 tools calientes cargan de entrada,
el resto se apendiza al descubrirse **sin invalidar el caché**. Sumar los 39 esquemas cuenta
~13k tokens de JSON que **nunca entran al prefijo cacheado**.

El número real medido del prefijo es **27,151 tokens** (2026-07-23, `00-BLUEPRINT` §5.1), y es
casi todo **prosa**, no esquemas. Por eso [`09`](09-ANALISIS-recortar-superficie-del-agente.md)
§4 concluye que de un corte candidato de 3,844 tok, **2,281 son esquemas que ya no se cargan** —
el ahorro real es ~1.5k, y solo si además se corta la prosa.

> 🔑 **Regla para la próxima medición:** el peso de un scope se mide por su **PROSA**, no por sus
> tools. Un scope con la mitad de las tools **no** tiene la mitad del prefijo.

---

## 3. Qué dice la evidencia sobre la premisa "Haiku es menos estable"

Medido en [`../OPTIMIZACION COSTOS/02-BITACORA`](../OPTIMIZACION%20COSTOS/02-BITACORA-experimentos.md)
(2026-07-23):

- **Cero fallos ESTABLES en ninguna corrida**, ni en Haiku ni en Sonnet. Los 8 no-PASS de Haiku
  y el 1 de Sonnet **pasaron todos al re-correr**.
- La diferencia real **no es capacidad, es TASA DE FLAKE al 1er intento** (5 y 3 vs 1). Para el
  doctor: una respuesta subóptima ocasional, no una conducta equivocada consistente.
- La misma config de Haiku dio **64, 63 y 58** en tres corridas. **El ruido de la suite
  (58–64) es más ancho que la diferencia Haiku↔Sonnet que se quería medir.**
- 🚧 **Y el hueco que sigue abierto: NUNCA se midió la varianza de SONNET.** Sin eso no se
  distingue «la suite es ruidosa para cualquier modelo» de «Haiku es específicamente inestable».
  Cuesta **~$4.3** contestarlo y es la pregunta #1 de esa carpeta.

**Consecuencia:** la sensación de inestabilidad es real como percepción, pero **no está
atribuida a Haiku por ninguna medición**. Partir el agente para arreglarla sería tratar un
síntoma cuya causa no se ha aislado.

---

## 4. Y la premisa de costo SÍ se sostiene (aquí el usuario tiene razón)

El doctor paga **$37–50 USD/mes por toda la app**. Lo que restringe no es el promedio sino el
**techo de exposición** al cap semanal de 2M:

| Modelo | Techo al cap | Contra la suscripción |
|---|---|---|
| Sonnet 5 | ~$45/mes/doctor | **La suscripción COMPLETA** |
| Haiku 4.5 | **~$8.9/mes/doctor** | ~20% |

⚠️ **No confundir con el uso real.** Consulta a prod 2026-08-01: **254 turnos en 30 días, UN
doctor** (171 Sonnet + 83 Haiku), ≈$20 en total. Eso mide un doctor de prueba apenas usándolo —
**no dice nada de la economía con doctores reales**. El número que manda es el techo.

---

## 5. Dónde cae la propuesta en la escalera

Está escrita literal en [`00-BLUEPRINT`](00-BLUEPRINT-asistente-modular.md) §5.3, **Nivel 3,
primer bullet**:

> *Subsets de módulos por superficie (el panel en /facturacion monta facturas+agenda; el de
> /appointments monta todo): reduce prefijo por página pero crea N cachés y N comportamientos —
> el doctor pierde «un solo asistente que sabe todo».*

**Nivel 3 = último recurso**, y la señal para subir de nivel no es intuición: (a) evals
cross-dominio fallando, (b) p50 de budget/turno subiendo >20% tras un módulo, o (c) el cap
quedando corto para uso real. **Ninguna ha disparado** (última medición A4, 2026-07-23:
nivel 0).

La ruta de migración, si algún día disparan, ya está documentada y es **no destructiva**:
[`../AGENTE FACTURAS/05-ANALISIS`](../AGENTE%20FACTURAS/05-ANALISIS-arquitectura-especializado-vs-modulo.md)
§4 — los módulos son autocontenidos (1 archivo + 1 entrada en `AGENT_MODULES`), así que extraer
uno a su propio loop reusa tools y prompt tal cual. **Elegir no partir hoy no cierra la puerta.**

---

## 6. Lo que SÍ está abierto y es más barato (los tres, ya documentados)

| # | Palanca | Nivel | Dónde está escrito |
|---|---|---|---|
| 1 | **La prosa del módulo `agenda` pesa 7,255 tok — 2.4× su presupuesto de 2-3k** (facturas 8,706, ~3×). Por la regla del propio blueprint, eso significa que **sus veredictos no están suficientemente server-side** y merece «mirada de ARQUITECTURA, no solo tijera de prosa» | 1 | `00-BLUEPRINT` §5.3 · blancos en `../OPTIMIZACION COSTOS/01-PLAN` §2b |
| 2 | **TTL de caché a 1 hora** (write ×2 en vez de ×1.25). El doc dice explícitamente: *«probarlo ANTES que cualquier cambio estructural»* | 1 | `00-BLUEPRINT` §5.3 |
| 3 | **Medir la varianza de SONNET (~$4.3)** — sin eso la premisa «Haiku desestabilizó» no es verificable | — | `../OPTIMIZACION COSTOS/02-BITACORA` |

**El #1 es el que apunta directo a citas**, que es el área que preocupa al usuario.

---

## 7. Dato nuevo que los docs anteriores no podían tener

**`agent_tool_calls` empezó a registrar el 2026-07-31** (tabla con 2 filas al 2026-08-01).

[`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md) §5.4 y §6 dicen que la decisión
no se podía tomar porque **no había registro de qué usan los doctores** (`llm_token_usage` guarda
solo conteos, ningún texto). Esa telemetría **ya existe** y su primer disparador de
reconsideración está parcialmente satisfecho.

> ⚠️ **No sacar conclusiones de esa tabla todavía.** En esta sesión se leyó «2 tools distintas
> usadas» y por poco se concluye que el agente solo usa 2 de 39 — cuando lo que pasa es que **la
> tabla tiene un día de vida**. Con 2–3 semanas de uso real contesta de verdad qué tools se usan
> y si hay confusión de dominio.

---

## 8. Recomendación

**No partir todavía.** En orden:

1. Podar la prosa de `agenda` moviendo veredictos server-side (§6 #1) — ataca el área que
   preocupa, es Nivel 1 y ya estaba identificado.
2. Probar TTL 1h (§6 #2) — un parámetro, antes de cualquier cambio estructural.
3. Gastar los ~$4.3 en la varianza de Sonnet (§6 #3) — decide si Haiku es siquiera el problema.
4. Dejar que `agent_tool_calls` acumule 2–3 semanas (§7).

Si después de eso dispara alguna de las tres señales de §5.3, **entonces** Nivel 3, por la ruta
no destructiva de `05-ANALISIS` §4.

---

*Relacionado: [`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md) (la pregunta hermana:
quitar tools) · [`00-BLUEPRINT`](00-BLUEPRINT-asistente-modular.md) §5 (la escalera y sus señales) ·
[`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4 (conteos vigentes) ·
[`../AGENTE FACTURAS/05-ANALISIS`](../AGENTE%20FACTURAS/05-ANALISIS-arquitectura-especializado-vs-modulo.md)
(especializado vs módulo, con la ruta de migración) ·
[`../OPTIMIZACION COSTOS/`](../OPTIMIZACION%20COSTOS/README.md) (costos y la bitácora de Haiku).*
