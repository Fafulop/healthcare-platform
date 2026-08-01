# 01 — Técnica: velvet (textura) y reveals (scroll)

> Cómo está hecho y **dónde girar cada perilla**. El estado y las decisiones están en
> [`README.md`](README.md).

## 1. Velvet — de dónde salió

El usuario pidió "algo como https://gsap.com/scroll/, con nuestros colores". No se copió el
look: se **leyó el CSS de esa página** y se extrajeron las cuatro técnicas que lo producen.

| Lo que hace gsap.com | Qué hicimos nosotros |
|---|---|
| Base casi negra (`#0e100f`) | ❌ **No**. El usuario eligió fondo claro |
| Degradados radiales **descentrados** (`at 16% 78%`), núcleo pálido sangrando a color saturado | ✅ Sí, con nuestra paleta y alfas bajas |
| **Grano encima del color**: `background: url(noise.png), <degradado>` | ✅ Sí, pero con SVG inline en vez de PNG |
| Títulos con `background-clip: text` | ✅ Sí, en el eje navy→azul |
| `--theme-color` por sección | ✅ Sí, como `accent` + `wash1/wash2` por grupo |

**La consecuencia de haber elegido claro:** el *glow* de gsap.com **no se puede reproducir** —
necesita oscuridad. Lo que sí se logra es la textura y el volumen del color. Si algún día se
quiere el brillo, el camino es oscurecer al menos el hero y la banda de planes.

## 2. Dónde vive cada cosa

| Archivo | Qué |
|---|---|
| `apps/public/src/app/globals.css` (al final) | Las clases `.velvet`, `.velvet-wash`, `.velvet-wash-dual`, `.velvet-title` y la variable `--velvet-grain` |
| `apps/public/src/lib/product-content.ts` | El `accent` / `wash1` / `wash2` de cada sección |
| `apps/public/src/components/ScrollReveals.tsx` | El motor de animación (GSAP + ScrollTrigger) |
| `apps/public/src/lib/reveal-bootstrap.ts` | El script inline que evita el parpadeo |

**El CSS no conoce la paleta.** Los colores entran desde el markup por variables
(`--wash-1`, `--wash-2`, …), así que agregar una sección nueva **no toca `globals.css`**.

## 3. Las clases

```html
<!-- solo grano, para bandas que ya tienen color de fondo -->
<section class="velvet bg-[var(--color-secondary)]">

<!-- grano + un lavado radial -->
<div class="velvet-wash" style="--wash-1: rgba(59,130,246,0.16); --wash-2: rgba(59,130,246,0.05); --wash-x: 85%; --wash-y: 30%">

<!-- grano + DOS lavados desde esquinas opuestas (hero y planes) -->
<section class="velvet-wash-dual" style="--wash-1: …; --wash-3: …; --wash-x2: 10%; --wash-y2: 90%">
```

**Por qué dos lavados en las bandas grandes:** una sola fuente de luz se lee como mancha; dos
se leen como volumen.

**Por qué sin pseudo-elementos:** el grano va como primera capa de `background-image` del
propio elemento (igual que gsap.com). Un `::before` superpuesto habría obligado a pelear con
`z-index` en todos los hijos.

## 4. Reglas duras que no se re-litigan

- **El acento tiñe fondos y la pastilla del icono. NUNCA texto.** El ámbar (`#F59E0B`) y el
  cian (`#06B6D4`) no dan contraste AA sobre blanco. Por eso `.velvet-title` se queda en el eje
  navy→azul **incluso en las secciones ámbar y cian**. Si algún día se quiere el título del
  color de la sección, hay que pasar un tono OSCURO (p.ej. ámbar → `#B45309`), no el acento.
- **El grano es textura, no movimiento**: `prefers-reduced-motion` no lo apaga, y está bien.

## 5. Perillas

| Quiero… | Dónde | Valor hoy |
|---|---|---|
| Más/menos grano | `--velvet-grain` en `globals.css`, atributo `opacity` del `<rect>` | `0.26` |
| Grano más fino/grueso | `baseFrequency` del `feTurbulence` | `0.8` |
| Lavados más/menos intensos | `wash1`/`wash2` en `product-content.ts` (el alfa) | `0.15`–`0.18` / `0.05` |
| Mover la luz de una sección | `--wash-x` / `--wash-y` en el markup | alterna 15% / 85% |
| Animación más rápida/lenta | `duration` en `ScrollReveals.tsx` | `0.6` grupo · `0.7` suelto |
| Más/menos cascada | `stagger` | `0.08` |
| Que entren desde más lejos | `initialStateFor()` | 24px (arriba) · 36px (lados) |
| Que aparezcan antes/después | `start` del ScrollTrigger | `'top 85%'` |

## 6. Reveals — cómo se usan

**No se envuelve nada.** `<ScrollReveals />` se monta una vez por página y lee atributos del
markup ya renderizado en el servidor:

```html
<div data-reveal="up">      <!-- up | left | right -->
<ul data-reveal-stagger>    <!-- sus hijos con data-reveal entran escalonados -->
```

Así **las páginas siguen siendo Server Components** y su HTML sale completo para Googlebot.

## 7. Las tres redes de seguridad (y por qué existen)

`/producto` y `/` son páginas de SEO. **No pueden depender de JS para mostrar texto.**

1. **Sin JS** → la clase `.reveal-ready` nunca se agrega → todo visible. El estado inicial
   `opacity: 0` cuelga de esa clase, no del elemento.
2. **`prefers-reduced-motion`** → el script inline no hace nada y `ScrollReveals` sale temprano.
3. **Si GSAP no carga** → el mismo script inline **se auto-borra a los 2.5 s** y la página
   aparece completa. Nunca se queda en blanco por culpa de la animación.

> 🔍 **Detalle que parece redundante y no lo es:** `initialStateFor()` repite `opacity: 0`
> aunque la clase CSS ya lo pone. Al quedar como estilo **inline**, gana sobre la clase — así
> el auto-borrado de los 2.5 s no destapa a medias los elementos que GSAP *sí* va a animar. Ese
> salvavidas queda solo para el caso en que GSAP no llegue.

## 8. GSAP: licencia y peso

- **Es gratis, todos los plugins incluidos** (Webflow eliminó los planes de pago). No hay nada
  que pagar ni que registrar.
- Solo se usa **`gsap` + `ScrollTrigger`**. No se usa `ScrollSmoother` **a propósito**: secuestra
  el scroll nativo y es la fuente más común de "esta página se siente rota" en móvil.
- ⚠️ Agregarlo fue un **cambio de dependencia**: `pnpm-lock.yaml` se regeneró en el **mismo
  commit** (`a29cfe1e`). Railway instala con frozen lockfile; sin eso el build falla y el push
  no shipea.

## 9. Cómo verificar que no se rompió (sin navegador)

```bash
# El CSS de producción trae las reglas velvet
css=$(curl -s https://tusalud.pro/producto | grep -oE "/_next/static/chunks/[a-f0-9]+\.css" | head -1)
curl -s "https://tusalud.pro$css" | grep -o "feTurbulence\|velvet-title\|velvet-wash-dual"

# El HTML trae los targets de animación Y el texto (lo segundo es lo que importa para SEO)
curl -s https://tusalud.pro/producto | grep -o "data-reveal" | wc -l          # ~116
curl -s https://tusalud.pro/producto | grep -o "Conciliación Bancaria" | wc -l # > 0
```

La segunda comprobación es la importante: **si el texto está en el HTML, ninguna animación
puede esconderlo de Google.**
