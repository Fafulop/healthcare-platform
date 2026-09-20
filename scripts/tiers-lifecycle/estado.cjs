/**
 * TIERS — banco de pruebas del ciclo de vida del cobro. FOTO y RESTAURACIÓN.
 *
 * Esto corre contra PRODUCCIÓN (no hay otra base). Por eso lo primero que
 * existe es cómo DESHACER, y por eso se corre `foto` ANTES de tocar nada.
 *
 *   node estado.cjs foto       → guarda el estado actual a un archivo JSON
 *   node estado.cjs restaurar  → lo devuelve EXACTAMENTE a esa foto
 *   node estado.cjs ver        → imprime el estado de ahora, sin tocar nada
 *
 * Correr con:
 *   railway run --service pgvector node scripts/tiers-lifecycle/estado.cjs foto
 *
 * Cuentas que toca, y NINGUNA otra:
 *   · dr-quebradita — la del usuario, para ver el ciclo en pantalla. Su fila de
 *     `subscriptions` es REAL (modo prueba) y se guarda entera.
 *   · fffffffff     — cuenta basura, para la rama de CONGELAR, que necesita
 *     pasarse del cupo de GRATIS (y por eso le sembramos pacientes falsos).
 */

const fs = require('fs');
const path = require('path');

const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient } = require('C:/Users/52331/docs-front/packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url } } });

const SLUGS = ['dr-quebradita', 'fffffffff'];
const FOTO = path.join(__dirname, 'foto.json');
/** Marca de los pacientes sembrados: sólo se borran los que tengan esto. */
const MARCA = 'PRUEBA-CICLO-TIERS';

async function leer() {
  const doctores = await prisma.doctor.findMany({
    where: { slug: { in: SLUGS } },
    select: { id: true, slug: true, tier: true, congeladaDesde: true },
  });
  const subs = await prisma.subscription.findMany({
    where: { doctorId: { in: doctores.map((d) => d.id) } },
  });
  const pacientes = {};
  for (const d of doctores) {
    pacientes[d.slug] = await prisma.patient.count({ where: { doctorId: d.id, status: 'active' } });
  }
  const sembrados = await prisma.patient.count({ where: { generalNotes: MARCA } });
  return { tomadaEn: new Date().toISOString(), doctores, subs, pacientes, sembrados };
}

function imprimir(e) {
  for (const d of e.doctores) {
    const s = e.subs.find((x) => x.doctorId === d.id);
    console.log(
      `  ${d.slug.padEnd(16)} tier=${String(d.tier).padEnd(7)}` +
        ` congelada=${d.congeladaDesde ? 'SÍ' : 'no'}` +
        ` pacientes=${String(e.pacientes[d.slug]).padStart(3)}` +
        (s
          ? ` | sub ${s.status} pagado_hasta=${s.pagadoHasta ? s.pagadoHasta.toISOString().slice(0, 10) : '—'}` +
            ` subId=${s.stripeSubscriptionId ? s.stripeSubscriptionId.slice(0, 18) + '…' : 'NULL'}`
          : ' | sin fila de suscripción'),
    );
  }
  if (e.sembrados) console.log(`  ⚠️ hay ${e.sembrados} pacientes sembrados por la prueba`);
}

async function main() {
  const accion = process.argv[2];

  if (accion === 'ver') {
    const e = await leer();
    console.log('ESTADO AHORA:');
    imprimir(e);
    return;
  }

  if (accion === 'foto') {
    if (fs.existsSync(FOTO)) {
      console.log('🔴 Ya existe foto.json. Si quedó de una corrida anterior, RESTAURA primero.');
      console.log('   (Sobrescribirla perdería el estado bueno para siempre.)');
      process.exitCode = 1;
      return;
    }
    const e = await leer();
    fs.writeFileSync(FOTO, JSON.stringify(e, null, 2));
    console.log('FOTO GUARDADA en', FOTO);
    imprimir(e);
    return;
  }

  if (accion === 'restaurar') {
    if (!fs.existsSync(FOTO)) {
      console.log('🔴 No hay foto.json: no sé a qué estado volver. No toco nada.');
      process.exitCode = 1;
      return;
    }
    const e = JSON.parse(fs.readFileSync(FOTO, 'utf8'));

    // 1. Los pacientes sembrados, por su marca. Nunca un `deleteMany` amplio.
    const borrados = await prisma.patient.deleteMany({ where: { generalNotes: MARCA } });
    console.log('pacientes de prueba borrados:', borrados.count);

    // 2. Las solicitudes de cambio de plan que haya dejado la prueba.
    for (const d of e.doctores) {
      await prisma.solicitudCambioPlan.deleteMany({ where: { doctorId: d.id, solicitadoPor: 'probe' } });
    }

    // 3. Tier y congelada, tal como estaban.
    for (const d of e.doctores) {
      await prisma.doctor.update({
        where: { id: d.id },
        data: { tier: d.tier, congeladaDesde: d.congeladaDesde ? new Date(d.congeladaDesde) : null },
      });
    }

    // 4. Las filas de suscripción: las que había se reponen campo por campo; las
    //    que NO había (las creó la prueba) se borran.
    const idsConSub = new Set(e.subs.map((s) => s.doctorId));
    for (const d of e.doctores) {
      if (!idsConSub.has(d.id)) {
        const n = await prisma.subscription.deleteMany({ where: { doctorId: d.id } });
        if (n.count) console.log(`fila de suscripción creada por la prueba, borrada (${d.slug})`);
      }
    }
    for (const s of e.subs) {
      await prisma.subscription.update({
        where: { id: s.id },
        data: {
          stripeCustomerId: s.stripeCustomerId,
          stripeSubscriptionId: s.stripeSubscriptionId,
          stripePriceId: s.stripePriceId,
          status: s.status,
          currentPeriodEnd: s.currentPeriodEnd ? new Date(s.currentPeriodEnd) : null,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
          lastPaymentAt: s.lastPaymentAt ? new Date(s.lastPaymentAt) : null,
          pagadoHasta: s.pagadoHasta ? new Date(s.pagadoHasta) : null,
        },
      });
    }

    const ahora = await leer();
    console.log('\nRESTAURADO. Estado actual:');
    imprimir(ahora);

    // Se comprueba de verdad, campo por campo, en vez de confiar en que salió.
    const problemas = [];
    for (const d of e.doctores) {
      const a = ahora.doctores.find((x) => x.id === d.id);
      if (a.tier !== d.tier) problemas.push(`${d.slug}: tier ${a.tier} ≠ ${d.tier}`);
      const antes = d.congeladaDesde ? new Date(d.congeladaDesde).getTime() : null;
      const desp = a.congeladaDesde ? a.congeladaDesde.getTime() : null;
      if (antes !== desp) problemas.push(`${d.slug}: congelada ${desp} ≠ ${antes}`);
    }
    for (const s of e.subs) {
      const a = ahora.subs.find((x) => x.id === s.id);
      if (!a) { problemas.push(`falta la fila de suscripción ${s.id}`); continue; }
      if (a.stripeSubscriptionId !== s.stripeSubscriptionId) problemas.push(`${s.id}: subId no coincide`);
      const ph = s.pagadoHasta ? new Date(s.pagadoHasta).getTime() : null;
      if ((a.pagadoHasta ? a.pagadoHasta.getTime() : null) !== ph) problemas.push(`${s.id}: pagado_hasta no coincide`);
      if (a.status !== s.status) problemas.push(`${s.id}: status ${a.status} ≠ ${s.status}`);
    }
    if (ahora.sembrados) problemas.push(`quedan ${ahora.sembrados} pacientes sembrados`);

    if (problemas.length) {
      console.log('\n🔴 NO quedó igual que la foto:');
      problemas.forEach((p) => console.log('   ·', p));
      process.exitCode = 1;
    } else {
      console.log('\n✅ Idéntico a la foto. Se borra foto.json.');
      fs.unlinkSync(FOTO);
    }
    return;
  }

  console.log('uso: node estado.cjs [foto|restaurar|ver]');
  process.exitCode = 1;
}

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
