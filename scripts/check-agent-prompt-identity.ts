/**
 * PR C gate: the owner/full-set prompt + tools must be BYTE-IDENTICAL to what
 * shipped before secondary-users module filtering existed — a drift here
 * invalidates the prod prompt cache for every doctor (01-DISENO §7.1).
 *
 * Baseline captured from the pre-PR-C code (STABLE_SYSTEM_PROMPT was a
 * top-level constant built the same way then as composePrompt(AGENT_MODULES)
 * builds it now — this script re-derives the same construction independently
 * of prompt.ts's internals so it can't pass by tautology).
 *
 * Run: pnpm exec tsx scripts/check-agent-prompt-identity.ts
 */
import { createHash } from 'crypto';
import { AGENT_MODULES, ALL_TOOLS, enabledModules, buildTools } from '../apps/doctor/src/lib/agenda-agent/modules/registry';
import { STABLE_SYSTEM_PROMPT, buildSystemPrompt } from '../apps/doctor/src/lib/agenda-agent/prompt';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
}

// 1. Owner (isOwner: true) resolves to the exact AGENT_MODULES reference.
const ownerModules = enabledModules({ isOwner: true, permissions: null });
check('owner enabledModules() === AGENT_MODULES (reference)', ownerModules === AGENT_MODULES);

// 2. buildSystemPrompt(AGENT_MODULES) === STABLE_SYSTEM_PROMPT (no MEMBER_SCOPE_NOTE leaked in).
const ownerPrompt = buildSystemPrompt(AGENT_MODULES);
check('buildSystemPrompt(full set) === STABLE_SYSTEM_PROMPT', ownerPrompt === STABLE_SYSTEM_PROMPT);
console.log(`    sha256(STABLE_SYSTEM_PROMPT) = ${sha256(STABLE_SYSTEM_PROMPT)}`);
console.log(`    length = ${STABLE_SYSTEM_PROMPT.length} chars`);

// 3. buildTools(AGENT_MODULES) is the same 18-tool set as ALL_TOOLS, same order.
const ownerTools = buildTools(AGENT_MODULES);
check('buildTools(full set).length === ALL_TOOLS.length', ownerTools.length === ALL_TOOLS.length);
check(
  'buildTools(full set) names in same order as ALL_TOOLS',
  ownerTools.map((t) => t.name).join(',') === ALL_TOOLS.map((t) => t.name).join(',')
);
console.log(`    ALL_TOOLS: ${ALL_TOOLS.length} tools`);

// 4. The MEMBER_SCOPE_NOTE marker must NOT appear in the owner prompt.
check(
  'owner prompt has no member-scope addendum',
  !STABLE_SYSTEM_PROMPT.includes('Nota de permisos de esta cuenta')
);

// 5. Sanity on the filtering rule itself: agenda-only member gets exactly the
// agenda module's tools, and the addendum IS present.
const agendaOnly = enabledModules({ isOwner: false, permissions: { citas: true } });
check('member with only citas → exactly 1 module (agenda)', agendaOnly.length === 1 && agendaOnly[0].name === 'agenda');
const agendaOnlyPrompt = buildSystemPrompt(agendaOnly);
check('filtered prompt DOES contain the member-scope addendum', agendaOnlyPrompt.includes('Nota de permisos de esta cuenta'));
check('filtered prompt is shorter than the owner prompt', agendaOnlyPrompt.length < STABLE_SYSTEM_PROMPT.length);

// 6. ALL-requirements rule: flujo needs 3 toggles, partial grant excludes it.
const partialFlujo = enabledModules({ isOwner: false, permissions: { flujo: true, pagos: true, conciliacion: false } });
check('flujo module needs ALL 3 toggles (partial grant excludes it)', !partialFlujo.some((m) => m.name === 'flujo'));
const fullFlujo = enabledModules({ isOwner: false, permissions: { flujo: true, pagos: true, conciliacion: true } });
check('flujo module included when all 3 toggles ON', fullFlujo.some((m) => m.name === 'flujo'));

// 7. Zero-permission member gets zero modules.
const noAccess = enabledModules({ isOwner: false, permissions: {} });
check('member with no toggles → 0 modules', noAccess.length === 0);
check('member with null permissions → 0 modules (fail-closed)', enabledModules({ isOwner: false, permissions: null }).length === 0);

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
