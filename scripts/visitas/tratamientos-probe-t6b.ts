// T6b probe — money permutations of a treatment package, against prod, inside ONE transaction that
// ALWAYS rolls back. Runs the REAL `paqueteDeCita` (packages/database) and writes ledger entries with
// the SAME fields `createCitaLedgerEntry` / `createTratamientoPagoEntry` write (apps/api).
// Uses dr-prueba / «pepit perez» and the cancelled «PRUEBA REAGENDAR» test booking — never a real one.
// Correr: cd packages/database && railway run --service pgvector npx tsx ../../scripts/visitas/tratamientos-probe-t6b.ts
import { PrismaClient } from '../../packages/database/node_modules/@prisma/client';
import { paqueteDeCita } from '../../packages/database/src/tratamientos';

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL } } });
const ROLLBACK = new Error('ROLLBACK');
const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);

const doctorId = 'cmni1bov90000mk0lyeztr3ad';
const patientId = 'cmt7tu1as0007ms0ttc4pwijd'; // pepit perez
const B = 'cmupu3qfv0001pi0t9o531ogf'; // «PRUEBA REAGENDAR» 11:00 (CANCELLED) — se usa como cita de sesión
const cola = Date.now().toString(36);

/** Los MISMOS campos que escribe createCitaLedgerEntry (apps/api/src/lib/practice-utils.ts). */
const entradaDeCita = (amount: number, tratamientoId: string, i: number) => ({
  doctorId, amount, concept: `PROBE - pepit (cubierta por el paquete «PROBE T6»)`, entryType: 'ingreso',
  transactionDate: new Date('2026-10-02T12:00:00'), internalId: `PROBE-T6-${cola}-${i}`, formaDePago: 'efectivo',
  area: 'Ingresos Consulta', subarea: '', origin: 'cita', transactionType: 'N/A', amountPaid: amount,
  paymentStatus: 'PAID', bookingId: B, patientId, tratamientoId,
});

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const t = await tx.tratamiento.create({
        data: {
          patientId, doctorId, nombre: 'PROBE T6', sesionesPlaneadas: 1, precioPaquete: 1000,
          sesiones: { createMany: { data: [{ patientId, doctorId, numero: 1 }] } },
        },
        select: { id: true, sesiones: { select: { id: true } } },
      });
      const s1 = t.sesiones[0].id;
      await tx.tratamientoSesion.update({ where: { id: s1 }, data: { bookingId: B } });
      await tx.booking.update({ where: { id: B }, data: { status: 'COMPLETED', patientId } });

      // 1. La regla: sesión de un tratamiento CON precio → cubierta.
      const p1 = await paqueteDeCita(tx, B);
      ok('paqueteDeCita: sesión con paquete → cubierta', p1?.tratamientoId === t.id && p1.nombre === 'PROBE T6', JSON.stringify(p1));

      // 2. Al completarla: UN movimiento de $0 «cubierta por el paquete», ligado a cita Y tratamiento.
      const cero = await tx.ledgerEntry.create({ data: entradaDeCita(0, t.id, 1), select: { id: true } });
      ok('movimiento $0 de la sesión se crea (amount 0, tratamientoId)', !!cero.id);

      // 3. Un pago del paquete: ingreso SIN cita, ligado al tratamiento (campos de createTratamientoPagoEntry).
      await tx.ledgerEntry.create({
        data: {
          doctorId, amount: 600, concept: 'Pago del paquete «PROBE T6» - pepit perez', entryType: 'ingreso',
          transactionDate: new Date('2026-10-01T12:00:00'), internalId: `PROBE-T6-${cola}-2`, formaDePago: 'transferencia',
          area: 'Ingresos Consulta', subarea: 'PROBE T6', origin: 'manual', transactionType: 'N/A', amountPaid: 600,
          paymentStatus: 'PAID', patientId, tratamientoId: t.id,
        },
      });

      // 4. El dinero CALCULADO (forma de dineroDelTratamiento): pagado 600 · extras 0 · saldo 400.
      const mov = await tx.ledgerEntry.findMany({
        where: { doctorId, tratamientoId: t.id, entryType: 'ingreso' },
        orderBy: { transactionDate: 'asc' },
        select: { id: true, amount: true, transactionDate: true, formaDePago: true, origin: true },
      });
      const pagado = mov.filter((m) => m.origin === 'manual').reduce((a, m) => a + Number(m.amount), 0);
      const extras = mov.filter((m) => m.origin === 'cita').reduce((a, m) => a + Number(m.amount), 0);
      ok('dinero: pagado 600 · extras 0 · saldo 400', pagado === 600 && extras === 0 && 1000 - pagado === 400, `${pagado}/${extras}`);

      // 5. El asistente (INGRESO_FACTURABLE de facturas.ts): el $0 NO cuenta; el pago del paquete
      //    (origin 'manual' + tratamientoId) SÍ. Misma forma de la cláusula, sólo acotada a este tratamiento.
      const INGRESO_FACTURABLE = {
        OR: [{ origin: { in: ['cita', 'webhook_pago'] } }, { tratamientoId: { not: null } }],
        amount: { gt: 0 },
      };
      const facturables = await tx.ledgerEntry.findMany({
        where: { doctorId, patientId, hasFactura: false, tratamientoId: t.id, ...INGRESO_FACTURABLE },
        select: { amount: true, origin: true },
      });
      ok('asistente: cuenta el pago del paquete y NO el $0',
        facturables.length === 1 && Number(facturables[0].amount) === 600 && facturables[0].origin === 'manual',
        JSON.stringify(facturables));
      // ...y la cláusula ampliada corre contra TODO el historial del doctor (forma real del barrido).
      const g = await tx.ledgerEntry.groupBy({
        by: ['patientId'], where: { doctorId, hasFactura: false, ...INGRESO_FACTURABLE, patientId: { not: null } },
        _count: { _all: true }, _sum: { amount: true },
      });
      ok('barrido: groupBy con la cláusula ampliada corre', g.length > 0, `${g.length} pacientes`);

      // 5b. Borrar el tratamiento: el DELETE cuenta sus movimientos → 409 (no se borra).
      const conDinero = await tx.ledgerEntry.count({ where: { doctorId, tratamientoId: t.id } });
      ok('borrar: tiene movimientos → bloqueado', conDinero === 2, String(conDinero));

      // 6. Facturar el $0: la ruta lo lee así y lo rechaza (amount <= 0).
      const e = await tx.ledgerEntry.findFirst({ where: { id: cero.id, doctorId }, select: { hasFactura: true, amount: true, tratamientoId: true } });
      ok('facturar: la entrada $0 se reconoce (amount 0 + tratamientoId)', Number(e?.amount) === 0 && e?.tratamientoId === t.id);

      // 7. GET de la agenda: la forma con precioPaquete (para cubiertaPorPaquete).
      const ag = await tx.booking.findMany({
        where: { id: B },
        select: { patientId: true, tratamientoSesion: { select: { numero: true, cancelada: true, patientId: true, tratamiento: { select: { id: true, nombre: true, sesionesPlaneadas: true, precioPaquete: true } } } } },
      });
      const ts = ag[0]?.tratamientoSesion;
      ok('agenda: cubiertaPorPaquete = true', !!ts && !ts.cancelada && ts.patientId === ag[0].patientId && ts.tratamiento.precioPaquete !== null);

      // 8. Sin precio de paquete → NO cubierta (se cobra por sesión como siempre).
      await tx.tratamiento.update({ where: { id: t.id }, data: { precioPaquete: null } });
      ok('sin precio → no cubierta', (await paqueteDeCita(tx, B)) === null);

      // 9. Con precio pero sesión CANCELADA → no cubierta.
      await tx.tratamiento.update({ where: { id: t.id }, data: { precioPaquete: 1000 } });
      await tx.tratamientoSesion.update({ where: { id: s1 }, data: { cancelada: true } });
      ok('sesión cancelada → no cubierta', (await paqueteDeCita(tx, B)) === null);

      // 10. Cita re-ligada a OTRO paciente → no cubierta.
      await tx.tratamientoSesion.update({ where: { id: s1 }, data: { cancelada: false } });
      const otro = await tx.patient.findFirst({ where: { doctorId, NOT: { id: patientId } }, select: { id: true } });
      if (otro) {
        await tx.booking.update({ where: { id: B }, data: { patientId: otro.id } });
        ok('cita de otro paciente → no cubierta', (await paqueteDeCita(tx, B)) === null);
      }

      // 10b. Con un link de pago VIVO en la cita → no cubierta (el pago del link es su cobro).
      await tx.booking.update({ where: { id: B }, data: { patientId } });
      ok('de vuelta: cubierta', (await paqueteDeCita(tx, B)) !== null);
      const yaLink = await tx.paymentLink.findUnique({ where: { bookingId: B }, select: { id: true } });
      if (!yaLink) {
        await tx.paymentLink.create({
          data: { doctorId, stripePaymentLinkId: `PROBE-T6-${cola}`, stripePaymentLinkUrl: 'https://example.invalid', amount: 500, bookingId: B },
        });
        ok('link de pago vivo → no cubierta', (await paqueteDeCita(tx, B)) === null);
      }

      // 11. Una cita normal (sin sesión) → no cubierta.
      const normal = await tx.booking.findFirst({ where: { doctorId, tratamientoSesion: null }, select: { id: true } });
      ok('cita sin sesión → no cubierta', normal ? (await paqueteDeCita(tx, normal.id)) === null : false);

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
