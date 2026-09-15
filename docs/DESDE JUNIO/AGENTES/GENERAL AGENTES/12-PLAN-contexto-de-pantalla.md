# 🖥️ PLAN — que el asistente sepa QUÉ PANTALLA está viendo el doctor

> **Tipo: PLAN.** 🌱 **NADA CONSTRUIDO** (2026-09-14). No está bloqueado por nada técnico: se
> pausó por prioridad. Este doc existe para que una sesión fría lo retome sin reconstruir el
> razonamiento.
>
> **El porqué y la arquitectura de la que sale:**
> [`11-ANALISIS-contexto-de-pantalla.md`](11-ANALISIS-contexto-de-pantalla.md). **Este doc es el
> CÓMO.** Si solo vas a leer uno, lee el 11 primero — sin él, las decisiones de aquí parecen
> arbitrarias.
>
> ⚠️ **El §2 NO es opcional.** Tres afirmaciones de las que cuelga todo el plan salen de OTROS
> DOCS, no de una lectura del código. Si el §2 las desmiente, el resto cambia. *La verdad es el
> código* (`08-EMPIEZA-AQUI` §8).

---

## 0. En una frase

El panel ya sobrevive la navegación pero **no sabe dónde está parado el doctor**. Se le pasa la
pantalla —y, en fase 1, la ENTIDAD que tiene abierta— en el **bloque volátil** del prompt, que es
cache-safe, y se recorta server-side por el mismo scope que recorta las tools.

## 1. Por qué vale la pena (las tres razones, en orden de fuerza)

1. **🔴 Está MEDIDO, no supuesto.** En la traza de `agent_tool_calls` (bitácora #37) el agente
   llamó **`get_services` cuatro veces en cinco minutos, en cuatro turnos distintos**, devolviendo
   siempre el mismo `servicios_n: 2`. Un panel que sabe en qué pantalla está —y que ya tiene esa
   lista— se ahorra esa clase entera.
2. **Ahorra fontanería.** [`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md) §2: casi
   toda la lectura de `agenda` existe para **producir un ID** (`find_patient` → `patientId`). Si
   el doctor está parado en el expediente de un paciente, ese ID **ya lo sabemos**: el camino
   caliente se ahorra una iteración del loop. ⚠️ **Hipótesis a medir** (§7), no un resultado.
3. **Es la versión BARATA de "tools por pantalla"** (idea del usuario, 2026-09-14). Ver §8.1:
   cortar el toolset por pantalla es Nivel 3 del blueprint y probablemente sube el costo; SESGAR
   la selección desde el bloque volátil cuesta ~20 tokens y no crea una segunda caché.

## 2. PASO 1 — verificación contra el código (obligatorio, ~1 h, antes de escribir nada)

Cuatro preguntas. Cada una tiene una consecuencia si la respuesta no es la esperada.

| # | Pregunta | Dónde mirar | Si la respuesta NO es la esperada |
|---|---|---|---|
| **V1** | ¿Dónde se compone el **bloque volátil** y está de verdad FUERA del breakpoint de `cache_control`? | `lib/agenda-agent/prompt.ts` (`STABLE_SYSTEM_PROMPT`), `dates.ts`, `run-turn.ts` | **Se cae el plan entero.** Si el contexto entra al prefijo cacheado, cada navegación = pregunta fría (§4) |
| **V2** | ¿`useAgentActions` es el lugar correcto para colgar `registerScreenContext`? | `contexts/AgentContext.tsx` | Si solo cabe en `useAgentChat`, **cada tecleo del chat re-renderiza la página entera** (`01-PLAN` §7) |
| **V3** | ¿Qué forma devuelve `resolveAgentScope(access)` y se puede filtrar un payload con ella? | `lib/agenda-agent/modules/registry.ts` | El recorte del §5 se vuelve más caro y hay que diseñarlo aparte |
| **V4** | ¿El runner de evals puede **inyectar** un contexto de pantalla en un caso? | `scripts/agenda-agent-evals.ts` | **No se pueden escribir los evals de fuga del §6** ⇒ el plan se queda sin su red de seguridad |

> ✅ **Ya hay un precedente que responde medio V1 y que es LA PLANTILLA a copiar:** la **tabla
> `día→fecha` de 14 días** que se agregó el 2026-07-23 vive en el bloque volátil, y el registro
> dice explícitamente *"Va en el bloque VOLÁTIL ⇒ **no invalida el caché** (el
> `STABLE_SYSTEM_PROMPT` quedó intacto — `gate:prompt` OK)"*
> ([`../OPTIMIZACION COSTOS/02-BITACORA`](../OPTIMIZACION%20COSTOS/02-BITACORA-experimentos.md)).
> **El contexto de pantalla es exactamente el mismo tipo de dato: volátil, por turno, server-side.**
> Hacer lo mismo que hizo la tabla de fechas es la ruta de menor riesgo.

## 3. FASE 0 — solo la ruta

**Qué:** una línea en el bloque volátil: *"El doctor está viendo la pantalla `/dashboard/facturacion`."*

**Costo:** ~20 tokens por turno, cero en el prefijo cacheado.

**Archivos** (rutas citadas de los docs — **confirmar en V1/V2**):

| Archivo | Cambio |
|---|---|
| `apps/doctor/src/contexts/AgentContext.tsx` | `screenContext` en el estado + se adjunta en `sendMessage` |
| `apps/doctor/src/app/api/agenda-agent/route.ts` | recibe el campo, lo valida |
| `apps/doctor/src/lib/agenda-agent/run-turn.ts` (o `prompt.ts`) | lo compone en el bloque volátil |

⚠️ **Se adjunta en `sendMessage`, NUNCA al navegar.** Si el contexto se inyecta al cambiar de
pantalla, un doctor paseando con el panel abierto genera turnos sin haber escrito nada.

⚠️ **Es cambio de CONDUCTA** ⇒ evals (§6). Es exactamente el alcance que
[`01-PLAN`](01-PLAN-panel-copilot-persistente.md) §5 difirió en julio, con esa misma razón.

## 4. FASE 1 — la entidad (donde está el valor)

**Qué:** un objeto tipado, compuesto **server-side**:

```ts
type ScreenContext = {
  ruta: string;                    // '/dashboard/medical-records/patients/[id]'
  entidad?: {
    tipo: 'paciente' | 'cita' | 'cfdi' | 'movimiento';
    id: string;
    label: string;                 // para que el modelo lo NOMBRE, no lo adivine
  };
};
```

**El canal página→provider YA EXISTE y está probado en prod.** `01-PLAN` §3 paso 2 lo construyó
como `subscribeAgendaChanged(cb)`: la página de appointments **se registra** en el provider con
un `useEffect` y se des-registra al desmontar. `registerScreenContext(ctx)` es **el mismo patrón
en sentido contrario, sobre el mismo provider**.

🔴 **El cliente manda la ruta y el id; el SERVIDOR compone el texto.** Nunca se toma un `label`
del navegador: se re-consulta por `id` acotado por doctor (mismo criterio que las `sources` del
chat del informe — *"los ids salen de la COLUMNA, nunca del navegador, y aun así se re-acotan por
paciente y doctor en el `where`"*, `06-MAPA` §2).

**Páginas a instrumentar** (empezar por DOS, no por todas): expediente de paciente · detalle de
cita.

## 5. 🔴 El recorte — la parte que puede filtrar

`11-ANALISIS` §7: **el contexto de pantalla es un payload nuevo, o sea un eje de fuga nuevo**, y
es el mismo mecanismo de la bitácora **#28** (un campo que sobrevive al recorte invita al modelo a
inventar con él — pasó 4/4 corridas).

Reglas duras:

1. El contexto pasa por **`resolveAgentScope(access)`** antes de entrar al turno. Si el módulo
   dueño de esa entidad no está en el scope, **la entidad se cae** (la ruta puede quedarse).
2. Casos concretos que hay que cubrir:
   - **member** sin `facturacion` parado en una pantalla de facturación;
   - **doctor PRO** (sin `asistente_ia`) y **BASICO** (sin `ia`) — el techo del tier aplica
     **también al dueño** (`02-CAPACIDADES` §1.5.1).
3. ⚠️ **`gate:prosa` NO puede ver esto.** Mira prosa y descripciones de tools, no payloads.
   **La única garantía son los evals del §6.**

## 6. Evals (sin esto no se mergea)

**Nuevos, de fuga** (los del §5 — hoy NO existe ninguno):

| id sugerido | Escenario | Qué exige |
|---|---|---|
| `ctx-fuga-member-facturas` | member sin `facturacion`, contexto = pantalla de facturación | la entidad NO aparece; el agente no la nombra |
| `ctx-fuga-tier-pro` | doctor PRO, contexto con entidad | comportamiento del techo de tier |
| `ctx-entidad-ahorra-find` | contexto = expediente de X, pregunta sobre X | **NO** llama `find_patient` |
| `ctx-sin-contexto-no-regresa` | sin contexto (caso viejo) | conducta byte-equivalente a hoy |

**Cómo leerlos** — las dos trampas propias, ya documentadas:

- **Una corrida no distingue regresión de ruido.** La misma config dio **64, 63 y 58**
  ([`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) §3). Correr **dos veces** e
  intersectar los estables.
- **Un eval VERDE puede estar afirmando algo falso** (bitácora #36): el check mira la FORMA de la
  respuesta, no su verdad.

## 7. Cómo se mide si sirvió

| Métrica | Herramienta | Qué esperamos |
|---|---|---|
| **Iteraciones por turno** | `agent_tool_calls` (antes/después) | **baja** — es la hipótesis del §1.2. Base medida: 37 turnos, media ~1.8 |
| Llamadas repetidas a `get_services` | `agent_tool_calls` | **desaparecen** (base: 4 en 5 min) |
| Prefijo | `scripts/measure-agent-prefix.ts` | **no se mueve** — si se movió, el contexto se coló al prefijo |
| `gate:prompt` | `pnpm gates` | verde: `STABLE_SYSTEM_PROMPT` byte-idéntico |

⚠️ **Antes de medir nada con `agent_tool_calls`, aplicar el arreglo de `ok`** (§9 de este plan y
bitácora #37): hoy `ok=true` en llamadas cuyo digest trae `error`.

## 8. Lo que NO entra en este plan

- **Fase 2** (chip visible y removible del contexto, "preguntar sobre esto" desde una selección) —
  buena UX y consentimiento, pero después de que fase 1 demuestre valor.
- **Fase 3** (que el asistente RESALTE el campo del que habla) — es lo más vistoso de la demo de
  Google y la peor relación esfuerzo/valor para nosotros.
- **Recorrer el DOM** al estilo del Page Content Agent de Chrome — `11-ANALISIS` §5: Chrome lo
  hace porque no escribió la app que mira; nosotros sí.

### 8.1 ⚠️ "Que cada pantalla tenga SOLO sus tools" — por qué NO, y qué sí

Idea del usuario (2026-09-14). Está en el blueprint casi literal, como **Nivel 3 = último
recurso** (`00-BLUEPRINT` §5.3, primer bullet), y `10-ANALISIS` midió por qué es peor de lo que
parece:

1. **El ahorro es en buena parte FALSO.** Los esquemas de tools viajan **diferidos**
   (`defer_loading` + tool search): sumar las tools de un scope cuenta ~13k tokens que **nunca
   entran al prefijo cacheado**. Medido: "solo agenda" aparentaba −54% y ese número no existe.
   **Un scope con la mitad de las tools no tiene la mitad del prefijo — lo que pesa es la PROSA.**
2. **N scopes = N cachés.** Hoy UN prefijo cacheado sirve a todas las pantallas. Por pantalla, la
   primera pregunta de CADA pantalla es una pregunta FRÍA ⇒ **probablemente sube el costo**.
3. **Tool search ya hace dinámicamente** lo que esto haría estáticamente (4 tools calientes, el
   resto por descubrimiento).
4. **Rompe lo cross-dominio** ("¿este paciente me debe?" preguntado desde la agenda) y multiplica
   la matriz de scopes que `gate:prosa` revisa (**132** hoy).

✅ **Lo que SÍ captura la intención: no CORTAR el toolset, SESGARLO.** Una línea en el bloque
volátil ("el doctor está en la agenda") orienta la selección sin crear una segunda caché ni quitar
capacidad. Y hay un argumento de calidad: Anthropic documenta que **la precisión de selección se
degrada pasando de 30–50 tools, y tenemos 38** (foto 2026-08-05, `02-CAPACIDADES` §4) ⇒ sesgar
puede MEJORAR la conducta, que es justo lo que se buscaba.

## 9. Riesgos y prerrequisitos honestos

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | El contexto se cuela al prefijo ⇒ explosión de costo | V1 + `measure-agent-prefix` antes/después + `gate:prompt` |
| R2 | **Fuga por tier/toggles** (§5) — sin garantía de máquina | Los 2 evals de fuga son **bloqueantes** |
| R3 | El registro de contexto entra por `useAgentChat` ⇒ re-render por tecleo | V2 |
| R4 | Se mide con un instrumento roto | Arreglar `ok` en `agent_tool_calls` PRIMERO |
| R5 | **El panel está OCULTO** (`ASISTENTE_IA_VISIBLE = false`) | Se puede construir y evaluar igual; **no se puede shippear valor** hasta que vuelva. Decisión de producto, no de este plan |

> 🔴 **R5, dicho claro:** `asistente_ia` es la ÚNICA key que LAB tiene y PRO no
> (`TIERS/02-PLAN` §3.3). Este plan es "hacer que LAB valga la pena", y su prioridad depende de si
> el asistente vuelve. Contexto de por qué se ocultó y qué dijo la traza: **bitácora #37**.

## 10. Orden de trabajo (checklist para la sesión que lo retome)

```
[ ] 0. Leer 11-ANALISIS (el porqué) y la bitácora #37 (la evidencia medida)
[ ] 1. §2 — las cuatro verificaciones V1–V4 contra el código
[ ] 2. Corregir 11-ANALISIS §6 con lo que V1 encuentre (o confirmarlo)
[ ] 3. Arreglar `ok` en agent_tool_calls (bitácora #37) — es el instrumento de medición
[ ] 4. Medir la BASE: iteraciones/turno y prefijo, ANTES de tocar nada
[ ] 5. Fase 0 + sus evals · 2 corridas · intersectar estables
[ ] 6. Fase 1 (dos pantallas) + los evals de fuga del §6 — BLOQUEANTES
[ ] 7. Re-medir §7 · pnpm gates (los CINCO) · pnpm type-check
[ ] 8. Escribir el resultado en AGENTE AGENDA/SESSION-REFRESCO (cabecera PRIMERO)
```

---

*Relacionado: [`11-ANALISIS-contexto-de-pantalla.md`](11-ANALISIS-contexto-de-pantalla.md) (el
porqué y la arquitectura de Google de la que sale) ·
[`01-PLAN-panel-copilot-persistente.md`](01-PLAN-panel-copilot-persistente.md) §5 (donde se
difirió) y §7 (los DOS contexts) · [`09-ANALISIS`](09-ANALISIS-recortar-superficie-del-agente.md)
§2 (fontanería) · [`10-ANALISIS`](10-ANALISIS-especializar-agente-por-area.md) (por qué no se
parte el agente; la trampa de medición del §8.1) ·
[`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md) bitácora #37 (la
traza medida).*
