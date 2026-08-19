import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  Sparkles,
  DollarSign,
  Globe,
  Receipt,
  FileText,
  BarChart3,
  Cloud,
  Smartphone,
  Layers,
  Users,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react';
import CapabilityClipPlayer from '@/components/CapabilityClip';
import HeroThread from '@/components/HeroThread';
import ScrollReveals from '@/components/ScrollReveals';
import SectionNav from '@/components/SectionNav';
import { REVEAL_BOOTSTRAP } from '@/lib/reveal-bootstrap';
import {
  CAPABILITY_GROUPS,
  FAQ,
  JOURNEY_CLOSE,
  JOURNEY_INTRO,
  JOURNEY_STEPS,
  PLATFORM_FACTS,
  PRICING,
  SALES_EMAIL,
} from '@/lib/product-content';

/**
 * La home habla a DOCTORES (decisión del usuario), no a pacientes. Por eso lleva
 * metadata propia: el default de `layout.tsx` ("Encuentra tu Doctor en México")
 * sigue sirviendo a las páginas que SÍ son para pacientes —los perfiles y el
 * directorio—, y no se toca.
 *
 * Esta página es TODO el pitch. Antes vivía partido en `/` (resumen) y
 * `/producto` (detalle): dos páginas que competían por la misma búsqueda, y la
 * home era una copia con pérdida de la otra. `/producto` ahora es un 308 hacia
 * aquí (ver `next.config.ts`). Si esto vuelve a crecer demasiado, el siguiente
 * corte NO es resumen/detalle otra vez, sino por capacidad —`/producto/agenda`,
 * `/producto/facturacion`—, que sí son búsquedas distintas.
 *
 * ESTRUCTURA (2026-08-17): la página dejó de ser un catálogo. Primero cuenta
 * el RECORRIDO —las cuatro cosas que genera un paciente: su cita, su
 * expediente, su factura y su ingreso— y sólo después abre el detalle por
 * capacidad. La razón: la promesa del producto es el circuito, y repartida en
 * bandas independientes el doctor tenía que armarla él. Los dos planes
 * murieron el mismo día: un solo precio, todo incluido.
 *
 * El pitch NO es «de la cita a la factura». Así estaba escrito —aquí, en el
 * `description` y en el encabezado del recorrido— y pone la factura de meta
 * del producto cuando es una de las cuatro cosas, no el destino. Corregido el
 * 2026-08-17; si vuelve a aparecer esa frase, es una regresión.
 */
export const metadata: Metadata = {
  title: 'TuSalud.pro | Todo tu consultorio, en un solo lugar',
  description: `Las citas, los expedientes, las facturas y los ingresos de tu consultorio en el mismo lugar, cada uno saliendo del anterior: agenda, expediente NOM-004, informes para aseguradoras, cobros que van directo a tu cuenta y facturación CFDI. Un solo plan, $${PRICING.amount} + IVA al mes.`,
  alternates: { canonical: '/' },
  /* La imagen la genera `src/app/og/route.tsx`. Se referencia a mano, y no
     como `opengraph-image.tsx`, porque ese archivo vive en el segmento RAIZ y
     cascadearia este pitch de producto a los perfiles de doctor, que son de
     cara al paciente y no declaran imagen propia. Ver el comentario de la
     ruta.

     `twitter` se declara aparte aunque repita: sin `card: 'summary_large_image'`
     X/Twitter pinta el thumbnail chico y una imagen de 1200x630 se recorta a un
     cuadrito. LinkedIn y WhatsApp si leen el OG directo. */
  openGraph: {
    title: 'Todo tu consultorio, en un solo lugar',
    description: `Citas, expedientes, facturas e ingresos en el mismo lugar — cada uno sale del anterior, sin capturar nada dos veces. Un solo plan, todo incluido, $${PRICING.amount} + IVA al mes.`,
    url: 'https://tusalud.pro',
    type: 'website',
    siteName: 'TuSalud.pro',
    locale: 'es_MX',
    images: [
      {
        url: '/og',
        width: 1200,
        height: 630,
        alt: `TuSalud.pro — todo tu consultorio en un solo lugar, $${PRICING.amount} ${PRICING.currency} ${PRICING.ivaNote}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Todo tu consultorio, en un solo lugar',
    description: `Citas, expedientes, facturas e ingresos en el mismo lugar. Un solo plan, todo incluido, $${PRICING.amount} + IVA al mes.`,
    images: ['/og'],
  },
};

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agenda: Calendar,
  expediente: Stethoscope,
  informe: FileText,
  facturacion: Receipt,
  dinero: DollarSign,
  presencia: Globe,
  reportes: BarChart3,
};

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  nube: Cloud,
  movil: Smartphone,
  sesiones: Layers,
  equipo: Users,
};

const mailto = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Quiero conocer TuSalud.pro')}`;

/* Los destinos del carrusel salen del MISMO array que pinta las bandas, así
   que agregar una capacidad la mete sola en la navegación. Los tres destinos
   de los extremos no son capacidades y por eso van a mano.

   `#planes` conserva su id aunque la etiqueta ya diga "Precio": hay anuncios
   y correos que apuntan a tusalud.pro/#planes y renombrarlo los rompe.
   La franja de la promesa del dinero NO entra aquí a propósito: no es una
   capacidad y diluiría los destinos reales. */
const NAV_ITEMS = [
  { id: 'recorrido', label: 'El recorrido' },
  ...CAPABILITY_GROUPS.map((g) => ({ id: g.id, label: g.eyebrow })),
  { id: 'planes', label: 'Precio' },
  { id: 'faq', label: 'Preguntas' },
];

export default function Home() {
  return (
    // `velvet-field` es EL fondo de la página entera. Ninguna sección de aquí
    // para abajo pinta el suyo: esa era la razón de que se vieran las costuras.
    <div className="velvet-field text-[var(--color-neutral-dark)]">
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOTSTRAP }} />
      <ScrollReveals />

      {/* ───────────────────────── Hero ─────────────────────────
          Franja OSCURA y a sangre, y va ANTES de la navegación.

          Por qué oscura: el material es exactamente el del panel del CTA
          final —grano + el mismo degradado—, así que la página abre y cierra
          sobre la misma superficie. Antes todo el peso visual estaba abajo y
          lo primero que veía el doctor era lo más ligero de la página.

          Por qué queda tan poco texto: el badge, el subtítulo, el segundo CTA
          y la línea de la prueba gratis se borraron el 2026-08-17. Ninguno
          decía nada que la página no repitiera más abajo —el subtítulo era
          casi literalmente el encabezado de `#recorrido`, y las tres promesas
          de la línea final viven en el bloque de Precio—. El hero no es un
          resumen de la página: es una afirmación y un botón.

          `velvet-title` NO se puede usar aquí: es un degradado índigo
          recortado al texto, calculado para el campo CLARO. Sobre el navy
          desaparece. Por eso el h1 va en blanco liso. */}
      <section
        className="relative overflow-hidden"
        style={{
          /* El grano va PRIMERO y el degradado debajo, igual que en el panel
             del CTA final. */
          backgroundImage:
            'var(--velvet-grain), linear-gradient(135deg, var(--velvet-indigo-deep) 8%, var(--velvet-indigo) 65%, var(--velvet-amber) 185%)',
          backgroundSize: '140px 140px, cover',
          backgroundRepeat: 'repeat, no-repeat',
        }}
      >
        <div className="mx-auto max-w-5xl px-6 py-24 text-center sm:py-32">
          <h1
            className="text-[2.75rem] font-bold tracking-tight text-white sm:text-7xl"
            style={{ fontFamily: 'var(--font-heading)', lineHeight: 1.05 }}
          >
            Todo tu consultorio,
            {/* El corte es a mano: partido por el ancho del contenedor, "en un
                solo lugar" se rompe en dos y la frase pierde el remate. */}
            <br />
            en un solo lugar
          </h1>

          {/* El precio, NO un botón. El hero se queda a propósito sin CTA:
              lidera con el número y deja que la página venda. La invitación a
              escribir sigue viva dos veces más abajo —en el bloque de Precio y
              en el panel de cierre—, así que no se pierde el camino, sólo deja
              de ser lo primero.

              Es una pastilla y no texto suelto para que pertenezca a la misma
              familia que las paradas del hilo de abajo: misma piel
              translúcida, mismo borde. En texto plano se leería como el
              subtítulo que se borró.

              El número sale de PRICING. Nunca se escribe a mano aquí: es el
              tercer lugar de la página que lo menciona —con el bloque de
              Precio y el FAQ— y son justo tres sitios donde podrían quedar
              tres precios distintos. */}
          <div className="mt-10 flex justify-center">
            {/* Mismo tratamiento tipografico que el $550 del bloque de Precio
                (peticion del usuario, 2026-08-18): numero grande en la fuente
                de titulos y la moneda + IVA chicos al lado, alineados abajo.
                Antes era una linea sola en la fuente de cuerpo y los dos $550
                de la pagina no se parecian.

                Sigue dentro de la pastilla: es lo que lo emparenta con las
                paradas del hilo de aqui abajo. Lo unico que cambio es la
                letra, no el envase. */}
            <p className="inline-flex items-end gap-2 rounded-full border border-white/25 bg-white/10 px-7 py-4 backdrop-blur-sm">
              <span
                className="text-4xl font-bold leading-none text-white sm:text-5xl"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                ${PRICING.amount}
              </span>
              <span className="pb-0.5 text-base text-white/75 sm:text-lg">
                {PRICING.currency} {PRICING.ivaNote}
              </span>
            </p>
          </div>

          <HeroThread className="mt-16 sm:mt-20" />

          {/* -- Plataforma, dentro del hero --
              Hechos ciertos para TODO el producto, no de una capacidad.
              Estuvieron entre las bandas y el precio hasta el 2026-08-18; el
              usuario los subio aqui: contestan "¿y yo como lo uso?" antes de
              que el doctor empiece a bajar, no cuando ya casi termina.

              ⚠️ Van repintados para el NAVY. El estilo anterior era de campo
              claro -chip `--velvet-indigo`/10, titulo oscuro, cuerpo
              `--color-neutral-medium`- y sobre el hero desaparecia. Si alguien
              devuelve esta tira al campo claro, hay que devolverle tambien
              esos colores: blanco sobre blanco no se ve. */}
          <div
            data-reveal-stagger
            className="mt-16 grid gap-8 border-t border-white/15 pt-12 text-left sm:mt-20 sm:grid-cols-2 lg:grid-cols-4"
          >
            {PLATFORM_FACTS.map((fact) => {
              const Icon = PLATFORM_ICONS[fact.id] ?? Cloud;

              return (
                <div key={fact.id} data-reveal="up">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/20 bg-white/10">
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  {/* `<p>`, NO `<h3>`. Al subir esta tira al hero (2026-08-18)
                      sus cuatro titulos quedaron ANTES del primer `<h2>` de la
                      pagina, y el documento arrancaba h1 -> h3 -> h2: un salto
                      de nivel que los lectores de pantalla anuncian como una
                      seccion perdida. No son secciones del documento, son
                      etiquetas de una tira de apoyo. */}
                  <p
                    className="mt-4 font-bold text-white"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {fact.title}
                  </p>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">
                    {fact.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* La navegación va DEBAJO del hero, no encima. Es una barra blanca
          translúcida con backdrop-blur: sobre el hero oscuro se leería como
          una mancha pálida cruzando lo primero que ve el doctor. Aquí sigue
          siendo `sticky top-0`, así que se pega en cuanto el hero sale de
          pantalla — el único costo es que al aterrizar no se ve, que es lo
          correcto para un hero de un titular y un botón. */}
      <SectionNav items={NAV_ITEMS} />

      {/* ───────────────────── El recorrido ─────────────────────
          LA sección de la página. Es lo único que cuenta el producto como un
          hilo y no como un catálogo, y por eso va antes que cualquier lista de
          capacidades: el doctor tiene que ver el circuito completo antes de
          que le importe cómo se llama cada pantalla.

          El eje NO es «de la cita a la factura» —ver el comentario de
          `JOURNEY_STEPS`—: son las cuatro cosas que genera un paciente, y la
          factura es una de ellas, no el destino.

          El remate (`JOURNEY_CLOSE`) va aparte y en oscuro: los cuatro pasos
          no siguen encadenándose, terminan en un solo estado. */}
      <section id="recorrido" className="scroll-mt-24">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-24">
          <div data-reveal="up" className="mx-auto max-w-2xl text-center">
            <h2
              className="velvet-title text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              {JOURNEY_INTRO.title}
            </h2>
            <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">
              {JOURNEY_INTRO.lead}
            </p>
          </div>

          <ol data-reveal-stagger className="mt-12 space-y-3">
            {JOURNEY_STEPS.map((step) => (
              <li
                key={step.n}
                data-reveal="up"
                className="flex gap-5 rounded-[var(--radius-medium)] border border-white/70 bg-white/75 p-5 shadow-[var(--shadow-light)] backdrop-blur-sm sm:p-6"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-[var(--shadow-light)]"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, var(--velvet-indigo) 10%, var(--velvet-amber) 190%)',
                  }}
                  aria-hidden="true"
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3 className="font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--color-neutral-medium)]">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div
            data-reveal="up"
            className="mt-4 flex gap-5 rounded-[var(--radius-medium)] bg-[var(--velvet-indigo)] p-5 shadow-[var(--shadow-medium)] sm:p-6"
          >
            {/* Un check, no el `↺` que había: esto ya no es una vuelta al
                principio, es el estado final de los cuatro pasos. */}
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white"
              aria-hidden="true"
            >
              <Check className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
                {JOURNEY_CLOSE.title}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-white/80">
                {JOURNEY_CLOSE.text}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────── Índice de capacidades ───────────────────
          Página larga ⇒ hace falta un mapa. Esto NO repite el pitch (no lleva
          `lead` ni bullets): solo nombra las seis capacidades y ancla a su
          banda. Es navegación, no un segundo resumen. */}
      {/* `pt` recortado (2026-08-18): el hueco sobre el titulo era la suma
          del `pb` del recorrido (80/96px) mas el `pt` propio (56/64px). El
          `pb` se queda igual — lo que sobraba estaba ARRIBA. */}
      <section className="mx-auto max-w-6xl px-6 pb-14 pt-4 sm:pb-16 sm:pt-6">
        <div data-reveal="up" className="mx-auto max-w-2xl text-center">
          <h2
            className="velvet-title text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Todo lo que hace por tu consultorio
          </h2>
          <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">
            {CAPABILITY_GROUPS.length} áreas conectadas entre sí — lo que pasa en la
            agenda llega al expediente, al dinero y a tu factura sin que lo captures dos
            veces.
          </p>
        </div>

        <div data-reveal-stagger className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Sparkles;

            return (
              <a
                key={group.id}
                href={`#${group.id}`}
                data-reveal="up"
                className="group flex items-center gap-4 rounded-[var(--radius-medium)] border border-white/70 bg-white/75 p-4 shadow-[var(--shadow-light)] backdrop-blur-sm transition-shadow hover:shadow-[var(--shadow-medium)]"
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] shadow-[var(--shadow-light)]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, var(--velvet-indigo) 15%, ${group.accent} 130%)`,
                  }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>

                <span className="min-w-0">
                  <span className="block text-xs font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                    {group.eyebrow}
                  </span>
                  <span
                    className="mt-0.5 block font-bold"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {group.title}
                  </span>
                </span>

                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--velvet-indigo)] transition-transform group-hover:translate-x-1" />
              </a>
            );
          })}
        </div>
      </section>

      {/* ─────────────────── Capacidades (el tour) ───────────────────
          MOLDE (2026-08-17): TEXTO de un lado, TARJETA BLANCA del otro.

          A la izquierda la capacidad se CUENTA —prosa corrida, `group.lead`,
          un párrafo por entrada— y a la derecha se LISTA: la tarjeta lleva los
          `bullets`, que son el inventario de funciones. Antes los bullets
          vivían en la columna de texto y la tarjeta era un mockup falso del
          panel del doctor —tres puntos grises y todo—, así que la columna
          izquierda hacía los dos trabajos y la derecha fingía ser una captura.

          El cromo de navegador se fue con el mockup: una tarjeta que lleva una
          lista no debe disfrazarse de pantalla.

          Las secciones REALES del panel (`group.features`, con su
          `permissionKey`) no se perdieron: son el pie de la tarjeta, en un
          renglón. Siguen siendo la correspondencia verificable a ojo entre
          esta página y los permisos del producto, y de paso le dicen al doctor
          dónde vive esto cuando entre.

          Las bandas NO pintan fondo: el color viene del campo continuo de la
          página. Lo que alterna es de qué lado cae la tarjeta. */}
      <section>
        <div>
          {CAPABILITY_GROUPS.map((group, i) => {
            const Icon = GROUP_ICONS[group.id] ?? Sparkles;
            const flip = i % 2 === 1;

            return (
              <div key={group.id} id={group.id} className="scroll-mt-24 py-16 sm:py-20">
                <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 lg:grid-cols-2 lg:gap-16">
                  {/* ── Texto: la capacidad contada ── */}
                  <div
                    data-reveal={flip ? 'right' : 'left'}
                    className={flip ? 'lg:order-2' : undefined}
                  >
                    <div className="flex items-center gap-3">
                      {/* La pastilla del icono lleva el color de la sección
                          mezclado con el navy de marca: identidad por bloque
                          sin que la marca se pierda. */}
                      <span
                        className="flex h-11 w-11 items-center justify-center rounded-[12px] shadow-[var(--shadow-light)]"
                        style={{
                          backgroundImage: `linear-gradient(135deg, var(--velvet-indigo) 15%, ${group.accent} 130%)`,
                        }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </span>
                      <span className="text-sm font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                        {group.eyebrow}
                      </span>
                    </div>

                    <h2
                      className="velvet-title mt-5 text-3xl font-bold sm:text-4xl"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {group.title}
                    </h2>

                    {/* El primer párrafo va más grande: es el que tiene que
                        agarrar a quien viene scrolleando. Los siguientes bajan
                        a tamaño de lectura para que el bloque no se lea como
                        tres titulares seguidos. */}
                    {group.lead.length > 0 && (
                      <div data-reveal-stagger className="mt-4 space-y-4">
                        {group.lead.map((par, j) => (
                          <p
                            key={par}
                            data-reveal="up"
                            className={
                              j === 0
                                ? 'text-lg leading-relaxed text-[var(--color-neutral-medium)]'
                                : 'text-[15px] leading-relaxed text-[var(--color-neutral-medium)]'
                            }
                          >
                            {par}
                          </p>
                        ))}
                      </div>
                    )}

                    {/* El clip — al PIE del texto, no dentro de la tarjeta.
                        Aquí abajo remata lo que los párrafos acaban de contar;
                        en la tarjeta le devolvería a la lista el disfraz de
                        pantalla que se le quitó el 2026-08-17.

                        Va ANTES de «Muy pronto» a propósito: el clip enseña lo
                        que ya funciona, y lo que aún no existe no puede quedar
                        entre la prosa y su prueba. */}
                    {group.clip && <CapabilityClipPlayer clip={group.clip} />}

                    {/* Lo que viene — bloque APARTE, con su propio icono y en
                        la columna de TEXTO, nunca dentro de la tarjeta: la
                        tarjeta es el inventario de lo que YA funciona, y basta
                        con que compartan caja para que se confundan. */}
                    {group.soon && group.soon.length > 0 && (
                      <div
                        data-reveal="up"
                        className="mt-6 rounded-[var(--radius-medium)] border border-dashed border-gray-300 bg-white/60 p-5"
                      >
                        <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                          <Clock className="h-4 w-4" />
                          Muy pronto
                        </p>
                        <ul className="mt-3 space-y-2">
                          {group.soon.map((s) => (
                            <li key={s} className="flex gap-3">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-neutral-medium)]" />
                              <span className="text-[15px] leading-relaxed text-[var(--color-neutral-medium)]">
                                {s}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* ── Tarjeta: la capacidad listada ── */}
                  <div
                    data-reveal={flip ? 'left' : 'right'}
                    className={flip ? 'lg:order-1' : undefined}
                  >
                    <div className="rounded-[var(--radius-medium)] border border-gray-200 bg-white p-6 shadow-[var(--shadow-medium)] sm:p-7">
                      <p className="text-xs font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                        Lo que incluye
                      </p>

                      <ul className="mt-4 space-y-3">
                        {group.bullets.map((b) => (
                          <li key={b} className="flex gap-3">
                            <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--color-success)]" />
                            <span className="text-[15px] leading-relaxed">{b}</span>
                          </li>
                        ))}
                      </ul>

                      {/* Dónde vive esto en el producto. `features` puede ir
                          VACÍO —el informe médico no tiene sección propia— y
                          entonces el pie no se pinta, en vez de anunciar una
                          pantalla que no existe. */}
                      {group.features.length > 0 && (
                        <p className="mt-6 border-t border-gray-200 pt-4 text-sm text-[var(--color-neutral-medium)]">
                          <span className="font-semibold">En tu panel:</span>{' '}
                          {group.features.map((f) => f.label).join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ───────────────────────── Precio ─────────────────────────
          Antes eran DOS tarjetas comparables y una nota al pie explicando qué
          se quedaba fuera del plan Esencial. Con un solo plan no hay nada que
          comparar: el bloque pasó de tabla a afirmación, que es más fuerte —el
          doctor no hace aritmética de funciones en la página.

          El `id` sigue siendo `planes` aunque la sección ya se llame Precio:
          hay links vivos hacia tusalud.pro/#planes. */}
      <section id="planes" className="scroll-mt-24">
        {/* `pt` recortado (2026-08-18), misma razon que en el indice: venia
            encima el `pb` de las bandas. */}
        <div className="mx-auto max-w-3xl px-6 pb-20 pt-6 sm:pb-24 sm:pt-8">
          <div data-reveal="up" className="text-center">
            <h2
              className="velvet-title text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Un solo plan. Todo incluido.
            </h2>
          </div>

          <div
            data-reveal="up"
            className="mt-10 rounded-[var(--radius-medium)] border-2 border-[var(--velvet-indigo)] bg-white p-8 text-center shadow-[var(--shadow-medium)] sm:p-10"
          >
            <p className="flex items-end justify-center gap-2">
              <span
                className="text-5xl font-bold text-[var(--velvet-indigo)] sm:text-6xl"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                ${PRICING.amount}
              </span>
              <span className="pb-2 text-lg text-[var(--color-neutral-medium)]">
                {PRICING.currency} {PRICING.ivaNote}
              </span>
            </p>

            <p className="mx-auto mt-5 max-w-xl text-[var(--color-neutral-medium)]">
              Todas las funciones, sin niveles ni extras: agenda, expediente, informes para
              aseguradoras, facturación, flujo de dinero, perfil público y
              reportes.
            </p>

            {/* El límite de facturas se dice DOS veces a propósito: aquí y en
                el último bullet de la banda de facturación (el usuario lo
                pidió allá el 2026-08-18; antes vivía sólo aquí).

                Que se repita el TEXTO no es el problema; que se repita el
                NÚMERO sí. Los dos salen de `PRICING.includedInvoices` y
                `PRICING.extraInvoicePrice` — el de allá es un template
                literal justamente por esto. Si alguien escribe "30" o "$1"
                a mano en cualquiera de los dos, la página puede acabar
                anunciando dos ofertas distintas en la misma pantalla. */}
            <div className="mx-auto mt-8 max-w-xl rounded-[10px] bg-[var(--color-neutral-light)] px-5 py-4 text-left">
              <p className="font-semibold">
                Incluye {PRICING.includedInvoices} facturas timbradas al mes.
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-[var(--color-neutral-medium)]">
                Si un mes necesitas más, se timbran igual y se cobran a $
                {PRICING.extraInvoicePrice} + IVA cada una en tu recibo del mes siguiente.
                Nunca se te detiene una factura.
              </p>
            </div>

            <a
              href={mailto}
              className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-[var(--velvet-indigo)] px-8 py-4 text-lg font-semibold text-white shadow-[var(--shadow-light)] transition-colors hover:bg-[var(--velvet-indigo-deep)]"
            >
              Empieza con {PRICING.trialWeeks} semanas gratis
              <ArrowRight className="h-5 w-5" />
            </a>

            <p className="mx-auto mt-6 max-w-xl text-sm text-[var(--color-neutral-medium)]">
              {PRICING.trialWeeks} semanas gratis, sin tarjeta. El dinero de tus pacientes
              nunca pasa por nosotros: va directo a tu cuenta de Mercado Pago o Stripe.
            </p>
          </div>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      {/* El peor de los tres: el `pb` del precio y el `pt` del FAQ sumaban
          160/192px de aire antes del titulo. `scroll-mt-24` se queda — es lo
          que compensa la barra sticky cuando se llega por #faq, y no tiene
          nada que ver con este hueco. */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-6 pb-20 pt-6 sm:pb-24 sm:pt-8">
        <h2
          className="velvet-title text-center text-3xl font-bold sm:text-4xl"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Preguntas frecuentes
        </h2>

        <dl data-reveal-stagger className="mt-12 divide-y divide-gray-200">
          {FAQ.map((item) => (
            <div key={item.q} data-reveal="up" className="py-6">
              <dt className="text-lg font-semibold">{item.q}</dt>
              <dd className="mt-2 text-[var(--color-neutral-medium)]">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ───────────────────────── CTA final ───────────────────────── */}
      {/* El CTA ya no es una banda de ancho completo con fondo propio —eso era
          otra costura—. Es un PANEL redondeado que flota sobre el campo: cierra
          la página con peso sin cortar el fondo. El grano se queda para que el
          panel pertenezca al mismo material. */}
      <section className="px-6 pb-20 sm:pb-24">
        <div
          data-reveal="up"
          className="mx-auto max-w-5xl rounded-[24px] px-6 py-16 text-center shadow-[var(--shadow-medium)]"
          style={{
            /* El grano va PRIMERO y el degradado debajo, igual que en `.velvet`.
               Aquí no se usa esa clase porque un `style` inline la anularía: el
               panel se quedaría sin textura y dejaría de pertenecer al campo. */
            backgroundImage:
              'var(--velvet-grain), linear-gradient(135deg, var(--velvet-indigo-deep) 8%, var(--velvet-indigo) 65%, var(--velvet-amber) 185%)',
            backgroundSize: '140px 140px, cover',
            backgroundRepeat: 'repeat, no-repeat',
          }}
        >
          <h2
            className="text-3xl font-bold text-white sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            ¿Lo vemos con tu consultorio?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
            Te mostramos la plataforma con tus horarios, tus servicios y tus números — no con
            un demo genérico.
          </p>
          <a
            href={mailto}
            className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-white px-8 py-4 text-lg font-semibold text-[var(--velvet-indigo)] transition-colors hover:bg-[var(--color-neutral-light)]"
          >
            Escríbenos a {SALES_EMAIL}
            <ArrowRight className="h-5 w-5" />
          </a>
          <p className="mt-6">
            <Link href="/doctores" className="text-sm text-white/70 underline hover:text-white">
              Ver perfiles de doctores en la plataforma
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
