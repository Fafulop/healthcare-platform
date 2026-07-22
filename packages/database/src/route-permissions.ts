/**
 * Route→toggle map + matcher for secondary-user enforcement (PR B).
 *
 * Consumed by the TWO auth choke points only:
 *  - apps/api validateAuthToken (after effective-access resolution)
 *  - apps/doctor medical-auth requireDoctorAuth
 * Owners and ADMINs never reach the check. For MEMBERS the map is FAIL-CLOSED:
 * an authenticated route that matches no rule is blocked (403), so future
 * routes are member-blocked until someone maps them (G9). Public/webhook/cron
 * endpoints never call these helpers, so they are unaffected by design.
 *
 * Matching rules:
 *  - prefixes are segment-bounded ('medical-records' does NOT match
 *    'medical-records-export') and support a single-segment wildcard
 *    (e.g. doctors, WILDCARD, google-calendar).
 *  - the MOST SPECIFIC (longest, in segments) matching rule wins — required:
 *    'medical-records/tasks' (tareas) vs 'medical-records' (expedientes).
 *  - at equal specificity, a rule with `methods` beats one without.
 *
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §4.3
 */

import { hasPermission, type PermissionKey, type PermissionSet } from './permissions';

export type RouteAccessKey = PermissionKey | 'NEUTRAL' | 'OWNER_ONLY';

export interface RouteRule {
  /** Path prefix after '/api/', e.g. 'appointments' or 'doctors' + WILDCARD + 'telegram'. */
  prefix: string;
  key: RouteAccessKey;
  /** If set, the rule only applies to these upper-cased HTTP methods. */
  methods?: string[];
}

export const ROUTE_PERMISSION_MAP: RouteRule[] = [
  // ── apps/api ────────────────────────────────────────────────────────────
  { prefix: 'appointments', key: 'citas' },
  { prefix: 'calendar', key: 'citas' },
  { prefix: 'doctors/*/availability', key: 'citas' },
  { prefix: 'doctors/*/range-availability', key: 'citas' },
  { prefix: 'doctors/*/booking-field-settings', key: 'citas' },
  { prefix: 'doctors/*/articles', key: 'blog' },
  // Integraciones (owner's Google / Telegram) — owner-only regardless of toggles
  { prefix: 'doctors/*/google-calendar', key: 'OWNER_ONLY' },
  { prefix: 'doctors/*/telegram', key: 'OWNER_ONLY' },
  // Profile reads feed many surfaces (public profile data, service/location
  // pickers) → neutral; profile WRITES are the Editar Perfil toggle.
  { prefix: 'doctors', key: 'NEUTRAL', methods: ['GET'] },
  { prefix: 'doctors', key: 'perfil' },

  { prefix: 'articles', key: 'blog' },
  { prefix: 'reviews', key: 'perfil' },
  { prefix: 'settings', key: 'perfil' },

  // Legal certificate configuration = the doctor's fiscal identity → owner-only
  // csd/status is a READ (booleans + RFC/taxName, never the private key) —
  // a member with facturacion:true needs it just to know whether emission is
  // possible; the facturacion page's tabs gate on it (isReady). Found live
  // 2026-07-21: without this split, a member's status check 403'd, isReady
  // stayed false, and Facturación silently showed only Configuración+Guía.
  // The actual CSD upload (facturacion/csd, no /status suffix) stays
  // OWNER_ONLY — that endpoint handles the private key material.
  { prefix: 'facturacion/csd/status', key: 'facturacion' },
  { prefix: 'facturacion/csd', key: 'OWNER_ONLY' },
  { prefix: 'facturacion', key: 'facturacion' },
  // GET/POST/DELETE all share this exact URL (unlike CSD's separate
  // /status path) — GET is status-only (booleans + dates + RFC, no private
  // key: apps/api/src/app/api/sat-descarga/fiel/route.ts:91-120), needed by
  // a member with sat:true just to see e.Firma status. POST (upload) and
  // DELETE (revoke) touch the encrypted credential itself — OWNER_ONLY.
  // Same class of bug as facturacion/csd/status, found live 2026-07-21.
  { prefix: 'sat-descarga/fiel', key: 'sat', methods: ['GET'] },
  { prefix: 'sat-descarga/fiel', key: 'OWNER_ONLY' },
  { prefix: 'sat-descarga', key: 'sat' },

  // Payment provider ONBOARDING (connect/disconnect) = owner's money accounts;
  // day-to-day payment links/preferences = the Pagos toggle. /status is a
  // READ (account id + onboarding booleans, never secret keys) needed by a
  // member with pagos:true to see connection state — same class of bug as
  // facturacion/csd/status and sat-descarga/fiel, found live 2026-07-21.
  { prefix: 'stripe/connect/status', key: 'pagos' },
  { prefix: 'stripe/connect', key: 'OWNER_ONLY' },
  { prefix: 'stripe', key: 'pagos' },
  { prefix: 'mercadopago/connect/status', key: 'pagos' },
  { prefix: 'mercadopago/connect', key: 'OWNER_ONLY' },
  { prefix: 'mercadopago', key: 'pagos' },

  { prefix: 'practice-management/ledger', key: 'flujo' },
  { prefix: 'practice-management/conciliacion-bancaria', key: 'conciliacion' },
  { prefix: 'practice-management/ventas', key: 'ventas' },
  { prefix: 'practice-management/cotizaciones', key: 'ventas' },
  { prefix: 'practice-management/clients', key: 'ventas' },
  { prefix: 'practice-management/compras', key: 'compras' },
  { prefix: 'practice-management/proveedores', key: 'compras' },
  { prefix: 'practice-management/products', key: 'productos' },
  { prefix: 'practice-management/product-attributes', key: 'productos' },
  { prefix: 'practice-management/areas', key: 'productos' },

  { prefix: 'analytics', key: 'reportes' },
  { prefix: 'llm-usage', key: 'reportes' },

  { prefix: 'auth', key: 'NEUTRAL' },
  { prefix: 'users', key: 'NEUTRAL' }, // admin-guarded by requireAdminAuth on top
  { prefix: 'admin', key: 'NEUTRAL' }, // admin-guarded by requireAdminAuth on top (helpers view etc.)
  { prefix: 'uploadthing', key: 'NEUTRAL' },

  // ── apps/doctor internal ────────────────────────────────────────────────
  { prefix: 'medical-records/tasks', key: 'tareas' }, // specific beats expedientes
  { prefix: 'medical-records', key: 'expedientes' },
  { prefix: 'custom-templates', key: 'expedientes' },
  { prefix: 'notes', key: 'notas' },
  { prefix: 'bank-statement-import', key: 'conciliacion' },
  { prefix: 'bank-statement-parse', key: 'conciliacion' },

  // Print settings dialog lives in the expediente surface
  { prefix: 'doctor/pdf-settings', key: 'expedientes' },
  { prefix: 'doctor', key: 'NEUTRAL', methods: ['GET'] }, // DoctorProfileContext feeds the whole dashboard
  { prefix: 'doctor', key: 'perfil' },

  // Agent panel (module filtering on top of this — PR C)
  { prefix: 'agenda-agent', key: 'asistente_ia' },

  // Legacy AI surfaces: owner-only in v1 (00-REQUISITOS §5.3)
  { prefix: 'appointments-chat', key: 'OWNER_ONLY' },
  { prefix: 'encounter-chat', key: 'OWNER_ONLY' },
  { prefix: 'patient-chat', key: 'OWNER_ONLY' },
  { prefix: 'prescription-chat', key: 'OWNER_ONLY' },
  { prefix: 'sale-chat', key: 'OWNER_ONLY' },
  { prefix: 'purchase-chat', key: 'OWNER_ONLY' },
  { prefix: 'quotation-chat', key: 'OWNER_ONLY' },
  { prefix: 'task-chat', key: 'OWNER_ONLY' },
  { prefix: 'ledger-chat', key: 'OWNER_ONLY' },
  { prefix: 'form-builder-chat', key: 'OWNER_ONLY' },
  { prefix: 'voice', key: 'OWNER_ONLY' },
  { prefix: 'llm-assistant', key: 'OWNER_ONLY' },

  // Receta PDF identity (legal) — owner-only always (00-REQUISITOS §3.5)
  { prefix: 'prescription-template', key: 'OWNER_ONLY' },
  // Cross-block activity feed — conservative owner-only in v1
  { prefix: 'activity-logs', key: 'OWNER_ONLY' },

  { prefix: 'pwa-icon', key: 'NEUTRAL' },

  // Team (NUEVOS USUARIOS PR D): my-invites is reachable by ANY authenticated
  // user (own pending invites, even with no doctor at all) — it bypasses
  // requireDoctorAuth entirely (requireAnyAuth), so this rule never actually
  // fires for it; kept for inventory-script completeness. Everything else
  // under /team is owner-only (Equipo tab backend) — checked via
  // requireOwnerAuth's own isOwner guard, not just this map (00-REQUISITOS §3.4).
  { prefix: 'team/my-invites', key: 'NEUTRAL' },
  { prefix: 'team', key: 'OWNER_ONLY' },
];

/** Authenticated route paths intentionally NOT in the map because they never
 * authenticate via the two choke points (public patient flows, webhooks, cron).
 * Used by the inventory guard script, not by the runtime matcher. */
export const UNMAPPED_PUBLIC_PREFIXES = [
  'appointment-form',
  'fiscal-form',
  'cron',
  'telegram/webhook',
  'calendar/webhook',
  'stripe/webhook',
  'mercadopago/webhook',
  'mercadopago/connect/callback',
] as const;

/**
 * Doctor-app PAGE map (pathname under /dashboard → toggle). Drives the sidebar
 * filter and the PermissionGate. Longest prefix wins (same matcher semantics).
 * '/dashboard' home and unlisted pages are NOT gated client-side — their data
 * calls still die on the API check (the real boundary).
 */
export const PAGE_PERMISSION_MAP: Array<{ prefix: string; key: PermissionKey }> = [
  { prefix: '/dashboard/mi-perfil', key: 'perfil' },
  { prefix: '/dashboard/contenido-audiovisual', key: 'contenido' },
  { prefix: '/dashboard/blog', key: 'blog' },
  { prefix: '/dashboard/appointments', key: 'citas' },
  { prefix: '/dashboard/medical-records', key: 'expedientes' },
  { prefix: '/dashboard/pendientes', key: 'tareas' },
  { prefix: '/dashboard/notas', key: 'notas' },
  { prefix: '/dashboard/reportes', key: 'reportes' },
  { prefix: '/dashboard/practice/flujo-de-dinero', key: 'flujo' },
  { prefix: '/dashboard/pagos', key: 'pagos' },
  { prefix: '/dashboard/facturacion', key: 'facturacion' },
  { prefix: '/dashboard/sat-descarga', key: 'sat' },
  { prefix: '/dashboard/practice/conciliacion-bancaria', key: 'conciliacion' },
  { prefix: '/dashboard/practice/ventas', key: 'ventas' },
  { prefix: '/dashboard/practice/cotizaciones', key: 'ventas' },
  { prefix: '/dashboard/practice/compras', key: 'compras' },
  { prefix: '/dashboard/practice/proveedores', key: 'compras' },
  { prefix: '/dashboard/practice/products', key: 'productos' },
  { prefix: '/dashboard/practice/product-attributes', key: 'productos' },
  { prefix: '/dashboard/practice/areas', key: 'productos' },
  { prefix: '/dashboard/practice/master-data', key: 'productos' },
  { prefix: '/dashboard/ayuda', key: 'ayuda' },
];

/** Toggle governing a dashboard page, or null if the page is ungated (home). */
export function pagePermissionKey(pathname: string): PermissionKey | null {
  const clean = pathname.replace(/\/+$/, '');
  let best: { key: PermissionKey; len: number } | null = null;
  for (const entry of PAGE_PERMISSION_MAP) {
    if (clean === entry.prefix || clean.startsWith(entry.prefix + '/')) {
      const len = segments(entry.prefix).length;
      if (!best || len > best.len) best = { key: entry.key, len };
    }
  }
  return best?.key ?? null;
}

interface RouteDecision {
  allowed: boolean;
  /** Toggle that authorized (or blocked) the request; null for NEUTRAL/unmapped. */
  toggle: PermissionKey | null;
  /** Why, for the 403 body / audit trail. */
  reason: 'neutral' | 'toggle_on' | 'toggle_off' | 'owner_only' | 'unmapped';
}

function segments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

function prefixMatches(prefixSegs: string[], pathSegs: string[]): boolean {
  if (prefixSegs.length > pathSegs.length) return false;
  for (let i = 0; i < prefixSegs.length; i++) {
    if (prefixSegs[i] !== '*' && prefixSegs[i] !== pathSegs[i]) return false;
  }
  return true;
}

/**
 * Decide whether a MEMBER may hit this route. Never call for owners/admins.
 * `pathname` is the full URL pathname (e.g. '/api/appointments/bookings/17').
 */
export function checkRoutePermission(
  pathname: string,
  method: string,
  permissions: PermissionSet | null
): RouteDecision {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  const apiIdx = clean.indexOf('/api/');
  const rel = apiIdx >= 0 ? clean.slice(apiIdx + 5) : clean.replace(/^\/+/, '');
  const pathSegs = segments(rel);
  const upperMethod = method.toUpperCase();

  let best: { rule: RouteRule; len: number } | null = null;
  for (const rule of ROUTE_PERMISSION_MAP) {
    if (rule.methods && !rule.methods.includes(upperMethod)) continue;
    const prefixSegs = segments(rule.prefix);
    if (!prefixMatches(prefixSegs, pathSegs)) continue;
    if (
      !best ||
      prefixSegs.length > best.len ||
      (prefixSegs.length === best.len && rule.methods && !best.rule.methods)
    ) {
      best = { rule, len: prefixSegs.length };
    }
  }

  if (!best) return { allowed: false, toggle: null, reason: 'unmapped' }; // fail-closed
  if (best.rule.key === 'NEUTRAL') return { allowed: true, toggle: null, reason: 'neutral' };
  if (best.rule.key === 'OWNER_ONLY') return { allowed: false, toggle: null, reason: 'owner_only' };

  const key = best.rule.key as PermissionKey;
  return hasPermission(permissions, key)
    ? { allowed: true, toggle: key, reason: 'toggle_on' }
    : { allowed: false, toggle: key, reason: 'toggle_off' };
}
