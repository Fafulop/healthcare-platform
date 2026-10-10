# 09-PLAN — lote de notas N1 · N2 · N3 (2026-10-10)

Las notas viven en `SESSION-REFRESCO.md` («NOTAS PARA UN LOTE»). Este doc dice CÓMO se hacen. Se
escribieron en este orden (de menor a mayor riesgo) pero van en **un solo commit**: L3 usa piezas de L2
(el modal de completar, las acciones compartidas) y los tres tocan el manual y la pantalla del tratamiento.

## L1 — N1: «Cancelar tratamiento» avisa (sólo apps/doctor)

Hoy el botón hace el PATCH directo. Pasa a pedir confirmación con `practiceConfirm`, que dice cuántas
citas agendadas tienen sus sesiones y que **no se cancelan**: hay que cancelarlas a mano, una por una
(desde la agenda o desde cada sesión). Sin citas agendadas, igual confirma (es un cambio de estado).

## L2 — N3: las acciones de la cita desde la visita y desde la sesión (sólo apps/doctor)

Regla: **las mismas** que la agenda, no una copia.
- `lib/citas/acciones-cita.ts` — lo que hoy vive dentro de `useBookings`: `cambiarEstadoCita` (confirmación
  + PATCH + avisos, incl. `avisarLinksDesactivados`) y `completarCita` (PATCH COMPLETED + `income`, sus
  toasts). `useBookings` pasa a llamarlas (mismo texto, mismo comportamiento) y luego recarga.
- `components/citas/BotonesEstadoCita.tsx` — el grupo «Estado» de `StatusActions` (Confirmar · Completar ·
  No asistió · Cancelar · Reagendar, con sus reglas H-070 y de vencida), extraído. `StatusActions` lo usa.
- `CompleteBookingModal` recibe un tipo angosto (`CitaParaCompletar`, lo que de verdad lee); `Booking` lo
  cumple tal cual, y un adaptador lo arma desde `PatientBooking` (la cita que traen visita y tratamiento).
- **Visita**: en la sección «Cita», los botones (con permiso de `citas`). Completar abre el MISMO modal.
  Cancelar / No asistió con la visita VACÍA → el servidor la borra (08 F2): se vuelve al paciente con un
  aviso. Reagendar → la agenda con `?reagendar=<id>&volver=<visita>`: abre el MISMO modal de reagendar de
  la agenda y, al terminar, regresa a la visita (la visita viaja con su cita).
- **Sesión del tratamiento**: la misma fila de botones. Completar / No asistió / Cancelar = los de la
  agenda (cancelar la CITA; la sesión queda por agendar, como al cancelarla en la agenda). Reagendar = el
  que ya tiene la sesión (`AgendarSesionesModal`, que además respeta servicio/precio de la sesión).
  «Cancelar sesión» del «⋯» se queda (es otra cosa: cancela la SESIÓN).

## L3 — N2: toda visita lleva cita (apps/api + apps/doctor, MISMO deploy)

- **apps/api `range-bookings/instant`**: `enConsulta` (sin contacto, sin avisos) vale para HOY **o antes**
  (antes sólo hoy). Un día pasado no avisa a nadie.
- **apps/doctor `POST visitas`**: exige `bookingId` (400 sin cita). Fuera el camino `paraSesion` (visita
  de sesión sin cita). La fecha de las visitas sueltas VIEJAS se sigue pudiendo corregir.
- **«Nueva Visita»**: siempre crea su cita (fuera la casilla «También en la agenda»):
  - hoy → `enConsulta`, hora de ahora;
  - **día pasado** → `enConsulta` y, creada, se abre el MISMO «Completar cita» de la agenda (monto y
    forma de pago; $0 = cortesía) — decisión del usuario 2026-10-10. Si lo cierra sin completar, la cita
    queda vencida y se completa desde la visita (L2);
  - día futuro → como hoy (contacto + correo de confirmación).
  - Sin permiso de `citas`: no crea visitas (se dice); el día con cita sigue abriendo la de la cita.
- **«Abrir visita hoy»** (sesión sin cita): siempre con su cita (fuera la casilla). Sin permiso de citas
  o con el tratamiento no activo: no se ofrece.
- Manual + guía E3 + `capabilities.ts` en el mismo commit.
- Las visitas sueltas que ya existen se quedan como están.

## Prueba en prod (después de cada deploy)

L1: cancelar un tratamiento con citas → el aviso con el número. L2: completar desde la visita (ingreso
en Flujo), no asistió con visita vacía (vuelve al paciente), reagendar desde la visita (regresa a ella),
completar desde la sesión. L3: Nueva Visita hoy/pasado/futuro; API sin `bookingId` → 400.
