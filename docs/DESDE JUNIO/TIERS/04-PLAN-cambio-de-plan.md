# 04 — PLAN: cambio de plan (subir, bajar y cancelar)

> **Estado: PLAN. Nada de esto está construido.** Lo que SÍ está en prod es C1·C2·C3
> (`03-PLAN-cuenta-y-cobro.md`): contratar desde GRATIS y que el pago suba el plan.
>
> Este doc mapea **las 8 transiciones posibles** entre los tres planes que se venden, dice cuál
> funciona hoy y cuál no, y recoge las **3 decisiones de producto** (§6), ya tomadas el 2026-09-18.

---

## ⭐ ESTADO AL CERRAR EL 2026-09-18 — LEE ESTO PRIMERO

### 🔴 Hay un commit SIN PUSHEAR

| Commit | Qué | Estado |
|---|---|---|
| `e27e42d3` | Arreglos del review de C3 + `gate:cobro` | ✅ pusheado y **desplegado** (api · doctor · admin, los tres SUCCESS) |
| `c2db197c` | Este doc (§0–§9) | ✅ pusheado |
| **`1103200e`** | **Paso 1: las pantallas dicen la verdad** | ⚠️ **COMMITEADO EN LOCAL, SIN PUSH.** El usuario pidió expresamente commitear sin pushear. **Pregúntale antes de pushear** |

### Lo que NO se ha probado con un clic

`type-check` + los 6 gates + una simulación contra la BD de prod dicen que el código es coherente.
**Nadie ha MIRADO ninguna de las dos pantallas.** Falta:

- **Las dos pantallas del paso 1.** dr-prueba está en el estado perfecto para verlas (cancelada,
  pagada hasta el 17/10): «Mi Cuenta» debe decir la frase nueva, y el modal del admin debe sacar el
  aviso rojo al intentar bajarlo. **Esto no está desplegado** (falta el push).
- **El camino `incomplete`** que se arregló en `e27e42d3` (eso sí está en prod): tarjeta
  **`4000 0025 0000 3155`**, empezar el pago y **abandonar** la confirmación del banco. Debe volver
  el botón «Suscribirme» con el aviso de que no hubo cargo.

### ⚠️ dr-prueba: NO LO BAJES ANTES DEL 17 DE OCTUBRE

Está en **BÁSICO**, cancelada, **pagada hasta el 2026-10-17**. Se restauró a mano el 2026-09-18
(ver §8). Si el 17 de octubre sigue en BÁSICO, **eso NO es un bug: es que D1/§10 no se construyó.**

### 🔴 En el árbol hay trabajo AJENO que no se debe commitear aquí

El **BBVA del informe médico** (sin commitear desde el 2026-08-21). El review del 2026-09-18 le
encontró **dos hallazgos HIGH verificados midiendo los rectángulos del PDF**: seis etiquetas de la
rejilla de antecedentes apuntan a la caja EQUIVOCADA (la de junto a *FUM* dice «gineco col. 1»), y
`undefined_3` es la caja de **ALCOHOL** rotulada como «pérdida intencional de peso». Más dos grupos
con el defecto de «dos preguntas fundidas» sin vetar (`discapacidad`, `Antecedentes
Ginecoobstétricos`). **No es shipeable**: pondría rótulos falsos en un documento médico-legal.
Necesita su propia sesión, con el PDF enfrente. **Nunca en un commit de cobro.**

### Lo siguiente a construir

**El paso 3 (SUBIR de plan, BÁSICO→PRO).** Ver §7. El paso 2 está en duda — §10.

---

## 0. Lo que pasó el 2026-09-17 y por qué existe este doc

El usuario contrató BÁSICO de verdad (modo prueba) y canceló desde Stripe. Medido en la BD de prod
al día siguiente:

| Qué | Valor |
|---|---|
| `subscriptions.status` | `active` |
| `cancel_at_period_end` | `true` |
| `current_period_end` | **2026-10-17** |
| `last_payment_at` | 2026-09-17 22:50 |
| `doctors.tier` de dr-prueba | **`FREE`** |

La última línea es el problema entero. `tier_change_log` dice quién la puso:

```
2026-09-18T00:14:09Z | dr-prueba | BASICO -> FREE | admin | lopez.fafutis@gmail.com
```

**No fue el sistema: fue una persona, a mano, en el admin.** Y lo hizo el mismo día, así que la
cuenta perdió el mes que ya había pagado.

Hoy es la ÚNICA forma de que una cancelación se refleje, porque el webhook de C3 respeta la regla
«el plan no baja solo»: cuando Stripe avisa `customer.subscription.deleted`, sólo manda un aviso a
Telegram pidiendo que alguien lo baje. Esa regla se puso a propósito (para no bajarle el plan a
nadie por un webhook raro), pero deja dos agujeros:

1. **Alguien tiene que acordarse**, el día exacto, un mes después. Si se le olvida, el doctor
   conserva un plan que ya no paga.
2. **Si se acuerda demasiado pronto —como pasó— le quita lo que ya pagó.** No hay nada en la
   pantalla del admin que diga «espérate al 17 de octubre».

---

## 1. La regla que manda sobre todo

> **No hay reembolsos. Lo que se pagó, se disfruta completo.**
>
> Un pago da acceso **hasta el final del periodo pagado**, pase lo que pase después. Cancelar no
> devuelve dinero ni quita el acceso: lo **programa** para el final del periodo.

De aquí salen dos reglas técnicas:

- **El dinero SUBE el plan de inmediato** (ya es así en C3: sólo `invoice.paid` sube).
- **El plan BAJA sólo cuando se acaba el periodo pagado**, nunca en el momento en que se pide.

Y una consecuencia que hay que enseñar en pantalla: **entre «pedí el cambio» y «el cambio ocurre»
pasan hasta 30 días**, y en ese hueco el doctor tiene que ver la verdad, no su plan a secas.

---

## 2. Cómo lo hacen los demás (y qué copiamos)

Lo que Stripe recomienda y lo que hace el SaaS en general:

| Movimiento | Convención de la industria | ¿La adoptamos? |
|---|---|---|
| **Subir** (BÁSICO→PRO) | **Inmediato y prorrateado**: se cobra sólo la diferencia de lo que queda del mes y el plan sube en ese instante | ✅ Sí |
| **Bajar** (PRO→BÁSICO) | **Al siguiente ciclo.** El cambio se agenda; el doctor conserva lo que pagó y el precio nuevo aplica en la renovación | ✅ Sí |
| **Cancelar** | Igual que bajar: `cancel_at_period_end`, acceso hasta el final | ✅ Sí — ya es lo que hace Stripe |
| Prorratear una BAJA con nota de crédito | Existe, y genera saldo a favor | ❌ **No.** «No hay reembolsos» es más simple de explicar y de sostener |

Un detalle de Stripe que sí conviene copiar: para un cambio que genera factura inmediata (la
subida), usar **`pending_updates`** — el cambio se aplica **sólo si esa factura se paga**. Es la
misma idea de la regla 0: el veredicto lo da el dinero, no la intención.

---

## 3. El mapa completo — las 8 transiciones

Tres planes que se venden (GRATIS · BÁSICO · PRO; LAB es por invitación y no se vende).

### Desde GRATIS (sin suscripción)

| # | Transición | Cuándo se cobra | Cuándo se mueve el tier | Hoy |
|---|---|---|---|---|
| 1 | GRATIS → BÁSICO | Ahora, mes completo | Al confirmarse el pago (`invoice.paid`) | ✅ **Funciona** |
| 2 | GRATIS → PRO | Ahora, mes completo | Al confirmarse el pago | ✅ **Funciona** |

### Desde BÁSICO (suscrito y pagando)

| # | Transición | Cuándo se cobra | Cuándo se mueve el tier | Hoy |
|---|---|---|---|---|
| 3 | BÁSICO → **PRO** (subir) | Ahora, **sólo la diferencia** de lo que queda del mes | Al pagarse esa factura | ❌ **No existe** |
| 4 | BÁSICO → **GRATIS** (cancelar) | Nunca más | **El 17 del mes siguiente**, al acabarse lo pagado | ⚠️ Sólo a mano |

### Desde PRO (suscrito y pagando)

| # | Transición | Cuándo se cobra | Cuándo se mueve el tier | Hoy |
|---|---|---|---|---|
| 5 | PRO → **BÁSICO** (bajar) | En la renovación, ya al precio de BÁSICO | **El 17 del mes siguiente** | ❌ **No existe** |
| 6 | PRO → **GRATIS** (cancelar) | Nunca más | **El 17 del mes siguiente** | ⚠️ Sólo a mano |

### Las dos que no son transiciones pero hay que resolver

| # | Caso | Qué debe pasar | Hoy |
|---|---|---|---|
| 7 | **Arrepentirse** antes de que se cumpla la fecha (canceló el 17, se arrepiente el 25) | Botón **«Reanudar»**: se quita la cancelación agendada y todo sigue igual. No se cobra nada nuevo | ❌ No existe |
| 8 | **Volver a contratar** después de que ya bajó | Es el caso 1 otra vez: checkout normal | ✅ Funciona |

---

## 4. Lo que el doctor tiene que VER (el hueco de hasta 30 días)

Hoy «Mi Cuenta» dice el plan y ya. Con cambios agendados, decir sólo «BÁSICO» o sólo «GRATIS» es
**afirmar algo falso**. Los textos, por caso:

| Situación | Lo que debe decir |
|---|---|
| Canceló, sigue dentro de lo pagado | **«Tu plan BÁSICO sigue activo hasta el 17 de octubre. Ese día tu cuenta pasa a GRATIS. No hay reembolsos por el tiempo restante.»** + botón **Reanudar** |
| Bajó de PRO a BÁSICO, agendado | **«Tienes PRO hasta el 17 de octubre. Ese día pasas a BÁSICO ($X/mes).»** + botón **Cancelar el cambio** |
| Subió de BÁSICO a PRO | **«Ya tienes PRO. Se te cobró $X por lo que resta del mes; el 17 de octubre se renueva en $Y.»** |
| Ya bajó (llegó la fecha) | El plan nuevo, a secas |

Lo mismo en el admin: la tabla de Cobro debe distinguir **«PRO»** de **«PRO hasta el 17/10, luego
BÁSICO»**, o quien la mire va a volver a bajar un plan antes de tiempo — que es exactamente lo que
pasó el 2026-09-17.

---

## 5. Los topes: qué pasa si no cabes en el plan al que quieres bajar

Topes vigentes (`TIER_LIMITS`):

| Plan | Almacenamiento | Pacientes activos |
|---|---|---|
| GRATIS | 500 MB | 50 |
| BÁSICO | 15 GB | sin tope |
| PRO | 50 GB | sin tope |

**Pacientes: ya está guardado.** `setDoctorTier()` rechaza cualquier movimiento —venga del admin o
del webhook— que deje la cuenta por encima del tope, con un mensaje que dice cuántos expedientes
archivar. Archivar no borra nada.

**Almacenamiento: NO se revisa al cambiar de plan.** Una cuenta PRO con 30 GB puede bajar a BÁSICO
(15 GB) y nada lo impide. No es catastrófico —no se borra nada, y el tope de almacenamiento sólo
muerde al **subir un archivo nuevo**— pero el doctor se entera chocando contra la pared, sin aviso
en el momento en que decidió bajar.

Hace falta, en este orden:

1. **Un chequeo ANTES de aceptar la baja** (pacientes *y* almacenamiento), con el número real:
   «Usas 22 GB y BÁSICO permite 15 GB. Libera 7 GB o quédate en PRO.»
2. **La guarda de almacenamiento DENTRO de `setDoctorTier`**, junto a la de pacientes, para que
   ningún camino se la salte — la pantalla no puede ser la frontera.
3. Dato útil para esa pantalla, medido en prod el 2026-09-13: **el video es lo que llena la
   cuenta**, no lo clínico (6 videos = 380 MB = 72% de todo el bucket). La pantalla de «libera
   espacio» debe empezar por los videos.

---

## 6. ✅ Las tres decisiones — TOMADAS el 2026-09-18

> El usuario adoptó las tres recomendaciones. Se dejan abajo con su porqué, porque el porqué es lo
> que hay que releer cuando alguien proponga cambiarlas.

### D1 — ¿El plan baja SOLO cuando se acaba el periodo? → **SÍ … y REABIERTA el mismo día**

> ⚠️ **Lee §10 ANTES de construir esto.** El usuario tomó esta decisión y, horas después,
> propuso algo distinto y mejor: **no bajar el plan, sino congelar la cuenta tras un margen**. La
> baja automática de aquí abajo sigue documentada porque su *porqué* no cambia — pero **no la
> construyas sin leer §10**, que explica por qué congelar disuelve G1 en vez de pelearse con él.

Hoy no: «el plan no baja solo», lo baja una persona. Eso es lo que produjo el error del 17.

- **DECIDIDO: SÍ, automático, pero SÓLO para cuentas cuyo plan vino de un pago.** Cuando Stripe
  avisa que la suscripción terminó, `setDoctorTier(FREE, origen='webhook')` y aviso a Telegram.
- ⚠️ **La excepción no es opcional:** las **10 cuentas PRO de cortesía** no tienen suscripción y no
  pagan. La automatización tiene que mirar si el tier actual vino de un pago (`tier_change_log` con
  `origen='webhook'`) o de una cortesía puesta a mano, y **no tocar nunca las segundas**. Sin esa
  distinción, una automatización bien intencionada le quita PRO a diez cuentas que se lo regalamos
  a propósito.

### D2 — ¿Qué pasa si al llegar la fecha la cuenta YA NO CABE? → **bajar y congelar**

Agendó bajar a BÁSICO con 10 GB, y para el 17 de octubre subió a 22 GB.

- **Opción A — no bajarlo, avisar al admin.** Nunca se le quita capacidad que está usando; alguien
  lo resuelve a mano. Riesgo: Stripe le cobra BÁSICO mientras conserva PRO, indefinidamente.
- **DECIDIDO — Opción B: bajar el plan igual y congelar las subidas nuevas.** No se borra nada,
  conserva todos sus archivos, y no puede subir más hasta bajar de 15 GB. Es **exactamente lo que
  el producto ya le hace** a una cuenta GRATIS sin espacio, así que no es una regla nueva.

### D3 — ¿Bajar de PRO a BÁSICO: al final del periodo o inmediato con saldo? → **al final**

- **DECIDIDO: al final del periodo** (§2). Sin notas de crédito, sin saldos, y encaja con «no hay
  reembolsos».

---

## 7. Orden de trabajo sugerido

> 🔄 **Actualizado el 2026-09-18.** El paso 1 ya está hecho (commit `1103200e`, **sin pushear**).
> El paso 2 quedó EN DUDA — ver §10 — y el usuario propuso saltarlo. **Lo siguiente a construir es
> el paso 3 (SUBIR de plan):** es dinero que ENTRA, no depende de G1 ni de G6, y no tiene preguntas
> de cupo. El paso 4 necesita G6 resuelto antes.
>
> Y un dato de escala que ayuda a no sobre-construir: **con 12 doctores, bajar un plan a mano de vez
> en cuando se sobrevive** — más ahora que el modal del admin avisa antes de hacerlo antes de
> tiempo. La automatización se gana su lugar a los 100 doctores, no a los 12.

### El orden original (sigue valiendo para el resto)

1. **La pantalla primero (caso 4 y 6).** Hoy ya guardamos bien `cancel_at_period_end` y la fecha en
   que termina —se arregló el 2026-09-17—, así que decir la verdad en «Mi Cuenta» y en el admin
   **no necesita nada nuevo de Stripe**. Es lo más barato y es lo que habría evitado el error.
2. **La baja automática al final del periodo (D1)**, con la excepción de las cuentas de cortesía.
3. **Subir de plan (caso 3)**, prorrateado y con `pending_updates`.
4. **Bajar de plan (caso 5)** + el chequeo de topes (§5) + «Reanudar» (caso 7).

El punto 1 se puede hacer sin decidir nada de §6. Los demás no.

---

## 10. 🔁 La alternativa al paso 2: margen + CONGELAR (propuesta del usuario, 2026-09-18)

> **Estado: NO decidido.** El usuario la propuso al cerrar la sesión y se fue. Abajo está la idea,
> lo que cuesta de verdad (medido), sus pros y contras, la objeción clínica y lo que falta decidir.

### La idea, en sus palabras

En vez de bajar el plan el día que se acaba lo pagado: darle un **margen** (dijo ~15 días) y después
**congelar** la cuenta. El doctor **entra, ve todos sus documentos y todo su historial — pero no
puede CREAR nada.**

### 🟢 Por qué es mejor que el paso 2 tal como estaba escrito

**Disuelve G1.** La baja automática se atoraba porque MUEVE el tier, y `setDoctorTier` rechaza
cualquier movimiento que deje la cuenta sobre su tope: 3 de 12 cuentas (94 · 65 · 52 pacientes) no
podrían bajar a GRATIS nunca. **Congelar no toca el tier, así que la guarda jamás se dispara.** El
problema que hacía fea la automatización simplemente deja de existir.

Además: no ensucia `tier_change_log` con viajes PRO→FREE→PRO de una cuenta cuyo plan nunca cambió,
y al pagar **no hay nada que restaurar** — porque nunca se quitó nada.

### 💰 Lo que cuesta — medido, no estimado

Hay **dos formas** de construirlo y se diferencian en un orden de magnitud:

| Forma | Alcance real | Veredicto |
|---|---|---|
| **Un flag `congelado` que cada escritura respete** | **186 rutas de escritura** (120 en `apps/api` + 66 en `apps/doctor`). No hay un choke point único en runtime: `ROUTE_PERMISSIONS` es un mapa que usa un GATE de scripts, no un middleware | ❌ Es la versión que sale al 95% y el 5% que falta es un hueco silencioso |
| **✅ Un TIER EFECTIVO** — no se toca `Doctor.tier`, se RESUELVE como `FREE` mientras esté moroso | **Sólo 9 lugares leen el tier** en todo el repo, y los que importan son **3 líneas en `apps/api/src/lib/auth.ts`** donde se arma la sesión. Todo lo de abajo —gating de funciones, tope de 50 pacientes, tope de 500 MB— ya cuelga de ese valor y **no se toca** | ✅ La forma barata |

El tier efectivo da, gratis, casi exactamente lo que el usuario describió: entra, ve todo, **no puede
agregar pacientes más allá de 50, no puede subir archivos más allá de 500 MB**, y pierde
facturación, SAT, conciliación e IA. Al pagar, el override se levanta y vuelve todo.

### 🔴 La objeción que hay que respetar: NO congelar lo CLÍNICO

Esto es un expediente médico. Un doctor con el paciente enfrente, cuya tarjeta falló la semana
pasada, **tiene que poder escribir esa consulta** — y en México tiene la obligación legal de
conservar el registro. Bloquear eso para cobrar una suscripción es el intercambio equivocado, y
aparece en una queja antes que en un reporte de churn.

Lo bueno: **«tratarlo como FREE» ya respeta esto.** Las notas clínicas de un paciente que YA existe
no las capa ninguna TierKey (las excluidas son `facturacion`, `sat`, `conciliacion`, `ia`). Lo que
muerde es el crecimiento (pacientes nuevos, archivos nuevos) y lo comercial — no la nota del
paciente que está enfrente.

### ⚖️ Contras y aristas, sin maquillar

- **Un doctor con 3 GB de golpe no puede adjuntar UN solo estudio** (tope FREE: 500 MB). Correcto
  para cobrar, incómodo un martes por la tarde. Es la arista más dura y hay que decidirla a
  propósito, no descubrirla en producción.
- **«No puede crear un paciente nuevo» es medio clínico**: un paciente nuevo que llega no se puede
  dar de alta. Es lo mismo que el producto ya le hace a una cuenta GRATIS, así que es coherente —
  pero consúlta si eso es lo que se quiere.
- **El tier efectivo hace que el tier GUARDADO y el que MANDA dejen de coincidir.** Toda pantalla
  que hoy pinta `Doctor.tier` (admin incluido) empezaría a mentir un poquito si no dice «PRO,
  congelado». Es justo el tipo de doble fuente que este repo ya pagó caro; si se construye, el tier
  efectivo tiene que ser **el único** que se lea para decidir, y el guardado, sólo para mostrar.
- **La IA se apaga** al caer a FREE. Un doctor moroso pierde el asistente a media conversación; hay
  que decidir qué le dice el chat en vez de simplemente fallar.
- Sigue faltando **quién dispara el congelamiento** y con qué reloj: no hay cron hoy, y
  `customer.subscription.deleted` sólo avisa. El margen de 15 días necesita algo que mire la fecha.

### Lo que falta decidir (para la próxima sesión)

1. **¿Cuántos días de margen** y desde cuándo se cuentan: ¿desde que se acaba lo pagado, o desde el
   primer cobro fallido? (Esto además se traslapa con **G3**, el camino de dunning, que sigue sin
   mapearse.)
2. **¿El congelado capa lo clínico** (paciente nuevo, archivo nuevo) o sólo lo comercial?
3. **¿Esto REEMPLAZA a D1 o convive con él?** (p.ej. congelar a los 15 días y bajar el tier de
   verdad a los 60, cuando ya es claro que no vuelve).
4. Si se construye: **¿qué ve el doctor?** Una cuenta congelada sin explicación es peor que una
   cuenta bajada con explicación.

---

## 9. 🕳️ Huecos del plan (revisión 2026-09-18)

Repasando §1–§7 contra el código que YA está en prod. Los dos primeros no son detalles: son
**choques directos** con guardas que se acaban de shipear, y sin resolverlos el plan no corre.

### 🔴 G1 — La baja automática (D1) la RECHAZA la guarda de cupo de pacientes

`setDoctorTier` rechaza con `QUOTA_EXCEEDED` cualquier movimiento que deje la cuenta por encima del
tope, **venga de donde venga** — el webhook incluido, que es justamente el punto de ese archivo.
GRATIS tope 50 pacientes. Entonces: el doctor cancela, llega el 17, el sistema intenta bajarlo a
GRATIS… y la guarda dice que no.

**Medido en prod el 2026-09-18** (pacientes `active` por cuenta):

| Pacientes | Tier | Cuenta |
|---|---|---|
| 94 | PRO | dr-david-salazar-vela |
| 65 | PRO | dr-jose |
| 52 | PRO | dra-mariana-serratos |

**3 de 12 cuentas no podrían bajarse a GRATIS nunca** — y son las tres que MÁS usan el producto.
Se quedarían en un plan de paga sin pagar, con una alerta roja en Telegram que nadie puede accionar:
el admin no va a archivar 44 expedientes de un doctor para que quepa en GRATIS.

**Qué falta decidir/construir:** la guarda tiene que distinguir **quién pide la baja**. Que un admin
no pueda bajar a alguien que no cabe está bien (es un error humano). Que **el fin del periodo
pagado** no pueda — no: ahí la realidad ya cambió, el doctor dejó de pagar, y el sistema tiene que
poder reflejarlo. Es la misma forma que D2 (bajar y congelar), aplicada a pacientes: conserva sus 94
expedientes, los sigue viendo, y **no puede crear nuevos** hasta estar por debajo de 50.

### 🔴 G2 — La baja agendada (D3) choca con «un pago sólo SUBE el plan»

Se agenda PRO→BÁSICO. El 17 de octubre Stripe cobra la renovación **al precio de BÁSICO** y manda
`invoice.paid`. Pero la guarda que se shipeó anoche (hallazgo #1 del review de C3) compara rangos y
**se niega a bajar por un pago**:

> ⚠️ «pagó su renovación de BÁSICO, pero su cuenta está en PRO. El plan NO se bajó.»

Esa guarda está bien puesta — protege del caso en que el precio de Stripe y el tier se
desincronizan. Pero no sabe distinguir **«un pago inesperado por debajo»** (bloquear) de **«la baja
que nosotros mismos agendamos»** (ejecutar). Sin esa distinción, D3 no funciona: el doctor pagaría
BÁSICO y conservaría PRO para siempre.

**Qué falta:** guardar **a qué tier se agendó bajar** (ver G6) para que el webhook reconozca la baja
como intencional. Sin ese dato, las dos situaciones son indistinguibles desde el webhook.

### ⚠️ G3 — El mapa no cubre el caso más común: que la tarjeta FALLE en la renovación

Las 8 transiciones cubren «el doctor pide un cambio». No cubren **«el doctor no hizo nada y el
cobro falló»**, que en la vida real es como termina la mayoría de las suscripciones. Hoy
`invoice.payment_failed` sólo avisa y el plan no se mueve; Stripe reintenta unos días y después
cancela o la deja en `unpaid`, según cómo esté configurado.

Falta decidir: **cuántos días conserva el plan mientras Stripe reintenta** (periodo de gracia), qué
ve el doctor en ese hueco («no pudimos cobrar, revisa tu tarjeta» ya existe) y qué pasa al final de
los reintentos. Y ojo: el final de ese camino es una baja — o sea, **vuelve a caer en G1**.

### ⚠️ G4 — El mapa supone que PRO/BÁSICO = está pagando. Hay un tercer punto de partida

**Tier puesto a mano, sin suscripción**: las 10 cuentas PRO de cortesía (y dr-prueba durante buena
parte de las pruebas). Sus transiciones son otras:

- No hay nada que cancelar.
- `planesVendibles` **no vende por debajo del tier actual**, así que una cortesía PRO que quisiera
  pagar BÁSICO **no puede**: un admin tiene que bajarla primero — y ahí puede toparse con G1.

Es una fila propia del mapa, no un caso raro: hoy son **10 de 12 cuentas**.

### ⚠️ G5 — La cancelación vive en una puerta que no controlamos

Hoy el doctor cancela en el **portal de Stripe** («Tarjeta, recibos y cancelación»). Cualquier
chequeo previo que construyamos — el aviso de cupo de §5, «vas a perder facturación», el resumen de
lo que se pierde — **se puede saltar**, porque el doctor nunca pasa por nuestra pantalla.

Dos salidas: traer la cancelación a nuestra app (y dejar el portal sólo para tarjeta y recibos), o
aceptar que esos chequeos son informativos y que lo único que se impone de verdad es lo que pase al
final del periodo — que es G1 otra vez.

### ⚠️ G6 — No hay dónde guardar «a qué plan va a cambiar»

`subscriptions` guarda `cancel_at_period_end` y la fecha en que termina. Eso alcanza para
**cancelar**, pero no para **bajar de plan**: falta el **tier destino**. Sin ese dato:

- §4 promete que la pantalla diga «PRO hasta el 17/10, luego BÁSICO» — no se puede escribir;
- el admin no puede distinguir una baja agendada de una cancelación;
- y el webhook no puede resolver G2.

Sale de una columna nueva o de leer el *subscription schedule* de Stripe. Decidirlo ANTES de
escribir la pantalla, no después.

### ⚠️ G7 — Perder una función no es perder sus datos, y el plan no dice qué pasa con los datos

Bajar a GRATIS quita `facturacion`, `sat`, `conciliacion` e `ia`. ¿Qué pasa con los **CFDI ya
timbrados**, que son documentos fiscales que el doctor está obligado a conservar? Si la pantalla
desaparece, pierde el acceso a sus propios comprobantes.

Hace falta una respuesta explícita: acceso de **sólo lectura** a lo ya emitido, o una **exportación
antes** de que baje. Lo que no puede pasar es que se apague la sección y ya.

### ⚠️ G8 — A quien se le avisa es al admin, no al doctor

Todos los avisos de C3 van a Telegram. El doctor no recibe nada: ni «tu plan baja el 17» unos días
antes, ni «tu plan bajó» el día que pasa. Lo estándar es avisarle antes; y sin aviso, el día de la
baja las funciones simplemente desaparecen de su pantalla sin explicación.

### ℹ️ G9 — Todo el doc supone mensualidad

«El 17 del mes siguiente» está escrito suponiendo un solo intervalo. Hoy es cierto (sólo hay precios
mensuales), pero si alguna vez hay plan anual, los textos de §4 mienten. No bloquea nada ahora.

### Qué cambia del orden de trabajo

El §7 sigue siendo válido con un añadido: **G1 y G6 hay que resolverlos ANTES del paso 2**, y G6
antes incluso del paso 1 si se quiere que la pantalla distinga una baja de una cancelación. G3, G5
y G7 son decisiones de producto que se pueden tomar en paralelo.

---

## 8. Estado de dr-prueba (resuelto el 2026-09-18)

Estaba en GRATIS habiendo pagado hasta el 17 de octubre. **Se restauró a BÁSICO** con
`setDoctorTier` (`origen='script'`), no con un UPDATE crudo, para que corriera la guarda de cupo y
quedara el porqué en `tier_change_log`:

```
2026-09-18T00:29:03Z | dr-prueba | FREE -> BASICO | script |
Restaurar BÁSICO: pagado hasta 2026-10-17; se bajó a mano el 2026-09-18 sin esperar el fin del periodo
```

⚠️ **No bajarla hasta el 17 de octubre.** Ese día debe bajar sola — y que baje sola es justo lo que
este plan viene a construir (D1). Si el 17 de octubre sigue en BÁSICO, D1 no quedó bien hecho.
