import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  Sparkles,
  DollarSign,
  Globe,
  Receipt,
  BarChart3,
  Cloud,
  Smartphone,
  Layers,
  Users,
  Check,
  Lock,
  Clock,
  ArrowRight,
} from 'lucide-react';
import ScrollReveals from '@/components/ScrollReveals';
import { REVEAL_BOOTSTRAP } from '@/lib/reveal-bootstrap';
import {
  CAPABILITY_GROUPS,
  CORE_FEATURES,
  FULL_ONLY_FEATURES,
  FAQ,
  PLATFORM_FACTS,
  PLAN_NAMES,
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
 */
export const metadata: Metadata = {
  title: 'TuSalud.pro | Todo tu consultorio, en un solo lugar',
  description:
    'Agenda en línea, expediente conforme a la NOM-004, cobros que van directo a tu cuenta, facturación CFDI y un asistente de IA. El software de tu consultorio en México.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Todo tu consultorio, en un solo lugar',
    description:
      'Agenda, expediente, dinero y asistente de IA conectados entre sí. Para consultorios en México.',
    url: 'https://tusalud.pro',
    type: 'website',
  },
};

const GROUP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  agenda: Calendar,
  expediente: Stethoscope,
  asistente: Sparkles,
  dinero: DollarSign,
  presencia: Globe,
  fiscal: Receipt,
  reportes: BarChart3,
};

const PLATFORM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  nube: Cloud,
  movil: Smartphone,
  sesiones: Layers,
  equipo: Users,
};

const mailto = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Quiero conocer TuSalud.pro')}`;

export default function Home() {
  return (
    <div className="bg-white text-[var(--color-neutral-dark)]">
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOTSTRAP }} />
      <ScrollReveals />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section
        className="velvet-wash-dual relative overflow-hidden border-b border-gray-100 bg-[var(--color-bg-yellow-light)]"
        style={
          {
            '--wash-1': 'rgba(59,130,246,0.22)',
            '--wash-2': 'rgba(59,130,246,0.07)',
            '--wash-3': 'rgba(245,158,11,0.15)',
            '--wash-x': '78%',
            '--wash-y': '6%',
            '--wash-x2': '10%',
            '--wash-y2': '94%',
          } as React.CSSProperties
        }
      >
        <div
          data-reveal-stagger
          className="relative mx-auto max-w-5xl px-6 py-24 text-center sm:py-32"
        >
          <span
            data-reveal="up"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/25 bg-white px-4 py-1.5 text-sm font-medium text-[var(--color-secondary)]"
          >
            <Sparkles className="h-4 w-4" />
            Para consultorios en México
          </span>

          <h1
            data-reveal="up"
            className="velvet-title mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Todo tu consultorio, en un solo lugar
          </h1>

          <p
            data-reveal="up"
            className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-medium)] sm:text-xl"
          >
            Tu agenda, tus expedientes, tus cobros y tu administración fiscal —
            conectados entre sí, para que lo captures una vez y ya. Y cuando no quieras
            buscar dónde está algo, se lo pides al asistente y lo hace.
          </p>

          <div
            data-reveal="up"
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <a
              href={mailto}
              className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-secondary)] px-8 py-4 text-lg font-semibold text-white shadow-[var(--shadow-light)] transition-colors hover:bg-[var(--color-secondary-hover)]"
            >
              Agenda una demo
              <ArrowRight className="h-5 w-5" />
            </a>
            <a
              href="#planes"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-secondary)] px-8 py-4 text-lg font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-secondary)] hover:text-white"
            >
              Ver los dos planes
            </a>
          </div>

          <p data-reveal="up" className="mt-6 text-sm text-[var(--color-neutral-medium)]">
            Sin instalar nada · {CORE_FEATURES.length} funciones en el plan{' '}
            {PLAN_NAMES.CORE} · {FULL_ONLY_FEATURES.length} más en el plan{' '}
            {PLAN_NAMES.FULL}
          </p>
        </div>
      </section>

      {/* ─────────────────── Índice de capacidades ───────────────────
          Página larga ⇒ hace falta un mapa. Esto NO repite el pitch (no lleva
          `lead` ni bullets): solo nombra las seis capacidades y ancla a su
          banda. Es navegación, no un segundo resumen. */}
      <section className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div data-reveal="up" className="mx-auto max-w-2xl text-center">
          <h2
            className="velvet-title text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Todo lo que hace por tu consultorio
          </h2>
          <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">
            Seis áreas conectadas entre sí — lo que pasa en la agenda llega al expediente,
            al dinero y a tu factura sin que lo captures dos veces.
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
                className="velvet-wash group flex items-center gap-4 rounded-[var(--radius-medium)] border border-gray-200 bg-white p-4 shadow-[var(--shadow-light)] transition-shadow hover:shadow-[var(--shadow-medium)]"
                style={
                  {
                    '--wash-1': group.wash1,
                    '--wash-2': group.wash2,
                    '--wash-x': '88%',
                    '--wash-y': '8%',
                    '--wash-size': '70% 60%',
                  } as React.CSSProperties
                }
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] shadow-[var(--shadow-light)]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, var(--color-secondary) 15%, ${group.accent} 130%)`,
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

                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-secondary)] transition-transform group-hover:translate-x-1" />
              </a>
            );
          })}
        </div>
      </section>

      {/* ─────────────────── Capacidades (el tour) ───────────────────
          Cada grupo es una BANDA de ancho completo con su propio lavado de
          color: así el fondo cambia al pasar de una capacidad a otra y la
          página se lee como un recorrido, no como una lista larga. El lavado
          alterna de esquina según `flip`, siguiendo al contenido. */}
      <section>
        <div>
          {CAPABILITY_GROUPS.map((group, i) => {
            const Icon = GROUP_ICONS[group.id] ?? Sparkles;
            const flip = i % 2 === 1;

            return (
              <div
                key={group.id}
                id={group.id}
                className="velvet-wash scroll-mt-16 py-16 sm:py-20"
                style={
                  {
                    '--wash-1': group.wash1,
                    '--wash-2': group.wash2,
                    '--wash-x': flip ? '15%' : '85%',
                    '--wash-y': '30%',
                    '--wash-size': '55% 70%',
                  } as React.CSSProperties
                }
              >
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 lg:grid-cols-2 lg:gap-16">
                {/* Texto — entra desde el lado opuesto al panel */}
                <div data-reveal={flip ? 'right' : 'left'} className={flip ? 'lg:order-2' : undefined}>
                  <div className="flex items-center gap-3">
                    {/* La pastilla del icono lleva el color de la sección
                        mezclado con el navy de marca: identidad por bloque sin
                        que la marca se pierda. */}
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-[12px] shadow-[var(--shadow-light)]"
                      style={{
                        backgroundImage: `linear-gradient(135deg, var(--color-secondary) 15%, ${group.accent} 130%)`,
                      }}
                    >
                      <Icon className="h-5 w-5 text-white" />
                    </span>
                    <span className="text-sm font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                      {group.eyebrow}
                    </span>
                    {group.fullOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-xs font-semibold text-[#92400E]">
                        <Lock className="h-3 w-3" />
                        Plan {PLAN_NAMES.FULL}
                      </span>
                    )}
                  </div>

                  <h2
                    className="velvet-title mt-5 text-3xl font-bold sm:text-4xl"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {group.title}
                  </h2>

                  <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">{group.lead}</p>

                  <ul data-reveal-stagger className="mt-6 space-y-3">
                    {group.bullets.map((b) => (
                      <li key={b} data-reveal="up" className="flex gap-3">
                        <Check className="mt-1 h-5 w-5 shrink-0 text-[var(--color-success)]" />
                        <span className="text-[15px] leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Lo que viene — bloque APARTE y con su propio icono, para que
                      no se pueda confundir con lo que ya funciona hoy. El texto
                      va en gris medio: se lee, pero no compite con los bullets
                      vivos de arriba. */}
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

                {/* Panel: las secciones REALES del panel del doctor */}
                <div data-reveal={flip ? 'left' : 'right'} className={flip ? 'lg:order-1' : undefined}>
                  <div className="rounded-[var(--radius-medium)] border border-gray-200 bg-[var(--color-neutral-light)] p-2 shadow-[var(--shadow-medium)]">
                    <div className="flex items-center gap-1.5 px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                      <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                      <span className="ml-2 text-xs text-[var(--color-neutral-medium)]">
                        Panel del doctor
                      </span>
                    </div>

                    <div className="space-y-2 rounded-[10px] bg-white p-3">
                      {group.features.map((f) => (
                        <div
                          key={f.permissionKey}
                          className="flex items-start gap-3 rounded-[8px] px-3 py-3 transition-colors hover:bg-[var(--color-neutral-light)]"
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                            style={{ backgroundColor: `${group.accent}1F` }}
                          >
                            <Icon className="h-4 w-4 text-[var(--color-secondary)]" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold">{f.label}</span>
                              {f.fullOnly && (
                                <Lock className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                              )}
                            </div>
                            <p className="mt-0.5 text-sm text-[var(--color-neutral-medium)]">
                              {f.blurb}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────── Plataforma ───────────────
          Hechos ciertos para TODO el producto, no de una capacidad. Van aquí,
          entre el recorrido y los planes, porque es justo donde el doctor pasa
          de «¿qué hace?» a «¿y yo cómo lo uso?». Tira compacta a propósito:
          rompe el ritmo de las bandas sin competir con ellas. */}
      <section className="border-t border-gray-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div data-reveal-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_FACTS.map((fact) => {
              const Icon = PLATFORM_ICONS[fact.id] ?? Cloud;

              return (
                <div key={fact.id} data-reveal="up">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary)]/10">
                    <Icon className="h-5 w-5 text-[var(--color-secondary)]" />
                  </span>
                  <h3
                    className="mt-4 font-bold"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {fact.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-neutral-medium)]">
                    {fact.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────────────── Planes ───────────────────────── */}
      <section
        id="planes"
        className="velvet-wash-dual scroll-mt-8 border-t border-gray-100 bg-[var(--color-bg-green-light)]"
        style={
          {
            '--wash-1': 'rgba(245,158,11,0.16)',
            '--wash-2': 'rgba(245,158,11,0.05)',
            '--wash-3': 'rgba(59,130,246,0.16)',
            '--wash-x': '88%',
            '--wash-y': '18%',
            '--wash-x2': '10%',
            '--wash-y2': '85%',
          } as React.CSSProperties
        }
      >
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div data-reveal="up" className="mx-auto max-w-2xl text-center">
            <h2
              className="velvet-title text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Dos planes, una sola plataforma
            </h2>
            <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">
              El plan {PLAN_NAMES.CORE} lleva tu consulta completa. El plan {PLAN_NAMES.FULL}{' '}
              agrega la administración fiscal para quien la necesita.
            </p>
          </div>

          <div data-reveal-stagger className="mt-14 grid items-start gap-6 lg:grid-cols-2">
            {/* Esencial (CORE) */}
            <div
              data-reveal="up"
              className="rounded-[var(--radius-medium)] border border-gray-200 bg-white p-8 shadow-[var(--shadow-light)]"
            >
              <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {PLAN_NAMES.CORE}
              </h3>
              <p className="mt-2 text-[var(--color-neutral-medium)]">
                Para el consultorio que quiere su agenda, su expediente y su dinero en orden.
              </p>

              <a
                href={mailto}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--color-secondary)] px-6 py-3 font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-secondary)] hover:text-white"
              >
                Hablemos
              </a>

              <p className="mt-8 text-sm font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                Incluye
              </p>
              <ul className="mt-4 space-y-3">
                {CORE_FEATURES.map((f) => (
                  <li key={f.permissionKey} className="flex gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
                    <span>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-[var(--color-neutral-medium)]"> — {f.blurb}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Completo (FULL) */}
            <div
              data-reveal="up"
              className="relative rounded-[var(--radius-medium)] border-2 border-[var(--color-secondary)] bg-white p-8 shadow-[var(--shadow-medium)]"
            >
              <span className="absolute -top-3 left-8 rounded-full bg-[var(--color-secondary)] px-4 py-1 text-xs font-semibold tracking-wide text-white uppercase">
                Más completo
              </span>

              <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {PLAN_NAMES.FULL}
              </h3>
              <p className="mt-2 text-[var(--color-neutral-medium)]">
                Para quien además factura, baja sus comprobantes del SAT y cuadra su banco.
              </p>

              <a
                href={mailto}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--color-secondary)] px-6 py-3 font-semibold text-white transition-colors hover:bg-[var(--color-secondary-hover)]"
              >
                Agenda una demo
                <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-8 rounded-[10px] bg-[var(--color-neutral-light)] px-4 py-3">
                <p className="font-semibold">
                  Todo lo del plan {PLAN_NAMES.CORE}
                  <span className="text-[var(--color-neutral-medium)]">
                    {' '}
                    — las {CORE_FEATURES.length} funciones
                  </span>
                </p>
              </div>

              <p className="mt-6 text-sm font-semibold tracking-wide text-[var(--color-neutral-medium)] uppercase">
                Y además
              </p>
              <ul className="mt-4 space-y-3">
                {FULL_ONLY_FEATURES.map((f) => (
                  <li key={f.permissionKey} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary)]">
                      <Check className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span>
                      <span className="font-medium">{f.label}</span>
                      <span className="text-[var(--color-neutral-medium)]"> — {f.blurb}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-[var(--color-neutral-medium)]">
            El plan {PLAN_NAMES.CORE} conserva completo el flujo de dinero; lo que no incluye
            son los cruces con facturación, SAT y banco. Cambiar de plan no borra nada de tu
            información.
          </p>
        </div>
      </section>

      {/* ───────────────────────── FAQ ───────────────────────── */}
      <section className="velvet mx-auto max-w-3xl px-6 py-20 sm:py-24">
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
      <section className="velvet bg-[var(--color-secondary)]">
        <div data-reveal="up" className="mx-auto max-w-4xl px-6 py-20 text-center">
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
            className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-white px-8 py-4 text-lg font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-neutral-light)]"
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
