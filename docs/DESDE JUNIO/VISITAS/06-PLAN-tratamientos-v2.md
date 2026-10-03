# TRATAMIENTOS v2 — el tratamiento como «carpeta» de sesiones (plan, 2026-10-02)

> **Tipo: PLAN.** Lo pidió el usuario el 2026-10-02 al probar las notas de venta (VENTAS PACIENTE).
> Sustituye el modelo de **paquete** de T6 (`03-PLAN-fase-2.md` §6). El estado vivo se anota en
> `SESSION-REFRESCO.md`; aquí, al cerrar cada paso, sólo su commit en la tabla de §8.

## 0. En una línea

Un tratamiento deja de ser un paquete con un precio: es una **carpeta de sesiones**, y **cada sesión
vive sola** — su servicio, su precio, su cita, su visita, su cobro y su nota. El tratamiento sólo
**suma** y lo resume en un PDF.

## 1. Decisiones del usuario (2026-10-02) — no se re-litigan

1. **No hay paquetes.** El total de un tratamiento = **la suma de los precios de sus sesiones**
   (4 × $2,000 = $8,000). Pagado = lo que **cobró** cada sesión; pendiente = total − pagado.
2. **Cada sesión con su servicio y su precio**, elegidos de los servicios de Citas y editables
   (nombre y monto), por sesión.
3. **Agendar con flexibilidad:** por default igual que hoy (misma separación y hora) pero cada
   sesión editable en **fecha y hora**, y la **disponibilidad se ve ANTES de confirmar** («se traslapa
   con…»).
4. **Cada sesión es una tarjeta de visita**, igual a la de la visita; **«Abrir visita» en cualquier
   momento** (también antes de la sesión).
5. **Las ventas de las visitas de las sesiones van en renglón aparte**, no dentro del total de
   sesiones.
6. **Al concluir la cita de una sesión** se pre-llena **el precio de la sesión** y se puede cambiar ahí
   mismo (descuento del día). **Afinada 2026-10-02 (confirmada por el usuario):** una sesión YA cobrada
   cuenta LO COBRADO (no su precio de lista), así que un descuento del día NO se vuelve deuda; lo
   pendiente es lo cobrado que aún no entra (un cobro parcial o pendiente). La versión original («la
   diferencia queda pendiente») dejaba deudas que nadie debía.
7. **Un resumen en PDF** del tratamiento (sesiones, ventas, totales) — documento, no toca Flujo.

## 2. Medido en prod (2026-10-02, read-only)

- Tratamientos con `precio_paquete`: **2**, ambos de dr-prueba, **cancelados** («PRUEBA MANO» con 1
  pago del paquete, «PRUEBA EXTRA»). Nadie real usa el paquete ⇒ quitarlo es seguro; sus datos se
  quedan como están.
- El servidor YA rechaza una cita que se traslapa (`range-bookings/instant` → `findBookingOverlap`,
  409 «Este horario se traslapa con una cita existente (HH:MM–HH:MM)»), pero sólo al CREAR: hoy el
  modal se entera al confirmar y crea «lo que cabe».
- El paquete vive en **21 archivos** (API de citas, de tratamientos, Flujo, agenda, expediente,
  `agenda-agent/proposals.ts`, `packages/database/src/tratamientos.ts`…). ⚠️ Tocar el agente obliga a
  leer antes `AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md` y correr los gates.

## 3. Pasos

| Paso | Qué | BD | Riesgo |
|---|---|---|---|
| **V1** | Sesión con `servicio` + `precio`; totales del tratamiento (sesiones · pagado · pendiente; ventas aparte) | **sí** | medio |
| **V2** | Quitar el paquete (UI + servidor); concluir una sesión cobra su precio | no | **alto** (dinero, 21 archivos) |
| **V3** | Agendar flexible: renglones editables (fecha, hora, servicio, precio) + disponibilidad antes de confirmar | no | medio |
| **V4** | Cada sesión = tarjeta de visita; «Abrir visita» siempre | no | bajo |
| **V5** | «Resumen del tratamiento» (PDF) | no | bajo |

Orden: **V1 → V2 → V3 → V4 → V5.** V1+V2 cambian el modelo de dinero: plan detallado propio (abajo),
SQL a mano, prueba con transacción que revienta, y smoke read-only antes del push.

### 3.1 Reorden y ajustes del usuario (2026-10-02, tras probar V1)

1. **V6 (nuevo, primero) — las visitas de un tratamiento NO salen en la tarjeta «Visitas» del
   expediente.** Se ve mucho y confunde. Una visita de sesión sólo se abre DESDE su tratamiento; en el
   expediente el tratamiento sale como UNA tarjeta (con su avance).
2. **V3 se muda a la CREACIÓN del tratamiento:** «Nuevo tratamiento» con N sesiones muestra de
   inmediato N renglones — servicio (precio editable), fecha y hora (pre-llenadas con la regla de hoy,
   editables por renglón) y disponibilidad (✅ / 🔴 se traslapa) — y al confirmar crea tratamiento,
   sesiones y citas. Un renglón puede quedar **«por agendar»** (servicio y precio sí, fecha después).
   «Agendar sesiones» se queda para las que quedaron por agendar o se agregaron luego.
3. **Reagendar una sesión desde su tarjeta** (hoy sólo desde la agenda, que ya conserva la sesión).
4. **Nuevo orden:** V6 → V3 (en la creación) → V4 (+ «Reagendar») → V2 (quitar paquete: nadie real lo
   usa) → V5.

## 4. V1 — servicio y precio por sesión, y los totales

**BD** (`medical_records.tratamiento_sesiones`, SQL a mano + `prisma db execute`, ANTES del push):
- `servicio_nombre VARCHAR(255) NULL`, `servicio_id TEXT NULL` (liga simple a `public.services`, sin
  FK — sólo de dónde salió el default), `precio DECIMAL(12,2) NULL`.
- Sin backfill: las sesiones viejas quedan con `precio` NULL ⇒ cuentan con el `finalPrice` de su cita
  si la tienen, o $0 «sin precio» (se dice, no se inventa).

**La fuente de cada número** (una sola regla, en el servidor — regla 0; como quedó tras 2 code reviews):
- **Precio PLANEADO** (`precioDeSesion`) = `sesion.precio`; si es NULL, el `finalPrice` de su cita
  propia si aún es plan (pendiente/confirmada) y > 0 (`finalPrice` 0 = «no se sabe»); si no, «sin
  precio».
- **Cobro** (`cobrosDeCitas`) = su movimiento de Flujo (`booking_id` = su cita), con DOS números:
  `cargo` = `amount` (lo capturado al concluir) y `pagado` = `amountPaid` (sin él: el cargo si PAID).
- **Importe de una sesión** = el `cargo` si ya se cobró; si no, su precio planeado (decisión 6
  afinada). **Total** = Σ importes de las **no canceladas**. **Pagado** = Σ `pagado` de esas mismas.
  **Pendiente** = total − pagado (si se pagó de más, «cobrado de más»). Lo que cobraron sesiones
  CANCELADAS va aparte (`cobradoEnCanceladas`): no baja lo que deben las demás.
- **Ventas de las sesiones** (renglón aparte) = las `sales` con `visita_id` en las visitas de sus
  sesiones: su total y su pagado, por separado.

**El precio llega a la cita** (decisión 6: concluirla lo pre-llena):
- una cita que se CREA para la sesión (agendar `paraSesion`, reagendar `reagendaDe`, en
  `range-bookings/instant` y `bookings/instant`) NACE con `sesion.precio` (`precioParaCitaDeSesion`) —
  su evento de Google, su correo y su bitácora ya lo llevan;
- editar el precio o ligar una cita existente la reprecia (`repreciarCitaDeSesion`, exige `citas`)
  sólo si aún es plan: pendiente/confirmada, sin movimiento en Flujo y sin link PAGADO ni
  PENDIENTE-activo (por estado: Mercado Pago apaga la preferencia al pagarse).
- No cubierto: la ruta vieja de slots (`bookings/route.ts`, mecanismo obsoleto).
- Límite conocido: quitarle el precio a una sesión cuya cita ya lo tomó la deja mostrando el de su
  cita («de su cita»); para sacarla del total, se CANCELA.

## 5. V2 — quitar el paquete

- UI: fuera «Precio del paquete» (alta y edición) y «Registrar pago del paquete»; fuera «Cubierta por
  el paquete» en agenda, expediente y visita.
- Servidor: la API de tratamientos rechaza `precioPaquete`; `paqueteDeCita()` deja de aplicar ⇒
  concluir la cita de una sesión registra su cobro normal (el monto capturado), y el link de pago
  vuelve a permitirse (`payment-link-guard.ts`). La ruta `ledger/tratamiento-pago` se apaga (410).
- Los 2 tratamientos viejos con paquete (cancelados, de prueba) se muestran read-only como quedaron.
- **Antes de tocar** `agenda-agent/proposals.ts`: leer `08-EMPIEZA-AQUI.md`; el agente no debe seguir
  diciendo «cubierta por el paquete».

## 6. V3 — agendar flexible con disponibilidad

- El modal arma los renglones con la regla de hoy (fecha base, hora, cada N días) y cada renglón se
  edita (fecha, hora, servicio, precio). Cambiar la regla recalcula sólo los renglones no tocados.
- **Disponibilidad antes de confirmar:** ruta NUEVA read-only (`apps/api`, toggle `citas`) que corre la
  MISMA `findBookingOverlap` que usa crear, para N renglones, sin crear nada. Cada renglón: ✅ libre ·
  🔴 «se traslapa con … HH:MM–HH:MM» (cita o bloqueo). No se confirma con un renglón rojo (se cambia
  o se desmarca). El servidor sigue revisando al crear (otra persona pudo agendar en medio).

## 7. V4 y V5

- **V4:** la tarjeta de cada sesión = la de la visita (consultas, notas, recetas, imágenes, ventas).
  «Abrir visita» siempre: si no hay, la crea ligada a la sesión y a su cita (mismo camino que «Nueva
  Visita → sesión siguiente»); al concluir la cita, el servidor reusa esa visita (`syncVisitaForBooking`
  busca por `bookingId`). Fecha de la visita = la de la cita.
### 7.1 V4 como quedó (2026-10-02, tras probar V3)

El usuario encontró dos huecos al probar V3: una sesión «después» no se podía agendar desde su tarjeta,
y una sesión agregada luego (o de un tratamiento creado con 0) no tenía dónde llenarse. V4 los cierra:
- **Tarjeta = la de la visita:** cita (fecha, hora, estado), servicio/precio/cobrado, notas de la cita,
  conteo de su visita (`describirConteo`), chips de cobro y factura (veredicto del servidor, como
  `VisitasCard`). Acciones principales a la derecha; lo demás (ligar a mano, servicio y precio, notas,
  cancelar, borrar) abajo.
- **«Abrir visita» siempre:** con cita vigente → `POST …/visitas {bookingId}` (fecha = la de la cita;
  G3 la guarda en la sesión); sin cita que cuente → `POST …/visitas {fecha: hoy, paraSesion}` (NUEVO:
  liga atómica, 409 si la sesión ya tiene visita o cita vigente o se canceló), con confirmación («la
  sesión cuenta como hecha»). Exige tratamiento activo y, con cita, poder verla.
- **Estado derivado (cambio):** una visita cuya cita propia sigue PENDIENTE/CONFIRMADA ya **no** hace
  «hecha» la sesión: sigue «agendada» (abrir la visita antes no es haberla atendido).
- **«Agendar»** (por agendar) y **«Reagendar»** (cita activa, sin visita) por sesión: el mismo modal en
  modo `sesion` / `reagendar`. Reagendar = cita nueva con `isRescheduled + reagendaDe` (el servidor pasa
  la sesión) y luego PATCH CANCELLED a la vieja; si algo de eso falla se dice tal cual.
- **«Agregar sesión»** abre una fila (modo `nueva`): `POST …/sesiones` ya acepta `servicioId`,
  `servicioNombre`, `precio`; con fecha se agenda en el mismo paso. Sin `citas` o con el tratamiento
  cerrado: sólo servicio y precio.
- **«Agendar sesiones…»** sale como aviso arriba de la lista («N sesiones están Por agendar»).
- Límite: una sesión con su visita ya abierta no se reagenda desde el tratamiento (el servidor no mueve
  sesiones con visita); su cita se reagenda en la agenda y la sesión se queda en la vieja.
  **→ Resuelto en V4 paso 2 (2026-10-02, decisión del usuario):** la visita de la cita VIAJA con ella
  (`pasarSesionAlReagendar` / `ligarSesionACitaNueva` en packages/database: la visita toma la cita nueva
  y su fecha; lo de adentro conserva la suya — paso 1). Se quitaron «Desligar cita» y «Desligar visita»
  (y el aviso de la «opción A»): lo que no va a pasar se cancela, lo que cambia de día se reagenda.
- **Code review (2 pasadas, 2026-10-02) — decisión del usuario «opción A»:** si la visita se abrió antes
  y su cita se CAE (cancelada / no asistió, o reagendada desde la agenda), la sesión vuelve a «por
  agendar» (con motivo) en vez de quedar «hecha» atorada; «Desligar cita» suelta cita + visita (la visita
  queda en el expediente) y se agenda de nuevo. 0 sesiones de prod cambian con esta regla. Descartadas:
  B (la visita viaja con la cita al reagendar — toca `packages/database` + `apps/api`) y C (no abrir
  visita antes del día de la cita — contradice la decisión 4).
- Otros arreglos del review: reagendar manda el correo de la cita nueva por su cuenta (no en el
  resumen); la vieja sólo se cancela si la sesión pasó a la nueva; una sesión vieja sin servicio
  reagenda con el de su cita; `paraSesion` exige tratamiento activo, acepta cita sin expediente y se
  audita también bajo la sesión.
- Límite (igual que la agenda): no se reagenda a una hora que se traslapa con la cita que se reemplaza.

- **V5:** PDF «Resumen del tratamiento» con el diseño de la receta/nota: paciente, tratamiento,
  sesiones (fecha, servicio, precio, cobrado/pendiente, folio de su nota), ventas aparte, totales.
  Bajo demanda, toggle `flujo`.

## 8. Estado

| Paso | Estado | Commit |
|---|---|---|
| V1 | EN PROD 2026-10-02; SQL aplicada antes del push; 2 code reviews (10 + 10 hallazgos, todos atendidos salvo los límites anotados en §4) | `23bd4aab` |
| V6 | EN PROD 2026-10-02 (visitas de tratamiento fuera de la tarjeta «Visitas») | `c0e964fd` |
| V3 | EN PROD 2026-10-02 (crear con filas: servicio, precio, fecha/hora, después, disponibilidad; «Agendar sesiones» con las mismas filas). Falta prueba a mano | `0234dd1a` |
| V4 | EN PROD 2026-10-02 (ver §7.1) | `f89824f8` |
| V4 paso 1 | EN PROD 2026-10-02: la fecha de una plantilla es SUYA (empieza con la de la visita, editable; sin regla de «mismo día») | `e1cdc37f` |
| V4 paso 2 | EN PROD 2026-10-02 y probado por el usuario (Sesión 3: 16→21 oct, la visita viajó; verificado en BD): la visita VIAJA con su cita; fuera «Desligar cita/visita» | `a894e308` |
| V2 | EN PROD 2026-10-02 (`a82c888b`, api + doctor SUCCESS): sin paquetes (alta/edición rechazan precio; `ledger/tratamiento-pago` → 410; fuera `paqueteDeCita`: la sesión se cobra como cualquier cita, con link de pago). Historia intacta: los $0 «cubierta» y los 2 tratamientos viejos (cancelados, de prueba) se quedan como están y se ven con la cuenta por sesiones | `a82c888b` |
| V5 | EN PROD 2026-10-02 (doctor SUCCESS): «Resumen PDF» en la Cuenta del tratamiento (sesiones con fecha/servicio/estado/importe/pagado/folio, canceladas en gris, totales de la cuenta, ventas renglón por renglón); hoja compartida con la nota de venta (`pdf-documento.ts`, nota byte-idéntica en 4 variantes) | `7e50516f` |
