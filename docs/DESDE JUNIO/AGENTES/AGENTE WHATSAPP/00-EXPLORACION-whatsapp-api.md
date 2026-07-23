# AGENTE WHATSAPP — exploración: API de WhatsApp (Meta) para conversación doctor↔paciente

> **Qué es esto.** Investigación inicial (2026-07-07, sesión de cierre de PR 3 del agente de
> agenda) sobre si la plataforma puede: (1) enviar mensajes automáticos de WhatsApp a pacientes
> en nombre del doctor, y (2) sostener una conversación abierta paciente↔agente sobre su
> consulta. **Respuesta corta: sí a ambas — la arquitectura Meta que lo soporta se llama Tech
> Provider + Embedded Signup.** Nada de esto está construido; este doc captura la investigación
> para cuando se retome.
>
> ⚠️ Verificar contra la documentación vigente de Meta antes de construir — precios, límites y
> el rollout de "coexistence" cambian; lo de abajo es el estado entendido a 2026-07.

---

## 1. Lo que la plataforma YA tiene (verificado en código)

- `patientWhatsapp` se captura en el booking y se guarda — **pero nada lo usa todavía** (los
  únicos hits son las rutas de booking almacenando el campo).
- SMS sale por Twilio (`apps/api/src/lib/sms.ts`); Telegram notifica al doctor. WhatsApp sería
  el tercer canal — y el que los pacientes mexicanos SÍ leen.
- El modelo de identidad del paciente ya existe: `confirmationCode` como prueba de propiedad
  (self-cancel sin auth en `bookings/[id]` PATCH) + `patientId`/teléfono. Es la base natural de
  autorización de un agente paciente-facing.

## 2. Reglas del WhatsApp Business Platform (Cloud API) que definen el diseño

1. **Mensajes iniciados por el negocio = plantillas pre-aprobadas** (categoría "utility":
   confirmaciones y recordatorios de cita son el ejemplo de libro). Se registran una vez con
   Meta; costo por mensaje del orden de centavos de USD en México (≈ comparable o más barato
   que SMS vía Twilio).
2. **Ventana de servicio de 24h**: cuando el paciente responde (o escribe primero), se abre una
   ventana de 24h de **mensajes libres, sin plantilla y gratis/casi gratis** — cada respuesta
   del paciente la renueva. **Aquí vive la conversación con el agente**: webhook de Meta → API
   → identificar paciente por teléfono → turno del agente → respuesta por Cloud API.
3. **Opt-in obligatorio** — el formulario de booking ya captura el WhatsApp con ese propósito;
   conviene checkbox explícito (LFPDPPP, dato de salud-adyacente). Regla de contenido: solo
   logística de la cita, nunca detalle clínico por WhatsApp.
4. Mensajería de **servicios** de salud está permitida por la política de Meta (lo restringido
   es la venta de medicamentos).
5. **Un número conectado al Cloud API no puede correr simultáneamente la app normal de
   WhatsApp** (ver "coexistence" abajo — la excepción nueva).

## 3. Las 3 arquitecturas posibles (perspectiva Meta)

| Opción | Cómo funciona | Pros / contras |
|---|---|---|
| **A · Tech Provider + Embedded Signup** (la canónica multi-doctor) | La plataforma registra UNA app de Meta (verificación de negocio + app review, una vez). El doctor pulsa "Conectar WhatsApp" EN NUESTRA app → popup de Meta (Embedded Signup) → crea/conecta su Meta Business, su **WABA propia** y **su propio número** sin salir de la UI. El backend recibe tokens para enviar/recibir en su nombre; TODOS los webhooks caen en nuestro endpoint (donde vive el agente). Pacientes ven el número y nombre del doctor. | ✅ Identidad del doctor real; el doctor es dueño de su número; billing por doctor o "partner billing" (Meta cobra a la plataforma, se re-factura). ❌ Fricción de signup por doctor (cuenta Meta Business; límite inicial ~250 conversaciones/día sin verificar — suficiente para recordatorios). |
| **B · Una WABA de la plataforma, un número por doctor** | TuSalud es dueña de todo; agrega números bajo su cuenta (una WABA soporta muchos). | ✅ Cero fricción para el doctor, una sola verificación. ❌ Display names atados a NUESTRA marca ("TuSalud · Dr. García"), compliance todo nuestro, el doctor no se lleva el número. |
| **C · Un solo número de plataforma** | Pacientes hablan con "TuSalud"; ruteo interno por doctor. | ✅ Lo más simple/barato. ❌ Impersonal — se siente como hablar con un call center, no con tu doctor. |

**El catch práctico** (todo doctor mexicano vive en su WhatsApp personal): patrón estándar =
número dedicado de consultorio (SIM nueva o número virtual que reciba UNA llamada de
verificación), gestionado desde el inbox de nuestra app — viable porque el agente maneja la
mayoría del tráfico. **Alternativa nueva: "coexistence"** — Meta permite que un número que ya
corre la **app WhatsApp Business** se conecte TAMBIÉN al Cloud API (el doctor sigue chateando
desde su teléfono; la plataforma automatiza sobre el mismo número). Es lo ideal para este caso
pero es reciente, con limitaciones (sin grupos/llamadas vía API, rollout por región) —
**verificar disponibilidad actual en México antes de prometerlo**.

## 4. El agente paciente-facing (la parte nuestra)

Primo acotado del agente de agenda (misma arquitectura: loop de tools, definiciones server-side,
regla 0), pero **superficie de confianza distinta — pacientes, no doctores**:

- Scoping por `patientId`/teléfono (nunca `doctorId` del modelo): SOLO sus citas.
- Tools mínimas: ver su cita, confirmar, cancelar (semántica `confirmationCode`), solicitar
  reagendado (propuesta que el DOCTOR confirma — el paciente no muta la agenda directo),
  direcciones/indicaciones del consultorio.
- Prompt injection: el input es 100% externo — el schema acotado de tools es la defensa (misma
  filosofía que el agente de agenda, más estricta).
- Exige su propia campaña de permutaciones antes de vivir (es un "PR 5"-shaped project, no un
  hack de fin de semana).

## 5. Camino de prototipo (costo cero, sin verificación)

Meta da a cada app de desarrollador un **número de prueba gratuito** que puede escribir a hasta
5 destinatarios verificados → se puede probar el loop COMPLETO contra dr-prueba esta semana:
plantilla de recordatorio → paciente responde → webhook → turno del agente → respuesta libre.
Probar ahí la conversación, y decidir A vs B según la fricción que toleren los doctores reales.

---

*Estado:* exploración 2026-07-07 — investigación capturada, nada construido. Prerequisito
lógico: cerrar PR 4 del agente de agenda primero. Relacionado:
[`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md) (el agente cuya
arquitectura se reusa),
[`../AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md`](../AGENTE%20AGENDA/05-REFERENCIA-TECNICA-AGENTE.md)
(filosofía y reglas), [`README.md`](README.md) (índice de esta carpeta).
