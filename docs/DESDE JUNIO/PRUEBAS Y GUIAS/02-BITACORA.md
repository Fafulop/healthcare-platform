# 02 — BITÁCORA de corridas

> **Tipo: BITÁCORA.** Una entrada por corrida, la más nueva arriba. Cada flujo cierra con su evidencia
> de **pantalla** (lo que se vio, con las etiquetas exactas) **y de BD** (salida de
> `scripts/qa/verificar-flujo.cjs`), más logs si hubo algo. Si una afirmación sólo tiene pantalla, se
> dice.

## 2026-10-02 — P0: preparación

- Carpeta, plan, catálogo y hallazgos creados.
- `scripts/qa/verificar-flujo.cjs` (sólo lectura) escrito y probado contra prod.
- **Primera corrida del verificador** (`verificar-flujo.cjs cmt7tu1as0007ms0ttc4pwijd 600`, pepit perez) — lee
  bien citas, visitas, ventas, movimientos, tratamientos y bitácora. Dos cosas vistas:
  - Tratamiento «k»: sesiones 1 y 2 sin cita y dos citas CONFIRMED (2 y 9 oct, 10:00) sueltas. **No es
    bug:** la bitácora dice `link_sesion_cita … bookingId to:null` a las 22:29:49 y 22:29:51 = «Desligar
    cita» a mano (botón que existió hasta `a894e308`). Las citas quedaron en la agenda, como hacía
    desligar.
  - VTA-2026-009: venta de $116 con $0 pagado ⇒ el ingreso #1809 nace con `amount` $116 y `amount_paid`
    $0, `payment_status` PENDING. → H-009 (ver cómo lo muestra Flujo de Dinero en P2).
- **Chrome NO disponible en esta sesión:** la extensión exige la misma cuenta de claude.ai en Claude
  Code y en Chrome; esta sesión quedó en otra cuenta tras un `/login`. P2 espera a eso.

## 2026-10-04 — P3: arreglos en prod (5 commits) y su prueba

Método por arreglo: plan → OK del usuario → código → type-check → code review (+ pasada sobre los arreglos
del review) → OK de commit → push → `commitHash` por servicio → prueba en prod (pantalla + BD + logs).

- **H-010 parte 1 — `d65c9614`.** Migración `add-ledger-provider-payment-id.sql` validada en transacción que
  revienta (duplicado rechazado 23505) y corrida en prod (984 filas, todas NULL). Lectura previa: 127/127
  ingresos de cita PAID y 0 `webhook_pago` con cita ⇒ ningún link se había pagado nunca contra una cita.
  Prueba: cita QA E1 20-oct + link MP $10 `cmuu52bmh…` → completada en efectivo (ING-2026-398) → el usuario
  **no pudo pagar el link (problema de MP)** ⇒ el pago real queda PENDIENTE de probar.
- **«Expirar» en MP (autorizado):** `PUT /checkout/preferences/{id}` con `expires` + `expiration_date_to`
  en el pasado sobre el link QA `cmusqlk6n…` → el checkout dice «Lo que querías pagar ya no se encuentra
  disponible». (El comentario del código decía que en MP no se podía.)
- **H-010 parte 2 — `b7eea955`.** Cita QA E1 21-oct + link MP $10 → «Completar cita» mostró el aviso ámbar →
  completada en efectivo (ING-2026-399) → BD: link `cmuu6drk1…` CANCELLED/inactivo; checkout MP: «ya no se
  encuentra disponible»; logs de api sin errores.
- **H-054 — `7323a896`.** QA E1 22-oct con «¿Necesita factura?» = Sí → «Reagendar» al 23-oct → BD: nueva
  `cmuu78xqj…` CONFIRMED con `true`, vieja `cmuu74khu…` CANCELLED con `null`. (El plan original de MOVER
  también el link se acotó tras el review: el asistente cancela antes de crear.)
- **H-029 — `923b1014`.** QA E1 23-oct completada en **$0**: el diálogo sin «Forma de pago» y con «Cortesía:
  no se registra ningún ingreso…»; toast «no se registró ningún ingreso»; BD: COMPLETED, visita
  `cmuu9pdzz…`, sin ingreso, BOOKING_COMPLETED.
- **H-038 — `923b1014`.** Reserva «QA H038 Publico» desde tusalud.pro/doctores/dr-prueba (13-oct 13:30) →
  pantalla «¡Solicitud enviada!» · «Tu cita quedó apartada; el consultorio te confirmará.»; BD PENDING
  `cmuu9r09d…`; luego CANCELADA desde la agenda (toast todavía en inglés: era antes de `4c6dce72`).
- **Copy — `4c6dce72`.** Vistos en prod: «Plantillas personalizadas» en español; galería y visor de QA E1
  en español («Imagen», «Área del cuerpo»…); visita `cmusr23bq…` muestra «EN AYUNO: Sí»; enlace pre-cita
  NUEVO `8412b930…` (los dos PENDING viejos dicen «Enlace inválido»: su plantilla ya no existe) muestra
  «Dr. Gerardo Lopez Fafutis» (una sola vez). Sin ver: el toast de cancelar en español.

