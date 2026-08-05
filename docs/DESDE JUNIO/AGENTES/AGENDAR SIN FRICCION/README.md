# 📁 AGENDAR SIN FRICCIÓN — índice

> **Qué es esta carpeta.** El trabajo de hacer que **agendar una cita con el asistente cueste
> UN turno**, no siete. Nace el **2026-08-05** de dos cosas que se juntaron: la incoherencia
> que dejó el picker freeform (CITAS `480f7f72`) y una **demo con una doctora real que tardó
> 4 min 46 s en crear una sola cita** — reconstruida turno por turno desde la traza, no
> recordada.
>
> No es un dominio nuevo del asistente: `agenda` sigue siendo el módulo. Es un **workstream**
> con una tesis — *el cuello de botella no es la inteligencia del modelo, es cuántas veces
> tiene que preguntar* — y vive aparte porque toca a la vez el agente, el picker y la
> configuración de campos.

---

## Los documentos

| # | Doc | Tipo | Para qué |
|---|---|---|---|
| — | [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | ESTADO / BITÁCORA | **Léelo primero.** Dónde quedó todo y qué sigue |
| 00 | [`00-EVIDENCIA-traza-demo.md`](00-EVIDENCIA-traza-demo.md) | DECISIÓN / REFERENCIA | La demo, turno por turno, desde `agent_tool_calls`. Las 4 causas medidas |
| 01 | [`01-HALLAZGO-campos-de-cita.md`](01-HALLAZGO-campos-de-cita.md) | DECISIÓN / REFERENCIA | El modal "Campos de Cita" gobierna al agente desde una sección de un flujo MUERTO |
| 02 | [`02-PLAN-agendar-freeform.md`](02-PLAN-agendar-freeform.md) | DECISIÓN / REFERENCIA | El plan: freeform siempre, una sola pregunta, y qué NO se toca |
| 03 | [`03-METODO-como-probar-esto.md`](03-METODO-como-probar-esto.md) | DECISIÓN / REFERENCIA | **Cuánta prueba merece un cambio según DÓNDE se editó**, corridas dirigidas, gates en negativo, y los 5 agujeros conocidos de la suite |

## En una frase

**El agente nunca se equivocó en la demo — y aun así tardó casi cinco minutos.** Cada llamada
fue correcta, cada lista vacía fue honesta, y no inventó ni un horario. Lo que costó los
minutos fue **estructural**: tres campos de contacto obligatorios, un rango que hubo que
inventar para poder agendar, y una pregunta por dato en vez de una sola.

> ✅ **Estado al 2026-08-05:** los 7 cambios del plan están **implementados y verificados**
> (2 code reviews · 12 hallazgos · `get_availability` eliminada · gate nuevo) pero **sin
> commitear, sin desplegar y sin probar a mano**. Lee
> [`SESSION-REFRESCO`](SESSION-REFRESCO.md) antes de tocar nada.

## Las tres cosas que esta carpeta quiere que no se re-aprendan

1. **Un formulario junta N datos en UNA interacción; un chat los junta en N viajes.** Esa es
   la desventaja estructural del chat, y no se arregla con un modelo mejor — se arregla
   preguntando todo junto y pidiendo menos.
2. **Una lista vacía disparó todo el desvío.** `get_availability` devolvió `[]` para el 11 de
   agosto (no había rango), así que la doctora tuvo que hacer que el agente **creara un rango**
   sólo para poder agendar. El picker habría tomado las 14:30 directo.
3. **La suite de evals no puede ver este fallo.** Corre contra `dr-prueba`, el único doctor con
   los nueve toggles de contacto en `false`. La demo corrió con los nueve en `true`. No es
   flaky: es **invisible por construcción** (`01` §4).

## Relacionado (fuera de esta carpeta)

- [`../../CITAS/SESSION-REFRESCO.md`](../../CITAS/SESSION-REFRESCO.md) §9 — la incoherencia
  picker↔agente, que es de donde salió el encargo.
- [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md) — el
  playbook y **la bitácora de fallos en vivo de TODOS los módulos**. ✅ La demo quedó ahí como
  **bitácora #35** (con puntero a [`00`](00-EVIDENCIA-traza-demo.md)), su cabecera apunta al
  2026-08-05, y las dos correcciones docs↔código están en su drift-log.
- [`../GENERAL AGENTES/10-ANALISIS-especializar-agente-por-area.md`](../GENERAL%20AGENTES/10-ANALISIS-especializar-agente-por-area.md)
  — la pregunta "¿un agente por área?". Esta carpeta le aporta un eje que ese análisis no
  tenía: **turnos**, no tokens ([`02`](02-PLAN-agendar-freeform.md) §6).
- [`../AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`](../AGENTE%20AGENDA/TOOLING-acceso-railway-db-agenda.md)
  — el método de las consultas read-only que sostienen estos documentos.
