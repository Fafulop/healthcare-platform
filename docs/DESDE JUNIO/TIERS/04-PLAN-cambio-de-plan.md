# 04 — PLAN: cambio de plan (subir, bajar y cancelar)

> **Estado: PLAN. Nada de esto está construido.** Lo que SÍ está en prod es C1·C2·C3
> (`03-PLAN-cuenta-y-cobro.md`): contratar desde GRATIS y que el pago suba el plan.
>
> Este doc mapea **las 8 transiciones posibles** entre los tres planes que se venden, dice cuál
> funciona hoy y cuál no, y recoge las **3 decisiones de producto** (§6), ya tomadas el 2026-09-18.

---

## ⭐ ESTADO AL CERRAR EL 2026-09-18 — LEE ESTO PRIMERO

> 🗺️ **Actualizado el 2026-09-18 (noche): el plan vigente es §12 — el mapa completo de
> permutaciones, las reglas R1–R9 y el orden de construcción (§12.6).** Donde §3–§7 choquen con §12,
> manda §12.

### ✅ Todo pusheado y desplegado

`1103200e` (paso 1) y los docs se pushearon el 2026-09-18; api · doctor · admin **SUCCESS en
`c92ccbed`**.

### Lo que NO se ha probado con un clic

- **Las dos pantallas del paso 1** — y hoy **no se pueden ver**: dr-prueba ya **no está cancelada**
  (abajo). Para verlas hay que volver a cancelar desde el portal.
- **El camino `incomplete`** (`e27e42d3`): tarjeta **`4000 0025 0000 3155`**, empezar el pago y
  **abandonar** la confirmación del banco. Debe volver «Suscribirme» con el aviso de que no hubo cargo.

### ⚠️ dr-prueba: BÁSICO, ACTIVA, renueva el 17 de octubre

Verificado el 2026-09-18 contra Stripe y la BD: `active`, **sin** `cancel_at` ni `canceled_at`,
próximo cargo **2026-10-17** (modo prueba). Alguien **deshizo la cancelación** desde el portal —
lo que prueba que el caso B3a ya funciona. Lo que decía este bloque («cancelada, pagada hasta el
17/10») quedó viejo. El 17/10 se va a cobrar la renovación de prueba (primer B1 real).

### 🔴 En el árbol hay trabajo AJENO que no se debe commitear aquí

El **BBVA del informe médico** (sin commitear desde el 2026-08-21). El review del 2026-09-18 le
encontró **dos hallazgos HIGH verificados midiendo los rectángulos del PDF**: seis etiquetas de la
rejilla de antecedentes apuntan a la caja EQUIVOCADA (la de junto a *FUM* dice «gineco col. 1»), y
`undefined_3` es la caja de **ALCOHOL** rotulada como «pérdida intencional de peso». Más dos grupos
con el defecto de «dos preguntas fundidas» sin vetar (`discapacidad`, `Antecedentes
Ginecoobstétricos`). **No es shipeable**: pondría rótulos falsos en un documento médico-legal.
Necesita su propia sesión, con el PDF enfrente. **Nunca en un commit de cobro.**

### Lo siguiente a construir

**🎉 YA NO QUEDA NINGÚN 🔴.** #1–#4 y #5a (§12.7), #6.1 · #6.2 (§12.7), #6.3 (§12.8) y **#6.2b
(§12.9, probado congelando dr-quebradita en prod)** están todos arriba. Lo que bloquea pasar a modo
vivo deja de ser funcionalidad faltante y pasa a ser **C4: las 10 cuentas PRO que no pagan** — una
decisión de negocio, no código.

**#7a (pedir bajar de plan) también está en prod** (§12.10): con eso el flujo del dinero queda
cerrado de punta a punta — subir cobra solo, bajar se pide y lo hace un humano, y dejar de pagar
baja o congela sin que nadie intervenga.

Sigue, ya sin nada urgente: **#7a falta clicarlo** → #6.4
(avisos por correo) → #6.5 (la descarga masiva no deja rastro en `patient_audit_logs`) → #5b → bajar
de plan (#7) → una cuenta por doctor (#8). Cada uno se presenta como plan y espera el OK antes de
código. ⚠️ Antes que todo eso, ver el **URGENTE** del README (el login).

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

### D2 — ¿Qué pasa si al llegar la fecha la cuenta YA NO CABE? → ~~bajar y congelar~~ **REEMPLAZADA por §12 R4 + R5**

> 🔄 2026-09-18: el usuario decidió que **sólo se baja si cabe** (R4), y las subidas se topan desde
> que se agenda la baja (R5), así que al llegar la fecha siempre cabe. Lo de abajo es historia.

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

> ✅ **Ya DECIDIDO — ver §11**, que la afina (no todo queda visible: si no cabe en GRATIS, se
> congela y sólo ve «Reactivar» y «Descargar»). Lo de abajo se conserva por su porqué.
>
> **Estado original: NO decidido.** El usuario la propuso al cerrar la sesión y se fue. Abajo está la idea,
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

### ~~La objeción de no congelar lo clínico~~ — DESCARTADA POR EL USUARIO (2026-09-18)

> 🔴 **Decisión del usuario, no re-litigar:** **sí se puede congelar la escritura clínica.** Su
> argumento, y es el correcto: la obligación de llevar el expediente es **del médico, no nuestra**.
> Si dejó de pagar, puede escribir donde quiera — no es problema del producto. El párrafo de abajo
> se conserva porque explica qué capa y qué no el «tratarlo como FREE», pero **su conclusión ya no
> manda**.
>
> Lo que SÍ sigue en pie, y es otra cosa: **no destruir ni secuestrar sus datos.** El usuario lo
> separó explícitamente y se lo llevó como tarea de investigación:
>
> - **Preguntar a empresas que dan este servicio qué hacen cuando un cliente deja de pagar** — antes
>   de inventar una política.
> - Probablemente haya que **conservar la información aunque no paguen**, y darles **siempre** una
>   forma de bajarla (idea suya: comprimir todo en un zip y enviárselo).
>
> Eso se cruza con **G7** (§9): hoy nadie ha dicho qué pasa con los CFDI ya timbrados cuando una
> cuenta pierde `facturacion`. **Retención + exportación es su propia decisión, pendiente.**

### El detalle de qué capa «tratarlo como FREE» (para dimensionar, ya no para objetar)

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
- **«No puede crear un paciente nuevo»** — consultado con el usuario el 2026-09-18: **es lo que se
  quiere.** Es lo mismo que el producto ya le hace a una cuenta GRATIS.
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
2. ~~¿El congelado capa lo clínico?~~ **RESUELTO: sí.** En su lugar queda abierta otra:
   **¿qué política de retención y exportación** acompaña al congelamiento (ver el recuadro de arriba
   y G7). El usuario va a investigar qué hacen otras empresas antes de decidirla.
3. **¿Esto REEMPLAZA a D1 o convive con él?** (p.ej. congelar a los 15 días y bajar el tier de
   verdad a los 60, cuando ya es claro que no vuelve).
4. Si se construye: **¿qué ve el doctor?** Una cuenta congelada sin explicación es peor que una
   cuenta bajada con explicación.

---

## 11. ✅ Qué pasa cuando dejan de pagar — DECIDIDO el 2026-09-18

> Cierra §10. Salió de preguntarle a un competidor cómo lo hace (abajo) y de dos correcciones del
> usuario a la primera propuesta. **Nada de esto está construido.**

### 11.1 Lo que hace un competidor (chat de WhatsApp con su soporte, 2026-09-18)

| Tema | Su política |
|---|---|
| Deja de pagar o cancela | **Bloqueo TOTAL**: ni lectura |
| Respaldo | **Responsabilidad del doctor, y ANTES de cancelar.** Autoservicio, en **HTML** |
| Retención | **5 años** en la nube (se cuelgan de la NOM del expediente) |
| Regresa | Entra con su correo, paga, y **se reactiva solo** con todo — aunque sea 2 años después |
| Adjuntos (PDFs) | Se les preguntó directo si el respaldo incluye los documentos cargados. **Esquivaron**: «todo su respaldo se entrega en HTML» |

Su punto débil: el respaldo hay que hacerlo **antes** de dejar de pagar. Si la tarjeta falla (la
forma más común de perder una suscripción), el doctor queda fuera de sus datos sin haberse
respaldado. Aquí eso no pasa: **el botón de descarga sigue en la pantalla de congelado.**

### 11.2 Por qué NO «tratarlo como GRATIS con todo visible» (corrección del usuario)

La primera propuesta (§10) era dejarle leer todo con el tier efectivo en FREE. El usuario lo
corrigió: **una cuenta que pagó y dejó 10 GB, leyéndolos en un plan cuyo tope es 500 MB, no cumple
con lo que es el plan GRATIS.** Y guardar adjuntos por años tiene un costo real.

Pero bloquear SIEMPRE tampoco cuadra: a quien **sí cabe** en GRATIS, bloquearlo sólo lo empuja a
abrir otra cuenta gratis (que además ahora se prohíbe — ver `05-PLAN-una-cuenta-por-doctor.md`).
De ahí la regla híbrida.

### 11.3 La regla

```
se acaba lo pagado ──(15 días de margen, todo funciona)──▶ ¿cabe en GRATIS?
                                                            ├─ SÍ → pasa a GRATIS, sin más
                                                            └─ NO → CONGELADA
```

- **Margen: 15 días** (decisión del usuario). Se cuentan **desde que se acaba lo pagado**
  (`current_period_end`) — **confirmado por el usuario**: así cubre igual la cancelación y la
  tarjeta que falla en la renovación (los reintentos de Stripe corren DENTRO del margen). Resuelve
  §10-1.
- **«Cabe en GRATIS» = los DOS topes**: ≤ 50 pacientes activos **y** ≤ 500 MB. Las tres cuentas más
  pesadas de hoy (94 · 65 · 52 pacientes) se congelarían por **pacientes**, no por megas.
- **Las cuentas de cortesía (sin suscripción) no se tocan nunca** (G4).

### 11.4 Qué ve una cuenta CONGELADA

Entra con su correo y contraseña, y **sólo** ve dos cosas:

1. **[Reactivar]** — paga y todo vuelve tal cual. No se restaura nada porque nunca se borró nada
   (igual que el competidor).
2. **[Descargar mi información]** — un **zip SIN los archivos adjuntos**:
   - `pacientes.csv`, `citas.csv`, recetas… — lo tabular, para Excel;
   - **un HTML por paciente** con su expediente completo (abre en cualquier navegador y se imprime a
     PDF; CSV no sirve para notas largas y anidadas, Markdown no le dice nada a un doctor);
   - **el LISTADO de adjuntos** (nombre · fecha · paciente) **sin los archivos** — para que sepa qué
     existe y que al pagar vuelve;
   - ~~**los XML de sus CFDI**~~ — ⚠️ **REVERTIDO al construirlo (2026-09-20, §12.8).** No van en el
     zip: lo que se lleva es el expediente, no la contabilidad. Traerlos obligaba a bajar de
     Facturama el XML de cada factura no descargada antes, en serie y sin tope, dentro de UNA
     petición — y si el proxy la cortaba se perdía el zip completo. Siguen saliendo de Facturación.

La pantalla tiene que decir **hasta qué fecha se conservan sus adjuntos** (11.5).

> 📌 **Construido en `3bb783a1` (2026-09-20) — el as-built con lo que cambió está en §12.8.** Además
> de lo de arriba, el zip lleva `tareas.csv` (los pendientes del doctor) y `adjuntos.csv` nombra
> también la foto del paciente y su Constancia de Situación Fiscal, que no viven en `patientMedia`.

### 11.5 Retención

| Qué | Cuánto se guarda | Por qué |
|---|---|---|
| Datos (texto en la BD: expedientes, notas, citas, CFDI) | **5 años** | Pesa casi nada; los 5 años son lo que el mercado ya promete |
| **Adjuntos** (PDFs, imágenes, videos) | **1 año** — decisión del usuario, «para empezar» | Es lo que cuesta: ~$0.02–0.03 USD/GB-mes ⇒ una cuenta de 40 GB son ~$50–70 USD en 5 años. Hoy el bucket ENTERO pesa ~0.5 GB, así que es previsión, no urgencia |

- El año se cuenta **desde que la cuenta se congela** — **confirmado por el usuario**.
- **Antes de borrar un adjunto hay que AVISARLE al doctor** (correo con tiempo, y el aviso en la
  pantalla de congelado). Borrar sin avisar es exactamente «destruir sus datos», que es lo único que
  el usuario dejó como línea roja (§10). **Esto hace obligatorio G8** (avisarle al doctor, no sólo
  al admin) para este camino.

### 11.6 Qué cambia en el resto del doc

- **D1 queda sustituida en su comportamiento**: ya no es «el plan baja el día que se acaba lo
  pagado», es «margen de 15 días y luego GRATIS o CONGELADA». El *cómo* (tier efectivo derivado de
  la suscripción vs. mover `Doctor.tier`) está **por diseñar**; §10 da la razón para preferir el
  derivado: no choca con la guarda de cupo (G1) y no ensucia `tier_change_log`.
- **Congelar ≠ capar escrituras.** Es un **bloqueo de sesión**: la cuenta congelada sólo alcanza la
  pantalla de congelado, el pago y la descarga. Eso se resuelve en un punto (la sesión / el
  middleware), no en las 186 rutas de escritura — pero **las lecturas por API también** tienen que
  quedar cerradas, y eso hay que dimensionarlo antes de prometerlo.
- **Sigue abierto:** si la descarga también se ofrece a cuentas **activas** (en cualquier momento),
  o sólo al congelar.

---

## 12. 🗺️ EL MAPA COMPLETO — todas las permutaciones contra el código (2026-09-18)

> **Esto manda sobre §3–§7 y §6 donde choquen.** Se armó con el usuario caso por caso, y cada
> «Hoy» se verificó en el código y contra prod (BD + Stripe, sólo lectura) el 2026-09-18. Nada de
> la columna «Debe ser» está construido salvo donde dice ✅.

### 12.0 Las reglas que salieron de este mapa

| # | Regla | Reemplaza a |
|---|---|---|
| R1 | **GRATIS nunca se congela.** Al llegar a su tope (50 pacientes · 500 MB) sólo se bloquea **agregar** (paciente nuevo, archivo nuevo). Todo lo demás sigue | — |
| R2 | **Todo aviso de tope o de función no incluida lleva a «Mi Cuenta» → pagar.** Nunca a un correo | El CTA `mailto:` de `TierUpgradeNotice` |
| R3 | **Borrar un archivo libera espacio.** | La deuda H5 de `03` (hoy el contador sólo sube) |
| R4 | **Sólo se puede bajar de plan si lo que usas CABE en el plan de abajo** (almacenamiento, y pacientes si el destino es GRATIS). Si no cabe, se dice con números: «Usas 20 GB y BÁSICO permite 15 GB. Libera 5 GB» | D2 (§6) y P4c: ya NO se baja «igual y se congelan las subidas» |
| R5 | **Con una baja AGENDADA, las subidas nuevas se topan al límite del plan destino** desde que se agenda. Así el día del cambio siempre cabe | — |
| R6 | **Dejar de pagar ≠ bajar de plan.** Dejar de pagar: 15 días de margen → GRATIS si cabe, CONGELADA si no (§11). Bajar: R4 | — |
| R7 | **El admin puede cambiar a mano el plan de quien paga por Stripe, con AVISO** («Stripe le seguirá cobrando X»). No se bloquea | — |
| R8 | **Pagar un plan mayor con una cancelación agendada QUITA la cancelación.** | — |
| R9 | **Las cortesías pasan a LAB** (lo hace el usuario en el admin). LAB = PRO hoy (mismas funciones, 50 GB), no se vende, no vence, no se congela. Desaparece el bloque de cortesías y **se destraba C4** (la reconciliación ya no las marca en rojo) | G4 (§9) |

### 12.1 Bloque 1 — desde GRATIS

| # | Caso | Hoy (verificado) | Debe ser |
|---|---|---|---|
| F1 | Llega a 50 pacientes activos | Se bloquea en los 3 caminos (alta · importación · **desarchivar**). Mensaje: «Archiva un expediente…». **Sin salida de pago** | Igual + botón a **Mi Cuenta → pagar** (R2) |
| F2 | Llega a 500 MB | Se rechaza la subida: «necesitas ampliar tu plan». **Sin botón.** Borrar **no** libera (H5) | Botón a pagar (R2) + borrar libera (R3) |
| F3 | Entra a una función no incluida | Candado + «Escríbenos». El botón sale sólo con `NEXT_PUBLIC_SALES_EMAIL`, **que no está puesta** ⇒ **sin salida** | Botón a **Mi Cuenta → pagar** (R2) |
| F4 | GRATIS → BÁSICO | ✅ **Probado en vivo** el 2026-09-17 (checkout → `invoice.paid` → sube, con bitácora) | Igual |
| F4a | Cierra el checkout sin pagar | ✅ «No se completó el pago…» | Igual |
| F4b | Tarjeta rechazada en el checkout | ✅ Stripe lo dice ahí; no se crea nada | Igual |
| F4c | 3DS abandonado (`incomplete`) | Arreglado en `e27e42d3`. **Nunca clicado** | Probar con `4000 0025 0000 3155` |
| F4d | Paga en dos pestañas | Dos suscripciones; aviso a Telegram; **reembolso a mano** | Aceptable a esta escala |
| F4e | Regresa antes del webhook | ✅ Aviso azul que no afirma el cambio | Igual |
| F5 | GRATIS → PRO | Mismo camino que F4. **Nunca probado en vivo** | Probarlo una vez |

### 12.2 Bloque 2 — BÁSICO (pagando)

| # | Caso | Hoy (verificado) | Debe ser |
|---|---|---|---|
| B1 | Renovación cobrada | `invoice.paid` del mismo plan: sólo anota la fecha. La primera real será dr-prueba el **17/10** | Igual |
| B2 | **Renovación falla** | `past_due`, aviso «revisa tu tarjeta», Telegram. **El tier se queda para siempre** | Línea de tiempo abajo (12.5) |
| B2a | 🔴 **Desde qué fecha cuentan los 15 días** | Al fallar la renovación Stripe **igual avanza** `current_period_end` un mes, y es lo que guardamos ⇒ Mi Cuenta diría «Próximo cargo: 17/11» debiendo dinero, y el margen contaría mal | Contar desde **el fin del último periodo PAGADO**. **Verificar con test clocks ANTES de construir** |
| B3 | Cancela (portal, al final del periodo) | ✅ «Tu plan BÁSICO sigue activo hasta el X… no hay reembolsos» (paso 1, en prod) | Igual |
| B3a | Deshace la cancelación | ✅ **Ya funciona desde el portal** — es justo lo que le pasó a dr-prueba | **No hace falta construir «Reanudar»** (caso 7 de §3) |
| B3b | Se acaba lo pagado | `subscription.deleted` ⇒ Telegram «bájala a mano». **El tier se queda para siempre** | Margen + GRATIS/congelada (§11) |
| B3c | Se vuelve a suscribir en el margen | ✅ Con la suscripción cancelada, Mi Cuenta vuelve a ofrecer planes | Igual |
| B3d | Congelada paga («Reactivar») | No existe | Checkout normal; con `invoice.paid` se descongela con todo |
| B4 | **BÁSICO → PRO** | ❌ **Imposible**: checkout 409 «escríbenos» y el portal tiene el cambio de plan APAGADO (verificado en Stripe) | Inmediato, **prorrateado**, con `payment_behavior: 'pending_if_incomplete'`: el cambio sólo se aplica si se cobra. **El webhook ya sube el tier** con ese `invoice.paid` |
| B4a | Falla el cobro del prorrateo | — | Nada cambia |
| B4b | El banco pide 3DS | — | A la página de Stripe para confirmar |
| B4c | Sube con cancelación agendada | — | Se quita la cancelación (R8) |
| B5 | Llega a 15 GB | Rechazo de subida como F2 | Botón a pagar (→ PRO) + R3 |
| B6 | Admin cambia su plan a mano | Permitido; sólo avisa si hay cancelación agendada | Permitido **con aviso** para cualquier suscripción viva (R7) |
| B7 | Reembolso / contracargo | El webhook no escucha esos eventos | Baja prioridad |

### 12.3 Bloque 3 — PRO (pagando)

| # | Caso | Hoy (verificado) | Debe ser |
|---|---|---|---|
| P1 | Renovación cobrada | = B1 | Igual |
| P2 | Renovación falla | = B2 | = B2; cae a **GRATIS** (nunca a BÁSICO) o congelada |
| P3 | Cancela / deshace | = B3 / B3a | Igual |
| P3a | PRO cancelado quiere volver en **BÁSICO** | ❌ **Imposible**: `planesVendibles` nunca vende por debajo del tier, que sigue en PRO. **Y** si se pudiera, el webhook se negaría a bajarlo (un pago sólo sube) | Una cuenta **sin suscripción viva** puede comprar cualquier plan **en el que quepa** (R4), y ese pago **fija** el plan aunque sea menor |
| P4 | **PRO → BÁSICO** | ❌ **Imposible** (409 y portal sin cambio de plan) | Al **fin del periodo**, sin reembolso (D3), **sólo si cabe** (R4). Mi Cuenta: «Tienes PRO hasta el 17/10; ese día pasas a BÁSICO ($X)» |
| P4a | Se arrepiente antes de la fecha | — | Botón **«Cancelar el cambio»** en Mi Cuenta (el portal no sirve: el cambio de plan está apagado) |
| P4b | Llega la fecha: renovación al precio de BÁSICO | ⚠️ El webhook **se niega a bajarlo** («pagó BÁSICO pero está en PRO, NO se bajó») — G2 | Guardar **a qué plan va** (G6) para que el webhook reconozca la baja agendada |
| P4c | ~~Llega la fecha pasado de 15 GB~~ | — | **No puede pasar:** R5 topa las subidas desde que se agenda |
| P4d | Agenda la baja y luego cancela | — | Gana la cancelación: fin de periodo → margen → GRATIS/congelada |
| P4e | Baja agendada y la renovación en BÁSICO falla | — | = B2, ya en BÁSICO |
| P5 | PRO → GRATIS | = cancelar | Igual |
| P6 | Llega a 50 GB | «necesitas ampliar tu plan» — **pero no hay plan mayor que comprar** (LAB no se vende) | «Libera espacio borrando archivos». **Sin botón de pago** |
| P7 | Admin cambia su plan a mano | = B6 | Con aviso (R7) |

### 12.4 Cortesías → LAB

Las 10 cuentas PRO que no pagan pasan a **LAB** (R9), a mano por el usuario desde el admin.
**dr-quebradita** (BÁSICO puesto a mano, sin suscripción): lo decide el usuario al hacerlo. Nota:
cuando llegue **Q5**, LAB conserva el asistente 🟢 y PRO no — tendrán un poco MÁS que PRO.

### 12.5 La línea de tiempo de una tarjeta que falla (configuración de Stripe verificada)

Stripe (modo prueba), configurado por el usuario el 2026-09-18: **Smart Retries, hasta 8 intentos en
1 semana · al agotarse: cancelar la suscripción · la factura: marcar como INCOBRABLE** (antes decía
«dejar vencida», que permitía pagar una suscripción ya cancelada sin recuperar nada).

| Día | Qué pasa |
|---|---|
| 0 | Falla la renovación (día 0 = **fin del último periodo pagado**, B2a). `past_due`, todo funciona, aviso con la fecha límite |
| 0–7 | Stripe reintenta. Si uno pasa, todo vuelve a la normalidad |
| ~7 | Se agotan: Stripe **cancela**. Sigue todo funcionando y Mi Cuenta ofrece suscribirse otra vez |
| 15 | Fin del margen: **GRATIS** si cabe, **CONGELADA** si no (§11) |

⚠️ Al pasar a VIVO hay que repetir esta configuración en modo vivo: es por modo.

### 12.6 Qué construir, en orden

| # | Qué | Casos | Toca Stripe | Tamaño | Estado |
|---|---|---|---|---|---|
| 1 | **Camino al pago**: los tres avisos de tope/candado llevan a Mi Cuenta → pagar; P6 dice «libera espacio» | F1–F3 · B5 · P6 | No | Chico | ✅ `280d13ac` — probado |
| 2 | **Aviso en el admin** para cambios a mano sobre suscripciones vivas | B6 · P7 | No | Chico | ✅ `5ed3d09f` — probado |
| 3 | **Subir de plan** BÁSICO→PRO, prorrateado, quitando la cancelación | B4 a–c | Sí | Mediano | ✅ `95152259` — probado con cobro |
| 4 | **Vender cualquier plan en el que quepa** a quien no tiene suscripción viva, y que ese pago **fije** el plan | P3a · R4 | Sí (webhook) | Chico-mediano | ✅ `2bbbff32` — probado con cobro |
| 5a | **Borrar libera espacio — expediente** | R3 · F2 · B5 | No | Mediano | ✅ `f94e12ae` — probado |
| 5b | **Borrar libera espacio — las otras 16 superficies** (videos de perfil, blog, flujo, receta, reemplazar foto…) | R3 | No | Mediano | ⬜ |
| 6.1 | **Dejar de pagar — parte 1**: `pagado_hasta` (B2a), cron diario, 15 días de margen → GRATIS si cabe | B2 · B3b · P2 · §11 | Lee | Mediano | ✅ `ff22b0f7` — dryRun probado |
| 6.2 | Congelar a quien no cabe + pantalla [Reactivar] (sin [Descargar]: es 6.3) | B3d · §11 | Lee | Mediano | ✅ `62e36800` — probado con clic |
| 6.2b | **La reserva pública de una cuenta congelada** — los pacientes SEGUÍAN agendando (SMS/Calendar/Telegram) citas que el doctor no puede ver | §11 | No | Chico-mediano | ✅ `d7d04b20` — **probado en prod congelando dr-quebradita** (§12.9) |
| 6.3 | La descarga (zip) | §11.4 | No | Mediano | ✅ `3bb783a1` — **probado con clic** (§12.8) |
| 6.4 | Avisos por correo al doctor (G8) | §11.5 | No | Chico | ⬜ |
| 6.5 | **La descarga masiva de expedientes no deja rastro** — `apps/doctor` escribe `patientAuditLog` en 42 caminos de datos de paciente; `apps/api` en ninguno, y #6.3 se lleva TODA la cuenta. Con una sesión de dueño robada, ver UN expediente queda registrado y bajárselos todos no. No es un defecto de #6.3: es que `apps/api` no tiene `logAudit` | §11.4 · LFPDPPP/NOM-024 | No | Chico-mediano | ⬜ |
| 7a | **Bajar de plan, versión corta**: el doctor lo PIDE desde Mi Cuenta (con el chequeo R4 delante) y un humano lo hace a mano desde el admin | P4 a | No | Chico-mediano | ✅ `80d23415` (§12.10) — **falta el clic** |
| 7b | **Bajar de plan de verdad**: prorrateo, baja agendada a fin de periodo, tope R5, plan destino guardado (G6), webhook (G2), «Cancelar el cambio» | P4 a–e | Sí | Grande | ⬜ Ya no urge: 7a le da salida al doctor. Cuando se construya, la tabla de 7a es su bandeja de entrada o se retira |
| 8 | **Una cuenta por doctor** | `05` | No | Grande, empieza por investigar | ⬜ |

> 📍 **Medido contra la BD de prod el 2026-09-20.** El cobro **funciona de punta a punta en modo
> prueba**: 2 suscripciones vivas (dr-prueba `PRO` renueva 17/10 · dr-quebradita `BASICO` 18/10) y
> **el webhook ya escribió 3 veces** en `tier_change_log`. Las cortesías se movieron a LAB (8
> cuentas), así que lo que bloqueaba C4 prácticamente desapareció: queda `fffffffff`, en `PRO` sin
> suscripción.
>
> ⚠️ **`TELEGRAM_ADMIN_CHAT_ID` NO está puesta en `@healthcare/api`**: `avisarAdmin()` se va sin
> mandar nada, así que pago fallido, cancelación y «no se pudo pasar a Gratis» **hoy sólo viven en
> los logs**. Es la red de C3 y está apagada en silencio. (`NEXT_PUBLIC_SALES_EMAIL` tampoco está,
> prerrequisito de Q2b.) Ver el bloque del 09-20 en el README.

### 12.7 As-built de #1–#4 (2026-09-18)

Todo en prod y **probado a mano por el usuario** el mismo día. Método de cada uno: plan → OK →
código → type-check + gates → **un** review → OK → commit/push → prueba con clic.

- **#1 `280d13ac`** — `VerPlanesLink` (componente único) en el candado de página
  (`TierUpgradeNotice`), el de IA (`AiUpgradeDialog`), el alta de paciente, la importación y el
  `MediaUploader`; un member ve «pídele al titular». Ancla `#pago` en Mi Cuenta.
  `explicarRechazoDeSubida` dice «cambia de plan en Mi Cuenta» sólo si hay plan mayor que vender
  (a PRO/LAB: «el límite más alto que ofrecemos»). **Hallazgo lateral:** uploadthing v7 se TRAGA el
  rechazo del servidor (`startUpload` devuelve `undefined`); el `MediaUploader` nunca le había
  mostrado al doctor por qué no subía — ahora sí. **Pendiente:** el bloque «Escríbenos» del final de
  Mi Cuenta sigue con correo; se quita al pasar a vivo (hoy es la única salida de quien no ve el
  cobro).
- **#2 `5ed3d09f`** — `apps/admin/src/lib/aviso-cobro.ts`. Sólo con suscripción `active`: «Este
  doctor paga X por Stripe. Cambiar su plan aquí no cambia lo que Stripe le cobra», y «pagó hasta…
  no hay reembolsos» si se elige por DEBAJO del plan pagado. `GET /api/admin/doctor-tier` devuelve
  `planPagado`. 🔴 **Lección:** la primera versión tenía una frase por caso y dos reviews seguidos le
  encontraron frases falsas en los bordes; se dejó en **dos frases ciertas en todo estado** —
  cada rama es otra afirmación que puede mentir.
- **#3 `95152259`** — `POST /api/billing/cambiar-plan`: preview con `invoices.createPreview` y
  confirmación con `subscriptions.update` **todo o nada** (`error_if_incomplete`, sin 3DS a
  propósito), mismo `proration_date` que el preview, quita la cancelación agendada (R8). El plan lo
  sube el webhook ya existente. Probado: dr-prueba cobró **$145.26** (`subscription_update`), el
  webhook subió BÁSICO→PRO a los 3 s, la renovación siguió el 17/10 a $299.
- **#4 `2bbbff32`** — `cabeEnPlan()` en `packages/database` (mismos contadores que los topes);
  `planesVendibles({ incluirMenores })` sólo sin suscripción viva y **nunca para LAB**; el webhook
  deja que el **primer pago** (`subscription_create`) fije un plan menor; las renovaciones siguen
  sin poder bajar. Probado: dr-quebradita en PRO puesto a mano compró BÁSICO ($149) y el webhook lo
  bajó PRO→BÁSICO a los 4 s. **Aceptado a propósito:** no se vuelve a medir el almacenamiento al
  llegar el pago.

- **#5a `f94e12ae`** — al borrar un archivo del expediente: sale del libro mayor (`olvidarArchivo`,
  el cupo baja) y del bucket de uploadthing (`UTApi.deleteFiles`, deja de costar); **definitivo, sin
  papelera** (decisión del usuario), y la confirmación lo dice en español. Hasta hoy **nada en el
  repo borraba del bucket**. 🔴 **Hallazgo del review (seguridad):** la URL de un media llega del
  navegador sin validar, así que sólo se borra del bucket lo que estaba en el libro mayor **de ese
  doctor** — sin eso, un doctor podía borrar el archivo de otro. Consecuencia aceptada: lo subido
  antes del 2026-09-13 (135 de 160 archivos del expediente) sale del expediente pero se queda en el
  bucket. Los avisos de «sin espacio» ya dicen «borra archivos **del expediente**» (sólo eso libera;
  el resto es #5b). Probado: dr-quebradita subió una foto, el contador subió, la borró, el contador
  volvió y el libro mayor quedó en 0 filas, sin errores `[storage]` en el log.
  ⚠️ El api no se redesplegó (sólo cambió el paquete): sus rutas de subida siguen con el texto
  anterior de «sin espacio» hasta el próximo deploy del api — cierto, sólo sin la parte de «borra».

- **#6.1 `ff22b0f7`** — columna `subscriptions.pagado_hasta` (SQL manual, aplicado ANTES del
  código por el usuario, con relleno: dr-prueba 17/10, dr-quebradita 18/10). La escribe SÓLO
  `invoice.paid`, con el fin del periodo de **la factura pagada** (review: con el periodo actual,
  pagar tarde una factura vieja daba por pagado el mes siguiente). `DIAS_DE_MARGEN`/`finDelMargen`
  en `cobro-planes.ts` = una sola fuente para pantalla y cron. `POST /api/cron/cobro-vencido`:
  una vez al día (09:00–09:14 MX), `?dryRun=1`; vencido el margen y si cabe en Gratis ⇒
  `setDoctorTier(FREE)` + aviso; si no cabe ⇒ sólo aviso (congelar es #6.2); **pregunta a Stripe
  antes de bajar** (activa y al corriente ⇒ webhook perdido; no existe en este modo ⇒ fila del otro
  modo — ninguno se toca). Mi Cuenta dice «después del X tu cuenta pasa a Gratis» **sólo cuando es
  cierto**. Probado en prod: dryRun `revisadas: 0`, fuera de ventana `skipped`, sin secreto 401.
  ✅ El usuario agregó la llamada al servicio `cron` de Railway (RAILWAY-CRON.md #6) el 2026-09-18.
  Primer caso real posible: ~1–2 de noviembre (dr-prueba y dr-quebradita, si no renuevan).

- **#6.2 `62e36800`** — columna `doctors.congelada_desde` (SQL manual
  `add-doctors-congelada-desde.sql`, aplicado ANTES del código por el usuario; el código la
  SELECCIONA en cada request autenticado, así que desplegar primero habría tumbado todo).
  `EffectiveAccess.congelada` (fail-open) y `rutaPermitidaCongelada()` en `membership.ts` = UNA
  lista para las dos apps: `/api/auth/` · `/api/account/` · `/api/billing/`. Candados:
  `validateAuthToken` (api; cubre `requireDoctorAuth`/`getAuthenticatedDoctorStripe` del api y su
  uploadthing), `requireDoctorAuth` del doctor (y `requireOwnerAuth`, que pasa por él), y la subida
  de archivos del doctor (lee `session.user.congelada`) ⇒ 403 `ACCOUNT_FROZEN`, dueño **y**
  members; va ANTES del candado de plan. Congela: el cron `cobro-vencido` (vencido el margen y no
  cabe en Gratis; un solo aviso 🧊, las ya congeladas salen de la consulta; el tier NO se toca).
  Descongelan: `invoice.paid` (aviso 🔓) y un cambio de plan en el admin — que **sólo dura a LAB
  (o GRATIS)**: a otro plan de pago, `pagado_hasta` sigue vencido y el cron la vuelve a congelar al
  día siguiente (igual que #6.1 revierte un plan puesto a mano sin pago; la salida de un caso
  especial es LAB). Pantalla (`dashboard/layout.tsx` + `CuentaCongelada.tsx`): el dueño sólo ve Mi
  Cuenta, sin barra lateral ni widgets, con el aviso; un member ve el aviso «pídele al titular».
  **Review (`/code-review high`, uno):** 4 hallazgos — 2 textos que prometían de más, arreglados
  («todo vuelve como lo dejaste» era falso: puede comprar un plan MENOR en el que quepa, #4; y
  «un cambio de plan en el admin la descongela» era falso salvo a LAB); la reserva pública ⇒
  **6.2b**; congelada con cargo `past_due` vivo ⇒ no se ofrecen planes, improbable (Stripe cancela
  tras ~1 semana de reintentos < 15 días de margen) y el texto «paga desde esta página» lo cubre.
  **Probado con clic** (dr-quebradita congelada a mano ~minutos y descongelada): redirige a Mi
  Cuenta sin barra, otra URL regresa a Mi Cuenta, `/api/medical-records/patients` ⇒
  `ACCOUNT_FROZEN`, Mi Cuenta lee plan y pago; al descongelar vuelve todo. Sin probar: el
  congelado/descongelado AUTOMÁTICO (cron y webhook) — su primer caso real es ~noviembre.

**Estado de las cuentas de prueba al cerrar:** dr-prueba **PRO** pagando (renueva 17/10 a $299);
dr-quebradita **BÁSICO** pagando (renueva 18/10 a $149); ambas en modo prueba y en
`STRIPE_BILLING_TEST_DOCTORS` junto con `gerardo`. ⚠️ `gerardo` está ligado a un usuario **ADMIN**:
`billing/*` le responde 403 y Mi Cuenta dice «no pudimos leer…» — no sirve para probar cobro.

**Cómo se prueba lo que depende del tiempo** (B1, B2/B2a, B3b, el margen): **test clocks** de Stripe —
un cliente en un reloj simulado que se adelanta 30 días en segundos—, no esperando un mes.

### 12.8 As-built de #6.3 — «Descargar mi información» (2026-09-20)

**`3bb783a1` en prod** (api `4b27b52a` · doctor `41e59c64`, ambos SUCCESS, mismo disparo; la ruta
responde **401** sin sesión ⇒ existe de verdad, no sólo «desplegada»). Con esto **6.2b queda como
el único 🔴 que bloquea pasar a modo vivo.**

`GET /api/account/exportar` (api) arma en memoria un zip y lo devuelve: `pacientes.csv` ·
`consultas.csv` · `citas.csv` · `recetas.csv` · `tareas.csv` · `adjuntos.csv` · `LEEME.txt` ·
`expedientes/<paciente>.html` (el expediente completo, se abre en cualquier navegador y se imprime
a PDF). Contenido en `apps/api/src/lib/exportar-cuenta.ts`; la sección «Tu información» vive en Mi
Cuenta (`#descargar`) y el aviso de cuenta congelada la señala.

Vive bajo `/api/account/` **a propósito**: es uno de los prefijos de `RUTAS_DE_CUENTA_CONGELADA`,
así que una cuenta congelada llega sin pagar. Sólo el dueño (`account` es OWNER_ONLY y además se
revisa `isOwner`: saca TODOS los expedientes).

**Los CFDI NO van en el zip** — decisión del usuario, 2026-09-20: lo que se lleva es el
EXPEDIENTE, no la contabilidad. Traerlos obligaba a bajar de Facturama, en serie y sin tope, el XML
de cada factura que nadie hubiera descargado antes (`xmlContent` sólo se llena cuando alguien ya la
bajó) ⇒ decenas de segundos en UNA petición, y si el proxy la cortaba se perdía el zip **completo**.
Al quitarlos, armar el zip es **sólo lectura**: se fue también el `cfdiEmitted.update` que guardaba
el XML de vuelta. El XML sigue saliendo de Facturación, y el LEEME y la pantalla lo dicen.

**Lo que atraparon los reviews antes de que existiera en prod** (dos pasadas, `/code-review high`:
una sobre el código de la sesión anterior, otra sobre los arreglos de esa misma —**un arreglo salido
de un review no viene bendecido**, y así fue: el tercer punto de abajo es un hoyo que dejó mi propio
arreglo):

- **Una receta de PLANTILLA no tiene NI UN renglón de medicamento** (sus valores viven en
  `customData`; el include no traía `template`): salía con fecha, paciente, estatus y la columna
  «Medicamentos» **vacía**. En prod eran **25 de las 33 recetas** de `dr-david-salazar-vela`, la
  cuenta más grande. Para un feature que promete «todo lo que capturaste» y cuyo usuario principal
  es quien se está yendo, eso es pérdida silenciosa.
- **`MedicalReport.answers` guarda `{value,source,origin}`, nunca el valor suelto**: cada renglón
  del informe se imprimía como el JSON entero contra su clave interna, y los cientos de blancos
  declarados (`origin:'empty'`) no los podía tirar el filtro de vacíos — su JSON no es cadena vacía.
- **La sección vivía dentro de `{resumen && …}`** mientras el aviso de congelada dice «descarga tu
  información, más abajo»: si fallaba la lectura del resumen, la frase apuntaba a nada, en la única
  pantalla que le queda a quien no paga. Al sacarla, `congeladaDesde` seguía viniendo de
  `resumen?.… ?? null` ⇒ un null que significa «no sé» se veía **idéntico** a «no está congelada» y
  la frase de retención desaparecía sin que nada lo dijera. Por eso existe `estadoDesconocido`.
- **`adjuntos.csv` decía ser la lista de archivos y sólo traía `patientMedia`**: la foto del
  paciente (`photoUrl`) y su Constancia de Situación Fiscal (`constanciaFiscalUrl`) quedaban fuera.
  El único artefacto cuyo trabajo es decir qué tienes guardado afirmaba que no existen.
- **Inyección de fórmulas en CSV**: Excel ejecuta la celda que empieza con `=` o `@`, y el nombre,
  correo y notas de una cita los teclea un extraño en el formulario público de reservas. Se antepone
  `'` **sólo** en `=` y `@`: en `+` y `-` el apóstrofo es invisible en Excel pero un carácter de
  verdad en Google Sheets, y `+52 33 …` es un teléfono, no un ataque.

También de los reviews: las **tareas** no iban (se agregaron: son datos del doctor y no cuestan
nada); `esc(i.status)` imprimía «draft» en un documento por lo demás en español; y `porPaciente`
recopiaba el arreglo entero por renglón (cuadrático con miles de adjuntos).

**Cómo se verificó.** `armarExportacion` corrido **de verdad contra prod** (sólo lectura, método de
`TOOLING-acceso-railway-db.md`) para `dr-prueba` y `dr-david-salazar-vela`, y el resultado **contado
contra la BD**, no contra los contadores del propio script: 23/23 tareas, 7/7 adjuntos (6 media + 1
constancia). `grep '"origin"'` sobre todo lo exportado ⇒ nada. Ningún `(draft)`. Ningún apóstrofo en
ningún teléfono.

✅ **Probado con clic por el usuario (2026-09-20): la descarga funciona.** #6.3 queda CERRADO.

Se empujó a prod antes de ese clic, a decisión del usuario, con el botón y la descarga del blob sin
haberse ejecutado nunca. Salió bien; no siempre sale. Nota para quien lea esto después: la descarga
NO está atada a estar congelado —`account` es OWNER_ONLY y no tiene candado de tier, la ruta sólo
comprueba `isOwner`—, así que se prueba desde cualquier cuenta propia y en cualquier plan. Creer
que hacía falta congelar una cuenta fue justo lo que estuvo a punto de dejar la prueba sin hacer.

Sigue sin ejecutarse una sola rama: `estadoDesconocido` (la frase que aparece cuando falla la
lectura del resumen). Sólo se ve provocando un fallo de `/api/account/summary`.

### 12.9 As-built de #6.2b — la reserva pública de una cuenta congelada (2026-09-20)

**`d7d04b20` en prod** (api + public, ambos SUCCESS) y **probado de verdad**: se congeló
dr-quebradita a mano ~7 minutos, se corrió todo contra prod y se devolvió la cuenta a como estaba
(`tier BASICO`, `congelada_desde NULL`, 31 citas antes y 31 después).

**🎉 Con esto NO queda ningún 🔴.** Lo que bloquea pasar a modo vivo deja de ser funcionalidad
faltante y pasa a ser la decisión de las 10 cuentas PRO que no pagan (C4).

#### El agujero que cerró

Un paciente agendaba en la cuenta de un doctor CONGELADO y **recibía su SMS de confirmación**,
mientras el doctor no podía abrir la app para ver esa cita. Se disparaban además evento de Google
Calendar, SMS al doctor y Telegram. De todo lo que quedaba abierto, era lo ÚNICO que seguía
produciendo estado malo solo, sin que nadie hiciera nada.

#### Lo que se decidió (usuario, 2026-09-20)

| | Decisión | Por qué no la otra |
|---|---|---|
| Perfil público | **Se queda completo, sin agenda** | Ocultarlo (404) tira el SEO que el doctor construyó y rompe los enlaces que ya circulan, por algo que es entre él y nosotros |
| El texto | «Este doctor no está recibiendo citas en línea por ahora» + el teléfono | «No hay horarios disponibles» es falso de otra manera: el paciente entiende que está lleno y vuelve mañana. Y NO se dice el porqué: su situación de cobro no es asunto del paciente |
| El POST | **409, sin efectos** | Guardar la cita «en cuarentena» deja al paciente esperando una confirmación que no llega, y obliga a construir la pantalla donde el doctor las revisa |

#### Cómo quedó

- **Los CUATRO caminos que crean citas** (`bookings` · `range-bookings` · los dos `instant`)
  responden **409 `ACCOUNT_FROZEN` ANTES de crear nada** ⇒ ningún efecto secundario llega a
  ocurrir. En las dos rutas públicas el chequeo entra al `select` del doctor que ya se hacía (no
  cuesta una consulta más); en las `instant` usa `doctorCongelado()`.
- **Las `instant` también, y no por simetría:** un DOCTOR congelado ya rebotaba en
  `validateAuthToken`, pero un **ADMIN no** — el chequeo de congelada se salta con
  `role === 'ADMIN'` (`auth.ts`) — y creaba una cita **CONFIRMADA con SMS al paciente** en una
  agenda invisible. Lo encontró el review, contra un comentario que yo ya había escrito diciendo
  que la regla aplicaba «a cualquiera».
- **La bandera la lee el WIDGET, no la página que lo hospeda.** Primero se pasó como prop desde
  `DoctorProfileClient`; el review encontró que el **blog** —dos páginas— monta los mismos widgets
  y se había quedado fuera, pintando «No hay citas disponibles», que es justo la frase falsa que
  este trabajo venía a evitar. Preguntando dentro del widget, cualquier página futura queda
  cubierta sola.

#### 🔒 Una fuga viva que apareció en el camino

`congeladaDesde` se estaba sirviendo a **cualquiera** en `GET /api/doctors` y `/api/doctors/[slug]`
—la fecha exacta en que la cuenta de un doctor se congeló por no pagar— mientras `tier`, el mismo
tipo de dato, sí estaba excluido. Pública desde que nació la columna (#6.2, 2026-09-18).

- **Exposición real: ninguna.** Se midió: hoy hay **0** cuentas congeladas, y en esos dos días la
  única que lo estuvo fue dr-quebradita, minutos, probando #6.2. El campo valió `null` para todos
  los doctores de verdad todo el tiempo. **No hay nada que rotar** (a diferencia de `faa7e829`).
- **Por qué el gate no la atrapó:** su `SENSITIVE_PATTERN` era una lista de palabras en INGLÉS más
  `tier`, y las columnas de negocio de este repo se nombran en español. Ahora conoce
  `congelad|pagado|suscripcion|cobro|facturacion`. **Probado en negativo**: sacando el campo de
  `DOCTOR_PRIVATE_FIELDS`, el gate FALLA.
- En su lugar se sirve **`aceptaCitasEnLinea`**, booleano DERIVADO: si puedes agendar, nunca por qué
  no. Está duplicado el tipo `DoctorProfile` (`packages/types` y `apps/public/src/types`) — el
  campo hay que ponerlo en los dos o el type-check truena en uno solo.

#### Lo probado, con lo que devolvió

| Qué | Resultado |
|---|---|
| `GET /api/doctors/dr-quebradita` | `congeladaDesde` **ausente** · `aceptaCitasEnLinea: false` |
| `GET /availability` · `/range-availability` | `aceptaCitasEnLinea: false`, 0 fechas, 0 slots |
| `POST /range-bookings` (anónimo) | **409** `ACCOUNT_FROZEN` · citas **31 → 31** |
| Perfil público | la tarjeta, renderizada en el servidor |
| **Blog** | la tarjeta (la superficie que encontró el review) |
| Clic en «Agendar Cita» | el modal abre **con la tarjeta**, no con el formulario |

#### Pendiente, cosmético (visto en la prueba, NO arreglado)

La rejilla del calendario se sigue pintando arriba de la tarjeta, en gris y con todos los días
deshabilitados, bajo el encabezado «Reserva tu Cita — Selecciona fecha y hora»; y los botones
siguen diciendo «Agendar Cita» (el clic explica, no lleva a un formulario condenado). No es un
error: es que la página dice dos cosas a la vez.


### 12.10 As-built de #7a — «quiero bajarme de plan» (2026-09-20)

**`80d23415` en prod** (api · doctor · admin). Cierra el último hueco del flujo del dinero:
**subir** ya funcionaba y cobraba, pero un doctor **no podía escoger un plan más barato** — sólo
bajaba dejando de pagar 15 días (#6.1) o a mano desde el admin, sin haberlo pedido.

**Esto NO es #7.** Es la versión corta que decidió el usuario: con 12 doctores, una bandeja basta.
Prorrateo, baja agendada a fin de periodo, webhook y «cancelar el cambio» siguen sin construirse
(#7b). Cuando se construyan, esta tabla es su bandeja de entrada o se retira.

#### Cómo quedó

- **Mi Cuenta**: un selector con los planes **por debajo** del suyo y «Solicitar cambio». Si no
  cabe (R4) se le dice **antes** de mandar nada, con el texto que ya devuelve `cabeEnPlan()` —que
  trae los números: «Tienes 312 pacientes activos y Básico permite 200. Archiva 112…»—. Ya enviada,
  ve la solicitud con su fecha y puede cancelarla.
- **El admin** ve la bandeja arriba de la pantalla Cobro, con las que **no caben** marcadas en
  ámbar, y **los dos pasos escritos al lado**:
  1. cambiar la **suscripción en Stripe** al precio del plan nuevo;
  2. cambiar el plan del doctor en «Doctores».

  Hacer sólo el 2 deja al doctor con el plan menor **mientras Stripe le sigue cobrando el mayor**.
  No es hipotético: es el incidente del **2026-09-17**, donde se bajó en el admin un plan pagado
  hasta el 17 de octubre y la cuenta perdió el mes (`apps/admin/src/lib/aviso-cobro.ts` lo explica).
  Por eso el botón dice **«Marcar como hecha»** y no «Aplicar»: registra que un humano YA lo hizo,
  no ordena que pase.
- **Es una FILA, no un aviso.** `avisarAdmin()` hoy no manda nada (falta `TELEGRAM_ADMIN_CHAT_ID`),
  un mensaje se pierde, y el doctor necesita VER que su solicitud existe y poder cancelarla. Se
  llama igual, para que el día que se ponga la variable empiece a funcionar solo.
- **Sólo hacia ABAJO.** Subir ya funciona y cobra de verdad; ofrecer por aquí un camino peor al que
  ya existe sería empeorarlo.

#### La tabla

`public.solicitudes_cambio_plan` — SQL a mano (`add-solicitudes-cambio-plan.sql`), **aplicado a
prod ANTES del push** y leído de vuelta: 12 columnas, 3 índices, la FK, y
`prisma.solicitudCambioPlan.count()` respondiendo.

Guarda el veredicto de `cabeEnPlan()` **del momento en que se pidió**, en vez de recalcularlo: el
admin tiene que ver lo mismo que vio el doctor, que pudo haber archivado expedientes desde
entonces.

Su índice **único PARCIAL** (`WHERE estado = 'PENDIENTE'`) es el que impide que cinco clics dejen
cinco filas. Se comprobó de verdad, dentro de una transacción con rollback: la segunda pendiente
**rebota con 23505**. ⚠️ Un `prisma db push` **no** lo tira —Prisma sólo pisa lo que modela, y aquí
no se declara ningún unique sobre `doctor_id`—; lo que **sí** lo rompería es que alguien agregue
`@@unique([doctorId])` al modelo creyendo que documenta la regla: ese día el índice se reescribe
sin el `WHERE` y un doctor no podría pedir un segundo cambio nunca más.

#### Del review (8 hallazgos, los 8 arreglados) — los tres que valen

- **La bandeja podía tumbar la pantalla de Cobro entera.** Estaba dentro del mismo `Promise.all`
  que precios, doctores y suscripciones: entre el push y el SQL a mano hay una ventana en la que la
  tabla no existe, y en esa ventana moría **la pantalla que existe justo para ver qué está mal
  configurado**, por culpa de lo más nuevo que tiene. Ahora va aparte y se traga su propio error.
- **Los fallos de «Marcar como hecha» eran INVISIBLES.** Reusé `errorGuardar`, que sólo se pinta
  dentro de la fila de precios que se está editando. Un 409 —el doctor canceló mientras el admin
  tenía la pantalla abierta— no mostraba nada: clic, no pasa nada, clic otra vez, nada.
- **Un fallo de lectura se veía como «no tienes ninguna».** El GET devolvía `{solicitud:null}` con
  **200** ante cualquier error, así que la pantalla pintaba el formulario, el doctor pedía otra vez
  y chocaba con un 409 sobre una solicitud **que no podía ver ni cancelar**. La misma trampa de
  siempre: un fallo que aterriza en el mismo vacío que un vacío legítimo.

#### 🔴 Falta el clic

Nadie ha usado el flujo. Probarlo es: pedir una baja con dr-quebradita (BÁSICO ⇒ puede pedir
GRATIS), verla aparecer en Cobro del admin, y cerrarla. **No hace falta congelar nada.**

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
