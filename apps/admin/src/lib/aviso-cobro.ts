/**
 * El aviso del modal de plan cuando el admin cambia A MANO el plan de alguien
 * que paga por Stripe (TIERS 04 §12 R7 · §12.6 #2).
 *
 * Cambiar aquí el plan deja DOS planes: el que tiene y el que se le cobra. El
 * 2026-09-17 se bajó en el admin un plan pagado hasta el 17 de octubre y la
 * cuenta perdió el mes; subirlo tiene el problema al revés (tiene PRO y Stripe
 * le sigue cobrando BÁSICO, y la renovación no lo corrige: un pago nunca baja
 * el plan). R7: NO se bloquea —a veces es justo lo que se quiere— pero obliga
 * a verlo.
 *
 * Vive fuera de la página para poder EJECUTARLO con casos (sin React): las tres
 * fallas del review de #2 eran de esta lógica, no del marcado.
 */

import { DOCTOR_TIERS, TIER_LABELS, type DoctorTier } from "@healthcare/database";

export interface CobroDelDoctor {
  status: string;
  pagadoHasta: string | null;
  cancelaAlFinal: boolean;
  /** El tier del precio que Stripe le COBRA; `null`/ausente ⇒ no se sabe. */
  planPagado?: string | null;
}

export interface AvisoDeCobro {
  /** Nombre comercial del plan que paga, si se sabe. */
  pagado: string | null;
  /** Sólo si elige un plan POR DEBAJO del que paga y aún tiene tiempo pagado. */
  perdida: { hasta: string; dias: number } | null;
}

// Rango por POSICIÓN en DOCTOR_TIERS (de menor a mayor capacidad), el mismo
// criterio que usan las guardas de dinero del api.
export const rangoTier = (tier: string | undefined): number =>
  (DOCTOR_TIERS as readonly string[]).indexOf(tier ?? "");

// 🔴 `timeZone` FIJA: son timestamps, y sin esto los formatea la zona del
// navegador del admin — la misma fecha se pintaría distinta aquí y en la
// pantalla del doctor. Producto de México, una sola zona (igual que `fecha()`
// en `cuenta/page.tsx` del doctor).
export const fechaLarga = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });

/** Días que le faltan a una fecha; 0 si ya pasó. */
export const diasRestantes = (iso: string, ahora: number = Date.now()): number =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - ahora) / 86_400_000));

/**
 * `null` ⇒ no hay nada que avisar.
 *
 * 🔴 SIMPLE A PROPÓSITO (decisión del usuario, 2026-09-18). La primera versión
 * tenía una frase distinta por caso (tarjeta que falla, prueba, cancelada, subir
 * a medias…) y dos reviews seguidos le encontraron frases falsas en esos
 * bordes: cada rama era otra afirmación que podía mentir. Ahora son DOS frases
 * que son ciertas en cualquier caso — no le agregues ramas sin volver a pensar
 * si la frase nueva es verdad en TODOS los estados de Stripe.
 */
export function avisoDeCambioManual(
  tierActual: string | undefined,
  seleccion: string,
  cobro: CobroDelDoctor | null | undefined,
  ahora: number = Date.now(),
): AvisoDeCobro | null {
  // Sólo `active`: es el único estado en el que «paga» es cierto sin matices.
  if (!cobro || cobro.status !== "active" || seleccion === tierActual) return null;

  const planPagado =
    cobro.planPagado && (DOCTOR_TIERS as readonly string[]).includes(cobro.planPagado)
      ? (cobro.planPagado as DoctorTier)
      : null;

  // Elegir justo el plan que paga ⇒ coincide con Stripe: nada que avisar (y si
  // venía de un desajuste, esto lo ARREGLA).
  if (planPagado && seleccion === planPagado) return null;

  const hasta = cobro.pagadoHasta;
  const dias = hasta ? diasRestantes(hasta, ahora) : 0;
  const pordebajo = planPagado !== null && rangoTier(seleccion) < rangoTier(planPagado);

  return {
    pagado: planPagado ? TIER_LABELS[planPagado] : null,
    perdida: pordebajo && hasta && dias > 0 ? { hasta, dias } : null,
  };
}
