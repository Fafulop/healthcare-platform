// T7 probe — «Es seguimiento de…»: runs the REAL `unirComoSeguimiento` / `sesionesDeVisitas`
// (apps/doctor/src/lib/tratamientos.ts) against prod inside ONE transaction that ALWAYS rolls back.
// dr-prueba / «pepit perez»; creates its own visits and treatments inside the tx — never touches «f».
// Correr (desde packages/database):
//   railway run --service pgvector npx tsx --tsconfig ../../apps/doctor/tsconfig.json ../../scripts/visitas/tratamientos-probe-t7.ts
import { prisma } from '@healthcare/database';
import { unirComoSeguimiento, sesionesDeVisitas } from '@/lib/tratamientos';

const ROLLBACK = new Error('ROLLBACK');
const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);
const doctorId = 'cmni1bov90000mk0lyeztr3ad';
const patientId = 'cmt7tu1as0007ms0ttc4pwijd';
const TRAT_CANCELADO = 'cmuq236pm0001ll0to6s2c6nr'; // «PRUEBA EXTRA» (cancelado en la prueba a mano)
const VISITA_DE_CANCELADO = 'cmuq25ir0000ls80tqqj0k1a5'; // su sesión 1

const espera409 = async (n: string, f: () => Promise<unknown>) => {
  try { await f(); ok(n, false, 'no lanzó'); } catch (e) {
    const err = e as { status?: number; statusCode?: number; message?: string };
    ok(n, (err.status ?? err.statusCode) === 409, err.message ?? String(e));
  }
};

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const nuevaVisita = (dia: string) => tx.visita.create({
        data: { patientId, doctorId, fecha: new Date(dia + 'T00:00:00Z'), origen: 'manual' },
        select: { id: true },
      });

      // 1. Seguimiento de una visita SIN tratamiento → nace «Seguimiento del 12 sep» con 1 = anterior, 2 = nueva.
      const anterior = await nuevaVisita('2026-09-12');
      const v1 = await nuevaVisita('2026-10-01');
      const h1 = await unirComoSeguimiento(tx, doctorId, patientId, { visitaId: anterior.id }, { id: v1.id, bookingId: null });
      const t1 = await tx.tratamiento.findUnique({
        where: { id: h1.tratamientoId },
        select: { nombre: true, estado: true, sesionesPlaneadas: true, sesiones: { orderBy: { numero: 'asc' }, select: { numero: true, visitaId: true } } },
      });
      ok('1. nace el tratamiento «Seguimiento del 12 sep»', t1?.nombre === 'Seguimiento del 12 sep' && t1.estado === 'activo' && t1.sesionesPlaneadas === null, t1?.nombre);
      ok('1. sesión 1 = anterior · sesión 2 = nueva',
        t1?.sesiones.length === 2 && t1.sesiones[0].visitaId === anterior.id && t1.sesiones[1].visitaId === v1.id && h1.numero === 2 && !h1.llenoExistente,
        JSON.stringify(t1?.sesiones));

      // 2. Sesión siguiente de ese tratamiento (sin sesión libre) → se agrega la 3.
      const v2 = await nuevaVisita('2026-10-08');
      const h2 = await unirComoSeguimiento(tx, doctorId, patientId, { tratamientoId: h1.tratamientoId }, { id: v2.id, bookingId: null });
      ok('2. sin sesión libre → se agrega al final (3)', h2.numero === 3 && !h2.llenoExistente && h2.creado === null, JSON.stringify(h2));

      // 3. Seguimiento de una visita que YA es de un tratamiento activo → se une a ése (no crea otro).
      const v3 = await nuevaVisita('2026-10-15');
      const h3 = await unirComoSeguimiento(tx, doctorId, patientId, { visitaId: v1.id }, { id: v3.id, bookingId: null });
      ok('3. visita anterior en tratamiento activo → mismo tratamiento, sesión 4', h3.tratamientoId === h1.tratamientoId && h3.numero === 4 && h3.creado === null);

      // 4. Tratamiento con sesiones planeadas → llena la PRIMERA libre, no agrega.
      const planeado = await tx.tratamiento.create({
        data: { patientId, doctorId, nombre: 'PROBE T7', sesionesPlaneadas: 3, sesiones: { createMany: { data: [1, 2, 3].map((numero) => ({ patientId, doctorId, numero })) } } },
        select: { id: true },
      });
      const v4 = await nuevaVisita('2026-10-02');
      const h4 = await unirComoSeguimiento(tx, doctorId, patientId, { tratamientoId: planeado.id }, { id: v4.id, bookingId: null });
      const cuenta = await tx.tratamientoSesion.count({ where: { tratamientoId: planeado.id } });
      ok('4. llena la sesión 1 (libre) y no agrega', h4.numero === 1 && h4.llenoExistente && cuenta === 3, `${h4.numero}/${cuenta}`);

      // 4b. Una sesión cuya cita se CANCELÓ cuenta como libre («Por agendar» en pantalla): la llena.
      //     (Usa la cita de prueba cancelada «PRUEBA REAGENDAR»; dentro de la tx, se revierte.)
      const CANCELADA = 'cmupu3qfv0001pi0t9o531ogf';
      await tx.booking.update({ where: { id: CANCELADA }, data: { patientId, status: 'CANCELLED' } });
      const s2 = await tx.tratamientoSesion.findFirst({ where: { tratamientoId: planeado.id, numero: 2 }, select: { id: true } });
      await tx.tratamientoSesion.update({ where: { id: s2!.id }, data: { bookingId: CANCELADA } });
      const v4b = await nuevaVisita('2026-10-04');
      const h4b = await unirComoSeguimiento(tx, doctorId, patientId, { tratamientoId: planeado.id }, { id: v4b.id, bookingId: null });
      ok('4b. sesión con cita CANCELADA = libre → la llena (2)', h4b.numero === 2 && h4b.llenoExistente, String(h4b.numero));

      // 5. Tratamiento cancelado → 409 «reactívalo primero».
      const v5 = await nuevaVisita('2026-10-03');
      await espera409('5. tratamiento cancelado → 409', () =>
        unirComoSeguimiento(tx, doctorId, patientId, { tratamientoId: TRAT_CANCELADO }, { id: v5.id, bookingId: null }));

      // 6. Visita anterior de un tratamiento cancelado → 409 (no crea otro).
      await espera409('6. visita anterior en tratamiento cancelado → 409', () =>
        unirComoSeguimiento(tx, doctorId, patientId, { visitaId: VISITA_DE_CANCELADO }, { id: v5.id, bookingId: null }));

      // 7. Tenencia: un tratamiento que no es de este paciente → 404.
      const ajeno = await tx.tratamiento.findFirst({ where: { doctorId, NOT: { patientId } }, select: { id: true } });
      if (ajeno) {
        try {
          await unirComoSeguimiento(tx, doctorId, patientId, { tratamientoId: ajeno.id }, { id: v5.id, bookingId: null });
          ok('7. tratamiento de otro paciente → 404', false, 'no lanzó');
        } catch (e) {
          const err = e as { status?: number; statusCode?: number };
          ok('7. tratamiento de otro paciente → 404', (err.status ?? err.statusCode) === 404);
        }
      }

      throw ROLLBACK;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.log('ERROR:', (e as Error).message); process.exitCode = 1; }
  }

  // 8. Forma de lectura (fuera de la tx, sólo lectura): la etiqueta de la tarjeta de Visitas.
  const visitas = await prisma.visita.findMany({ where: { patientId, doctorId }, select: { id: true, bookingId: true } });
  const m = await sesionesDeVisitas(doctorId, patientId, visitas);
  const de = [...m.values()].map((x) => `${x.nombre} #${x.numero} (${x.estado})`);
  ok('8. sesionesDeVisitas corre y ve las sesiones reales', m.size >= 1, de.join(' · '));

  // 9. La forma nueva del GET de citas del expediente (tratamientoSesion.patientId) corre.
  const b = await prisma.booking.findMany({ where: { patientId, doctorId }, select: { id: true, tratamientoSesion: { select: { patientId: true } } } });
  ok('9. citas del expediente con esSesion', b.length > 0, `${b.filter((x) => x.tratamientoSesion?.patientId === patientId).length} de ${b.length} son sesión`);

  await prisma.$disconnect();
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · revertido`);
  if (f) process.exitCode = 1;
})();
