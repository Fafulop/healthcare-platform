# Completar una cita y registrar el cobro

**Para qué:** marcar que viste al paciente y registrar lo que te pagó.

**Pasos**
1. Abre la cita (clic en su fila o en el calendario).
2. Grupo **ESTADO → «Completar»**.
3. En **«Completar cita»**:
   - **Monto cobrado (MXN):** viene el precio del servicio; cámbialo si cobraste otra cosa.
   - **Forma de pago:** «Efectivo» · «Transferencia» · «Tarjeta» · «Cheque» · «Depósito».
4. **«Completar»**.

**Qué vas a ver:** el aviso **«Cita completada · ingreso registrado en Flujo de Dinero»**. La cita pasa a **«COMPLETADA»**. Si la cita tiene expediente, en su perfil aparece la **«Visita del …»** de ese día.

**Tu dinero:** se registra **un ingreso** en **Flujo de Dinero** por el monto que escribiste, con la forma de pago elegida, el servicio y el nombre del paciente. Queda fechado el **día de la cita**.

**Si algo sale mal:**
- Si el paciente ya pagó con un **link de pago**, el ingreso ya existe y no se duplica.
- Hoy no se puede completar con **$0** (el botón se apaga).

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C8/C9/T6 ✅: efectivo $700 (#1822), transferencia $850 con expediente → visita (#1823), tarjeta $550 (#1825), cheque $900 (#1826), depósito $800 en sesión (#1827); Flujo lo lista una vez. ⚠️ H-029 ($0 imposible), H-016 (ingreso con fecha de la cita, no de hoy), H-010 (si había link activo, sigue activo).
