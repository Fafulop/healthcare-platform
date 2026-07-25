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

import type { PermissionKey } from '@healthcare/database';
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
  /**
   * TIERS T3 — used INSTEAD of the two above when the account's tier filtered
   * some of this module's tools away (registry: `scope.partialModules`).
   *
   * Why a whole variant instead of trimming: the full text is hand-written
   * prose that describes the module's capabilities as facts. A CORE account
   * keeps `flujo` without the conciliación tool, so the full FLUJO text would
   * promise bank-reconciliation reads the account cannot make — the same
   * "prompt claims capabilities whose tools don't exist" failure PR C found in
   * INTRO/RESILIENCE (NUEVOS USUARIOS 01-DISENO §13).
   *
   * Only modules with tier-splittable tools need it; a module whose tools all
   * share its base feature keys is either kept whole or dropped whole.
   */
  partial?: {
    domainModel: string;
    domainRules?: string;
  };
  /**
   * Feature keys OTHER than this module's own requirements that its PROSE
   * depends on — cross-references to another module's tools, or to a UI section
   * of another feature. If the resolved scope does NOT actually provide one of
   * them, the `partial` variant is used EVEN IF every one of this module's own
   * tools survived.
   *
   * "Provides" means a tool answering to that key is really in the final
   * toolset — NOT merely that the toggle is on or the tier allows it. That
   * distinction is the whole point: a member with `flujo: true` but
   * `pagos: false` gets NO flujo module (its requirement is ALL three), so
   * `get_balance` is absent even though the `flujo` key looks granted. Checking
   * the key would miss it; checking what the scope provides does not.
   *
   * Two real bugs came from lacking this (TIERS 01-DISENO §11.5 / §11.5.1):
   * `agenda` telling the doctor to emit a CFDI "desde la tabla de citas" with
   * no invoicing available, and `fiscal` routing day-to-day money to
   * `get_balance`/`get_movimientos` — which sent the model looking for tools it
   * did not have, so it answered with SAT cash-basis figures instead.
   *
   * Erring toward switching is safe: a partial drops a routing hint, never adds
   * a claim.
   */
  prosaDependsOn?: PermissionKey[];
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
