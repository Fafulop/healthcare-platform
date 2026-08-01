import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Calendar,
  Stethoscope,
  Sparkles,
  DollarSign,
  Globe,
  Receipt,
  ArrowRight,
  Check,
} from 'lucide-react';
import ScrollReveals from '@/components/ScrollReveals';
import { REVEAL_BOOTSTRAP } from '@/lib/reveal-bootstrap';
import {
  CAPABILITY_GROUPS,
  CORE_FEATURES,
  FULL_ONLY_FEATURES,
  PLAN_NAMES,
  SALES_EMAIL,
} from '@/lib/product-content';

/**
 * La home habla a DOCTORES (decisión del usuario), no a pacientes. Por eso lleva
 * metadata propia: el default de `layout.tsx` ("Encuentra tu Doctor en México")
 * sigue sirviendo a las páginas que SÍ son para pacientes —los perfiles y el
 * directorio—, y no se toca.
 */
export const metadata: Metadata = {
  title: 'TuSalud.pro | El software de tu consultorio',
  description:
    'Agenda en línea, expediente médico, cobros, facturación CFDI y un asistente de IA para tu consultorio en México. Conoce los planes Esencial y Completo.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'TuSalud.pro | El software de tu consultorio',
    description:
      'Agenda, expediente, dinero y asistente de IA en un solo lugar. Para consultorios en México.',
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
            El software de tu consultorio
          </h1>

          <p
            data-reveal="up"
            className="mx-auto mt-6 max-w-2xl text-lg text-[var(--color-neutral-medium)] sm:text-xl"
          >
            Tu agenda, tu expediente, tus cobros y tu administración fiscal en un solo
            lugar — con un asistente de IA que ya sabe de qué le hablas.
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
            <Link
              href="/producto"
              className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-secondary)] px-8 py-4 text-lg font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-secondary)] hover:text-white"
            >
              Ver todo el producto
            </Link>
          </div>

          <p data-reveal="up" className="mt-6 text-sm text-[var(--color-neutral-medium)]">
            Sin instalar nada · Tus pacientes agendan desde tu perfil público
          </p>
        </div>
      </section>

      {/* ─────────────── Capacidades (resumen, el detalle vive en /producto) ─────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
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

        <div data-reveal-stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Sparkles;

            return (
              <Link
                key={group.id}
                href={`/producto#${group.id}`}
                data-reveal="up"
                className="velvet-wash group rounded-[var(--radius-medium)] border border-gray-200 bg-white p-6 shadow-[var(--shadow-light)] transition-shadow hover:shadow-[var(--shadow-medium)]"
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
                  className="flex h-11 w-11 items-center justify-center rounded-[12px] shadow-[var(--shadow-light)]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, var(--color-secondary) 15%, ${group.accent} 130%)`,
                  }}
                >
                  <Icon className="h-5 w-5 text-white" />
                </span>

                <h3 className="mt-5 text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                  {group.title}
                </h3>

                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-neutral-medium)]">
                  {group.lead}
                </p>

                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-secondary)]">
                  Ver más
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ─────────────── Planes (resumen; la lista completa vive en /producto) ─────────────── */}
      <section
        className="velvet-wash-dual border-t border-gray-100 bg-[var(--color-bg-green-light)]"
        style={
          {
            '--wash-1': 'rgba(245,158,11,0.16)',
            '--wash-2': 'rgba(245,158,11,0.05)',
            '--wash-3': 'rgba(59,130,246,0.16)',
            '--wash-x': '88%',
            '--wash-y': '15%',
            '--wash-x2': '10%',
            '--wash-y2': '88%',
          } as React.CSSProperties
        }
      >
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <div data-reveal="up" className="mx-auto max-w-2xl text-center">
            <h2
              className="velvet-title text-3xl font-bold sm:text-4xl"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Dos planes, una sola plataforma
            </h2>
            <p className="mt-4 text-lg text-[var(--color-neutral-medium)]">
              Empieza con lo que necesita tu consulta y agrega la parte fiscal cuando te
              haga falta.
            </p>
          </div>

          <div data-reveal-stagger className="mt-12 grid gap-6 sm:grid-cols-2">
            <div
              data-reveal="up"
              className="rounded-[var(--radius-medium)] border border-gray-200 bg-white p-8 shadow-[var(--shadow-light)]"
            >
              <h3 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
                {PLAN_NAMES.CORE}
              </h3>
              <p className="mt-2 text-[var(--color-neutral-medium)]">
                Agenda, expediente, cobros, reportes y el asistente de IA.
              </p>
              <p className="mt-6 flex items-center gap-2 font-semibold">
                <Check className="h-5 w-5 text-[var(--color-success)]" />
                {CORE_FEATURES.length} funciones incluidas
              </p>
            </div>

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
                Todo lo anterior más facturación CFDI, descarga del SAT y conciliación
                bancaria.
              </p>
              <p className="mt-6 flex items-center gap-2 font-semibold">
                <Check className="h-5 w-5 text-[var(--color-success)]" />
                {CORE_FEATURES.length + FULL_ONLY_FEATURES.length} funciones incluidas
              </p>
            </div>
          </div>

          <div data-reveal="up" className="mt-10 text-center">
            <Link
              href="/producto#planes"
              className="inline-flex items-center gap-2 font-semibold text-[var(--color-secondary)] hover:underline"
            >
              Comparar los dos planes función por función
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
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
            Te mostramos la plataforma con tus horarios, tus servicios y tus números — no
            con un demo genérico.
          </p>
          <a
            href={mailto}
            className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-white px-8 py-4 text-lg font-semibold text-[var(--color-secondary)] transition-colors hover:bg-[var(--color-neutral-light)]"
          >
            Escríbenos a {SALES_EMAIL}
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </section>
    </div>
  );
}
