# 🎟️ TIERS — planes del producto (feature-gating por cuenta)

> **Qué es.** Ofrecer el producto en **niveles (tiers)**. Cada doctor (=cuenta) tiene un tier; el
> tier define qué FUNCIONES incluye su plan. Es una capa NUEVA que se apila sobre el sistema de
> permisos de usuarios secundarios (`NUEVOS USUARIOS`), no lo reemplaza.
>
> 🔄 **Sesión nueva:** lee `01-DISENO-tecnico.md` completo. La decisión central (por qué esto NO
> es un sistema de gating nuevo sino un techo sobre el vocabulario de permisos existente) está en
> §1–§2; los cuatro huecos que cambian la implementación están en §5.

## 🎉 2026-09-20: #6.2b — la reserva pública — en prod `d7d04b20` y PROBADO. **Ya no queda ningún 🔴**

Un paciente agendaba en la cuenta de un doctor **congelado** y recibía su SMS de confirmación,
mientras el doctor no podía abrir la app para ver esa cita (más evento de Calendar y Telegram). Era
lo único que seguía produciendo estado malo solo. Ahora los **cuatro** caminos que crean citas
responden 409 `ACCOUNT_FROZEN` antes de crear nada, y el perfil público dice «Este doctor no está
recibiendo citas en línea por ahora» + el teléfono — no «no hay horarios» (que sería falso de otra
forma) y nunca el porqué. Detalle, decisiones y pruebas en [`04` §12.9](04-PLAN-cambio-de-plan.md).

**Probado congelando dr-quebradita ~7 min en prod** y devolviéndola como estaba (31 citas antes, 31
después): perfil y **blog** con la tarjeta, el modal también, `POST` ⇒ 409, sin cita y sin SMS.

🔒 **De paso, una fuga viva:** `congeladaDesde` —la fecha en que un doctor dejó de pagar— se servía
a cualquiera en la ruta pública, mientras `tier` sí estaba excluido. **Exposición real: ninguna**
(0 cuentas congeladas; el campo fue `null` para todos los doctores reales los dos días que estuvo
expuesto), **nada que rotar**. El gate no lo atrapó porque su patrón estaba sólo en inglés; ahora
habla español.

**⏭️ Sigue, ya sin nada urgente:** **#6.3 sólo le falta el CLIC** → #6.4 (correos) → #6.5 (la
descarga masiva de expedientes no deja rastro) → #5b. Para **modo vivo** lo que falta ya no es
código: es **C4**, las 10 cuentas PRO que no pagan.

## ✅ 2026-09-20: #6.3 — «Descargar mi información» — en prod `3bb783a1`, **falta el clic**

Cualquier dueño —y sobre todo una cuenta **congelada**, que llega sin pagar— baja un zip con todo
lo que capturó: `pacientes/consultas/citas/recetas/tareas/adjuntos.csv` y **el expediente completo
de cada paciente en HTML** (se abre sin nosotros y se imprime a PDF). Sin los adjuntos: trae su
LISTA. **Sin los CFDI** — decisión del usuario: lo que se lleva es el expediente, no la
contabilidad, y traerlos obligaba a bajar de Facturama cada XML en serie dentro de una sola
petición. Detalle, los dos reviews y cómo se verificó en
[`04` §12.8](04-PLAN-cambio-de-plan.md).

Desplegado y confirmado por servicio (api `4b27b52a` · doctor `41e59c64`, ambos SUCCESS; la ruta
responde 401 sin sesión ⇒ existe de verdad). Verificado corriendo el export **contra prod** y
contando lo que quedó en el zip **contra la BD** (23/23 tareas, 7/7 adjuntos).

🔴 **Pendiente: darle clic.** El botón y la descarga del blob nunca se ejecutaron; `tsc` sólo dice
que compilan. Abrir Mi Cuenta → «Descargar mi información»: si baja un zip con `tareas.csv`
adentro, #6.3 queda cerrado.

**⏭️ Siguió 6.2b, y ya está** (arriba): era el último 🔴.

## ✅ 2026-09-18 (noche): #6.2 — congelar — en prod `62e36800` y probado con clic

Quien dejó de pagar, venció el margen de 15 días y no cabe en Gratis queda **congelado**: sólo
entra a Mi Cuenta para pagar; lo demás responde `ACCOUNT_FROZEN`. Detalle, review y prueba en
[`04` §12.7](04-PLAN-cambio-de-plan.md). El job #6 del cron ya está en Railway.

## 🟡 LOGIN (no es de TIERS): un correo de Google quedaba dentro de la cuenta de OTRO — ARREGLADO, falta una prueba

**Encontrado el 2026-09-18 probando #4, y probado en vivo.** Al entrar con `quebradita.a@gmail.com`
(rol DOCTOR, cuenta `dr-quebradita`) se entraba a la cuenta `gerardo` del usuario
`lopez.fafutis@gmail.com` (ADMIN) — también en incógnito y después de cerrar sesión.

**Causa (medida en la BD):** la tabla `accounts` tenía **las dos** identidades de Google
(`107724…` y `114492…`) ligadas al usuario `lopez.fafutis`, creadas con minutos de diferencia el
**2026-04-07** (el día de la migración a sesiones de base de datos). Auth.js, cuando alguien entra
con una cuenta OAuth que no está ligada **mientras ya hay una sesión abierta**, NO cambia de usuario:
**liga esa identidad al usuario que ya estaba dentro**. Desde entonces, cada login con quebradita.a
resolvía (por `provider + providerAccountId`) al usuario lopez.fafutis. Cerrar sesión no lo arregla:
el vínculo está guardado.

**Efecto secundario:** el `signIn` callback de `packages/auth/src/nextauth-config.ts` copia los
tokens de Google (Calendar/Gmail) **al usuario resuelto** — o sea, los tokens de una persona
terminan en el usuario de otra.

**Por qué es urgente:** en una computadora compartida del consultorio, si un auxiliar entra con su
Google mientras la sesión del doctor sigue abierta, su Google queda ligado **al usuario del
doctor** y desde ahí entra como el doctor — con expedientes, facturación y cobro. Silencioso y
permanente.

**Ya se arregló el DATO:** el vínculo `114492…` se movió al usuario quebradita.a con un script
corrido por el usuario (`filas movidas: 1`); verificado entrando en incógnito.

**✅ Y el CÓDIGO — `ab810f3d` (2026-09-18, en prod):** el `linkAccount` del adapter
(`packages/auth/src/nextauth-config.ts`) rechaza ligar una SEGUNDA identidad de Google a un usuario
que ya tiene una. Auth.js envuelve el error del adapter en `AdapterError`, así que llega como
`?error=Configuration`; el mensaje de ese error en los logins de doctor y admin ya dice «cierra la
sesión abierta». Auditoría de prod: sólo **dr-jose** tiene 2 identidades (ver abajo).

**⏳ FALTA PROBAR el camino nuevo:** la prueba del 2026-09-18 (sesión de Quebradita abierta + entrar
con el Google de lopez.fafutis) pasó, pero fue por el camino que Auth.js YA protegía (ese Google ya
estaba ligado a otro usuario ⇒ `OAuthAccountNotLinked` nativo). La regla nueva sólo se prueba con
**un Gmail que nunca haya entrado a la plataforma**: sesión abierta de A → entrar con ese Gmail ⇒
debe rechazar, sin fila nueva en `accounts` y con `[AUTH] se rechazó ligar una SEGUNDA identidad`
en el log del doctor. El usuario no tenía un Gmail así a la mano.

**⏳ dr-jose:** su usuario tiene 2 identidades de Google (la segunda ligada ~junio). Puede ser su
propio segundo Gmail (inofensivo) o uno ajeno. Sólo se resuelve preguntándole al doctor con qué
Gmails entra. El fix NO lo afecta: sus dos identidades siguen funcionando.

**Lo que se planeó para el código (hecho en `ab810f3d`, salvo lo marcado ⏳ arriba):**

1. **Nunca ligar una identidad OAuth a un usuario cuyo correo no coincide.** En el `signIn`
   callback: si el correo del perfil de Google ≠ el correo del usuario resuelto, **rechazar**
   (`return false` / a una página de error que diga «cierra la sesión actual antes de entrar con
   otra cuenta»). Verificar en los tipos/código instalado de Auth.js qué trae `user` vs `profile`
   en ese callback — no de memoria.
2. **Revisar `allowDangerousEmailAccountLinking: true`** (liga por correo igual). Es aceptable con
   Google como único proveedor, pero confirmar que no participa en este caso.
3. **Auditar la BD**: `SELECT user_id, count(*) FROM accounts WHERE provider='google' GROUP BY 1
   HAVING count(*) > 1` — cualquier usuario con más de una identidad de Google es el mismo defecto.
   El 2026-09-18 sólo se revisaron estas dos cuentas.
4. **Probarlo en vivo**: con la sesión de A abierta, entrar con el Google de B ⇒ debe rechazar, no
   entrar como A.

**Otro pendiente chico, mismo hallazgo:** `billing/*` responde 403 a un usuario con rol ADMIN
(`getAuthenticatedDoctorStripe` exige rol DOCTOR) y «Mi Cuenta» lo pinta como *«No pudimos leer el
estado de tu pago. Vuelve a cargar»* — un 403 definitivo presentado como falla pasajera.

## ✅ 2026-09-18 (cierre): #1–#4 y #5a de `04` §12.6 en prod y probados

Camino al pago · aviso del admin · subir de plan · comprar cualquier plan en el que quepas ·
**borrar un archivo del expediente libera espacio y lo borra del almacenamiento** — los cinco
**probados a mano**, dos con cobro real en modo prueba. Detalle, commits y lecciones en
[`04` §12.7](04-PLAN-cambio-de-plan.md). Sigue **#6 (dejar de pagar)**; antes, el URGENTE de arriba.

## 🗺️ HANDOFF — 2026-09-18 (noche): el mapa completo de permutaciones

👉 **[`04` §12](04-PLAN-cambio-de-plan.md)** — todas las permutaciones (GRATIS · BÁSICO · PRO ·
cortesías) contra el código, **verificado en código y contra prod (BD + Stripe)**, con las reglas
R1–R9 y el orden de construcción (§12.6). Lo esencial:

- **GRATIS nunca se congela**: al tope sólo bloquea agregar; todo aviso lleva a **Mi Cuenta → pagar**
  (no a un correo); **borrar libera espacio** (hoy no: deuda H5).
- **Sólo se baja de plan si cabe**, y con una baja agendada las subidas se topan al plan destino.
- **Cortesías → LAB** (el usuario lo hace en el admin): desbloquea C4.
- **Hoy es IMPOSIBLE subir BÁSICO→PRO y bajar PRO→BÁSICO** (checkout 409 + portal con cambio de
  plan apagado — verificado en la config de Stripe). **Deshacer una cancelación SÍ funciona** desde
  el portal: dr-prueba ya no está cancelada.
- **Stripe (prueba) configurado por el usuario**: 8 reintentos en 1 semana → cancela la suscripción
  → factura INCOBRABLE. Hay que repetirlo en modo vivo.
- 🔴 **B2a**: al fallar una renovación Stripe avanza `current_period_end` igual; el margen tiene que
  contar desde el último periodo PAGADO. Verificar con test clocks antes de construir.

## 🔄 HANDOFF — 2026-09-18 (tarde): qué pasa cuando dejan de pagar + una cuenta por doctor

Decidido con el usuario, **nada construido**:

- **[`04` §11](04-PLAN-cambio-de-plan.md)** — se acaba lo pagado → **15 días de margen** → si cabe
  en GRATIS (≤ 50 pacientes **y** ≤ 500 MB) pasa a GRATIS; si no, **CONGELADA**: entra y sólo ve
  **[Reactivar]** y **[Descargar mi información]** (zip con CSV + un HTML por paciente + listado de
  adjuntos SIN los archivos + XML de CFDI). **Datos 5 años, adjuntos 1 año**, con aviso al doctor
  antes de borrar. Reemplaza al paso 2 / D1. Sale de comparar con un competidor que bloquea todo y
  exige respaldarse ANTES de cancelar.
- **[`05-PLAN-una-cuenta-por-doctor.md`](05-PLAN-una-cuenta-por-doctor.md)** — proyecto nuevo:
  cédula única (validada con la SEP) + teléfono único verificado + identificación **sólo en
  disputa** (el copycat que registra la cédula de otro).
- **Confirmado por el usuario:** el margen se cuenta desde `current_period_end`, y el año de
  adjuntos desde que se congela.

## 🔄 HANDOFF — 2026-09-18: cambio de plan (mapa, decisiones y el paso 1)

👉 **Todo el detalle vive en [`04-PLAN-cambio-de-plan.md`](04-PLAN-cambio-de-plan.md). Empieza por su
bloque ⭐ ESTADO, que trae lo que está pusheado, lo que NO, y lo que nadie ha probado con un clic.**

Lo mínimo que hay que saber antes de tocar nada:

- ~~`1103200e` sin pushear~~ → **pusheado y desplegado el 2026-09-18** (api · doctor · admin en
  `c92ccbed`). Es el paso 1: que «Mi Cuenta» y el modal del admin digan la verdad mientras una
  cancelación está agendada.
- **Lo siguiente a construir es SUBIR de plan (BÁSICO→PRO)**, prorrateado. No depende de nada
  pendiente. La baja automática al final del periodo **quedó en duda a propósito**: el usuario
  propuso, en su lugar, **un margen de días y luego CONGELAR** la cuenta (entra y ve todo, no puede
  crear). Eso **disuelve** el hueco G1 en vez de pelearse con él, y la forma barata de construirlo
  es un **tier efectivo** (9 lugares leen el tier; 3 líneas en `auth.ts`) y no un flag nuevo que
  tendrían que respetar **186 rutas de escritura**. Pros, contras y lo que falta decidir: §10.
- **SÍ se congela lo clínico** (decisión del usuario, 2026-09-18): llevar el expediente es
  obligación **del médico, no nuestra**, y quien dejó de pagar puede escribir donde quiera. Lo que
  sí sigue en pie es **no destruir ni secuestrar sus datos**: queda PENDIENTE decidir la política de
  **retención y exportación** (el usuario va a preguntar qué hacen otras empresas; su idea es poder
  mandarles todo comprimido). Se cruza con G7.
- **dr-prueba: NO bajarlo antes del 17 de octubre** — pagó hasta esa fecha.
- **El trabajo BBVA del informe médico sigue en el árbol, sin commitear, y NO es shipeable**: el
  review le encontró dos HIGH midiendo el PDF (seis etiquetas de la rejilla de antecedentes
  apuntan a la caja equivocada; `undefined_3` es la de ALCOHOL). Nunca en un commit de cobro.

### Lo que esta sesión dejó como método

- **Un review corre sobre TODO lo no commiteado**, no sobre «tu» cambio: los 13 hallazgos del
  2026-09-18 mezclaban cobro y BBVA en una sola lista numerada. Sepáralos antes de «arreglar lo que
  encuentre».
- **El hallazgo más caro fue una FRASE**: «ese día tu cuenta pasa a GRATIS» prometía una baja
  automática que no existe. El código compilaba, los gates pasaban, y la pantalla le afirmaba al
  doctor un hecho falso sobre su cuenta. Escribir en la UI una función **decidida pero no
  construida** es exactamente así de fácil.
- **Una fecha sin `timeZone` la formatea el navegador**: son timestamps, y un fin de periodo a las
  03:00Z se pinta un día antes en México. El review NO lo vio; las dos pantallas fijan ahora
  `America/Mexico_City`.

## 🔄 HANDOFF — 2026-09-17: el cobro se probó en vivo, su review y los arreglos

El usuario **pagó de verdad** en modo prueba (dr-prueba: FREE → BÁSICO) y luego **canceló desde
Stripe**. La cancelación **no se detectó**: de ahí salió todo lo de abajo.

### 🔴 Lo que enseñó la cancelación real (medido en prod, no leído en la doc de Stripe)

En la API `2026-04-22.dahlia`, **una cancelación programada NO prende `cancel_at_period_end`**:
Stripe deja ese flag en `false`, el status en `active`, y expresa la baja en `cancel_at` +
`canceled_at`. Leer sólo el flag guardaba la baja como «no cancela» y «Mi Cuenta» le prometía al
doctor un «próximo cargo» el día exacto en que se le acababa el servicio.

Ya van **TRES** campos de dahlia que están donde la intuición dice que no (`current_period_end` en
el ITEM · la suscripción de una factura en `parent.subscription_details` · esto). Los tres son el
mismo error: **un campo que existe, responde sin lanzar, y miente**. Por eso nació `gate:cobro`.

### El review (`/code-review high`) — 9 hallazgos, 4 arreglados

| # | Qué | Estado |
|---|---|---|
| 1 | `incomplete` en `STATUS_VIVOS` encerraba ~23 h al doctor cuyo primer cargo falló, con un 409 que le afirmaba algo **falso** («ya tienes una suscripción activa») y sin salida | ✅ arreglado |
| 2 | `modoCobro()` fallaba hacia `'live'`: un espacio pegado en Railway apagaba la lista de doctores de prueba y **regalaba planes** con la 4242 | ✅ arreglado |
| 3 | El badge «Cancela» se quedaba para siempre con fecha pasada en una suscripción ya terminada — **la imagen en espejo** del bug que venía a arreglar | ✅ arreglado |
| 6 | Dos guardas de dinero descansan en el ORDEN de `DOCTOR_TIERS`, sin nada que lo sostenga | ✅ arreglado (comentario + gate) |
| 7 | `STATUS_VIVOS` duplicado a mano en la UI del doctor | ⬜ abierto (menor) |
| 9 | `planesVendibles` se calcula y se tira en cada carga de Mi Cuenta | ⬜ abierto (eficiencia) |
| 4 · 5 · 8 | **No son de TIERS**: son del trabajo BBVA del informe médico, que sigue sin commitear en el mismo árbol. El review mira TODO lo no commiteado y los juntó en una sola lista | ⬜ abiertos, en otra carpeta |

### 🧭 Lo que dejó esta sesión como método

- **`gate:cobro`** (`scripts/check-cobro-webhook-shapes.ts`, en `pnpm gates`): le pasa a
  `extraerDatos` payloads con la forma REAL que devolvió prod. Un type-check no ve estos bugs
  —los campos son válidos en el tipo— y no hay suite de unit tests en el monorepo.
- **Cada caso del gate se verificó ROMPIENDO su arreglo** y viendo el gate en rojo: un gate escrito
  junto a su propio arreglo no prueba nada mientras no se le vea fallar. Son 6 mutaciones, 6 rojos
  en el caso correcto. Para `incomplete` se pin en las DOS direcciones (no bloquear la venta, y
  seguir contando como viva para el webhook), porque la sobre-corrección también rompía algo.
- **Antes de cancelar en Stripe se le PREGUNTA a Stripe.** El arreglo de #1 cancela la suscripción
  a medio pagar, pero sólo después de confirmar contra Stripe que sigue en `incomplete`: si nos
  perdimos un webhook, nuestra fila puede decir `incomplete` mientras allá ya está `active`, y
  cancelar a ciegas sería dar de baja una suscripción **PAGADA**.
- **El arreglo de #1 no servía de nada sólo en el checkout:** con una fila `incomplete`,
  `/api/billing/status` devolvía `planes: []`, así que **no había botón que apretar** y el checkout
  arreglado era inalcanzable. Un arreglo en el servidor que la pantalla no deja alcanzar no es un
  arreglo.

### ⚠️ Lo que NO está probado

Nada de esto se ha probado con un clic. `gates` + `type-check` dicen que el código es coherente
consigo mismo, no que funcione. Falta el camino de #1 en vivo: tarjeta **`4000 0025 0000 3155`**
(fuerza la confirmación del banco), **abandonar** ese paso, y ver si vuelve el botón «Suscribirme»
con el aviso de que no hubo cargo. El usuario lo prueba en prod.

## 🔄 HANDOFF — cierre de sesión 2026-09-15 (COBRO: C1 · C2 · C3) — LEE ESTO PRIMERO

**Plan vivo:** [`03-PLAN-cuenta-y-cobro.md`](03-PLAN-cuenta-y-cobro.md). El as-built de cada PR, sus
hallazgos de review y el runbook para prender el cobro están en su **§7**; las decisiones que
bloquean, en su **§6**.

### Estado

| PR | Qué | Estado |
|---|---|---|
| **C1** | «Mi Cuenta» del doctor: plan, catálogo curado (`plan-catalog.ts` + `gate:catalogo`), medidores de pacientes y almacenamiento | ✅ EN PROD `b22f5f3a` (doctor SUCCESS) |
| **C2** | Tablas `tier_prices` · `subscriptions` · `tier_change_log` (SQL aplicado y verificado ANTES del código) · `setDoctorTier()` único camino de escritura del tier · `fijarPrecioDeTier()` · pantalla «Cobro» del admin | ✅ EN PROD `606f2e38` (api + admin SUCCESS) |
| **C3** | Checkout de Stripe, webhook de suscripciones (sólo `invoice.paid` sube el plan, nada lo baja), portal, sección «Pago de tu plan», avisos Telegram | ✅ **EN PROD `2edc58b6`** — api · doctor · admin **los tres SUCCESS** en ese hash (verificado 00:43 del 2026-09-15). **Inactivo** hasta el runbook: nadie ve el cobro |
| **C4** | Reconciliación Stripe ↔ `Doctor.tier` (reporta, no arregla) | ⬜ No empezado — bloqueado (abajo) |

**Hoy NADIE puede pagar**, y es correcto: el cobro no aparece hasta que existan la clave y el
secreto del webhook, y en modo prueba sólo para `STRIPE_BILLING_TEST_DOCTORS`. Verificado en prod
al cerrar: **dr-prueba `FREE`**, dr-quebradita `BASICO`, las otras 10 `PRO`; las 3 tablas de cobro
en **0 filas**.

### ⚠️ Acciones del USUARIO pendientes (no dejan rastro en git — pregúntale antes de darlas por hechas)

1. **Runbook de C3** (`03-PLAN` §7, C3): en Stripe **modo prueba** crear precios mensuales MXN de
   BÁSICO y PRO · Customer portal **con cambio de plan APAGADO** · webhook
   `…/api/stripe/subscription-webhook` con 5 eventos. En Railway `@healthcare/api`:
   `STRIPE_BILLING_SECRET_KEY` (sk_test) · `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` ·
   `STRIPE_BILLING_TEST_DOCTORS=dr-prueba` · `TELEGRAM_ADMIN_CHAT_ID`. Luego pegar los `price_…`
   en Cobro y suscribir a dr-prueba con `4242 4242 4242 4242`.
2. **Decidir cómo se marcan las 10 cuentas PRO que NO pagan** (puestas a mano): cortesía · periodo
   de gracia con fecha · excluidas del chequeo. **Bloquea C4**: sin eso la reconciliación las marca
   en rojo a las 10 cada vez, y un reporte siempre rojo se ignora.
3. **CFDI a los doctores** (decidido que SÍ se emite): hace falta el **CSD de la empresa** (.cer,
   .key, contraseña) + RFC, razón social, régimen y CP, y que el contador fije **clave de
   producto/servicio, unidad e IVA** de la suscripción.

### ⏭️ Qué sigue en código, en orden

1. Cuando el usuario haga el runbook de C3, **leer lo que pasó en BD**: una fila en
   `tier_change_log` con `origen='webhook'` y la suscripción en `active`. Una `subscriptions` vacía
   no dice nada por sí sola ("nadie pagó" o "el webhook no escribe") — contrasta con Stripe y con
   los logs de `[COBRO]` del api.
2. **PR del agente** («¿cuánto debo?», «¿qué plan tengo?»): decidido que va APARTE de C3. Declinar
   y enrutar a «Mi Cuenta» — nunca inventar un veredicto de dinero (regla 0). Se edita en
   `prompt.ts`, pasa `gate:prosa` y la suite de evals; se documenta en `../AGENTES/`.
3. **C4** en cuanto se decida el punto 2 de arriba: botón **«Reconciliar»** en Cobro, bajo demanda
   (cron después). Divergencias: Stripe cobró pero el plan no subió · fila `active` vs Stripe
   cancelada/vencida · suscripción viva en Stripe sin fila · **dos suscripciones vivas** · precio en
   uso fuera del mapa.
4. **CFDI (C3.5):** con la cuenta **Facturama Multiemisor que ya existe**
   (`apps/api/src/lib/facturama.ts`) registrando NUESTRO RFC como un emisor más. Individual a quien
   lo pida + **factura global mensual** a `XAXX010101000` para el resto (`GlobalInformation` ya está
   en el tipo). **Semi-automático** (el admin da clic), no disparado por el webhook.

### 🔴 Hallazgos abiertos FUERA de C1–C3 (medidos en esta sesión)

- **`FACTURAMA_API_URL` en PROD = `https://apisandbox.facturama.mx`.** Lo que se "timbra" en prod
  no es un CFDI real. Hoy sólo dr-prueba tiene perfil fiscal, así que probablemente nadie real está
  afectado — pero hay que corregirlo antes de que alguien dependa de facturar.
- **El trabajo BBVA del informe médico sigue SIN COMMITEAR** y dos code reviews le encontraron
  errores medidos contra el PDF: las 6 etiquetas del grid de antecedentes nombran la caja
  equivocada (Menarca/FUM son FECHAS), `undefined_3` es la caja de ALCOHOL y no la de pérdida de
  peso, `Text42` mal etiquetado, y faltan en `GRUPOS_VETADOS_BBVA` los radios de
  **antecedentes gineco-obstétricos** y **discapacidad (Sí/No + Parcial/Total)**. No es de TIERS y
  **nunca debe viajar en un commit de cobro**.

### 🧭 Trampas que esta sesión pagó (no las repitas)

- **API de Stripe `2026-04-22.dahlia`** (la del SDK 22): `current_period_end` está en el **item**,
  no en la suscripción; la factura trae la suscripción en `invoice.parent.subscription_details`, no
  en `invoice.subscription`. Verifícalo en los tipos instalados, no de memoria.
- **`{ prefix: 'stripe', key: 'pagos' }`** = pagos de PACIENTES: todo lo que cuelgue de `stripe/`
  lo hereda. Por eso el cobro vive en `billing/`.
- **Una clave de prueba en prod regala planes** si no hay lista de doctores permitidos.
- **Un pago sólo SUBE el plan.** `setDoctorTier` no distingue subir de bajar: la comparación de
  rango vive en el webhook (hallazgo #1 del review de C3).
- **`cmd | tail` en segundo plano:** la notificación trae el exit code de `tail`. Redirige a un log
  y léelo. Un script que escribe en prod y retiene su salida exige una lectura de BD aparte.
- **`packages/**` no está en ningún watchPattern**: un commit sólo de paquete no despliega nada.
- **Los handoff docs de esta sesión (este README y `03-PLAN` §7) quedaron SIN COMMITEAR** al
  cerrar: pide OK y commitéalos solos (docs no disparan deploy).

## Los dos tiers (v1)

| Tier | Incluye |
|---|---|
| **FULL** (tope) | TODO. |
| **CORE** (base) | TODO **excepto**: Facturación · Descarga SAT · Conciliación Bancaria · Ventas · Compras · Productos y Servicios. Conserva **Flujo de Dinero** (ingresos/egresos manuales, precio automático desde agenda) — solo se pierden los cruces con las funciones excluidas. |

Más tiers en el futuro (por eso el tier se guarda como `String`, no como enum de Postgres — §3.1).

## La idea en una frase

Las 6 funciones que CORE excluye **ya son `PermissionKey`** en `packages/database/src/permissions.ts`
(`facturacion`, `sat`, `conciliacion`, `ventas`, `compras`, `productos`). Así que un tier se modela
como un **techo a nivel de CUENTA sobre el MISMO vocabulario de permisos**, y
`acceso efectivo = techo del tier ∩ (owner ? todo : toggles del member)`. Eso reutiliza el route
map, el page map, el sidebar y los módulos del agente que ya existen — no se construye un sistema
paralelo.

## Decisiones tomadas (usuario, 2026-07-24)

- **UX:** las funciones bloqueadas por tier se **muestran con candado + CTA de upgrade** (no se
  ocultan). El "Upgrade" lleva a una página de contacto/ventas (no hay billing self-serve todavía).
  (Contrasta con el gating de MEMBER, que sí oculta — §6.)
- **G2 (agente):** gating a **nivel de TOOL** — CORE conserva el módulo `flujo` del agente sin la
  tool `get_conciliacion_bancaria`, en vez de perder el módulo entero (§5.2).
- **Administración:** el tier se fija desde el **admin app** (no self-serve). §7.
- **CORE SÍ incluye el asistente de IA** (usuario, 2026-07-25). Se preguntó explícitamente si
  convenía excluirlo —sería el corte MÁS BARATO: elimina de un plumazo toda la coherencia de
  prosa que T3 tuvo que construir (§11.5)— y la respuesta fue **no: el asistente va en el plan
  base**. Consecuencia asumida: **el límite del tier atraviesa POR DENTRO del asistente**, que es
  el único subsistema que *habla de sí mismo*; cada módulo, toggle o tier nuevo tiene que revisar
  su prosa contra los scopes alcanzables. Ese costo recurrente es justo lo que `gate:prosa`
  automatiza. Regla general que deja la experiencia: *el corte de tier barato excluye subsistemas
  completos; el caro carva dentro de uno que se describe a sí mismo.*

## 💳 2026-09-14 — el dinero: [`03-PLAN-cuenta-y-cobro.md`](03-PLAN-cuenta-y-cobro.md)

**Estado:** **C1 EN PROD** (`b22f5f3a`) — la pantalla «Mi Cuenta» del doctor: su plan, el catálogo
curado de funciones y **los dos medidores de cupo** (el de almacenamiento era el hueco #1 del
handoff de Q4). **C2 EN PROD** (`606f2e38`) — `TierPrice` · `Subscription` · `TierChangeLog`,
`setDoctorTier()` como único camino de escritura del tier, y la pantalla «Cobro» del admin.
**C3 construido** — checkout de Stripe, webhook de suscripciones y **el plan que sube solo al
confirmarse el pago**; en **modo prueba** y visible sólo para los doctores de
`STRIPE_BILLING_TEST_DOCTORS`. **No cobra hasta que el usuario haga el runbook de §7/C3** (precios,
portal y webhook en Stripe + 4 variables en Railway). El agente ("¿cuánto debo?") va en una PR
aparte, y el CFDI al doctor va después (§6.1 — se decidió que SÍ se emite; se hará con la cuenta de Facturama
Multiemisor que ya existe, registrando nuestro propio RFC como un emisor más).

Los planes anteriores construyeron el **techo** (qué puede hacer una cuenta). El plan 03 construye
las dos caras del **dinero** que ese techo nunca tuvo: la página **Cuenta** del doctor (qué plan
tengo, cuánto he consumido, cuánto debo, dónde pago) y la pantalla de **control de la empresa** en
el admin (a quién le cobramos, con qué precio, en qué estado va cada suscripción). Decisiones del
usuario: **Stripe Billing**, **el pago confirmado sube el tier solo**, **nada lo baja solo**, y
**ningún precio se escribe en el código** (la lista comercial sigue sin decidirse).

⚠️ Dos correcciones a lo que dice esta carpeta, medidas el 2026-09-14: **`/producto` ya no
existe** (el hallazgo 7 de `02-PLAN` §8 y su §9.8 lo dan por vivo) — la home vende **un solo plan
a $550 + IVA** desde el 2026-08-17, y el precio se pinta **también en la imagen Open Graph**. Y
**derivar la lista de funciones de `TIER_EXCLUDED_KEYS` no sirve** para una pantalla que ve el
doctor: hay tres sistemas de visibilidad distintos y la lista derivada afirma cuatro cosas falsas
(plan 03 §2/H1).

## 🔴 HANDOFF 2026-09-12 — el producto pasa a CUATRO tiers (Q1 construido)

**Lee primero [`02-PLAN-cuatro-tiers.md`](02-PLAN-cuatro-tiers.md).** FREE · BÁSICO (149) · PRO
(299, con los flujos de IA de hoy + WhatsApp a pacientes cuando Meta apruebe) · LAB (el asistente
🟢 y la línea "Jarvis"). El diseño v1 de abajo (FULL/CORE) **se reusa entero**; el plan solo
cambia el vocabulario y agrega dos cosas que v1 no tenía: la key `ia` para los flujos de IA
sueltos (hoy son OWNER_ONLY y **ningún tier puede apagarlos**) y **cupos** de almacenamiento y
pacientes.

**Q1 (vocabulario) está construido** — as-built y dos correcciones al plan en su §8; estado del
push/SQL en su §8.1. ⚠️ **Todo lo de abajo que diga `FULL`/`CORE` es historia de v1**: en código
ya no existen. Equivalencias: `FULL` → `PRO` (las 12 cuentas de prod) / `LAB` (el tope);
`CORE` → `FREE` (misma forma para el agente). **En Q1 solo FREE recorta algo**: BASICO existe pero
su exclusión de `conciliacion` está diferida hasta que tenga evals (§8 hallazgo 1); PRO y LAB no
excluyen nada. El fail-open ya no es "todo" sino `FALLBACK_TIER = PRO`. Quedan por decidir §9.2,
5, 6, 7 y el nuevo 8 (el alta nace en FREE sin aviso).

## 🔴 HANDOFF — lee esto primero (cierre de sesión 2026-07-27)

**TIERS está COMPLETO salvo T6.** T1–T5 shipped, desplegados y **probados en vivo**. Lo que
bloqueaba poner a un cliente REAL en CORE (que el doctor viera POR QUÉ algo está bloqueado) quedó
cubierto hoy con T4. El gating sigue siendo **NO-OP**: los 11 doctores son FULL.

### Qué pasó hoy (2026-07-27)

| | |
|---|---|
| **Runbooks A y B** (prueba en vivo de T5) | ✅ Ejecutados. UI, write path y rutas OK; agente **3/4**. As-run en [`01-DISENO`](01-DISENO-tecnico.md) §12.6 |
| **Bitácora #28** — el agente FABRICABA conciliación | ✅ Fix de payload shipped (`762070bb`). Narración SAT **0 de 6 corridas**. ⚠️ Residuo ~50%, ver abajo |
| **T4** — candados + pantalla de plan | ✅ Shipped, desplegado y **probado en vivo** (`b5b54b65`), desktop **y móvil**. §13 |

### ⚠️ Acciones de USUARIO pendientes — NO dejan rastro en git, pregúntale antes de darlas por hechas

| # | Qué | Consecuencia si no se hace |
|---|---|---|
| 1 | **`NEXT_PUBLIC_SALES_EMAIL=hola@tusalud.pro`** en Railway (`@healthcare/doctor`) + **REDEPLOY** (es `NEXT_PUBLIC_*` ⇒ se inyecta en el BUILD; guardarla no basta) | La pantalla de plan explica el límite pero **no ofrece botón de contacto**. Confirmado NO hecho al cierre |
| 2 | **Rotar credenciales de MercadoPago de dr-prueba** (estuvieron públicas; el fix ya está desplegado, rotar ahora es seguro) | Tokens viejos siguen válidos |
| 3 | **Re-subir las firmas de 3 doctores reales** — o decidir aceptar el riesgo | Las URLs viejas siguen resolviendo |

### ⏭️ Lo que sigue en código: **T6**, y ya no es abstracto

Dos partes, ambas con evidencia real detrás:

1. **El residuo de conducta de #28 (~50%, 3 de 6 corridas).** Tras el fix de payload el agente ya NO
   inventa cifras de conciliación, pero la mitad de las veces **sustituye** (contesta con un volcado
   de flujo bajo el título de lo preguntado) o cierra con un **redirect a la sección Conciliación**,
   que en CORE es una puerta cerrada. Ficha canónica: `../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`
   bitácora **#28**. ⚠️ **No hay fix limpio por prompt** — no se puede probar que un LLM nunca diga
   una frase; el eval `tier-core-conciliacion-no-inventa` queda como tripwire `soft`. La opción
   determinista (filtro post-generación que borre referencias a secciones excluidas) existe pero es
   un patrón NUEVO para este repo: decidirlo, no improvisarlo.
2. **La auditoría de fuga read-only** (reportes/analytics con cifras de CFDI/SAT) — lo que T6 siempre
   fue. La política de `porOrigen` **ya se decidió y se implementó** hoy; T6 hereda el resto.

### 🧭 Si eres una sesión nueva

1. Lee `01-DISENO-tecnico.md` §1–§2 (la decisión de arquitectura) y luego §13 (T4, lo último).
2. Para cualquier cosa del AGENTE, la ficha viva es la bitácora **#28** en
   `../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md` — y su lección generaliza: recortar tools necesita
   recortar **prosa Y payload Y filtros**; `gate:prosa` cubre los dos primeros, el payload **no tiene
   garantía de máquina**.
3. **Ojo con la suite de evals:** la última corrida completa dio **74/81 al 1er intento**; tras
   reintentos quedaron 5 flaky, 1 WARN estable (el caso nuevo de #28, esperado) y **1 FAIL estable
   AJENO**: `f2b-receptor-incompleto`, que es **drift de fixture** (el paciente Prueba1 ya no tiene
   citas), no un bug del agente. No lo persigas creyendo que es regresión.
4. **Al probar cualquier cosa de tiers: verifica en la BD que la cuenta esté REALMENTE en CORE.** Con
   los 11 doctores en FULL todo el feature es invisible por construcción, y "se ve bien" en una
   cuenta FULL no prueba absolutamente nada.

### ▶️ Runbook A — la UI de T5 (5 min, sin tocar datos)

1. Entrar al admin → **`/doctors`**. Debe aparecer una columna **"Plan"** entre Ciudad y Paleta.
2. **Esperado:** los 11 doctores con un chip azul **`FULL`**. Interpretación de los otros estados:
   - chip gris **`—`** ⇒ el admin NO recibió los tiers: el API no desplegó, o `GET
     /api/admin/doctor-tier` está fallando. NO es dato corrupto.
   - chip rojo **`⚠ <valor>`** ⇒ hay un valor NO canónico guardado (p.ej. `core` en minúsculas).
     Es la alarma real: `tierAllows` es fail-open, así que esa cuenta se comporta como FULL aunque
     la UI diga otra cosa. Se corrige guardando desde el mismo modal.
3. Clic en el chip → modal con FULL/CORE, la lista de lo que CORE excluye (derivada del registry),
   y dos avisos (downgrade = gating no borrado; y que sin T4 el doctor verá las secciones igual).
   **Cancelar** cierra sin escribir. "Guardar" queda deshabilitado si eliges el plan actual.

### ▶️ Runbook B — downgrade en vivo (dr-prueba, revertir al final)

> Formato idéntico al test en vivo de T2. **Solo dr-prueba**; ningún doctor real.

1. En `/doctors`, poner **dr-prueba en CORE** desde el modal. El chip debe volverse ámbar `🔒 CORE`.
2. **Rutas** (token real desde el doctor-app: `GET /api/auth/get-token` estando logueado como
   dr-prueba; ver `01-DISENO` de NUEVOS USUARIOS §9 para el método):
   - `GET /api/facturacion/profile` → **403 `TIER_EXCLUDED`**
   - `GET /api/sat-descarga/metadata` → **403 `TIER_EXCLUDED`**
   - `GET /api/practice-management/ledger` → **200** (CORE conserva flujo)
3. **Agente** (panel del doctor, cuenta dr-prueba):
   - "¿cuánto llevo este mes?" → responde con flujo (`get_balance`/`get_movimientos`).
   - "hazme una factura" → **declina por PLAN** (no por permisos del dueño, y sin mandarlo a otra
     sección). El módulo `facturas`/`fiscal` no existe en CORE.
   - "¿cómo va mi conciliación bancaria?" → declina; `get_conciliacion_bancaria` se cae en CORE
     aunque el módulo `flujo` siga vivo.
   - "¿tengo links de pago pendientes?" → **SÍ funciona** (CORE paga `pagos`; T3 rescata esas dos
     tools del módulo caído).
4. **REVERTIR a FULL** desde el mismo modal y confirmar que 2 y 3 vuelven a la conducta normal.
5. Anotar el resultado en `01-DISENO` §12.6. *(Ejecutado el 2026-07-27 — el as-run ya está ahí.)*

### ▶️ Runbook C — re-verificar el fix de seguridad (30 s, sin token)

```bash
U=https://healthcareapi-production-fb70.up.railway.app
for k in mpAccessToken mpRefreshToken stripeAccountId googleCalendarId telegramChatId \
         prescriptionSignatureUrl tier; do
  echo "$k: $(curl -s $U/api/doctors | grep -o "\"$k\":" | wc -l)"   # TODOS deben dar 0
done
curl -s $U/api/doctors | grep -o '"slug":' | wc -l                    # debe dar 11
curl -s -o /dev/null -w "%{http_code}\n" https://tusalud.pro/doctores/dra-adriana-michelle  # 200
```

Ya se corrió al desplegar y dio 0/0/0…, 11 y 200. `pnpm gate:payload` lo protege de aquí en
adelante. Regla general: `docs/NEW.MD-GUIDES/PUBLIC-API-PAYLOADS.md`.

## Estado (2026-07-25 · actualizado 2026-07-26)

🟢 **T1 + T2 SHIPPED a prod y probados en vivo** (`c639a0ca`, `8e7097e1`). El gating YA enforcea
en los 3 sitios (2 choke points owner+member + public/cron), pero es **NO-OP: los 11 doctores son
FULL** y `tierAllows(FULL,*)=true`, así que nadie está gateado todavía. Test en vivo pasó
(dr-prueba→CORE: facturación+SAT dieron 403 `TIER_EXCLUDED`, flujo 200; revertido→FULL).

🟢 **T3 — agente tier-aware — SHIPPED Y DESPLEGADO 2026-07-25** (`b26898f5`; gate en `cddecc19`
+`a47bc4c9`; docs en `dd8964d8`). El agente compone módulos **y tools** por plan: CORE conserva
`flujo` sin `get_conciliacion_bancaria`, dropea `fiscal`, y **rescata las tools de `pagos`** del
módulo `facturas` que se cae (corrección al diseño — CORE paga `pagos`). Prefijo CORE **−21%**
(26 tools vs 39). Prompt del owner FULL **byte-idéntico** (sha256 `4a66a438…`) ⇒ **cero
invalidación de cache**, y **NO-OP** mientras los 11 doctores sean FULL. Suite **80 casos**;
`pnpm gates` ahora corre **CUATRO** (nuevo `gate:prosa`). As-built completo, las 4 correcciones al
diseño, el bug hunt y el gate: [`01-DISENO`](01-DISENO-tecnico.md) §11.

🟢 **T5 — selector de tier en el admin — SHIPPED 2026-07-26** (`b5414a19`). Columna "Plan" + modal
en `/doctors` y una ruta **admin-only** para escribirlo (NO el wizard de edición: su PUT lo puede
llamar el propio doctor, ver [`01-DISENO`](01-DISENO-tecnico.md) §12.1). Ya **no hace falta SQL a
mano** para mover a alguien a CORE. Revisando por qué `tier` salía en el payload público se destapó
un hallazgo de seguridad ajeno a tiers — credenciales en `GET /api/doctors` — corregido en
`faa7e829` con el gate `pnpm gate:payload`; ficha en §12.3.

### ⏭️ Qué sigue

> 🧭 **Si eres una sesión nueva: empieza aquí.** T1→T3 y T5 están EN PROD y el gating sigue siendo
> **NO-OP** (los 11 doctores son FULL). Ya se puede fijar el tier desde el admin; lo que falta para
> poner a un cliente REAL en CORE es que el doctor **vea por qué** algo está bloqueado (T4).

**T4 SHIPPED y probado en vivo el 2026-07-27** (§13). Con eso, lo que bloqueaba poner a un cliente REAL en CORE queda cubierto; falta solo la variable del CTA. **La prueba en vivo de T5 se ejecutó el 2026-07-27** (`01-DISENO` §12.6): A y B completos, con la
UI, el write path y las rutas OK, y **un fallo reproducible del agente** en conciliación que NO
bloquea T4 (bitácora #28 → decisión en T6). **El siguiente paso concreto es ahora T4.**

✅ **El TRIPWIRE del agente quedó CUMPLIDO el 2026-07-25** (los 3 ítems: `gate:prosa`, el eval
`tier-core-completar-cita`, y `prosaDependsOn` extendido al eje de member). Detalle en
[`01-DISENO`](01-DISENO-tecnico.md) §11.5.1–§11.5.2. **Ya nada del agente bloquea un downgrade.**

**En orden:**

1. ✅ **T5 — selector de tier en el admin — SHIPPED** (`b5414a19`). El requisito duro del write se
   cumplió: valida contra `DOCTOR_TIERS` con case canónico y **rechaza** lo demás en vez de
   normalizarlo (§12.2).
2. ✅ **Prueba controlada en dr-prueba — EJECUTADA 2026-07-27** (`01-DISENO` §12.6). Downgrade
   desde el modal → 403 `TIER_EXCLUDED` en facturación y SAT, 200 en ledger → revertido a FULL
   (las 3 rutas vuelven a 200 **con el mismo token**: el JWT no lleva claim de `tier`, así que la
   lectura fresca de §5.4/G4 queda probada por estructura, no por observación). Agente **3/4**;
   el 4º —conciliación— falla reproducible (4 corridas): bitácora **#28**. **Fix de payload aplicado
   el mismo día** (narración SAT: 0 de 6 corridas); queda VIVO el residuo de sustitución/redirect (~50%, 3 de 6).
3. ✅ **T4 — show-locked UI — SHIPPED Y PROBADO EN VIVO 2026-07-27** (`01-DISENO` §13). Sidebar con candado (link,
   no item muerto: si no, el CTA solo se alcanza escribiendo la URL), pantalla de upsell derivada de
   `PERMISSION_LABELS`, y el chequeo de tier ANTES del bypass de owner (el techo acota al dueño).
   **Único pendiente: `NEXT_PUBLIC_SALES_EMAIL=hola@tusalud.pro` en Railway (redeploy después, es build-time).**
4. **T6 — degradación de cruces de flujo + auditoría de fuga read-only.** Que decida de una sola
   vez la política de `porOrigen` (sat_emitido/sat_recibido) Y la de reportes/analytics, en vez de
   caso por caso. Ver §11.6.
   > 🟡 **La parte de `porOrigen` YA se decidió y se implementó el 2026-07-27** (bitácora #28); lo que
   > T6 hereda es reportes/analytics + el residuo de conducta. La
   > prueba en vivo del 2026-07-27 midió 4/4 corridas en las que el modelo usa esos buckets para
   > inventar conciliación o narrar historia de la cuenta (bitácora **#28**). Y ojo con el alcance
   > al retomarlo: **`gate:prosa` no cubre esta clase** — mira prosa y descripciones, no payloads,
   > así que aquí no hay red de seguridad automática. Es el ítem de T6 con evidencia, no el de
   > política abstracta.

**Deuda anotada a propósito (no bloquea, decisión de 2026-07-25 de documentar y no arreglar):**
la fuga de `pagos` por el camino del agente —VIVA en prod con el member real— en
[`../NUEVOS USUARIOS/SESSION-REFRESCO.md`](../NUEVOS%20USUARIOS/SESSION-REFRESCO.md)
§"HUECO ABIERTO"; y las cards duplicadas (límite **L6**) en
`../AGENTES/AGENTE AGENDA/05-REFERENCIA-TECNICA-AGENTE.md` §11.

**Idea de fondo para cuando esto crezca** (no ahora): las cross-references de la prosa siguen
siendo texto escrito a mano; **generarlas desde el registry** —que solo puedan nombrar tools
presentes en el scope— mataría la clase entera por construcción en AMBOS ejes, sin duplicar nada.
Se evaluó separar suites de agente por tier y se DESCARTÓ: arregla el eje de tier (2 valores) y
deja intacto el de member (33 formas), que es justo donde vivió el peor bug de la sesión.

**Lo que YA existe y hay que reusar (no reinventar):** `tierAllows`, `tierRouteDecision`
(nearest-feature-key), `tiersExcluding`, `doctorTierAllows` en `@healthcare/database` ·
`Doctor.tier` (String, default FULL) · `resolveAgentScope` + `TOOL_FEATURE_KEY` +
`prompt.partial`/`prosaDependsOn` en el registry del agente · los gates
`check-route-permission-coverage.ts` y `check-agent-prose-references.ts`.

## Relación con otras carpetas

- **`../NUEVOS USUARIOS/`** — el sistema de permisos por-member que este feature reutiliza. El
  `01-DISENO-tecnico.md` de allá describe la "cintura estrecha" (`membership.ts`, los dos choke
  points) sobre la que se apila el tier.
- **`../AGENTES/`** — el agente compone su prompt/tools por módulos; el tier recorta módulos y
  tools (§5.2), lo que además BAJA el costo del agente en CORE (menos prefijo).
