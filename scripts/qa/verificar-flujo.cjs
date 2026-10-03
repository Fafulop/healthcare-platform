// SÓLO LECTURA — la «prueba en la BD» de una corrida de docs/DESDE JUNIO/PRUEBAS Y GUIAS/.
// La pantalla no es evidencia: esto lee lo que de verdad quedó para UN paciente (su agenda, sus
// visitas, sus ventas, sus tratamientos, sus movimientos de Flujo de Dinero y la bitácora reciente).
//
// Correr desde la raíz del repo:
//   railway run --service pgvector node scripts/qa/verificar-flujo.cjs <patientId | "texto del nombre"> [minutos]
// `minutos` (default 180) = ventana de la bitácora de auditoría y de «lo nuevo» (marcado con ★).
// Por nombre busca SÓLO en dr-prueba.
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));

const DR_PRUEBA = 'cmni1bov90000mk0lyeztr3ad';
const arg = process.argv[2];
const minutos = Number(process.argv[3] || 180);
if (!arg) {
  console.error('Uso: node scripts/qa/verificar-flujo.cjs <patientId | "nombre"> [minutos]');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
const desde = new Date(Date.now() - minutos * 60_000);
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const nuevo = (d) => (d && new Date(d) >= desde ? '★ ' : '  ');
const $ = (v) => (v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-MX')}`);

(async () => {
  try {
    let p = await prisma.patient.findFirst({ where: { id: arg }, select: { id: true, firstName: true, lastName: true, doctorId: true, status: true, email: true } });
    if (!p) {
      const [a, ...b] = arg.split(' ');
      const cands = await prisma.patient.findMany({
        where: { doctorId: DR_PRUEBA, OR: [{ firstName: { contains: arg, mode: 'insensitive' } }, { firstName: { contains: a, mode: 'insensitive' }, lastName: { contains: b.join(' ') || a, mode: 'insensitive' } }] },
        select: { id: true, firstName: true, lastName: true, doctorId: true, status: true, email: true }, take: 5,
      });
      if (cands.length !== 1) {
        console.log(cands.length ? 'Varios pacientes; usa el id:' : 'No encontré ese paciente en dr-prueba.');
        for (const c of cands) console.log(`  ${c.id}  ${c.firstName} ${c.lastName}`);
        return;
      }
      p = cands[0];
    }
    console.log(`PACIENTE ${p.firstName} ${p.lastName} · ${p.id} · ${p.status} · correo=${p.email ?? '—'} · doctor=${p.doctorId === DR_PRUEBA ? 'dr-prueba' : p.doctorId}`);
    console.log(`(★ = creado/movido en los últimos ${minutos} min)\n`);

    const citas = await prisma.booking.findMany({
      where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 25,
      select: {
        id: true, date: true, startTime: true, status: true, finalPrice: true, isRescheduled: true, serviceName: true,
        appointmentMode: true, createdAt: true, updatedAt: true, slot: { select: { date: true } },
        ledgerEntry: { select: { id: true, amount: true, amountPaid: true, formaDePago: true, origin: true, paymentStatus: true } },
        visita: { select: { id: true } }, tratamientoSesion: { select: { numero: true, tratamiento: { select: { nombre: true } } } },
      },
    });
    console.log(`CITAS (${citas.length})`);
    for (const b of citas) {
      const le = b.ledgerEntry;
      console.log(`${nuevo(b.updatedAt)}${dia(b.slot?.date ?? b.date)} ${b.startTime ?? '--:--'} ${b.status}${b.isRescheduled ? ' (reagendada)' : ''} · ${b.serviceName ?? 'sin servicio'} · precio ${$(b.finalPrice)}` +
        ` · ingreso ${le ? `#${le.id} ${$(le.amount)} pagado ${$(le.amountPaid)} ${le.formaDePago ?? ''} ${le.origin ?? ''} ${le.paymentStatus ?? ''}` : '—'}` +
        ` · visita ${b.visita?.id ?? '—'}${b.tratamientoSesion ? ` · sesión ${b.tratamientoSesion.numero} «${b.tratamientoSesion.tratamiento.nombre}»` : ''} · ${b.id}`);
    }

    const visitas = await prisma.visita.findMany({
      where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 25,
      select: { id: true, fecha: true, origen: true, bookingId: true, createdAt: true, updatedAt: true, _count: { select: { encounters: true, media: true, prescriptions: true } } },
    });
    console.log(`\nVISITAS (${visitas.length})`);
    for (const v of visitas) {
      console.log(`${nuevo(v.updatedAt)}${dia(v.fecha)} ${v.origen} · cita ${v.bookingId ?? '—'} · plantillas ${v._count.encounters} · fotos ${v._count.media} · recetas ${v._count.prescriptions} · ${v.id}`);
    }

    const ventas = await prisma.sale.findMany({
      where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 25,
      select: { id: true, saleNumber: true, total: true, amountPaid: true, status: true, paymentStatus: true, visitaId: true, createdAt: true },
    });
    const ingresosDeVentas = ventas.length
      ? await prisma.ledgerEntry.findMany({ where: { saleId: { in: ventas.map((v) => v.id) } }, select: { id: true, saleId: true, amount: true, amountPaid: true, formaDePago: true } })
      : [];
    console.log(`\nVENTAS (${ventas.length})`);
    for (const v of ventas) {
      const les = ingresosDeVentas.filter((l) => l.saleId === v.id);
      console.log(`${nuevo(v.createdAt)}${v.saleNumber} ${$(v.total)} pagado ${$(v.amountPaid)} ${v.status}/${v.paymentStatus} · visita ${v.visitaId ?? '—'}` +
        ` · ingresos ${les.length}${les.map((l) => ` [#${l.id} ${$(l.amount)} pagado ${$(l.amountPaid)} ${l.formaDePago ?? ''}]`).join('')}`);
    }

    const movs = await prisma.ledgerEntry.findMany({
      where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, amount: true, amountPaid: true, entryType: true, origin: true, concept: true, formaDePago: true, bookingId: true, saleId: true, transactionDate: true, createdAt: true },
    });
    console.log(`\nFLUJO DE DINERO del paciente (${movs.length})`);
    for (const m of movs) {
      console.log(`${nuevo(m.createdAt)}#${m.id} ${m.entryType} ${$(m.amount)} pagado ${$(m.amountPaid)} ${m.formaDePago ?? ''} · ${m.origin ?? ''} · ${dia(m.transactionDate)} · «${m.concept}»` +
        `${m.bookingId ? ` · cita ${m.bookingId}` : ''}${m.saleId ? ` · venta ${m.saleId}` : ''}`);
    }
    const dupCitas = movs.filter((m) => m.bookingId).map((m) => m.bookingId);
    const dupVentas = movs.filter((m) => m.saleId).map((m) => m.saleId);
    const dup = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);
    if (dup(dupCitas).length || dup(dupVentas).length) console.log(`⚠️ DUPLICADOS: citas ${dup(dupCitas)} · ventas ${dup(dupVentas)}`);

    const trats = await prisma.tratamiento.findMany({
      where: { patientId: p.id }, orderBy: { createdAt: 'desc' }, take: 10,
      select: { id: true, nombre: true, estado: true, sesiones: { orderBy: { numero: 'asc' }, select: { numero: true, cancelada: true, bookingId: true, visitaId: true, servicioNombre: true, precio: true } } },
    });
    console.log(`\nTRATAMIENTOS (${trats.length})`);
    for (const t of trats) {
      console.log(`  «${t.nombre}» ${t.estado} · ${t.id}`);
      for (const s of t.sesiones) console.log(`     sesión ${s.numero}${s.cancelada ? ' CANCELADA' : ''} · ${s.servicioNombre ?? 'sin servicio'} ${$(s.precio)} · cita ${s.bookingId ?? '—'} · visita ${s.visitaId ?? '—'}`);
    }

    const audit = await prisma.patientAuditLog.findMany({
      where: { patientId: p.id, timestamp: { gte: desde } }, orderBy: { timestamp: 'asc' },
      select: { timestamp: true, action: true, resourceType: true, resourceId: true, userRole: true },
    });
    console.log(`\nBITÁCORA últimos ${minutos} min (${audit.length})`);
    for (const a of audit) console.log(`  ${a.timestamp.toISOString().slice(11, 19)} ${a.action} ${a.resourceType} ${a.resourceId ?? ''} (${a.userRole})`);
  } catch (e) {
    console.log('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
