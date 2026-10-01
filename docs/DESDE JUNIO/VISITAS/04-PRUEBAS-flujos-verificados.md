# 04 — PRUEBAS: los flujos de Tratamientos, cómo se prueban y qué se comprobó

> **Tipo: REFERENCIA (viva).** Se agrega una entrada cada vez que se prueba a mano algo de Visitas /
> Tratamientos. Escrito el 2026-10-01 tras la prueba en prod de T4 · T5 · T6b · limpieza de Visitas.
> Para un LLM que llega en frío: **lee §1 antes de probar nada** — dice qué cuenta como evidencia y qué
> no, y las trampas que ya se pisaron.

## 0. Qué hay aquí

1. Las reglas de la prueba (qué es evidencia, qué datos se usan, qué no se toca).
2. El método: navegador (lo que ve el doctor) + BD (lo que de verdad quedó) + logs.
3. Cada flujo: pasos, lo que debe verse, lo que debe quedar en la BD, y el resultado con su evidencia.
4. Lo que NO se pudo probar y por qué.
5. Las trampas.

Los *probes* (transacción que siempre revierte) prueban las funciones contra la BD real; esta guía
prueba **el clic**. Son dos cosas distintas y hacen falta las dos (ver la memoria
`feedback_typecheck_gates_is_not_tested`).

## 1. Reglas de la prueba

- **La UI no es evidencia.** Un toast verde dice lo que el cliente CREE que pasó. Cada flujo se cierra
  leyendo la BD (§2.2). En la sesión del 2026-10-01 el primer reporte se dio con sólo la UI y el usuario
  preguntó «¿lo probaste o lo infieres?» — la respuesta honesta era «lo vi en pantalla». Desde entonces:
  pantalla **y** BD, y se dice cuál de las dos respalda cada afirmación.
- **Datos de prueba:** cuenta de doctor **dr-prueba** (aparece como «Diego», Medicina Interna; doctorId
  `cmni1bov90000mk0lyeztr3ad`), paciente **«pepit perez»** (`cmt7tu1as0007ms0ttc4pwijd`).
  Crea un tratamiento PROPIO para cada prueba (p. ej. «PRUEBA MANO»).
- **NO TOCAR:** el tratamiento **«f»** de pepit perez (lo creó el usuario; su sesión 2 es la cita del
  26 ago `cmt7tjc1p…` con la visita `cmunignhp…`). Tampoco las citas reales de otros pacientes.
- **Correos:** toda cita con correo dispara correos reales (resumen de T5, aviso de reagendar,
  recordatorio automático 1 h antes — está ENCENDIDO en dr-prueba). Usa **el correo del usuario**
  (`quebradita.a@gmail.com`, el usuario lo eligió) y teléfono/WhatsApp **`0000000000`** para que ningún
  SMS le llegue a nadie. Pregunta antes si cambia.
- **Navegador:** Claude Code y la extensión de Chrome deben estar en la MISMA cuenta de claude.ai
  (**quebradita.a**); si no, la extensión no aparece. El Chrome de lopez.fafutis no tiene la sesión de
  dr-prueba.

## 2. Método

### 2.1 En el navegador

- Abre una pestaña nueva; `doctor.tusalud.pro`. Para leer el estado usa `get_page_text` o
  `javascript_tool` (`document.querySelector('main').innerText`), no `find` (gasta cuota y ya dio
  falsos).
- Los campos de React se llenan con **clic + teclear** (no `input.value = …`). Los botones se pueden
  pulsar con `javascript_tool` buscándolos por texto, PERO un modal abierto así a veces no se pinta:
  si la captura no lo muestra, haz clic de verdad.
- **Antes de hacer clic por coordenadas en una tabla, vuelve a medir:** la tabla de citas se reordena
  sola (vence el «Ver acciones», cambia un filtro) y el clic cae en otra fila. Mejor: localizar la fila
  por su texto (`tr` que contiene «Sesión 1 de 3 — PRUEBA MANO») y pulsar SU checkbox/botón.

### 2.2 En la BD (sólo lectura)

```bash
cd packages/database
railway run --service pgvector node ../../scripts/visitas/verificar-tratamiento.cjs <tratamientoId> [minutos]
```

Imprime: el tratamiento (precio, estado), cada sesión con su cita (fecha, hora, estado, reagendada,
casilla de factura) y su visita; los movimientos de Flujo de Dinero con `tratamiento_id` (monto,
`origin`, fecha, cita, subárea, concepto) con el pagado/saldo que DEBE mostrar la pantalla; los links de
pago nuevos del doctor en la ventana; y la bitácora (`patient_audit_logs`, sin las vistas).
Para algo que el script no cubre, una consulta ad hoc en el scratchpad con el método de
`docs/DESDE JUNIO/flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`.

### 2.3 En los logs

```bash
railway deployment list --service @healthcare/api --json    # el id del deploy que estaba VIVO a esa hora
railway logs --service @healthcare/api -n 400 <deploymentId>
```

Ojo: si hubo un deploy después de la prueba, los logs de la prueba están en el deploy ANTERIOR.
**Los correos no se registran en los logs de apps/api** (sólo Telegram) — ver §4.

## 3. Los flujos

Formato: **Pasos → Debe verse → Debe quedar en la BD → Resultado (fecha, evidencia).**
Tratamiento de la corrida del 2026-10-01: «PRUEBA MANO» `cmuq0namj0001n20tts5k98bh`, 3 sesiones.

### F1 — Crear un tratamiento y ponerle precio de paquete (T3 + T6b)

- **Pasos:** expediente → «Nuevo tratamiento» → Nombre + «Sesiones planeadas» → «Crear tratamiento».
  Ya en el tratamiento: «Editar» → «Precio del paquete (opcional, MXN)» → Guardar. (El precio NO está en
  el modal de crear; sólo en «Editar», y sólo con permiso `flujo`.)
- **Debe verse:** antes del precio, la tarjeta «Sin precio de paquete: cada sesión se cobra al
  completarla…»; después, «Paquete» con Precio · Pagado $0 · Saldo = precio.
- **BD:** `precio_paquete` = el precio; bitácora `update_tratamiento {precioPaquete: {from: null, to: N}}`.
- **Resultado 2026-10-01:** ✅ pantalla y BD (`precioPaquete=1000`; bitácora con from/to).
  Detalle visto: el mismo guardado registra `notas: 'editado'` aunque no se tocaron las notas (el
  formulario siempre manda las notas) — anterior a T6, pendiente.

### F2 — «Agendar sesiones…» (T5)

- **Pasos:** en el tratamiento → «Agendar sesiones…» → marcar sesiones, «Primera», «Hora», «Cada
  (días)», servicio, consultorio, correo/teléfono/WhatsApp (dr-prueba los exige por «Campos de cita»),
  modalidad → «Agendar N citas».
- **Debe verse:** resumen con ✓ por sesión «agendada» y «Se le mandó al paciente UN correo con las N
  citas»; al cerrar, cada sesión «Agendada» con su «Cita: …»; en la agenda, la etiqueta «Sesión N de M —
  nombre» en cada cita.
- **BD:** cada sesión con `booking_id` a una cita `CONFIRMED` en la fecha esperada; el intervalo se guarda
  (bitácora `update_tratamiento {intervaloDias: {from: null, to: 7}}`).
- **Resultado 2026-10-01:** ✅ pantalla y BD (citas 1, 8 y 15 oct 10:00). El correo: ver §4.
  **Efecto colateral:** el flujo de citas LLENA el contacto vacío del expediente — pepit perez quedó con
  el correo y el teléfono de la prueba.

### F3 — La agenda muestra la sesión (T4)

- **Pasos:** Mis Citas → «Todas las fechas» → buscar el paciente.
- **Debe verse:** bajo el servicio, «Sesión N de M — nombre» (lo ve todo el que ve la agenda — decisión
  del usuario).
- **Resultado 2026-10-01:** ✅ pantalla («Sesión 2 de 2 — f» en la cita del 26 ago; «Sesión 1/2/3 de 3 —
  PRUEBA MANO»).

### F4 — Reagendar una cita que es sesión (T4)

- **Pasos:** en la fila → flecha «Ver acciones» → «Reagendar» → servicio → día → escribir la hora → «Usar
  …» → «Confirmar cita».
- **Debe verse:** «Cita Reagendada» y el toast verde «La sesión N de M de «X» pasó a la nueva cita.»;
  la etiqueta de sesión ahora en la cita nueva.
- **BD:** la cita vieja `CANCELLED`; la nueva `CONFIRMED` con `isRescheduled = true`; la sesión apunta
  a la NUEVA (lo hace el servidor dentro de la creación — `pasarSesionAlReagendar`).
- **Resultado 2026-10-01:** ✅ pantalla y BD (15 oct → 16 oct 11:00; la del 15 `CANCELLED`, sesión 3 →
  `cmuq0rdes…`).

### F5 — Completar una sesión cubierta por el paquete (T6b + T4)

- **Pasos:** en la fila de la sesión → «Completar».
- **Debe verse:** el modal dice «Cubierta por el paquete «X»» (caja verde-azulada), el campo es «Cargo
  extra (opcional, MXN)» en 0, sin forma de pago mientras no haya extra, y «Se registrará en Flujo de
  Dinero como «cubierta por el paquete» ($0)». **Vaciar el campo NO deshabilita «Completar»** (vacío =
  0). Toast: «Cita completada · cubierta por el paquete «X» (se registró en $0)». En el tratamiento, la
  sesión pasa a «Hecha» con «Abrir su visita».
- **BD:** cita `COMPLETED`; la sesión con `visita_id` (P2); UN movimiento: `amount 0`, `origin cita`,
  concepto «… (cubierta por el paquete «X»)», con `booking_id` Y `tratamiento_id`, `hasFactura false`.
- **Resultado 2026-10-01:** ✅ pantalla y BD (movimiento #1802 $0; visita `cmuq0shcj…`).
- **No probado aún:** completar desde el ASISTENTE (su card debe decir «Cubierta por el paquete…» y
  su resumen usar `cobroRegistrado`). El asistente está OCULTO para todos los doctores
  (`ASISTENTE_IA_VISIBLE = false`, `lib/agenda-agent/feature-flag.ts`): no hay botón para probarlo.

### F5b — Sesión cubierta CON cargo extra (T6b)

- **Pasos:** como F5, pero en «Cargo extra (opcional, MXN)» escribe un monto > 0.
- **Debe verse:** al haber extra aparece «Forma de pago» y el texto cambia a «Se registrará el cargo
  extra en Flujo de Dinero, marcado «paquete + extra»». Toast «Cita completada · cubierta por el paquete
  «X» + cargo extra de $N». En el tratamiento: Pagado NO cambia y aparece «Cargos extra cobrados en
  sesiones: $N». En el expediente esa cita dice «Pagado · <forma>» con $N (sí entró dinero).
- **BD:** UN movimiento `amount N`, `origin cita`, concepto «… (paquete + extra «X»)», con cita y
  tratamiento.
- **Resultado 2026-10-01:** ✅ pantalla y BD («PRUEBA EXTRA» `cmuq236pm0001ll0to6s2c6nr`, $500; #1804
  $200 → Pagado $0 · Saldo $500 · extras $200).

### F6 — Una sesión de $0 no se factura (T6b, hallazgo 3 del review)

- **Pasos:** marcar «¿Necesita factura?» en la fila de la sesión completada → filtro «Por Facturar».
  Luego el expediente → «Citas e Ingresos».
- **Debe verse:** la sesión NO aparece en «Por Facturar» aunque tenga la casilla; en el expediente,
  «$0.00 · Cubierta por el paquete — no se factura» y ningún botón «Facturar».
- **BD:** `facturaSolicitada = true` en la cita (o sea: se excluyó por el $0, no por falta de casilla).
- **Resultado 2026-10-01:** ✅ pantalla y BD.
  Visto, sin arreglar: la tarjeta de la visita y la fila del expediente dicen «Pagado · Efectivo» en esa
  sesión de $0 — cierto en el libro, pero confuso; «Cubierta por el paquete» sería más claro.

### F7 — Registrar un pago del paquete (T6b)

- **Pasos:** tratamiento → «Registrar pago del paquete» → Monto, Forma de pago, Fecha (hoy en México por
  omisión) → «Registrar pago».
- **Debe verse:** Pagado sube, Saldo baja, y la lista «fecha · $monto · forma».
- **BD:** movimiento `origin manual`, SIN cita, con `tratamiento_id`, subárea vacía, fecha del día;
  pagado = suma de los `manual` (no de «sin cita»: hallazgo 6 del review).
- **Resultado 2026-10-01:** ✅ pantalla y BD (#1803 $600 → Pagado $600, Saldo $400).

### F8 — No se borra un tratamiento con dinero (T6b, hallazgo 5)

- **Pasos:** tratamiento → «Borrar» → «Confirmar».
- **Debe verse:** toast rojo «No se borra: tiene pagos registrados en Flujo de Dinero. Usa «Cancelar
  tratamiento».»
- **BD:** el tratamiento sigue existiendo.
- **Resultado 2026-10-01:** ✅ pantalla y BD.

### F9 — No se genera link de pago para una sesión cubierta (T6b)

- **Pasos:** fila de una sesión cubierta y agendada → «Link de pago» → «Crear link de pago».
- **Debe verse:** toast rojo «Esta sesión está cubierta por el paquete «X»: no se le genera link de
  pago. Si hay un cargo extra, cóbralo al completar la cita.» (El botón «Link de pago» sigue visible: el
  bloqueo es del SERVIDOR.)
- **BD:** la cita sin `paymentLink` ni `mpPaymentPreference`; 0 links nuevos del doctor en la ventana
  (o sea: no se creó NADA en Stripe/Mercado Pago, no sólo «salió un error»).
- **Resultado 2026-10-01:** ✅ pantalla y BD (Stripe=0 · Mercado Pago=0).

### F10 — «Nueva consulta» sin visita (limpieza de Visitas, `2f125cce`)

- **Pasos:** abrir directo `…/patients/<id>/encounters/new` (sin `?visitaId=`).
- **Debe verse:** te regresa al expediente.
- **Resultado 2026-10-01:** ✅ pantalla (la URL terminó en el expediente). La regla del mismo día en el
  servidor NO se probó a mano (sí por código y review).

### F11 — Expediente: «+ Nuevo» en cada tarjeta y el chip «Cubierta por el paquete» (`ce7c69fb`)

- **Pasos:** perfil del paciente → arriba a la derecha de cada tarjeta.
- **Debe verse:** Visitas «Nueva visita» (abre el modal «Nueva Visita» con «¿De qué cita?»);
  Tratamientos «Nuevo tratamiento» (también sin tratamientos); Formularios «Nuevo formulario» (abre
  «Formulario libre» con el paciente FIJO, sin «Cambiar»; sólo con permiso `citas`); Notas Recientes
  «Ver todas» + «Nueva nota» (abre Notas con una nota en blanco y el selector «Visita:», `?nueva=1`).
  La sesión de $0 dice «Cubierta por el paquete» (chip verde-azulado) en «Citas e Ingresos», en la
  tarjeta de Visitas y en la página de la visita, con «No se factura: lo que se factura es el pago del
  paquete»; y aunque tenga marcada «¿Necesita factura?», NO sale el chip naranja «Necesita factura».
- **BD:** el veredicto es `estadoPago = 'CUBIERTA'` (ingreso de $0 con `tratamiento_id`) en
  `GET …/patients/[id]/bookings`; smoke de sólo lectura: 1 ingreso en todo prod lo cumple (el de la
  prueba). «Editar» sin tocar las notas ya NO anota `notas: 'editado'` (bitácora de «PRUEBA EXTRA»).
- **Resultado 2026-10-01:** ✅ pantalla (los 4 botones abiertos sin guardar nada; chip en las 3 vistas;
  sin «Necesita factura» con la casilla marcada — se marcó y se desmarcó) y BD (bitácora).

### F12 — La agenda de una sesión cubierta: «Paquete» en vez del precio de lista

- **Pasos:** Mis Citas → «Todas las fechas» → la fila de una sesión de un tratamiento CON precio.
- **Debe verse:** en PRECIO, chip «Paquete» (o «Paquete + $N extra» si al completarla se cobró un
  extra) en vez de «$900», y no se puede editar; al abrir sus acciones, en COBRO dice «Cubierta por el
  paquete» en vez del botón «Link de pago». Una cita normal sigue igual ($ editable y «Link de pago»).
- **Por qué:** la columna enseña el precio con que se agendó la cita (`finalPrice`), no lo cobrado; en
  una sesión cubierta eso hacía creer que se cobraron $900. El dinero (Flujo, saldo, factura) ya estaba
  bien — era sólo la etiqueta.
- **Resultado 2026-10-01 (`83f0e8d6`):** ✅ PRECIO, por pantalla — lo copió el usuario de la agenda:
  «Paquete + $200 extra» (PRUEBA EXTRA), «Paquete» (PRUEBA MANO), y «$900» en «f» (sin precio de
  paquete) y en las citas normales. ⏳ Sin ver aún: «Cubierta por el paquete» en lugar de «Link de pago»
  (las acciones no venían abiertas en lo copiado). Lo de la BD no cambia con este commit (sólo la UI).

### F13 — «¿Es seguimiento?» en «Nueva Visita» (T7)

- **Pasos:** perfil → «Nueva visita» → «Sin cita» (o una cita que NO sea sesión) → «¿Es seguimiento?».
  (a) «Sesión siguiente de «X»» con un tratamiento activo; (b) «Seguimiento de una visita anterior» con
  una visita que no sea de ningún tratamiento; (c) elegir la cita de una sesión → no debe aparecer la
  pregunta; (d) una visita anterior de un tratamiento cancelado no aparece en la lista.
- **Debe verse:** toast «Esta visita es la sesión N de su tratamiento» (a) / «Se creó el tratamiento
  «Seguimiento del …»: esta visita es su sesión 2» (b); en el perfil, la tarjeta de Visitas dice «Sesión N
  de M — X» bajo esa visita y el tratamiento aparece en Tratamientos.
- **BD:** `scripts/visitas/verificar-tratamiento.cjs <tratamientoId>` — la sesión N con `visita` = la
  nueva; en (b) sesión 1 = la anterior; bitácora `create_tratamiento` (motivo «seguimiento de una visita»)
  y `link_sesion_visita` / `create_sesion` (motivo «Nueva Visita · es seguimiento»).
- **Resultado:** ⏳ PENDIENTE a mano. Funciones reales 10/10 contra prod en tx revertida
  (`scripts/visitas/tratamientos-probe-t7.ts`): nace «Seguimiento del 12 sep» con 1 = anterior y 2 = nueva;
  sin sesión libre agrega al final; visita anterior ya en un tratamiento activo → ese mismo; llena la
  primera libre de un tratamiento planeado; una sesión cuya cita se canceló cuenta como libre; cancelado → 409; visita de uno cancelado → 409; las lecturas
  nuevas (`sesionesDeVisitas`, `esSesion`) corren.

### Flujos probados antes (con su evidencia en otro doc)

- **T3** (crear tratamiento, ligar cita/visita, cancelar sesión con sus 3 salidas, borrar con 409):
  `SESSION-REFRESCO` §0 — 2026-10-01, dr-prueba / pepit perez.
- **Reagendar (versión previa a T4, desde el navegador):** `SESSION-REFRESCO` §0 — reemplazada por F4.
- **Visitas fase 1** (D4, D5, D5b, lanzamiento): `02-PLAN-fase-1.md` §6 y `SESSION-REFRESCO`.

## 4. Lo que NO quedó probado

| Qué | Por qué | Cómo se probaría |
|---|---|---|
| Que los correos (resumen de T5, aviso de reagendar) LLEGARON y su redacción | apps/api no registra los envíos de correo; la UI sólo dice que se mandó | El usuario revisa la bandeja de `quebradita.a@gmail.com` |
| El asistente: completar una sesión cubierta y el barrido «qué falta facturar» con pagos de paquete | Sólo probe + type-check; un contrato con un LLM no se verifica leyendo el código | Pedirle al asistente que complete la sesión 2 y que diga qué falta facturar de pepit perez |
| Un ayudante SIN `flujo` | No hay sesión de ayudante en ese Chrome | No debe ver «Paquete», ni el precio en «Editar», y la ruta de pago debe dar 403 |

## 5. Trampas que ya se pisaron

- **Reportar con sólo la UI** (§1). Escribe al lado de cada ✅ si lo respalda la pantalla, la BD o los
  dos.
- **La tabla se reordena bajo el cursor** (§2.1). El 2026-10-01 un clic por coordenadas cayó en otra
  fila; se comprobó en la BD que no cambió nada ajeno (sólo las 4 citas de la prueba tenían `updatedAt`
  reciente) antes de seguir.
- **Los logs de la prueba viven en el deploy que estaba vivo** — si desplegaste después, pide los del
  anterior por `deploymentId`.
- **El flujo de citas escribe en el expediente:** llena correo/teléfono vacíos del paciente con lo que
  se capturó en la cita.
- **Las citas de prueba futuras mandan recordatorios** (1 h antes): cancélalas al terminar o avisa.

## 6. Datos que dejó la corrida del 2026-10-01

«PRUEBA MANO» (`cmuq0namj0001n20tts5k98bh`) activo con citas del 8 y 16 oct; movimientos #1802 ($0) y
#1803 ($600) en Flujo de Dinero de dr-prueba; la casilla «¿Necesita factura?» marcada en la cita del
1 oct; pepit perez con correo `quebradita.a@gmail.com` y teléfono `0000000000`.
**Limpiado el 2026-10-01:** «PRUEBA MANO» cancelado (sesiones 2 y 3 y sus citas canceladas), casilla
desmarcada, contacto de pepit perez vacío. Quedan en Flujo de Dinero de dr-prueba #1802 ($0), #1803
($600) y, de F5b, #1804 ($200) — borrar movimientos es decisión del usuario. «PRUEBA EXTRA» cancelado.
