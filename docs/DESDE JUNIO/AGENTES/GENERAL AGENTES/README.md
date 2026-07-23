# 📁 GENERAL AGENTES — índice

> **La capa que pega todo.** Las carpetas hermanas (`AGENTE AGENDA/`, `AGENTE FACTURAS/`, …)
> documentan un dominio cada una; ésta documenta **el asistente como un todo**: la estrategia,
> qué puede y qué no, cómo se revisa, y dónde vive cada superficie de IA del doctor-app.
>
> **Si tienes 5 minutos y una sesión fría:** lee
> [`08-EMPIEZA-AQUI.md`](08-EMPIEZA-AQUI.md) — la estructura, dónde escribir y qué se verifica
> solo. Después `00-BLUEPRINT` (qué construimos) y `02-CAPACIDADES` (qué puede hoy).

## Los docs

| Doc | Qué responde | Tipo |
|---|---|---|
| [`08-EMPIEZA-AQUI.md`](08-EMPIEZA-AQUI.md) | **LA PUERTA DE ENTRADA.** La estructura de toda la carpeta, los 3 tipos de doc, la tabla "dónde escribir cuando termines", los gates automáticos, y la arquitectura de este sistema de docs | vivo |
| [`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) | **Qué estamos construyendo y por qué.** UN asistente con módulos de dominio; el playbook de 6 pasos con el que se construyó cada módulo; el modelo de confianza; y §5, el análisis honesto de escalamiento (los 3 costos que crecen + la escalera de opciones 0→3 + las 3 señales para subir de nivel) | vivo |
| [`02-CAPACIDADES-matriz-que-puede-y-que-no.md`](02-CAPACIDADES-matriz-que-puede-y-que-no.md) | **Qué puede y qué NO puede el asistente**, módulo por módulo, con las fronteras duras y las reglas de desempate. **Es la fuente ÚNICA de los conteos en presente** (tools, módulos, evals, prefijo) y de qué módulos ve un usuario secundario | vivo |
| [`05-METODO-code-review.md`](05-METODO-code-review.md) | **Cuándo un diff merece review completo y en qué modo correrlo.** La heurística validada (lógica replicada + contenido que afirma hechos = siempre completo) y los dos modos, con la lección de costo: el multi-agente local mata el límite de sesión | vivo |
| [`06-MAPA-superficie-IA.md`](06-MAPA-superficie-IA.md) | **Inventario de TODOS los puntos de entrada LLM del doctor-app** (~17), no solo el asistente: las 3 arquitecturas que conviven y la deuda conocida (8 endpoints `*-chat` en el patrón viejo que puede "mentir éxito") | vivo |
| [`07-CONVENCIONES-docs.md`](07-CONVENCIONES-docs.md) | **Cómo se mantiene esta documentación**: los 3 tipos de doc, qué se actualiza y qué se congela, la fuente única de cada número, y los checklists de módulo-nuevo y cierre-de-sesión | vivo |
| [`01-PLAN-panel-copilot-persistente.md`](01-PLAN-panel-copilot-persistente.md) | El panel acoplado que sobrevive la navegación. **SHIPPED** — el doc conserva las desviaciones del plan (§7), los follow-ups abiertos F1–F4 (§8) y las lecciones de Tailwind (§9) | snapshot |
| [`03-PLAN-auditoria-integral.md`](03-PLAN-auditoria-integral.md) | La auditoría transversal A1–A6. **COMPLETA.** Valor hoy: el método. A3 describe la clase de bug dominante (réplicas parciales de un WHERE) y A4 es el procedimiento para re-medir el prefijo | snapshot |
| [`04-PLAN-capa-de-conocimiento.md`](04-PLAN-capa-de-conocimiento.md) | El plan original de la capa de conocimiento. **Supersedido en lo táctico** por `../AGENTE KNOWLEDGE LAYER/`; sigue vigente su decisión **NO-RAG** con razones | snapshot |

## Estado de un vistazo (2026-07-23)

- **5 módulos vivos**: agenda · facturas · fiscal · flujo · expediente. "F1 everywhere" (lectura
  en todos los dominios) está **completo**; las escrituras existen en agenda (citas, rangos,
  bloqueos) y facturas (emisión de CFDI + borradores).
- **Conteos vigentes**: ver `02-CAPACIDADES` §4 — es el único lugar que los declara en presente.
- **Pendientes conocidos**: PR 4 (voz + retiro del ChatWidget v1 + limpieza `/v1` `/v2`) ·
  F3 de facturas · el bug de conducta #23 card fantasma (el #24 over-claim se corrigió 2026-07-23) ·
  la migración de los 8 `*-chat` heredados · re-medir el prefijo (A4).

## Las otras carpetas

| Carpeta | Qué es |
|---|---|
| [`../AGENTE AGENDA/`](../AGENTE%20AGENDA/) | El tronco: donde nació el asistente. Tiene el **playbook** y **la bitácora de fallos en vivo de todos los módulos** |
| [`../AGENTE FACTURAS/`](../AGENTE%20FACTURAS/) | El módulo más grande: emisión de CFDIs, conocimiento fiscal, la serie F2 |
| [`../AGENTE FLUJOS/`](../AGENTE%20FLUJOS/) | Lectura del ledger y la conciliación bancaria |
| [`../AGENTE EXPEDIENTE/`](../AGENTE%20EXPEDIENTE/) | Metadatos de expedientes, con la frontera de privacidad estructural |
| [`../AGENTE KNOWLEDGE LAYER/`](../AGENTE%20KNOWLEDGE%20LAYER/) | Qué conocimiento HABLA el agente vs qué RUTEA a la guía determinista |
| [`../AGENTE WHATSAPP/`](../AGENTE%20WHATSAPP/) | Exploración de un agente paciente-facing por WhatsApp (nada construido) |

*Índice general de la carpeta AGENTES: [`../README.md`](../README.md).*
