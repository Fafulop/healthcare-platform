# Cancelar, marcar «No asistió» o borrar una cita

**Pasos — Cancelar**
1. Abre la cita → **ESTADO → «Cancelar cita»**.
2. Confirma con **«Confirmar»** en «¿Estás seguro de que quieres cancelar esta cita?».

**Pasos — No asistió**
1. Abre la cita → **ESTADO → «No asistió»** → **«Confirmar»** («¿Marcar que el paciente no asistió? No se puede deshacer.»).

**Pasos — Borrar** (sólo citas ya Completadas, Canceladas o No asistió, y **sin cobro**)
1. En la tabla, filtro **«Más estados…» → «Todos los estados»** para verla.
2. Abre la cita → **«Borrar cita»** → **«Confirmar»**.

**Qué vas a ver:** «Cancelar cita» → estado **«CANCELADA»**, el horario vuelve a quedar libre y el paciente recibe un correo de cancelación (no si la cita era de un día que ya pasó). «No asistió» → **«NO ASISTIÓ»**, sin aviso al paciente. «Borrar cita» → «Cita borrada»; la cita desaparece y en tu actividad reciente queda «Cita eliminada».

**Tu dinero:** cancelar y no asistió no registran nada. **Una cita cobrada no se puede borrar** (no sale el botón): su cobro se quedaría sin cita. Si el cobro fue un error, deshazlo primero en Flujo de Dinero.

**Su visita:** cada cita tiene su visita. Al cancelar o marcar «No asistió», la visita **vacía se borra** y la que **tiene algo** (plantillas, notas, recetas, fotos, ventas o un comentario) **se queda** en el expediente. Una cita cuya visita tiene algo **no se puede borrar**. En la visita el botón dice **«Borrar cita y visita»**.

**Si algo sale mal:** Completada, No asistió y Cancelada son finales; no hay vuelta atrás. Borrar no se puede deshacer.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — C11/C12/C13 ✅ (QA C11 NO_SHOW→eliminada; QA C12 CANCELLED; QA A2 completada eliminada: ingreso #1822 quedó con `booking_id` NULL). ⚠️ H-011, H-030 (toasts en inglés), H-031 (No asistió sin confirmar; botón «Cancelar» ambiguo), H-032 (eliminar no deja bitácora).
