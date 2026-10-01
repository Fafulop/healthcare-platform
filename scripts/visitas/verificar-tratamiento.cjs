// SÓLO LECTURA — la "prueba en la BD" de una prueba a mano de Tratamientos (ver
// docs/DESDE JUNIO/VISITAS/04-PRUEBAS-flujos-verificados.md). Lo que dice la UI no es evidencia:
// esto lee lo que de verdad quedó guardado para UN tratamiento.
//
// Correr (desde packages/database, que es donde `railway run` tiene el servicio ligado):
//   railway run --service pgvector node ../../scripts/visitas/verificar-tratamiento.cjs <tratamientoId> [minutos]
// `minutos` (default 90) = ventana para contar links de pago nuevos del doctor.
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));

const tratamientoId = process.argv[2];
const minutos = Number(process.argv[3] || 90);
if (!tratamientoId) {
  console.error('Uso: node verificar-tratamiento.cjs <tratamientoId> [minutos]');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });

(async () => {
  try {
    const t = await prisma.tratamiento.findUnique({
      where: { id: tratamientoId },
      select: {
        nombre: true, estado: true, precioPaquete: true, doctorId: true, patientId: true,
        sesiones: {
          orderBy: { numero: 'asc' },
          select: {
            numero: true, cancelada: true, bookingId: true, visitaId: true,
            booking: { select: { date: true, startTime: true, status: true, isRescheduled: true, facturaSolicitada: true } },
          },
        },
      },
    });
    if (!t) { console.log('No existe ese tratamiento (¿se borró?).'); return; }
    console.log(`TRATAMIENTO «${t.nombre}» · ${t.estado} · precioPaquete=${t.precioPaquete ?? 'sin paquete'}`);
    for (const s of t.sesiones) {
      const b = s.booking;
      console.log(`  Sesión ${s.numero}${s.cancelada ? ' (CANCELADA)' : ''} · cita=${s.bookingId ?? '—'}` +
        (b ? ` ${b.date?.toISOString().slice(0, 10)} ${b.startTime} ${b.status}${b.isRescheduled ? ' (reagendada)' : ''}${b.facturaSolicitada ? ' factura✓' : ''}` : '') +
        ` · visita=${s.visitaId ?? '—'}`);
    }

    const movimientos = await prisma.ledgerEntry.findMany({
      where: { doctorId: t.doctorId, tratamientoId },
      orderBy: { id: 'asc' },
      select: {
        id: true, amount: true, origin: true, concept: true, subarea: true, formaDePago: true,
        transactionDate: true, bookingId: true, hasFactura: true,
      },
    });
    console.log(`\nFLUJO DE DINERO (${movimientos.length} movimientos con tratamiento_id):`);
    for (const m of movimientos) {
      console.log(`  #${m.id} $${m.amount} · origin=${m.origin} · ${m.transactionDate.toISOString().slice(0, 10)} · ` +
        `cita=${m.bookingId ?? '—'} · subarea='${m.subarea ?? ''}' · ${m.formaDePago} · factura=${m.hasFactura}\n      «${m.concept}»`);
    }
    const pagado = movimientos.filter((m) => m.origin === 'manual').reduce((a, m) => a + Number(m.amount), 0);
    if (t.precioPaquete !== null) {
      console.log(`  → pagado=${pagado} · saldo=${Number(t.precioPaquete) - pagado} (lo que debe mostrar la pantalla)`);
    }

    const desde = new Date(Date.now() - minutos * 60 * 1000);
    const [links, prefs] = await Promise.all([
      prisma.paymentLink.count({ where: { doctorId: t.doctorId, createdAt: { gte: desde } } }),
      prisma.mpPaymentPreference.count({ where: { doctorId: t.doctorId, createdAt: { gte: desde } } }),
    ]);
    console.log(`\nLINKS DE PAGO nuevos del doctor en ${minutos} min: Stripe=${links} · Mercado Pago=${prefs}`);

    const audit = await prisma.patientAuditLog.findMany({
      where: { resourceId: tratamientoId, NOT: { action: 'view_tratamiento' } },
      orderBy: { id: 'asc' },
      select: { action: true, changes: true },
    });
    console.log('\nBITÁCORA (sin las vistas):');
    for (const a of audit) console.log(`  ${a.action} ${JSON.stringify(a.changes)}`);
  } finally {
    await prisma.$disconnect();
  }
})();
