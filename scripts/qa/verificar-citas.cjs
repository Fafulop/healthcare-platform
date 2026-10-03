// SÓLO LECTURA — la «prueba en la BD» de las corridas de AGENDA de docs/DESDE JUNIO/PRUEBAS Y GUIAS/.
// Complemento de verificar-flujo.cjs: aquél parte de un EXPEDIENTE; éste parte de la CITA, así que
// también ve las citas sin expediente (patient_id NULL), que verificar-flujo no encuentra.
//
// Correr desde la raíz del repo:
//   railway run --service pgvector node scripts/qa/verificar-citas.cjs <"texto del nombre en la cita" | bookingId> [minutos]
// Imprime TODO lo que la cita guarda (horario, slot/rango, consultorio, expediente, estado y sus
// sellos, correo de confirmación, recordatorio, Google, Meet, link de pago, ingreso, visita, sesión)
// y la bitácora de actividad (activity_logs) de dr-prueba de los últimos N minutos (default 60).
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));

const DR_PRUEBA = 'cmni1bov90000mk0lyeztr3ad';
const arg = process.argv[2];
const minutos = Number(process.argv[3] || 60);
if (!arg) {
  console.error('Uso: node scripts/qa/verificar-citas.cjs <"nombre" | bookingId> [minutos]');
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
const desde = new Date(Date.now() - minutos * 60_000);
const ts = (d) => (d ? new Date(d).toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—');
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const $ = (v) => (v === null || v === undefined ? '—' : `$${Number(v).toLocaleString('es-MX')}`);

(async () => {
  try {
    const citas = await prisma.booking.findMany({
      where: { doctorId: DR_PRUEBA, OR: [{ id: arg }, { patientName: { contains: arg, mode: 'insensitive' } }] },
      orderBy: { createdAt: 'asc' }, take: 20,
      include: {
        slot: { select: { date: true, startTime: true, endTime: true, locationId: true, googleEventId: true } },
        location: { select: { name: true } },
        patient: { select: { id: true, firstName: true, lastName: true } },
        paymentLink: true,
        mpPaymentPreference: true,
        ledgerEntry: { select: { id: true, amount: true, amountPaid: true, formaDePago: true, origin: true, paymentStatus: true, concept: true, transactionDate: true } },
        visita: { select: { id: true, fecha: true, origen: true } },
        tratamientoSesion: { select: { numero: true, tratamiento: { select: { nombre: true } } } },
      },
    });
    console.log(`CITAS que coinciden con «${arg}» (${citas.length})\n`);
    for (const b of citas) {
      const cuando = b.slot ? `${dia(b.slot.date)} ${b.slot.startTime}–${b.slot.endTime} (SLOT ${b.slotId})` : `${dia(b.date)} ${b.startTime}–${b.endTime} (${b.duration} min, sin slot)`;
      console.log(`■ ${b.id} · ${b.status}${b.isRescheduled ? ' (reagendada)' : ''}`);
      console.log(`   cuándo      ${cuando}`);
      console.log(`   paciente    «${b.patientName}» (nombre=${b.patientFirstName ?? '—'} · apellidos=${b.patientLastName ?? '—'}) · ${b.patientEmail || '—'} · tel ${b.patientPhone || '—'} · wa ${b.patientWhatsapp ?? '—'}`);
      console.log(`   expediente  ${b.patient ? `${b.patient.firstName} ${b.patient.lastName} · ${b.patient.id}` : 'NINGUNO (patient_id NULL)'}`);
      console.log(`   servicio    ${b.serviceName ?? '—'} · precio ${$(b.finalPrice)} · ${b.isFirstTime === null ? '—' : b.isFirstTime ? 'primera vez' : 'recurrente'} · ${b.appointmentMode ?? '—'}`);
      console.log(`   consultorio ${b.location?.name ?? 'NO REGISTRADO'}${b.slot ? ` · (slot: ${b.slot.locationId ?? '—'})` : ''}`);
      console.log(`   sellos      creada ${ts(b.createdAt)} · confirmada ${ts(b.confirmedAt)} · cancelada ${ts(b.cancelledAt)} · actualizada ${ts(b.updatedAt)}`);
      console.log(`   correos     confirmación ${ts(b.confirmationEmailSentAt)} · recordatorio ${ts(b.reminderEmailSentAt)} · código ${b.confirmationCode ? 'sí' : '—'}`);
      console.log(`   google      evento ${b.googleEventId ?? b.slot?.googleEventId ?? '—'} · meet ${b.meetLink ?? '—'}`);
      console.log(`   factura?    ${b.facturaSolicitada ?? '—'} · extendida ${b.extendedBlockMinutes ?? '—'} min`);
      console.log(`   link pago   ${b.paymentLink ? `Stripe ${b.paymentLink.status} activo=${b.paymentLink.isActive} ${$(b.paymentLink.amount)} pagado ${ts(b.paymentLink.paidAt)} · ${b.paymentLink.id}` : '—'}`);
      console.log(`   link MP     ${b.mpPaymentPreference ? `${b.mpPaymentPreference.status} activo=${b.mpPaymentPreference.isActive} ${$(b.mpPaymentPreference.amount)} pagado ${ts(b.mpPaymentPreference.paidAt)} · ${b.mpPaymentPreference.id}` : '—'}`);
      const le = b.ledgerEntry;
      console.log(`   ingreso     ${le ? `#${le.id} ${$(le.amount)} pagado ${$(le.amountPaid)} ${le.formaDePago ?? ''} · ${le.origin ?? ''} ${le.paymentStatus ?? ''} · ${dia(le.transactionDate)} · «${le.concept}»` : '—'}`);
      console.log(`   visita      ${b.visita ? `${b.visita.id} · ${dia(b.visita.fecha)} · ${b.visita.origen}` : '—'}${b.tratamientoSesion ? ` · sesión ${b.tratamientoSesion.numero} «${b.tratamientoSesion.tratamiento.nombre}»` : ''}`);
      console.log(`   notas       ${b.notes ?? '—'}\n`);
    }

    const ids = citas.map((c) => c.id);
    const logs = await prisma.activityLog.findMany({
      where: { doctorId: DR_PRUEBA, timestamp: { gte: desde } }, orderBy: { timestamp: 'asc' },
      select: { timestamp: true, actionType: true, entityType: true, entityId: true, displayMessage: true },
    });
    console.log(`ACTIVITY_LOGS de dr-prueba, últimos ${minutos} min (${logs.length}; ◆ = de estas citas)`);
    for (const l of logs) console.log(`  ${ids.includes(l.entityId) ? '◆' : ' '} ${ts(l.timestamp)} ${l.actionType} ${l.entityType} ${l.entityId ?? ''} · ${l.displayMessage}`);
  } catch (e) {
    console.log('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
