/**
 * Interruptores de VISIBILIDAD de la UI del doctor.
 *
 * Todo lo que hay aquí está **oculto a propósito, no borrado**: la funcionalidad, sus rutas
 * y sus endpoints siguen vivos e intactos. Poner un flag en `true` lo devuelve completo.
 *
 * Regla al apagar algo: hay que tapar **TODAS** las puertas, y en este app siempre son al
 * menos dos — la navegación de escritorio (`Sidebar`) y la de teléfono (`MobileDrawer`).
 * Tapar una sola deja la función alcanzable justo en la vista donde no la buscaste.
 *
 * (El asistente 🟢 tiene el suyo aparte, más viejo, en
 * `lib/agenda-agent/feature-flag.ts` → `ASISTENTE_IA_VISIBLE`.)
 */

/**
 * 🚫 OCULTO 2026-08-27 — Conciliación Bancaria no se va a usar por ahora.
 *
 * Cubre las DOS entradas de menú: `Sidebar` (escritorio) y `MobileDrawer` (teléfono).
 * La ruta `/dashboard/practice/conciliacion-bancaria` sigue existiendo y respondiendo a
 * quien la escriba a mano; esto quita la puerta del menú, no cierra la página.
 */
export const CONCILIACION_BANCARIA_VISIBLE = false;

// (2026-09-22) `WIDGET_AYUDA_VISIBLE` se retiró: apagaba el `llm-assistant/ChatWidget` (RAG
// sobre los docs de desarrollo), que ya no se monta. Su lugar en la pila flotante lo tomó
// `components/ayuda/AyudaWidget`, que no depende de ningún flag — ver AYUDA WIDGET/.
