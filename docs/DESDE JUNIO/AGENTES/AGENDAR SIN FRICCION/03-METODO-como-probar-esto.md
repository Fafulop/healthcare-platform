# 🧪 MÉTODO — cómo se prueba el agente sin gastar de más (y qué NO se puede probar)

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día.
>
> Sale de la sesión del **2026-08-05**, donde se corrieron DOS suites completas, tres corridas
> dirigidas, dos code reviews y un gate nuevo — y donde varias de las lecciones costaron tiempo
> real. Complementa
> [`../GENERAL AGENTES/05-METODO-code-review.md`](../GENERAL%20AGENTES/05-METODO-code-review.md)
> (cuándo un diff merece review) contestando la otra mitad: **cuánta prueba merece, y de qué tipo.**

---

## 1. La regla que más dinero y tiempo ahorra

**Cuánto hay que correr depende de DÓNDE se editó el prompt, no de cuánto se editó.**

| Editaste… | Superficie de riesgo | Qué correr |
|---|---|---|
| La prosa de UN módulo (`modules/agenda.ts`) | los casos de ese dominio | `EVALS_ONLY=…` (minutos, centavos) |
| El payload o la descripción de UNA tool | sus llamadores | `EVALS_ONLY=…` + `tool-result-cap-check` |
| **Una sección COMPARTIDA** (`INTRO`, `RESILIENCE`, `HOW_TO_PROPOSE`, `RULES` de `prompt.ts`) | **casi todo** | **suite completa ×2** |
| Código de tools/proposals sin tocar prosa | el camino tocado | `EVALS_ONLY` + los check-scripts |

**Medido el 2026-08-05:** de 74 casos con checks parseables, **60 llevan asserts de propuesta**
(57 "NO debe crear card" + 3 "debe crearla"). O sea: tocar `HOW_TO_PROPOSE` pone el 80% de la suite
en riesgo, y "correr sólo lo relevante" deja de ahorrar nada.

> 🔑 **Corolario de diseño, no sólo de pruebas:** una regla de conducta va en la sección MÁS
> ANGOSTA que pueda contenerla. La regla de "una sola pregunta / no pidas permiso" nació en
> `HOW_TO_PROPOSE` (compartida) y se movió a `AGENDA_CITAS_RULES` — el problema era de CITAS, y
> facturas nunca tuvo el goteo. Ponerla donde toca abarata todas las ediciones futuras.
>
> ⚠️ **Sin sobrevender:** el prompt se compone con TODOS los módulos habilitados, así que la prosa
> de agenda sigue presente en un turno de facturas. Lo que la mudanza compra es (a) encabezado que
> la acota semánticamente, (b) desaparece en scopes sin agenda (member/tier), y (c) `HOW_TO_PROPOSE`
> queda quieta. **No** compra aislamiento duro.

## 2. Corridas dirigidas: `EVALS_ONLY`

```bash
EVALS_ONLY=create-sin-hueco,bloqueo-simple  railway run --service pgvector -- \
  npx tsx scripts/agenda-agent-evals.ts
```

~10–20k tokens por caso, segundos cada uno. Es la herramienta correcta para **validar un fix**.
No sustituye a la suite: la suite existe para los casos que NO sospechas — la bitácora **#31** es
un caso de FACTURAS que se rompió por un cambio de payload hecho por otra razón.

## 3. Una corrida no es un resultado: se INTERSECAN dos

El runner marca "estable" tras 3 intentos fallidos **dentro de una corrida**. Eso separa ruido
adentro, **no entre corridas**. La prueba barata es **intersecar los conjuntos estables de A y B**.

Verificado otra vez el 2026-08-05: `f1-billing-status-un-golpe` salió **estable en B y PASS en A**
— es literalmente el caso que la bitácora #31b nombra como ejemplo. **A ∩ B** dejó sólo los dos
fixtures con fecha podrida.

⚠️ **Pero la intersección no es una excusa para ignorar un mecanismo.** `create-sin-hueco` quedó
FUERA de la intersección (PASS en A, estable en B) y aun así era un bug REAL nuestro: el prompt le
pedía al modelo decidir "según lo que exija la cuenta", que el modelo **no puede ver**. La regla
correcta es: *la intersección protege de falsas alarmas; si tienes una explicación mecánica, arregla.*

## 4. Correr la suite sin quedarte ciego

- **`| tee`, NUNCA `| tail`.** `tail` no emite nada hasta que el proceso termina: la corrida A de
  esta sesión se vio como 29 bytes durante 20 minutos y **se perdieron las líneas de reintento de
  los primeros ~30 casos**, así que su conjunto estable no se pudo reconstruir.
- El detalle completo queda en `agenda-evals-last-run.json` (85 casos con `reply`, `toolCalls`,
  `proposals`, tokens). **Guarda una copia por corrida** o la siguiente lo pisa — ahí se compara A vs B.
- El JSON guarda el PRIMER intento, no los reintentos: el veredicto estable/flaky sólo vive en la
  consola. Otra razón para `tee`.
- Secretos: `ANTHROPIC_API_KEY` y **`NEXTAUTH_SECRET`** (en Railway NO se llama `AUTH_SECRET`) del
  servicio `@healthcare/doctor`; la BD, de `pgvector`. Sin el secreto la corrida **no falla**: se
  degrada en silencio (el catálogo SAT y ahora el pre-check freeform), y **no es comparable**.

## 5. Probar los GATES en NEGATIVO (obligatorio)

Un gate que nadie ha visto fallar no se sabe si funciona. Al añadir o tocar uno: **rómpelo a
propósito, comprueba que truena, y deshaz la ruptura.**

Pagó dos veces el 2026-08-05, con la tercera pasada de `gate:prosa`:

1. Se reintrodujo la frase borrada en `agenda.domainRules` → disparó.
2. Se nombró la tool muerta en `RULES` (sección **compartida**) → **la primera versión del gate NO
   disparó**, porque sólo recorría secciones de módulo y descripciones. El negativo destapó que el
   docstring decía "corpus COMPLETO" y era falso.

## 6. Replayar un fallo EN VIVO: `agent_tool_calls`

Desde el 2026-07-31 hay una fila por llamada (turno, orden, duración, input redactado, digest del
resultado). Es lo que convirtió *"el agente tardó como un minuto"* en **7 turnos y 4 min 46 s con
las causas señaladas** ([`00-EVIDENCIA`](00-EVIDENCIA-traza-demo.md)). Consulta y método en
[`../AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`](../AGENTE%20AGENDA/TOOLING-acceso-railway-db-agenda.md).

⚠️ **Nunca diagnostiques un chat pasado con el estado ACTUAL de prod** — la conversación lo mutó.
Primero `created_at` + `activity_logs`.
⚠️ La traza guarda **tools, no texto**: un turno sin tools no deja fila ⇒ el conteo de turnos es un
PISO, no un techo.

## 7. Medir el prompt (y por qué el número importa)

```bash
pnpm gate:prompt          # imprime sha256(STABLE_SYSTEM_PROMPT) y verifica invariantes
```

Anota **sha + chars** en cada cambio de prompt: el sha nuevo **invalida el caché del dueño** al
desplegar, y los chars son el costo de toda pregunta fría (≈ prefijo × 1.25). El 2026-08-05:
`32d19d6d…` / 28,742 → `417383b5…` / **31,143**.

⚠️ **Un número de tokens sin su modelo al lado es una trampa** (`project_agent_cost_optimization`):
el mismo prompt mide distinto en Haiku que en Sonnet. Compara chars, o tokens SIEMPRE con el modelo.

## 8. Los agujeros conocidos de la suite (no los descubras dos veces)

| Agujero | Por qué | Estado |
|---|---|---|
| **No hay ni un caso que AGENDE de verdad** | los 3 asserts positivos cubren rangos, bloqueos y CFDI; todo `create_booking` es un assert NEGATIVO | 🔴 abierto — es el camino que este trabajo reconstruyó |
| **Los campos de contacto no se ejercitan** | `dr-prueba` tiene los 9 toggles en `false`; `missingContactFields` los lee de la BD por `doctorId`, así que un caso no puede pedir otra config | 🔴 abierto — exige poder INYECTAR los settings |
| **`route.ts` nunca corre** | los evals importan `runAgendaAgentTurn` directo ⇒ auth, presupuesto y los 3 loggers quedan fuera para siempre (#32b) | permanente por diseño ⇒ **turno REAL post-deploy** |
| **Fechas hardcodeadas se pudren** | `disponibilidad-dia-bloqueado` (3-ago) y `-rango-exactamente-lleno` (4-ago) fallan desde que esas fechas pasaron | 🔴 abierto — hacerlas relativas a `hoy` |
| **Un caso puede quedar OBSOLETO por diseño** | `fuera-de-horario-ruta-normal` exige "no hay rango": es la premisa de CIT-6, muerta desde `480f7f72` | 🔴 abierto — **invertirlo**, no arreglarlo |

## 9. Lo que NINGUNA de estas herramientas prueba

**El clic.** type-check + los CINCO gates + smoke + evals **no son "probado"**: en el trabajo de
CITAS el type-check estuvo verde TODAS las veces que algo estuvo mal, y la v1 de agendar sin rango
pasó todo eso —incluida una prueba a mano— y se tiró igual, porque el CONTROL era el equivocado.

Para este trabajo la prueba de aceptación es concreta: **crear una cita a mano, a las 16:07, en un
día sin rango publicado.** Si aparece la card y ejecuta, el cambio es real.

---

*Relacionado: [`SESSION-REFRESCO`](SESSION-REFRESCO.md) (estado y hallazgos) ·
[`../GENERAL AGENTES/05-METODO-code-review.md`](../GENERAL%20AGENTES/05-METODO-code-review.md) ·
[`../GENERAL AGENTES/08-EMPIEZA-AQUI.md`](../GENERAL%20AGENTES/08-EMPIEZA-AQUI.md) §5 (los gates).
Creado 2026-08-05.*
