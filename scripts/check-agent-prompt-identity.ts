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
import { DOCTOR_TIERS } from '@healthcare/database';
import {
  AGENT_MODULES,
  ALL_TOOLS,
  FULL_SCOPE,
  TOOL_FEATURE_KEY,
  TOOL_DESCRIPTION_OVERRIDES,
  resolveAgentScope,
  buildTools,
} from '../apps/doctor/src/lib/agenda-agent/modules/registry';

/** The toggle-only rule is no longer exported (it answers half the question —
 * see registry.ts). These checks go through the real entry point instead, which
 * is what production actually calls. */
const modulesFor = (permissions: Record<string, boolean> | null) =>
  resolveAgentScope({ isOwner: false, permissions }).modules;
import { STABLE_SYSTEM_PROMPT, buildSystemPrompt } from '../apps/doctor/src/lib/agenda-agent/prompt';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
}

// 1. Owner (isOwner: true) resolves to the exact AGENT_MODULES reference.
const ownerModules = resolveAgentScope({ isOwner: true, permissions: null }).modules;
check('owner scope modules === AGENT_MODULES (reference)', ownerModules === AGENT_MODULES);

// 1b. TIERS T3: the owner fast path is keyed on the SCOPE, and an owner on a
// FULL account (or with no tier stored at all — fail-open) must land on the
// shared FULL_SCOPE reference, not an equal-looking copy.
check(
  'owner + FULL → FULL_SCOPE (reference)',
  resolveAgentScope({ isOwner: true, permissions: null, tier: 'FULL' }) === FULL_SCOPE
);
check(
  'owner + absent tier → FULL_SCOPE (fail-open)',
  resolveAgentScope({ isOwner: true, permissions: null }) === FULL_SCOPE &&
    resolveAgentScope({ isOwner: true, permissions: null, tier: null }) === FULL_SCOPE
);
check(
  'owner + UNKNOWN tier → FULL_SCOPE (fail-open, not a silent block)',
  resolveAgentScope({ isOwner: true, permissions: null, tier: 'ENTERPRISE' }) === FULL_SCOPE
);

// 2. buildSystemPrompt(full scope) === STABLE_SYSTEM_PROMPT (no scope note leaked in).
const ownerPrompt = buildSystemPrompt(FULL_SCOPE);
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
const agendaOnlyScope = resolveAgentScope({ isOwner: false, permissions: { citas: true } });
const agendaOnly = agendaOnlyScope.modules;
check('member with only citas → exactly 1 module (agenda)', agendaOnly.length === 1 && agendaOnly[0].name === 'agenda');
const agendaOnlyPrompt = buildSystemPrompt(agendaOnlyScope);
check('filtered prompt DOES contain the member-scope addendum', agendaOnlyPrompt.includes('Nota de permisos de esta cuenta'));
check('filtered prompt is shorter than the owner prompt', agendaOnlyPrompt.length < STABLE_SYSTEM_PROMPT.length);

// 6. ALL-requirements rule: flujo needs 3 toggles, partial grant excludes it.
const partialFlujo = modulesFor({ flujo: true, pagos: true, conciliacion: false });
check('flujo module needs ALL 3 toggles (partial grant excludes it)', !partialFlujo.some((m) => m.name === 'flujo'));
const fullFlujo = modulesFor({ flujo: true, pagos: true, conciliacion: true });
check('flujo module included when all 3 toggles ON', fullFlujo.some((m) => m.name === 'flujo'));

// 7. Zero-permission member gets zero modules.
const noAccess = modulesFor({});
check('member with no toggles → 0 modules', noAccess.length === 0);
check('member with null permissions → 0 modules (fail-closed)', modulesFor(null).length === 0);

// ---------------------------------------------------------------------------
// TIERS T3 — the tier ceiling, which cuts at TOOL level (docs/DESDE JUNIO/TIERS
// /01-DISENO-tecnico.md §5.2). CORE excludes facturacion/sat/conciliacion/
// ventas/compras/productos and KEEPS flujo + pagos.
// ---------------------------------------------------------------------------

const allToolNames = new Set(ALL_TOOLS.map((t) => t.name));
const strayKeys = Object.keys(TOOL_FEATURE_KEY).filter((n) => !allToolNames.has(n));
// A rename would leave a dead entry here and silently stop filtering that tool.
check(`every TOOL_FEATURE_KEY name is a real tool${strayKeys.length ? ` (stray: ${strayKeys.join(', ')})` : ''}`, strayKeys.length === 0);

const coreOwner = resolveAgentScope({ isOwner: true, permissions: null, tier: 'CORE' });
const coreNames = coreOwner.tools.map((t) => t.name);
const coreModules = coreOwner.modules.map((m) => m.name);

check('owner + CORE is NOT the full scope', !coreOwner.isFull && coreOwner.tierLimited && !coreOwner.memberLimited);
check(
  `owner + CORE keeps agenda/facturas/flujo/expediente, drops fiscal (got: ${coreModules.join(',')})`,
  coreModules.join(',') === 'agenda,facturas,flujo,expediente'
);
// The rescue: pagos tools survive INSIDE the otherwise-dropped facturas module.
check('CORE keeps get_payment_links (pagos, CORE includes it)', coreNames.includes('get_payment_links'));
check('CORE keeps get_payment_provider_status', coreNames.includes('get_payment_provider_status'));
// The original G2 case: a conciliacion tool dropped from a KEPT module.
check('CORE drops get_conciliacion_bancaria (conciliacion excluded)', !coreNames.includes('get_conciliacion_bancaria'));
check(
  'CORE keeps the other 4 flujo tools',
  ['get_flujo_status', 'get_movimientos', 'get_balance', 'get_movimiento_detail'].every((n) => coreNames.includes(n))
);
check(
  'CORE drops the CFDI tools (facturacion + sat excluded)',
  !coreNames.includes('get_cfdis') && !coreNames.includes('get_sat_cfdis') && !coreNames.includes('propose_create_cfdi')
);
check('CORE drops the fiscal tools', !coreNames.includes('get_resumen_fiscal') && !coreNames.includes('get_ppd_cobranza'));
check('CORE keeps every agenda tool', AGENT_MODULES[0].readTools.every((t) => coreNames.includes(t.name)));
// facturas+flujo because their TOOLS were trimmed; agenda+expediente because
// their PROSE routes to invoicing (prosaDependsOn) even though every tool of
// theirs survives — the distinction the bug hunt exposed.
check(
  `CORE marks agenda+expediente+facturas+flujo as partial (got: ${Array.from(coreOwner.partialModules).sort().join(',')})`,
  Array.from(coreOwner.partialModules).sort().join(',') === 'agenda,expediente,facturas,flujo'
);
// A module kept with zero tools would put its prompt section in front of the
// model while offering nothing to call.
check('no kept module ended up with zero tools', coreOwner.modules.every((m) =>
  coreOwner.tools.some((t) => [...m.readTools, ...m.proposalTools].some((mt) => mt.name === t.name))
));

const corePrompt = buildSystemPrompt(coreOwner);
check('CORE owner prompt has the TIER note', corePrompt.includes('Alcance del plan de esta cuenta'));
check('CORE OWNER prompt does NOT blame the owner (no member note)', !corePrompt.includes('Nota de permisos de esta cuenta'));
check('CORE prompt uses the partial flujo section (no reconciliation prose)', !corePrompt.includes('dos evidencias independientes'));
check('CORE prompt drops the CFDI rules section', !corePrompt.includes('EMITIR una factura (propose_create_cfdi)'));
check('CORE prompt is shorter than the owner prompt (cheaper prefix)', corePrompt.length < STABLE_SYSTEM_PROMPT.length);
console.log(`    CORE prompt = ${corePrompt.length} chars vs FULL ${STABLE_SYSTEM_PROMPT.length} (${Math.round((1 - corePrompt.length / STABLE_SYSTEM_PROMPT.length) * 100)}% smaller), ${coreOwner.tools.length} tools vs ${ALL_TOOLS.length}`);

// A member on a FULL account must see the member note and NOT the tier one.
const memberFull = resolveAgentScope({ isOwner: false, permissions: { citas: true }, tier: 'FULL' });
const memberFullPrompt = buildSystemPrompt(memberFull);
check('member on FULL: member note, no tier note',
  memberFullPrompt.includes('Nota de permisos de esta cuenta') && !memberFullPrompt.includes('Alcance del plan de esta cuenta'));

// The asymmetry documented in §5.2: a member on a CORE account lands on the
// SAME tool set the CORE owner would, for the modules they share.
const memberCore = resolveAgentScope({
  isOwner: false,
  permissions: { flujo: true, pagos: true, conciliacion: true },
  tier: 'CORE',
});
const memberCoreNames = memberCore.tools.map((t) => t.name);
check(
  'member on CORE with all 3 flujo toggles → flujo module, WITHOUT the conciliacion tool',
  memberCore.modules.map((m) => m.name).join(',') === 'flujo' &&
    !memberCoreNames.includes('get_conciliacion_bancaria') &&
    memberCoreNames.includes('get_flujo_status')
);
const memberCorePrompt = buildSystemPrompt(memberCore);
check('member on CORE gets BOTH notes (plan ceiling + owner toggles)',
  memberCorePrompt.includes('Alcance del plan de esta cuenta') && memberCorePrompt.includes('Nota de permisos de esta cuenta'));

// buildTools stays the toggle-only helper the rest of the code still uses.
check('buildTools(CORE modules) is NOT the tier-filtered set (tier cuts at tool level)',
  buildTools(coreOwner.modules).length > coreOwner.tools.length);

// ---------------------------------------------------------------------------
// T3 bug-hunt guards — every one of these caught (or would have caught) a real
// defect where a tier-narrowed prompt kept describing a feature the plan drops.
// They exist because the fixes are TEXT-MATCHING (a .replace / a description
// swap): if the upstream wording is edited, the swap silently no-ops and the
// false claim comes back with no test failing.
// ---------------------------------------------------------------------------

for (const tier of DOCTOR_TIERS) {
  const s = resolveAgentScope({ isOwner: true, permissions: null, tier });

  // A module rendered "partial" without a variant silently falls back to the
  // FULL prose — exactly the bug the partial mechanism exists to prevent.
  const noVariant = s.modules.filter((m) => s.partialModules.has(m.name) && !m.prompt.partial);
  check(
    `tier ${tier}: every partial module has a \`partial\` prompt variant${noVariant.length ? ` (missing: ${noVariant.map((m) => m.name).join(', ')})` : ''}`,
    noVariant.length === 0
  );

  // A variant identical to the full text means a .replace() found nothing.
  const noopVariant = s.modules.filter((m) => {
    if (!s.partialModules.has(m.name) || !m.prompt.partial) return false;
    const p = m.prompt.partial;
    return p.domainModel === m.prompt.domainModel && p.domainRules === m.prompt.domainRules;
  });
  check(
    `tier ${tier}: no partial variant is a no-op copy of the full text${noopVariant.length ? ` (${noopVariant.map((m) => m.name).join(', ')})` : ''}`,
    noopVariant.length === 0
  );
}

// CENTINELA de la frontera de facturación. Era 'se emite desde la tabla de
// citas', que el punto A del plan 07 corrigió: esa frase solo era cierta al
// completar una cita cuyo paciente YA tiene datos fiscales. El centinela nuevo es
// la CONDICIÓN, no un destino — nombrar el expediente acoplaba la prosa de agenda
// a un permiso que agenda no exige (ver el comentario de AGENDA_CITAS_RULES).
// Sigue siendo una frase LITERAL a propósito: el `.replace()` de la variante CORE
// y el `from` del override de descripción son text-matching, y sin una aserción
// que los ancle un reword los convierte en no-ops mudos (bitácora #26).
// 2026-08-13: la casilla "Emitir factura (CFDI)" salió del modal de Completar, así
// que la condición vieja ("...pero solo si el paciente ya tiene datos fiscales
// COMPLETOS") describía un botón que ya no existe. El ancla ahora es la frase que
// SEPARA los dos pasos — y sigue teniendo que vivir en los DOS caminos (prosa del
// módulo y descripción del tool), que es lo que este check protege.
const CONDICION_FACTURACION = 'completar y facturar son pasos SEPARADOS';

// The prose check runs on what the scope PROVIDES, so it must fire on the
// MEMBER axis too — not just the tier (TIERS 01-DISENO §11.5.1).
const memberCitasOnly = resolveAgentScope({ isOwner: false, permissions: { citas: true } });
check(
  'member without invoicing → agenda is partial (no CFDI-at-completion prose)',
  memberCitasOnly.partialModules.has('agenda') &&
    !buildSystemPrompt(memberCitasOnly).includes(CONDICION_FACTURACION)
);

// The real prod member's shape: facturas+fiscal but NO flujo (needs 3 toggles).
const memberRealShape = resolveAgentScope({
  isOwner: false,
  permissions: { citas: true, sat: true, facturacion: true, expedientes: true },
});
check(
  'real member shape → fiscal is partial (its tie-break points at absent ledger tools)',
  memberRealShape.partialModules.has('fiscal')
);
check(
  'real member shape → fiscal prose no longer routes day-to-day money to the ledger',
  !buildSystemPrompt(memberRealShape).includes('viven en el ledger (get_balance/get_movimientos')
);
check(
  'real member shape → agenda/expediente NOT partial (they DO have invoicing)',
  !memberRealShape.partialModules.has('agenda') && !memberRealShape.partialModules.has('expediente')
);
// The case key-based checking would have missed: the toggle is ON, but the
// module needs all three, so the ledger tools are absent anyway.
const memberFlujoPartial = resolveAgentScope({
  isOwner: false,
  permissions: { citas: true, sat: true, facturacion: true, flujo: true },
});
check(
  'member with flujo toggle but NOT pagos/conciliacion → fiscal still partial',
  memberFlujoPartial.partialModules.has('fiscal')
);

// The description swap must still match the real tool text.
const staleOverrides = TOOL_DESCRIPTION_OVERRIDES.filter((o) => {
  const tool = ALL_TOOLS.find((t) => t.name === o.tool);
  return !tool || !tool.description?.includes(o.from);
});
check(
  `every TOOL_DESCRIPTION_OVERRIDES \`from\` still matches its tool${staleOverrides.length ? ` (stale: ${staleOverrides.map((o) => o.tool).join(', ')})` : ''}`,
  staleOverrides.length === 0
);

// End-to-end on the prose bugs: the CORE prompt and toolset must not route the
// doctor to features the plan excludes.
const corePromptText = buildSystemPrompt(coreOwner);
check(
  'CORE prompt does NOT describe emitting the CFDI when completing a cita',
  !corePromptText.includes(CONDICION_FACTURACION)
);
// NOTE: this targets the MODULE prose, not the whole prompt. INTRO is shared,
// byte-frozen for owners, and enumerates every capability by design — a CORE
// prompt WILL still mention get_billing_status there. Neutralizing that is the
// scope notes' job (the PR C tradeoff, NUEVOS USUARIOS 01-DISENO §13); asserting
// its absence would contradict the byte-identity invariant.
check(
  'CORE module prose does NOT route to the dropped facturas tools',
  !corePromptText.includes('dinero/facturas del paciente = get_billing_status') &&
    !corePromptText.includes('datos FISCALES y contacto =')
);
check(
  'CORE tool descriptions do NOT route to the dropped facturas tools',
  !coreOwner.tools.some((t) => t.description?.includes('dinero = get_billing_status'))
);
check(
  'CORE tool descriptions do NOT describe emitting the CFDI at completion',
  !coreOwner.tools.some((t) => t.description?.includes(CONDICION_FACTURACION))
);
// The FULL path keeps the route in BOTH places. Que aparezca en los dos es lo que
// hace que el punto A no se pueda dejar a medias: la prosa y la descripción del
// tool viajan por caminos distintos y se editan por separado.
check(
  'FULL prompt KEEPS the invoicing route (prose + tool description)',
  STABLE_SYSTEM_PROMPT.includes(CONDICION_FACTURACION) &&
    ALL_TOOLS.some((t) => t.description?.includes(CONDICION_FACTURACION))
);
// La frase VIEJA no debe sobrevivir en ningún lado: si reaparece es que alguien
// revirtió media edición de A y el prompt volvió a prometer la ruta incompleta.
check(
  'la ruta VIEJA ("tabla de citas") ya no aparece en el prompt ni en las tools',
  !STABLE_SYSTEM_PROMPT.includes('se emite desde la tabla de citas') &&
    !ALL_TOOLS.some((t) => t.description?.includes('se emite desde la tabla de citas'))
);
// Nota: que la prosa de agenda no ENRUTE al expediente (acoplaría un permiso que
// agenda no exige — 12 de 66 scopes, plan 07 punto A) lo cubre `gate:prosa`, que
// distingue MENCIONAR de MANDAR con su ROUTING_CUE. Aquí se intentó un chequeo
// propio y era un falso positivo: AGENDA_CITAS_RULES dice legítimamente "la cita
// queda vinculada al expediente", que no manda a nadie a ningún lado.

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
