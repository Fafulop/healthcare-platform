# 💳 PLAN — la página **Cuenta** (doctor) y el **cobro de suscripciones** (admin)

> **Tipo: PLAN.** Escrito el **2026-09-14** contra el código real (cada afirmación lleva su
> archivo). **Nada de esto está en código todavía.** Al terminar cada PR se anota el as-built
> en §7 y se actualiza el `README` de esta carpeta.
>
> **Prerrequisito de lectura:** [`02-PLAN-cuatro-tiers.md`](02-PLAN-cuatro-tiers.md) §8.3 (el
> handoff de cierre del 2026-09-13: qué quedó en prod y qué quedó abierto) y
> [`01-DISENO-tecnico.md`](01-DISENO-tecnico.md) §1–§2 (un tier es un TECHO sobre
> `PermissionKey`, no un sistema nuevo).
>
> **Qué añade este plan al de cuatro tiers.** Aquel construyó el **techo** (qué puede hacer una
> cuenta). Éste construye las **dos caras del dinero** que ese techo nunca tuvo: la que **ve el
> doctor** (qué plan tengo, cuánto he consumido, cuánto debo, dónde pago) y la que **opera la
> empresa** (a quién le cobramos, con qué precio, en qué estado va cada suscripción).

---

## 0. Decisiones del usuario (2026-09-14)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿Qué lista de precios es la real: $550 de un solo plan, o FREE/149/299? | **Ninguna es final todavía.** ⇒ **ningún número de precio se escribe en el código** (§3.3) |
| 2 | ¿Cómo pagan los doctores? | **Pasarela real: Stripe Billing** (recomendación aceptada: el SDK, la verificación de firma de webhook y el plumbing de env ya existen en `apps/api`) |
| 3 | Si un doctor no paga, ¿qué le pasa a su tier? | **Nada automático.** El sistema marca *vencido* y avisa; **un humano** cambia el tier en `/doctors` |
| 4 | Cuando un doctor paga por el link, ¿su tier cambia solo? | **Sí — el pago confirmado sube el tier.** (Consecuencia obligada: **sube solo, baja a mano** — §2/H4) |

**Lo que este plan NO decide y va en §6:** si le emitimos **CFDI** al doctor por lo que nos paga
(la pregunta más cara de todas), si hay periodo de prueba, y qué pasa con la copia pública.

---

## 1. El punto de partida, medido (no supuesto)

### 1.1 Lo que ya existe y se reusa

| Pieza | Dónde | Qué aporta |
|---|---|---|
| `Doctor.tier` + `DOCTOR_TIERS`×4 + `TIER_LABELS` + `TIER_EXCLUDED_KEYS` + `TIER_LIMITS` | `packages/database/src/permissions.ts` | El vocabulario entero. `TIER_LABELS` ya separa el valor de BD del nombre comercial |
| Stripe **completo**: SDK `stripe ^22.1.0`, cliente tipado, webhook con **verificación de firma** y **11 tipos de evento** (cuentas, checkout, disputas, reembolsos, payouts) | `apps/api/package.json`, `apps/api/src/lib/stripe.ts`, `apps/api/src/app/api/stripe/webhook/route.ts` | El patrón de webhook ya está escrito y probado en vivo. **Ojo: todo apunta al revés** — §1.2 |
| `sendTelegramMessage` usado ya DENTRO del webhook de Stripe | `apps/api/src/lib/telegram.ts` | El canal de aviso al equipo, sin construir nada |
| Sesiones de **base de datos**: el tier se resuelve **fresco en cada request** | `packages/auth/src/nextauth-config.ts:92` | 🟢 **Un tier que cambia por webhook llega al doctor sin volver a entrar.** No hace falta invalidar sesiones |
| `usePermissions()` → `tier`, `isOwner`, `can`, `lockedByTier` | `apps/doctor/src/lib/permissions-client.ts` | La página Cuenta lee el plan del cliente sin endpoint nuevo |
| `assertPatientQuota` · `assertStorageQuota` · `maxPatientsFor` · `storageBytesFor` · tabla `StoredFile` | `permissions.ts`, schema | Los dos cupos ya se **imponen**; falta **mostrarlos** |
| Guard de downgrade por cupo (409 con números) | `apps/api/src/app/api/admin/doctor-tier/route.ts` | La única regla de negocio que hoy protege un cambio de tier |
| `requireAdminAuth` + el patrón de página del admin | `apps/api/src/lib/auth.ts`, `apps/admin/src/app/doctors/page.tsx` | El molde de la pantalla de control |

### 1.2 Lo que **no existe en absoluto**

- **Dinero que va DEL doctor A NOSOTROS.** Cero. No hay suscripción, ni periodo, ni monto, ni
  fecha de corte, ni estado de pago, ni recibo. `grep -i suscripci|subscription` sobre `apps` y
  `packages` devuelve **un solo acierto, ajeno** (`AgentContext.tsx`).
- 🔴 **Y todo lo que PARECE servir apunta al revés.** `Doctor.stripeAccountId`,
  `stripeChargesEnabled`, `stripePayoutsEnabled`, `mpAccessToken`, `mpConnected`, `PaymentLink`,
  `MpPaymentPreference`, `/api/stripe/connect/*`, `/api/mercadopago/*` son **el doctor cobrándole
  a sus pacientes**. Nada de eso es reutilizable, y confundir las dos direcciones es el error más
  caro disponible aquí: `stripeAccountId` (una cuenta Connect a la que **pagamos**) va a quedar
  en el mismo modelo que un `stripeCustomerId` nuevo (a quien **cobramos**). Que los dos campos
  se toquen en el schema es razón suficiente para nombrar la trampa en el código.
- **La empresa como entidad.** No hay modelo de organización. El único ajuste global es
  `SystemSetting`, una tabla llave/valor `VarChar(500)` con **una sola fila** (`sms_enabled`,
  `apps/api/src/app/api/settings/route.ts`). No alcanza para la identidad fiscal de la empresa.
- **`/dashboard/cuenta`.** No existe ninguna página de plan: `TierUpgradeNotice` es lo que se
  pinta **en lugar** de una sección bloqueada, no un lugar al que se pueda ir.
- **Medidor de almacenamiento.** Es el **hueco #1** del handoff de Q4 (§8.3 de 02-PLAN).
- **MercadoPago para suscripciones.** Lo que hay es un marketplace OAuth escrito a mano
  (`apps/api/src/lib/mercadopago.ts`: cifrado AES-GCM, `mpFetch`, verificación HMAC). El
  preapproval/suscripciones sería de cero, con un segundo webhook. Es la mitad del argumento de
  la decisión 2.

---

## 2. Los nueve huecos (la parte cara, y la razón de que este doc exista)

> Los cinco primeros salieron de **buscar huecos en el análisis inicial**, no de leer el plan
> anterior. Dos de ellos habrían roto el primer PR, y dos son **afirmaciones falsas en los docs
> de esta misma carpeta**.

### H1 — 🔴 «Derivarlo de `TIER_EXCLUDED_KEYS`» **no sirve** para una lista que ve el doctor

Era la idea central del análisis inicial: no escribir la lista de funciones a mano, derivarla de
la constante. **Es incorrecto**, y se ve al mirar los tres sistemas de visibilidad que hoy
conviven, cada uno con su dueño:

| Sistema | Dónde | Qué apaga |
|---|---|---|
| `TIER_EXCLUDED_KEYS` | `permissions.ts:207` | Lo que el **plan** no incluye |
| `ui-visibility.ts` | `apps/doctor/src/lib/ui-visibility.ts` | Lo que el **producto** decidió esconder |
| `ASISTENTE_IA_VISIBLE` | `lib/agenda-agent/feature-flag.ts` | El panel 🟢, para **todos** |

Con el contenido REAL de hoy —`FREE: ['facturacion','sat','conciliacion','ia']` ·
`BASICO: ['ia']` · `PRO: []` · `LAB: []`— una lista derivada le diría al doctor cuatro cosas
falsas o absurdas:

1. A un FREE: «tu plan no incluye **Conciliación Bancaria**» — una función que **nadie puede
   ver desde el 2026-08-27** (`CONCILIACION_BANCARIA_VISIBLE = false`). Le vendemos el upgrade
   a una puerta tapiada.
2. A un BÁSICO: que **sí** tiene conciliación — porque su exclusión está **diferida** hasta que
   BASICO tenga sus propios evals (02-PLAN §8, hallazgo 1 del review). El código dice una cosa y
   el plan comercial otra.
3. A un PRO: «tu plan lo incluye **todo**» — falso: el asistente 🟢 está tapado por flag y
   `asistente_ia` no se excluye en ningún tier hasta **Q5**, así que **PRO y LAB salen
   idénticos**.
4. A todos: **`whatsapp` no aparece nunca** (está fuera de todas las listas a propósito, porque
   no existe ninguna ruta suya y `gate:routes` fallaría) ⇒ se lee como **incluido** una función
   que **no existe** y que depende de una aprobación de Meta.

**Es exactamente la clase de error que este repo ya pagó:** derivar *qué campos existen* no
contesta *cuáles son del agente*. Aquí, derivar *qué keys excluye el techo* no contesta *qué
compro por mi dinero*.

**Cierre:** un **catálogo curado** (§3.5) — una lista explícita, en palabras de producto, de lo
que se le anuncia al doctor— **más un gate** que verifique que cada entrada del catálogo sigue
correspondiendo a una key real y que ninguna key excluida se quedó sin entrada. Derivado no;
verificado sí.

### H2 — 🔴 El tier iba a tener **dos caminos de escritura**, y el guard vive en uno solo

`apps/api/src/app/api/admin/doctor-tier/route.ts` abre con esto, en su cabecera:

> *This is the ONLY write path for the tier, deliberately separate from `PUT /api/doctors/[slug]`*

Un webhook que escriba `Doctor.tier` **vuelve falsa esa frase** y, peor, **se salta el guard de
cupo de Q3** que vive ahí dentro y en ningún otro lado. Para la dirección *subir* da igual (los
topes crecen); para cualquier movimiento hacia abajo —cambio de plan desde el portal de Stripe,
reversión de un pago, un `subscription.updated` con otro price— el guard simplemente **no
corre**, y aparece una cuenta por encima de su cupo que el admin declara imposible.

**Cierre:** un helper único `setDoctorTier()` en `@healthcare/database` que **sea dueño del
guard, del log de auditoría y de la validación de case canónico**; el admin y el webhook lo
llaman los dos. La frase de la cabecera se reescribe para decir la verdad nueva.

### H3 — No hay **rastro** de un cambio de tier

La trazabilidad de hoy es un `console.log('[TIERS] tier changed', …)`. Para un cambio manual y
raro alcanzaba. Para un cambio **automático movido por dinero** no: «pagué y no pasó nada» o
«¿por qué me bajaron?» son preguntas que se contestan con una **fila**, no con logs de Railway
que rotan. **Cierre:** tabla de eventos de suscripción/tier (§3.2), escrita por `setDoctorTier`.

### H4 — El pago sube el tier, pero **nada puede bajarlo solo**

Decisión 4 (sube solo) y decisión 3 (baja a mano) encajan, pero hay que decirlo explícito porque
el cliente de Stripe ofrece lo contrario de fábrica: **el portal de Stripe deja al cliente
cambiar de plan**. Si se habilita, Stripe afirmará «este doctor es BÁSICO» mientras nuestro
guard rechaza el cambio ⇒ **dos sistemas con techos distintos, y pareciendo que funciona** — el
peor modo de fallo de esta feature, ya documentado dos veces en esta carpeta.

**Cierre:** en v1 el portal de cliente va **sin cambio de plan** (solo método de pago y
recibos). Checkout **solo sube**. Todo lo que baja pasa por el admin.

### H5 — El medidor dirá un número **correcto para el cobro y falso sobre la realidad**

`stored_files` **no tiene backfill** (decisión del 2026-09-13: se cuenta de hoy en adelante) y
**nada borra sus filas** (deuda abierta en §8.2/§8.3 de 02-PLAN). O sea:

- El número que muestre el medidor es **el mismo que rechaza la subida** — eso está bien, y es lo
  único que importa para que el doctor pueda verificar el rechazo.
- Pero **no es lo que pesa su bucket** (el barrido del 2026-09-13 midió **489.5 MB reales**
  contra ~0 filas apuntadas), y **solo puede subir**: borrar archivos en la app no lo baja.

Para PRO (50 GB) es inocuo. Para **FREE (500 MB) es un muro sin salida**, y enseñarlo es
precisamente lo que hace visible la deuda. **Cierre:** el medidor se construye (es el hueco #1
del handoff), pero **con copia explícita** sobre qué cuenta y desde cuándo, y **C1 no promete
una salida que no existe** (el mensaje de rechazo ya dejó de prometerla: hallazgo 4 del review de
Q4). Contabilizar el borrado es su propio trabajo, anotado en §6.

### H6 — Toda ruta nueva **tiene que clasificarse o `pnpm gates` falla**

`scripts/check-route-permission-coverage.ts` recorre **todo** `route.ts` de `apps/api` y
`apps/doctor` y falla en el primero que no esté en `ROUTE_PERMISSION_MAP`,
`UNMAPPED_PUBLIC_PREFIXES` o la allowlist. Además `checkRoutePermission` es **fail-closed** para
members. Consecuencias concretas para este plan:

- Las rutas de Cuenta/billing van con **`key: 'OWNER_ONLY'`**. No es sólo para que un **member no
  vea la facturación de su jefe** (que también): es que `nearestFeatureKey` **se salta**
  OWNER_ONLY salvo que lleve `feature`, así que OWNER_ONLY es justo lo que garantiza que **la
  página de plan nunca quede bloqueada por el plan**. Una key de función ahí sería una trampa
  circular: el FREE no podría llegar a la pantalla que le vende el upgrade.
- El **webhook de suscripciones es público** (lo llama Stripe) ⇒ entra a
  `UNMAPPED_PUBLIC_PREFIXES`, junto a `stripe/webhook`, y su frontera es la **firma**, no la
  sesión.
- La página `/dashboard/cuenta` **no** va en `PAGE_PERMISSION_MAP` (las no listadas no se gatean
  del lado del cliente — está escrito en el propio mapa), que es lo que queremos.

### H7 — Dónde vive cada endpoint no es libre: `apps/doctor` **no tiene** `stripe`

`apps/doctor/package.json` no declara `stripe`. Meterlo ahí es un cambio de dependencia ⇒
**regenerar `pnpm-lock.yaml` en el MISMO commit** o Railway falla el build con frozen lockfile
(trampa ya pagada en vivo). Y `apps/api` ya tiene el SDK, el patrón de webhook, `requireAdminAuth`
y Telegram. **Cierre:** **todo lo de Stripe vive en `apps/api`**; el doctor-app solo consume por
`NEXT_PUBLIC_API_URL`, como ya hace para otras cosas. Cero dependencias nuevas.

### H8 — Dos afirmaciones **falsas** en los docs de esta carpeta

02-PLAN §8 (hallazgo 7) y §9.8 dicen que **`/producto` sigue vendiendo FULL/CORE**. Medido hoy:

- **`/producto` ya no existe** — no hay tal ruta en `apps/public/src/app/`.
- La home vende **UN plan, $550 + IVA**, con 2 semanas de prueba, 30 facturas incluidas y $1 por
  cada extra (`apps/public/src/lib/product-content.ts`, reescrito el 2026-08-17; el propio
  archivo advierte que la divergencia con `TIER_EXCLUDED_KEYS` es deliberada y que el siguiente
  que pase **no debe «arreglarla»**).
- Y el precio se pinta también en la **imagen Open Graph** (`apps/public/src/app/og/route.tsx`),
  o sea que ya son **dos superficies públicas**, no una.

Una página Cuenta con un precio sería la **tercera**. Es el argumento entero de §3.3.

### H9 — El agente va a recibir la pregunta

`prompt.ts` ya tiene `TIER_SCOPE_NOTE` («esa función no está incluida en el plan de esta
cuenta»). En cuanto exista una sección Cuenta, alguien le va a preguntar al asistente **«¿cuánto
debo?»** o **«¿qué plan tengo?»**. No tiene tool para eso, y un veredicto de negocio inventado es
exactamente lo que la **regla 0** prohíbe. **Cierre:** decisión explícita en C3 (declinar y
enrutar a la sección, que para entonces ya existirá y `gate:prosa` la aceptará) — **no** una tool
de dinero en v1. Y lo que se toque del agente se escribe en `../AGENTES/`, no aquí.

---

## 3. Diseño

### 3.1 Dónde vive cada pieza

| Pieza | App | Por qué |
|---|---|---|
| Página `/dashboard/cuenta` + entradas de navegación | `apps/doctor` | Es la UI del doctor |
| `GET /api/account/summary` (plan + cupos usados) | `apps/doctor` | Solo lee Prisma; sin Stripe |
| `POST /api/billing/checkout` · `GET /api/billing/status` · portal de cliente | **`apps/api`** | Es donde vive `stripe` (H7) |
| `POST /api/stripe/subscription-webhook` | **`apps/api`** | Ruta **separada**, con su propio `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` (§3.6) |
| Pantalla de control de la empresa | `apps/admin` | Junto a `/doctors`, que ya escribe el tier |
| `setDoctorTier()`, modelos, catálogo | `packages/database` | Fuente única, la comparten las tres apps |

⚠️ Todo commit que toque `packages/database` **no dispara ningún watchPattern**: hay que tocar un
archivo **dentro de** `apps/api` y `apps/admin` para que las tres apps queden en el mismo hash.

### 3.2 Los modelos nuevos (SQL manual, `prisma db execute`, **nunca** `db push`)

```
Subscription          1–1 con Doctor
  doctorId · stripeCustomerId · stripeSubscriptionId · stripePriceId
  status (activa · por_vencer · vencida · cancelada · sin_suscripcion)
  currentPeriodEnd · cancelAtPeriodEnd · lastPaymentAt · createdAt/updatedAt

TierPrice             el mapa tier ↔ precio de Stripe (§3.3)
  tier · stripePriceId · activo · notaInterna
  (LAB puede no tener fila: no se vende)

TierChangeLog         el rastro que H3 pide
  doctorId · from · to · origen (admin | webhook | script) · actor
  · stripeEventId · motivo · createdAt
```

`stripeCustomerId` va **en `Subscription`, no en `Doctor`** — a propósito, para que no quede
pegado a `stripeAccountId` y nadie los confunda leyendo el modelo (H1.2 de §1.2).

### 3.3 🔴 El precio **no se escribe en el código**. Nunca.

Hoy el número vive en `product-content.ts` y se pinta en dos superficies públicas (H8). La lista
comercial **no está decidida** (decisión 1). Así que:

- **El monto es del objeto Price de Stripe.** Nuestra BD guarda el `stripePriceId` y nada más.
- **Lo que se muestra** (monto, moneda, periodicidad) **se lee de Stripe**, cacheado; no se
  teclea en ningún `.ts`.
- **El admin edita el mapa `tier ↔ priceId`**, y esa pantalla es el único lugar donde alguien
  decide qué cuesta un plan.
- Cambiar precios = crear un Price nuevo en Stripe y re-apuntar el mapa. Cero deploys.
- La copia pública ($550) **no se toca en este plan**: es la decisión 1, todavía abierta, y
  arreglarla antes de tenerla sería inventar (§6).

### 3.4 `setDoctorTier()` — un solo camino de escritura

Firma conceptual: `setDoctorTier({ db, doctorId, tier, origen, actor, stripeEventId?, motivo? })`.

Es dueño de las cuatro cosas, para que ningún llamador pueda saltárselas:

1. **Case canónico** validado contra `DOCTOR_TIERS` y **rechazo** (no normalización) — el
   requisito duro que ya existe, con su razón: un `free` guardado se comporta como PRO mientras
   la UI dice FREE.
2. **Guard de cupo** en cualquier movimiento a la baja (hoy pacientes; mañana lo que haya).
3. **Escritura de `TierChangeLog`** en la misma transacción que el `update`.
4. **Idempotencia**: mismo `stripeEventId` dos veces ⇒ una sola fila, un solo cambio.

`admin/doctor-tier/route.ts` pasa a llamarlo (y su cabecera se corrige, H2).

### 3.5 El catálogo curado (el cierre de H1)

Un archivo nuevo en `packages/database` con la lista **explícita** de lo que se le anuncia a un
doctor: por entrada, la `TierKey` a la que corresponde, el texto de producto, y **si hoy es
anunciable** (`conciliacion` no lo es mientras `ui-visibility` la tape; `whatsapp` no lo es
mientras no exista; `asistente_ia` no lo es hasta Q5).

Y un gate —`gate:catalogo`, sexto— que falle si:

- una key excluida por **algún** tier **no** tiene entrada en el catálogo (se le oculta al doctor
  algo por lo que se le cobra), **o**
- una entrada anunciable nombra una key que **ningún** tier distingue (se anuncia como
  diferencial algo que todos tienen), **o**
- una entrada anunciable apunta a una función tapada por `ui-visibility` / un feature flag.

Así la lista es de producto, pero **no puede mentir en silencio**: es escrita a mano y
**verificada por máquina**, que es la única combinación que aguanta el siguiente tier.

### 3.6 El webhook: ruta y secreto **propios**

El `/api/stripe/webhook` actual es de Connect. Su rama `checkout.session.completed` está
protegida por `session.payment_link`, así que un evento de suscripción **hoy caería sin hacer
nada** — no explota, pero mezclar *dinero que el doctor recibe* con *dinero que el doctor debe*
en un mismo `switch` es justo el acoplamiento que esta carpeta ya documentó dos veces. Ruta nueva,
secreto nuevo, y las reglas de siempre: **verificar firma antes de leer el body**, tratar cada
evento como **reintentable y posiblemente fuera de orden** (se ignora un evento más viejo que el
`currentPeriodEnd` guardado), y **avisar por Telegram** lo que necesita un humano (pago fallido,
cancelación, y cualquier cuenta que quede pagando de más).

Eventos: `checkout.session.completed` (modo suscripción) · `invoice.paid` ·
`invoice.payment_failed` · `customer.subscription.updated` · `customer.subscription.deleted`.

### 3.7 Seguridad del checkout

La lección del review de Q4 —el router de subidas del admin dejaba **elegir a quién
cobrárselo**— aplica literal: **el cliente no manda ni `doctorId` ni `priceId`**. El servidor
resuelve el doctor **de la sesión** (y exige `isOwner`), y el `priceId` **del mapa `TierPrice`**.
Lo único que viaja del cliente es a qué tier quiere subir.

---

## 4. Secuencia de PRs

> Cada PR: `pnpm type-check` (api con `NODE_OPTIONS=--max-old-space-size=6144`) · `pnpm gates` ·
> smoke read-only contra prod de toda forma de query nueva · **code review ANTES del commit** ·
> comprobaciones **ejecutadas** (no leídas) · y el runbook con ojos humanos, que es lo único que
> prueba que alguien lo VE.

| PR | Qué | Muerde en deploy | Riesgo |
|---|---|---|---|
| **C1 — Cuenta, solo lectura** | La página, el catálogo curado + `gate:catalogo`, el **medidor de almacenamiento** (hueco #1 de Q4) y el contador de pacientes, `GET /api/account/summary`, entradas de navegación (escritorio **y** móvil), CTA de contacto | No: no hay dinero en ningún lado | **Bajo.** Su parte difícil es H1, no el código |
| **C2 — el modelo y la pantalla de la empresa** | `Subscription` · `TierPrice` · `TierChangeLog` (SQL **antes** del deploy), `setDoctorTier()` y el admin llamándolo, pantalla de control: mapa tier↔priceId, estado por doctor, override manual | No: nadie cobra todavía | **Medio:** H2 cambia un camino que ya está en prod |
| **C3 — cobrar de verdad** | Checkout (modo suscripción), portal de cliente **sin cambio de plan** (H4), webhook nuevo, **el flip automático del tier al pagar**, estado + fecha de corte + botón de pago en Cuenta, avisos por Telegram, decisión del agente (H9) | **Sí. Es el que muerde** | **Alto** |
| **C4 — reconciliación** | Job/acción de admin que compara Stripe contra `Doctor.tier` y **reporta divergencias** (no las arregla solo) | — | Bajo, y es la red de C3 |

**C1 es independiente de todo el dinero** y se puede empezar hoy: no depende de la lista de
precios, ni del CFDI, ni de Stripe. C2 y C3 dependen de §6.

**Banco de pruebas, ya listo:** **dr-prueba está en `FREE`** y **dr-quebradita en `BASICO`** a
propósito (02-PLAN §8). Y la regla que esa misma prueba dejó: **leer el estado de la BD DESPUÉS
del runbook, no solo antes.**

---

## 5. Trampas de este repo que aplican tal cual

- **SQL primero, código después.** Q4 lo hizo al revés y se salvó por un fail-open que entró en
  el review el mismo día. Aquí hay tres tablas nuevas: el orden no es negociable.
- **`packages/database` no dispara ningún watchPattern** ⇒ tocar un archivo dentro de `apps/api`
  y `apps/admin`, y **verificar el `commitHash` por servicio**. Dos apps aplicando techos
  distintos *parece* que funciona.
- **Ninguna lista cerrada se cree sin contarla.** Van cinco falsas en esta carpeta (los prefijos
  de IA eran 12, no 11; los caminos de alta 3, no 2; «14 rutas» eran 17 keys en 33 definiciones;
  4 archivos que suben eran 19). Las listas de este plan —eventos de webhook, superficies de
  precio, puertas de navegación— **se cuentan, no se heredan**.
- **Un `[]` no es una respuesta.** `Subscription` vacío significará «nadie ha pagado» o «el
  webhook no escribe», y son indistinguibles sin contrastar contra Stripe. C4 existe por esto.
- **Un arreglo que no viste EJECUTARSE no está arreglado**, y **un contador cuenta lo que se
  intentó, no lo que salió**: el flip de tier se prueba mirando la fila de `TierChangeLog`, no el
  200 del webhook.
- **`NEXT_PUBLIC_SALES_EMAIL` sigue sin ponerse en Railway** (pendiente desde julio, reverificado
  el 2026-09-13): hoy el candado de IA y la pantalla de plan se pintan **sin CTA**. C1 lo vuelve
  casi irrelevante (habrá una página de verdad a donde ir), pero mientras no exista, el producto
  no tiene salida de upgrade.

---

## 6. Decisiones que bloquean (no inventar)

1. 🔴 **¿Le emitimos CFDI al doctor por lo que nos paga?** En México, cobrar $X + IVA obliga a
   facturar. La plataforma tiene toda la maquinaria de CFDI (`CfdiEmitted`, `DoctorFiscalProfile`,
   el módulo de facturación) pero construida para **el CSD del doctor emitiéndole a sus
   pacientes**. Que **nosotros** le emitamos a **él** necesita nuestro RFC, régimen y CSD propios
   —la «configuración de nuestra cuenta como empresa»— más recolectar los datos fiscales de cada
   doctor. **Duplica largo el alcance de C2** y decide si `SystemSetting` alcanza o hace falta un
   modelo de empresa. *Es la pregunta que hay que contestar antes de C2.*
2. **¿Periodo de prueba?** La home promete **2 semanas sin tarjeta**. Stripe lo soporta nativo,
   pero hay que decidir si sigue vigente y si un trial vencido baja el tier (contra la decisión 3,
   que dice que nada baja solo).
3. **La lista de precios y la copia pública.** Mientras no se decida, §3.3 mantiene el código
   limpio de números; pero la home seguirá diciendo $550 y la imagen OG también.
4. **Contabilizar el borrado de archivos.** Hoy nada baja `stored_files`; con medidor a la vista,
   un FREE en el tope no tiene salida (H5). ¿Se construye el descuento al borrar, o se asume y se
   explica?
5. **¿Ve un member la página Cuenta?** Propuesta: **no** (OWNER_ONLY). Sin ella, un helper que
   choque con un candado no tiene a dónde ir; con ella, ve el dinero de su jefe.
6. **Qué pasa con una cuenta cancelada que sigue en PRO** hasta que un humano actúe (decisión 3).
   ¿Aviso a los cuántos días? ¿A quién?

---

## 7. As-built

### C2 — el modelo de cobro y la pantalla de la empresa (2026-09-14)

**Esta vez el orden fue el correcto: el SQL llegó a la BD ANTES que el código** (la checklist de
`database-architecture.md`, nacida del incidente de ventas del 2026-02-19). Q4 lo hizo al revés y
se salvó de suerte; aquí no hizo falta suerte.

| Qué | Dónde |
|---|---|
| `TierPrice` · `Subscription` · `TierChangeLog` | `schema.prisma` + `prisma/migrations/add-billing-tables.sql` |
| `setDoctorTier()` — el único camino de escritura del tier | `packages/database/src/tier-change.ts` (nuevo) |
| La ruta del admin refactorizada para llamarlo | `apps/api/src/app/api/admin/doctor-tier/route.ts` |
| `GET`/`PATCH /api/admin/billing` | `apps/api/src/app/api/admin/billing/route.ts` (nuevo) |
| La pantalla «Cobro» + su entrada en el menú | `apps/admin/src/app/billing/page.tsx`, `Navbar.tsx` |

**Las decisiones que quedaron en código:**

1. **El monto NO se guarda.** `TierPrice` sólo tiene el `stripePriceId`; el GET **lee el monto de
   Stripe** en cada carga. Cambiar un precio es crear un Price nuevo y re-apuntar el mapa: cero
   deploys, y ningún número en nuestra BD puede contradecir al que se le cobra a la tarjeta.
2. **El price id se valida contra Stripe ANTES de guardarlo** (que exista, que sea recurrente,
   que no esté archivado). Es la diferencia entre enterarse al pegarlo y enterarse en el primer
   cobro real.
3. **`stripeCustomerId` vive en `Subscription`, no en `Doctor`** — para que no quede junto a
   `stripeAccountId`, que es la dirección contraria del dinero.
4. **El status es el de Stripe, literal** (`active`, `past_due`…). Traducirlo crearía un segundo
   vocabulario que puede contradecir al primero; las etiquetas en español son sólo de pantalla.
5. **Un índice único PARCIAL** (`WHERE activo`) impide dos precios activos por tier y a la vez
   deja conservar el historial de los viejos. Prisma no lo modela ⇒ anotado en
   `database-architecture.md` §6.

**Verificación:**

- **La migración, verificada contra prod DESPUÉS de aplicarla**: las 3 tablas con sus columnas,
  **12 índices** —incluido el parcial—, las 2 FK con `ON DELETE CASCADE`, y 0 filas.
- 🔴 **El índice parcial se probó EJECUTÁNDOLO** (transacción con rollback): rechaza el segundo
  precio activo de PRO con `23505 Key (tier)=(PRO) already exists`, y **sí** permite un precio
  viejo inactivo junto al activo. *(El script imprimió «error inesperado» junto a su propia
  prueba: el matcher de texto era más estrecho que el mensaje real de Postgres. La restricción
  estaba bien; la prueba, mal escrita.)*
- `pnpm gates` **77 OK / 0 FAIL** (250 rutas; la nueva la cubre la regla `admin` ⇒ OWNER_ONLY, sin
  regla nueva). `pnpm type-check` **5/5, 0 errores**.
- **23/23 comprobaciones de rama** de `setDoctorTier` con un cliente falso: case canónico
  rechazado y no normalizado (`free`, `PRO `, `constructor`…), no-op sin bitácora, **el guard de
  cupo corriendo para los TRES orígenes** (`admin`/`webhook`/`script`), la frontera exacta 50 pasa
  / 51 rechaza, subir de plan nunca lo dispara, idempotencia por evento, y un P2002 ajeno que **se
  propaga** en vez de tragarse como duplicado.
- 🔴 **10/10 contra la BASE DE VERDAD**, que es lo que un falso no puede probar: `dr-david`
  (**94 activos**) rechazado al bajarlo a FREE **sin mover su tier**; `dr-prueba` FREE→BASICO con
  su fila de bitácora escrita; y la idempotencia real —el mismo `evt_` pidiendo LAB la segunda vez
  **no movió nada**—. dr-prueba quedó restaurado en `FREE` y `tier_change_log` de vuelta en 0
  filas.
  *(El falso NO prueba la atomicidad: con Prisma, `doctor.update(...)` en forma de arreglo
  devuelve una PrismaPromise que no se ejecuta hasta que `$transaction` la recibe, y en un doble
  eso se ejecuta al construir el arreglo. Por eso existe el segundo script.)*

**Code review (`/code-review high`) — 5 hallazgos; SÓLO 3 son de C2.** La primera corrida murió
por el límite de sesión antes de producir nada y se re-lanzó; nada de lo de abajo salió de una
revisión propia disfrazada.

| # | Hallazgo | Qué se hizo |
|---|---|---|
| 3 | 🔴 **Un price se mudaba de tier en silencio.** El `upsert` iba por `stripePriceId` y su rama `update` reescribía `tier`; el `updateMany` sólo apagaba precios del tier DESTINO. Pegar el price activo de PRO en BÁSICO movía la fila y **dejaba a PRO sin precio**, con la ruta respondiendo éxito. (Lo encontré yo mismo justo antes de que el review lo reportara.) | Se rechaza con `PRICE_EN_OTRO_TIER` (409), nombrando el plan que ya lo usa. `tier` ya no se reescribe en el `update` |
| 4 | **Cada «Cambiar» borraba la nota interna**: la pantalla nunca manda `notaInterna`, la ruta la leía como `null` y la escribía | `undefined` = no tocar; sólo un valor explícito la cambia |
| 5 | Desplegar antes del SQL tumbaría cada cambio de tier (la bitácora va en la misma transacción) | **Ya estaba cubierto:** el SQL se aplicó y verificó antes de escribir código |

La escritura del mapa se **sacó de la ruta** a `fijarPrecioDeTier` (`packages/database/src/tier-price.ts`),
por la misma razón que `setDoctorTier`: la ruta también habla con Stripe, así que no se podía
ejecutar en una prueba. **20/20 contra la base de verdad** con ids falsos `price_tmp_c2_*`: el
price activo de PRO pegado en BÁSICO se **rechaza y PRO conserva su precio**; re-guardar sin nota
**no la borra**; cambiar el precio apaga el viejo (historial) y deja exactamente 1 activo; un price
viejo inactivo tampoco se muda; reactivarlo en su propio tier sí; un `null` explícito sí borra la
nota; y `pro` en minúsculas no escribe. `tier_prices` terminó de vuelta en 0 filas. Gates
**77 OK / 0 FAIL** y type-check **5/5, 0 errores** después de los arreglos.

🔎 **No ejecutado:** el parseo del body en la ruta (`Object.hasOwn(body, 'notaInterna')` ⇒
`undefined`). La regla está probada en el helper; que la ruta le pase `undefined` y no `null` se
verificó LEYENDO, no corriendo.

Los hallazgos **1 y 2 son del formato BBVA** (dos grupos de radio que mezclan respuestas
compatibles: discapacidad Sí/No + Parcial/Total, y los antecedentes gineco-obstétricos). No son de
TIERS y no entran en este commit; el #2 ya lo había reportado el review de C1.

**Lo que C2 NO hace:** no cobra, no hay checkout, no hay webhook, no mueve tiers por pago, no
emite CFDI. La sección de estado por doctor está **vacía para todos** y la pantalla lo **dice con
palabras** — una tabla en blanco se leería como «nadie paga» cuando significa «esto aún no está
conectado».

🔴 **Lo que NO está probado: los PÍXELES.** Nadie ha visto la pantalla `/billing`.

### C1 — la página Cuenta, solo lectura (2026-09-14) — EN PROD (`b22f5f3a`)

**Sin schema, sin migración, sin dependencia nueva.** La checklist de
`database-architecture.md` (schema → BD → código) **no aplica a C1**; aplica a C2/C3, que traen
tres tablas.

| Qué | Dónde |
|---|---|
| El catálogo curado + `catalogoAnunciable` / `planIncluye` / `keysQueDistinguenPlanes` | `packages/database/src/plan-catalog.ts` (nuevo) |
| `gate:catalogo`, el **sexto** gate | `scripts/check-plan-catalog.ts` (nuevo) + `package.json` |
| `{ prefix: 'account', key: 'OWNER_ONLY' }` | `route-permissions.ts` |
| `GET /api/account/summary` | `apps/doctor/src/app/api/account/summary/route.ts` (nuevo) |
| La página | `apps/doctor/src/app/dashboard/cuenta/page.tsx` (nueva) |
| Entrada «Mi Cuenta», sólo dueño, escritorio **y** teléfono | `Sidebar.tsx`, `MobileDrawer.tsx` |

**Las tres decisiones de diseño que no son de estilo:**

1. **La lista NO se deriva de `TIER_EXCLUDED_KEYS`.** La cabecera de `plan-catalog.ts` enumera
   las cuatro afirmaciones falsas que derivarla produce (§2/H1). Se escribe a mano y la ata
   `gate:catalogo`.
2. **La página no está en `PAGE_PERMISSION_MAP` y su ruta es `OWNER_ONLY`.** Las dos cosas
   juntas son lo que garantiza que un FREE pueda ABRIRLA: `nearestFeatureKey` se salta las
   reglas OWNER_ONLY sin `feature`, así que **ningún tier la alcanza**. Medido, no razonado
   (abajo).
3. **El medidor dice desde cuándo cuenta.** `stored_files` arrancó el 2026-09-13 sin backfill.

**Verificación** (toda leída del LOG, no del código de salida):

- `pnpm gates` **77 OK / 0 FAIL** (eran 76; el sexto gate suma uno). Reglas del route map 72 → 73.
- `pnpm type-check` **5/5, 0 errores**, con 3 cache misses en la primera corrida ⇒ `doctor`,
  `admin` y `database` se revisaron de verdad.
- **31/31 comprobaciones EJECUTADAS.** La que importa: `/api/account/summary` da
  `nearestFeatureKey === null` y `blocked: false` en **los cuatro tiers**, mientras
  `/api/facturacion` y `/api/encounter-chat` siguen bloqueadas en FREE. También: un member con
  TODOS los toggles encendidos da `owner_only`; `FREE` no incluye `[facturacion, sat, ia]`,
  `BASICO` no incluye `[ia]`, `PRO`/`LAB` no excluyen nada; y una línea multi-key con UNA sola
  key excluida deja de marcarse "incluido".
- 🔴 **El gate se hizo FALLAR a propósito, tres veces** (un gate que nadie vio disparar no es un
  gate): prendiendo `CONCILIACION_BANCARIA_VISIBLE` (2 fallos, los dos esperados), borrando una
  entrada del catálogo (`la key 'ayuda' no tiene entrada`), y con el comentario trampa del
  hallazgo 7. Revertido y verde después de cada una.
- **Smoke read-only contra prod** de las dos consultas de la ruta (que son, byte a byte, las que
  cobran en `assertPatientQuota` / `assertStorageQuota`): dr-prueba `FREE` **9 / 50 activos,
  13 KB / 500 MB**; y **6 filas en `stored_files` en total** para las 12 cuentas — o sea H5
  medido, no argumentado: el bucket real pesa 489.5 MB.

**Code review (`/code-review high`) — 8 hallazgos, de los cuales SÓLO DOS son de C1:**

| # | Hallazgo | Arreglo |
|---|---|---|
| 6 | **Un 403 permanente se pintaba como falla pasajera.** La página no está en `PAGE_PERMISSION_MAP` (para que ningún tier la bloquee), y eso significa que `PermissionGate` tampoco la gatea para un MEMBER: escribiendo la URL renderiza, el API responde 403 `PERMISSION_BLOCKED` —correctamente— y la UI le decía *"No pudimos leer tu cuenta, vuelve a cargar"*, o sea reintentar para siempre algo definitivo. Misma clase que el 403 de plan que salía como "No se pudo transcribir el audio" (Q2b #6) | Rama propia para `res.status === 403`. **Ejecutado:** `handleApiError(new Error('PERMISSION_BLOCKED'))` → **status 403**, body `{"error":"PERMISSION_BLOCKED"}`, que es justo por lo que ramifica la página |
| 7 | **El regex del gate leía la primera mención, no la declaración.** Un comentario como `// cuando ASISTENTE_IA_VISIBLE = true, …` —escrito ARRIBA de la declaración, que es donde se documentan estos flags— se leía como el valor real: el gate creería la función visible, la regla 4 exigiría quitarle su `noAnunciable`, y el catálogo empezaría a anunciar una puerta tapiada. El gate fallando **al revés** | Anclado a `^\s*export const <NAME>` con flag `m`. **Ejecutado sobre el archivo real con el comentario trampa: el regex viejo lee `true`, el nuevo lee `false`** |

Los otros seis (1–5 y 8) son de **trabajo ajeno que vive en el mismo working tree**: el formato
BBVA del informe médico y `scripts/demo-seed/`. Se reportaron al usuario aparte; **no son de
TIERS y no se tocaron aquí**.

⚠️ **Y una trampa de MÉTODO que casi invierte una conclusión.** Al querer demostrar el hallazgo 7
escribí el script de comparación con un heredoc `<<'EOF'`, y **las barras invertidas se
perdieron**: el regex quedó `^s*export const …` (sin `\`), los dos patrones devolvieron `null` y
por un momento pareció que **el gate no leía el flag en absoluto** — cuando el gate, corrido de
verdad, imprimía el valor correcto. La contradicción entre "mi prueba falla" y "el gate pasa" era
la prueba de que **la rota era mi prueba**. Se cerró imprimiendo `regex.source`. *Cuando el
experimento contradice al sistema que ya viste funcionar, sospecha del experimento primero — y un
heredoc no es un lugar seguro para escribir un regex.*

🔴 **Lo que NO está probado: los PÍXELES.** Nadie ha visto esta página renderizada. La lógica está
ejecutada; el navegador no (la extensión de Chrome no conecta en esta sesión: se empareja con una
cuenta de claude.ai y aquí se usa `ANTHROPIC_API_KEY`). **Runbook para el usuario**, con dr-prueba
ya en `FREE`:

1. Entrar como dr-prueba → «Mi Cuenta» debe aparecer en el menú lateral **y** en el de teléfono.
2. Plan **Gratis**; `9 / 50 activos` y `13 KB / 500 MB` (los números medidos hoy).
3. **Facturación, Descarga SAT y Funciones de IA** con candado y "no incluido"; todo lo demás
   con palomita. **Conciliación no debe aparecer en ninguna parte.**
4. Entrar como una cuenta PRO → sin candados, «Todo incluido», y los cupos sin tope.
5. Con un usuario secundario: la entrada del menú **no existe**; si escribe `/dashboard/cuenta` a
   mano debe ver *"Esta sección es sólo del titular de la cuenta"*, no un error rojo.

**Despliegue (cuando se apruebe):** toca `packages/database`, que **no dispara ningún
watchPattern**. `apps/doctor` se despliega solo (cambian sus propios archivos), pero `api` y
`admin` se quedarían con el bundle viejo del paquete. Hoy eso es inocuo —C1 no cambia ninguna
regla que `api` aplique: la ruta nueva vive en `doctor` y el catálogo no lo lee nadie más— pero
conviene dejarlos en el mismo hash por costumbre, no por necesidad.

---

*Relacionado: [`02-PLAN-cuatro-tiers.md`](02-PLAN-cuatro-tiers.md) (el techo que esto cobra) ·
[`01-DISENO-tecnico.md`](01-DISENO-tecnico.md) (la arquitectura de tiers) ·
[`../IMAGE MIGRATION/02-PLAN-migracion-a-r2.md`](../IMAGE%20MIGRATION/02-PLAN-migracion-a-r2.md)
(el mismo ledger de archivos que alimenta el medidor) ·
[`../NUEVOS USUARIOS/`](../NUEVOS%20USUARIOS/) (por qué las rutas de Cuenta van OWNER_ONLY).*
