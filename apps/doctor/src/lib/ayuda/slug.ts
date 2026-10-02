/**
 * Lo que comparten la página de Ayuda, el widget «?» y el servidor para nombrar pestañas y secciones del
 * manual — separado de `manual-html.ts` para que el cliente no cargue el convertidor de Markdown.
 */

/** «Facturar desde el expediente» → `facturar-desde-el-expediente` (sin acentos, como los enlaces del manual). */
export function slugAyuda(t: string): string {
  return t
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Nombres viejos de pestaña (enlaces que ya existían: `?tab=citas`) → la pestaña nueva. */
export const ALIAS_DE_PESTANA: Record<string, string> = {
  citas: 'agenda', 'citas-acciones': 'agenda', 'citas-status': 'agenda', expedientes: 'expediente',
};

/** «Agenda > Reagendar una cita» (lo que cita el widget) → el enlace a esa sección en /dashboard/ayuda. */
export function enlaceAlManual(seccion: string): string {
  const [area, sub] = seccion.split('>').map((s) => s.trim());
  const tab = slugAyuda(area ?? '');
  return `/dashboard/ayuda?tab=${tab}${sub ? `#${slugAyuda(sub)}` : ''}`;
}
