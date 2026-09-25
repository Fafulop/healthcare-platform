/**
 * SEGURIDAD 2026-09-25 — regenera el `confirmation_code` de las citas ACTIVAS FUTURAS.
 *
 * Por qué: hasta hoy `GET /api/appointments/slots` (y `GET /bookings/[id]`) eran PÚBLICOS y
 * devolvían el código de cada cita activa; con ese código cualquiera puede CANCELAR la cita sin
 * sesión (PATCH /bookings/[id]). Cerrar los endpoints no invalida los códigos ya leídos: éste sí.
 * Decidido por el usuario (opción 1): el código viejo deja de servir; si un paciente quiere
 * cancelar con el de su correo, tendrá que llamar (o se le reenvía la confirmación).
 *
 * ⚠️ Correrlo DESPUÉS de desplegar el cierre de apps/api — antes, los códigos nuevos también
 *    quedarían expuestos.
 *
 * Uso (desde la raíz del repo):
 *   railway run --service pgvector node scripts/security/rotate-confirmation-codes.cjs --dry-run
 *   railway run --service pgvector node scripts/security/rotate-confirmation-codes.cjs
 *
 * Toca SÓLO `confirmation_code` de citas PENDING/CONFIRMED con fecha >= AYER en UTC (slot o freeform).
 * No manda correos. Idempotente en el sentido de que re-correrlo sólo vuelve a rotar.
 * No hay "deshacer" (los códigos viejos se descartan a propósito); por eso el dry-run primero.
 */
const crypto = require('crypto');
const { PrismaClient } = require('../../packages/database/node_modules/@prisma/client');

const DRY = process.argv.includes('--dry-run');
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // mismo formato que generateConfirmationCode
const nuevoCodigo = () => Array.from({ length: 8 }, () => ALFABETO[crypto.randomInt(ALFABETO.length)]).join('');

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_PUBLIC_URL } } });

(async () => {
  const citas = await prisma.$queryRawUnsafe(`
    SELECT b.id, b.doctor_id, b.status::text AS status, b.confirmation_code AS viejo,
           COALESCE(s.date, b.date)::date AS dia
    FROM public.bookings b
    LEFT JOIN public.appointment_slots s ON s.id = b.slot_id
    WHERE b.status IN ('PENDING','CONFIRMED') AND b.confirmation_code IS NOT NULL
      -- "- 1": CURRENT_DATE is UTC in prod; after 18:00 Mexico time it is already tomorrow and
      -- today's remaining appointments would keep their (possibly leaked) code.
      AND COALESCE(s.date, b.date) >= CURRENT_DATE - 1
    ORDER BY dia`);
  const porDoctor = {};
  for (const c of citas) porDoctor[c.doctor_id] = (porDoctor[c.doctor_id] ?? 0) + 1;
  console.log(`Citas activas futuras con código: ${citas.length} · doctores: ${Object.keys(porDoctor).length}`);
  console.log(`Rango: ${citas[0]?.dia?.toISOString?.().slice(0, 10) ?? '-'} → ${citas.at(-1)?.dia?.toISOString?.().slice(0, 10) ?? '-'}`);

  if (DRY) {
    console.log('\n--dry-run: no se escribió nada.');
    await prisma.$disconnect();
    return;
  }

  let rotadas = 0;
  for (const c of citas) {
    // Choque con un código existente (36^8): se reintenta; el índice único lo haría fallar si no.
    for (let intento = 0; intento < 5; intento++) {
      try {
        await prisma.booking.update({ where: { id: c.id }, data: { confirmationCode: nuevoCodigo() } });
        rotadas++;
        break;
      } catch (e) {
        if (e.code !== 'P2002' || intento === 4) throw e;
      }
    }
  }

  // Leer de vuelta: lo que cuenta es lo que quedó en la base, no lo que se intentó.
  const ahora = await prisma.booking.findMany({
    where: { id: { in: citas.map((c) => c.id) } },
    select: { id: true, confirmationCode: true },
  });
  const viejoPor = new Map(citas.map((c) => [c.id, c.viejo]));
  const iguales = ahora.filter((a) => a.confirmationCode === viejoPor.get(a.id)).length;
  const sinCodigo = ahora.filter((a) => !a.confirmationCode).length;
  console.log(`\nRotadas: ${rotadas}/${citas.length} · con el código VIEJO todavía: ${iguales} · sin código: ${sinCodigo}`);
  console.log(iguales === 0 && sinCodigo === 0 && ahora.length === citas.length ? 'OK' : '❌ REVISAR');
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('FALLÓ:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
