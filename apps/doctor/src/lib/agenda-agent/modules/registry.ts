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
import { hasPermission, type PermissionKey, type PermissionSet } from '@healthcare/database';
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
 * module requires — ALL must be ON (conservative rule, 00-REQUISITOS §5.2).
 * A module absent from this map is BLOCKED for members (fail-closed, G9) —
 * a future module must be added here explicitly to reach members at all.
 * Design: docs/DESDE JUNIO/NUEVOS USUARIOS/01-DISENO-tecnico.md §7.1
 */
export const AGENT_MODULE_REQUIREMENTS: Record<string, PermissionKey[]> = {
  agenda: ['citas'],
  expediente: ['expedientes'],
  flujo: ['flujo', 'pagos', 'conciliacion'],
  facturas: ['facturacion', 'sat'],
  fiscal: ['facturacion', 'sat'],
};

export interface AgentAccess {
  isOwner: boolean;
  permissions: PermissionSet | null;
}

/**
 * The module set for this user. Owners get AGENT_MODULES BY REFERENCE (not a
 * copy) — callers that need to detect "is this the full/owner set" can do
 * `modules === AGENT_MODULES`, and prompt.ts relies on exactly this to stay
 * byte-identical for owners without re-deriving equality.
 */
export function enabledModules(access: AgentAccess): AgentModule[] {
  if (access.isOwner) return AGENT_MODULES;
  return AGENT_MODULES.filter((m) => {
    const required = AGENT_MODULE_REQUIREMENTS[m.name];
    if (!required) return false;
    return required.every((key) => hasPermission(access.permissions, key));
  });
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
