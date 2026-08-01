# 🎨 NEW STYLE — la cara pública del producto

> **Qué es.** El sitio público (`apps/public`, dominio `tusalud.pro`) pasó de ser un
> placeholder de desarrollo a tener **dos páginas de verdad**: una home dirigida a doctores y
> una página de producto que lista todo lo que incluye la plataforma y cómo se reparte entre
> los dos planes.
>
> 🔄 **Sesión nueva:** la receta visual y cómo ajustarla está en
> [`01-TECNICA-velvet-y-reveals.md`](01-TECNICA-velvet-y-reveals.md). Este archivo es el
> estado y las decisiones.

## Estado (2026-07-31)

| | Ruta | Commit | Estado |
|---|---|---|---|
| **Página de producto** | `/producto` | `255a6d14` | 🟢 En prod, verificada en vivo |
| **Reveals al scroll** | `/producto` | `a29cfe1e` | 🟢 En prod, verificada en vivo |
| **Textura velvet** | `/producto` | `e906a16a` | 🟢 En prod, verificada en vivo |
| **Links rotos de la home** | `/` | `6601ccc8` | 🟢 En prod, verificada en vivo |
| **Home nueva (doctores)** | `/` | `e0019335` | 🟢 En prod, verificada en vivo |

Comprobado en vivo el 2026-07-31: la home responde con el título nuevo, ya **no** contiene
*"Doctor Profile Platform"*, y los únicos enlaces que quedan son `/producto` y los tres del
footer legal.

## Las dos páginas

### `/` — home, para DOCTORES

Decisión explícita del usuario (2026-07-31): **la home vende el software, no busca pacientes.**
Hero → resumen de las 6 capacidades → resumen de los dos planes → CTA. Ningún detalle se
duplica: cada tarjeta enlaza a `/producto#<sección>`.

- Metadata propia. El default de `layout.tsx` —*"Encuentra tu Doctor en México"*— **se quedó
  intacto** porque sigue sirviendo a las páginas que sí son para pacientes (perfiles y
  directorio). Cambiarlo allá les cambiaría el título a todas.
- **Sin botón al directorio** (petición del usuario). `/doctores` sigue vivo, indexado y en el
  sitemap; solo dejó de estar enlazado desde la home.

### `/producto` — el recorrido completo

Hero → 6 bandas de capacidad (agenda · expediente · asistente IA · dinero · presencia ·
fiscal) → los dos planes → FAQ → CTA.

El patrón de los planes es *"todo lo del plan Esencial, y además…"*: la tarjeta de **Completo**
no repite la lista, solo enumera las **6** funciones que agrega.

## De dónde sale el contenido

Todo vive en **`apps/public/src/lib/product-content.ts`** — un solo archivo con las
capacidades, los planes, el FAQ y los colores de cada sección.

**Los conteos se derivan, no se escriben a mano.** La home y `/producto` importan el mismo
módulo, así que "12 funciones" no puede decir una cosa en una página y otra en la otra.

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
- **Solo funciones VIVAS en prod.** Nada de roadmap: WhatsApp y demás no se nombran.
- **Velvet CLARO, no oscuro.** Se ofreció el look oscuro de gsap.com (que es donde el glow
  funciona) y se eligió mantener el fondo claro. Consecuencia asumida: **no hay glow**; hay
  grano, lavados de color y títulos con degradado.
- **Animación discreta:** reveals al entrar en vista. **Sin pin, sin scrub y sin
  ScrollSmoother** — no se secuestra el scroll nativo, que es lo que se siente roto en móvil.
- **La home habla a doctores**, y sin botón al directorio.

## Pendientes

| # | Qué | Consecuencia si no se hace |
|---|---|---|
| 1 | **`NEXT_PUBLIC_SALES_EMAIL` en el servicio `@healthcare/public`** + redeploy (es `NEXT_PUBLIC_*` ⇒ build-time). Ojo: es OTRA variable que la pendiente del doctor-app desde TIERS T4 | Todos los CTA de ambas páginas mandan al fallback `hola@tusalud.pro` |
| 2 | **Revisar el copy.** El texto es un borrador escrito desde el código, no palabras del usuario | Es lo que Google va a indexar |
| 3 | El commit `255a6d14` tiene una `@` de más en el asunto y otra al final del cuerpo | Cosmético; arreglarlo pide force-push a `main` |

> **Ojo con el #2:** `/producto` está **enlazado desde la home y en el `sitemap.xml`**, así que
> es indexable desde ya. Si el copy no está listo para que lo vea el mundo, hay dos frenos:
> quitar el enlace de la home, o sacarlo del sitemap y ponerle `noindex`.

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
