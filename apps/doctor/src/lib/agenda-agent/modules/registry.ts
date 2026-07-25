/**
 * Module registry — the single place a new domain module gets plugged in.
 *
 * Adding a module = one import + one array entry; the loop (run-turn.ts) and
 * the prompt composer (../prompt.ts) pick it up from here. Order matters and
 * must stay STABLE: it defines the tools array and the prompt section order,
 * both covered by the single cache breakpoint — reordering invalidates the
 * cache for every doctor mid-day.
 */

import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import type { ProposalContext } from '../proposals';
import type { AgentModule } from './types';
import {
  hasPermission,
  tierAllows,
  AGENT_MODULE_REQUIREMENTS,
  type PermissionKey,
  type PermissionSet,
} from '@healthcare/database';
import { agendaModule } from './agenda';
import { facturasModule } from './facturas';
import { fiscalModule } from './fiscal';
import { flujoModule } from './flujo';
import { expedienteModule } from './expediente';

export const AGENT_MODULES: AgentModule[] = [
  agendaModule,
  facturasModule,
  fiscalModule,
  flujoModule,
  expedienteModule,
];

/** The tools array for a given module set (reads then proposals, per module,
 * registry order preserved). */
export function buildTools(modules: AgentModule[]): AnthropicTool[] {
  return modules.flatMap((m) => [...m.readTools, ...m.proposalTools]);
}

/** The exact tools array the API receives for OWNERS (reads then proposals,
 * per module). Kept as a top-level constant — same value, same reference
 * semantics as before PR C — because run-turn.ts defaults to it. */
export const ALL_TOOLS = buildTools(AGENT_MODULES);

/**
 * Secondary users (NUEVOS USUARIOS PR C): which sidebar-permission toggles a
 * module requires — ALL must be ON. MOVED to @healthcare/database so the Equipo
 * tab UI can share it without pulling agent/server code into the client bundle
 * (single source, G9). Re-exported here for existing consumers (gates).
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §7.1
 */
export { AGENT_MODULE_REQUIREMENTS };

export interface AgentAccess {
  isOwner: boolean;
  permissions: PermissionSet | null;
  /** Account tier (Doctor.tier). Absent/unknown ⇒ FULL (tierAllows fail-open).
   * TIERS T3 — the ceiling applies to OWNERS TOO, unlike `permissions`. */
  tier?: string | null;
}

/**
 * The module set for this user, by MEMBER TOGGLES ONLY (the tier ceiling is
 * applied on top by resolveAgentScope — this stays the toggle rule alone so
 * the two axes never get tangled). Owners get AGENT_MODULES BY REFERENCE (not
 * a copy) so callers can detect the full set by identity.
 *
 * DELIBERATELY NOT EXPORTED (TIERS T3): it answers only half the question, and
 * its name sounds like the whole one. An outside caller reaching for it would
 * silently skip the account's plan and hand a CORE account its facturas tools.
 * `resolveAgentScope` is the only supported entry point.
 */
function enabledModules(access: AgentAccess): AgentModule[] {
  if (access.isOwner) return AGENT_MODULES;
  return AGENT_MODULES.filter((m) => {
    const required = AGENT_MODULE_REQUIREMENTS[m.name];
    if (!required) return false;
    return required.every((key) => hasPermission(access.permissions, key));
  });
}

/**
 * TIERS T3 — tools whose sub-function differs from the base feature key(s) of
 * the module they live in. ONLY these need an entry; every other tool inherits
 * its module's requirement set.
 *
 * This exists because module packaging and plan boundaries don't line up:
 * - `get_conciliacion_bancaria` is a `conciliacion` tool inside `flujo`, which
 *   CORE KEEPS — without this entry, intersecting at module level would drop
 *   the whole flujo module in CORE (TIERS 01-DISENO §5.2 G2).
 * - `get_payment_links` / `get_payment_provider_status` are `pagos` tools
 *   inside `facturas`, which CORE DROPS — the mirror case. CORE includes
 *   `pagos` (§10 Q3), so without these entries a CORE account would lose
 *   assistant capability its plan pays for.
 *
 * NOT listed on purpose: `get_guia`. Three of its four topics (facturacion,
 * sat_descarga, claves_y_reglas_cfdi) are CORE-excluded features, and gating a
 * tool by ARGUMENT value is a pattern this codebase doesn't have. CORE loses
 * the guide tool; the Guía tabs in the UI are unaffected.
 *
 * The gate (scripts/check-agent-prompt-identity.ts) asserts every name here is
 * a real tool — a rename would otherwise silently stop filtering.
 */
export const TOOL_FEATURE_KEY: Record<string, PermissionKey> = {
  get_conciliacion_bancaria: 'conciliacion',
  get_payment_links: 'pagos',
  get_payment_provider_status: 'pagos',
};

/**
 * A KEPT tool whose DESCRIPTION names a feature the plan may exclude. The
 * description travels inside the cached tools prefix, so it can't just be
 * reworded: the owner/FULL array is shared by reference and must stay
 * byte-identical (gate:prompt). These swaps therefore apply ONLY to narrowed
 * scopes, which already build their own array.
 *
 * `propose_complete_booking` survives in every tier (agenda), but its text
 * routes the doctor to "la tabla de citas" to emit the CFDI — false on a plan
 * without invoicing. The gate asserts `from` still appears in the real
 * description, so a reword upstream can't silently turn this into a no-op.
 */
const DESCRIPTION_OVERRIDES: {
  tool: string;
  key: PermissionKey;
  from: string;
  to: string;
}[] = [
  {
    tool: 'propose_complete_booking',
    key: 'facturacion',
    from: 'La factura (CFDI) NO se emite aquí — se emite desde la tabla de citas.',
    to: 'La factura (CFDI) NO se emite aquí, y en esta cuenta tampoco tienes facturación disponible: no ofrezcas emitirla ni remitas al doctor a otra sección para hacerlo.',
  },
  {
    tool: 'get_expediente_resumen',
    key: 'facturacion',
    from: ' Datos fiscales/contacto = get_patient_profile; dinero = get_billing_status.',
    to: ' En esta cuenta no tienes facturación disponible: no tienes los datos fiscales ni el dinero del paciente.',
  },
];

/** Exported for the gate only (it verifies `from` still matches the real
 * description — an upstream reword would otherwise disable the swap silently). */
export const TOOL_DESCRIPTION_OVERRIDES = DESCRIPTION_OVERRIDES;

/** Every feature key the agent's composition depends on — module requirements,
 * per-tool overrides, the prose dependencies each module declares, and the
 * description swaps. Derived, so a new module/tool/prose key is covered
 * automatically (miss one and an owner would wrongly take the FULL_SCOPE fast
 * path on a tier that DOES change their prompt). */
const AGENT_FEATURE_KEYS: PermissionKey[] = Array.from(
  new Set<PermissionKey>([
    ...Object.values(AGENT_MODULE_REQUIREMENTS).flat(),
    ...Object.values(TOOL_FEATURE_KEY),
    ...AGENT_MODULES.flatMap((m) => m.prompt.prosaDependsOn ?? []),
    ...DESCRIPTION_OVERRIDES.map((o) => o.key),
  ])
);

/** Does this tier exclude anything the agent composes with? FULL (and any
 * unknown tier, fail-open) ⇒ false ⇒ the owner fast path below. */
function tierTouchesAgent(tier: string | null | undefined): boolean {
  return AGENT_FEATURE_KEYS.some((key) => !tierAllows(tier, key));
}

/**
 * The agent's composition for one caller: which modules, which tools, and the
 * two REASONS the set may be narrower than the full one (they read
 * differently to the doctor — see prompt.ts).
 */
export interface AgentScope {
  /** Kept modules, registry order. */
  modules: AgentModule[];
  /** Tools after BOTH filters, module order, reads then proposals. */
  tools: AnthropicTool[];
  /** True ONLY for an owner on a tier that excludes nothing — the path whose
   * prompt and tools must stay byte-identical (gate:prompt). */
  isFull: boolean;
  /** Narrowed by the ACCOUNT's plan (applies to owners too). */
  tierLimited: boolean;
  /** Narrowed by this secondary user's toggles. */
  memberLimited: boolean;
  /** Modules kept but with some tools filtered out ⇒ their prompt section uses
   * the `partial` variant, because the full text describes tools that are gone. */
  partialModules: ReadonlySet<string>;
  /** The account tier, forwarded to ToolContext so a KEPT tool can strip
   * fields belonging to an excluded feature (T3 finding 4). */
  tier: string | null | undefined;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

/** Owner on a tier that excludes nothing: the pre-TIERS composition, shared by
 * reference so identity checks in run-turn/prompt keep working. */
export const FULL_SCOPE: AgentScope = {
  modules: AGENT_MODULES,
  tools: ALL_TOOLS,
  isFull: true,
  tierLimited: false,
  memberLimited: false,
  partialModules: EMPTY_SET,
  tier: null,
};

/**
 * Compose the two independent ceilings:
 *   member toggles (module granularity) THEN the account tier (tool granularity).
 *
 * The tier rule, per module:
 * - Its BASE function survives if at least ONE of its required keys is still
 *   in the plan (`flujo` = [flujo, pagos, conciliacion] keeps [flujo, pagos]
 *   in CORE ⇒ survives; `facturas` = [facturacion, sat] loses both ⇒ its base
 *   tools go).
 * - A tool with its own TOOL_FEATURE_KEY is decided by THAT key alone — which
 *   is what both rescues a `pagos` tool from a dropped module and drops a
 *   `conciliacion` tool from a kept one.
 * - A module with zero surviving tools is dropped entirely.
 *
 * Note the deliberate asymmetry (TIERS 01-DISENO §5.2): MEMBER gating is per
 * module, TIER gating is per tool. A member on a CORE account lands on the
 * same tool set as that account's owner would for the modules they share.
 */
export function resolveAgentScope(access: AgentAccess): AgentScope {
  const tierLimited = tierTouchesAgent(access.tier);
  if (access.isOwner && !tierLimited) return FULL_SCOPE;

  const byToggles = enabledModules(access);
  const modules: AgentModule[] = [];
  const tools: AnthropicTool[] = [];
  const partialModules = new Set<string>();
  /** Capabilities the FINAL toolset actually provides — the input to the prose
   * check below. Built during the same pass, consumed in a second one, because
   * a module's prose can depend on a module that comes LATER in registry order
   * (fiscal → flujo). */
  const providedKeys = new Set<PermissionKey>();
  const toolsTrimmed = new Set<string>();

  for (const m of byToggles) {
    // Absent from the requirements map ⇒ no key survives ⇒ dropped, matching
    // the fail-closed stance of enabledModules (G9). gate:docs asserts the map
    // is complete, so this is a backstop, not a live path.
    const required = AGENT_MODULE_REQUIREMENTS[m.name] ?? [];
    // The module's requirement AFTER the tier ceiling — also what its unkeyed
    // tools genuinely provide (flujo in CORE provides flujo+pagos, NOT
    // conciliacion, whose only tool was just dropped).
    const effectiveRequired = required.filter((key) => tierAllows(access.tier, key));
    const baseAllowed = effectiveRequired.length > 0;
    const all = [...m.readTools, ...m.proposalTools];
    const kept = all.filter((t) => {
      const own = TOOL_FEATURE_KEY[t.name];
      return own ? tierAllows(access.tier, own) : baseAllowed;
    });
    if (kept.length === 0) continue;
    modules.push(m);

    for (const t of kept) {
      const own = TOOL_FEATURE_KEY[t.name];
      if (own) providedKeys.add(own);
      else for (const k of effectiveRequired) providedKeys.add(k);
    }
    if (kept.length < all.length) toolsTrimmed.add(m.name);

    tools.push(...kept);

  }

  // Second pass: the prose check needs the FINISHED toolset, so it can't live
  // in the loop above (fiscal's prose depends on flujo, which is resolved
  // later in registry order).
  for (const m of modules) {
    const prosaBroken = (m.prompt.prosaDependsOn ?? []).some((k) => !providedKeys.has(k));
    if (toolsTrimmed.has(m.name) || prosaBroken) partialModules.add(m.name);
  }

  // Descriptions that name a capability this scope doesn't provide. Keyed on
  // providedKeys for the same reason as the prose (a toggle can be ON while the
  // module that would honour it is absent), so a member without invoicing stops
  // being told the CFDI is emitted "desde la tabla de citas" — not just a CORE
  // account. Only narrowed scopes get here; the shared FULL array is untouched.
  const finalTools = tools.map((t) => {
    const ov = DESCRIPTION_OVERRIDES.find((o) => o.tool === t.name && !providedKeys.has(o.key));
    if (!ov || !t.description?.includes(ov.from)) return t;
    return { ...t, description: t.description.replace(ov.from, ov.to) };
  });

  return {
    modules,
    tools: finalTools,
    isFull: false,
    tierLimited,
    memberLimited: !access.isOwner,
    partialModules,
    tier: access.tier,
  };
}

const readOwner = new Map<string, AgentModule>();
const proposalOwner = new Map<string, AgentModule>();
for (const m of AGENT_MODULES) {
  for (const t of m.readTools) {
    // Map.set would silently SHADOW a same-named tool from an earlier module
    // (the old executor stops being reachable, no error anywhere) — fail at
    // module load instead, so a collision dies in build/evals, never in prod.
    if (readOwner.has(t.name) || proposalOwner.has(t.name)) {
      throw new Error(`[agent-modules] tool name duplicado: "${t.name}" (módulo ${m.name})`);
    }
    readOwner.set(t.name, m);
  }
  for (const t of m.proposalTools) {
    if (readOwner.has(t.name) || proposalOwner.has(t.name)) {
      throw new Error(`[agent-modules] tool name duplicado: "${t.name}" (módulo ${m.name})`);
    }
    proposalOwner.set(t.name, m);
  }
}

export function isProposalToolName(name: string): boolean {
  return proposalOwner.has(name);
}

export function dispatchReadTool(
  ctx: ToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const owner = readOwner.get(name);
  // Same contract as the old executeTool default: a clean error object the
  // model can react to, never a throw.
  if (!owner) return Promise.resolve({ error: `Tool desconocida: ${name}` });
  return owner.executeRead(ctx, name, input);
}

export function dispatchProposalTool(
  ctx: ProposalContext,
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const owner = proposalOwner.get(name);
  // Same contract as the old executeProposalTool default (null) — unreachable
  // in practice because isProposalToolName gates the call.
  if (!owner) return Promise.resolve(null);
  return owner.executeProposal(ctx, name, input);
}
