/**
 * Route→toggle map + matcher for secondary-user enforcement (PR B) AND the
 * account-tier ceiling (TIERS T2).
 *
 * Consumed by the TWO auth choke points only:
 *  - apps/api validateAuthToken (after effective-access resolution)
 *  - apps/doctor medical-auth requireDoctorAuth
 * Two DIFFERENT reads of this one map (see the functions below):
 *  - checkRoutePermission (MEMBER toggles): owners and ADMINs never reach it;
 *    FAIL-CLOSED — an authenticated route matching no rule is blocked (403), so
 *    future routes stay member-blocked until someone maps them (G9).
 *  - tierRouteDecision (TIER ceiling, TIERS T2): applies to OWNER and MEMBER
 *    (ADMINs bypass); resolves by nearest-FEATURE-key, not most-specific-rule.
 * Public/webhook/cron endpoints never call these, so they are unaffected here;
 * their tier gating is a separate explicit call (doctorTierAllows / tiersExcluding).
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

import {
  hasPermission,
  tierAllows,
  type PermissionKey,
  type PermissionSet,
  type TierKey,
} from './permissions';

export type RouteAccessKey = PermissionKey | 'NEUTRAL' | 'OWNER_ONLY';

export interface RouteRule {
  /** Path prefix after '/api/', e.g. 'appointments' or 'doctors' + WILDCARD + 'telegram'. */
  prefix: string;
  key: RouteAccessKey;
  /** If set, the rule only applies to these upper-cased HTTP methods. */
  methods?: string[];
  /**
   * TIERS Q2 — la FUNCIÓN de plan a la que pertenece esta ruta, cuando NO se
   * puede deducir de `key`. Solo la lee `nearestFeatureKey` (el techo del
   * tier); `checkRoutePermission` (toggles de member) la IGNORA a propósito,
   * así que anotar una ruta no cambia en nada quién puede entrar hoy.
   *
   * Existe porque los flujos de IA sueltos son `OWNER_ONLY` y **no tienen un
   * prefijo padre con key de función** del que colgarse: `facturacion/csd`
   * resuelve a `facturacion` por el prefijo padre (hueco G1 del diseño v1),
   * pero `encounter-chat` no tiene padre. Sin esta anotación, ningún tier
   * puede excluir la IA (hueco G5 del plan de cuatro tiers §2).
   */
  feature?: TierKey;
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
  // OWNER_ONLY, not NEUTRAL: requireAdminAuth in each handler is still the real
  // gate (ADMINs bypass enforcement entirely and never reach this rule), but
  // NEUTRAL let a MEMBER's write PASS the member check and get logged to
  // member_audit_log before the handler's 403 — breaking the documented
  // invariant "ningún 403 logueado" (NUEVOS USUARIOS 01-DISENO §18). Blocking
  // members here rejects them earlier and writes no audit row.
  { prefix: 'admin', key: 'OWNER_ONLY' },
  { prefix: 'uploadthing', key: 'NEUTRAL' },

  // Migración de pacientes. OWNER_ONLY y no `expedientes` a propósito: una
  // cuenta de apoyo puede tener el expediente abierto y aun así no debe poder
  // cargar de golpe la base entera de pacientes. Se mapea el PREFIJO para que
  // las rutas de validar y confirmar que vienen después lo hereden solas.
  // Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/
  { prefix: 'patient-import', key: 'OWNER_ONLY' },

  // TIERS C1 — el estado de la CUENTA (plan contratado y consumo de cupos) que
  // alimenta /dashboard/cuenta. OWNER_ONLY por DOS razones independientes:
  //
  //  1. Es información comercial del dueño: cuánto le cabe, qué contrató y —en
  //     C3— qué debe. Un usuario secundario no tiene por qué verla.
  //  2. 🔴 Y es lo que impide que la pantalla que VENDE el upgrade quede
  //     bloqueada por el plan. `nearestFeatureKey` se salta las reglas
  //     OWNER_ONLY salvo que lleven `feature` (route-permissions:238), así que
  //     esta ruta NUNCA cae bajo el techo de un tier. Ponerle una key de
  //     función sería una trampa circular: la cuenta FREE no podría abrir la
  //     única pantalla que le explica qué le falta.
  //
  // Por eso tampoco lleva `feature`, y por eso /dashboard/cuenta NO va en
  // PAGE_PERMISSION_MAP. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §2/H6
  { prefix: 'account', key: 'OWNER_ONLY' },

  // ── apps/doctor internal ────────────────────────────────────────────────
  { prefix: 'medical-records/tasks', key: 'tareas' }, // specific beats expedientes
  // TIERS Q2 — las TRES rutas de IA que viven DENTRO del expediente. Su `key`
  // sigue siendo `expedientes` (exactamente lo que heredaban de la regla de
  // abajo, así que para un member no cambia nada), pero su FUNCIÓN de plan es
  // `ia`. Sin estas tres reglas, un gate por prefijo de IA no las vería: el
  // informe transcribe con `lib/voice/transcribir-audio` justo para NO pasar
  // por `/api/voice`, que es OWNER_ONLY.
  // ⚠️ `methods: ['POST']`: SOLO el POST genera el resumen con el modelo; el GET
  // lee el que ya está guardado en Postgres (`summary/route.ts` :9-41, sin una
  // sola llamada al LLM). Sin esto, excluir `ia` le quitaría al doctor la
  // LECTURA de un resumen que YA es suyo — exactamente el error que este repo
  // ya pagó en vivo dos veces (`facturacion/csd/status` y `sat-descarga/fiel`,
  // 2026-07-21). `dictar` y `chat` no lo necesitan: son POST-only.
  { prefix: 'medical-records/patients/*/summary', key: 'expedientes', feature: 'ia', methods: ['POST'] },
  { prefix: 'medical-records/patients/*/reports/*/dictar', key: 'expedientes', feature: 'ia' },
  { prefix: 'medical-records/patients/*/reports/*/chat', key: 'expedientes', feature: 'ia' },
  { prefix: 'medical-records', key: 'expedientes' },
  { prefix: 'custom-templates', key: 'expedientes' },
  { prefix: 'notes', key: 'notas' },
  { prefix: 'bank-statement-import', key: 'conciliacion' },
  // Parsea el PDF del estado de cuenta CON un LLM. Su key sigue siendo
  // `conciliacion`, pero ADEMÁS es IA: con el apilamiento de `routeTierKeys` se
  // bloquea si CUALQUIERA de las dos está excluida. Sin la anotación, un
  // BÁSICO —que hoy NO excluye `conciliacion` porque esa entrada está diferida
  // (permissions.ts §TIER_EXCLUDED_KEYS)— seguiría pagando parseo con modelo:
  // la misma fuga que Q2 existe para cerrar, colándose por otra key.
  { prefix: 'bank-statement-parse', key: 'conciliacion', feature: 'ia' },

  // Print settings dialog lives in the expediente surface
  { prefix: 'doctor/pdf-settings', key: 'expedientes' },
  { prefix: 'doctor', key: 'NEUTRAL', methods: ['GET'] }, // DoctorProfileContext feeds the whole dashboard
  { prefix: 'doctor', key: 'perfil' },

  // Agent panel (module filtering on top of this — PR C)
  { prefix: 'agenda-agent', key: 'asistente_ia' },

  // Legacy AI surfaces: owner-only in v1 (00-REQUISITOS §5.3).
  //
  // TIERS Q2: las DOCE llevan `feature: 'ia'` — siguen siendo OWNER_ONLY para
  // members (sin cambio), y además quedan bajo el techo del plan. La lista se
  // cerró cruzando TRES fuentes (el inventario de 19 superficies de
  // `../AGENTES/INVENTARIO IA/01`, `ls` de `app/api/`, y un grep de quién
  // importa un cliente LLM); `appointments-chat` faltaba en el plan original
  // por vivir fuera de este bloque de comentario.
  { prefix: 'appointments-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'encounter-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'patient-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'prescription-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'sale-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'purchase-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'quotation-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'task-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'ledger-chat', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'form-builder-chat', key: 'OWNER_ONLY', feature: 'ia' },
  // Cubre voice/transcribe, voice/structure y voice/chat (prefijo por segmento).
  { prefix: 'voice', key: 'OWNER_ONLY', feature: 'ia' },
  { prefix: 'llm-assistant', key: 'OWNER_ONLY', feature: 'ia' },

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

/**
 * TIER resolution (distinta de la de MEMBER) — "nearest feature key".
 *
 * El check de MEMBER usa la regla MÁS ESPECÍFICA (leaf), pero algunas rutas
 * dentro de una función tier-able tienen leaf key OWNER_ONLY, no la key de la
 * función: `facturacion/csd`, `sat-descarga/fiel` POST/DELETE. Para el TIER
 * necesitamos la FUNCIÓN a la que pertenece la ruta, así que resolvemos a la
 * regla más larga cuya key sea una PermissionKey real (ignorando OWNER_ONLY/
 * NEUTRAL). Así `facturacion/csd` → `facturacion` y el techo del tier lo caza.
 * Hueco G1 del diseño (01-DISENO §4.3). NEUTRAL/OWNER_ONLY sin key de función
 * por encima ⇒ null (el tier no aplica; lo decide el check normal).
 */
export function nearestFeatureKey(pathname: string, method: string): TierKey | null {
  return routeTierKeys(pathname, method).displayKey;
}

/**
 * TODAS las keys de función bajo las que cae una ruta para el TECHO del tier —
 * la de la FUNCIÓN a la que pertenece por prefijo (`key`) **y** la anotada
 * (`feature`). Se devuelven las DOS porque **se apilan, no se sustituyen**.
 *
 * 🔴 Por qué (hallazgo del review de Q2a): la primera versión resolvía
 * `feature ?? key`, así que anotar `…/patients/[id]/summary` con `feature: 'ia'`
 * la sacaba de `expedientes`. Un plan que excluyera `expedientes` habría
 * negado TODO `/api/medical-records/*` **menos** esas tres rutas, que se
 * colaban por `ia` — el resumen con IA de un expediente seguía alcanzable en
 * un plan sin expedientes. Una anotación cuyo contrato es "no cambia quién
 * entra" no puede AMPLIAR el acceso; con el apilamiento no puede.
 *
 * `displayKey` es la que se le REPORTA al cliente cuando no hay bloqueo
 * (la anotada gana, que es la que describe mejor la función); cuál causó el
 * bloqueo lo decide `tierRouteDecision`.
 */
export function routeTierKeys(
  pathname: string,
  method: string
): { displayKey: TierKey | null; keys: TierKey[] } {
  const clean = pathname.split('?')[0].replace(/\/+$/, '');
  const apiIdx = clean.indexOf('/api/');
  const rel = apiIdx >= 0 ? clean.slice(apiIdx + 5) : clean.replace(/^\/+/, '');
  const pathSegs = segments(rel);
  const upperMethod = method.toUpperCase();

  // Dos "mejores" independientes: la regla más específica con key de FUNCIÓN,
  // y la regla más específica con `feature`. Pueden venir de reglas distintas.
  let bestKey: { key: PermissionKey; len: number } | null = null;
  let bestFeature: { key: TierKey; len: number } | null = null;

  for (const rule of ROUTE_PERMISSION_MAP) {
    if (rule.methods && !rule.methods.includes(upperMethod)) continue;
    const prefixSegs = segments(rule.prefix);
    if (!prefixMatches(prefixSegs, pathSegs)) continue;

    if (rule.feature && (!bestFeature || prefixSegs.length > bestFeature.len)) {
      bestFeature = { key: rule.feature, len: prefixSegs.length };
    }
    // NEUTRAL/OWNER_ONLY no son keys de función: no aportan techo por sí solas.
    if (
      rule.key !== 'NEUTRAL' &&
      rule.key !== 'OWNER_ONLY' &&
      (!bestKey || prefixSegs.length > bestKey.len)
    ) {
      bestKey = { key: rule.key, len: prefixSegs.length };
    }
  }

  const keys: TierKey[] = [];
  if (bestFeature) keys.push(bestFeature.key);
  if (bestKey && bestKey.key !== bestFeature?.key) keys.push(bestKey.key);

  return { displayKey: bestFeature?.key ?? bestKey?.key ?? null, keys };
}

/**
 * Decisión del TECHO del tier para una ruta (TIERS T2). Aplica a OWNER Y MEMBER
 * (admin nunca llega). `blocked` ⇒ la CUENTA no tiene esta función en su plan,
 * sin importar los toggles del member. Resuelve por nearest-feature-key (§4.3),
 * así que caza también los OWNER_ONLY bajo una función excluida.
 * Diseño: docs/DESDE JUNIO/TIERS/01-DISENO-tecnico.md §4.2.
 */
export function tierRouteDecision(
  pathname: string,
  method: string,
  tier: string | null | undefined
): { blocked: boolean; featureKey: TierKey | null } {
  const { displayKey, keys } = routeTierKeys(pathname, method);
  // Bloquea si CUALQUIERA de las keys aplicables está fuera del plan (se
  // apilan — ver routeTierKeys). Se reporta la que CAUSÓ el bloqueo, no la
  // "bonita": si a un plan le falta `expedientes`, el cliente tiene que oír
  // `expedientes`, no `ia`.
  const offending = keys.find((k) => !tierAllows(tier, k)) ?? null;
  return { blocked: offending !== null, featureKey: offending ?? displayKey };
}

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
