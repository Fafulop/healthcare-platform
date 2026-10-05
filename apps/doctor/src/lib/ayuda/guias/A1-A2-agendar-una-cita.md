# Agendar una cita

**Para qué:** apartar un horario para un paciente desde tu agenda.

**Antes de empezar:** tener al menos un servicio en tu perfil (define cuánto dura la cita y su precio). No necesitas rangos publicados: puedes agendar a cualquier hora libre.

**Pasos**
1. Menú lateral **«Mis Citas»** → botón verde **«Agendar Cita»**.
2. **1 · Servicio:** elige el servicio (ej. «Consulta de Seguimiento · 30 min · $650»).
3. **2 · Fecha:** elige el día en el calendario. Los días con horario publicado se ven resaltados.
4. **3 · Hora:**
   - Si ese día tienes un rango publicado, verás sus horas como botones (ej. «10:00 AM · Consultorio Satélite»). Toca una.
   - Si no, o si quieres otra hora, escríbela en **«Escribe la hora»** (o «¿Otra hora?»), cualquier minuto. Si dice **«Libre. Confirma con el botón o con Enter.»**, aprieta **«Usar …»** o Enter.
5. **Datos del paciente:**
   - **Tipo de visita:** «Primera vez» o «Recurrente». Con **Recurrente** aparece **«Vincular expediente»**: escribe el nombre y elige al paciente; sus datos se llenan solos.
   - **Modalidad:** «Presencial» o «Telemedicina».
   - **Consultorio** (si tienes más de uno y la cita es **Presencial**; en Telemedicina no se pide): si la hora cae dentro de un rango, ya viene puesto («Se toma del rango que contiene esta hora»). Si no, viene elegido el primero: **revisa que sea el correcto**.
   - **Nombre(s)**, y si quieres Apellidos, Email, Teléfono, WhatsApp y **Notas**.
6. **«Confirmar cita»**.

**Qué vas a ver:** «Cita Confirmada» con paciente, fecha, horario, servicio y precio. La cita aparece en la tabla como **«AGENDADA»** y en el calendario.

**Tu dinero:** agendar no registra ningún ingreso. El ingreso entra cuando **completas** la cita (ver «Completar una cita»).

**Si algo sale mal:**
- «Esa hora no está libre. Más cerca:» → toca una de las horas sugeridas.
- «Esa hora ya pasó.» → elige una hora futura.
- El botón «Confirmar cita» no hace nada → revisa que esté elegido el **Consultorio** y llenos los campos con «*».
- Si tu paciente tiene correo y tu cuenta de Google está conectada, le llega un correo de confirmación. En **Telemedicina** el correo incluye el enlace de Google Meet.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C1/C2/C3/C5 ✅: sin rango (QA A2), recurrente + expediente + telemedicina con Meet (QA E1), dentro de rango con consultorio heredado (QA C4 13-oct). BD: CONFIRMED, `location_id`, `confirmation_email_sent_at`, evento GCal, `BOOKING_CREATED`. ⚠️ H-013 (telemedicina pide consultorio), H-014 (el primer consultorio viene resaltado y queda elegido aunque la pista dice «no hay de dónde deducir»).
