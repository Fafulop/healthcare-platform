# 01 — CATÁLOGO de flujos: qué se prueba, qué debe pasar, y cómo quedó

> **Tipo: REFERENCIA (viva).** Cada flujo tiene un id estable (A6, E9, T3…) que usan la bitácora, los
> hallazgos y las guías. **Estado:** ⬜ sin probar · 🔎 esperado escrito (P1) · ✅ pasa · 🐞 bug ·
> 📝 doc desviado · 🤔 confunde. «Manual» = sección de `manual-del-doctor.md`.
>
> **«Debe quedar»** se escribe desde el CÓDIGO (fase P1), no desde el manual: es contra lo que se
> compara la prueba. Lo marcado ⟨P1⟩ aún falta leerlo del código.

## F — Las reglas de dinero (transversales)

Hechos leídos del código (2026-10-02), contra los que se mide cada flujo que cobra:

| Origen del cobro | Dónde nace el movimiento | Qué queda en `practice_management.ledger_entries` |
|---|---|---|
| **Completar una cita** con monto > 0 (agenda, asistente, chat de citas) | `apps/api` `PATCH bookings/[id]` → `createCitaLedgerEntry` (efecto del SERVIDOR: también para un ayudante sin `flujo`) | 1 ingreso, `booking_id` = la cita (único), `amount` = lo capturado, `amount_paid` = amount, `payment_status` PAID, `origin` 'cita', concepto «Servicio - Paciente». Monto 0 o vacío ⇒ **ningún** movimiento |
| **Link de pago pagado** (Stripe / Mercado Pago) | webhook → `createPaymentLedgerEntry` | 1 ingreso con `booking_id`; al completar la cita después, NO se duplica (`ledgerAlreadyExisted`) |
| **Venta** (incluida la de una visita) | `apps/api` `POST ventas` (misma transacción que la venta) | 1 ingreso `origin` 'venta', `sale_id`, `amount` = **total** de la venta, `amount_paid` = lo pagado, `transaction_type` VENTA, forma de pago la elegida (default «transferencia» — hallazgo abierto) |
| **Cuenta del tratamiento** | NO crea movimientos: SUMA los de las citas de sus sesiones (`cuentaDelTratamiento`) | — |
| Paquete de tratamiento | **Ya no existe** (V2, `a82c888b`); los $0 «cubierta» viejos sólo se leen | — |

Verificación de cada flujo con cobro: (1) la pantalla de Flujo de Dinero lo lista una vez, con el
paciente y el monto; (2) la BD tiene exactamente 1 fila con esos campos; (3) la cita / venta queda
ligada (`booking_id` / `sale_id`).

## A — Agenda

| Id | Flujo | Manual | Debe quedar (BD / Flujo) | Estado |
|---|---|---|---|---|
| A1 | Agendar una cita con rango («Nueva cita» → servicio, día, hora del rango) | Agenda > Agendar una cita | `bookings` PENDING/CONFIRMED con `patient_id` si se eligió expediente; correo de confirmación (si hay correo + Google); evento en Google Calendar ⟨P1⟩. **Sin movimiento** en Flujo | ⬜ |
| A2 | Agendar **sin rango** (hora escrita, rejilla de 1 min) | Agenda > Agendar una cita | igual que A1, `slot_id` NULL, `date`/`start_time` propios | ⬜ |
| A3 | Agendar desde el calendario (clic en un hueco) | Agenda > Agendar desde el calendario | igual que A1 | ⬜ |
| A4 | Cita que pide el paciente desde el sitio público → aparece «Pendiente» → «Confirmar» | Agenda > Citas que piden tus pacientes | PENDING → CONFIRMED; correos ⟨P1⟩ | ⬜ |
| A5 | Confirmar la cita con el paciente (WhatsApp / correo) | Agenda > Confirmar la cita con el paciente | ⟨P1⟩ | ⬜ |
| A6 | **Completar** una cita con monto y forma de pago | Agenda > Completar una cita | COMPLETED; **1 ingreso** (regla F); **visita automática** (`visitas` con `booking_id`, `origen` 'cita') si la cita tiene expediente | ⬜ |
| A7 | Completar con monto distinto al precio / con monto 0 | Agenda > Completar una cita | monto distinto ⇒ ingreso = lo capturado; 0 ⇒ sin ingreso y el toast lo dice | ⬜ |
| A8 | Crear link de pago (sin pagarlo) y completar después | Agenda > Cobrar una cita | link activo en `payment_links` / `mp_payment_preferences`; completar crea el ingreso normal; **el link NO se apaga** (P1: `PATCH` no lo toca) → H-010 | 🔎 |
| A9 | Cancelar · No asistió · Eliminar | Agenda > Cancelar, No asistió y Eliminar | CANCELLED / NO_SHOW (sin ingreso, sin visita); correo de cancelación. **Eliminar** = borra la cita (y su slot si era privado) y su evento de Google; su ingreso, su visita y su sesión SE QUEDAN sin cita (`SetNull`) → H-011 | 🔎 |
| A10 | Reagendar una cita | Agenda > Reagendar una cita | cita nueva `is_rescheduled`; la vieja CANCELLED; si era sesión de tratamiento, la sesión (y su visita) pasan a la nueva | ⬜ |
| A11 | Bloquear horarios / bloqueo extendido | Agenda > Bloquear horarios | `blocked_times`; ese horario ya no se ofrece al agendar ni al paciente | ⬜ |
| A12 | Rangos de disponibilidad (crear / editar / borrar) | Agenda > Rangos de disponibilidad | ⟨P1⟩ | ⬜ |
| A13 | Vincular la cita a un expediente (existente / crear uno) | Agenda > Vincular la cita a un expediente | `bookings.patient_id`; si ya estaba COMPLETED, se crea su visita al vincular | ⬜ |
| A14 | Formulario pre-consulta (mandarlo, que el paciente lo llene, verlo) | Agenda > Formulario pre-consulta | ⟨P1⟩; cae en la visita de la cita | ⬜ |
| A15 | Nota de la cita (PDF del cobro) | Agenda > Cobrar una cita | sólo con ingreso > 0; folio ⟨P1⟩ | ⬜ |
| A16 | Facturar una cita — **SIN emitir** | Agenda > Facturar una cita | el ingreso aparece como facturable; no se manda nada al SAT | ⬜ |
| A17 | Recordatorios y campos de cita (configuración) | Agenda > Recordatorios / Campos de Cita | ⟨P1⟩ | ⬜ |

## E — Expediente

| Id | Flujo | Manual | Debe quedar (BD / Flujo) | Estado |
|---|---|---|---|---|
| E1 | Crear un paciente | Expediente > Crear un paciente | `medical_records.patients` activo; cuenta para el cupo del plan | ⬜ |
| E2 | Perfil del paciente: lo que muestra (visitas, tratamientos, citas, cobros) | Expediente > El perfil del paciente | lectura: cada tarjeta coincide con la BD | ⬜ |
| E3 | Nueva visita **de una cita** / **sin cita** | Expediente > Visitas | `visitas` (`origen` 'manual'; con cita: `booking_id`, fecha = la de la cita) | ⬜ |
| E4 | Agregar plantilla en una visita (fecha propia, editable — `e1cdc37f`) | Expediente > Consultas | `clinical_encounters` con `visita_id` y su `encounter_date` | ⬜ |
| E5 | Receta: crear, vista previa, descargar PDF | Expediente > Recetas | `prescriptions` con `visita_id` ⟨P1⟩ | ⬜ |
| E6 | Documentos y galería (subir a una visita) | Expediente > Documentos y galería | `media` con `visita_id`; archivo en storage | ⬜ |
| E7 | Notas del paciente | Expediente > Notas del paciente | ⟨P1⟩ | ⬜ |
| E8 | Informe para aseguradora (AXA / Allianz / GNP) | Expediente > Informe para aseguradora | ⟨P1⟩ | ⬜ |
| E9 | **Venta desde la visita** + nota de venta (PDF) | Expediente > Visitas | `sales` con `patient_id` + `visita_id`; **1 ingreso** `origin` 'venta' (regla F); aviso de doble cobro si la cita ya se cobró | ⬜ |
| E10 | Importar pacientes (.xlsx) y documentos (Word → nota) | Expediente > Importar pacientes | ⟨P1⟩ | ⬜ |
| E11 | Archivar / desarchivar (cupo) | Expediente > Archivar un paciente | ⟨P1⟩ | ⬜ |
| E12 | Facturar desde el expediente — **SIN emitir** | Expediente > Facturar desde el expediente | ⟨P1⟩ | ⬜ |
| E13 | Mover cosas entre visitas («Mover a…», «Traerla aquí…», ligar cita a una visita) | Expediente > Visitas | sin regla de mismo día desde `e1cdc37f` | ⬜ |

## T — Tratamientos

| Id | Flujo | Manual | Debe quedar (BD / Flujo) | Estado |
|---|---|---|---|---|
| T1 | Crear un tratamiento con N sesiones (servicio, precio, fecha, hora; disponibilidad) | Expediente > Tratamientos | tratamiento + N sesiones; cita por cada fila no «después», nace con el precio de la sesión; 1 correo resumen (presencial) | ✅ (2026-10-03, QA E1 «QA T Rehabilitacion»: 3 sesiones, 2 citas con su precio —incluido uno editado $600—, 1 «después», «UN correo con las 2 citas») |
| T2 | «Agendar después» y luego «Agendar» desde la tarjeta / «Agendar sesiones…» | idem | la sesión pasa a tener cita (`paraSesion`) | ✅ (usuario, V4) |
| T3 | «Reagendar» una sesión (con y sin visita abierta) | idem | cita nueva + vieja CANCELLED; la visita VIAJA con su cita | ✅ (usuario + BD, `a894e308`) |
| T4 | «Abrir visita» (con cita → fecha de la cita; sin cita → «Abrir visita hoy») | idem | visita ligada a la sesión; con cita activa la sesión sigue «Agendada» | ✅ (usuario, V4) |
| T5 | «Agregar sesión» (con fecha / después) | idem | sesión nueva con servicio y precio | ✅ (usuario, V4) |
| T6 | **Completar la cita de una sesión** (precio pre-llenado, sin paquete) | idem + Agenda > Completar | 1 ingreso normal (regla F); la sesión «Hecha»; la cuenta del tratamiento lo suma como cobrado | ✅ (precio pre-llenado $900, cobrado $800 depósito → #1827, visita ligada a la sesión, «Hecha · cobrado $800») |
| T7 | Cancelar sesión (con cita activa: las 3 salidas) | idem | `cancelada`; con «y la cita» ⇒ cita CANCELLED | ✅ «sesión y la cita» → sesión cancelada + cita CANCELLED; «Reactivar» la vuelve «Por agendar» |
| T8 | La cuenta del tratamiento (total · pagado · pendiente; ventas aparte) | idem | coincide con la suma de los ingresos de sus citas + las ventas de sus visitas | ✅ $2,400 → $2,300 (cobrado 800+600+900) → $1,700 al cancelar la sesión 2 → $2,300 al reactivar |
| T9 | Venta en la visita de una sesión | idem + E9 | sale en el renglón «ventas» de la cuenta, no en el total | ✅ VTA-2026-011 $232 en la visita de la sesión 1 → «Ventas en las visitas de las sesiones (1): $232», fuera del total |

## R — Roles

| Id | Flujo | Debe quedar | Estado |
|---|---|---|---|
| R1 | Ayudante SIN permiso de Flujo completa una cita | el ingreso SÍ se registra (efecto del servidor, 00-REQUISITOS §3.6); el ayudante no ve montos de Flujo | ⏭️ saltado 2026-10-03 (requiere entrar como el ayudante real de dr-prueba; decisión del usuario) |
| R2 | Ayudante sin permiso de citas: lo que ve en expediente / tratamiento | no ve datos de citas; no puede agendar | ⏭️ saltado 2026-10-03 (requiere entrar como el ayudante real de dr-prueba; decisión del usuario) |
