# Reenviar la confirmación

**Para qué:** volver a mandar la confirmación al paciente. (Bloquear más minutos después de una cita está apagado por ahora.)

**Pasos — confirmación**
1. Abre la cita (clic en su fila).
2. Grupo **CONFIRMACIÓN CITA**:
   - **«Reenviar confirmación»** (o «Enviar confirmación» si nunca se mandó) → correo al paciente.
   - **«Confirmación por WhatsApp»** → abre WhatsApp con el mensaje listo; tú lo envías.
   - **«Entrar a Meet»** — sólo telemedicina.

**Bloqueo extendido:** apagado por ahora (2026-10-12). La cita ocupa lo que dura su servicio y dice su hora de inicio y de fin (ej. «10:30–11:00»).

**Qué vas a ver:** un aviso «Correo de confirmación enviado a …».

**Si algo sale mal:** si dice **«Necesita correo» / «Necesita WhatsApp»**, falta ese dato del paciente: captúralo en su expediente.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C21/C22 ✅ (QA A2: `confirmation_email_sent_at` se movió; `extended_block_minutes` 45). Telemedicina con Meet ✅ (QA E1).
