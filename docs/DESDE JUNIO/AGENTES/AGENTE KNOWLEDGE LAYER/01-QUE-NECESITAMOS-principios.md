# 🎯 Qué necesitamos — desde primeros principios

> **Qué es este doc.** La definición de lo que queremos, reformulada desde cero (no heredada del
> plan viejo). Fija el modelo mental que rige todo lo demás en este folder. Escrito con el usuario
> 2026-07-14.

---

## 1. El principio raíz: UN agente, UN punto de contacto

El **AGENTE chat** (el asistente modular que construimos — `agenda-agent`) debe ser el **ÚNICO
punto de contacto** del usuario con el sistema de IA: sus tools, sus acciones y su conocimiento.
No varios chats, no un bot de ayuda por un lado y un agente de acciones por otro. El usuario
pregunta lo que sea, en un solo lugar, y el agente responde o actúa.

Esto está alineado con lo que hacen los líderes (Microsoft Copilot, Salesforce Agentforce): UN
orquestador con muchas tools/skills, no un enjambre de bots (ver `03`). Consecuencia directa: el
ChatWidget v1 (chat viejo, separado) se retira — su existencia contradice "un solo punto de
contacto".

## 2. "Experto" se parte en DOS capacidades independientes

Queremos que el agente sea **experto en TODO el sistema**. Pero "experto" no es una sola cosa —
son dos capacidades ortogonales, y cada sección del sistema necesita una, la otra, o ambas:

| Capacidad | Qué responde | ¿Dónde se necesita? |
|---|---|---|
| **Conocimiento** | "¿qué es esta sección? ¿qué hace cada botón? ¿cómo funciona el flujo X?" (reagendar exige una cita existente, etc.) | **TODAS** las secciones |
| **Tools** | leer los datos REALES de la sección y/o ejecutar acciones en ella | **SOLO ALGUNAS** secciones |

El conocimiento es sobre **cómo funciona el SISTEMA** — estable, igual para todos los doctores.
Las tools son sobre **qué es verdad AHORA** en los datos de ESTE doctor.

## 3. La matriz de cobertura (no es uniforme)

No toda sección necesita tools. Meter tools en todas sería over-kill (costo, superficie de riesgo,
mantenimiento). La cobertura correcta es una matriz:

| Sección | Conocimiento | Tools | Por qué |
|---|---|---|---|
| **/appointments (agenda)** | ✅ | ✅ lectura + propuestas | El dominio más desarrollado; el agente lee citas, propone crear/reagendar/cancelar, Y explica los flujos |
| **/facturacion, /pagos, /sat, flujo** | ✅ | ✅ lectura (F1) hoy, propuestas (F2) después | Datos fiscales/dinero reales + guías |
| **/dashboard/mi-perfil** | ✅ | ❌ | El agente debe SABER qué es y cómo navegarlo; leer o cambiar el perfil real es over-kill |
| **(otras secciones de solo-config)** | ✅ | ❌ (default) | Conocimiento por default; tools solo si hay un caso real |

**Regla de default:** toda sección arranca como **solo-conocimiento**. Se le agregan tools SOLO
cuando hay una necesidad concreta de leer/actuar sobre sus datos. El conocimiento es barato y
universal; las tools se ganan caso por caso.

## 4. Reconciliación con el modelo de 3 capas del blueprint

El blueprint (`../GENERAL AGENTES/04`) ya describía 3 capas. Este modelo de 2 dimensiones no lo
contradice — lo aclara:

- **Datos** (tools de lectura) = "¿qué es verdad ahora?" → la dimensión TOOLS, sub-tipo lectura.
- **Acciones** (propose_*) = "hazlo por mí" → la dimensión TOOLS, sub-tipo escritura.
- **Conocimiento** = "¿cómo funciona X?" → la dimensión CONOCIMIENTO.

Dicho de otro modo: "Datos" y "Acciones" son dos sabores de la MISMA dimensión (tools que tocan el
estado real), y "Conocimiento" es la OTRA dimensión (cómo funciona el sistema, sin tocar estado).
Esa separación es exactamente la frontera que más importa mantener — ver `02`.

## 5. Un buen lugar para empezar: /appointments

Empezamos por appointments porque (a) es el dominio con tools más maduras, así que podemos medir
EMPÍRICAMENTE si el agente YA es experto solo con sus tools + su modelo de dominio del prompt, sin
una guía dedicada; y (b) el resultado se vuelve la plantilla para todas las demás secciones,
incluidas las de solo-conocimiento.

**Pregunta abierta que vale medir AHORA (antes de construir nada):** el módulo agenda ya inyecta un
`AGENDA_DOMAIN_MODEL` en el prompt (`modules/agenda.ts:15`) que enseña flujos e invariantes
(reagendar = una acción; borrar rango no toca citas; rangos no van a Google Calendar). Entonces el
agente YA es fuerte en conocimiento de **dominio/flujos**. Lo que casi seguro NO tiene: conocimiento
de **navegación de UI** ("da click en el botón Reagendar de la fila, luego elige un hueco"). El
diagnóstico de appointments (ver `03` §siguiente paso) mide exactamente ese hueco.

---

*Relacionado: [`00-OVERVIEW-donde-estamos.md`](00-OVERVIEW-donde-estamos.md) ·
[`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) ·
[`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).
Creado 2026-07-14.*
