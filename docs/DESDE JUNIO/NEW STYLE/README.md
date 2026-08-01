# 🎨 NEW STYLE — la cara pública del producto

> **Qué es.** El sitio público (`apps/public`, dominio `tusalud.pro`) pasó de ser un
> placeholder de desarrollo a tener **una sola página de producto de verdad**: la home,
> dirigida a doctores, con todo el recorrido y los dos planes. Su contenido lo dictó el
> usuario capacidad por capacidad (2026-08-01), no sale del código.
>
> 🔄 **Sesión nueva:** la receta visual y cómo ajustarla está en
> [`01-TECNICA-velvet-y-reveals.md`](01-TECNICA-velvet-y-reveals.md). Este archivo es el
> estado y las decisiones.

## Estado (2026-08-01)

| | Ruta | Commit | Estado |
|---|---|---|---|
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

### La estructura de hoy

Hero → **índice** de las 7 capacidades → 7 **bandas** de capacidad → tira de **plataforma** →
los dos planes → FAQ → CTA.

El orden de las bandas es el del doctor, no el del código:
**presencia** (que te encuentren) → **agenda** → **expediente** → **dinero** → **fiscal** →
**reportes**, con **asistente** intercalado. Dos reglas que lo sostienen:

- **`dinero` y `fiscal` van pegados.** `presencia` se movió arriba justamente para no partir
  la historia del dinero a la mitad.
- **`reportes` va al final.** Mide agenda, expediente y dinero, así que solo tiene sentido
  después de haberlos contado. Vivía dentro del grupo `dinero` y se sacó: dos de sus tres
  familias de reporte (citas y actividad clínica) no son de dinero.

El índice de arriba **no repite el pitch** (no lleva `lead` ni bullets): es navegación para una
página larga, no un segundo resumen — que es justo el error que se acaba de deshacer.

El patrón de los planes es *"todo lo del plan Esencial, y además…"*: la tarjeta de **Completo**
no repite la lista, solo enumera las **6** funciones que agrega.

- Metadata propia. El default de `layout.tsx` —*"Encuentra tu Doctor en México"*— **se quedó
  intacto** porque sigue sirviendo a las páginas que sí son para pacientes (perfiles y
  directorio). Cambiarlo allá les cambiaría el título a todas.
- **Sin botón al directorio** en el cuerpo (petición del usuario); solo un enlace discreto en
  el CTA final. `/doctores` sigue vivo, indexado y en el sitemap.

## De dónde sale el contenido

Todo vive en **`apps/public/src/lib/product-content.ts`** — un solo archivo con las
capacidades, los planes, la tira de plataforma, el FAQ y los colores de cada sección.

**Los conteos se derivan, no se escriben a mano.** El hero y las tarjetas de plan salen de
`CORE_FEATURES.length` / `FULL_ONLY_FEATURES.length`, así que un número no puede decir una
cosa arriba y otra abajo.

> ⚠️ **Mover una `Feature` de grupo CAMBIA los conteos.** Al sacar `reportes` de `dinero` a su
> propia banda, el plan Esencial pasó de 13 a **12** funciones — el total (18) no se movió.
> Si alguna vez copias una feature en vez de moverla, la página empieza a inflar el número
> sola y nada falla. La comprobación es que no haya `permissionKey` duplicada.

### Dos campos que no existían antes

| Campo | Para qué |
|---|---|
| `soon?: string[]` en un `CapabilityGroup` | Lo que **viene**. Se pinta en un bloque aparte, con borde punteado y su icono de reloj, **nunca** mezclado con los bullets vivos |
| `PLATFORM_FACTS` | Hechos ciertos de **todo** el producto (nube · PWA · sesiones · segunda cuenta). No caben en ninguna banda; van en una tira compacta antes de los planes |

### ⚠️ La deuda que hay que conocer: el reparto por plan está DUPLICADO

La fuente de verdad de qué excluye CORE es `TIER_EXCLUDED_KEYS` en
`packages/database/src/permissions.ts`. El sitio público **no la importa**, a propósito:
`@healthcare/public` no depende de `@healthcare/database`, y agregarlo arrastraría Prisma al
sitio público y tocaría el lockfile.

Mitigación actual: cada función del archivo lleva su **`permissionKey` real**, para poder
cotejar las dos listas a ojo. **Si cambian los tiers, este archivo se actualiza a mano.**

> 💡 Si esto crece, el arreglo limpio es un sexto gate (`gate:planes-publicos`) que compare
> ambas listas. Son ~30 líneas y mata la clase de bug por construcción. Hoy **no existe**.

## Nombres públicos ≠ nombres internos

| Interno (código, BD, admin) | Público (sitio) |
|---|---|
| `FULL` | **Completo** |
| `CORE` | **Esencial** |

El mapa vive en `PLAN_NAMES`, en `product-content.ts`. Nada del código de tiers cambió.

## Decisiones tomadas (usuario, 2026-07-31)

- **Estructura:** recorrido por capacidades + bloque de planes al final (no una matriz
  comparativa). Con 2 planes y 19 funciones, la matriz alarga sin aclarar.
- **Sin precios.** Los CTA van a correo de ventas; no hay billing self-serve.
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
| *«El dinero **nunca pasa por nosotros**»* | Afirma el modelo: el pago va directo del paciente a la cuenta de Mercado Pago o Stripe del doctor. Si algún día hubiera custodia intermedia, esta frase se cae |
| *«Incluye **30 facturas al mes**, y puedes agregar más»* | **Primer término comercial de la página.** Sin precio y con el follow-up al correo de ventas, para no romper la decisión *"Sin precios"* — pero la puerta quedó entreabierta |

## Pendientes

| # | Qué | Consecuencia si no se hace |
|---|---|---|
| 1 | **`NEXT_PUBLIC_SALES_EMAIL` en el servicio `@healthcare/public`** + redeploy (es `NEXT_PUBLIC_*` ⇒ build-time). Ojo: es OTRA variable que la pendiente del doctor-app desde TIERS T4 | Todos los CTA mandan al fallback `hola@tusalud.pro` |
| 2 | ~~Verificar `/` en vivo tras el deploy~~ **HECHO 2026-08-01** (ver abajo) | — |
| 3 | **Falta el FAQ de migración** — *"¿puedo traer mis pacientes de otro sistema?"* es la pregunta más común de quien cambia de software. **No se escribió a propósito: nadie confirmó si existe importación.** Inventar la respuesta cuesta la venta después | Queda sin contestar la objeción más cara |
| 4 | El commit `255a6d14` tiene una `@` de más en el asunto y otra al final del cuerpo | Cosmético; arreglarlo pide force-push a `main` |

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

- **`../TIERS/`** — de ahí sale el reparto Esencial/Completo. Si cambia `TIER_EXCLUDED_KEYS`,
  hay que actualizar `product-content.ts` a mano (ver la deuda de arriba).
- **`../NUEVOS USUARIOS/`** — el vocabulario de `PermissionKey` que la página usa para nombrar
  cada función con la misma etiqueta que ve el doctor en su panel.
