/**
 * Route-inventory guard (PR B, 02-METODO angle 7): walks every route.ts under
 * apps/api and apps/doctor's app/api trees and asserts each one is covered by
 * ROUTE_PERMISSION_MAP, UNMAPPED_PUBLIC_PREFIXES, or an explicit allowlist
 * below. Fails (exit 1) on the first unmapped route.
 *
 * Run: pnpm exec tsx scripts/check-route-permission-coverage.ts
 *
 * Why this exists: checkRoutePermission() is fail-closed for members by
 * design (unmapped = blocked) — that's the correct default for THEM, but a
 * route nobody classified is a silent trap for the next person who adds one.
 * This script is the "did we forget something" half of fail-closed.
 */
import { readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import {
  ROUTE_PERMISSION_MAP,
  UNMAPPED_PUBLIC_PREFIXES,
  checkRoutePermission,
  nearestFeatureKey,
} from '../packages/database/src/route-permissions';
import { TIER_EXCLUDED_KEYS, DOCTOR_TIERS } from '../packages/database/src/permissions';

// Routes that authenticate via requireAdminAuth/other means and are
// intentionally outside the member permission model (not just "public").
const EXPLICIT_ALLOWLIST = [
  'users', // apps/api — requireAdminAuth on top, not a member surface
  'cron', // CRON_SECRET protected
];

function findRouteFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry === 'route.ts') out.push(full);
    }
  };
  walk(root);
  return out;
}

function toApiPath(routeFile: string, apiRoot: string): string {
  const rel = relative(apiRoot, routeFile).split(sep).join('/');
  return rel.replace(/\/route\.ts$/, '');
}

function isAllowlisted(path: string): boolean {
  const first = path.split('/')[0];
  if (EXPLICIT_ALLOWLIST.includes(first)) return true;
  return UNMAPPED_PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

const roots = [
  { app: 'api', dir: join(__dirname, '..', 'apps', 'api', 'src', 'app', 'api') },
  { app: 'doctor', dir: join(__dirname, '..', 'apps', 'doctor', 'src', 'app', 'api') },
];

let unmapped: string[] = [];
let total = 0;

for (const { app, dir } of roots) {
  const files = findRouteFiles(dir);
  for (const file of files) {
    const path = toApiPath(file, dir);
    total++;
    if (isAllowlisted(path)) continue;

    // Probe with a representative mutating method (worst case for coverage —
    // GET-only NEUTRAL rules would still show up via the matcher either way).
    const decision = checkRoutePermission(`/api/${path}`, 'POST', {});
    if (decision.reason === 'unmapped') {
      unmapped.push(`[${app}] /api/${path}`);
    }
  }
}

console.log(`Checked ${total} route files across ${roots.length} apps.`);
console.log(`Rules in ROUTE_PERMISSION_MAP: ${ROUTE_PERMISSION_MAP.length}`);
console.log(`Explicit allowlist: ${EXPLICIT_ALLOWLIST.join(', ')}`);
console.log(`Public/webhook/cron prefixes: ${UNMAPPED_PUBLIC_PREFIXES.join(', ')}`);

if (unmapped.length > 0) {
  console.error(`\nUNMAPPED routes (${unmapped.length}) — members will 403 on ALL of these until mapped:`);
  for (const u of unmapped) console.error(`  - ${u}`);
  process.exit(1);
}

console.log('\nAll routes covered. OK.');

// ── TIERS: cada key excluida por un tier debe resolver a ≥1 ruta real vía
// nearest-feature-key; si no, la exclusión del plan no muerde nada (bug). Cubre
// las rutas de apps/api Y apps/doctor que ya recorrimos arriba. Diseño §7.
const apiFilePaths: string[] = [];
for (const { dir } of roots) for (const f of findRouteFiles(dir)) apiFilePaths.push(`/api/${toApiPath(f, dir)}`);
const excludedKeys = [...new Set(DOCTOR_TIERS.flatMap((t) => TIER_EXCLUDED_KEYS[t]))];
const uncovered: string[] = [];
for (const key of excludedKeys) {
  // ¿alguna ruta real resuelve a esta key por nearest-feature-key (con GET o POST)?
  const hit = apiFilePaths.some(
    (p) => nearestFeatureKey(p, 'GET') === key || nearestFeatureKey(p, 'POST') === key
  );
  if (!hit) uncovered.push(key);
}
console.log(`\nTIERS: keys excluibles por tier: ${excludedKeys.join(', ')}`);
if (uncovered.length > 0) {
  console.error(`TIERS FAIL — keys excluidas sin ruta que las gatee (la exclusión no muerde): ${uncovered.join(', ')}`);
  process.exit(1);
}
console.log('TIERS: todas las keys excluibles tienen cobertura de ruta. OK.');
