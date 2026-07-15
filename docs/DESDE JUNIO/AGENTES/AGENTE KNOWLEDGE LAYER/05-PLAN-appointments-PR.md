# 🛠️ Plan — PR de conocimiento para appointments (el primero)

> **Qué es este doc.** El PR concreto que cierra el hueco que encontró el diagnóstico (`04`),
> aplicando la recomendación de híbrido-por-tipo (`03` §5). Diseñado 2026-07-14 contra el código
> real (anclas citadas). **Es sorprendentemente chico**: el diagnóstico mostró que la capa
> "hablar" (concepto/flujo) ya funciona y el destino "rutear" (CitasGuide) ya existe — falta solo
> un guardarraíl + un puntero + evals. **Sin corpus nuevo, sin tool nueva.**
>
> **ESTADO 2026-07-14: CONSTRUIDO Y VALIDADO** (uncommitted al escribir esto). Ver §9. El
> guardarraíl vive en `RESILIENCE` (`prompt.ts`), +3 evals `kl-*`, suite 48/49 PASS · 1 WARN
> soft (no relacionado) · 0 FAIL. Comportamiento verificado en vivo: rutea/ofrece en vez de
> improvisar; el concepto se sigue hablando.

---

## 1. Objetivo

Cerrar el ÚNICO hueco del diagnóstico: el agente a veces **improvisa pasos de UI** para preguntas
de navegación ("¿cómo creo un horario paso a paso en la app?"), en vez de rutear a la guía
determinista que ya existe. Sin romper lo que ya funciona (concepto/flujo se HABLA; estado va a
tools).

## 2. Diseño (aplica el corte por tipo de `03` §5)

- **HABLAR (concepto/flujo): sin cambios.** El `AGENDA_DOMAIN_MODEL` (`modules/agenda.ts:15`) ya lo
  hace bien (diagnóstico: 3/3). No se toca.
- **RUTEAR (pasos de UI): una regla nueva de prompt.** Un guardarraíl global: el agente NO ve la
  interfaz, así que nunca inventa pasos/botones; ofrece HACER la acción por chat (si está a su
  alcance) y dirige al **Centro de ayuda** para las guías con capturas. Es un cambio de prompt, no
  una tool ni un corpus.

**Por qué una regla de prompt y no una tool/corpus** (lección del diagnóstico): el contenido
"hablar" ya está en el prompt y el destino "rutear" (`CitasGuide.tsx`, 1,141 líneas, vivo en
`/dashboard/ayuda`) ya existe. Un `get_guia` para appointments sería redundante — solo hace falta
que el agente SEPA declinar-improvisar y apuntar a la guía. La regla es global por diseño (sirve
también a expedientes, que también tiene guía viva); se VALIDA en appointments.

## 3. Archivos tocados

| Archivo | Cambio |
|---|---|
| `apps/doctor/src/lib/agenda-agent/prompt.ts` | +1 bullet en `RESILIENCE` (~línea 51-74): la regla de navegación de UI. Sección COMPARTIDA (no por-módulo) — es un invariante global. |
| `apps/doctor/scripts/agenda-agent-evals.ts` | +3 evals (§5) |
| `docs/…/GENERAL AGENTES/02-CAPACIDADES` §4 | actualizar conteo de evals (46 → 49) cuando el PR aterrice |

Sin migraciones, sin cambios de API, sin tools nuevas, sin corpus.

## 4. La regla exacta (borrador para review)

Nuevo bullet en `RESILIENCE` (`prompt.ts`), después de "Imposible por reglas del sistema":

```
- **Navegación de UI / "¿dónde hago click?"**: NO ves la interfaz visual (botones, menús,
  pestañas), así que NUNCA inventes pasos de UI ni nombres de botones — un click-path
  equivocado es peor que ninguno. Para "¿dónde/cómo hago X en la pantalla?, paso a paso en la
  app": (a) ofrece HACERLO tú por aquí si es una acción a tu alcance (crear/mover/cancelar cita,
  rangos, bloqueos), y (b) dirige al **Centro de ayuda** (Ayuda, en el menú lateral) para las
  guías con capturas. OJO: CÓMO FUNCIONA un flujo (reagendar exige una cita existente; borrar un
  rango no toca citas) SÍ lo explicas — eso es concepto, no navegación.
```

La última oración es crítica: evita que el guardarraíl **sobre-rutee** — las preguntas de concepto
se siguen HABLANDO, no se mandan a la guía. (El diagnóstico probó que el agente ya distingue; la
regla lo hace explícito y evaluable.)

## 5. Evals (+3, `agenda-agent-evals.ts`)

Clase nueva "knowledge-layer" (heredan la disciplina de la suite; nombres `kl-*`):

1. **`kl-ui-nav-pasos-app`** (el caso que improvisó): "¿cómo creo un horario, paso a paso en la
   app?" → checks: `no-proposals` + `reply-match` de que dirige al Centro de ayuda u ofrece hacerlo
   (`/(centro de ayuda|men[uú].*ayuda|puedo (crear|hacerlo)|lo hago)/i`). Assert duro: cero
   propuestas espontáneas.
2. **`kl-ui-nav-donde-click`**: "¿en qué parte de la pantalla hago click para reagendar?" → mismo
   patrón (rutea/ofrece, no inventa).
3. **`kl-concepto-no-sobre-rutea`** (defensivo — evita regresión por el guardarraíl nuevo): "¿cómo
   funciona reagendar una cita?" → checks: `tools-nonempty` NEGADO (no requiere tool) NO — mejor
   `reply-match` de que EXPLICA el flujo (`/(una (sola )?acci[oó]n|cancela.*crea|estado final)/i`),
   garantizando que el concepto se sigue HABLANDO y no se manda a la guía.

Método: correr los 3 aislados primero (`EVALS_ONLY`), luego la suite completa (49) — regla del
playbook: prompt tocado → suite completa antes de push. Validación en vivo opcional (barata, es
solo texto).

## 6. Qué NO incluye (fronteras)

- **NO** un `get_guia` para appointments (redundante — ver §2).
- **NO** contenido/corpus nuevo (la guía ya existe; el concepto ya está en el prompt).
- **NO** que el agente LEA el contenido de las guías. El agente RUTEA (emite un puntero de una
  línea), no INGIERE el texto de la guía a su contexto. Ver §6.1.
- **NO** reescribir `CitasGuide` a data-driven.
- **NO** screen-context (el agente sabiendo en qué página estás) — PR aparte, mejora pero no bloquea.

### 6.1 DESCARTADO: "el agente lee las guías" / fuente-única compartida (por riesgo de alucinación)

Se exploró (2026-07-14) hacer de `/dashboard/ayuda` una base de conocimiento que el agente LEYERA
(fuente única, dos consumidores). **Descartado**, por dos razones:
1. **Riesgo de alucinación por volumen.** Que el agente ingiera el texto de muchas guías a un mismo
   contexto es exactamente el modo de fallo que la investigación 2026 marca: el modelo mezcla,
   malee o exagera fuentes cargadas ("lost in the middle"). Rutear (puntero de una línea) mantiene
   el contexto casi sin prosa → superficie de alucinación mínima. Las TOOLS no tienen este problema
   porque devuelven DATOS anclados (reales, de la BD), no prosa que se pueda mezclar.
2. **Sube el costo de exactitud.** En cuanto el agente LEE una guía, la exactitud de esa guía se
   vuelve un vector de alucinación (relata como verdad lo que diga). Rutear deja que el HUMANO lea
   y juzgue la guía visual.

Corolario: la capa de conocimiento se mantiene **route-first y THIN** — el agente HABLA solo el
concepto/flujo (ya en el prompt, chico y exacto) y RUTEA todo lo demás. La bifurcación "fuente
única / forma canónica" de `00` §2 queda PARQUEADA; solo se reabre si algún día hay una razón
fuerte para que el agente narre más contenido de UI, aceptando el costo de arriba.

## 7. Verificación y tier de review

- **Gate:** prompt tocado → **suite completa (49) antes de push**, 0 FAIL. Los 3 evals nuevos
  aislados primero.
- **Review:** cambio de prompt de COMPORTAMIENTO (no lógica replicada ni contenido que afirma
  hechos) → pasada inline del wording + la suite como gate. El caveat de sobre-ruteo lo cubre el
  eval #3.
- **Riesgo:** bajo — un bullet de prompt, reversible, cuyo fallo (sobre-rutear o seguir
  improvisando) se auto-anuncia en los evals.

## 8. Follow-ups (no en este PR)

1. **Generalizar la cobertura del Centro de ayuda**: expedientes ya tiene guía viva; las pestañas
   Perfil/Práctica de `/dashboard/ayuda` están `disabled` y `PagosGuide` (1,492 líneas) está
   construida pero NO enganchada — engancharla es trabajo de UI aparte.
2. **Secciones de solo-conocimiento** (mi-perfil, etc.): one-liners "esto es X, ve a Ayuda" — el
   mismo guardarraíl ya las cubre parcialmente; formalizar por sección después.
3. **La bifurcación "fuente única"** (`00` §2): decidir forma canónica solo si/ cuando queramos que
   el agente HABLE más contenido de UI en vez de rutear.
4. **Screen-context** (PR aparte con evals).

## 9. Cómo quedó (construido 2026-07-14)

Idéntico al diseño — sin desviaciones:
- **`prompt.ts`**: +1 bullet en `RESILIENCE` (guardarraíl de navegación de UI, con el carve-out de
  concepto). Sección compartida, no por-módulo.
- **`agenda-agent-evals.ts`**: +3 evals `kl-*` (`kl-ui-nav-pasos-app`, `kl-ui-nav-donde-click`,
  `kl-concepto-no-sobre-rutea`). Suite ahora **49 casos**.
- **Sin** tool nueva, corpus, ni cambio de `run-turn.ts`.

**Validación:** los 3 `kl-*` PASS aislados y en suite completa (**48/49 PASS · 1 WARN soft · 0
FAIL**; el WARN es `vencida-cancel-warning`, data-dependent por el paciente de prueba "vvvvvv"
inexistente hoy — NO relacionado a este cambio). Réplicas verificadas en vivo:
- `kl-ui-nav-pasos-app` (el que improvisaba): ahora abre con "no tengo acceso a la interfaz
  visual… arriesgaría decirte pasos incorrectos", ofrece crearlo por chat Y dirige al Centro de
  ayuda. El click-path inventado del diagnóstico DESAPARECIÓ.
- `kl-concepto-no-sobre-rutea`: el flujo de reagendar se sigue HABLANDO completo desde el modelo
  de dominio, sin deflectar a la guía — el carve-out se sostiene.

Type-check ✓. **SHIPPED** (`a9e57907` prompt+evals · `5ac3d4ca` docs) y **VALIDADO EN VIVO EN
PROD** por el usuario 2026-07-14: (1) "¿cómo funciona reagendar?" → explicó el flujo completo
sin deflectar (concepto se HABLA); (2) "¿cómo creo un horario paso a paso en la app?" → declinó
inventar clicks, ofreció hacerlo por chat y dirigió al Centro de ayuda — el click-path improvisado
del diagnóstico DESAPARECIÓ. Ambas mitades confirmadas en prod.

---

*Relacionado: [`04-DIAGNOSTICO-appointments.md`](04-DIAGNOSTICO-appointments.md) (la evidencia) ·
[`03-INVESTIGACION-y-enfoque.md`](03-INVESTIGACION-y-enfoque.md) §5 (la recomendación) ·
[`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) (la frontera). El
prompt se edita en `prompt.ts`, NUNCA en `run-turn.ts`. Creado 2026-07-14.*
