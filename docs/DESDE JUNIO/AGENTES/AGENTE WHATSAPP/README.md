# 📁 AGENTE WHATSAPP — índice

> 🌱 **Carpeta DORMIDA — exploración, nada construido.** Un agente **paciente-facing** por
> WhatsApp: que el doctor pueda mandar recordatorios/confirmaciones automáticas, y que el
> paciente pueda conversar sobre SU cita con un primo acotado del asistente.
> Investigado 2026-07-07; sin código, sin decisiones comprometidas.

## Qué se sabe

**Veredicto: es factible.** La arquitectura de Meta que lo soporta se llama **Tech Provider +
Embedded Signup** (cada doctor conecta su propio número/WABA desde nuestra app). Los mensajes
que inicia el negocio son plantillas pre-aprobadas (~centavos de USD en México); cuando el
paciente responde se abre una **ventana de 24h de mensajes libres** — y ahí es donde vive el
agente.

Dato del código: `patientWhatsapp` **ya se captura** en el booking y **nada lo usa** todavía.

## Los tres catches honestos

1. **Un número conectado al Cloud API no puede correr la app normal de WhatsApp.** Patrón
   estándar: número dedicado de consultorio. La alternativa nueva es "coexistence" (mismo
   número en la app WhatsApp Business + Cloud API) — **verificar disponibilidad en México
   antes de prometerlo**.
2. **La superficie de confianza es distinta**: los usuarios son PACIENTES, no el doctor. El
   input es 100% externo → el schema acotado de tools es la defensa, más estricta que la del
   asistente del doctor. Scoping por `patientId`/teléfono, nunca por `doctorId` del modelo.
3. **Es un proyecto tamaño "PR 5"**, no un hack de fin de semana: exige su propia campaña de
   permutaciones antes de tocar a un paciente real.

## Camino de prototipo (costo cero)

Meta da un número de prueba gratuito que escribe a hasta 5 destinatarios verificados — alcanza
para ejercitar el loop COMPLETO contra dr-prueba sin verificación de negocio.

## Secuenciación

Prerequisito lógico: cerrar **PR 4** del asistente (voz + retiro del ChatWidget v1).

## Docs

| Doc | Qué es |
|---|---|
| [`00-EXPLORACION-whatsapp-api.md`](00-EXPLORACION-whatsapp-api.md) | La investigación completa: lo que la plataforma ya tiene, las reglas de la Cloud API que definen el diseño, las 3 arquitecturas posibles (A/B/C) con sus pros y contras, el diseño del agente paciente-facing, y el camino de prototipo |

⚠️ Verificar contra la documentación vigente de Meta antes de construir — precios, límites y el
rollout de "coexistence" cambian.

*El mapa de todos los agentes: [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).
La arquitectura que este agente reusaría: [`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md).*

---

*⬆️ Índice general de todos los agentes: [`../README.md`](../README.md).*
