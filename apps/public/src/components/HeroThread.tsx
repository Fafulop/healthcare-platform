import { Fragment } from 'react';
import { CalendarDays, Receipt, Stethoscope, Wallet } from 'lucide-react';
import { HERO_THREAD } from '@/lib/product-content';

/**
 * El hilo del hero: las cuatro paradas de un paciente unidas por UNA sola
 * línea que se dibuja al cargar.
 *
 * POR QUÉ EXISTE: la promesa de la página es el circuito —"un solo hilo"—, y
 * hasta ahora el hero la enunciaba en prosa y la repetía tal cual la sección
 * de abajo. Aquí se DIBUJA. El doctor ve la conexión antes de leer una palabra
 * sobre ella.
 *
 * NO es un resumen del recorrido: `JOURNEY_STEPS` tiene siete pasos y este
 * gesto tiene cuatro, porque cuatro es lo que se lee de un vistazo en una
 * línea. Si alguien los empareja, el hilo deja de ser un gesto y se convierte
 * en un índice duplicado.
 *
 * ES EL HUECO DEL VIDEO. Cuando exista el video del producto reemplaza a este
 * componente entero —una línea en `page.tsx`—, no a la sección: el hero ya
 * está construido alrededor de una franja de este tamaño.
 *
 * La animación es CSS puro (ver `.hero-chip` / `.hero-line` en globals.css),
 * así que no hay 'use client', no hay JS y no depende de ScrollReveals: esto
 * está sobre el pliegue y tiene que aparecer solo. Con "reduce motion" el
 * hilo se pinta ya completo.
 */

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  cita: CalendarDays,
  expediente: Stethoscope,
  factura: Receipt,
  dinero: Wallet,
};

/* Un nodo tarda ~600ms en encadenar con el siguiente: la pastilla entra, la
   línea sale de ella. Los retrasos se calculan en vez de escribirse para que
   agregar o quitar una parada no deje huecos en la secuencia. */
const CHIP_MS = 600;
const LINE_OFFSET_MS = 220;

export default function HeroThread({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* Contenedor plano con fragmentos, NO <ol>/<li>: para que las pastillas
          y los tramos sean hermanos en el mismo flex haría falta
          `display:contents` en cada <li>, y eso todavía borra la semántica de
          lista en varios lectores de pantalla. La lista real de pasos es la de
          `#recorrido`; esto es un gesto. */}
      <div className="mx-auto flex max-w-3xl flex-col items-center justify-between sm:flex-row">
        {HERO_THREAD.map((node, i) => {
          const Icon = ICONS[node.id] ?? CalendarDays;
          const isLast = i === HERO_THREAD.length - 1;

          return (
            <Fragment key={node.id}>
              <div
                className="hero-chip flex shrink-0 items-center gap-2.5 rounded-full border border-white/25 bg-white/10 px-5 py-2.5 backdrop-blur-sm"
                style={{ animationDelay: `${i * CHIP_MS}ms` }}
              >
                <Icon className="h-4 w-4 text-[var(--velvet-amber)]" />
                <span className="text-sm font-semibold whitespace-nowrap text-white">
                  {node.label}
                </span>
              </div>

              {/* El tramo hacia la siguiente parada. En vertical (teléfono) es
                  alto fijo; en horizontal se reparte el espacio sobrante, que
                  es lo que mantiene las cuatro pastillas alineadas sin medir
                  nada en JS. */}
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="hero-line h-8 w-px shrink-0 bg-[var(--velvet-amber)]/70 sm:h-px sm:w-auto sm:min-w-6 sm:flex-1"
                  style={{ animationDelay: `${i * CHIP_MS + LINE_OFFSET_MS}ms` }}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
