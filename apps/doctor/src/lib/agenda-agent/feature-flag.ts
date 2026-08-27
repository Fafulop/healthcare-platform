/**
 * Visibilidad del asistente (el panel VERDE) en la UI del doctor.
 *
 * 🔴 OCULTO A PROPÓSITO desde 2026-08-27: el asistente todavía no está listo
 * para doctores reales, así que no debe haber ninguna puerta hacia él en la
 * interfaz. **No es un borrado ni una desactivación del flujo**: el módulo, sus
 * tools, `POST /api/agenda-agent`, los evals y el toggle `asistente_ia` de la
 * pestaña Equipo siguen intactos. Poner esto en `true` lo devuelve completo.
 *
 * Cubre las TRES —y únicas— superficies que abren el panel:
 *   1. el montaje del panel        (`components/layout/DashboardLayout.tsx`)
 *   2. la pestaña verde del borde  (`components/layout/DashboardLayout.tsx`)
 *   3. el botón "Asistente"        (`app/dashboard/appointments/page.tsx`)
 *
 * ⚠️ Esto oculta la UI, no cierra la puerta: la ruta del agente sigue siendo
 * alcanzable por un doctor con sesión que la llame directo.
 */
export const ASISTENTE_IA_VISIBLE = false;
