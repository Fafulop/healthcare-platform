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
