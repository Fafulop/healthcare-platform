# Cancelar, marcar «No asistió» o eliminar una cita

**Pasos — Cancelar**
1. Abre la cita → **ESTADO → «Cancelar»**.
2. Confirma con **«Confirmar»** en «¿Estás seguro de que quieres cancelar esta cita?».

**Pasos — No asistió**
1. Abre la cita → **ESTADO → «No asistió»**. (Es inmediato, sin confirmación.)

**Pasos — Eliminar** (sólo citas ya Completadas, Canceladas o No asistió)
1. En la tabla, filtro **«Más estados…» → «Todos los estados»** para verla.
2. Abre la cita → **«Eliminar»** → **«Confirmar»**.

**Qué vas a ver:** «Cancelar» → estado **«CANCELADA»**, el horario vuelve a quedar libre y el paciente recibe un correo de cancelación. «No asistió» → **«NO ASISTIÓ»**, sin aviso al paciente. «Eliminar» → «Cita eliminada exitosamente»; la cita desaparece.

**Tu dinero:** cancelar y no asistió no registran nada. **Eliminar una cita cobrada no borra su ingreso**: se queda en Flujo de Dinero.

**Si algo sale mal:** Completada, No asistió y Cancelada son finales; no hay vuelta atrás. Eliminar no se puede deshacer.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C11/C12/C13 ✅ (QA C11 NO_SHOW→eliminada; QA C12 CANCELLED; QA A2 completada eliminada: ingreso #1822 quedó con `booking_id` NULL). ⚠️ H-011, H-030 (toasts en inglés), H-031 (No asistió sin confirmar; botón «Cancelar» ambiguo), H-032 (eliminar no deja bitácora).
