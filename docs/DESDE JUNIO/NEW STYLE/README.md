# 🎨 NEW STYLE — la cara pública del producto

> **Qué es.** El sitio público (`apps/public`, dominio `tusalud.pro`) pasó de ser un
> placeholder de desarrollo a tener **una sola página de producto de verdad**: la home,
> dirigida a doctores. Su contenido lo dictó el usuario capacidad por capacidad
> (2026-08-01) y se reorganizó en torno al **recorrido del paciente** el 2026-08-17, no
> sale del código.
>
> 🔄 **Sesión nueva:** la receta visual y cómo ajustarla está en
> [`01-TECNICA-velvet-y-reveals.md`](01-TECNICA-velvet-y-reveals.md). Este archivo es el
> estado y las decisiones.

## Estado

| | Ruta | Commit | Estado |
|---|---|---|---|
| **Recorrido + un solo plan a $550 (2026-08-17)** | `/` | *(pendiente)* | 🟡 En local: type-check, 5 gates y build en verde; **falta verla con ojos** |
| **Consolidación en una página + copy del usuario** | `/` | `8ed5f6cf` | 🟢 En prod, verificada en vivo |
| **Home nueva (doctores)** | `/` | `e0019335` | 🟢 En prod, verificada en vivo |
| **Reveals al scroll** | ex-`/producto` | `a29cfe1e` | 🟢 En prod, verificada en vivo |
| **Textura velvet** | ex-`/producto` | `e906a16a` | 🟢 En prod, verificada en vivo |
| **Links rotos de la home** | `/` | `6601ccc8` | 🟢 En prod, verificada en vivo |

## Una sola página (antes eran dos)

`/` y `/producto` eran **resumen y detalle de lo mismo**: las dos importaban
`product-content.ts`, las dos recorrían las mismas capacidades y competían por la misma
búsqueda, con la home como copia con pérdida de la otra. Se fusionaron en `/` el 2026-08-01.

- **`/producto` es hoy un 308 permanente hacia `/`** (`next.config.ts`). Estaba indexada y
  enlazada desde fuera: redirigir hereda su autoridad, un 404 la tira.
- **Si la página vuelve a crecer de más, el siguiente corte NO es resumen/detalle otra vez**,
  sino por capacidad —`/producto/agenda`, `/producto/facturacion`—, que sí son búsquedas
  distintas y sí ganan SEO por su cuenta.

### La estructura de hoy (2026-08-17)

Hero → **EL RECORRIDO** → franja de **la promesa del dinero** → **índice** de las 9
capacidades → 9 **bandas** de capacidad → tira de **plataforma** → **precio** → FAQ → CTA.

#### El recorrido es la sección nueva, y es la que importa

Hasta el 2026-08-16 la página era un **catálogo**: decía qué módulos existen, nunca cómo se
ve un martes. La promesa —*captúralo una vez*— estaba repartida en tres bandas que jamás se
tocaban (agenda decía que el paciente agenda solo, dinero que el cobro se registra solo,
fiscal que la factura sale de la cita) y **armar el circuito quedaba de tarea del doctor**.

Ahora se cuenta como un hilo, en 7 pasos: cita → expediente → consulta → datos fiscales →
factura → cobro → flujo de dinero. **El remate es la vuelta (`JOURNEY_LOOP`)**: el argumento
no es que el primer paciente sea fácil, es que el segundo ya no tiene pasos 2 ni 4.

> ⚠️ **El recorrido sólo lleva pasos que el producto hace HOY.** WhatsApp se queda en el
> bloque `soon` de su capacidad. Un recorrido que mezcla lo real con lo prometido deja de
> ser creíble, y es un error que no se nota hasta que un doctor lo pide en la demo.

**La promesa del dinero subió de bullet a franja.** *«El dinero nunca pasa por nosotros»* era
el quinto bullet de la banda `dinero`, donde no lo leía nadie; es una de las dos o tres
objeciones que de verdad frenan la venta. No lleva `id` de navegación a propósito: no es una
capacidad, y meterla al carrusel diluye los destinos reales.

#### El orden de las bandas

**agenda → expediente → informe → facturación → dinero → asistente → presencia → reportes →
fiscal.** Sigue al recorrido; sólo después vienen las que cruzan todo (`asistente`), las que
traen pacientes (`presencia`) y las que miden (`reportes`).

- **El grupo `fiscal` se partió en dos.** Cargaba facturación *y* SAT/conciliación/ventas/
  compras/productos. El recorrido necesita **`facturacion`** como paso propio, y lo avanzado
  no puede ir en medio del hilo — se fue al final como *Administración fiscal avanzada*.
- **`informe` es nuevo** y va pegado a `expediente`, del que es una extensión.
- **`reportes` sigue al final.** Mide agenda, expediente y dinero, así que solo tiene sentido
  después de haberlos contado.

El índice de arriba **no repite el pitch** (no lleva `lead` ni bullets): es navegación para una
página larga, no un segundo resumen.

#### Una banda puede no tener panel

`informe` **vive dentro del expediente** (`/dashboard/medical-records/patients/[id]/informe`)
y no tiene `PermissionKey` propia, así que su `features` va **vacío** y la banda se pinta a
**ancho completo**, sin la tarjeta del "Panel del doctor". Repetir ahí la key `expedientes`
la contaría dos veces en `ALL_FEATURES`.

- Metadata propia. El default de `layout.tsx` —*"Encuentra tu Doctor en México"*— **se quedó
  intacto** porque sigue sirviendo a las páginas que sí son para pacientes (perfiles y
  directorio). Cambiarlo allá les cambiaría el título a todas.
- **Sin botón al directorio** en el cuerpo (petición del usuario); solo un enlace discreto en
  el CTA final. `/doctores` sigue vivo, indexado y en el sitemap.

## De dónde sale el contenido

Todo vive en **`apps/public/src/lib/product-content.ts`** — un solo archivo con el recorrido,
las capacidades, el precio, la tira de plataforma, el FAQ y los colores de cada sección.

**Los números del precio son DATOS, no texto en el JSX.** `PRICING` los concentra
(`amount`, `ivaNote`, `includedInvoices`, `extraInvoicePrice`, `trialWeeks`) y de ahí salen el
hero, el bloque de precio, la metadata y el FAQ. La razón es directa: el precio aparece en
cuatro lugares de la misma pantalla y escrito a mano acaban siendo cuatro precios distintos.

### Campos que no existían antes

| Campo | Para qué |
|---|---|
| `JOURNEY_STEPS` + `JOURNEY_LOOP` | El recorrido y su vuelta. La vuelta va aparte y en oscuro: es el remate, no un paso más |
| `MONEY_PROMISE` | La franja de *«tu dinero va de tu paciente a tu cuenta»* |
| `PRICING` | Los números del plan único |
| `soon?: string[]` en un `CapabilityGroup` | Lo que **viene**. Se pinta en un bloque aparte, con borde punteado y su icono de reloj, **nunca** mezclado con los bullets vivos |
| `PLATFORM_FACTS` | Hechos ciertos de **todo** el producto (nube · PWA · sesiones · segunda cuenta). No caben en ninguna banda; van en una tira compacta antes del precio |
| `features: []` | Una capacidad **sin sección propia del panel** (hoy sólo `informe`) ⇒ banda a ancho completo |

### ⚠️ LA DEUDA NUEVA: la página dice "todo incluido"; el código sigue teniendo tiers

Antes este archivo **espejaba a mano** el reparto CORE/FULL de `TIER_EXCLUDED_KEYS`
(`packages/database/src/permissions.ts`) y marcaba con `fullOnly` lo que Esencial no traía.
El 2026-08-17 se pasó a **un solo plan con todo incluido**, así que `PLAN_NAMES`, `fullOnly`,
`CORE_FEATURES` y `FULL_ONLY_FEATURES` **se borraron**.

**El código NO cambió.** Los tiers CORE/FULL siguen vivos en `permissions.ts`, el
`gate:routes` los sigue verificando y el selector de tier sigue en el admin. Hoy es inofensivo
porque **todas las cuentas están en FULL** ⇒ "todo incluido" es cierto.

> 🔴 **Si alguien pone una cuenta en CORE, esta página miente.** Le vendería facturación, SAT
> y conciliación a alguien que verá pantallas bloqueadas. Por eso la divergencia está escrita
> en el encabezado de `product-content.ts` y aquí, y no deducida: el siguiente que pase **no
> debe "arreglarla" devolviendo los dos planes**. La decisión es comercial, no técnica.

Sigue en pie que `@healthcare/public` **no importa** `@healthcare/database` a propósito
(arrastraría Prisma al sitio público y tocaría el lockfile). Cada función conserva su
`permissionKey` real para poder cotejar a ojo.

## Nombres públicos ≠ nombres internos

~~`FULL` = **Completo** · `CORE` = **Esencial**~~ — **muerto el 2026-08-17.** Ya no hay
nombres públicos de plan que mapear: la página vende uno solo y no lo nombra. `PLAN_NAMES`
se borró de `product-content.ts`. Los nombres internos `CORE`/`FULL` siguen existiendo en el
código y en el admin.

## Decisiones tomadas (usuario, 2026-08-17)

- **Un solo plan, todo incluido, $550 MXN + IVA al mes.** Se acabaron Esencial y Completo.
  Consecuencia en la página: el bloque de precio dejó de ser una **comparación** y pasó a ser
  una **afirmación** — no hay dos tarjetas, ni nota al pie de qué se queda fuera, ni doctor
  haciendo aritmética de funciones. Con esto se cayeron también **3 preguntas del FAQ**, que
  se quedaron sin sujeto.
- **30 facturas timbradas incluidas**; las de más se timbran igual y se cobran a **$1 + IVA
  cada una en el recibo del mes siguiente**. *Nunca se te detiene una factura.*
- **2 semanas de prueba gratis, SIN tarjeta.** Confirmado explícitamente por el usuario.
- **El límite de facturas vive en UN solo lugar** (el bloque de precio). Estaba también en el
  bullet de la banda de facturación y eran dos fuentes del mismo número.
- **El informe médico NO se vende aparte.** Se evaluó como módulo adicional y el usuario lo
  descartó: va incluido, pero con **banda propia** porque es de lo más importante que hace el
  producto y estaba **ausente de la página** hasta hoy.
- **El precio se publica**, y va también en la `metadata` (description y OG).

## Decisiones tomadas (usuario, 2026-07-31)

- **Estructura:** recorrido por capacidades + bloque de planes al final (no una matriz
  comparativa). Con 2 planes y 19 funciones, la matriz alarga sin aclarar.
- ~~**Sin precios.** Los CTA van a correo de ventas; no hay billing self-serve.~~
  **REVOCADA el 2026-08-17:** el precio se publica. El CTA sigue yendo a correo de ventas —
  sigue sin haber billing self-serve.
- ~~**Solo funciones VIVAS en prod.** Nada de roadmap.~~ **REVOCADA el 2026-08-01.** El
  usuario pidió anunciar la API de WhatsApp. Hoy el envío por WhatsApp es manual (`wa.me`,
  ver `apps/doctor/src/lib/whatsapp.ts`); lo que viene son los recordatorios automáticos al
  paciente y su confirmación. Va en el bloque `soon`, **separado** de los bullets vivos:
  la regla nueva no es "nada de roadmap", es **"lo que viene nunca se pinta como si ya
  estuviera"**.
- **Velvet CLARO, no oscuro.** Se ofreció el look oscuro de gsap.com (que es donde el glow
  funciona) y se eligió mantener el fondo claro. Consecuencia asumida: **no hay glow**; hay
  grano, lavados de color y títulos con degradado.
- **Animación discreta:** reveals al entrar en vista. **Sin pin, sin scrub y sin
  ScrollSmoother** — no se secuestra el scroll nativo, que es lo que se siente roto en móvil.
- **La home habla a doctores**, y sin botón al directorio.

## Afirmaciones que ya no son "copy": son promesas

Tres frases de la página dejaron de describir software y pasaron a comprometer al negocio.
**No se editan a la ligera y no se tocan sin el usuario:**

| Frase | Por qué pesa |
|---|---|
| *«Expediente conforme a la **NOM-004** y la **NOM-024**»* | Es una afirmación regulatoria. Está escrita como *conforme*, **no** como "certificado" ni "avalado", que implicarían un tercero certificador. Ver `../` (contexto legal LFPDPPP/NOM-024/SIRES) |
| *«El dinero **nunca pasa por nosotros**»* | Afirma el modelo: el pago va directo del paciente a la cuenta de Mercado Pago o Stripe del doctor. Si algún día hubiera custodia intermedia, esta frase se cae. Desde el 2026-08-17 tiene **franja propia**, así que ya no se puede editar sin que se note |
| *«**$550 + IVA** al mes, **30 facturas** incluidas, extras a **$1 + IVA** en el recibo siguiente»* | **El precio.** Dejó de ser "puerta entreabierta" y es el término comercial de la página. Cambiarlo es cambiar la oferta, no el copy |
| *«**2 semanas gratis, sin tarjeta**»* | Compromete el onboarding: si algún día la prueba pide tarjeta, esta frase es falsa el mismo día. El usuario confirmó el *sin tarjeta* explícitamente |
| *«El formato oficial de **AXA, Allianz y GNP**, tal cual lo piden»* | Nombra terceros y promete fidelidad al formato. Es cierto hoy (las tres en prod, probadas 2026-08-16), pero **cada aseguradora nueva que se agregue hay que agregarla aquí**, y una que se rompa hay que quitarla |

## Pendientes

| # | Qué | Consecuencia si no se hace |
|---|---|---|
| 1 | **`NEXT_PUBLIC_SALES_EMAIL` en el servicio `@healthcare/public`** + redeploy (es `NEXT_PUBLIC_*` ⇒ build-time). Ojo: es OTRA variable que la pendiente del doctor-app desde TIERS T4 | Todos los CTA mandan al fallback `hola@tusalud.pro` |
| 2 | ~~Verificar `/` en vivo tras el deploy~~ **HECHO 2026-08-01** (ver abajo) | — |
| 3 | **Falta el FAQ de migración** — *"¿puedo traer mis pacientes de otro sistema?"*. ✅ **YA HAY RESPUESTA: la importación existe y está en prod** (ver [`../PACIENTE MIGRATION/`](../PACIENTE%20MIGRATION/README.md)). Se escribe: *descargas una plantilla, la subes, y revisas antes de que se guarde nada*. Va en `product-content.ts`, ~posición 3 del `FAQ` | Sigue sin contestarse la objeción más cara de quien cambia de software |
| 4 | El commit `255a6d14` tiene una `@` de más en el asunto y otra al final del cuerpo | Cosmético; arreglarlo pide force-push a `main` |
| 5 | **VER LA PÁGINA CON OJOS** antes del push (2026-08-17). type-check, los 5 gates y el `build` están en verde y el HTML servido trae todo el texto nuevo — pero **eso no es haberla visto**: el recorrido, la franja del dinero, la banda de `informe` a ancho completo y el bloque de precio son maquetación nueva y nadie los ha mirado en un navegador | Se despliega a prod una página cuyo layout nunca se vio; y `main` va directo a producción |
| 6 | **El FAQ de migración sigue sin escribirse** (era el pendiente 3 y se quedó fuera de esta pasada) | Sigue sin contestarse la objeción de quien cambia de software |

### Comprobado en vivo el 2026-08-01 (`8ed5f6cf`)

`/` responde 200 con el H1 nuevo y **sin** `<meta name="robots">`. `/producto` responde
**308 → `https://tusalud.pro/`**. Las 7 bandas están en el HTML servido, y con ellas el texto
que importa para SEO: NOM-004, «nunca pasa por nosotros», «30 facturas al mes», Estado de
resultados, «Muy pronto». 192 `data-reveal`. El `sitemap.xml` lista la home y **ya no** lista
`/producto`.

⏱️ **El deploy tardó ~140 s en aparecer.** El primer `curl` justo después del push todavía
servía la página vieja — eso es normal, no es el bug de Railway de
[`reference_railway_deploy_lag`]. Si a los ~8 min sigue igual, ahí sí toca revisar el
`commitHash` del servicio, no la lógica.

> **Sobre el `noindex`:** mientras el copy fue borrador, `/` llevó `robots: noindex, follow` y
> salió del sitemap — **las dos cosas juntas**, porque un `Disallow` en `robots.txt` habría
> impedido que Google llegara siquiera a leer el `noindex`. Se levantaron al quedar el texto
> del usuario. Si vuelve a hacer falta el freno, es ese par y no otro.

## Lo que NO se tocó

- **El doctor app, el API y el admin.** Todo el trabajo vive en `apps/public/`.
- **El footer legal** — *Aviso de Privacidad · Términos · Eliminación de Datos*. Vive en
  `layout.tsx`, sale en **todas** las páginas (incluida `/producto`) y las tres responden 200.
  Ninguna reescritura de la home puede quitarlo: no está en la home.
- **Los perfiles públicos y el directorio**, que siguen siendo para pacientes.

## Relación con otras carpetas

- **`../TIERS/`** — de ahí salía el reparto Esencial/Completo. **Desde el 2026-08-17 la página
  ya no lo espeja**: vende un solo plan. El código de tiers sigue intacto (ver la deuda nueva
  de arriba) y `TIERS/` sigue siendo la referencia de lo que CORE excluiría.
- **`../INFORME MEDICO/`** — la banda `informe` de la home. Las tres aseguradoras (AXA ·
  Allianz · GNP) y qué formato soporta cada una.
- **`../NUEVOS USUARIOS/`** — el vocabulario de `PermissionKey` que la página usa para nombrar
  cada función con la misma etiqueta que ve el doctor en su panel.
