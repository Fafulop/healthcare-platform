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

**Si algo sale mal:** ⚠️ si cobras en persona (completas la cita en efectivo) **el link sigue activo**: avísale al paciente que ya no lo use.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C23 + X27 ✅ crear (MP `cmusqlk6n…`, Stripe `cmussw4ld…`), NO se pagó ninguno (regla). 🐞 H-010 CONFIRMADO (completar no apaga el link), H-054 (reagendar lo deja en la cita cancelada). Re-verificar esta guía al arreglarlos y quitar el ⚠️.
