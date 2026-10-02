/**
 * TIERS P3 (docs/DESDE JUNIO/TIERS/07-PLAN-precios-lanzamiento.md) — TOPE MENSUAL DE IA EN DÓLARES.
 *
 * Las dos herramientas de IA del lanzamiento (armar plantillas con IA y el widget de ayuda «?») tienen,
 * cada una, un tope de gasto por mes calendario (hora de México): Gratis $1 USD, el plan de pago
 * (BASICO, en pantalla «Pro») $2 USD. PRO y LAB —los doctores que se quedan como están— no tienen tope.
 *
 * El gasto se CALCULA de lo que ya se registra en `llm_token_usage` (doctor, endpoint, modelo, tokens):
 * tokens × el precio de SU modelo. Un número de tokens sin su modelo no dice cuánto costó (memoria
 * `project_agent_cost_optimization`): por eso el precio va por modelo, y un modelo que no está en la
 * tabla se cobra al precio MÁS CARO conocido — el tope nunca se salta por un modelo nuevo.
 */
import { prisma } from '@healthcare/database';

/** USD por millón de tokens (entrada, salida). Precios públicos de los proveedores — re-verificar al cambiar de modelo. */
export const PRECIO_USD_POR_MTOK: Record<string, { entrada: number; salida: number }> = {
  'gpt-4o-mini': { entrada: 0.15, salida: 0.6 },
  'gpt-4o': { entrada: 2.5, salida: 10 },
  'claude-sonnet-5': { entrada: 3, salida: 15 },
  'claude-haiku-4-5-20251001': { entrada: 1, salida: 5 },
};
const MAS_CARO = Object.values(PRECIO_USD_POR_MTOK).reduce((a, p) => (p.salida > a.salida ? p : a));

export type HerramientaIa = 'form-builder-chat' | 'ayuda-chat';

/** Tope por herramienta y por mes, en USD. `null` = sin tope (PRO y LAB). */
export const TOPE_IA_USD_POR_TIER: Record<string, number | null> = { FREE: 1, BASICO: 2, PRO: null, LAB: null };

export function topeIaUsd(tier: string | null | undefined): number | null {
  // Un tier desconocido se trata como el plan de pago (tope $2): nunca sin tope por un dato raro.
  if (!tier || !(tier in TOPE_IA_USD_POR_TIER)) return TOPE_IA_USD_POR_TIER.BASICO;
  return TOPE_IA_USD_POR_TIER[tier];
}

/** El inicio del mes calendario en México (UTC−6, sin horario de verano desde 2022). */
export function inicioDelMesMexico(ahora = new Date()): Date {
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // 'YYYY-MM-DD'
  return new Date(`${hoy.slice(0, 7)}-01T00:00:00-06:00`);
}

/** El costo en USD de UNA fila de `llm_token_usage`. */
export function costoUsd(f: { model: string; promptTokens: number; completionTokens: number; budgetTokens: number | null }): number {
  const precio = PRECIO_USD_POR_MTOK[f.model] ?? MAS_CARO;
  // `budgetTokens` ya viene ponderado por el precio relativo de Anthropic (entrada ×1, salida ×5, caché…):
  // × el precio de entrada = el costo real, con la caché bien contada.
  if (f.budgetTokens != null && f.model.startsWith('claude')) return (f.budgetTokens * precio.entrada) / 1e6;
  return (f.promptTokens * precio.entrada + f.completionTokens * precio.salida) / 1e6;
}

/** Lo que el doctor lleva gastado ESTE mes en una herramienta, en USD. */
export async function gastoDelMesUsd(doctorId: string, herramienta: HerramientaIa, ahora = new Date()): Promise<number> {
  const filas = await prisma.llmTokenUsage.findMany({
    where: { doctorId, endpoint: herramienta, createdAt: { gte: inicioDelMesMexico(ahora) } },
    select: { model: true, promptTokens: true, completionTokens: true, budgetTokens: true },
  });
  return filas.reduce((a, f) => a + costoUsd(f), 0);
}

export const MENSAJE_LIMITE_IA = 'Llegaste al límite de este mes.';

/** ¿Ya llegó al tope de este mes? (`null` = sin tope). */
export async function limiteDeIaAlcanzado(doctorId: string, tier: string | null | undefined, herramienta: HerramientaIa) {
  const tope = topeIaUsd(tier);
  if (tope === null) return { alcanzado: false, gasto: null as number | null, tope };
  const gasto = await gastoDelMesUsd(doctorId, herramienta);
  return { alcanzado: gasto >= tope, gasto, tope };
}
