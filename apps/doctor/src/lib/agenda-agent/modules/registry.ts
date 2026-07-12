/**
 * Module registry — the single place a new domain module gets plugged in.
 *
 * Adding a module = one import + one array entry; the loop (run-turn.ts) and
 * the prompt composer (../prompt.ts) pick it up from here. Order matters and
 * must stay STABLE: it defines the tools array and the prompt section order,
 * both covered by the single cache breakpoint — reordering invalidates the
 * cache for every doctor mid-day.
 */

import type { ToolContext } from '../tools';
import type { ProposalContext } from '../proposals';
import type { AgentModule } from './types';
import { agendaModule } from './agenda';
import { facturasModule } from './facturas';
import { fiscalModule } from './fiscal';
import { flujoModule } from './flujo';

export const AGENT_MODULES: AgentModule[] = [agendaModule, facturasModule, fiscalModule, flujoModule];

/** The exact tools array the API receives (reads then proposals, per module). */
export const ALL_TOOLS = AGENT_MODULES.flatMap((m) => [...m.readTools, ...m.proposalTools]);

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
