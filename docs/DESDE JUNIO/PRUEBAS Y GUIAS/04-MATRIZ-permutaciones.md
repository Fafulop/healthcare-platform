# 04 — MATRIZ de permutaciones (P2, corrida 2026-10-03)

> **Tipo: ESTADO (vivo).** Lo pidió el usuario el 2026-10-03: «todas las permutaciones» de Citas y de
> Expediente, cada una con evidencia de DOS lados — la pantalla (Chrome) y el backend (BD / logs).
> Verificadores (sólo lectura): `scripts/qa/verificar-citas.cjs "<nombre en la cita>"` (parte de la
> CITA, ve citas sin expediente) y `scripts/qa/verificar-flujo.cjs "<paciente>"` (parte del EXPEDIENTE).
> ✅ pasa · 🐞 bug · 📝 doc · 🤔 confunde · ⬜ pendiente. Detalle de cada corrida en `02-BITACORA.md`.

## C — Citas

| # | Permutación | Debe quedar (código) | Estado |
|---|---|---|---|
| C1 | Crear · Primera vez · sin expediente · sin rango (hora escrita) · presencial · elige consultorio | CONFIRMED, `slot_id` NULL, `patient_id` NULL, `location_id` el elegido, correo de confirmación, evento GCal, activity BOOKING_CREATED, sin ingreso | ✅ (QA A2) |
| C2 | Crear · Recurrente · expediente existente | `patient_id` = el elegido; contacto del expediente | ✅ (QA E1) |
| C3 | Crear · Telemedicina | `appointment_mode` TELEMEDICINA, `meet_link` | ✅ meet creado · 🤔 H-013 |
| C4 | Crear desde el calendario (clic en hueco) | igual que C1 con fecha/hora del hueco | ✅ (QA C4) · 🤔 H-034 |
| C5 | Crear rango → agendar DENTRO del rango | consultorio HEREDADO del rango (no se pregunta) | ✅ (rango 13-oct Satélite → «Se toma del rango», BD Satélite) |
| C6 | Choque: hora ya ocupada | la UI lo impide / avisa; no se crea | ✅ «Esa hora no está libre» + sugerencias |
| C7 | Bloquear horario → intentar agendar encima | bloqueado | ✅ (bloqueo 12–13 oculta 12:00/12:30 en agenda Y en el perfil público; 12:15 escrita = «no está libre») |
| C8 | Completar SIN expediente · efectivo · precio de lista | COMPLETED, 1 ingreso `origin` cita PAID efectivo, SIN visita, GCal actualizado | ✅ (QA A2 #1822, Flujo lo lista 1 vez) |
| C9 | Completar CON expediente · transferencia · monto editado | 1 ingreso con el monto editado; visita creada (origen cita) | ✅ (QA E1 #1823 + visita) |
| C10 | Completar con monto 0 | COMPLETED, NINGÚN ingreso; visita sí (con expediente) | 🐞 H-029 → **arreglado `923b1014`** ✅ prod (QA E1 23-oct: sin ingreso, visita sí) |
| C11 | No asistió | NO_SHOW, sin ingreso, sin visita | ✅ · 🤔 H-031 · 🐞 H-030 → arreglado `4c6dce72` (toast en español; sin ver en prod) |
| C12 | Cancelar | CANCELLED + `cancelled_at`, correo de cancelación, evento GCal borrado | ✅ · 🐞 H-030 → arreglado `4c6dce72` (sin ver en prod) · desde `b7eea955` cancelar también APAGA el link vivo |
| C13 | Eliminar (cita terminal) | fila borrada | ✅ · 🕳️ H-032 · H-011 CONFIRMADO |
| C14 | Reagendar (con expediente) | nueva cita `is_rescheduled`, misma info; la vieja CANCELLED | ✅ (QA E1) · 🐞 H-012 · 🤔 H-015 |
| C15 | Reagendar una VENCIDA | permitido (canReschedule) | ✅ (QA C15 vencida → 16-oct 9:00; vieja CANCELLED, nueva reagendada + correo) |
| C16 | Vincular expediente existente a una cita («¿Ya tiene expediente?») | `patient_id` | ✅ |
| C17 | «+ Crear expediente» desde la cita | paciente nuevo con nombre/apellidos/correo/tel de la cita; ligado | ✅ (aviso de correo duplicado) |
| C18 | Desvincular expediente | `patient_id` NULL | ✅ (bloqueado con formulario recibido) |
| C19 | Editar precio en la fila | `final_price` | ✅ |
| C20 | «¿Necesita factura?» on/off | `factura_solicitada`; aparece grupo Factura | ✅ (on) |
| C21 | Bloqueo extendido «Editar» | `extended_block_minutes` | ✅ (45 min) |
| C22 | Reenviar confirmación | `confirmation_email_sent_at` se mueve | ✅ |
| C23 | Link de pago (crear, NO pagar) → completar en efectivo | link activo… ¿se apaga al completar? (H-010) | 🐞 H-010 → **arreglado `b7eea955`** ✅ prod (aviso en «Completar cita»; link CANCELLED y MP lo rechaza) |
| C24 | Formulario pre-consulta crear / borrar | form link | ✅ (crear + el paciente lo envía → SUBMITTED) · 🐞 H-033 → arreglado `4c6dce72` ✅ prod |
| C25 | Nota de la cita (PDF) tras cobro | descarga | ✅ · 🤔 H-035 |
| C26 | Confirmar una PENDIENTE (reserva desde el perfil público) | CONFIRMED + `confirmed_at` + correo | ✅ (reserva pública → PENDING → «Confirmar» → CONFIRMED + correo) · 🐞 H-038 → arreglado `923b1014` ✅ prod · 🤔 H-039 |

## E — Expediente (lo ligado a citas)

| # | Permutación | Estado |
|---|---|---|
| E1 | Crear paciente a mano (Expedientes → nuevo) | ✅ (QA E1) |
| E2 | Editar perfil / contacto | ✅ · 🐞 H-043 · 🤔 H-044 |
| E3 | Visita que nace al completar la cita (C9) — se ve en el expediente | ✅ |
| E4 | Visita SIN cita | ✅ · 🤔 H-024 |
| E5 | Plantilla #1 creada DE CERO | ✅ · 🐞 H-017 · H-018 → arreglado `4c6dce72` ✅ prod · 🤔 H-019 H-020 |
| E6 | Plantilla #2 creada DE CERO (otros tipos de campo) | ✅ · 🐞🔴 H-025 → arreglado `a4248843` · H-026 → arreglado `4c6dce72` ✅ prod |
| E7 | Usar plantilla #1 en una visita, llenar y guardar; reabrir y ver lo guardado | ✅ (y editar) · 🐞 H-021 |
| E8 | Usar plantilla #2; editar fecha propia de la plantilla | ✅ H-022 arreglado `f360a2a7` — «Fecha de Consulta» editable, guardada y recargada en prod (2026-10-05) |
| E9 | Receta en la visita (+ PDF) | ✅ pantalla · 🐞🔴 H-027 PDF · H-028 |
| E10 | Documento / foto en la visita | ✅ |
| E11 | Venta en la visita → ingreso en Flujo | ✅ (pago parcial) · H-036 |
| E12 | Agendar desde el expediente | — no existe fuera de Tratamientos: **decidido no construirlo** (H-045 cerrado 2026-10-05); se agenda en «Mis Citas» |
| E13 | Archivar / desarchivar | ✅ archivar · 🕳️ H-041 (no hay desarchivar) · 🤔 H-042 |

## Extra — permutaciones que salieron en la corrida

| # | Permutación | Estado |
|---|---|---|
| X1 | Agendar a una hora OCUPADA (escrita) → «Esa hora no está libre» + sugerencias | ✅ |
| X2 | Agendar HOY a una hora que ya pasó → «Esa hora ya pasó» | ✅ |
| X3 | Clic en un hueco del calendario → pre-llena día y hora | ✅ |
| X4 | Reserva pública respeta bloqueo + citas existentes (mismos huecos que la agenda) | ✅ |
| X5 | Requerido de plantilla bloquea guardar | ✅ |
| X6 | Editar plantilla llena (peso 72.5 → 71) | ✅ |
| X7 | «Mover a…» plantilla a otra visita (conserva su fecha) | ✅ · 🤔 H-046 |
| X8 | Nota de la visita (`patient_notes.visita_id`) | ✅ |
| X9 | Borrar visita: con contenido NO se ofrece; vacía → borra, cita e ingreso intactos | ✅ |
| X10 | Visita creada a mano para una cita FUTURA → al completar la cita se REUSA (no duplica) | ✅ |
| X11 | Completar cita de paciente ARCHIVADO (cheque) | ✅ · 🤔 H-042 |
| X12 | Contacto: el expediente manda sobre la copia de la cita (tel 0000000001) | ✅ |
| X13 | Visita «seguimiento» de otra → crea tratamiento | ✅ · 🤔 H-024 |
| X14 | Formulario pre-cita: el paciente lo llena en la página pública → SUBMITTED; desvincular expediente queda bloqueado | ✅ · 🐞 H-033 → arreglado `4c6dce72` ✅ prod |
| X15 | Recordatorio automático dentro de la ventana | ✅ (por diseño, H-047) |
| X16 | «Campos de Cita» → Teléfono requerido (Nuevo horario) → el alta sin teléfono se bloquea; revertido | ✅ |
| X17 | «Formulario libre» (sin cita) → el paciente lo envía → SUBMITTED y sale en «Formularios» del expediente | ✅ |
| X18 | Desbloquear (RANGES_UNBLOCKED) | ✅ · 🤔 H-053 |
| X19 | Enlace de reseña: se genera y abre (NO se envió una reseña: publicaría en el perfil público) | ✅ parcial |
| X20 | Modal de la cita desde el calendario: mismos grupos; «+ Crear expediente» de reserva pública parte el nombre y avisa; «Vincular ese expediente» por correo | ✅ |
| X21 | «Facturación» → enlace de datos fiscales (PENDING, FISCAL). NO se llenó (pide RFC; no capturo identificadores fiscales en prod) | ✅ parcial |
| X22 | Cancelar receta (motivo obligatorio) → `cancelled` + motivo; desaparece «Descargar PDF» | ✅ |
| X23 | Eliminar plantilla llena (audit `delete_encounter`) | ✅ |
| X24 | Editar plantilla ya usada (renombrar + agregar campo + pre-cita) | ✅ · 🤔 H-049 |
| X25 | PDF de plantilla | ✅ · 🐞 H-048 |
| X26 | Línea de Tiempo / Docs y Galería | 🐞 H-050 · H-051 → arreglado `4c6dce72` ✅ prod |
| X27 | Link de pago **Stripe** (además de MP) → PENDING activo | ✅ |
| X28 | Reagendar cita con link activo + factura marcada; usar la hora SUGERIDA | ✅ el reagendado · 🐞 H-054 → link: se apaga al cancelar (`b7eea955`); factura: pasa a la nueva (`7323a896`) ✅ prod |
