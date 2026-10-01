// T4 probe — runs the REAL syncVisitaForBooking + pasarSesionAlReagendar against prod inside ONE
// transaction that ALWAYS rolls back. Uses dr-prueba / «pepit perez» and its two CANCELLED test
// bookings (the «PRUEBA REAGENDAR» ones) — never a real one.
// Correr: cd packages/database && railway run --service pgvector npx tsx ../../scripts/visitas/tratamientos-probe-t4.ts
import { PrismaClient } from '../../packages/database/node_modules/@prisma/client';
import { syncVisitaForBooking } from '../../packages/database/src/visitas';
import { pasarSesionAlReagendar } from '../../packages/database/src/tratamientos';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
const ROLLBACK = new Error('ROLLBACK');
const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);

const doctorId = 'cmni1bov90000mk0lyeztr3ad';
const patientId = 'cmt7tu1as0007ms0ttc4pwijd'; // pepit perez
const B_VIEJA = 'cmupu3qfv0001pi0t9o531ogf'; // prueba REAGENDAR 11:00 (CANCELLED)
const B_NUEVA = 'cmupu5sbg0005pi0t3lrk02m1'; // prueba REAGENDAR 12:00 (CANCELLED, isRescheduled)
const quien = { userId: 'probe-t4', userRole: 'DOCTOR' };

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const otro = await tx.patient.findFirst({ where: { doctorId, NOT: { id: patientId } }, select: { id: true } });
      const t = await tx.tratamiento.create({
        data: {
          patientId, doctorId, nombre: 'PROBE T4', sesionesPlaneadas: 2,
          sesiones: { createMany: { data: [1, 2].map((numero) => ({ patientId, doctorId, numero })) } },
        },
        select: { id: true, sesiones: { orderBy: { numero: 'asc' }, select: { id: true } } },
      });
      const [s1, s2] = t.sesiones;

      // 1. Reagendar: sesión 1 en la cita vieja (cancelada) → la nueva (activa, isRescheduled).
      await tx.tratamientoSesion.update({ where: { id: s1.id }, data: { bookingId: B_VIEJA } });
      await tx.booking.update({ where: { id: B_NUEVA }, data: { status: 'CONFIRMED', isRescheduled: true } });
      const m = await pasarSesionAlReagendar(tx, { doctorId, deBookingId: B_VIEJA, aBookingId: B_NUEVA, ...quien });
      const s1m = await tx.tratamientoSesion.findUnique({ where: { id: s1.id }, select: { bookingId: true } });
      ok('Reagendar: movida y la sesión queda en la cita nueva', m.movida === true && s1m?.bookingId === B_NUEVA, JSON.stringify(m));
      const m2 = await pasarSesionAlReagendar(tx, { doctorId, deBookingId: B_VIEJA, aBookingId: B_NUEVA, ...quien });
      ok('Reagendar: repetirlo = sin_sesion', m2.movida === false && (m2 as any).motivo === 'sin_sesion', JSON.stringify(m2));

      // 2. P2: concluir la cita de la sesión 1 → la visita automática se GUARDA en la sesión.
      await tx.booking.update({ where: { id: B_NUEVA }, data: { status: 'COMPLETED' } });
      const r = await syncVisitaForBooking(tx, B_NUEVA, { quien });
      const s1a = await tx.tratamientoSesion.findUnique({ where: { id: s1.id }, select: { visitaId: true } });
      ok('P2: visita creada y guardada en la sesión', r.status === 'created' && !!s1a?.visitaId && s1a.visitaId === (r as any).visitaId, r.status);
      const r2 = await syncVisitaForBooking(tx, B_NUEVA, { quien });
      ok('P2: segunda sync = updated, misma visita', r2.status === 'updated' && (r2 as any).visitaId === s1a?.visitaId, r2.status);

      // 3. Reagendar una sesión que YA guarda visita → no se mueve.
      await tx.tratamientoSesion.update({ where: { id: s1.id }, data: { visitaId: null } });
      await tx.tratamientoSesion.update({ where: { id: s2.id }, data: { bookingId: B_VIEJA, visitaId: s1a!.visitaId } });
      const m3 = await pasarSesionAlReagendar(tx, { doctorId, deBookingId: B_VIEJA, aBookingId: B_NUEVA, ...quien });
      ok('Reagendar: sesión con visita NO se mueve', m3.movida === false && (m3 as any).motivo === 'sesion_con_visita', JSON.stringify(m3));

      // 4. G1b: la cita pasa a OTRO paciente → la sesión de pepit la suelta, con auditoría.
      if (otro) {
        await tx.booking.update({ where: { id: B_NUEVA }, data: { patientId: otro.id } });
        await syncVisitaForBooking(tx, B_NUEVA, { quien });
        const s1b = await tx.tratamientoSesion.findUnique({ where: { id: s1.id }, select: { bookingId: true } });
        ok('G1b: la sesión suelta la cita re-ligada', s1b?.bookingId === null);
        const audit = await tx.patientAuditLog.findFirst({
          where: { patientId, resourceId: s1.id, userId: 'probe-t4', action: 'link_sesion_cita' },
          orderBy: { timestamp: 'desc' }, select: { changes: true },
        });
        ok('G1b: auditada en el expediente del paciente anterior', JSON.stringify(audit?.changes ?? '').includes('otro expediente'), JSON.stringify(audit?.changes ?? null));
      } else ok('G1b: (sin otro paciente para probar)', false);

      // 5. La forma NUEVA del GET de la agenda (apps/api bookings/route.ts): la sesión de cada cita.
      const agenda = await tx.booking.findMany({
        where: { doctorId, id: { in: [B_VIEJA, B_NUEVA] } },
        include: {
          location: { select: { id: true, name: true } },
          tratamientoSesion: {
            select: {
              numero: true, cancelada: true, patientId: true,
              tratamiento: { select: { id: true, nombre: true, sesionesPlaneadas: true } },
            },
          },
        },
      });
      const conSesion = agenda.find((b) => b.id === B_VIEJA)?.tratamientoSesion;
      ok('GET agenda: incluye la sesión de la cita', conSesion?.numero === 2 && conSesion.tratamiento.nombre === 'PROBE T4', JSON.stringify(conSesion));

      throw ROLLBACK;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.log('ERROR:', (e as Error).message); process.exitCode = 1; }
  } finally {
    await prisma.$disconnect();
  }
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · revertido`);
  if (f) process.exitCode = 1;
})();
