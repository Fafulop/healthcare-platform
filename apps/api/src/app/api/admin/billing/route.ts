/**
 * /api/admin/billing — la pantalla de control del COBRO (lo que los doctores
 * nos pagan a NOSOTROS). Admin-only.
 *
 * TIERS C2. Diseño: docs/DESDE JUNIO/TIERS/03-PLAN-cuenta-y-cobro.md §3.1–§3.3
 *
 * GET   — el mapa tier ↔ precio (con el monto RESUELTO desde Stripe) y el
 *         estado de cobro de cada doctor.
 * PATCH — fija el precio de un tier. Valida el price id contra Stripe ANTES de
 *         guardarlo.
 *
 * 🔴 EL MONTO NO SE GUARDA. El objeto Price de Stripe es la fuente de verdad del
 * dinero: aquí sólo vive el `stripePriceId`. Así cambiar un precio no necesita
 * un deploy —se crea un Price nuevo en Stripe y se re-apunta el mapa— y, sobre
 * todo, no puede haber un número en nuestra BD que contradiga al que de verdad
 * se le cobra a la tarjeta. Lo que se muestra se LEE de Stripe en cada GET.
 *
 * ⚠️ En C2 NADIE cobra todavía: `subscriptions` está vacía y la escribe el
 * webhook de C3. Por eso el GET distingue explícitamente "sin suscripción" de
 * "no se pudo leer" — un [] no es una respuesta, y una tabla en blanco se lee
 * como "nadie paga" cuando en realidad es "esto aún no está conectado".
 */

import { NextResponse } from 'next/server';
import {
  prisma,
  DOCTOR_TIERS,
  TIER_LABELS,
  fijarPrecioDeTier,
  type DoctorTier,
} from '@healthcare/database';
// TIERS C3: el cliente del COBRO (STRIPE_BILLING_SECRET_KEY), no `@/lib/stripe`.
// Con la clave de prueba del cobro, un price de prueba NO lo reconoce la clave
// viva de pagos de pacientes: validar con la clave equivocada rechazaría todo.
import { stripeCobro, modoCobro, cobroListo, esErrorDeStripe } from '@/lib/stripe-cobro';
import { requireAdminAuth, AuthError } from '@/lib/auth';

function noAutorizado(error: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Admin access required',
    },
    { status: error instanceof AuthError ? error.status : 401 }
  );
}

/** Lo que se le enseña al admin de un Price de Stripe. */
interface PrecioResuelto {
  stripePriceId: string;
  /** null ⇒ Stripe no lo reconoció (id borrado o de otra cuenta). */
  montoCentavos: number | null;
  moneda: string | null;
  intervalo: string | null;
  activoEnStripe: boolean | null;
  /** Por qué no se pudo resolver, si no se pudo. */
  problema: string | null;
}

async function resolverPrecio(stripePriceId: string): Promise<PrecioResuelto> {
  const cliente = stripeCobro();
  if (!cliente) {
    return {
      stripePriceId,
      montoCentavos: null,
      moneda: null,
      intervalo: null,
      activoEnStripe: null,
      problema: 'Falta STRIPE_BILLING_SECRET_KEY en el api: no se puede consultar Stripe.',
    };
  }
  try {
    const price = await cliente.prices.retrieve(stripePriceId);
    return {
      stripePriceId,
      montoCentavos: price.unit_amount ?? null,
      moneda: price.currency?.toUpperCase() ?? null,
      intervalo: price.recurring?.interval ?? null,
      activoEnStripe: price.active,
      problema: price.recurring
        ? null
        : 'Este precio NO es recurrente: una suscripción necesita un precio con intervalo.',
    };
  } catch (e) {
    // No se tumba la pantalla porque un id esté mal: se reporta ESE renglón.
    return {
      stripePriceId,
      montoCentavos: null,
      moneda: null,
      intervalo: null,
      activoEnStripe: null,
      problema: esErrorDeStripe(e)
        ? `Stripe no reconoce este precio (${e.message})`
        : 'No se pudo consultar Stripe.',
    };
  }
}

export async function GET(request: Request) {
  try {
    await requireAdminAuth(request);
  } catch (error) {
    return noAutorizado(error);
  }

  try {
    const [precios, doctores, suscripciones] = await Promise.all([
      prisma.tierPrice.findMany({ where: { activo: true }, orderBy: { tier: 'asc' } }),
      prisma.doctor.findMany({
        select: { id: true, slug: true, doctorFullName: true, lastName: true, tier: true },
        orderBy: { slug: 'asc' },
      }),
      prisma.subscription.findMany(),
    ]);

    // TIERS #7 (versión corta): la bandeja de «quiero bajarme de plan».
    //
    // FUERA del Promise.all y tragándose su propio error A PROPÓSITO. La tabla
    // `solicitudes_cambio_plan` se crea con SQL a mano, y `apps/api` se
    // despliega solo en cuanto alguien empuja: entre el push y el SQL hay una
    // ventana en la que la tabla NO existe. Adentro del Promise.all, ese error
    // se llevaba por delante precios, doctores, suscripciones y la lista de
    // `faltantes` — o sea, la pantalla que existe justo para ver qué está mal
    // configurado moría por lo más nuevo que tiene.
    const solicitudes = await prisma.solicitudCambioPlan
      .findMany({
        where: { estado: 'PENDIENTE' },
        orderBy: { creadoEn: 'asc' },
        include: { doctor: { select: { slug: true } } },
      })
      .catch((e) => {
        console.error('[CAMBIO-PLAN] no se pudo leer la bandeja', e);
        return [];
      });

    const porDoctor = new Map(suscripciones.map((s) => [s.doctorId, s]));

    // Se resuelven en paralelo, pero cada uno falla por su cuenta.
    const resueltos = await Promise.all(precios.map((p) => resolverPrecio(p.stripePriceId)));
    const porPriceId = new Map(resueltos.map((r) => [r.stripePriceId, r]));

    return NextResponse.json({
      success: true,
      data: {
        // Un renglón por tier, EXISTA o no su precio: así el admin ve de un
        // vistazo cuáles faltan por configurar en vez de tener que deducirlo
        // de una lista corta.
        tiers: (DOCTOR_TIERS as readonly DoctorTier[]).map((tier) => {
          const fila = precios.find((p) => p.tier === tier);
          return {
            tier,
            label: TIER_LABELS[tier],
            configurado: !!fila,
            notaInterna: fila?.notaInterna ?? null,
            precio: fila ? porPriceId.get(fila.stripePriceId) ?? null : null,
          };
        }),
        doctores: doctores.map((d) => {
          const s = porDoctor.get(d.id);
          return {
            doctorId: d.id,
            slug: d.slug,
            nombre: `${d.doctorFullName} ${d.lastName}`.trim(),
            tier: d.tier,
            // `null` = NO HAY FILA, que en C2 es el estado de todos y significa
            // "el cobro no está conectado", no "este doctor no paga".
            suscripcion: s
              ? {
                  status: s.status,
                  stripeCustomerId: s.stripeCustomerId,
                  stripeSubscriptionId: s.stripeSubscriptionId,
                  currentPeriodEnd: s.currentPeriodEnd,
                  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
                  lastPaymentAt: s.lastPaymentAt,
                }
              : null,
          };
        }),
        // Se dice explícitamente, para que la pantalla no tenga que adivinar
        // por qué todo viene vacío. C3: "conectado" exige la clave Y el secreto
        // del webhook (sin el webhook se cobraría sin subir planes).
        // Las solicitudes de BAJAR de plan que esperan a un humano. Bajar de
        // plan de verdad (#7) no está construido: esto es la bandeja. Va ANTES
        // del bloque de diagnóstico para no quedar entre su comentario y sus
        // claves.
        solicitudes: solicitudes.map((s) => ({
          id: s.id,
          slug: s.doctor.slug,
          tierActual: s.tierActual,
          tierSolicitado: s.tierSolicitado,
          cabe: s.cabe,
          motivoNoCabe: s.motivoNoCabe,
          solicitadoPor: s.solicitadoPor,
          creadoEn: s.creadoEn,
        })),
        cobroConectado: cobroListo(),
        modo: modoCobro(),
        faltantes: [
          ...(stripeCobro() ? [] : ['STRIPE_BILLING_SECRET_KEY']),
          ...(process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ? [] : ['STRIPE_SUBSCRIPTION_WEBHOOK_SECRET']),
          ...(process.env.TELEGRAM_ADMIN_CHAT_ID ? [] : ['TELEGRAM_ADMIN_CHAT_ID (avisos)']),
          ...(modoCobro() === 'test' && !process.env.STRIPE_BILLING_TEST_DOCTORS
            ? ['STRIPE_BILLING_TEST_DOCTORS (en modo prueba nadie ve el cobro sin esta lista)']
            : []),
        ],
      },
    });
  } catch (error) {
    console.error('GET /api/admin/billing failed:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', message: 'No se pudo cargar el cobro' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  let admin: { email: string };
  try {
    admin = await requireAdminAuth(request);
  } catch (error) {
    return noAutorizado(error);
  }

  try {
    if (!stripeCobro()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Not configured',
          message: 'Falta STRIPE_BILLING_SECRET_KEY en el api: no se puede validar el precio.',
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const tier = body?.tier;
    const stripePriceId = typeof body?.stripePriceId === 'string' ? body.stripePriceId.trim() : '';
    // `undefined` si el body no la trae: significa "no tocar la nota guardada".
    // Leerla como `null` borraba la nota en cada «Cambiar» (review de C2, #4).
    const notaInterna =
      body && Object.hasOwn(body, 'notaInterna')
        ? typeof body.notaInterna === 'string'
          ? body.notaInterna.trim() || null
          : null
        : undefined;

    if (!(DOCTOR_TIERS as readonly string[]).includes(tier)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid tier',
          message: `Tier inválido: ${JSON.stringify(tier)}. Permitidos: ${DOCTOR_TIERS.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    if (!stripePriceId) {
      return NextResponse.json(
        { success: false, error: 'Bad request', message: 'Falta el id del precio de Stripe.' },
        { status: 400 }
      );
    }

    // 🔴 Se valida contra Stripe ANTES de guardar. Es la diferencia entre
    // enterarse ahora de que el id está mal y enterarse en el primer cobro real
    // de un doctor, que es cuando duele.
    const resuelto = await resolverPrecio(stripePriceId);
    if (resuelto.problema) {
      return NextResponse.json(
        { success: false, error: 'Invalid price', message: resuelto.problema },
        { status: 400 }
      );
    }
    if (resuelto.activoEnStripe === false) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid price',
          message: 'Ese precio está ARCHIVADO en Stripe: no se le puede cobrar a nadie con él.',
        },
        { status: 400 }
      );
    }

    // La escritura vive en `fijarPrecioDeTier` (@healthcare/database) para que
    // se pueda EJECUTAR en pruebas: esta ruta también habla con Stripe.
    const resultado = await fijarPrecioDeTier({
      db: prisma,
      tier,
      stripePriceId,
      notaInterna,
    });
    if (!resultado.ok) {
      return NextResponse.json(
        { success: false, error: resultado.code, message: resultado.mensaje },
        { status: resultado.code === 'INVALID_TIER' ? 400 : 409 }
      );
    }

    console.log('[BILLING] precio de tier fijado', { admin: admin.email, tier, stripePriceId });

    return NextResponse.json({
      success: true,
      data: { tier, precio: resuelto },
    });
  } catch (error) {
    console.error('PATCH /api/admin/billing failed:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', message: 'No se pudo guardar el precio' },
      { status: 500 }
    );
  }
}
