// POST /api/cron/cobro-vencido — TIERS 04 §12.6 #6.1 (dejar de pagar, parte 1).
//
// Quien dejó de pagar (tarjeta que falla hasta que Stripe cancela, o cancelación
// que ya terminó) conserva su plan DIAS_DE_MARGEN días después de lo último que
// pagó (`subscriptions.pagado_hasta`). Pasado el margen:
//   · si CABE en Gratis (≤ 50 pacientes y ≤ 500 MB) ⇒ pasa a Gratis;
//   · si NO cabe ⇒ se CONGELA (`doctors.congelada_desde`, #6.2): sólo entra a
//     «Mi Cuenta» y al cobro hasta que vuelva a pagar.
// Las cuentas LAB (cortesías) y las que no tienen suscripción no se tocan: no
// entran en la consulta.
//
// 🔴 Antes de bajar a nadie se le PREGUNTA a Stripe: si allá la suscripción
// sigue `active` y cubre hoy, nos perdimos un webhook y `pagado_hasta` está
// viejo — bajarlo sería quitarle a alguien lo que SÍ pagó.
//
// `?dryRun=1` ⇒ no escribe ni avisa: devuelve lo que HARÍA. Así se prueba.
//
// Lo llama el servicio `cron` de Railway cada 15 min (docs/NEW.MD-GUIDES/
// RAILWAY-CRON.md); se auto-limita a UNA corrida al día (09:00–09:14 hora de
// México) para no repetir el aviso de «no cabe» cada 15 minutos.
// Protegido por CRON_SECRET.
import { NextResponse } from 'next/server';
import { prisma, setDoctorTier, cabeEnPlan, TIER_LABELS, type DoctorTier } from '@healthcare/database';
import { stripeCobro, esErrorDeStripe } from '@/lib/stripe-cobro';
import { avisarAdmin } from '@/lib/cobro-avisos';
import { DIAS_DE_MARGEN, finDelMargen } from '@/lib/cobro-planes';

const nombre = (t: string) => TIER_LABELS[t as DoctorTier] ?? t;
// Fecha en hora de México, la misma que ve el doctor (review de #6.1, hallazgo 3).
const dia = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'America/Mexico_City' });

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const dryRun = params.get('dryRun') === '1';
  // `?forzar=1` — salta la ventana diaria para PROBAR el camino real.
  //
  // Existe porque `dryRun` enseña la decisión pero no escribe, y sin esto la
  // única forma de ver una baja o un congelamiento de verdad era esperar a las
  // 9 de la mañana. Un camino que sólo se puede probar una vez al día no se
  // prueba. Va detrás del MISMO `CRON_SECRET`, así que quien puede forzarlo ya
  // podía correr el cron.
  //
  // ⚠️ La ventana no es decorativa: evita repetir el aviso de «no cabe» cada 15
  // minutos. Forzar dos veces el mismo día manda el aviso dos veces.
  const forzar = params.get('forzar') === '1';
  const ahora = new Date();

  if (!dryRun && !forzar) {
    const mx = ahora.toLocaleString('sv-SE', { timeZone: 'America/Mexico_City' });
    if (mx.slice(11, 13) !== '09' || Number(mx.slice(14, 16)) >= 15) {
      return NextResponse.json({ success: true, skipped: 'fuera de la ventana diaria (09:00–09:14 MX)' });
    }
  }
  if (forzar) console.log('[COBRO] cron FORZADO fuera de la ventana diaria');

  const cliente = stripeCobro();
  if (!cliente) return NextResponse.json({ success: true, skipped: 'cobro no configurado' });

  const corte = new Date(ahora.getTime() - DIAS_DE_MARGEN * 24 * 60 * 60 * 1000);
  const vencidas = await prisma.subscription.findMany({
    // Las ya congeladas no se vuelven a revisar: no hay nada más que hacerles
    // y el aviso se repetiría todos los días.
    where: {
      pagadoHasta: { lt: corte },
      doctor: { tier: { notIn: ['FREE', 'LAB'] }, congeladaDesde: null },
    },
    select: {
      stripeSubscriptionId: true,
      pagadoHasta: true,
      doctor: { select: { id: true, slug: true, tier: true } },
    },
  });

  const resultados: { slug: string; accion: string }[] = [];
  for (const fila of vencidas) {
    const { slug, tier, id: doctorId } = fila.doctor;
    const pagado = dia(fila.pagadoHasta!);
    const margen = dia(finDelMargen(fila.pagadoHasta!));

    try {
      // ¿Stripe dice que SÍ está al corriente? ⇒ webhook perdido, no se toca.
      if (fila.stripeSubscriptionId) {
        const enStripe = await cliente.subscriptions.retrieve(fila.stripeSubscriptionId).catch((e: unknown) => {
          if (esErrorDeStripe(e) && e.code === 'resource_missing') return null;
          throw e;
        });
        // 🔴 No existe en este modo de Stripe ⇒ es una fila del OTRO modo (p.ej.
        // de prueba, después de pasar a vivo). No se baja a nadie por eso: la
        // pantalla también la ignora (`filaDeCobroVigente`). Sólo se avisa
        // (review de #6.1, hallazgo 2).
        if (!enStripe) {
          resultados.push({ slug, accion: 'la suscripción no existe en este modo de Stripe; no se toca' });
          if (!dryRun) {
            await avisarAdmin(
              `⚠️ ${slug}: su suscripción ${fila.stripeSubscriptionId} no existe en el modo actual de Stripe ` +
                `(¿fila de prueba tras pasar a vivo?). No se bajó el plan — revisar y limpiar la fila.`,
            );
          }
          continue;
        }
        const finItem = enStripe?.items.data[0]?.current_period_end;
        if (enStripe?.status === 'active' && finItem && finItem * 1000 > ahora.getTime()) {
          resultados.push({ slug, accion: 'Stripe dice que está al corriente; no se toca' });
          if (!dryRun) {
            await avisarAdmin(
              `⚠️ ${slug}: nuestra BD dice pagado hasta ${pagado}, pero Stripe tiene la suscripción activa. ` +
                `Probablemente se perdió un webhook de pago. No se bajó el plan — revisar.`,
            );
          }
          continue;
        }
      }

      const cabe = await cabeEnPlan(prisma, doctorId, 'FREE');
      if (!cabe.cabe) {
        // #6.2: no cabe ⇒ se CONGELA. No se toca su tier (así al pagar no hay
        // nada que restaurar) ni se borra nada: sólo queda limitada a «Mi
        // Cuenta» y pagar hasta que vuelva a pagar.
        if (dryRun) {
          resultados.push({ slug, accion: `no cabe en Gratis; se congelaría (sigue en ${tier})` });
          continue;
        }
        await prisma.doctor.updateMany({
          where: { id: doctorId, congeladaDesde: null },
          data: { congeladaDesde: ahora },
        });
        resultados.push({ slug, accion: `congelada (sigue en ${tier}, no cabe en Gratis)` });
        await avisarAdmin(
          `🧊 ${slug} quedó CONGELADA: dejó de pagar (pagado hasta ${pagado}, margen hasta ${margen}) y no cabe ` +
            `en Gratis: ${cabe.motivo} Sólo puede entrar a Mi Cuenta para pagar. La descongela un pago, o ` +
            `pasarla a LAB en el admin (otro plan de pago a mano se vuelve a congelar al día siguiente).`,
        );
        continue;
      }

      if (dryRun) {
        resultados.push({ slug, accion: `pasaría de ${tier} a FREE` });
        continue;
      }

      const r = await setDoctorTier({
        db: prisma,
        doctorId,
        tier: 'FREE',
        origen: 'script',
        actor: 'cron:cobro-vencido',
        motivo: `Dejó de pagar: pagado hasta ${pagado}; el margen de ${DIAS_DE_MARGEN} días venció el ${margen}`,
      });
      if (r.ok) {
        resultados.push({ slug, accion: r.changed ? `${r.from} -> FREE` : 'ya estaba en FREE' });
        if (r.changed) {
          await avisarAdmin(
            `⬇️ ${slug} pasó de ${nombre(r.from)} a Gratis: dejó de pagar (pagado hasta ${pagado}) y venció el margen de ${DIAS_DE_MARGEN} días.`,
          );
        }
      } else {
        resultados.push({ slug, accion: `no se pudo: ${r.code}` });
        await avisarAdmin(`🔴 ${slug}: no se pudo pasar a Gratis tras dejar de pagar: ${r.mensaje}`);
      }
    } catch (e) {
      console.error('[COBRO] cron cobro-vencido', slug, e);
      resultados.push({ slug, accion: `error: ${e instanceof Error ? e.message : 'desconocido'}` });
    }
  }

  return NextResponse.json({ success: true, dryRun, revisadas: vencidas.length, resultados });
}
