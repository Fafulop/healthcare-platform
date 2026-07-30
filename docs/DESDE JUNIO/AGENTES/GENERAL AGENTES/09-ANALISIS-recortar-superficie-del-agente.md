# 🔬 ANÁLISIS — ¿conviene recortar la superficie del agente? (2026-07-30)

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día. No es un plan: **no hay trabajo pendiente
> que salga de aquí.**
>
> **La decisión, en una línea: NO se recorta nada por ahora.** Este doc existe para que la
> siguiente vez que la pregunta aparezca, se retome desde el análisis y no desde cero — y sobre
> todo para que no se retome desde la intuición equivocada.
>
> **Conteos citados aquí = foto del 2026-07-30.** Los vigentes viven SOLO en
> [`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4 (`07-CONVENCIONES` §2).

---

## 1. La pregunta que se hizo

> *"El valor del agente es cortar la fricción entre el doctor y la app: lo difícil de aprender es
> CREAR (rangos, bloqueos, citas, reagendar, cancelar). Consultar información —cuántas citas tuve
> la semana pasada— es fácil en la UI con dos filtros. ¿Conviene quitarle al agente las tools de
> consulta para que se equivoque menos?"*

La intuición de fondo es correcta y vale la pena conservarla: **el agente gana donde la
funcionalidad es difícil de descubrir, no donde la UI ya es obvia.** Lo que el análisis cambió es
*dónde cae esa línea*.

## 2. El reencuadre que importa: FONTANERÍA vs RESPUESTA

La línea NO es lectura contra escritura. Es:

| | Qué es | Se puede quitar |
|---|---|---|
| **Lectura de FONTANERÍA** | Alimenta una acción: de ahí salen los IDs | ❌ **No** — la escritura muere con ella |
| **Lectura que ES la respuesta** | El payload es el fin, no un paso | ✅ Candidata |

**Por qué la fontanería no se toca:** por la regla 0 el modelo **nunca** inventa un ID, así que
el prompt obliga a leer antes de proponer. Está escrito:
`FACTURAS_RULES` → *"verifica el ingreso con get_billing_status en ESTE turno (de ahí sale el
ledgerEntryId — nunca lo inventes)"*; `AGENDA_CITAS_RULES` → *"El horario sale de get_availability
de ESTE turno"*, *"find_patient PRIMERO"*.

Se ve en las secuencias reales de la suite:

```
find_patient → get_billing_status → propose_create_cfdi
find_patient → get_bookings       → propose_complete_booking
get_day_schedule → propose_delete_range → propose_create_range
```

⚠️ **Consecuencia para la idea original: en `agenda` casi TODA la lectura es fontanería**
(`find_patient` → patientId · `get_availability` → el hueco · `get_ranges` → ids para borrar ·
`get_services`/`get_locations` → serviceId · `get_bookings`/`get_booking_detail` → bookingId).
Quitarlas no adelgaza al agente: **rompe justo las escrituras que se querían conservar.**

## 3. El corte concreto, si algún día se hace

Las lecturas-respuesta puras son **7 tools** (foto 2026-07-30), y el hallazgo útil es que
**ninguna escritura depende de ellas**:

| Módulo | Tools | ¿Algún `propose_*` la necesita? |
|---|---|---|
| `flujo` | `get_balance` · `get_movimientos` · `get_movimiento_detail` · `get_flujo_status` · `get_conciliacion_bancaria` | **No** |
| `fiscal` | `get_resumen_fiscal` · `get_ppd_cobranza` | **No** |

El CFDI toma su `ledgerEntryId` de `get_billing_status` (módulo `facturas`), **no** de las tools
del ledger. Así que el corte sería limpio: 39 → 32 tools sin tocar una sola escritura.

**`facturas` está partido a la mitad** y no se puede tratar como una unidad:

- **Fontanería (se queda):** `get_billing_status` · `get_patient_profile` ·
  `search_catalogo_sat` · `get_fiscal_profile_status`
- **Reporte (candidata):** `get_pendientes_factura` · `get_cfdis` · `get_sat_cfdis`

⚠️ **Dependencia a planear:** `FACTURAS_RULES` **nombra en prosa** las tools que se cortarían —
*"'¿Quién me debe?' tiene TRES lecturas: sin pagar (get_movimientos POR_COBRAR), PPD sin
complemento (get_ppd_cobranza), consultas sin facturar (get_pendientes_factura)"*. Cortar sin
tocar esa prosa **es exactamente la bitácora #27** (la prosa apunta a tools ausentes ⇒ el modelo
NO declina, alucina con la tool más parecida). `gate:prosa` lo cazaría y `facturas` necesitaría su
variante `partial`.

## 4. Los tres argumentos, con su peso real

### Costo — más débil de lo que parece, y ahora está medido
Los **esquemas de las tools ya viajan diferidos** (`run-turn.ts` los marca `defer_loading` detrás
de `tool_search_tool_regex`): **no están en el prefijo cacheado** hasta que se descubren. Solo 4
tools calientes cargan de entrada, así que el prefijo real es **~11.0k**, no los 22.8k que suman
los 39 esquemas (medido 2026-07-30, `02-CAPACIDADES` §4).

Con los pesos por módulo de esa misma medición:

| Módulo candidato | Peso en el prefijo COMPLETO | ¿Se paga hoy en una pregunta fría? |
|---|---|---|
| `flujo` (5 tools) | 2,480 tok | **No** — sus 5 tools van diferidas |
| `fiscal` (2 tools) | 1,364 tok | **No** — sus 2 tools van diferidas |
| **Total del corte** | **3,844 tok (17% del techo)** | **~1.5k reales** (solo la prosa de los dos módulos) |

⚠️ Ese es el punto: de los 3,844 tok, **2,281 son esquemas que ya no se cargan**. Lo único que se
ahorra de verdad es la **prosa** de los dos módulos (~1.5k), y solo si también se corta la prosa.
**Quitar tools sin quitar prosa no ahorra casi nada** — y quitar la prosa a medias es #26/#27.

### Conducta — el argumento fuerte, y es real
Las bitácoras **#25–#28** son todas la misma forma: *el agente tenía una capacidad ADYACENTE a la
pregunta e improvisó en vez de declinar*. #28 es el caso puro — un campo del payload sobrevivió al
recorte y el modelo narró un análisis de conciliación completo a partir de nombres de bucket.
Menos superficie = menos invitaciones.

### ⚠️ Pero un corte PARCIAL es peor que ninguno
Lo probaron #26 y #27: tools quitadas + prosa intacta ⇒ el modelo **alucina en vez de declinar**.
Cualquier corte tiene que ser tools **+** prosa **+** payload **+** filtros, juntos.

## 5. Por qué NO se hizo (2026-07-30)

**1. La premisa no se transfiere.** El argumento para cortar era *"el doctor filtra la tabla"* —
cierto para citas, **falso para dinero**. *"¿Quién me debe?"* tiene tres respuestas legítimas y el
doctor normalmente no sabe cuál quiere; eso no lo resuelve un filtro, es criterio. Igual
*"¿cuánto me quedó este mes?"*, que fue #27 — y **el arreglo funcionó** (0/3 → 3/3).

**2. Los ejes apuntan en direcciones opuestas.** Cortar por RIESGO señala flujo/fiscal; cortar por
REDUNDANCIA-CON-LA-UI señala los conteos de agenda. No son el mismo corte:

| Superficie | ¿Confunde al modelo? | ¿La UI ya lo resuelve fácil? | Veredicto |
|---|---|---|---|
| Conteos / agenda de citas | No — una respuesta, campo del servidor | Sí | Barato y seguro; cortar compra poco |
| Fontanería de agenda | No | n/a | **No se puede** cortar |
| Lecturas de dinero cross-dominio | **Sí — los 4 fallos registrados** | En parte, y ahí también es ambiguo | La candidata real |
| Escrituras (rangos, bloqueos, citas) | No, van con card | **No** — ésta es la fricción que importa | Conservar y profundizar |

**3. Se cortaría lo más diferenciado, no lo más redundante.** Las lecturas de dinero son
alto-riesgo **y** alto-valor; las de agenda son bajo-riesgo **y** bajo-valor.

**4. No hay evidencia de uso.** `llm_token_usage` guarda **solo conteos de tokens — ningún texto
de pregunta** (verificado en el esquema, 2026-07-30). No existe registro de qué le preguntan los
doctores al asistente, así que la decisión sería intuición pura. Precedente de esta misma casa:
en CITAS (2026-07-29) un agregado "convincente" (118/160 expedientes) fue **desmentido** por la
medición directa. Aquí no hay ni el agregado.

**5. Lo que hoy pasa con el caso testigo ya es correcto.** *"¿Cuántas citas tuve la semana
pasada?"* → el prompt le da la fecha server-side (#25), llama `get_bookings` con rango, y el
servidor devuelve `totalEncontradas` como **campo aparte** (`tools.ts`); la regla 7 del prompt
obliga a reportar ese campo y no contar la lista. Es de los caminos más seguros del sistema: sin
card, sin notificación, y el número es un veredicto del servidor. Costo medido 2026-07-30:
**~$0.005 tibia, ~$0.02 fría.** No hay problema que arreglar ahí.

## 6. Qué haría reconsiderarlo (los disparadores)

- **Se empieza a registrar qué preguntan los doctores** y resulta que las preguntas de dinero son
  raras. Ese es el dato que falta, y es lo más barato de conseguir.
- Aparece un fallo **estable** (no flaky) en una lectura de dinero que el recorte de payload no
  cierre — hoy el residuo conocido (`tier-core-conciliacion-no-inventa`, ~50%) es soft y aceptado.
- Se quiere **des-diferir las `propose_*`**: es la palanca documentada para el único watch-item de
  conducta persistente (`plan-eliminar`, flaky ~1/3 bajo tool search, ver
  `../OPTIMIZACION COSTOS/02-BITACORA-experimentos.md`). Un agente más chico paga ese prefijo sin
  despeinarse ⇒ **la idea de recortar y ese bug abierto tienen la misma solución.**
- Entra un doctor cuyo plan no incluye dinero: entonces el recorte ya no es una decisión de
  producto sino la de TIERS, y se resuelve sola por `resolveAgentScope`.

## 7. Si se retoma: cómo hacerlo (y cómo NO)

1. **Exprésalo como SCOPE, no como borrado.** `resolveAgentScope` ya compone por permisos y por
   tier; CORE ya ejercita exactamente ese camino. Reversible, por-doctor, y cuesta **una corrida
   de evals (~$1, medido 2026-07-30)** ver cómo se comporta el camino de declinar.
2. **Alternativa más barata: acotar el PAYLOAD en vez de quitar la tool.** Precedente **C4**
   (#28): omitir/relabelar campos —jamás recalcular— borró la narración SAT por completo
   (0 de 6 corridas) conservando la tool.
3. **El riesgo real es el camino de declinar.** Un doctor que oye *"no puedo"* dos veces deja de
   usar el asistente **también para las escrituras**, que es donde sí vale. Declinar bien es
   *"eso no lo hago yo — son dos clics en Citas, filtro X"*, y eso es un **claim de ruteo**:
   `gate:prosa` solo lo cubre si la sección está en sus `FEATURE_PHRASES`.
4. **Nunca cortar tools dejando prosa/payload/filtros vivos** (#26/#27/#28).

---

*Relacionado: [`02-CAPACIDADES`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) §4 (conteos
vigentes) · [`00-BLUEPRINT`](00-BLUEPRINT-asistente-modular.md) §5 (escalamiento) ·
[`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md) bitácoras
#25–#28 · [`../../TIERS/01-DISENO-tecnico.md`](../../TIERS/01-DISENO-tecnico.md) §11 (la
maquinaria de recorte).*
