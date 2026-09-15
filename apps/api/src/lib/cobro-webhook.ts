/**
 * El CEREBRO del webhook de suscripciones (TIERS C3), separado de la ruta.
 *
 * Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.6
 *
 * Vive fuera de `route.ts` para poder EJECUTARLO en pruebas: recibe sus
 * dependencias (BD, cómo pedirle a Stripe una suscripción, cómo avisar) en vez
 * de importarlas, así un script le pasa eventos construidos a mano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LAS REGLAS
 *
 * 1. 🔴 SÓLO `invoice.paid` SUBE EL PLAN. No `checkout.session.completed`: un
 *    checkout completado no garantiza dinero cobrado. El plan sube cuando Stripe
 *    confirma que la factura se PAGÓ.
 *
 * 2. NADA BAJA EL PLAN SOLO (decisión del usuario). Pago fallido y cancelación
 *    sólo actualizan la fila y AVISAN; un humano decide en el admin.
 *
 * 3. Se lee la suscripción FRESCA de Stripe en cada evento, no el payload del
 *    evento. Stripe no garantiza el orden de entrega: con el estado fresco, un
 *    evento viejo que llega tarde escribe el estado ACTUAL, no uno pasado.
 *
 * 4. IDEMPOTENCIA: el cambio de plan va por `setDoctorTier` con el id del
 *    evento, así un reintento no mueve el plan dos veces. El resto (la fila de
 *    suscripción) es idempotente por naturaleza: escribe el estado fresco.
 *
 * 5. 🔴 API `2026-04-22.dahlia` (la que fija el SDK 22). Dos campos que casi
 *    todo el material viejo de Stripe tiene en otro lugar:
 *      - `current_period_end` YA NO está en la suscripción: está en cada ITEM.
 *      - la factura YA NO tiene `invoice.subscription`: está en
 *        `invoice.parent.subscription_details.subscription`.
 *    Un webhook escrito de memoria leería `undefined` en los dos, en silencio.
 *
 * 6. Lo que NO se arregla reintentando (cliente desconocido, precio fuera del
 *    mapa, rechazo por cupo) se AVISA y se responde 200. Lanzar haría que Stripe
 *    reintentara días un evento que nunca va a salir distinto. Sólo los errores
 *    de infraestructura se propagan (⇒ 500 ⇒ Stripe reintenta, y está bien).
 */

import type Stripe from 'stripe';
import {
  setDoctorTier,
  DOCTOR_TIERS,
  TIER_LABELS,
  type DoctorTier,
  type PrismaClient,
} from '@healthcare/database';
import { esSuscripcionViva } from '@/lib/cobro-planes';

export interface DepsCobro {
  db: PrismaClient;
  obtenerSuscripcion: (id: string) => Promise<Stripe.Subscription>;
  avisar: (texto: string) => Promise<void>;
}

export interface ResultadoEvento {
  accion: string;
}

export interface DatosSuscripcion {
  subscriptionId: string;
  customerId: string;
  status: string;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  numeroDeItems: number;
}

/** Lo que nos importa de una suscripción, leído de donde REALMENTE está en dahlia. */
export function extraerDatos(sub: Stripe.Subscription): DatosSuscripcion {
  const item = sub.items?.data?.[0];
  return {
    subscriptionId: sub.id,
    customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    status: sub.status,
    priceId: item?.price?.id ?? null,
    // En el ITEM, no en la suscripción (regla 5).
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    numeroDeItems: sub.items?.data?.length ?? 0,
  };
}

/** El id de la suscripción de una factura, donde REALMENTE está en dahlia. */
export function suscripcionDeFactura(factura: Stripe.Invoice): string | null {
  const s = factura.parent?.subscription_details?.subscription;
  if (!s) return null;
  return typeof s === 'string' ? s : s.id;
}

interface FilaSincronizada {
  doctorId: string;
  slug: string;
  tier: string;
  statusAnterior: string;
  cancelabaAntes: boolean;
}

/**
 * Escribe el estado fresco de una suscripción en SU fila. Devuelve null (y
 * avisa cuando corresponde) si el evento no se puede atribuir con seguridad.
 */
async function sincronizar(
  deps: DepsCobro,
  datos: DatosSuscripcion,
  opciones: { contexto: string; doctorEsperado?: string | null; pagadoEn?: Date },
): Promise<FilaSincronizada | null> {
  // El Customer se crea en NUESTRO checkout, antes de que exista cualquier
  // evento, y su id queda en la fila. Por eso siempre hay de dónde agarrarse.
  const fila = await deps.db.subscription.findFirst({
    where: {
      OR: [{ stripeSubscriptionId: datos.subscriptionId }, { stripeCustomerId: datos.customerId }],
    },
    include: { doctor: { select: { slug: true, tier: true } } },
  });

  if (!fila) {
    await deps.avisar(
      `⚠️ Evento ${opciones.contexto} de un cliente de Stripe (${datos.customerId}) que no ` +
        `corresponde a ninguna cuenta nuestra. No se escribió nada.`,
    );
    return null;
  }

  if (opciones.doctorEsperado && opciones.doctorEsperado !== fila.doctorId) {
    await deps.avisar(
      `🔴 ${opciones.contexto}: el checkout decía ser del doctor ${opciones.doctorEsperado} pero ` +
        `el cliente de Stripe pertenece a ${fila.doctor.slug}. No se escribió nada — revisar.`,
    );
    return null;
  }

  // Otra suscripción distinta a la que ya tenemos guardada.
  if (fila.stripeSubscriptionId && fila.stripeSubscriptionId !== datos.subscriptionId) {
    if (!esSuscripcionViva(datos.status)) {
      // Una suscripción VIEJA (cancelada) cuyo evento llegó tarde, después de
      // que el doctor volvió a suscribirse. No es noticia: se ignora.
      return null;
    }
    if (esSuscripcionViva(fila.status)) {
      // 🔴 Dos vivas a la vez = se le está cobrando dos veces (p.ej. doble clic
      // en dos pestañas antes de que llegara el primer webhook). Se conserva la
      // primera y se avisa: la segunda hay que cancelarla y reembolsarla EN
      // STRIPE, a mano.
      await deps.avisar(
        `🔴 ${fila.doctor.slug} tiene DOS suscripciones vivas: ${fila.stripeSubscriptionId} (la ` +
          `guardada) y ${datos.subscriptionId}. Se le está cobrando doble. Cancela y reembolsa ` +
          `la segunda en Stripe.`,
      );
      return null;
    }
    // La guardada ya no está viva: esta es una suscripción NUEVA legítima
    // (volvió a contratar después de cancelar). Se sigue y se sobrescribe.
  }

  if (datos.numeroDeItems !== 1) {
    await deps.avisar(
      `⚠️ ${fila.doctor.slug}: la suscripción ${datos.subscriptionId} tiene ` +
        `${datos.numeroDeItems} items; se esperaba 1. Se usó el primero.`,
    );
  }

  await deps.db.subscription.update({
    where: { id: fila.id },
    data: {
      stripeCustomerId: datos.customerId,
      stripeSubscriptionId: datos.subscriptionId,
      stripePriceId: datos.priceId,
      status: datos.status,
      currentPeriodEnd: datos.currentPeriodEnd,
      cancelAtPeriodEnd: datos.cancelAtPeriodEnd,
      ...(opciones.pagadoEn ? { lastPaymentAt: opciones.pagadoEn } : {}),
    },
  });

  return {
    doctorId: fila.doctorId,
    slug: fila.doctor.slug,
    tier: fila.doctor.tier,
    statusAnterior: fila.status,
    cancelabaAntes: fila.cancelAtPeriodEnd,
  };
}

const nombreTier = (t: string) => TIER_LABELS[t as DoctorTier] ?? t;

export async function procesarEventoCobro(
  evento: Stripe.Event,
  deps: DepsCobro,
): Promise<ResultadoEvento> {
  switch (evento.type) {
    // ── El checkout terminó: se AMARRA la suscripción a la cuenta ─────────────
    // No sube el plan (regla 1).
    case 'checkout.session.completed': {
      const sesion = evento.data.object;
      if (sesion.mode !== 'subscription' || !sesion.subscription) {
        return { accion: 'ignorado: checkout que no es de suscripción' };
      }
      const subId = typeof sesion.subscription === 'string' ? sesion.subscription : sesion.subscription.id;
      const datos = extraerDatos(await deps.obtenerSuscripcion(subId));
      const fila = await sincronizar(deps, datos, {
        contexto: 'checkout.session.completed',
        doctorEsperado: sesion.client_reference_id,
      });
      return { accion: fila ? `suscripción amarrada a ${fila.slug}` : 'no atribuible' };
    }

    // ── 🔴 Se cobró: AQUÍ y sólo aquí sube el plan ────────────────────────────
    case 'invoice.paid': {
      const factura = evento.data.object;
      const subId = suscripcionDeFactura(factura);
      if (!subId) return { accion: 'ignorado: factura sin suscripción' };

      const datos = extraerDatos(await deps.obtenerSuscripcion(subId));
      const pagadoEn = new Date((factura.status_transitions?.paid_at ?? evento.created) * 1000);
      const fila = await sincronizar(deps, datos, { contexto: 'invoice.paid', pagadoEn });
      if (!fila) return { accion: 'no atribuible' };

      if (!datos.priceId) {
        await deps.avisar(`⚠️ ${fila.slug} pagó, pero la suscripción no trae precio. El plan NO se movió.`);
        return { accion: 'pagado sin precio' };
      }

      // Se busca el precio SIN filtrar por `activo`: quien se suscribió con un
      // precio que después se reemplazó sigue pagando ESE plan.
      const mapa = await deps.db.tierPrice.findUnique({ where: { stripePriceId: datos.priceId } });
      if (!mapa) {
        await deps.avisar(
          `🔴 ${fila.slug} pagó con el precio ${datos.priceId}, que NO está en el mapa de planes. ` +
            `El plan NO se movió: asígnalo desde Cobro en el admin o revisa el precio en Stripe.`,
        );
        return { accion: 'pagado con precio fuera del mapa' };
      }

      // 🔴 UN PAGO SÓLO PUEDE SUBIR EL PLAN, NUNCA BAJARLO (review de C3, #1).
      // `setDoctorTier` no distingue subir de bajar: su único freno es el cupo.
      // Sin esta comparación, una RENOVACIÓN bajaba planes: un suscriptor de
      // BÁSICO que pide cambio de plan (justo lo que el 409 del checkout le
      // indica) queda en PRO por el admin, pero su precio en Stripe sigue siendo
      // el de BÁSICO — y el invoice.paid del mes siguiente, con un evt_ NUEVO que
      // la idempotencia no frena, lo regresaba a BÁSICO avisando "✅ subió de PRO
      // a BÁSICO". Eso rompía la regla 2. Ahora el pago se anota y se avisa, y el
      // plan se queda donde un humano lo dejó.
      const rango = (t: string) => (DOCTOR_TIERS as readonly string[]).indexOf(t);
      if (rango(mapa.tier) < rango(fila.tier)) {
        await deps.avisar(
          `⚠️ ${fila.slug} pagó su renovación de ${nombreTier(mapa.tier)}, pero su cuenta está en ` +
            `${nombreTier(fila.tier)}. El plan NO se bajó. Si el cambio fue a propósito, ajusta su ` +
            `precio en Stripe para que coincida.`,
        );
        return { accion: `pagado por debajo del plan actual (${mapa.tier} < ${fila.tier}): sin cambios` };
      }

      const resultado = await setDoctorTier({
        db: deps.db,
        doctorId: fila.doctorId,
        tier: mapa.tier,
        origen: 'webhook',
        actor: `stripe:${evento.id}`,
        stripeEventId: evento.id,
        motivo: `invoice.paid ${factura.id ?? ''}`.trim(),
      });

      if (!resultado.ok) {
        await deps.avisar(
          `🔴 ${fila.slug} PAGÓ el plan ${nombreTier(mapa.tier)} pero no se le pudo aplicar: ` +
            `${resultado.mensaje}`,
        );
        return { accion: `pagado pero rechazado: ${resultado.code}` };
      }
      if (resultado.changed) {
        await deps.avisar(
          `✅ ${fila.slug} pagó y subió de ${nombreTier(resultado.from)} a ${nombreTier(resultado.to)}.`,
        );
      }
      return {
        accion: resultado.duplicado
          ? 'evento repetido: sin cambios'
          : resultado.changed
            ? `plan ${resultado.from} -> ${resultado.to}`
            : 'pagado; ya estaba en ese plan',
      };
    }

    // ── Pago fallido: se anota y se avisa. El plan NO baja (regla 2) ─────────
    case 'invoice.payment_failed': {
      const factura = evento.data.object;
      const subId = suscripcionDeFactura(factura);
      if (!subId) return { accion: 'ignorado: factura sin suscripción' };
      const datos = extraerDatos(await deps.obtenerSuscripcion(subId));
      const fila = await sincronizar(deps, datos, { contexto: 'invoice.payment_failed' });
      if (!fila) return { accion: 'no atribuible' };
      await deps.avisar(
        `⚠️ Falló el cobro de ${fila.slug} (status: ${datos.status}). Sigue en ` +
          `${nombreTier(fila.tier)}: el plan no baja solo. Stripe reintentará según su configuración.`,
      );
      return { accion: 'pago fallido anotado' };
    }

    // ── Cambió la suscripción (tarjeta, cancelación programada…) ─────────────
    // Sincroniza estado. NO toca el plan: el plan sólo se mueve con dinero.
    case 'customer.subscription.updated': {
      const datos = extraerDatos(await deps.obtenerSuscripcion(evento.data.object.id));
      const fila = await sincronizar(deps, datos, { contexto: 'customer.subscription.updated' });
      if (!fila) return { accion: 'no atribuible' };
      if (!fila.cancelabaAntes && datos.cancelAtPeriodEnd) {
        const hasta = datos.currentPeriodEnd?.toISOString().slice(0, 10) ?? 'fin de periodo';
        await deps.avisar(
          `⚠️ ${fila.slug} programó la cancelación de su suscripción (termina ${hasta}). ` +
            `Su plan sigue en ${nombreTier(fila.tier)} hasta que alguien lo cambie en el admin.`,
        );
      }
      return { accion: 'suscripción sincronizada' };
    }

    // ── Cancelada del todo. El plan NO baja (regla 2) ────────────────────────
    case 'customer.subscription.deleted': {
      // El objeto del evento YA es el estado final; volver a pedirlo no aporta.
      const datos = extraerDatos(evento.data.object);
      const fila = await sincronizar(deps, datos, { contexto: 'customer.subscription.deleted' });
      if (!fila) return { accion: 'no atribuible' };
      await deps.avisar(
        `🔴 Se CANCELÓ la suscripción de ${fila.slug}. Su cuenta sigue en ${nombreTier(fila.tier)}: ` +
          `bájala en /doctors del admin si corresponde (el plan no baja solo).`,
      );
      return { accion: 'suscripción cancelada anotada' };
    }

    default:
      return { accion: `ignorado: ${evento.type}` };
  }
}
