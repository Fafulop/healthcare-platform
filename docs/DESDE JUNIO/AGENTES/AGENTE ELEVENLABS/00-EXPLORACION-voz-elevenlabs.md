# AGENTE ELEVENLABS — exploración: un número de teléfono que se contesta solo

> 🔒 **SNAPSHOT — 2026-09-10.** Investigación inicial, nada construido. Precios, modos y APIs
> de ElevenLabs/Twilio/Meta caducan — **re-verificar contra la documentación vigente antes de
> construir.** Índice: [`README.md`](README.md).

> **Qué es esto.** Cada doctor tiene un número al que cualquiera puede llamar; un agente de voz
> con IA contesta 24/7, consulta disponibilidad, agenda, reagenda y cancela. Estrategia:
> **empezar sobre ElevenLabs Agents** (comprar la parte difícil de voz) y evaluar construirlo
> nosotros SOLO si el ahorro resulta real. La visión completa de canales (WhatsApp + voz +
> recepcionista de edificio) se conversó 2026-09-10.

---

## 1. La pregunta central: ¿quién "lee" el texto? — los dos modos

La duda que motivó la investigación: cuando alguien llama y el modelo de ElevenLabs contesta,
¿el texto transcrito lo procesa un agente NUESTRO o uno de ellos? **Respuesta: hay dos modos, y
la respuesta cambia.**

### Modo 1 — ElevenLabs hospeda el cerebro (su default)

Pipeline completo de su lado: llamada → número de Twilio → audio a ElevenLabs → su STT
transcribe → **un LLM que corre ElevenLabs** (se elige el modelo — GPT, Claude, Gemini — y se
escribe su system prompt en su dashboard) decide qué decir → su TTS lo habla.

Nuestro SaaS participa vía **webhook/server tools**: se definen tools (`check_availability`,
`book_appointment`…) con schemas JSON que apuntan a **nuestros endpoints**. A media
conversación su LLM decide llamar una, pega a nuestro endpoint, recibe JSON y sigue hablando.

⇒ En este modo **se reusan las TOOLS del agente** (re-expuestas como endpoints HTTP), pero
**NO su loop** — el razonamiento pasa en la infraestructura de ellos.

### Modo 2 — "Custom LLM": nuestro SaaS es el cerebro

ElevenLabs hace solo oídos y boca — STT, turn-taking, TTS — y reenvía cada turno (system
prompt, historial completo, definiciones de tools) a un **endpoint OpenAI-compatible en nuestro
servidor**. Nuestro server corre el LLM, ejecuta tools en-proceso exactamente como el asistente
de agenda hoy, y regresa texto en streaming, que ellos hablan.

⇒ Literalmente "mi agente dentro del SaaS lee el texto".

### La recomendación: arrancar en Modo 1, diseñar para Modo 2

- Modo 1 da un agente telefónico funcionando en días: **la orquestación de voz (interrupciones,
  turn-taking, latencia) es LA parte difícil y es lo que se está comprando.**
- Es seguro aun con el LLM fuera de nuestra infra **porque la regla 0 ya vive en el tool
  layer**: un tool call fuera de línea lo rechaza NUESTRO endpoint, no el prompt.
- Los mismos endpoints sirven para los dos modos ⇒ pasarse a Modo 2 (o a otro proveedor) es un
  switch de config, no un rebuild. **El moat que se construye es el tool layer, y es
  agnóstico de proveedor** — eso es lo que hace "empezar con ElevenLabs" de bajo riesgo.

## 2. El stack y los costos (orden de magnitud, 2026-09)

| Capa | Comprar (ahora) | Construir (quizá después) |
|---|---|---|
| Telefonía | Número de Twilio (~$1 USD/mes + minutos), **integración nativa** con ElevenLabs | Twilio se queda igual |
| Pipeline de voz | ElevenLabs Agents: STT + turn-taking + TTS, cobro por minuto (planes desde ~$5–22 USD/mes + uso) | STT/LLM/TTS propio — ingeniería real; se justifica solo a volumen alto de llamadas |
| El cerebro | **Nuestro en ambos casos** (§1) | — |

Referencia de volumen: para un negocio chico con ~500 llamadas/mes, el rango citado en el
mercado es ~$20–50 USD/mes total. **La decisión build-vs-buy se pospone hasta tener minutos
reales medidos** — si el ahorro no es grande, se queda ElevenLabs.

## 3. Validación de mercado

**Docplanner (matriz de Doctoralia — el comparable dominante en México) ya shippeó exactamente
esto:** *Noa Booking*, asistente de voz 24/7 sobre Twilio que agenda por teléfono y confirma
por WhatsApp/SMS. Reportan ~**2× de citas agendadas** vs doctores en call center tradicional.
En EEUU "AI receptionist for medical practices" ya es una categoría (Retell AI, DoctorConnect…).

Nuestros diferenciales (lo que Doctoralia no copia fácil): el agente está cableado a la
operación COMPLETA del doctor (expediente, facturas, fiscal) · el flujo fiscal/CFDI es
profundamente mexicano y nuestro · nadie construye para la recepcionista de edificio compartido.

## 4. Lo que hay que resolver ANTES de que un paciente hable con esto

1. **🔴 El hueco de agendar sin rango.** El asistente aún no agenda sin slot/rango mientras el
   picker de la UI sí (rejilla de 1 min, `480f7f72`; ver `../../CITAS/SESSION-REFRESCO.md`).
   Un agente de voz agenda por las MISMAS tools ⇒ el hueco se vuelve "el teléfono dice que no
   hay lugar a las 4pm mientras el picker sí agenda". **Cerrarlo primero.**
2. **La política de confirmación cambia de forma.** El patrón del asistente es
   propuesta → card → el doctor confirma → el CLIENTE ejecuta. En una llamada con un PACIENTE
   no hay card: la confirmación es **verbal** ("¿Confirmo su cita el martes a las 5?"). Hay que
   decidir qué puede ejecutar un paciente directo (¿confirmar? ¿cancelar con
   `confirmationCode`?) vs qué sigue siendo propuesta que aprueba el doctor (reagendar, cita
   nueva). Misma discusión que el agente de WhatsApp — conviene resolverla UNA vez para los dos
   canales. **La política propuesta (con la investigación de industria) está en §5.**
3. **Scoping paciente, no doctor**: igual que WhatsApp — por teléfono/`patientId`, input 100%
   externo, el schema acotado de tools es la defensa.
4. **Latencia**: voz exige respuestas en streaming sub-segundo; los endpoints de tools deben
   ser rápidos (los reads del asistente ya lo son; verificar con minutos reales).

## 5. Identidad: ¿cómo sabemos que quien llama ES el paciente? (aplica a voz Y WhatsApp)

El problema: con solo un nombre, cualquiera puede llamar y hacerse pasar por otra persona para
crear o mover SU cita. **Nadie en la industria lo resuelve criptográficamente — se maneja con
señales en capas, riesgo por niveles y verificación escalonada** (investigado 2026-09-10).

### Lo que hace la industria

1. **Verificación por conocimiento (KBV)** — nombre + fecha de nacimiento + teléfono en
   archivo antes de hablar de una cita existente. Es el control estándar del mundo HIPAA, y
   los mismos vendors reconocen que es débil (la fecha de nacimiento es semi-pública): filtra
   la suplantación casual, no la motivada.
2. **Match de caller ID (ANI)** — cruzar el número entrante contra el expediente. Útil para UX
   ("¿llama por su cita del martes?") pero **es spoofeable: señal, nunca prueba**.
3. **OTP escalonado — el patrón fuerte común**: para ACTUAR sobre un registro existente, se
   manda un código de un solo uso **al número en archivo** (no al que dice el que llama) y se
   pide leerlo. Convierte "sé su nombre" en "tengo su teléfono"; el caller ID falsificado no
   le sirve al atacante porque el código llega al teléfono real.
4. **Riesgo por niveles — la idea de diseño más importante**: cita NUEVA = riesgo bajo, sin
   verificación (una recepcionista humana tampoco pide ID; el peor caso es una cita falsa que
   el doctor ve y descarta). Leer/cambiar cita EXISTENTE = el nivel sensible — y el peligro
   mayor no es el cambio sino la **revelación**: que el agente le confirme a un extraño que
   una persona tiene cita con un doctor ya es fuga de dato de salud (problema LFPDPPP).
5. **Evidencia de manipulación**: todo cambio dispara notificación al número en archivo — un
   ataque silencioso se vuelve detectado en segundos y el doctor puede revertir.

### La asimetría de nuestros dos canales hace casi todo el trabajo

**WhatsApp texto ya viene autenticado.** Un mensaje de WhatsApp llega probadamente desde ese
número — Meta hizo la autenticación al registrarlo. El agente de texto NO necesita OTP: se
scopea toda tool por el número emisor cruzado con `patientWhatsapp`. Suplantar ahí = tener el
teléfono físico de la víctima, amenaza contra la que ningún sistema defiende. ⇒ Argumento real
para **empujar WhatsApp como canal primario** y tratar la voz como puerta de entrada.

**Voz es el canal débil — se niveló así:**

| Acción | Verificación |
|---|---|
| Crear cita nueva | Ninguna — nombre + teléfono, y la plantilla de confirmación por WhatsApp/SMS a ese número (si el flujo pide confirmar con un tap/respuesta, la posesión del número se valida sola, gratis) |
| Consultar / cancelar / reagendar cita existente | Caller ID = solo señal de conveniencia. Prueba real: **el `confirmationCode` que YA existe** (ya es la prueba de propiedad del self-cancel en `bookings/[id]` PATCH) — "¿me da su código de confirmación?". Fallback: OTP al número en archivo |
| Lo que el agente DICE de una cita existente | Nada de detalles pre-verificación. Confirmación ciega: "le mando la información a su WhatsApp registrado" |

**Redes de seguridad (la mayoría ya existen):** todo cambio notifica al número en archivo ·
reagendar ya es propuesta que aprueba el doctor (capea el daño de lo que se cuele) · rate-limit
de intentos de verificación (3 OTP/código fallidos → "comuníquese directamente con el
consultorio"), registrado en `activity_logs`.

⚠️ **Caveat honesto sobre `confirmationCode`:** hoy viaja en correos/links — tratarlo como
"algo que te enviaron", fuerza ~OTP: sirve para cancelar/reagendar ESA cita, no como llave de
nada más amplio.

**La política se decide UNA vez para voz y WhatsApp** (es el punto 2 del §4 y el catch 2 del
README — esta sección es esa política propuesta, pendiente de decisión).

## 6. Voz DENTRO de WhatsApp (futuro, no arranque)

La **Business Calling API** de Meta (llamadas de voz dentro de WhatsApp) existe y los BSP
grandes ya conectan agentes de IA, pero el rollout es por etapas y no universal (2026-09).
Tratarla como tercera pierna futura: empezar con número telefónico normal, sumar llamadas de
WhatsApp cuando Meta lo abra para nuestro tier.

## 7. Secuencia propuesta

1. Cerrar el hueco de agendar sin rango (beneficia al asistente actual de inmediato).
2. Exponer las tools de agenda como endpoints HTTP para ElevenLabs (Modo 1) con la política de
   confirmación verbal decidida.
3. Número de Twilio + agente ElevenLabs contra dr-prueba; medir minutos y calidad en español MX.
4. Decidir Modo 2 / build-vs-buy con datos reales, no antes.

---

## Fuentes (2026-09-10)

- ElevenLabs: [Custom LLM](https://elevenlabs.io/docs/eleven-agents/customization/llm/custom-llm) ·
  [Webhook/server tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools) ·
  [Integración nativa con Twilio](https://elevenlabs.io/docs/eleven-agents/phone-numbers/twilio-integration/native-integration) ·
  [Pricing de Agents](https://elevenlabs.io/pricing/agents)
- Mercado: [Docplanner × Twilio — Noa Booking](https://www.twilio.com/en-us/press/releases/docplanner-expands-patient-access-with-voice-ai-agent-powered-by) ·
  [Retell AI — voice agents para clínicas](https://www.retellai.com/blog/top-8-ai-voice-agents-for-appointment-scheduling-in-clinics-and-healthcare)
- WhatsApp Calling API: [estado del rollout](https://hyperleap.ai/whatsapp-business-api/calling-api) ·
  [respond.io — WhatsApp AI voice agents](https://respond.io/blog/whatsapp-ai-voice-agent)
- Identidad (§5): [Hamming — HIPAA voice agents](https://hamming.ai/blog/hipaa-compliant-voice-agents) ·
  [Observe.ai — guía práctica](https://observe.ai/blog/hipaa-compliant-ai-voice-agents-for-healthcare-a-practical-guide) ·
  [Retell — HIPAA voice agents](https://www.retellai.com/blog/10-best-hipaa-compliant-ai-voice-agents-for-healthcare-clinics) ·
  [8x8 — OTP para healthcare](https://cpaas.8x8.com/en/blog/otp-access/) ·
  [Infobip — WhatsApp OTP](https://www.infobip.com/whatsapp-business/otp)

*Los canales hermanos de la misma visión: texto por WhatsApp en
[`../AGENTE WHATSAPP/`](../AGENTE%20WHATSAPP/README.md); la arquitectura y regla 0 que este
agente reusa: [`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md).*
