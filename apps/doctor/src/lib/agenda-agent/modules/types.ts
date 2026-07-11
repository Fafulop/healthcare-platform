/**
 * Domain-module contract for the assistant.
 *
 * The assistant is ONE conversation loop (run-turn.ts) with tool modules per
 * domain (agenda today; facturas/pagos/expediente later — see
 * docs/DESDE JUNIO/AGENTES/AGENTE FACTURAS/00-FACTIBILIDAD §1). A module
 * contributes tool definitions, their executors, and its stable prompt
 * sections; the registry concatenates everything DETERMINISTICALLY so the
 * system prompt stays ONE stable cached block with a single breakpoint
 * (AGENTE AGENDA 05 §8 — adding a module grows the prompt, never splits the
 * cache).
 */

import type { AnthropicTool } from '../anthropic';
import type { ToolContext } from '../tools';
import type { ProposalContext } from '../proposals';

export interface AgentModulePrompt {
  /** Domain mental model ("## Cómo funciona <dominio> (invariantes)") —
   * rendered after the intro, before the shared resilience section. */
  domainModel: string;
  /** Domain-specific operating rules (e.g. "## Citas — reglas especiales") —
   * rendered after the shared resilience section. */
  domainRules?: string;
}

export interface AgentModule {
  name: string;
  /** Read tools — autonomous, executed server-side in the loop. */
  readTools: AnthropicTool[];
  /** propose_* tools — doctor confirms; the CLIENT executes the real endpoint. */
  proposalTools: AnthropicTool[];
  executeRead(
    ctx: ToolContext,
    name: string,
    input: Record<string, unknown>
  ): Promise<unknown>;
  executeProposal(
    ctx: ProposalContext,
    name: string,
    input: Record<string, unknown>
  ): Promise<unknown>;
  prompt: AgentModulePrompt;
}
