# INVENTARIO IA — dónde está cada chat y a quién le habla

> **Qué es esta carpeta.** El índice de UBICACIÓN de toda la IA del producto: qué pantalla abre
> cada chat, qué archivo lo llama, contra qué endpoint, y **si va a OpenAI o a Anthropic**.
> Creada 2026-08-27 porque las superficies crecieron a **19** y ya no se sostenían de memoria.
>
> **No es** el doc de arquitectura. El porqué de cada diseño (las 3 arquitecturas A/B/C, la
> debilidad de C, cómo migrar de C a B) vive en
> [`../GENERAL AGENTES/06-MAPA-superficie-IA.md`](../GENERAL%20AGENTES/06-MAPA-superficie-IA.md).
> Este doc contesta *"¿dónde está y a quién le habla?"*; aquel contesta *"¿por qué es así?"*.

## Archivos

| Archivo | Qué es |
|---|---|
| [`01-INVENTARIO-donde-vive-cada-chat.md`](01-INVENTARIO-donde-vive-cada-chat.md) | **La lista completa** — 2 en Anthropic, 17 en OpenAI, con pantalla · componente · hook · endpoint · modelo |
| [`02-COSTO-y-uso-por-doctor.md`](02-COSTO-y-uso-por-doctor.md) | **Cuánto gasta cada doctor y qué funciones usa** (en prod 2026-08-27): dónde se ve en el admin, las 4 trampas del costo, y `surface` — de qué pantalla salió la voz |

## Lo que hay que recordar aunque no leas nada más

1. **2 en Anthropic** (el asistente 🟢 y el chat del FormBuilder), **17 en OpenAI**. Regla mental:
   si llena un formulario o transcribe voz, es OpenAI.
2. **`LLM_PROVIDER=anthropic` no es un interruptor** — ese provider en `lib/ai` es un STUB que
   LANZA. Tumbaría todo lo que pasa por la factory.
3. **`AGENDA_AGENT_MODEL` mueve DOS superficies**, no una: el form-builder cae a esa variable si
   `FORM_BUILDER_CHAT_MODEL` no está puesta — y el form-builder tiene **0 evals**.
4. **Toda la IA vive en `apps/doctor`.** `apps/api` y `packages/*` no tienen ni una llamada LLM.
5. **El costo NO es `totalTokens × un precio`** — hay que agrupar por modelo, el asistente se
   cobra por `budgetTokens` (si no, 3.94× de más) y Whisper por minuto. Todo en el `02`.

## Tipo de documento

**REFERENCIA** (`../GENERAL AGENTES/07-CONVENCIONES-docs.md` §3): describe cómo son las cosas HOY,
así que **se actualiza**. Cuando agregues, quites o migres una superficie de IA —o le cambies el
modelo— actualiza la tabla del `01` en el mismo commit. Es un inventario: su único valor es estar
al día, y la forma de verificarlo está escrita en la cabecera del `01` (el grep que lo levantó).

---

*⬆️ Índice general: [`../README.md`](../README.md).*
