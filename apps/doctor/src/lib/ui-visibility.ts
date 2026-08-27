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

/**
 * 🚫 OCULTO 2026-08-27 — el widget flotante de AYUDA (el del signo de interrogación,
 * `HelpCircle`): `components/llm-assistant/ChatWidget`, el chat RAG sobre los docs.
 *
 * Se queda montado el resto de la pila flotante: 📅 `DayDetailsWidget` y 🎤
 * `VoiceAssistantHubWidget`. Su endpoint `/api/llm-assistant/chat` sigue vivo — de hecho
 * este widget ya tenía retiro planeado en PR 4 (ver
 * `docs/DESDE JUNIO/AGENTES/INVENTARIO IA/01-INVENTARIO-donde-vive-cada-chat.md`).
 */
export const WIDGET_AYUDA_VISIBLE = false;
