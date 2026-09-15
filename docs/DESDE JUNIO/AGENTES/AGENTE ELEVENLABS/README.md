# 📁 AGENTE ELEVENLABS — índice

> 🌱 **Carpeta en exploración — nada construido.** Un agente de **VOZ** paciente-facing: cada
> doctor tiene un número al que cualquiera llama y una IA contesta 24/7 — consulta
> disponibilidad, agenda, reagenda, cancela. Estrategia: **comprar la parte difícil de voz a
> ElevenLabs** (STT + turn-taking + TTS) y quedarnos el cerebro; build-vs-buy se decide después
> con minutos reales. Investigado 2026-09-10; sin código, sin decisiones comprometidas.

## Qué se sabe

**Los dos modos de ElevenLabs Agents** (la pregunta "¿quién lee el texto?"):

- **Modo 1 (default)**: ElevenLabs corre STT + LLM + TTS; nuestro SaaS participa por
  **webhook tools** que apuntan a nuestros endpoints. Se reusan las TOOLS del asistente, no su
  loop.
- **Modo 2 ("Custom LLM")**: ElevenLabs hace solo oídos/boca y reenvía cada turno a un endpoint
  OpenAI-compatible NUESTRO — nuestro agente es literalmente el cerebro.

**Recomendación: arrancar en Modo 1, diseñar los endpoints para que Modo 2 sea un switch de
config.** Es seguro porque la regla 0 ya vive server-side en el tool layer — un tool call fuera
de línea lo rechaza nuestro endpoint, no el prompt. El moat es el tool layer, agnóstico de
proveedor.

**Mercado:** Docplanner/Doctoralia ya shippeó exactamente esto (*Noa Booking*, voz 24/7 sobre
Twilio, ~2× citas vs call center). La categoría está validada; nuestro diferencial es la
integración con TODA la operación del doctor (expediente · facturas · fiscal).

## Los catches honestos

1. **🔴 Prerequisito duro: el asistente aún no agenda sin rango/slot** — un agente de voz
   agenda por las mismas tools y heredaría el "no hay hueco" falso
   (`../../CITAS/SESSION-REFRESCO.md`). Cerrarlo primero.
2. **En el teléfono no hay card**: la confirmación es verbal. Hay que decidir qué ejecuta el
   paciente directo vs qué sigue siendo propuesta que aprueba el doctor — una sola política
   para voz Y WhatsApp.
3. **Cualquiera puede llamar diciendo ser otra persona.** La industria no lo resuelve
   criptográficamente: riesgo por niveles (cita nueva sin verificación; tocar una existente =
   `confirmationCode` u OTP al número en archivo), nunca revelar detalles a un caller sin
   verificar, y notificar todo cambio al número en archivo. WhatsApp texto viene autenticado
   por el canal mismo (el número emisor); voz es el canal débil. **Política propuesta completa:
   `00-EXPLORACION` §5.**
3. **Voz exige latencia sub-segundo** en los endpoints de tools.

## 🔴 Disponibilidad v2 — el contrato que hay que escribir ANTES de construir cualquier canal

> Anotado 2026-09-14, al leer `agent_tool_calls` por primera vez (bitácora #37 de
> [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)). **Aplica
> igual a voz y a WhatsApp — se decide UNA vez, como la política de identidad.**

**El asistente del doctor MEJORÓ eliminando `get_availability`** (2026-08-05): con el agendado
freeform, el doctor dice la hora y el servidor la valida. **Un agente paciente-facing no puede
hacer eso**: el paciente no propone una hora, hay que OFRECERLE opciones. O sea que la
disponibilidad **vuelve** — pero para otro consumidor y con otro contrato.

| | Asistente del doctor | Agente del paciente |
|---|---|---|
| Quién dice la hora | el **doctor**; el servidor valida | el **paciente** no puede — hay que ofrecer |
| La disponibilidad es… | **fontanería** (un paso) ⇒ se pudo borrar | **la respuesta misma** ⇒ obligatoria |
| Un "no hay horarios" falso | el doctor ve que está mal y le da la vuelta | **el paciente SE VA**, en silencio |

**Lo que de verdad pasó y que no se puede repetir:** `get_availability(2026-08-11)` devolvió
`fechasDisponibles_n: 0` de un día que otra tool reportaba con **2 rangos y 3 citas**. La doctora
real lo rodeó creando un rango a mano. Un paciente no tiene esa salida — se le dice que no hay
nada y se pierde sin dejar rastro.

⚠️ **La primera vez el arreglo fue BORRAR la tool. Ese arreglo ya se gastó.** v2 nace con el
contrato o repite el bug.

**El contrato: TRES estados, nunca colapsados en `[]`.**

| Estado | Significa | Qué dice el agente |
|---|---|---|
| `sin_rangos_publicados` | ese día no tiene horarios publicados | es una RESPUESTA: *"ese día no atiende"* |
| `sin_huecos` | hay rangos y están ocupados | es otra RESPUESTA: *"ese día está lleno, ¿le busco otro?"* |
| `indeterminado` | **no se pudo calcular** | **NO es una respuesta**: escalar / ofrecer que le llamen — jamás afirmar que no hay lugar |

**Prerrequisito hermano (ya listado arriba como catch 1):** el asistente todavía no agenda sin
rango mientras el picker de la UI sí. Un canal de pacientes necesita **las dos mitades** —
enumerar opciones Y poder agendarlas.

*El mismo principio, en la regla general del repo: si un fallo y un vacío legítimo aterrizan en el
mismo `[]`, el sistema afirma con seguridad algo falso sobre los datos del doctor.*

## Una segunda cotización que el doc de septiembre no tiene (anotado 2026-09-14)

`00-EXPLORACION` es un 🔒 SNAPSHOT del 2026-09-10 y **no menciona la Gemini Live API**, que es
hoy la alternativa directa a ElevenLabs Agents. Se anota aquí (no allá: los snapshots no se
editan — `../GENERAL AGENTES/07-CONVENCIONES-docs.md` §3):

| | ElevenLabs Agents | **Gemini Live API** |
|---|---|---|
| Arquitectura | pipeline STT → LLM → TTS | **audio nativo** in/out sobre WebSocket persistente |
| Calidad de voz | 🏆 reportada mejor (claridad de consonantes, prosodia larga) | buena, por debajo |
| Latencia reportada | 450–750 ms end-to-end | ~960 ms al primer token · 300–500 ms en régimen |
| Precio reportado | por minuto (planes ~$5–22 USD/mes + uso) | ~$3 / 1M tokens de audio in · ~$12 out |

⚠️ **Números de terceros, no de páginas oficiales de precio — re-verificar antes de citarlos.**

**No cambia la secuencia de §7 de `00-EXPLORACION`.** Se arranca igual en Modo 1 con ElevenLabs
(la calidad en español MX es lo que manda al principio), y Gemini Live entra como **la segunda
medición** cuando haya minutos reales para decidir build-vs-buy. El doc ya predijo por qué esto
es barato: *"el moat es el tool layer, y es agnóstico de proveedor"* — un proveedor más es una
columna más en esa tabla, no un rebuild.

*Contexto de dónde salió este dato: [`../GENERAL AGENTES/11-ANALISIS-contexto-de-pantalla.md`](../GENERAL%20AGENTES/11-ANALISIS-contexto-de-pantalla.md) §11.*

## Docs

| Doc | Qué es |
|---|---|
| [`00-EXPLORACION-voz-elevenlabs.md`](00-EXPLORACION-voz-elevenlabs.md) | 🔒 2026-09-10 · La investigación completa: los dos modos y quién es el cerebro, stack y costos (Twilio + ElevenLabs), validación de mercado (Noa Booking), los 4 prerequisitos, **la política de identidad anti-suplantación para voz Y WhatsApp (§5)**, voz-en-WhatsApp como pierna futura, y la secuencia propuesta |

⚠️ Precios, modos y APIs de ElevenLabs/Twilio/Meta caducan — re-verificar antes de construir.

*El canal de TEXTO de la misma visión: [`../AGENTE WHATSAPP/README.md`](../AGENTE%20WHATSAPP/README.md).
El producto que ensambla estos canales (clínicas/edificios multi-doctor): [`../../CLINICAS/README.md`](../../CLINICAS/README.md).
La arquitectura que este agente reusa: [`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md).*

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md).*
