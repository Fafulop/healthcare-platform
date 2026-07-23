# 🚧 La frontera: ¿cómo sabe el agente cuándo usar CONOCIMIENTO y cuándo usar TOOLS?

> 🔒 **SNAPSHOT — 2026-07-14.** No se actualiza (su "46 casos hoy" del §4 es de esa fecha).
> ⚠️ **Pero su contenido NO ha caducado y es de los más importantes de la carpeta:** la regla
> **"Estado → TOOLS · Cómo-funciona → CONOCIMIENTO"** y los 5 mecanismos que la sostienen
> siguen gobernando el diseño. El diagnóstico (`04`) confirmó que la frontera se sostiene en
> vivo. Estado de la capa: [`README.md`](README.md).

> **Qué es este doc.** La preocupación #1 del usuario, y la decisión de diseño más importante de
> toda la capa. Si esta frontera se difumina, el agente inventa números (alucinación) o responde
> "cómo funciona" con datos viejos. La buena noticia: es la MISMA frontera que la industria
> identificó como el guardarraíl #1 en 2026 (ver `03`), y ya tenemos las piezas para sostenerla.
> Escrito 2026-07-14.

---

## 1. La distinción, en una línea

> **Estado → TOOLS. Cómo-funciona → CONOCIMIENTO.**

- **Pregunta de ESTADO** ("¿cuánto me deben?", "¿esta cita ya está facturada?", "¿cómo va mi
  conciliación?", "¿quién no ha venido en 6 meses?") → la respuesta es sobre la verdad ACTUAL de
  los datos de ESTE doctor → **una tool** (`get_billing_status`, `get_balance`,
  `get_flujo_status`…). NUNCA se responde con prosa.
- **Pregunta de CÓMO-FUNCIONA** ("¿cómo se reagenda?", "¿qué hace el botón Cobro?", "¿cómo conecto
  Stripe?", "¿qué diferencia hay entre PUE y PPD?") → la respuesta es sobre cómo funciona el
  SISTEMA, estable, igual para todos → **conocimiento** (`get_guia` / la capa nueva).

Respaldo directo de la investigación de grounding 2026 (`03`): *"los números, saldos, tasas y
elegibilidad deben venir de llamadas a la API del sistema, no del texto que el modelo escribió."*
Eso ES esta frontera. Es también la **regla 0** del blueprint (los veredictos de negocio se
resuelven server-side) y la doctrina **"control vs comportamiento"** de Agentforce.

## 2. Los casos borrosos (donde vive el riesgo real)

La frontera es limpia en los extremos; el peligro está en 3 zonas grises:

1. **Mismo sustantivo, distinta intención — "MI X" vs "X".**
   "¿Cómo va **mi** conciliación?" = ESTADO → `get_flujo_status`.
   "¿Cómo **funciona** la conciliación?" = CONOCIMIENTO → guía.
   El discriminador es el intent (tu estado vs el mecanismo), no la palabra. Primo directo de la
   **regla 10 de agenda** (re-consultar SIEMPRE para preguntas de estado).

2. **Preguntas MIXTAS — necesitan ambas.**
   "¿Cómo reagendo **esta** cita?" → conocimiento (el flujo: reagendar exige una cita existente,
   es una acción atómica) + posiblemente una tool (para ubicar la cita y/o proponer la acción). El
   agente debe poder EXPLICAR el flujo Y actuar, en el mismo turno.

3. **El fallo peligroso — responder ESTADO con CONOCIMIENTO.**
   "Según cómo funciona la facturación, probablemente debes ~$X" — FABRICAR un número desde el
   texto de cómo-funciona en vez de llamar la tool. Es exactamente lo que la investigación 2026
   dice que NO debe pasar. Este es el fallo que la frontera existe para prevenir.

## 3. Cómo decide el agente — los 5 mecanismos (defensa en capas)

Ningún mecanismo solo basta; se apilan (igual que el tier de escritura no depende solo de que el
modelo "no falle"):

1. **Descripciones de tools que trazan la línea.** El modelo rutea por las DESCRIPCIONES (probado
   en este código: distingue bien `get_cfdis` vs `get_sat_cfdis` porque las descripciones declaran
   la distinción). La tool de conocimiento (`get_guia`) declara "explica CÓMO funciona X; para TU
   estado usa las tools de datos". Las tools de datos declaran "el estado actual de…".

2. **Regla explícita en el prompt.** Una sección corta que fija la frontera: *estado → siempre una
   tool; cómo-funciona → get_guia; JAMÁS respondas una pregunta de estado con conocimiento; ante
   duda sobre datos de ESTE doctor, llama una tool.* (Sección compartida, no por-módulo — es un
   invariante global.)

3. **El contenido de conocimiento apunta de vuelta.** Cada tema de `get_guia` TERMINA con "para TU
   situación, pregúntame X" (link a la capa de datos). Así el propio conocimiento re-rutea las
   preguntas de estado hacia las tools en vez de tentar al modelo a improvisar.

4. **Comportamiento de declinar-cuando-no-sabe.** El fallo sutil NO es "la guía está mal" — es "no
   hay guía para este rincón y el modelo improvisa pasos de UII en vez de decir 'no tengo el
   detalle, aquí está la sección'". Es un comportamiento prompteable Y evaluable (ver §4).

5. **Control server-side (Agentforce "control vs comportamiento").** Lo que DEBE cumplirse siempre
   vive en código, no en el prompt: los veredictos ("¿facturada?", "¿vencida?") ya se resuelven
   server-side. El conocimiento nunca calcula un veredicto — solo explica.

## 4. Cómo se HACE CUMPLIR: las clases de eval (el gate)

La frontera no es una buena intención — se prueba. Clases de eval nuevas (heredan la disciplina
de la suite existente, 46 casos hoy):

- **(a) Ruteo cómo-funciona:** "¿cómo funciona X?" → llama `get_guia` del tema correcto (no
  fabrica, no llama tool de datos).
- **(b) Frontera estado→tool (LA crítica):** "¿cómo va MI conciliación?" → llama `get_flujo_status`,
  JAMÁS responde con la guía. Assert duro. Esta clase es, según la industria 2026, el guardarraíl
  más importante de todo el sistema.
- **(c) Anti-fabricación:** una pregunta de estado NUNCA produce un número que no vino de una tool.
- **(d) Declinar honesto:** una pregunta de UI sin guía autorizada → el modelo dice "no tengo el
  detalle exacto, aquí está la sección" en vez de inventar pasos. Assert: no inventa un botón/paso
  que no existe.
- **(e) Los negativos existentes se conservan:** E7 (no calcula ISR), sin consejo fiscal,
  sin contenido clínico.

## 5. Por qué esto es TRATABLE (no una fuente infinita de alucinación)

- La alucinación de conocimiento se acota con **contenido autorizado + verificado** (no recall del
  modelo) — el review contra código al escribir cada tema (cazó 2 errores en F1.5).
- La alucinación de estado se elimina **estructuralmente**: el número viene de una tool o no
  aparece. La frontera hace que "estado" nunca dependa de prosa.
- El riesgo residual está en los **bordes no-autorizados** (temas sin guía) → lo cubre el
  comportamiento de declinar (mecanismo 4 + eval d).
- Y aunque el modelo "cayera", el tier de escritura (confirmación del doctor) y la ausencia de
  tools destructivas siguen siendo la última línea — como probó A6 (sondas de inyección, 3/3).

## 6. La decisión que esto NO resuelve (va en `03`)

Esta frontera responde CUÁNDO usar conocimiento vs tools. NO responde cuánto conocimiento HABLA el
agente vs cuánto RUTEA a una guía determinista. Esa es la bifurcación de arquitectura — ver
`03` §recomendación.

---

*Relacionado: [`03-INVESTIGACION-y-enfoque.md`](03-INVESTIGACION-y-enfoque.md) (respaldo de
industria + la bifurcación) · [`01-QUE-NECESITAMOS-principios.md`](01-QUE-NECESITAMOS-principios.md)
(las 2 dimensiones) · `../GENERAL AGENTES/00-BLUEPRINT` (regla 0, regla 10). Creado 2026-07-14.*
