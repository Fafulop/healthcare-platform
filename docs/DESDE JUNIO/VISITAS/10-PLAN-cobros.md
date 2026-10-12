# 10-PLAN — «Cobros»: la tarjeta de la cita completa fuera de la agenda + el estado de cuenta del paciente (2026-10-10)

Pedido del usuario (2026-10-10), en sus palabras resumidas:
1. En la visita (y la tarjeta de la sesión) van **todas** las acciones de la tarjeta de la cita de la
   agenda, no sólo las de estado: precio, Confirmación (correo/WhatsApp), Cobro (link de pago + nota),
   «¿Necesita factura?» + Factura, Formulario.
2. Una página nueva DENTRO del expediente, **«Cobros»**: un renglón por cita no cancelada **y por venta**,
   cada uno ligado a su visita, con **totales** (cobrado · pagado · pendiente) y las acciones de (1).
   Sustituye a la tarjeta «Citas e Ingresos» de la columna derecha del perfil.
3. **Un solo precio**: cuando la sesión de un tratamiento ya tiene cita, el precio es el de la cita (se
   fija al agendar, se edita en la cita y se cobra al completar). «Servicio y precio» de la sesión queda
   sólo para sesiones SIN cita (el plan). «Cancelar sesión» se queda como está.

## Estado (2026-10-10)

| Fase | Commit | Prueba en prod (Chrome + BD) |
|---|---|---|
| P1 tarjeta completa en visita y sesión | `0dd5839a` | ✅ visita de pepit perez (16 oct): precio, «¿Necesita factura?» (la insignia de arriba y el grupo FACTURA se actualizan juntos; se desmarcó después), CONFIRMACIÓN, «Link de pago», «Crear formulario» abre «Formulario Pre-Cita» (se cerró sin generar); sesión 3 de «k»: «Más de la cita» sin ESTADO; el modal del calendario igual que antes |
| P2 página «Cobros» | `e3e8b539` | ✅ pepit perez: Registrado $816 · Pagado $700 · Pendiente $116 · por cobrar $8,100 — IGUAL al cálculo aparte en la BD (citas 0+200+500 pagadas, venta VTA-2026-009 $116 pendiente, 9 agendadas = $8,100); «Acciones de la cita» abre la tarjeta; ventas con su visita |
| P3 resumen en el perfil | `510ab770` | ✅ «Citas e Ingresos» ya no está; resumen: pendiente de sus citas $0, por cobrar $9,000 (una cita nueva de $900 creada en paralelo, verificada en la BD), «1 cita lista para facturar» = la del 15 oct ($500, casilla marcada, sin factura) |
| P4 un solo precio por sesión | `781cf26c` | ✅ «k» (pepit perez): sesiones 1 y 2 (sin fecha) ofrecen «Servicio y precio»; 3 y 4 (cita viva) ya no y dicen «$900 (de su cita)». En prod 0 sesiones tenían precios distintos (ningún total cambió) |
| Ajustes tras P3 | `3d1fd5ce` | ✅ «Cobros»: «Cobro y factura de la cita» sólo con precio · casilla · «Completar» (abre «Completar cita» con $900) · Cobro · Factura; visita: tarjeta compacta (precio · casilla · horario en un renglón, grupos en rejilla) |

Revisiones: P1 (10 hallazgos; permisos de Cobro/Factura, insignias viejas, botones que desaparecían…), P2 (10; el veredicto de pago debe ser el del servidor, pendiente por renglón…), P3 (9; una sola regla `cobros/cuenta.ts` para perfil y Cobros, borradores del asistente visibles…). Todo arreglado antes de cada push.

## Decisión de diseño: la MISMA tarjeta, no botones sueltos

La lista de citas de la agenda (`GET apps/api …/appointments/bookings`) ya arma la cita COMPLETA que pinta
la tarjeta (`Booking`: ingreso, factura, links de pago, formulario, contacto del expediente). Sólo le
falta un filtro por paciente. Con él, la visita, la sesión y «Cobros» pintan **el componente de la
agenda** (`StatusActions`, que ya tiene un `layout="card"` para el modal del calendario) con **los mismos
manejadores** (`useBookings`). Nada se copia: lo que cambie en la agenda cambia en las tres pantallas.
(Se descartó adaptar botón por botón desde `PatientBooking`: es la lógica replicada que deriva.)

## Fases (cada una: plan → código → type-check + gates → review → OK → push → prueba en prod)

### P1 — La tarjeta completa en la visita y en la sesión
- **apps/api** `GET …/bookings`: filtro opcional `patientId` (misma consulta, un `where` más). Prisma
  `where.patientId` — query shape nueva: smoke test sólo lectura contra prod ANTES del push.
- **apps/doctor** `useBookings(doctorId, { patientId })`: trae sólo las citas de ese paciente; los
  manejadores (estado, completar, precio, correo, formulario, «¿Necesita factura?») son los mismos.
- **Visita** (sección «Cita»): la tarjeta de la agenda en lugar de `BotonesEstadoCita` + `PriceCell` +
  `FacturaCheckbox`; el modal del formulario (`PreAppointmentFormModal`) se monta ahí. Reagendar sigue
  yendo a la agenda (`?reagendar=`). Lo de 09 L2 que siga siendo útil (vuelta al paciente si la visita
  vacía se borra) se conserva.
- **Tarjeta de la sesión**: igual, plegada («Más de la cita») para no hacer enorme la tarjeta. «Cancelar»
  de la tarjeta = la CITA; «Cancelar sesión» del «⋯» = la sesión (sin cambios).
- Manual + guías (E3, A-*) + `capabilities.ts` en el mismo commit.

### P2 — La página «Cobros» del expediente (`/patients/[id]/cobros`)
- Renglones: las citas no canceladas del paciente (de P1) **y sus ventas** (`GET ventas?patientId=`),
  en orden de fecha; cada uno con su visita (enlace) y, en las citas, la tarjeta de P1 plegada.
- **Totales** arriba: cobrado · pagado · pendiente (la misma regla que la «Cuenta del tratamiento»:
  lo cobrado al concluir o el precio si aún no; las ventas aparte o sumadas — se decide al planear P2).
- Permisos: citas para ver las citas, `flujo` para montos, `ventas` para ventas (como hoy).
- Entrada: botón «Cobros» en el encabezado del perfil.

### P3 — El perfil más limpio
- Se quita «Citas e Ingresos» de la columna derecha; queda un resumen chico («$X pendiente · N por
  facturar · Ver cobros») con enlace a P2. Sólo después de probar P2 en prod.

### P4 — Un solo precio por sesión con cita
- «⋯ → Servicio y precio» sólo en sesiones SIN cita. Con cita, la tarjeta enseña el precio de la cita
  (o lo cobrado) y se edita en la cita (P1). Revisar `cuentaDelTratamiento` y el PATCH de la sesión para
  que, con cita, el precio que cuenta sea el de la cita (hoy el de la sesión puede pisar al de la cita).

## Lo que se decide al planear cada fase (no ahora)
- P1: si la tarjeta de la sesión va plegada o completa; qué pasa con «Eliminar» (sólo en citas
  terminadas) dentro de la visita.
- P2: ventas sumadas al total o aparte; qué hace un renglón de venta sin visita.
- P4: qué pasa con las sesiones viejas cuyo precio propio difiere del de su cita.
