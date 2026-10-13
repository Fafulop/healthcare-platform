'use client';

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Las piezas de la tarjeta de la cita (2026-10-12, pedido del usuario: «formas, tamaños y nombres
 * distintos, todo por todos lados»). UNA forma de botón y UNA forma de fila para todo lo de la tarjeta:
 *
 *   NOMBRE          ESTADO (texto)            [ Correo ] [ WhatsApp ] [ Ver ] [ … ]
 *
 * Cada columna de botones significa lo mismo en todas las filas (Correo · WhatsApp · Ver/Copiar · extra),
 * y una fila nunca pierde un botón: lo que no aplica queda GRIS en su lugar con el porqué al pasar el
 * ratón. Así nada se recorre cuando la cita cambia de estado.
 */

export type VarianteBoton = 'normal' | 'principal' | 'peligro' | 'verde';

const BASE = 'h-7 px-2.5 rounded-md border text-xs font-medium inline-flex items-center justify-center gap-1 whitespace-nowrap select-none';
const ESTILO: Record<VarianteBoton, string> = {
  normal: 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
  principal: 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700',
  peligro: 'bg-white border-red-200 text-red-600 hover:bg-red-50',
  verde: 'bg-teal-600 border-teal-600 text-white hover:bg-teal-700',
};
const APAGADO = 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed';

/**
 * EL botón de la tarjeta. `motivo` = no aplica aquí: gris, sin clic, y el texto es el porqué (title).
 * `href` lo vuelve enlace (mismo aspecto). `ancho` lo fija para que las columnas alineen entre filas.
 */
export function BotonCita({
  etiqueta, icono, onClick, href, misma = false, motivo, irA, ocupado = false, variante = 'normal', ancho, titulo,
}: {
  etiqueta: string;
  icono?: ReactNode;
  onClick?: () => void;
  href?: string;
  /** Con `href`: abrirlo en la MISMA pestaña (una página de la app), no en otra. */
  misma?: boolean;
  motivo?: string | null;
  /** Gris por un dato que FALTA: el clic lleva a donde se captura (el expediente), en la misma pestaña. */
  irA?: string | null;
  ocupado?: boolean;
  variante?: VarianteBoton;
  ancho?: string;
  titulo?: string;
}) {
  const apagado = !!motivo;
  const clase = `${BASE} ${apagado ? APAGADO : ESTILO[variante]} ${ancho ?? ''} disabled:opacity-60`;
  const contenido = (
    <>
      {ocupado ? <Loader2 className="w-3 h-3 animate-spin" /> : icono}
      {etiqueta}
    </>
  );
  if (apagado && irA) {
    return (
      <a href={irA} title={`${motivo} — clic para ir a su expediente`} className={`${BASE} ${APAGADO} ${ancho ?? ''} cursor-pointer hover:text-gray-500 hover:border-gray-300`}>
        {icono}
        {etiqueta}
      </a>
    );
  }
  if (href && !apagado) {
    return (
      <a href={href} {...(misma ? {} : { target: '_blank', rel: 'noopener noreferrer' })} title={titulo} className={clase}>
        {contenido}
      </a>
    );
  }
  return (
    <button
      type="button"
      // Gris: SIN el atributo `disabled` (en algunos navegadores un control deshabilitado no enseña su
      // `title`, y el porqué es lo único que explica el gris); el clic simplemente no hace nada.
      onClick={apagado ? undefined : onClick}
      disabled={!apagado && ocupado}
      aria-disabled={apagado || undefined}
      title={motivo ?? titulo}
      className={clase}
    >
      {contenido}
    </button>
  );
}

/** Los anchos fijos de las columnas de botones: iguales en todas las filas, para que alineen. */
export const COLUMNA = {
  correo: 'w-[5.5rem]',
  whatsapp: 'w-[6.25rem]',
  ver: 'w-[4.75rem]',
  extra: 'w-[3.25rem]',
} as const;

/** Un lugar vacío del ancho de una columna (la fila no tiene ese botón, pero las demás columnas no se mueven). */
export function Hueco({ ancho }: { ancho: string }) {
  return <span className={`${ancho} shrink-0`} aria-hidden="true" />;
}

export type TonoEstado = 'neutro' | 'bien' | 'espera' | 'mal' | 'apagado';
const TONO: Record<TonoEstado, string> = {
  neutro: 'text-gray-600',
  bien: 'text-green-700',
  espera: 'text-amber-700',
  mal: 'text-red-600',
  apagado: 'text-gray-400',
};

/**
 * UNA fila: nombre · estado en palabras · los botones en sus columnas. En una pantalla angosta los botones
 * bajan a su propio renglón, en el mismo orden.
 */
export function FilaCita({ nombre, estado, tono = 'neutro', children }: {
  nombre: string;
  estado: ReactNode;
  tono?: TonoEstado;
  /** Los botones, en orden: Correo · WhatsApp · Ver/Copiar · extra (con `Hueco` donde no hay). */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1">
      <span className="w-28 shrink-0 text-xs font-medium text-gray-700">{nombre}</span>
      <span className={`flex-1 min-w-[8rem] text-xs ${TONO[tono]}`}>{estado}</span>
      <span className="flex items-center gap-1.5 ml-auto">{children}</span>
    </div>
  );
}

/** El rótulo de una sección de la tarjeta (ESTADO · COBRO Y FACTURA · PARA EL PACIENTE). */
export function SeccionCita({ titulo, derecha, children }: { titulo: string; derecha?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{titulo}</span>
        {derecha}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}
