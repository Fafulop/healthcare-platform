// T2 probe — runs every NEW Prisma query shape of the tratamientos API (apps/doctor/src/lib/
// tratamientos.ts + its 4 routes + the G3 hook in the visitas routes) against prod, inside ONE
// transaction that ALWAYS rolls back. Nothing is left in prod.
//   railway run --service pgvector node scripts/visitas/tratamientos-probe-t2.cjs
// Uses dr-prueba and one of its patients that has an active appointment with no visit.
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient, Prisma } = require(require('path').join(__dirname, '../../packages/database/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasources: { db: { url } } });

const ROLLBACK = new Error('ROLLBACK (intencional)');
const results = [];
const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra });

// Same selects as the code (keep in sync with lib/tratamientos.ts).
const TRATAMIENTO_SELECT = {
  id: true, nombre: true, estado: true, sesionesPlaneadas: true, intervaloDias: true,
  plantillaSugeridaId: true, notas: true, createdAt: true, updatedAt: true,
};
const SESION_SELECT = {
  id: true, tratamientoId: true, patientId: true, numero: true, cancelada: true,
  bookingId: true, visitaId: true, notas: true, createdAt: true, updatedAt: true,
  booking: { select: { patientId: true, status: true, visita: { select: { id: true } } } },
};

(async () => {
  const t0 = Date.now();
  try {
    await prisma.$transaction(async (tx) => {
      let sp = 0;
      const rechaza = async (name, fn, code) => {
        const s = `sp${++sp}`; await tx.$executeRawUnsafe(`SAVEPOINT ${s}`);
        try { await fn(); await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${s}`); ok(name, false, 'NO rebotó'); }
        catch (e) {
          await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${s}`);
          ok(name, e.code === code, `${e.code} ${JSON.stringify(e.meta?.target ?? '')}`);
        }
      };

      const doctor = await tx.doctor.findUnique({ where: { slug: 'dr-prueba' }, select: { id: true } });
      if (!doctor) throw new Error('dr-prueba no existe');
      const doctorId = doctor.id;
      // Paciente con una cita activa SIN visita y SIN sesión.
      const b1 = await tx.booking.findFirst({
        where: { doctorId, patientId: { not: null }, status: { in: ['PENDING', 'CONFIRMED'] }, visita: null, tratamientoSesion: null },
        select: { id: true, patientId: true },
      });
      if (!b1) throw new Error('dr-prueba no tiene una cita activa sin visita');
      const patientId = b1.patientId;

      // POST tratamientos — escritura anidada con createMany.
      const t = await tx.tratamiento.create({
        data: {
          patientId, doctorId, nombre: 'PROBE T2', sesionesPlaneadas: 3, intervaloDias: 7, notas: null,
          plantillaSugeridaId: null,
          sesiones: { createMany: { data: [1, 2, 3].map((numero) => ({ patientId, doctorId, numero })) } },
        },
        select: TRATAMIENTO_SELECT,
      });
      ok('POST tratamiento + 3 sesiones anidadas', t.id && t.estado === 'activo');

      // GET lista + conteos (findMany ordenado; sesiones del paciente con su cita).
      const lista = await tx.tratamiento.findMany({ where: { patientId, doctorId }, orderBy: { createdAt: 'desc' }, select: TRATAMIENTO_SELECT });
      ok('GET tratamientos', lista.some((x) => x.id === t.id));
      const ses = await tx.tratamientoSesion.findMany({
        where: { patientId, doctorId, tratamientoId: { in: [t.id] } }, orderBy: { numero: 'asc' }, select: SESION_SELECT,
      });
      ok('sesiones con SESION_SELECT', ses.length === 3 && ses[0].booking === null, `n=${ses.length}`);
      const [s1, s2, s3] = ses;

      // POST sesion — aggregate + create; G9 choque de número.
      const max = await tx.tratamientoSesion.aggregate({ where: { tratamientoId: t.id }, _max: { numero: true } });
      ok('aggregate _max numero', max._max.numero === 3);
      const s4 = await tx.tratamientoSesion.create({
        data: { tratamientoId: t.id, patientId, doctorId, numero: 4, notas: null }, select: { id: true, numero: true },
      });
      ok('POST sesión 4', s4.numero === 4);
      await rechaza('G9 número repetido → P2002', () =>
        tx.tratamientoSesion.create({ data: { tratamientoId: t.id, patientId, doctorId, numero: 4 } }), 'P2002');

      // planLigarCitaASesion — la forma del booking con tratamientoSesion.
      const bShape = await tx.booking.findFirst({
        where: { id: b1.id, doctorId },
        select: {
          patientId: true, status: true, date: true, slot: { select: { date: true } },
          visita: { select: { id: true } }, tratamientoSesion: { select: { id: true, patientId: true } },
        },
      });
      ok('booking + tratamientoSesion (antes)', bShape && bShape.tratamientoSesion === null && bShape.visita === null);

      // Ligar cita a s1.
      await tx.tratamientoSesion.update({ where: { id: s1.id }, data: { bookingId: b1.id } });
      const bDesp = await tx.booking.findFirst({ where: { id: b1.id }, select: { tratamientoSesion: { select: { id: true, patientId: true } } } });
      ok('booking.tratamientoSesion (después)', bDesp.tratamientoSesion?.id === s1.id);
      await rechaza('misma cita en 2 sesiones → P2002', () =>
        tx.tratamientoSesion.update({ where: { id: s2.id }, data: { bookingId: b1.id } }), 'P2002');

      // Visita manual ligada a s2; validarVisitaParaSesion.
      const v = await tx.visita.create({
        data: { patientId, doctorId, fecha: new Date('2026-10-01T12:00:00Z'), origen: 'manual' }, select: { id: true },
      });
      await tx.tratamientoSesion.update({ where: { id: s2.id }, data: { visitaId: v.id } });
      const vShape = await tx.visita.findFirst({
        where: { id: v.id, patientId, doctorId }, select: { id: true, bookingId: true, tratamientoSesion: { select: { id: true } } },
      });
      ok('visita + tratamientoSesion', vShape.tratamientoSesion?.id === s2.id);
      const otra = await tx.tratamientoSesion.findFirst({ where: { visitaId: v.id, NOT: { id: s1.id } }, select: { id: true } });
      ok('findFirst sesión por visita NOT id', otra?.id === s2.id);

      // G3: sesionAlLigarCitaAVisita — las dos lecturas.
      const [sesC, sesV] = await Promise.all([
        tx.tratamientoSesion.findFirst({ where: { bookingId: b1.id, doctorId }, select: { id: true, patientId: true, visitaId: true } }),
        tx.tratamientoSesion.findFirst({ where: { visitaId: v.id, doctorId }, select: { id: true, bookingId: true } }),
      ]);
      ok('G3 lecturas (sesC, sesV)', sesC?.id === s1.id && sesV?.id === s2.id);

      // G2: mover la visita manual a la cita (visita.update bookingId + fecha), s1 la guarda.
      await tx.tratamientoSesion.update({ where: { id: s2.id }, data: { visitaId: null } });
      await tx.visita.update({ where: { id: v.id }, data: { bookingId: b1.id, fecha: new Date('2026-10-02T12:00:00Z') } });
      await tx.tratamientoSesion.update({ where: { id: s1.id }, data: { visitaId: v.id } });
      const s1b = await tx.tratamientoSesion.findFirst({ where: { id: s1.id }, select: SESION_SELECT });
      ok('G2 visita movida a la cita', s1b.booking?.visita?.id === v.id && s1b.visitaId === v.id);

      // Fixes del review: lecturas nuevas.
      const vFecha = await tx.visita.findMany({
        where: { id: { in: [v.id] }, patientId, doctorId },
        select: { id: true, fecha: true, booking: { select: { date: true, slot: { select: { date: true } } } } },
      });
      ok('visita + booking.date/slot.date (fecha de la sesión)', vFecha.length === 1 && 'booking' in vFecha[0]);
      const nCons = await tx.clinicalEncounter.count({ where: { visitaId: v.id, patientId, doctorId } });
      ok('mismo día: count de consultas de la visita', nCons === 0);
      const ambos = await tx.tratamientoSesion.findFirst({ where: { doctorId, bookingId: b1.id, visitaId: v.id }, select: { id: true } });
      ok('desligar: sesión con cita Y visita', ambos?.id === s1.id);
      const agg = await tx.tratamientoSesion.aggregate({ where: { tratamientoId: t.id }, _max: { numero: true }, _count: { _all: true } });
      ok('aggregate _max + _count', agg._count._all === 4 && agg._max.numero === 4);
      const lock = await tx.$queryRaw`
        SELECT id FROM medical_records.tratamiento_sesiones WHERE tratamiento_id = ${t.id} FOR UPDATE`;
      ok('$queryRaw FOR UPDATE devuelve filas', Array.isArray(lock) && lock.length === 4, `n=${lock.length}`);
      const lockT = await tx.$queryRaw`SELECT id FROM medical_records.tratamientos WHERE id = ${t.id} FOR UPDATE`;
      ok('$queryRaw FOR UPDATE del tratamiento', Array.isArray(lockT) && lockT.length === 1);
      const sinBorrar = await tx.tratamientoSesion.deleteMany({ where: { id: s1.id, bookingId: 'otra-cita', visitaId: null } });
      ok('DELETE sesión condicionado a SU bookingId leído', sinBorrar.count === 0);
      const sesConCita = await tx.tratamientoSesion.findFirst({
        where: { visitaId: v.id, doctorId },
        select: { id: true, patientId: true, bookingId: true, booking: { select: { patientId: true } } },
      });
      ok('G3 sesV con booking.patientId (citaEfectiva)', sesConCita?.booking?.patientId === patientId);

      // DELETE tratamiento — conteos + deleteMany condicionado (tiene ligadas → 0).
      const where = { tratamientoId: t.id, patientId, doctorId };
      const [conCita, conVisita] = await Promise.all([
        tx.tratamientoSesion.count({ where: { ...where, booking: { is: { patientId } } } }),
        tx.tratamientoSesion.count({ where: { ...where, visitaId: { not: null } } }),
      ]);
      ok('conteos conCita/conVisita', conCita === 1 && conVisita === 1, `${conCita}/${conVisita}`);
      const delT = await tx.tratamiento.deleteMany({
        where: { id: t.id, sesiones: { none: { OR: [{ bookingId: { not: null } }, { visitaId: { not: null } }] } } },
      });
      ok('DELETE tratamiento con ligadas → count 0', delT.count === 0);

      // DELETE sesión — condicionado.
      const delS1 = await tx.tratamientoSesion.deleteMany({ where: { id: s1.id, bookingId: null, visitaId: null } });
      const delS3 = await tx.tratamientoSesion.deleteMany({ where: { id: s3.id, bookingId: null, visitaId: null } });
      ok('DELETE sesión ligada → 0 · libre → 1', delS1.count === 0 && delS3.count === 1);

      // PATCH tratamiento + plantilla.
      const tpl = await tx.encounterTemplate.findFirst({ where: { doctorId, isActive: true }, select: { id: true } });
      const up = await tx.tratamiento.update({
        where: { id: t.id }, data: { estado: 'terminado', plantillaSugeridaId: tpl?.id ?? null, sesionesPlaneadas: 6 },
        select: TRATAMIENTO_SELECT,
      });
      ok('PATCH tratamiento (+ plantilla)', up.estado === 'terminado', tpl ? 'con plantilla' : 'sin plantillas activas');

      // Desligar todo y borrar: el tratamiento libre sí se borra, la cita y la visita quedan.
      await tx.tratamientoSesion.updateMany({ where: { tratamientoId: t.id }, data: { bookingId: null, visitaId: null } });
      await tx.tratamiento.delete({ where: { id: t.id } });
      const [sigue, sesQuedan] = await Promise.all([
        tx.booking.count({ where: { id: b1.id } }),
        tx.tratamientoSesion.count({ where: { tratamientoId: t.id } }),
      ]);
      ok('DELETE tratamiento libre: sesiones en cascada, cita intacta', sigue === 1 && sesQuedan === 0);

      throw ROLLBACK;
    }, { timeout: 30000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.log('ERROR:', e.message); process.exitCode = 1; }
  } finally {
    await prisma.$disconnect();
  }
  for (const r of results) console.log(`${r.pass ? 'OK  ' : 'FAIL'} ${r.name}${r.extra ? `  (${r.extra})` : ''}`);
  const fails = results.filter((r) => !r.pass).length;
  console.log(`\n${results.length - fails}/${results.length} · ${Date.now() - t0} ms · revertido`);
  if (fails) process.exitCode = 1;
})();
