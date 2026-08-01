import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  Sparkles,
  DollarSign,
  Globe,
  Receipt,
  Check,
  Lock,
  ArrowRight,
} from 'lucide-react';
import ScrollReveals from '@/components/ScrollReveals';
import {
  CAPABILITY_GROUPS,
  CORE_FEATURES,
  FULL_ONLY_FEATURES,
  FAQ,
  PLAN_NAMES,
  SALES_EMAIL,
} from '@/lib/product-content';

export const metadata: Metadata = {
  title: 'El producto | Todo lo que incluye TuSalud.pro',
  description:
    'Agenda en línea, expediente médico, cobros, asistente de IA y administración fiscal para tu consultorio. Conoce los planes Esencial y Completo.',
  alternates: { canonical: '/producto' },
  openGraph: {
    title: 'Todo lo que tu consultorio necesita, en un solo lugar',
    description:
      'Agenda, expediente, dinero y asistente de IA en los dos planes. Facturación, SAT y conciliación en el plan Completo.',
    url: 'https://tusalud.pro/producto',
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
};

const mailto = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent('Quiero conocer TuSalud.pro')}`;

/**
 * Marca <html> como "listo para animar" ANTES de que pinte el contenido, para
 * que los reveals no parpadeen. Se salta si el usuario pidió "reduce motion", y
 * se auto-borra a los 2.5 s: si el bundle de GSAP no cargara, la página se ve
 * completa igual en vez de quedarse en blanco.
 */
const REVEAL_BOOTSTRAP = `(function(){try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;var r=document.documentElement;r.classList.add('reveal-ready');setTimeout(function(){r.classList.remove('reveal-ready');},2500);}catch(e){}})();`;

export default function ProductoPage() {
  return (
    <div className="bg-white text-[var(--color-neutral-dark)]">
      <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOTSTRAP }} />
      <ScrollReveals />
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden border-b border-gray-100 bg-[var(--color-bg-yellow-light)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-[var(--color-primary)] opacity-10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-[var(--color-accent)] opacity-10 blur-3xl"
        />

        <div
          data-reveal-stagger
          className="relative mx-auto max-w-5xl px-6 py-20 text-center sm:py-28"
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
            className="mt-6 text-4xl leading-tight font-bold tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Todo lo que tu consultorio
            <br className="hidden sm:block" /> necesita, en un solo lugar
          </h1>

          <p
            data-reveal="up"
            className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-medium)] sm:text-xl"
          >
            Tu agenda, tu expediente, tus cobros y tu administración fiscal — conectados
            entre sí y con un asistente de IA que ya sabe de qué le hablas.
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
            {CORE_FEATURES.length} funciones en el plan {PLAN_NAMES.CORE} ·{' '}
            {FULL_ONLY_FEATURES.length} más en el plan {PLAN_NAMES.FULL}
          </p>
        </div>
      </section>

      {/* ─────────────────── Capacidades (el tour) ─────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="space-y-24">
          {CAPABILITY_GROUPS.map((group, i) => {
            const Icon = GROUP_ICONS[group.id] ?? Sparkles;
            const flip = i % 2 === 1;

            return (
              <div
                key={group.id}
                id={group.id}
                className="grid scroll-mt-16 items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                {/* Texto — entra desde el lado opuesto al panel */}
                <div data-reveal={flip ? 'right' : 'left'} className={flip ? 'lg:order-2' : undefined}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--color-secondary)]">
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
                    className="mt-5 text-3xl font-bold sm:text-4xl"
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
                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-primary)]/10">
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
            );
          })}
        </div>
      </section>

      {/* ───────────────────────── Planes ───────────────────────── */}
      <section id="planes" className="scroll-mt-8 border-t border-gray-100 bg-[var(--color-bg-green-light)]">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div data-reveal="up" className="mx-auto max-w-2xl text-center">
            <h2
              className="text-3xl font-bold sm:text-4xl"
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
      <section className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
        <h2
          className="text-center text-3xl font-bold sm:text-4xl"
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
      <section className="bg-[var(--color-secondary)]">
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
