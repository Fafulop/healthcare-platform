/**
 * TIERS — el ciclo de vida del cobro, de punta a punta, contra PRODUCCIÓN.
 *
 * Qué prueba y qué NO:
 *
 *   ✅ Lo que NUNCA se había ejecutado: el cron bajando a alguien de verdad, el
 *      congelamiento AUTOMÁTICO por no caber en Gratis, y que un pago
 *      DESCONGELE. Hasta hoy #6.1 sólo tenía probado el `dryRun` y #6.2 un
 *      congelamiento puesto a mano.
 *   ❌ Que Stripe EMITA lo que creemos, cuando lo creemos. Eso sólo lo prueban
 *      los relojes de prueba (test clocks) — o el 17/18 de octubre, solo y sin
 *      nadie mirando. Aquí se prueba NUESTRO lado.
 *   ❌ SUBIR de plan. No hace falta: es la única pata con evidencia real —el
 *      webhook ya escribió 3 veces en prod con cobros de verdad—, y falsearla
 *      exigiría que Stripe reportara un precio que no tiene.
 *
 * ANTES de correr esto hay que tener la foto:
 *   railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs foto
 * Y al terminar, pase lo que pase:
 *   railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs restaurar
 *
 * Necesita, además de la BD, dos secretos del servicio api:
 *   CRON_SECRET=… API_URL=… railway run --service pgvector node ciclo.cjs
 */

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient } = require('C:/Users/52331/docs-front/packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });

const API = process.env.API_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const MARCA = 'PRUEBA-CICLO-TIERS';
const DIAS_DE_MARGEN = 15;

let fallos = 0;
function comprobar(queSeEspera, ok, detalle) {
  console.log(`   ${ok ? '✅' : '🔴'} ${queSeEspera}${detalle ? ' — ' + detalle : ''}`);
  if (!ok) fallos++;
}

const doctorPorSlug = (slug) =>
  prisma.doctor.findFirst({
    where: { slug },
    select: { id: true, slug: true, tier: true, congeladaDesde: true },
  });

async function correrCron({ dryRun }) {
  const q = dryRun ? '?dryRun=1' : '?forzar=1';
  const res = await fetch(`${API}/api/cron/cobro-vencido${q}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

/** Deja `pagado_hasta` más allá del margen y desliga la suscripción de Stripe.
 *  Desligarla es NECESARIO: el cron le pregunta a Stripe antes de bajar a
 *  nadie, y allá la suscripción sigue viva hasta octubre — con razón se negaría
 *  («Stripe dice que está al corriente; no se toca»). */
async function simularQueDejoDePagar(doctorId, { conSubId = null } = {}) {
  const vencido = new Date(Date.now() - (DIAS_DE_MARGEN + 1) * 24 * 60 * 60 * 1000);
  const fila = await prisma.subscription.findFirst({ where: { doctorId } });
  if (fila) {
    await prisma.subscription.update({
      where: { id: fila.id },
      data: { pagadoHasta: vencido, status: 'canceled', stripeSubscriptionId: conSubId },
    });
  } else {
    await prisma.subscription.create({
      data: {
        doctorId,
        stripeCustomerId: `cus_prueba_${doctorId.slice(0, 8)}`,
        stripeSubscriptionId: conSubId,
        stripePriceId: null,
        status: 'canceled',
        pagadoHasta: vencido,
        cancelAtPeriodEnd: false,
      },
    });
  }
  return vencido;
}

async function sembrarPacientes(doctorId, cuantos) {
  const datos = Array.from({ length: cuantos }, (_, i) => ({
    doctorId,
    internalId: `${MARCA}-${i}`,
    firstName: 'Prueba',
    lastName: `Ciclo ${i}`,
    status: 'active',
    // `dateOfBirth` y `sex` son OBLIGATORIOS en Patient: sin ellos
    // `createMany` revienta entero (así falló la primera corrida).
    dateOfBirth: new Date('1990-01-01'),
    sex: 'other',
    generalNotes: MARCA,
  }));
  await prisma.patient.createMany({ data: datos, skipDuplicates: true });
}

async function main() {
  if (!API || !CRON_SECRET) {
    console.log('🔴 Faltan API_URL o CRON_SECRET en el entorno.');
    process.exitCode = 1;
    return;
  }

  console.log('══ 1. El cron NO toca a quien está al corriente ═══════════════');
  {
    const r = await correrCron({ dryRun: true });
    const tocaQuebradita = JSON.stringify(r.json).includes('dr-quebradita');
    comprobar('dr-quebradita, pagada hasta octubre, no aparece', !tocaQuebradita,
      `cron respondió ${r.status}`);
  }

  console.log('\n══ 2. Deja de pagar y vence el margen ⇒ baja a GRATIS ═════════');
  {
    const d = await doctorPorSlug('dr-quebradita');
    const vencido = await simularQueDejoDePagar(d.id);
    console.log(`   (pagado_hasta = ${vencido.toISOString().slice(0, 10)}, ${DIAS_DE_MARGEN + 1} días atrás)`);

    const seco = await correrCron({ dryRun: true });
    const texto = JSON.stringify(seco.json);
    comprobar('en seco DICE que la bajaría a FREE', texto.includes('FREE') && texto.includes('dr-quebradita'),
      texto.slice(0, 160));

    const real = await correrCron({ dryRun: false });
    comprobar('la corrida real no dice "fuera de la ventana"',
      !JSON.stringify(real.json).includes('fuera de la ventana'), `status ${real.status}`);

    const desp = await doctorPorSlug('dr-quebradita');
    comprobar('dr-quebradita quedó en FREE', desp.tier === 'FREE', `tier=${desp.tier}`);
    comprobar('NO se congeló (cabe en Gratis con 3 pacientes)', !desp.congeladaDesde);

    const log = await prisma.tierChangeLog.findFirst({
      where: { doctorId: d.id }, orderBy: { createdAt: 'desc' },
    });
    comprobar('quedó rastro en tier_change_log', !!log && log.toTier === 'FREE',
      log ? `${log.fromTier}→${log.toTier} por ${log.actor}` : 'sin fila');
  }

  console.log('\n══ 3. No cabe en GRATIS ⇒ se CONGELA (cuenta basura) ══════════');
  {
    const d = await doctorPorSlug('fffffffff');
    await sembrarPacientes(d.id, 51);
    const n = await prisma.patient.count({ where: { doctorId: d.id, status: 'active' } });
    console.log(`   (sembrados: ahora tiene ${n} pacientes activos; Gratis permite 50)`);

    await simularQueDejoDePagar(d.id);
    const real = await correrCron({ dryRun: false });
    const texto = JSON.stringify(real.json);

    const desp = await doctorPorSlug('fffffffff');
    comprobar('fffffffff quedó CONGELADA', !!desp.congeladaDesde, texto.slice(0, 160));
    comprobar('su tier NO se tocó (al pagar no hay nada que restaurar)', desp.tier === 'PRO',
      `tier=${desp.tier}`);
  }

  console.log('\n== 4. Congelar a dr-quebradita y que un PAGO la descongele ==');
  {
    // Esta es la pata que nunca se habia visto correr: los pagos probados en
    // prod SUBIAN el plan; ninguno cayo sobre una cuenta CONGELADA.
    const d = await doctorPorSlug('dr-quebradita');
    await prisma.doctor.update({ where: { id: d.id }, data: { congeladaDesde: new Date() } });
    comprobar('queda congelada para la prueba', !!(await doctorPorSlug('dr-quebradita')).congeladaDesde);

    // Se le devuelve su id REAL de Stripe: el webhook consulta la suscripcion
    // para leer el precio, y con un id inventado no pasaria de ahi.
    const foto = require('./foto.json');
    const original = foto.subs.find((x) => x.doctorId === d.id);
    await prisma.subscription.updateMany({
      where: { doctorId: d.id },
      data: { stripeSubscriptionId: original.stripeSubscriptionId },
    });
    console.log('   SUB_ID para pago.cjs =', original.stripeSubscriptionId);
  }

  console.log('\n══ Resultado ══════════════════════════════════════════════════');
  if (fallos === 0) console.log('✅ Todas las comprobaciones pasaron.');
  else console.log(`🔴 ${fallos} comprobación(es) fallaron.`);
  console.log('\n⚠️ AHORA: restaurar. `node scripts/tiers-lifecycle/estado.cjs restaurar`');
  process.exitCode = fallos ? 1 : 0;
}

main()
  .catch((e) => { console.error('ERROR:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
