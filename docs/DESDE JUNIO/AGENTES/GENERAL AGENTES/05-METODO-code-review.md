# 🔍 Método de code review — cuándo, a qué profundidad, y en qué MODO correrlo

> **Qué es este doc.** El playbook de review para los PRs del asistente (y del repo en
> general), consolidado 2026-07-16 tras el review de F2b. Junta dos lecciones aprendidas en
> vivo: (1) la heurística de QUÉ diffs merecen review completo (validada en F1.5/F2a), y
> (2) la lección nueva de F2b: **el modo multi-agente mata el límite de sesión en sesiones
> largas** — existe un modo INLINE que conserva casi todo el valor a una fracción del costo.

---

## 1. Primero: ¿este diff merece review completo? (heurística validada)

Clasificar el diff ANTES de decidir:

| Tipo de diff | Review | Por qué |
|---|---|---|
| **Lógica replicada** (una fórmula/query/regla que ya vive en otro lado y se re-implementa: el builder de impuestos vs el form, el WHERE de pendientes vs el veredicto, computePpdStatus) | **COMPLETO, sin preguntar** | La paridad se rompe en silencio; el drift entre copias es el bug clásico. 8/8 hallazgos de F1.5 salieron de aquí y del renglón siguiente. |
| **Contenido que afirma hechos** (strings curados de conocimiento: GUIAS, domainRules, reglas SAT/legales, textos de UI que describen el sistema) | **COMPLETO, sin preguntar** | Un hecho mal escrito se vuelve una respuesta confiadamente incorrecta a TODOS los doctores (ej.: G03 mal atribuido y el umbral $2,000 — cazados por review en F1.5). |
| **Mecánico / auto-anunciante** (renames, registro de un módulo, un import, cambios que truenan en build si están mal) | Pase inline y decirlo | El type-check y los evals ya lo cubren; el review formal produce cero hallazgos (medido). |
| **Mixto** | Completo, SCOPEADO a las partes riesgosas | No pagar el review del boilerplate. |

**Datos que validan la heurística:** F1.5 (2 finders profundos → 8/8 hallazgos reales, los
gordos en lógica replicada y guías curadas) · F2a (8 ángulos → 9 hallazgos, headline en la
honestidad del catálogo = contenido que afirma hechos) · F2b (inline → 4 hallazgos, headline
una carrera de doble emisión en la frontera propuesta→ejecución) · F2c (inline PRE-commit,
primer ejercicio de este playbook → 0 correctness / 3 cleanup aceptados — la diferencia vs
F2b: las lecciones del review anterior se aplicaron DURANTE el build, p. ej. el ángulo de
carreras ya estaba resuelto en el diseño; el review barato confirmó, no corrigió).

## 2. Los DOS modos de correr el review completo

### Modo A — multi-agente (8 finders en paralelo + verificadores)

Cómo funciona: `/code-review` lanza ~8 agentes finder independientes (3 de correctness:
línea-por-línea, comportamiento-eliminado, trazado cross-file; reuse; simplificación;
eficiencia; altitude; convenciones) y después un verificador por candidato que dictamina
CONFIRMED/PLAUSIBLE/REFUTED.

- **Fortalezas:** ojos frescos SIN memoria de las intenciones del autor (el valor más alto
  cuando el mismo LLM escribió el código horas antes); amplitud exhaustiva; los ángulos no se
  contaminan entre sí.
- **⚠️ Costo aprendido en vivo (2026-07-16):** los agentes fork **heredan TODO el contexto de
  la conversación**. Al final de una sesión larga, 8 forks ≈ 8× el contexto del día entero →
  **mató el límite de sesión al instante** (los 8 finders murieron con "session limit" antes
  de producir un solo hallazgo).
- **Regla de uso:** solo al INICIO de una sesión fresca (contexto chico → forks baratos), o
  como pase independiente diferido ("mañana en sesión nueva").

### Modo B — inline (mismos ángulos, secuencial, sin subagentes)

Cómo funciona: el MISMO checklist de ángulos, corrido por el asistente en la sesión actual,
uno tras otro, priorizando por riesgo. Verificación de cada candidato en el momento
(etiquetas CONFIRMED/PLAUSIBLE igual que el modo A).

Checklist de ángulos (el orden es por rendimiento típico):
1. **Trazado cross-file del contrato** — para cada función cambiada, campo por campo contra
   sus consumidores reales (ej. F2b: params de la propuesta → executor → body que LEE el
   endpoint, incluido el shape de la respuesta de éxito). El ángulo que más bugs reales caza.
2. **Comportamiento eliminado** — por cada línea que el diff BORRA o reemplaza, nombrar el
   invariante que sostenía y encontrar dónde se re-establece (ej. F2b: las fronteras del
   prompt que se movieron; los evals reemplazados → ¿murió cobertura? — así salió el hallazgo
   de la regla de dos-turnos sin eval).
3. **Línea-por-línea de los hunks riesgosos** — condiciones invertidas, off-by-one,
   falsy-zero, null/undefined, awaits perdidos, copy-paste con variable equivocada. Priorizar
   money-math y guards; no gastar en boilerplate.
4. **Carreras y fronteras temporales** — todo lo que valida en un momento y ejecuta en otro
   (ej. F2b hallazgo #1: hasFactura checado al PROPONER, nadie lo re-checaba al EJECUTAR →
   guard 409 en el endpoint). En este sistema de propuestas, SIEMPRE preguntar: ¿qué cambia
   entre la card y el click?
5. **Reuse/simplificación/eficiencia** — ¿re-implementa algo que ya existe? (grep de helpers
   vecinos); ¿estado derivable?; ¿awaits secuenciales paralelizables?
6. **Altitude** — ¿el fix está a la profundidad correcta o es un caso especial encimado?
   (ej. F2b: el guard de doble emisión pertenecía al ENDPOINT, no solo al pre-check del
   agente — protege también a la UI).

- **Fortalezas:** una fracción del costo (cero forks); el contexto de la sesión AYUDA (el
  autor sabe dónde están los cuerpos); resultado inmediato.
- **Debilidades honestas (decirlas al reportar):** sin ojos frescos — el mismo autor revisa
  su propio código y puede "saber" lo que el código quiere decir; menos exhaustivo en
  amplitud (se prioriza, no se barre todo).
- **Regla de uso:** el default en sesiones largas o cuando el diff se acaba de escribir en
  ESTA sesión. Si el feature es de tier legal/dinero, ofrecer además el pase multi-agente
  diferido a sesión fresca como segunda capa OPCIONAL.

## 3. El protocolo completo (independiente del modo)

1. **Clasificar** el diff (§1). Mecánico → pase inline corto y decirlo; no fingir un review.
2. **Correr los ángulos** (§2) sobre el commit/rango exacto (`git show <sha>`), leyendo la
   función COMPLETA que encierra cada hunk — los bugs en líneas no tocadas de una función
   tocada están en scope.
3. **Verificar cada candidato**: CONFIRMED (construible desde el código) / PLAUSIBLE (estado
   realista lo dispara — carreras, caches fríos, campos opcionales) / REFUTED (citar la
   línea que lo refuta). Reportar CONFIRMED+PLAUSIBLE rankeados por severidad; correctness
   arriba de cleanup siempre.
4. **Aplicar con aprobación del usuario** (regla de siempre: explicar → OK → commit). El
   usuario puede aceptar hallazgos SIN fix (se documentan como watch-items con dueño — ej.
   el guard de IVA en F2a §11, cerrado después en la validación en vivo).
5. **Gates post-fix**: tsc de las apps tocadas (⚠️ apps/api necesita
   `NODE_OPTIONS=--max-old-space-size=6144`) · re-correr los smokes de paridad si el fix tocó
   lógica replicada · re-correr SOLO los evals afectados (no la suite entera — cuestan; la
   suite completa es gate de PUSH, no de cada fix).
6. **Documentar** en el plan del PR (patrón `§11 review` de 07-PLAN/08-PLAN): hallazgos,
   aplicados/aceptados/refutados, gates, y qué quedó limpio — para que la siguiente sesión no
   re-audite lo ya auditado.

## 4. Reglas rápidas (resumen operativo)

- Lógica replicada o contenido fáctico ⇒ review completo SIN preguntar; mecánico ⇒ inline y
  decirlo.
- Sesión larga ⇒ modo INLINE. Multi-agente SOLO en sesión fresca. Nunca 8 forks al final del
  día.
- En el sistema de propuestas, el ángulo #4 (¿qué cambia entre la card y el click?) es
  obligatorio para todo propose_* nuevo.
- Los guards de negocio de escritura van EN EL ENDPOINT cuando protegen a más de un caller
  (la UI también tiene carreras).
- Re-correr solo los evals afectados tras un fix; la suite completa es gate de push.
- Todo review deja rastro en el doc del PR (sección de review con hallazgos y veredictos).

---

*Fuentes: memoria `feedback_code_review_heuristic` (heurística + lección de costo),
`AGENTE FACTURAS/07-PLAN` §11 (review F2a, multi-agente en sesión fresca — 9 hallazgos),
`AGENTE FACTURAS/08-PLAN` §11 (review F2b, inline tras el session-limit — 4 hallazgos),
SESSION-REFRESCO de F1.5 (los 8/8 que validaron la heurística). Creado 2026-07-16.*
