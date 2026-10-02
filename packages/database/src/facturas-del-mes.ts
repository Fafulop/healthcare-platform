/**
 * TIERS P4 (docs/DESDE JUNIO/TIERS/07-PLAN-precios-lanzamiento.md) — FACTURAS POR MES.
 *
 * Cuentan los CFDI de INGRESO (`cfdiType: 'I'`) timbrados en el mes calendario de México, CANCELADOS
 * INCLUIDOS (el timbre ya se gastó — decisión del usuario 2026-10-01). Los complementos de pago (REP) y
 * las notas de crédito (egresos) NO cuentan ni se bloquean nunca: el SAT exige el REP cuando se paga una
 * factura PPD, y bloquearlo dejaría al doctor fuera de la ley.
 *
 *   Gratis: 5 al mes y ahí se detiene (para más, el plan de pago).
 *   Plan de pago (BASICO, en pantalla «Pro»): 25 incluidas; NO se detiene — cada una de más se cobra en la
 *     siguiente factura (P4b). El propio conteo es el registro: no hace falta otra tabla.
 *   PRO y LAB: sin tope (se quedan como están).
 */
import type { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

export const FACTURAS_INCLUIDAS_POR_MES: Record<string, number | null> = { FREE: 5, BASICO: 25, PRO: null, LAB: null };

/** Las facturas incluidas al mes de un plan (`null` = sin tope). Un tier desconocido cuenta como el de pago. */
export function facturasIncluidas(tier: string | null | undefined): number | null {
  if (!tier || !(tier in FACTURAS_INCLUIDAS_POR_MES)) return FACTURAS_INCLUIDAS_POR_MES.BASICO;
  return FACTURAS_INCLUIDAS_POR_MES[tier];
}

/** Sólo Gratis se DETIENE al llegar; el de pago sigue y paga las extra. */
export function seDetieneAlLlegar(tier: string | null | undefined) {
  return tier === 'FREE';
}

/** El inicio del mes calendario en México (UTC−6, sin horario de verano desde 2022). */
export function inicioDelMesMexico(ahora = new Date()): Date {
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); // 'YYYY-MM-DD'
  return new Date(`${hoy.slice(0, 7)}-01T00:00:00-06:00`);
}

/** El inicio del mes SIGUIENTE en México (el fin, exclusivo, del mes de `ahora`). */
export function inicioDelMesSiguienteMexico(ahora = new Date()): Date {
  const hoy = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
  const [y, m] = hoy.split('-').map(Number);
  const sy = m === 12 ? y + 1 : y;
  const sm = m === 12 ? 1 : m + 1;
  return new Date(`${sy}-${String(sm).padStart(2, '0')}-01T00:00:00-06:00`);
}

/** Cuántas facturas de ingreso timbró el doctor en el mes de `ahora` (canceladas incluidas). */
export async function facturasDelMes(db: Db, doctorId: string, ahora = new Date()): Promise<number> {
  // Con los DOS bordes: sólo con «desde el día 1», contar un mes pasado sumaba los meses de después.
  return db.cfdiEmitted.count({
    where: {
      cfdiType: 'I', fiscalProfile: { doctorId },
      issuedAt: { gte: inicioDelMesMexico(ahora), lt: inicioDelMesSiguienteMexico(ahora) },
    },
  });
}

/** Lo que enseña la pantalla de Facturación y lo que decide si se puede timbrar una más. */
export async function usoDeFacturas(db: Db, doctorId: string, tier: string | null | undefined, ahora = new Date()) {
  const incluidas = facturasIncluidas(tier);
  const usadas = await facturasDelMes(db, doctorId, ahora);
  return {
    usadas,
    incluidas,
    extra: incluidas === null ? 0 : Math.max(usadas - incluidas, 0),
    /** true = ya no puede timbrar otra de ingreso este mes (sólo Gratis). */
    lleno: incluidas !== null && seDetieneAlLlegar(tier) && usadas >= incluidas,
  };
}

export const MENSAJE_FACTURAS_LLENO = 'Llegaste a tus 5 facturas del mes. Con el plan Pro tienes 25 al mes.';
