# Cobrar con un link de pago

**Para qué:** mandarle al paciente un link para que pague en línea.

**Antes de empezar:** tener conectado **Stripe** o **Mercado Pago** en **«Pagos»**, y que la cita tenga **expediente vinculado** (si no, el botón dice «Requiere expediente»).

**Pasos**
1. Abre la cita → grupo **COBRO → «Link de pago»**.
2. Elige **Proveedor** («Mercado Pago» o «Stripe») y revisa el **Monto (MXN)**.
3. **«Crear link de pago»**.
4. Ahora el grupo dice **«Link enviado»** con **«Copiar»** y **«WhatsApp»**: mándaselo al paciente.

**Qué vas a ver:** «Link de pago creado». Cuando el paciente paga, la cita muestra **«Pagado»**.

**Tu dinero:** el ingreso entra a Flujo de Dinero **cuando el paciente paga**, ligado a la cita. Si después completas la cita, no se duplica.

**Si algo sale mal:** si cobras en persona (completas la cita en efectivo), al completarla **el link se desactiva solo** (ya no acepta pagos nuevos) — la ventana «Completar cita» te lo avisa. Lo mismo al cancelar, marcar «No asistió» o eliminar. Si no se pudo desactivar en Stripe o Mercado Pago, la agenda te avisa: desactívalo desde «Pagos» o desde tu cuenta del proveedor. Si aun así el paciente paga un link que ya no debía (p. ej. una ficha de OXXO que generó antes), el pago entra a Flujo de Dinero con un concepto «⚠️ Revisar…»: revisa si tienes que devolverle el dinero.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C23 + X27 ✅ crear (MP `cmusqlk6n…`, Stripe `cmussw4ld…`), NO se pagó ninguno (regla). 🐞 H-010 CONFIRMADO (completar no apaga el link), H-054 (reagendar lo deja en la cita cancelada). Re-verificar esta guía al arreglarlos y quitar el ⚠️. **2026-10-04:** H-010 partes 1+2 en prod; completar en efectivo con link vivo ✅ (aviso + link apagado en MP). Falta: pago real a un link desactivado (MP no dejó pagar) y reagendar (parte 3).
