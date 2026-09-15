# 📁 AGENTE WHATSAPP — índice

> 🌱 **Carpeta en exploración — nada construido, pero DESPERTANDO: la cuenta de WhatsApp API
> está por aprobarse (2026-09).** Un agente **paciente-facing** por WhatsApp: que el doctor
> pueda mandar recordatorios/confirmaciones automáticas, y que el paciente pueda conversar
> sobre SU cita (y sus datos fiscales) con un primo acotado del asistente.
> Investigado 2026-07-07, re-verificado 2026-09-10; sin código.

## Qué se sabe

**Veredicto: es factible, y el camino es más accesible de lo que se temía.** La arquitectura de
Meta es **Tech Provider + Embedded Signup** — y "Tech Provider" resultó ser un camino de
developer **autoservicio** (Business Verification 2–5 días + App Review ~días), no un tier
cerrado tipo BSP. Cada doctor puede conectar su propio número/WABA desde nuestra app (hasta 200
onboardings por semana rodante).

Los mensajes que inicia el negocio son plantillas pre-aprobadas (~centavos de USD en México);
cuando el paciente responde se abre una **ventana de 24h de mensajes libres** — y ahí es donde
vive el agente.

Dato del código: `patientWhatsapp` **ya se captura** en el booking y **nada lo usa** todavía.

**La decisión de número NO bloquea el arranque:** el código (webhooks, ventana 24h, plantillas,
turno del agente) es idéntico con un número genérico de la plataforma o con el número propio de
cada doctor — solo cambia el aprovisionamiento. Plan: v1 con número genérico + papeleo de Tech
Provider en paralelo (detalle en `01-ACTUALIZACION`).

## Los tres catches honestos (revisados 2026-09)

1. ~~Un número conectado al Cloud API no puede correr la app normal de WhatsApp~~ →
   **"Coexistence" es GA desde mayo 2025**: mismo número en la app WhatsApp Business + Cloud
   API, historial conservado, mensajes espejeados. Límites: abrir la app cada ≤13 días, sin
   listas de difusión. El doctor sigue chateando desde su teléfono mientras el agente
   automatiza.
2. **La superficie de confianza es distinta**: los usuarios son PACIENTES, no el doctor. El
   input es 100% externo → el schema acotado de tools es la defensa, más estricta que la del
   asistente del doctor. Scoping por `patientId`/teléfono, nunca por `doctorId` del modelo.
   A favor de este canal: **un mensaje de WhatsApp viene autenticado por el número emisor**
   (Meta ya verificó la posesión) — suplantar exige el teléfono físico. La política de
   identidad completa (compartida con voz, donde SÍ hay suplantación fácil):
   [`../AGENTE ELEVENLABS/00-EXPLORACION-voz-elevenlabs.md`](../AGENTE%20ELEVENLABS/00-EXPLORACION-voz-elevenlabs.md) §5.
3. **Es un proyecto tamaño "PR 5"**, no un hack de fin de semana: exige su propia campaña de
   permutaciones antes de tocar a un paciente real.

## Camino de prototipo (costo cero)

Meta da un número de prueba gratuito que escribe a hasta 5 destinatarios verificados — alcanza
para ejercitar el loop COMPLETO contra dr-prueba sin verificación de negocio.

## Secuenciación

1. Número de prueba contra dr-prueba (loop completo, costo cero).
2. v1: número genérico + plantillas de confirmación/recordatorio (sin LLM, construye la plomería).
3. En paralelo: Business Verification + App Review de Tech Provider (esperas de días, no trabajo).
4. Agente paciente-facing en la ventana de 24h · v2: Embedded Signup (número por doctor).

⚠️ Prerequisito que se volvió urgente al planear agentes que AGENDAN: el asistente aún no agenda
sin rango/slot (ver `../../CITAS/SESSION-REFRESCO.md`) — un agente paciente-facing heredaría el
mismo "no hay hueco" falso.

🔴 **Y la otra mitad, anotada 2026-09-14: la DISPONIBILIDAD tiene que volver, con contrato nuevo.**
`get_availability` se eliminó el 2026-08-05 porque el asistente del DOCTOR mejoró sin ella (él dice
la hora y el servidor valida). **Un paciente no propone hora: hay que ofrecerle opciones**, así que
este canal la necesita de vuelta — y con los **tres estados** (`sin_rangos_publicados` ·
`sin_huecos` · `indeterminado`), nunca un `[]` que confunda "no hay" con "no pude calcular". Un
"no hay horarios" falso al doctor es un estorbo; **a un paciente lo pierde en silencio.** El
contrato completo, con la traza real que lo motivó, está en
[`../AGENTE ELEVENLABS/README.md`](../AGENTE%20ELEVENLABS/README.md) §"Disponibilidad v2" — **se
decide UNA vez para voz y WhatsApp**, igual que la política de identidad.

## Docs

| Doc | Qué es |
|---|---|
| [`00-EXPLORACION-whatsapp-api.md`](00-EXPLORACION-whatsapp-api.md) | 🔒 2026-07-07 · La investigación de origen: lo que la plataforma ya tiene, las reglas de la Cloud API, las 3 arquitecturas (A/B/C), el diseño del agente paciente-facing, el camino de prototipo |
| [`01-ACTUALIZACION-2026-09-tech-provider.md`](01-ACTUALIZACION-2026-09-tech-provider.md) | 🔒 2026-09-10 · Re-verificación: Tech Provider es autoservicio (proceso y tiempos), coexistence GA, los dos escenarios de número comparados, y la secuencia recomendada |

⚠️ Verificar contra la documentación vigente de Meta antes de construir — precios, límites y
rollouts cambian.

*El mapa de todos los agentes: [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).
La arquitectura que este agente reusaría: [`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md).
El canal de VOZ de la misma visión: [`../AGENTE ELEVENLABS/README.md`](../AGENTE%20ELEVENLABS/README.md).
El producto que ensambla los canales (clínicas/edificios multi-doctor): [`../../CLINICAS/README.md`](../../CLINICAS/README.md).*

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md).*
