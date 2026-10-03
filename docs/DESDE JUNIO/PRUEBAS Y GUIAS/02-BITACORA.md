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
