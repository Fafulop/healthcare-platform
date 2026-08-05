# 🛠️ PLAN — agendar en freeform, en un solo turno

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día hasta que shippee; entonces pasa a
> SNAPSHOT y el estado se muda a [`SESSION-REFRESCO`](SESSION-REFRESCO.md).
>
> ✅ **ACTUALIZACIÓN 2026-08-05 (mismo día): los SIETE cambios están IMPLEMENTADOS** — type-check,
> los CINCO gates, smoke read-only contra prod, DOS code reviews (12 hallazgos, 12 atendidos) y la
> corrida A de evals (`77/85 · 0 FAIL estables`). ⚠️ **Sin commitear y sin desplegar**, y **sin la
> prueba a mano**, que es la que falta de verdad. Estado vivo y los 12 hallazgos:
> [`SESSION-REFRESCO`](SESSION-REFRESCO.md).
>
> El texto de abajo se conserva como el plan que se aprobó; donde la implementación se desvió o
> descubrió algo, va anotado ⚠️ en su sitio.

---

## 1. La tesis

El asistente no falla por falta de inteligencia — falla por **número de turnos**
([`00`](00-EVIDENCIA-traza-demo.md) §6). Entonces el objetivo no es que sepa más cosas: es que
**pregunte menos veces y exija menos datos**.

Decisión del usuario (2026-08-05), que reencuadra todo lo anterior:

> *«El agente no debería saber si hay rango o no. Sólo debería importarle si ya hay una cita a
> esa hora. Y casi ningún doctor va a usar rangos, porque los rangos son para la página web.»*

## 2. La buena noticia: el endpoint ya piensa así

`freeform=1` **no se suma** al modo rangos — lo **sustituye**:

```ts
// range-availability/route.ts:229
const ranges = freeform ? [] : await prisma.availabilityRange.findMany(...)
```

Con `freeform=1` los rangos publicados se ignoran por completo y una ventana sintética de día
entero ocupa su lugar. Lo que queda restándose son **citas y bloqueos** — literalmente el
modelo mental del usuario. **No hay que diseñarlo: hay que encenderlo.**

Parámetros vigentes en prod (CITAS `480f7f72`): `freeform=1` (exige DOCTOR dueño o ADMIN) ·
`interval` (sólo divisores de 15: `1·3·5·15`) · presupuesto de 6,000 slots por respuesta ·
la respuesta **hace eco** de `freeform` e `intervalMinutes`.

⚠️ **Los bloqueos SE SIGUEN respetando, y es a propósito.** Un bloqueo es una instrucción
explícita del doctor ("ese viernes opero"), no un rango. Freeform ya los resta.

## 3. Los cambios

| # | Dónde | Qué | Toca prompt |
|---|---|---|---|
| 1 | `proposals.ts:836` `fetchDaySlots` | `freeform=1&interval=1` + `Authorization: Bearer` | no |
| 2 | `proposals.ts:129` `ProposalContext` | recibe `apiToken` (igual que recibió `tier` en T3) | no |
| 3 | `run-turn.ts:433` | pasarlo al construir el contexto | no |
| 4 | `AgentContext.tsx:164` y `:276` | `create_booking` y la pata de create del reagendado → `/range-bookings/instant` | no |
| 5 | `proposals.ts:778` `missingContactFields` | `bookingHorarios*` → `bookingInstant*` | no |
| 6 | `tools.ts:387` + prosa de `agenda` | **eliminar `get_availability`** | **SÍ** |
| 7 | prosa de `agenda` | una sola pregunta consolidada; nunca *"¿confirmas?"* | **SÍ** |

> ⚠️ **Lo que la implementación añadió y este plan no preveía** (todo de los reviews):
> `nearestTimes` con tope de 8 alternativas **espaciadas por la duración del servicio** y a ≤180 min
> del objetivo (acotar por tamaño dejaba 8 minutos SEGUIDOS del mismo hueco) · una CUARTA rama en
> el motivo del rechazo (sin auth · ya pasó · **no cabe antes de las 23:59** · ocupado) · `get_services`
> entra al set caliente en lugar de `get_availability` · y una **tercera pasada en `gate:prosa`**
> que caza prosa nombrando tools inexistentes, el punto ciego que dejaba pasar en verde dos
> descripciones con `get_availability` (§3 de [`SESSION-REFRESCO`](SESSION-REFRESCO.md)).

**4 y 5 son UN cambio, no dos** — separarlos produce cards que validan y luego 400
([`01`](01-HALLAZGO-campos-de-cita.md) §5).

### 3.1 La autenticación ya está resuelta (más barato de lo que dicen los docs)

`../../CITAS/SESSION-REFRESCO.md` §9 y `../AGENTE AGENDA/SESSION-REFRESCO.md` §7 advierten que
`freeform=1` exige auth y que *"la llamada tiene que volverse autenticada primero"*, dando a
entender infraestructura nueva. **No la hay que construir:**

- `agenda-agent/api-token.ts` ya acuña el Bearer HS256 por turno desde la sesión del doctor.
- `ToolContext.apiToken` ya lo transporta; `search_catalogo_sat` ya lo usa
  (`modules/facturas.ts:1009`).
- Lo único que falta es que `ProposalContext` lo lleve también (cambios 2 y 3).

⚠️ **Leer el eco, no asumirlo.** Si el token falla, el endpoint **ignora** `freeform=1` (no
devuelve 403, a propósito) y responde en modo rangos. Hay que comparar el `freeform` que vuelve
y, si no fue servido, dar un mensaje honesto en vez de afirmar "esa hora no está libre" — que
sería falso: lo que pasó es que no se pudo preguntar en freeform. Es la lección #2 de
`../../CITAS/01-PLAN-agendar-sin-rango.md` §8: *una lista vacía no es una respuesta*.

### 3.2 Por qué se puede borrar `get_availability` sin romper nada

Es el cambio que más asusta y el mejor sostenido:

- **Nunca fue la garantía.** El guard es `checkSlot` (`proposals.ts:805`), que re-valida
  server-side contra el motor real antes de que exista card alguna. Sigue intacto.
- **En freeform su respuesta es trivial.** "Qué hay libre" = "todo menos lo ocupado", y lo
  ocupado ya lo da `get_day_schedule`.
- **En la demo su única contribución fue una lista vacía** que provocó un rango inventado
  ([`00`](00-EVIDENCIA-traza-demo.md) §3.2).
- Enumerarlo en freeform sería además un payload de hasta 1,440 entradas por día — contra el
  cap de 8 KB de la bitácora #34.

🔴 **Pero NO se puede quitar la tool dejando la prosa.** `AGENDA_CITAS_RULES` dice literal
*"El horario sale de `get_availability` de ESTE turno"*. Cortar la tool y dejar esa línea es
**exactamente** las bitácoras #26/#27: el modelo no declina, **alucina con la tool más
parecida**. Tool + prosa salen juntas, y `gate:prosa` lo verifica.

### 3.3 La forma que se busca

Paciente nuevo — **un turno**:

> *«Agenda a Pepito Pérez mañana 4pm»*
> → *«No lo tengo registrado. Pásame correo, teléfono y WhatsApp, y si es primera vez.»*
> → *[card: Pepito Pérez · mañana 16:00–16:30]*

Paciente ya en el expediente — **cero preguntas** antes de la card: `find_patient` lo resuelve y
el servidor rellena el contacto, con el mismo criterio que fijó la bitácora #30 (*el expediente
manda, la copia de la cita es el respaldo*).

Y **nunca** *"¿confirmas?"* antes de proponer: **la card ES la confirmación**. Preguntar permiso
para hacer una propuesta es primo de la bitácora #23 (narrar la card en vez de invocarla).

## 4. Lo que NO se toca

- **Las tools de rangos** (`propose_create_range`, `propose_delete_range`, `get_ranges`). Los
  rangos siguen existiendo para la página pública y hay doctores con ellos. Lo que se borra es
  que **agendar** dependa de ellos.
- **Los bloqueos**, en todas sus formas (§2).
- **La maquinaria propuesta → card → confirmación → ejecuta el CLIENTE.** Nada aquí la roza.
- **La regla 0.** El cliente sigue sin recalcular ocupación: pertenece a la lista que devuelve
  el servidor.

## 5. Verificación (no negociable)

1. `pnpm gates` — **los CINCO** — y `pnpm type-check`.
2. **Smoke read-only contra prod** del nuevo query shape de `range-availability` con
   `freeform=1` ANTES del push. No hay staging.
3. `/code-review` del diff. Precedente caro: en CITAS, cinco rondas seguidas encontraron
   hallazgos reales, tres de ellos introducidos por la ronda anterior.
4. **DOS corridas completas de evals con los conjuntos estables INTERSECADOS.** Una sola no
   distingue regresión de ruido (bitácora #31b: A∩B = ∅ con el mismo código).
5. **Casos de eval nuevos** para lo que hoy es invisible: día sin rango → agenda a la hora
   dicha; hora con minutos raros (16:07); hora ocupada → no propone.
6. ⚠️ **Y un doctor de prueba con los toggles en `true`**, o el punto ciego de
   [`01`](01-HALLAZGO-campos-de-cita.md) §4 sigue abierto y la suite seguirá sin ver este fallo.
7. **Un turno REAL post-deploy.** Los cambios 4 y 5 tocan el camino de escritura, y los evals no
   pasan por `route.ts` (#32b).

## 6. Lo que este trabajo le aporta a la pregunta "¿un agente por área?"

[`../GENERAL AGENTES/10-ANALISIS`](../GENERAL%20AGENTES/10-ANALISIS-especializar-agente-por-area.md)
(2026-08-01) decidió **no partir** el agente, y midió la superficie en **tokens**.
[`09-ANALISIS`](../GENERAL%20AGENTES/09-ANALISIS-recortar-superficie-del-agente.md) evaluó
recortar lecturas de agenda y concluyó que *"compra poco"* — también en tokens.

**Este trabajo aporta un eje que ninguno de los dos tenía: TURNOS.** Cortar `get_availability`
no ahorra casi tokens (su esquema viaja diferido), pero **elimina un viaje** — y el viaje es lo
que el doctor siente. Es la primera medición de superficie con la unidad correcta.

Y el corolario incómodo para la tesis del agente especializado: **un agente dedicado sólo a
citas habría producido la transcripción de [`00`](00-EVIDENCIA-traza-demo.md) sin cambiar una
coma.** Los siete turnos no salieron de que el agente supiera de más — salieron de campos
obligatorios, del modelo de rangos y de la política de preguntas. Partir el agente no toca
ninguna de las tres.

---

*Creado 2026-08-05. Puntos de código verificados contra el árbol de esa fecha.*
