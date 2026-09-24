/**
 * Filas de `llm_token_usage` ya COBRADAS, por doctor · endpoint · modelo · proveedor — la única
 * fuente de costo de las pantallas de IA del admin (`/api/llm-usage`, `/api/analytics/feature-usage`).
 *
 * 🔴 Por qué dos consultas y no un `groupBy`: `costOfUsd` cobra por `budgetTokens` si el grupo lo
 * trae, y `_sum.budgetTokens` suma SÓLO las filas donde no es NULL. En un grupo que mezcla filas
 * con y sin `budgetTokens`, las de sin se cobraban $0. En prod (90 días al 2026-09-23):
 * `agenda-agent` · claude-sonnet-5 tenía 85 de 171 filas con budget, y `form-builder-chat` ·
 * claude-sonnet-5, 4 de 55 — el 93% de su costo desaparecía. Aquí las filas con budget se cobran
 * por budget y las demás por prompt + completion, cada parte a su precio, y luego se suman.
 *
 * El costo de un grupo es `null` si su modelo no tiene precio: nunca 0 (ver `llm-pricing.ts`).
 */

import { prisma, type Prisma } from '@healthcare/database';
import { costOfUsd } from '@/lib/llm-pricing';

export interface CostRow {
  doctorId: string;
  endpoint: string;
  model: string;
  provider: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD estimados a precios de HOY. `null` = modelo sin precio. */
  costUsd: number | null;
}

export async function costRows(where: Prisma.LlmTokenUsageWhereInput): Promise<CostRow[]> {
  const consulta = (conBudget: boolean) =>
    prisma.llmTokenUsage.groupBy({
      by: ['doctorId', 'endpoint', 'model', 'provider'],
      where: { AND: [where, { budgetTokens: conBudget ? { not: null } : null }] },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        budgetTokens: true,
        durationSeconds: true,
      },
      _count: { id: true },
    });
  const [con, sin] = await Promise.all([consulta(true), consulta(false)]);

  const filas = new Map<string, CostRow>();
  for (const [grupo, conBudget] of [[con, true], [sin, false]] as const) {
    for (const r of grupo) {
      const cost = costOfUsd({
        model: r.model,
        provider: r.provider,
        promptTokens: r._sum.promptTokens ?? 0,
        completionTokens: r._sum.completionTokens ?? 0,
        // Sin budget, se cobra por prompt + completion aunque sea Anthropic: nunca un $0 callado.
        budgetTokens: conBudget ? r._sum.budgetTokens : null,
        durationSeconds: r._sum.durationSeconds,
      });
      const llave = `${r.doctorId}\u0000${r.endpoint}\u0000${r.model}\u0000${r.provider}`;
      const f = filas.get(llave);
      if (!f) {
        filas.set(llave, {
          doctorId: r.doctorId,
          endpoint: r.endpoint,
          model: r.model,
          provider: r.provider,
          requests: r._count.id,
          promptTokens: r._sum.promptTokens ?? 0,
          completionTokens: r._sum.completionTokens ?? 0,
          totalTokens: r._sum.totalTokens ?? 0,
          costUsd: cost,
        });
      } else {
        f.requests += r._count.id;
        f.promptTokens += r._sum.promptTokens ?? 0;
        f.completionTokens += r._sum.completionTokens ?? 0;
        f.totalTokens += r._sum.totalTokens ?? 0;
        f.costUsd = f.costUsd === null || cost === null ? null : f.costUsd + cost;
      }
    }
  }
  return [...filas.values()];
}

/**
 * Suma un costo a `mapa[llave]` con la regla de todas estas pantallas: un costo desconocido
 * ENVENENA el total — mejor «n/d» que un número que calla lo que no supo contar.
 */
export function sumarCosto(mapa: Map<string, number | null>, llave: string, costo: number | null): void {
  const actual = mapa.get(llave);
  if (actual === null) return;
  mapa.set(llave, costo === null ? null : (actual ?? 0) + costo);
}
