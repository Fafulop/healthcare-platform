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
| Títulos con `background-clip: text` | ✅ Sí, en el eje índigo |
| `--theme-color` por sección | ❌ **Ya no.** Ver §2: el color por sección era justo lo que rompía el fondo |

**La consecuencia de haber elegido claro:** el *glow* de gsap.com **no se puede reproducir** —
necesita oscuridad. Lo que sí se logra es la textura y el volumen del color. Si algún día se
quiere el brillo, el camino es oscurecer el campo entero (`background-color` de
`.velvet-field`) y subir el alfa de las luces — **no** oscurecer una sección suelta, que es
volver al problema que se acaba de arreglar.

## 2. UN SOLO fondo (el cambio del 2026-08-01)

> **Lo que había antes y por qué se tiró.** Cada banda pintaba su propio lavado
> (`.velvet-wash` con el color de su capacidad). Resultado: al hacer scroll la página se leía
> como **paneles apilados y se veía cada costura**. El usuario lo describió como "cortas el
> fondo". El color por sección era la causa, no un detalle.

Hoy **toda la página es un solo elemento con fondo**: `.velvet-field` en el `<div>` raíz de
`page.tsx`. Ninguna sección de ahí para abajo pinta fondo.

- Las luces son **7 degradados radiales anclados a ese elemento**, que es todo el documento.
  Al hacer scroll la luz se desplaza y cambia de forma, pero **nunca se reinicia**, porque ya
  no hay bordes donde reiniciarse.
- **Alternan lado y color al bajar** — índigo a la derecha, ámbar a la izquierda — para que el
  color respire a lo largo del recorrido en vez de ser un tinte plano.
- Los tamaños van **en px, no en %**: en un elemento de varios miles de píxeles de alto, un
  radio en porcentaje daría manchas gigantes.

Lo único opaco encima del campo son **las tarjetas** (blancas, algunas con `backdrop-blur`) y
**el panel del CTA**.

### Dónde vive cada cosa

| Archivo | Qué |
|---|---|
| `apps/public/src/app/globals.css` (al final) | `.velvet-field` (el campo), `.velvet-title`, `--velvet-grain` y la paleta `--velvet-*` |
| `apps/public/src/lib/product-content.ts` | El `accent` de cada capacidad — **ya solo** para la pastilla del icono |
| `apps/public/src/components/ScrollReveals.tsx` | El motor de animación (GSAP + ScrollTrigger) |
| `apps/public/src/lib/reveal-bootstrap.ts` | El script inline que evita el parpadeo |

## 3. La paleta

| Variable | Valor | De dónde sale |
|---|---|---|
| `--velvet-indigo` | `#4F46E5` | El `bg-indigo-600` del **día seleccionado en el calendario del panel** (`MiniCalendar.tsx`). Es la marca en el producto real, no un color inventado para la web |
| `--velvet-indigo-deep` | `#312E81` | El extremo oscuro del degradado de títulos y del panel del CTA |
| `--velvet-amber` | `#F59E0B` | Conserva la esencia "azul con oro" de la pastilla de *Administración fiscal*, que es lo que el usuario señaló que le gustaba |
| `--velvet-amber-text` | `#B45309` | El oro **cuando tiene que tocar texto** |

🔑 **`--velvet-indigo` pasa AA sobre el campo claro (~7:1).** Es el **primer acento que sí
puede tocar texto** — por eso `.velvet-title` cambió del eje navy→azul al eje índigo. El ámbar
sigue sin poder: para texto va `--velvet-amber-text`.

**Por qué sin pseudo-elementos:** el grano va como primera capa de `background-image` del
propio elemento (igual que gsap.com). Un `::before` superpuesto habría obligado a pelear con
`z-index` en todos los hijos.

⚠️ **El panel del CTA no usa una clase, lleva el fondo en `style` inline** — grano primero,
degradado después. Si le pusieras `.velvet` encima, el `style` inline la anularía y el panel
se quedaría **sin textura**, dejando de pertenecer al mismo material que el resto.

## 4. Reglas duras que no se re-litigan

- **El acento de una capacidad tiñe SOLO la pastilla de su icono. NUNCA texto, y ya nunca el
  fondo.** El ámbar (`#F59E0B`) y el cian (`#06B6D4`) no dan contraste AA sobre claro. Por eso
  `.velvet-title` se queda en el eje índigo **en las 7 bandas**. Si algún día se quiere el
  título del color de la capacidad, hay que pasar un tono OSCURO (ámbar → `#B45309`), no el
  acento.
- **Los acentos por capacidad sobreviven a propósito.** Al unificar el fondo se planteó
  matarlos; el usuario pidió conservarlos. Son la única isla de identidad que queda, y son lo
  que deja distinguir *agenda* de *dinero* de un vistazo sin volver a cortar el fondo.
- **Una sección nueva NO toca `globals.css`.** Sigue siendo cierto, pero por otra razón: antes
  era porque el color entraba por variables desde el markup; ahora es porque **las secciones
  ya no tienen fondo**.
- **El grano es textura, no movimiento**: `prefers-reduced-motion` no lo apaga, y está bien.

## 5. Perillas

| Quiero… | Dónde | Valor hoy |
|---|---|---|
| Más/menos grano | `--velvet-grain` en `globals.css`, atributo `opacity` del `<rect>` | `0.26` |
| Grano más fino/grueso | `baseFrequency` del `feTurbulence` | `0.8` |
| Luces más/menos intensas | El alfa de cada `rgba()` en `.velvet-field` | `0.13`–`0.20` |
| Mover una luz | Su `at X% Y%` en `.velvet-field`. La **`Y%` es posición en el SCROLL** | índigo derecha / ámbar izquierda |
| Más/menos luces | Agregar o quitar un `radial-gradient` — **acuérdate de `background-size` y `background-repeat`, que llevan una entrada por capa** | 7 + el grano |
| Cambiar el índigo o el ámbar | `--velvet-indigo` / `--velvet-amber` en `:root` | `#4F46E5` / `#F59E0B` |
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

`/` es LA página de SEO del producto. **No puede depender de JS para mostrar texto.**

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
css=$(curl -s https://tusalud.pro/ | grep -oE "/_next/static/chunks/[a-f0-9]+\.css" | head -1)
curl -s "https://tusalud.pro$css" | grep -o "feTurbulence\|velvet-title\|velvet-wash-dual"

# El HTML trae los targets de animación Y el texto (lo segundo es lo que importa para SEO)
curl -s https://tusalud.pro/ | grep -o "data-reveal" | wc -l           # ~140
curl -s https://tusalud.pro/ | grep -o "Conciliación Bancaria" | wc -l  # > 0

# La URL vieja redirige, no 404ea
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://tusalud.pro/producto  # 308 …/
```

La segunda comprobación es la importante: **si el texto está en el HTML, ninguna animación
puede esconderlo de Google.**
