# 04 — PLAN: cambio de plan (subir, bajar y cancelar)

> **Estado: PLAN. Nada de esto está construido.** Lo que SÍ está en prod es C1·C2·C3
> (`03-PLAN-cuenta-y-cobro.md`): contratar desde GRATIS y que el pago suba el plan.
>
> Este doc mapea **las 8 transiciones posibles** entre los tres planes que se venden, dice cuál
> funciona hoy y cuál no, y recoge las **3 decisiones de producto** (§6), ya tomadas el 2026-09-18.

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

### D1 — ¿El plan baja SOLO cuando se acaba el periodo? → **SÍ (con excepción)**

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

1. **La pantalla primero (caso 4 y 6).** Hoy ya guardamos bien `cancel_at_period_end` y la fecha en
   que termina —se arregló el 2026-09-17—, así que decir la verdad en «Mi Cuenta» y en el admin
   **no necesita nada nuevo de Stripe**. Es lo más barato y es lo que habría evitado el error.
2. **La baja automática al final del periodo (D1)**, con la excepción de las cuentas de cortesía.
3. **Subir de plan (caso 3)**, prorrateado y con `pending_updates`.
4. **Bajar de plan (caso 5)** + el chequeo de topes (§5) + «Reanudar» (caso 7).

El punto 1 se puede hacer sin decidir nada de §6. Los demás no.

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
