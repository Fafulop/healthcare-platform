/**
 * Permission registry for secondary users (NUEVOS USUARIOS).
 *
 * SINGLE SOURCE OF TRUTH — the four consumers (doctor-app sidebar, Equipo
 * dialog, API route→toggle map, agent module mapping) must all derive from
 * this file. Never duplicate the key list.
 *
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §2
 */

export const PERMISSION_KEYS = [
  'perfil',          // Editar Perfil (Equipo/Integraciones/Receta PDF stay owner-only regardless)
  'perfil_publico',  // external link to the public site
  'contenido',       // Contenido Audiovisual
  'blog',            // Mi Blog
  'citas',           // Mis Citas
  'expedientes',     // Expedientes Médicos (receta ISSUING stays owner-only regardless)
  'tareas',          // Tareas (routes live under /api/medical-records/tasks — specific prefix wins)
  'notas',           // Notas
  'reportes',        // Reportes (analytics + llm-usage)
  'flujo',           // Flujo de Dinero (ledger)
  'pagos',           // Pagos (stripe + mercadopago)
  'facturacion',     // Facturación (CFDI emission with the doctor's CSD IS allowed)
  'sat',             // Descarga SAT
  'conciliacion',    // Conciliación Bancaria (incl. bank-statement import/parse)
  'ventas',          // Ventas (+ cotizaciones, clients)
  'compras',         // Compras (+ proveedores)
  'productos',       // Productos y Servicios (+ product-attributes, areas)
  'ayuda',           // Ayuda
  'asistente_ia',    // master switch for the agent panel (modules filter on top, see agent mapping)
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Shape stored in doctor_members.permissions / member_invites.permissions. */
export type PermissionSet = Partial<Record<PermissionKey, boolean>>;

/** Human labels for the Equipo tab toggle list — the ONE place UI copy for a
 * toggle lives, so it never drifts from the sidebar label it corresponds to. */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  perfil: 'Editar Perfil',
  perfil_publico: 'Perfil Público',
  contenido: 'Contenido Audiovisual',
  blog: 'Mi Blog',
  citas: 'Mis Citas',
  expedientes: 'Expedientes Médicos',
  tareas: 'Tareas',
  notas: 'Notas',
  reportes: 'Reportes',
  flujo: 'Flujo de Dinero',
  pagos: 'Pagos',
  facturacion: 'Facturación',
  sat: 'Descarga SAT',
  conciliacion: 'Conciliación Bancaria',
  ventas: 'Ventas',
  compras: 'Compras',
  productos: 'Productos y Servicios',
  ayuda: 'Ayuda',
  asistente_ia: 'Asistente IA',
};

/** Safe defaults prefilling the invite dialog: agenda/organización/ayuda ON,
 * clinical + money + profile + AI OFF. */
export const INVITE_DEFAULTS: Record<PermissionKey, boolean> = {
  perfil: false,
  perfil_publico: false,
  contenido: false,
  blog: false,
  citas: true,
  expedientes: false,
  tareas: true,
  notas: true,
  reportes: false,
  flujo: false,
  pagos: false,
  facturacion: false,
  sat: false,
  conciliacion: false,
  ventas: false,
  compras: false,
  productos: false,
  ayuda: true,
  asistente_ia: false,
};

/**
 * Which permission toggles an AI-assistant module needs — ALL must be ON for a
 * member to get that module (conservative rule, 00-REQUISITOS §5.2). A module
 * absent from this map is BLOCKED for members (fail-closed, G9).
 *
 * SINGLE SOURCE (G9): lives here so every consumer shares it without drift —
 * the agent registry (member module filtering) AND the Equipo tab UI (which
 * groups/colors the toggles by module) both read this exact object. Do not copy.
 * `asistente_ia` is NOT here: it's the MASTER switch (panel on/off), enforced
 * separately, not a per-module requirement.
 */
export const AGENT_MODULE_REQUIREMENTS: Record<string, PermissionKey[]> = {
  agenda: ['citas'],
  expediente: ['expedientes'],
  flujo: ['flujo', 'pagos', 'conciliacion'],
  facturas: ['facturacion', 'sat'],
  fiscal: ['facturacion', 'sat'],
};

/**
 * FAIL-CLOSED permission check: only an explicit `true` grants access.
 * Absent keys, unknown keys, malformed values and null/undefined sets all deny
 * (G9 — future features are blocked for members until the owner enables them).
 */
export function hasPermission(perms: unknown, key: PermissionKey): boolean {
  return (
    perms !== null &&
    typeof perms === 'object' &&
    (perms as Record<string, unknown>)[key] === true
  );
}

// ---------------------------------------------------------------------------
// TIERS (planes del producto) — feature-gating por CUENTA, apilado sobre los
// permisos por-member de arriba. Un tier = TECHO a nivel de cuenta sobre el
// MISMO vocabulario de PermissionKey (las 6 funciones que CORE excluye YA son
// keys). Diseño: docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md
//
// Acceso efectivo(key) = tierAllows(tier, key) AND (isOwner ? true : hasPermission(perms, key)).
// El techo aplica a owner Y member; el check de toggles sigue siendo de members.
// ---------------------------------------------------------------------------

/** Tiers del producto. String (no enum de Postgres) para agregar tiers futuros
 * sin migración de BD — ver 01-DISENO §3.1. */
export const DOCTOR_TIERS = ['FULL', 'CORE'] as const;
export type DoctorTier = (typeof DOCTOR_TIERS)[number];

/** El tier por defecto de toda cuenta (columna default; fail-open target). */
export const DEFAULT_TIER: DoctorTier = 'FULL';

/**
 * Keys que un tier EXCLUYE de toda la cuenta (owner incluido). Fuente única —
 * las 6 de CORE mapean 1:1 a las funciones del plan base (01-DISENO §1). CORE
 * CONSERVA flujo, pagos, citas, expedientes, etc.; solo pierde estas.
 */
export const TIER_EXCLUDED_KEYS: Record<DoctorTier, readonly PermissionKey[]> = {
  FULL: [],
  CORE: ['facturacion', 'sat', 'conciliacion', 'ventas', 'compras', 'productos'],
};

/**
 * ¿La cuenta con este tier tiene acceso a esta key?
 * FAIL-OPEN a permitido si el tier es null/ausente/desconocido — nunca bloquear
 * por un dato faltante (mismo espíritu que el fallback owner de membership.ts;
 * la columna default es FULL de todos modos). Contrasta con hasPermission, que
 * es fail-closed: un member sin toggle se DENIEGA, pero una cuenta sin tier se
 * trata como FULL.
 */
export function tierAllows(tier: string | null | undefined, key: PermissionKey): boolean {
  const excluded = TIER_EXCLUDED_KEYS[(tier ?? DEFAULT_TIER) as DoctorTier];
  if (!excluded) return true; // tier desconocido ⇒ fail-open
  return !excluded.includes(key);
}
