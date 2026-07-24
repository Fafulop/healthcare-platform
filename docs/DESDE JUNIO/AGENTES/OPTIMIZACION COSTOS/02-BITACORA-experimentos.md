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

### 2026-07-24 — 🎯 Roadmap #2 (1ª pasada): trigger "busca PRIMERO" en la regla de claves SAT

**El miss:** con tool search, `f2a-clave-insumos` fallaba el 1er intento en las 2 corridas — el
modelo contestaba la clave de MEMORIA (el default 42311500 que la propia regla le da) y OFRECÍA
buscar en vez de buscar. Leído con cuidado, cumplía la LETRA de la regla vieja ("si pide algo
genérico… ofrece el default"): el orden buscar-primero estaba implícito, y un modelo literal +
una tool DIFERIDA (su descripción no está en contexto) lo saltaba.

**Fix (FACTURAS_RULES, regla de claves):** trigger explícito — ante cualquier "¿qué clave uso
para X?" (fuera de consulta general/especializada): **BUSCA PRIMERO con search_catalogo_sat en
ESE turno, no contestes de memoria ni preguntes si quiere que busques** (buscar es autónomo y
gratis); el default 42311500 pasa a ser el fallback DESPUÉS de buscar sin match limpio. Mismo
patrón que el fix de `propose_delete_range`: la conducta se enseña con lenguaje de trigger
explícito donde el modelo lo LEE — y con tools diferidas ese lugar es el prompt/regla, no la
descripción de la tool (que no está en contexto hasta descubrirla).

**Verificación:** `f2a-clave-insumos` **4/4 al 1er intento** (3 corridas solo + suite completa),
buscando de inmediato. Suite completa: **61/65 · 4W · 0F al 1er intento · 4 flaky · 0 ESTABLES**
— 6ª corrida completa consecutiva del día sin fallos estables. Costo en banda ($1.56 preciado
Sonnet-intro ≈ $0.78 real Haiku; la fría de esta corrida salió alta porque el caso ancla cambió
— artefacto del orden, no regresión).

**Anotado para después:** `f2b-ya-facturada-no-reemite` flaqueó en dirección interesante (propuso
un CFDI en vez de reportar "ya facturada"; pasó al reintento). No se saltó ningún guardarraíl (el
ingreso que encontró no tenía factura y nada se ejecuta sin card), pero el fixture quedó DOBLEMENTE
driftado desde el timbre en vivo (folio 8) — necesita el ingreso de prueba re-sembrado que su
propio comentario ya pide. Es el mismo hueco del "camino feliz F2b/F2c data-blocked".

### 2026-07-24 — 🧹 Limpieza de fixtures flaky (roadmap #3): el ruido por DATOS quedó cerrado

**Diagnóstico (read-only, método TOOLING):** el ÚNICO nombre duplicado en todo dr-prueba era
"Gerardo Lopez" ×2 (mismo email; el 2º creado 2026-05-27 es el duplicado accidental documentado).
Era la raíz de los 3 casos más flaky: `f1-completitud-fiscal-server`, `f2b-ya-facturada-no-reemite`
y `f2b-ppd-solo-explicito` desviaban a "¿cuál de los dos?" (conducta CORRECTA de RESILIENCE sobre
datos rotos).

**Fixes (con OK del usuario para el write a prod):**
1. `UPDATE medical_records.patients SET first_name='Genaro' WHERE id='cmpnbah010005ro0lqss8i033'`
   (1 fila, dr-prueba, reversible). Las citas NO se tocaron — `bookings.patient_name` es
   denormalizado y varias citas viejas siguen diciendo "Gerardo Lopez" (anotado, no bloquea).
2. `f2b-ppd-solo-explicito`: la HISTORIA del caso empujaba búsqueda por nombre y citaba una cita
   ("test123") que ya no existe por id — se re-apuntó a la identidad real (fecha + ingreso #1570).
   El caso prueba PPD-sobre-ya-facturado; el nombre no era esencial.

**Verificación:** los 3 casos PASAN al 1er intento re-corridos solos. Corrida completa post-fix
(Haiku + tool search): `60/65 · 2W · 3F` al 1er intento, **5 flaky, 0 ESTABLES** — 5ª corrida
completa consecutiva del día con cero fallos estables. Los flakes restantes ya no son de datos:
son regex `soft` sensibles a redacción + varianza del modelo.
⚠️ **Patrón a vigilar (blanco del roadmap #2):** `f2a-clave-insumos` falló el 1er intento en las
DOS corridas con tool search — el modelo no siempre busca la tool DIFERIDA `search_catalogo_sat`.
Se arregla con descripciones/nota de búsqueda, no con datos.

### 2026-07-24 — 🔍 Lever 2d: carga DIFERIDA de tools (tool search) — pregunta FRÍA −43%, calidad en banda

**Cambio (rama de trabajo, sin commitear):** `tool_search_tool_regex_20251119` + `defer_loading:
true` en 35 de las 39 tools; quedan CARGADAS las 4 calientes (`get_day_schedule`, `get_bookings`,
`get_availability`, `find_patient`) + el tool de búsqueda. Flag de rollback:
**`AGENDA_AGENT_TOOL_SEARCH=0`** restaura el toolset completo (código y prompt). El loop ganó
manejo de `pause_turn` (el server-loop de búsqueda puede pausar) y los breakpoints de caché de
mensajes ya no caen en bloques `server_tool_use`/`tool_search_tool_result` (no aceptan
`cache_control`). Los schemas diferidos VIAJAN completos en cada request pero no entran al
contexto hasta que el modelo los descubre — se APENDIZAN sin invalidar el prefijo cacheado.

**El hallazgo de conducta que costó el primer smoke:** con las propose_* diferidas, el modelo no
VE que proponer es posible ⇒ describe y PREGUNTA en vez de actuar (`plan-eliminar` falló 3/3 —
**estable**, cazado por el runner con reintentos). Las descripciones de tools no pueden enseñar
conducta si no están en contexto. Fix: sección `TOOL_SEARCH_NOTE` en el prompt (solo se compone
con el flag activo): "tienes MÁS tools de las que ves; BUSCA antes de decir que no puedes o de
pedir permiso". Con la nota: smoke 3/3 y la corrida completa en banda.

**Números (misma metodología, precio `claude-sonnet-5-intro`, Haiku real = ÷2):**

| | Sin 2d (fix3 R2) | **Con 2d (r1)** |
|---|---|---|
| Calidad 1er intento | 62/65 · 3W · 0F | 61/65 · 2W · 2F |
| Estables (re-corridos) | 0 | **0 FAIL estables** · 1 WARN estable (`f2b-ppd`: dato de dr-prueba — homónimos "Gerardo Lopez", desambiguar ES la conducta de RESILIENCE; también flaqueó sin 2d) |
| Corrida completa (tibia) | $0.710 | $0.709 — **NEUTRO en tibio** (92–99% cached: el prefijo chico casi no ahorra y la búsqueda mete iteraciones) |
| **Pregunta FRÍA (budget)** | 34,347 ($0.0343) | **19,585 ($0.0196) — −43%** |
| Latencia p50 | 9.0 s | 10.6 s (+18%, el hop de búsqueda) |

**Lectura correcta:** la suite corre TIBIA y por eso el total no se mueve — el beneficio vive en
la pregunta FRÍA, que es lo que paga un doctor real (uso esporádico). Apilado con el cambio de
modelo: $0.083 (Sonnet prod) → **$0.0196** por pregunta fría ≈ **−76%**. El costo: +1.6 s de
latencia p50 y algo más de varianza al 1er intento en flujos de escritura (el modelo tiene que
decidir buscar; `plan-eliminar` pasó 1/3 aquí vs 2/2 sin 2d — con n=1 no es concluyente).
`f2a-clave-insumos` falló el 1er intento (no buscó el catálogo) y pasó al reintento.

- ⚠️ El prompt CAMBIÓ (nota nueva ⇒ sha `d2d329fa…`, 28,214 chars): al desplegar se invalida el
  caché UNA vez. gate:prompt/gates OK; type-check OK.
- ⚠️ La fila del ledger de esta corrida precia 64 casos (el caso ancla `vencidas` tuvo un `fetch
  failed` de red al 1er intento — pasó al reintento; el frío de arriba sale del smoke, mismas
  condiciones de caché que la medición sin 2d).
- Veredicto: **funciona y es shippeable** — 0 FAILs estables, calidad en banda (58–64), frío −43%,
  rollback por env var. La palanca que queda para la varianza de escrituras es el punto (2) del
  roadmap (mover reglas a descripciones/campos server-side) y afinar la nota.

### 2026-07-24 — 🎯 VARIANZA CONTESTADA + fixes de calidad: cero fallos ESTABLES en ambos modelos

**Qué se hizo (rama `agent/haiku-viability`, sin commitear):**
1. **El instrumento primero:** `agenda-agent-evals.ts` re-corre solo cada caso no-PASS (hasta 2
   veces, `EVALS_RETRIES`) y clasifica **estable** (falla siempre = señal) vs **flaky** (pasa al
   re-correr = ruido). El `X/65` canónico sigue siendo el 1er intento (ledger comparable; el costo
   de los reintentos NO se suma al preciado); el exit code gatea sobre FAILs estables.
2. **Fix del miss real** (`plan-eliminar-antes-de-crear`): la descripción de
   `propose_delete_range` decía *"esos serán RECHAZADOS al ejecutar"* — un modelo literal (Haiku)
   leía eso como "no propongas" y se detenía tras avisar. Ahora dice explícito: **propón igual,
   transmite la advertencia, el veredicto es del servidor y el doctor decide en la tarjeta** (+ el
   patrón reemplazo = eliminar→crear en el mismo turno). La prosa del domain model de agenda se
   alineó (decía "se RECHAZA" a secas — contradecía la tool tras el fix). Es regla 0 aplicada al
   LENGUAJE de las tools: no invitar al modelo a pre-empatar veredictos del servidor.
3. `THINKING_BUDGET_TOKENS` 2048 → **4096** (la forma de fallo del 58/65 era "pregunta en vez de
   actuar" en planes multi-paso; thinking es donde un modelo chico planea). Costo: +4.5% de budget.
4. Regex de `create-sin-hueco` ensanchado ("no tiene horarios disponibles" era conducta correcta
   flaggeada como WARN — drift del fixture, no del agente).

**Resultados (misma config, mismo prompt en ambos modelos, precio `claude-sonnet-5-intro`):**

| Corrida | 1er intento | flaky | **estables** | Costo real |
|---|---|---|---|---|
| Haiku fix3 R1 | 60/65 · 4W · 1F | 5 | **0** | **$0.719** |
| Haiku fix3 R2 | 62/65 · 3W · 0F | 3 | **0** | **$0.710** |
| Sonnet 5 (control, prompt de la rama) | 64/65 · 1W · 0F | 1 | **0** | $1.538 |

- **La pregunta #1 del handoff quedó contestada: Sonnet TAMBIÉN flakea** — su único WARN fue
  `vencida-cancel-warning` (el WARN histórico de su propia baseline) y **pasó al re-correrlo**.
  El ruido es de la SUITE (datos vivos + modelo no determinista), no de un modelo.
- **Ningún fallo estable en NINGUNA corrida.** Los 8 no-PASS de Haiku y el 1 de Sonnet pasaron
  todos al re-correr — incluido el card-fantasma de `f2c-enruta` (FAIL duro en R1, PASS al
  reintento y en R2: consistente con que nunca se ha reproducido).
- **La diferencia real Haiku↔Sonnet no es capacidad estable, es TASA de flake al 1er intento**
  (5 y 3 vs 1). Para el doctor eso es una respuesta subóptima ocasional, no una conducta
  equivocada consistente.
- `plan-eliminar-antes-de-crear` **PASA 2/2** con `delete_range→create_range` completo — el único
  miss real conocido de Haiku vs Sonnet quedó cerrado con el fix (2).
- Sobre el thinking 4096: la suite no puede atribuirle el cambio (ruido > señal); lo medible es
  que cuesta +4.5% y no empeoró nada. Latencia p50 Haiku 9.8/9.0 s (Sonnet 10.4 s).
- 🔎 **Hallazgo de research (cierra la pregunta abierta #3):** tool search + `defer_loading` es
  **GA en Haiku 4.5** (docs oficiales, tabla de compatibilidad; regex y bm25, sin beta header).
  Los schemas diferidos se apendizan sin invalidar el caché, y Anthropic documenta que la
  precisión de selección se degrada pasando 30–50 tools (tenemos 39) ⇒ el lever 2d puede mejorar
  calidad además de costo. Reglas duras en README §B.
- Veredicto: **la medición ya no bloquea nada** — con cero fallos estables en ambos modelos y
  −50%+ de costo, el merge/flip es una decisión de riesgo/negocio del usuario (ver README §A).
- ⚠️ Método: cada corrida nueva usa el runner CON reintentos; comparar corridas viejas solo por
  el 1er intento. Gates + type-check OK tras los cambios.

> 🛑 **LEE LA ENTRADA DE ARRIBA Y LUEGO ESTA — invalidan conclusiones de las de abajo.**

### 2026-07-23 — 🎲 VARIANZA: la conclusión "Haiku gana en calidad" NO se sostiene

**Qué pasó.** Se corrió la suite completa 3 veces sobre la MISMA config de Haiku (thinking +
fechas server-side). Resultados: **`64/1W/0F`**, **`63/0W/2F`**, **`58/5W/2F`**.
Ningún fallo individual se reprodujo: cada caso que falló y se re-corrió solo, **pasó**.

**Por qué importa más que los números.** La baseline de Sonnet es **UNA corrida** (`63/65`). La
primera de Haiku fue **UNA corrida** (`64/65`). Con eso se escribió "Haiku le gana a Sonnet".
Después la misma config de Haiku dio 58. **La diferencia declarada ganadora (63 vs 64) es más
chica que el ruido de la propia suite (58–64).** No hay evidencia de que Haiku sea mejor NI peor
en calidad; lo único sólido es el costo (−52%), que sale de contar tokens, no de juzgar respuestas.

**De dónde sale el ruido (hipótesis, no verificado):** los evals corren contra **datos VIVOS de
dr-prueba** y el modelo no es determinista; muchos checks son `soft` (regex sobre prosa libre).
Casos flaky identificados: `create-sin-hueco`, `f1-completitud-fiscal-server`,
`f2b-dos-turnos-cita-sin-completar` (el runner lo anota *data-dependent*),
`plan-eliminar-antes-de-crear`, `kl-ui-nav-pasos-app`.

**🚧 EL HUECO QUE BLOQUEA LA DECISIÓN: nunca se midió la varianza de SONNET.** Sin eso no se puede
distinguir entre (a) la suite es ruidosa para CUALQUIER modelo — entonces Haiku no es peor y el
ahorro manda — y (b) Haiku es específicamente más inestable — entonces el ahorro no alcanza.
**Es la pregunta #1 y cuesta ~$4.3 contestarla** (2–3 corridas de Sonnet con el prompt de la rama).

#### Sub-experimento A/B — ¿el bloque de fechas empujaba al agente a PREGUNTAR en vez de actuar?

- **Hipótesis:** 5 de 7 no-PASS de la corrida `58/65` compartían forma ("el agente pregunta en vez
  de actuar"), y el bloque temporal nuevo (917 chars, al final del system prompt) terminaba con
  *"…escribe la fecha completa **para que el doctor pueda corregirte si te equivocaste**"* — un
  empujón explícito a hedgear.
- **Diseño:** 3 casos de esa forma (`kl-ui-nav-pasos-app`, `create-sin-hueco`,
  `f1-completitud-fiscal-server`), 2 iteraciones CON la frase y 2 SIN ella.
- **Resultado: NULO.** Con la frase 4/6 casos-pase; sin ella 5/6. **Un WARN de diferencia en 6
  corridas-caso = ruido, no señal.** La hipótesis NO se sostiene.
- **Lo que sí quedó probado:** `kl-ui-nav-pasos-app` pasó **4 de 4** entre ambos brazos ⇒ el FAIL
  de **card-fantasma** de la corrida `58/65` **NO se reproduce**; era ruido, no una tendencia de
  Haiku a anunciar tarjetas inexistentes (que era el miedo serio, porque el doctor confirma cards).
- Se dejó la frase en su versión corta (conserva el fix de fechas pasadas, sin el hedge). **Es
  juicio, no evidencia** — el A/B no mostró diferencia.

#### ⚠️ Correcciones a lo que este mismo doc afirmó antes (se conservan, no se borran)

| Se dijo | Realidad |
|---|---|
| "Haiku **GANA** a Sonnet en calidad" (título de la entrada de abajo) | No probado: `n=1` vs `n=1`, y la misma config luego dio 58. |
| "banda 63–64, comparar por banda" | Inventada con 2 puntos. La 3ª corrida dio 58. **No hay banda establecida.** |
| El WARN de `plan-eliminar` es "una divergencia REAL, no fixture driftada" | Insostenible con una corrida: después pasó sin tocar nada. |
| El timeout de 60s "reventó" ⇒ el fix de 90s lo arregló | El mismo caso tardó 14.8s al re-correrlo: habría pasado con 60s. El fix es **margen justificado**, no causa demostrada. |

**Lección transferible: una corrida de evals no distingue regresión de ruido.** Antes de calificar
un caso como regresión —o una config como ganadora— hay que **re-correr**. Aplica igual a los
números buenos: el `64/65` que abrió esta carpeta merecía el mismo escepticismo que el `58/65`.

### 2026-07-23 — Haiku 4.5 + thinking + fechas resueltas server-side (⚠️ título original: "GANA A SONNET" — ver la entrada de VARIANZA arriba)
- Rama `agent/haiku-viability`. Cambio: (1) `anthropic.ts` manda `thinking` **según el modelo**;
  (2) `dates.ts`/`run-turn.ts` resuelven server-side el calendario de 14 días.
- Evals: **64/65 PASS · 1 WARN · 0 FAIL** — **mejor que la baseline de Sonnet** (63/65 · 2 WARN).
- Costo REAL Haiku: **$0.688 la corrida** · **$0.0345 la pregunta fría** · $0.0097 tibia p50.
  → **−52% corrida / −58% fría vs Sonnet**, con MÁS calidad. Latencia p50 9.0 s (Sonnet 9.5 s).
- Techo al cap semanal 2M: **~$8.70/mes** (vs $17.4 intro / $26.1 estándar con Sonnet).
- 📐 **Cómo se obtuvo el USD real sin una segunda corrida:** el benchmark se corrió con
  `--price claude-sonnet-5-intro` (para que el Δ vs las filas anteriores sea comparable en
  TOKENS). El vector de precios de Haiku es **exactamente 0.5×** el de Sonnet-intro en los
  cuatro pesos ($1/$5/$0.1/$1.25 vs $2/$10/$0.2/$2.5) ⇒ **USD real = lo impreso ÷ 2, exacto**.
  Por eso esta corrida deja UNA sola fila en el ledger (la de la corrida anterior se duplicó por
  re-preciar; se borró — el ledger es una fila por EXPERIMENTO, no por preciado).

- 🔑 **HALLAZGO 1 — la primera corrida de Haiku no medía Haiku: medía Haiku SIN RAZONAR.**
  `callClaude` nunca mandaba `thinking`. Contra `/v1/models` (2026-07-23):

  | | Sonnet 5 | Haiku 4.5 |
  |---|---|---|
  | `thinking.adaptive` | ✅ | ❌ |
  | `thinking.enabled` (`budget_tokens`) | ❌ | ✅ |
  | `effort` | ✅ low→max | ❌ (ninguno) |
  | contexto | 1M | 200K |

  Sonnet 5 corre adaptativo **al omitir** el parámetro; Haiku 4.5 corre con **CERO** razonamiento.
  La comparación 59/65 vs 63/65 era Sonnet-con-thinking vs Haiku-sin-thinking.
  ⚠️ **Los dos shapes son MUTUAMENTE EXCLUYENTES: mandar el equivocado es un 400.** Por eso el
  fix es un branch por modelo y NO "agregar el parámetro"; con `AGENDA_AGENT_MODEL` siendo un
  env var, sin ese branch el flip de modelo revienta en prod.
  Se manda thinking **solo a Haiku**: el request de Sonnet queda byte-idéntico (baseline sigue
  comparable y `form-builder-chat`, que comparte `callClaude`, no se toca).
- 🔑 **HALLAZGO 2 — el único FAIL era arquitectura, no capacidad del modelo.** El bloque temporal
  decía *"calcula los demás días de la semana a partir de este dato"* → Haiku resolvió "el martes"
  al 2026-07-29 y lo tituló "Martes" (era miércoles). Es **regla 0 aplicada al tiempo**: el
  veredicto lo resuelve el servidor. Ahora emite la tabla `día→fecha` de 14 días ya calculada.
  Verificado 14/14 contra un cómputo independiente antes de correr la suite (incluye el cruce de
  mes). `weekday-correcto` PASA. Va en el bloque VOLÁTIL ⇒ **no invalida el caché** (el
  `STABLE_SYSTEM_PROMPT` quedó intacto — `gate:prompt` OK).
  *Ya existía el precedente:* `mxTodayWeekday()` se creó por E6 ("los LLMs calculan mal el día de
  la semana desde una fecha") — pero solo para HOY. Esto termina el mismo fix.
- Costo de pensar: +31% de budget vs Haiku-sin-thinking (525k → 688k) a cambio de +5 PASS y −1
  FAIL. Sigue por DEBAJO de Sonnet (718k) y con mejor calidad.
- ⚠️ **El WARN que queda es una divergencia REAL, no fixture driftada.**
  `plan-eliminar-antes-de-crear`: Haiku vio 2 citas vivas dentro del rango, **avisó bien** y se
  detuvo sin emitir las propuestas delete→create. `HOW_TO_PROPOSE` pide avisar *"junto a la
  propuesta"*: hizo la mitad del aviso y se saltó la de proponer. Sonnet pasa este caso. Es un
  check `soft` y la conducta es la más cautelosa, pero es un miss — blanco del trabajo de
  descripciones de tools (lever 2d/2c).
  *En cambio los 2 WARN de la baseline de Sonnet (`reschedule-noop`, `vencida-cancel-warning`)
  PASAN en Haiku.*
- ⚠️ **Caveats vigentes:** todo es dr-prueba (hueco #1 sin cerrar) · Haiku tiene **200K** de
  contexto vs 1M · el mínimo cacheable de Haiku es **4096 tok** (Sonnet 2048) ⇒ si algún día se
  poda hasta dejar un prompt de member por debajo, el caché deja de funcionar **en silencio**.
- ⚠️ **Al desplegar (NO hecho — esto vive en una rama):** `form-builder-chat` hereda
  `AGENDA_AGENT_MODEL` (`route.ts:30-33`) ⇒ poner esa var en Railway **también mueve el
  form-builder a Haiku**, y esa superficie tiene **0 cobertura** en la suite de 65. Fijar
  `FORM_BUILDER_CHAT_MODEL=claude-sonnet-5` en la misma pasada.
- 🔍 **Review del diff (modo INLINE, `05-METODO` §2B — sesión larga ⇒ nunca 8 forks al final del
  día). Clasificación: MIXTO ⇒ completo, scopeado** (lógica de fechas replicada + comentarios que
  afirman capacidades de modelos = los dos renglones de "review completo sin preguntar").
  **4 hallazgos aplicados · 2 refutados:**
  1. **CONFIRMED (correctness) — la instrucción nueva era SOLO hacia adelante.** La línea borrada
     ("calcula los demás días a partir de este dato") era **simétrica**; la nueva decía "cuenta a
     partir del ÚLTIMO día de la tabla", y la tabla solo cubre hoy→+13. Para fechas **pasadas**
     (resumen fiscal mensual, movimientos, vencidas, "los rangos de oct-nov" de la bitácora #18)
     eso desorienta. ⚠️ **La suite NO puede cazarlo: hay UN solo caso de weekday
     (`weekday-correcto`) y es hacia adelante** ⇒ el 64/65 no da cobertura aquí. Salió del ángulo
     2 ("¿qué invariante sostenía la línea borrada?"). Fix: fallback simétrico, nombra las fechas
     pasadas y obliga a escribir la fecha completa para que el doctor pueda corregir.
  2. **CONFIRMED (reuse)** — `mxUpcomingDays` re-implementaba `d.toISOString().split('T')[0]`, que
     es `utcDateToKey()` **cuatro líneas más abajo en el mismo archivo**. Ahora la usa.
  3. **PLAUSIBLE (correctness) — contradicción a medianoche.** `buildSystem` llamaba `mxTodayKey`,
     `mxTodayWeekday` y `mxUpcomingDays` haciendo cada uno su propio `new Date()`: cruzando la
     medianoche MX podía imprimir "Hoy es jueves 23" encima de una tabla cuya fila "(hoy)" dijera
     24. La carrera ya existía; este cambio la volvía **visible**. Fix: un solo ancla threadeada.
  4. **PLAUSIBLE (latente) — un modelo desconocido se queda SIN razonar en silencio.**
     `thinkingFor` devolvía null para todo lo que no fuera `haiku-4-5`. Es exactamente el fallo
     que costó una corrida completa hoy. Fix: dos listas explícitas
     (`ADAPTIVE_BY_DEFAULT` / `NEEDS_EXPLICIT_THINKING`) y **warning ruidoso** si el modelo no
     está clasificado.
  - **REFUTADOS:** (a) los bloques `thinking` NO rompen `form-builder-chat` — itera y solo matchea
    `text`/`tool_use` (`route.ts:291-294`), los ignora; (b) `setMessageCacheBreakpoints` NO muta un
    bloque thinking — solo escribe en el ÚLTIMO bloque (que es el `tool_use`) y borrar un
    `cache_control` inexistente es no-op.
  - ⚠️ **Limitación honesta del modo inline:** sin ojos frescos (el mismo autor revisó su código).
    Segunda capa opcional = `/code-review ultra` contra la rama (lo dispara el usuario).
- ⏱️ **Hallazgo POST-review — el timeout de 60s/llamada quedó corto con thinking.** La 2ª corrida
  completa (ya con los 4 fixes) dio **63/65 · 0 WARN · 2 FAIL**, y uno de los FAIL fue
  `f2a-desempate-triple` reventando el `AbortSignal.timeout` de 60s. **Razonar ocurre ANTES del
  primer token de salida**: casos que corrían en ~4s pasaron a 20–33s (el más lento completado:
  32.9s, 4 casos >20s), o sea el margen de los 60s casi se agotó. En prod un timeout le llega al
  doctor como **ERROR**, no como respuesta lenta. Fix: `THINKING_TIMEOUT_MS = 90s` **solo** cuando
  se manda thinking (el path de Sonnet sigue en 60s). *Honestidad: al re-correr, ese caso tardó
  14.8s — o sea habría pasado también con 60s. El timeout que se vio NO era determinista; el fix
  es margen justificado, no una causa demostrada.*
- 🎲 **Hallazgo metodológico — HAY VARIANZA ENTRE CORRIDAS; no leer ±1 como movimiento.**
  La MISMA config dio `64/65 · 1 WARN · 0 FAIL`, luego `63/65 · 0 WARN · 2 FAIL`, y los 2 FAIL
  pasaron al re-correrlos solos (`2/2`). Casos flaky identificados:
  `plan-eliminar-antes-de-crear` (WARN en una corrida, PASS en otra sin tocar nada) y
  `f2b-dos-turnos-cita-sin-completar` (el propio runner lo anota *data-dependent*; 3 de 4 corridas
  PASS). Los evals corren contra **datos vivos de dr-prueba** y el modelo no es determinista.
  📏 **Regla para leer el ledger: comparar por FAILs duros y por BANDA de PASS (63–64), no por el
  número exacto.** Un WARN que aparece y desaparece sin cambio de código es ruido, no señal.
  ⚠️ Corolario incómodo: en la 1ª corrida se documentó ese WARN como *"divergencia REAL, no fixture
  driftada"* — con una sola corrida esa afirmación no era sostenible. **Una corrida no distingue
  regresión de ruido; hace falta re-correr el caso solo antes de calificarlo.**
- 🧪 **Re-runs baratos (los usó este experimento):** `EVALS_ONLY="id1,id2"` corre un subconjunto.
  ⚠️ **Pasar también `EVALS_OUT=otro.json`**: por default el runner escribe
  `agenda-evals-last-run.json` y un subset de 2 casos **PISA** el JSON de la corrida completa que
  el benchmark necesita para preciar.
- Veredicto: **Haiku es viable y hoy domina a Sonnet en calidad Y costo** sobre este rig.
  Nota: el camino de Sonnet quedó byte-idéntico ⇒ **mergear esto NO compromete el modelo**; la
  tabla de fechas mejora a Sonnet igual, y el modelo sigue siendo un flip de env var.

### 2026-07-23 — Haiku 4.5 "tal cual" (flip del env var, sin tocar nada) — SUPERADA por la de arriba
- Cambio: solo `AGENDA_AGENT_MODEL=claude-haiku-4-5`. Cero código. Ledger: fila `haiku-4-5`.
- Evals: **59/65 PASS · 5 WARN · 1 FAIL** (baseline 63/65 · 2 WARN · 0 FAIL).
- Costo real: $0.525 corrida · $0.0338 fría. Latencia p50 **5.5 s** (la más rápida de las tres).
- **Lectura correcta de esta fila: NO mide a Haiku, mide a Haiku sin razonar** (ver el hallazgo 1
  de la entrada de arriba). Se conserva porque es la evidencia de cuánto aporta el thinking:
  59→64 PASS y 1→0 FAIL por +31% de budget.
- Hipótesis registrada ANTES de correr (para no racionalizar después): *"aguanta lecturas y
  frontera; lo probable es que se degraden escrituras multi-paso y los `inj-*`"*. **Acertó a
  medias:** las escrituras multi-paso sí se degradaron (`plan-eliminar`, `f2c-enruta`), pero
  **los 3 `inj-*` PASARON** y el único FAIL duro fue una LECTURA (aritmética de fechas) — justo
  donde la hipótesis decía que aguantaba. La sorpresa fue arquitectónica, no de "fuerza" del modelo.
- 3 de los 5 WARN eran artefactos de fixture, no regresiones: `create-sin-hueco` (respondió "no
  tiene horarios disponibles"; el regex `soft` pedía otras palabras), `f2b-ppd-solo-explicito`
  (el `bookingId "test123"` de la fixture ya no existe) y `f1-completitud-fiscal-server` (paró a
  desambiguar 2 homónimos, que es lo que manda RESILIENCE).

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
