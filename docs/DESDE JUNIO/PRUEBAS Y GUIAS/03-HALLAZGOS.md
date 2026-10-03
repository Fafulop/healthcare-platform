# 03 — HALLAZGOS: bugs, docs desviados y lo que confunde

> **Tipo: REFERENCIA (viva).** Uno por fila, con id estable (H-001…). **Tipo:** 🐞 bug · 📝 doc ≠ código ·
> 🤔 UX que confunde · 🕳️ hueco (algo que el doctor necesita y no existe). **Estado:** abierto ·
> plan (presentado) · arreglado `<commit>` · descartado (con motivo). Un arreglo de código sigue el
> método de siempre (plan → OK → review → OK de commit); aquí sólo se registra.

## Abiertos al crear la carpeta (vienen de sesiones anteriores, sin re-probar)

| Id | Tipo | Flujo | Qué | Estado |
|---|---|---|---|---|
| H-001 | 🐞 | E9 | La venta de una visita guarda la forma de pago «transferencia» si no se elige otra (`ventas/route.ts`: `formaDePago \|\| 'transferencia'`). ¿El formulario la pide? Verificar en P2 | abierto |
| H-002 | 🐞 | E9 | Carrera: borrar una visita mientras se crea una venta en ella | abierto (anotado VENTAS PACIENTE) |
| H-003 | 🕳️ | E9 | Ventas: el buscador de pacientes tiene tope de 200 | abierto |
| H-004 | 🐞 | A1 | La ruta vieja de slots no usa el precio de la sesión (`precioParaCitaDeSesion`); mecanismo obsoleto | abierto (bajo) |
| H-005 | 🤔 | T | Quitarle el precio a una sesión cuya cita ya lo tomó: la sesión muestra el de su cita | abierto (06-PLAN §4) |
| H-006 | 🐞 | — | «El primer clic después de cargar no hace nada» (Nueva Visita / Agendar sesiones): no se reprodujo (7/7 tras pintar); antes de ~0.7 s se pierde | abierto (menor) |
| H-007 | 🤔 | T6 | Una sesión en el estado raro «visita abierta + cita cancelada» contaba como «Por agendar» en la cabecera pero no salía en el aviso «Agendar sesiones…» | arreglado `a894e308` (V4 paso 2: `visitaViaja` la incluye en el aviso y en el modal) |
| H-008 | 🐞 | — | `scripts/visitas/tratamientos-probe-t6b.ts` importa `paqueteDeCita` (borrado en V2): falla si se vuelve a correr | abierto (script muerto) |

## Encontrados en esta pasada

| Id | Tipo | Flujo | Qué | Evidencia | Estado |
|---|---|---|---|---|---|
| H-009 | 🤔 | E9 / F | Una venta NO pagada crea su ingreso en Flujo por el TOTAL con `amount_paid` 0 (PENDING). ¿Flujo lo muestra como «por cobrar» y no lo suma como entrado? Verificar en P2 en la pantalla de Flujo | BD: VTA-2026-009 → #1809 ($116, pagado $0) | abierto |
| H-010 | 🐞 | A8 / F | Completar una cita **no apaga su link de pago activo** (`PATCH bookings/[id]` no toca `payment_links` / `mp_payment_preferences`). Si el doctor cobra en efectivo y el paciente DESPUÉS paga el link, el webhook ve que la cita ya tiene ingreso (`createPaymentLedgerEntry`: `bookingId` existente ⇒ `return null`) y **no registra nada**: el paciente pagó dos veces y Flujo muestra uno. P2: crear link → completar en efectivo → ver en BD que el link sigue activo (sin pagarlo) | código (P1, 2026-10-02) | abierto — PLAUSIBLE, confirmar en P2 |
| H-011 | 📝 | A9 | El manual dice que «Eliminar» no se puede deshacer, pero no dice qué pasa con lo que cuelga de la cita: el **cobro se queda** en Flujo de Dinero (sin cita: `booking_id` → NULL), la **visita se queda** (sin cita) y la sesión de tratamiento pierde su cita. El servidor no limita por estado (sólo la UI lo ofrece en citas finales) | código (P1) | abierto — documentar tras P2 |
