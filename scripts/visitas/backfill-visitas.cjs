/**
 * VISITAS — Paso C: envuelve cada consulta existente en su propia visita.
 * Plan: docs/DESDE JUNIO/VISITAS/02-PLAN-fase-1.md §4.
 *
 * Qué hace (sólo INSERTA en `visitas` y LLENA `visita_id`, que estaba vacío; no cambia
 * ningún otro valor):
 *   1. por cada consulta SIN visita → una visita `vbf_<id de la consulta>` (determinista:
 *      re-correrlo no duplica), mismo paciente/doctor, fecha = día de la consulta,
 *      origen 'backfill', SIN cita (no hay liga consulta↔cita confiable que heredar);
 *   2. la consulta queda dentro de su visita;
 *   3. fotos/documentos, recetas e informes que cuelgan de esa consulta heredan su visita.
 *   Las notas y lo que no tiene consulta quedan «Sin visita».
 *
 * Se re-corre justo antes del lanzamiento de la UI: sólo toma lo que siga sin visita.
 *
 * 🔴 UNA SOLA VEZ, ANTES de la UI (D4/D5) — NUNCA después. Desde D3 (2026-09-25) «Sin visita» en
 *    una consulta puede ser una DECISIÓN del doctor (PUT con visitaId: null), no "falta
 *    backfill". Este script no distingue: re-corrido después del lanzamiento, envolvería esa
 *    consulta en una visita nueva y arrastraría a sus hijos, deshaciendo en silencio lo que el
 *    doctor decidió, sin auditoría. La regla que aplica (la visita del hijo = la de su consulta)
 *    es la misma que `resolverVisitaDeHijo` en apps/doctor/src/lib/visitas.ts.
 *
 * Uso (desde la raíz del repo):
 *   railway run --service pgvector node scripts/visitas/backfill-visitas.cjs --dry-run   ← sólo lee
 *   railway run --service pgvector node scripts/visitas/backfill-visitas.cjs             ← escribe
 *   railway run --service pgvector node scripts/visitas/backfill-visitas.cjs --undo      ← deshace
 *
 * ⚠️ --undo desliga TODO lo que apunte a una visita 'vbf_…', incluido lo que un doctor haya
 * agregado a mano a esas visitas después del lanzamiento. Sólo es limpio ANTES de lanzar.
 */
const path = require('path');
const { PrismaClient } = require(path.join(__dirname, '../../packages/database/node_modules/@prisma/client'));

const url = process.env.DATABASE_PUBLIC_URL;
if (!url) { console.log('Falta DATABASE_PUBLIC_URL — correr con: railway run --service pgvector …'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
const mode = process.argv.includes('--undo') ? 'undo' : process.argv.includes('--dry-run') ? 'dry' : 'real';
const HIJOS = ['patient_media', 'prescriptions', 'medical_reports'];

/** Lo que el backfill HARÍA ahora mismo (read-only). */
async function pendiente() {
  const [e] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int n FROM medical_records.clinical_encounters WHERE visita_id IS NULL`);
  const hijos = {};
  for (const t of HIJOS) {
    const [r] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int n FROM medical_records.${t} h
         JOIN medical_records.clinical_encounters e ON e.id = h.encounter_id
        WHERE h.visita_id IS NULL`);
    hijos[t] = r.n;
  }
  // Si esto no es 0, la FK "mismo paciente" rebotaría el paso 3 y TODO se revierte.
  const [mal] = await prisma.$queryRawUnsafe(`SELECT (
      (SELECT count(*) FROM medical_records.patient_media h JOIN medical_records.clinical_encounters e ON e.id=h.encounter_id WHERE e.patient_id<>h.patient_id)
    + (SELECT count(*) FROM medical_records.prescriptions h JOIN medical_records.clinical_encounters e ON e.id=h.encounter_id WHERE e.patient_id<>h.patient_id)
    + (SELECT count(*) FROM medical_records.medical_reports h JOIN medical_records.clinical_encounters e ON e.id=h.encounter_id WHERE e.patient_id<>h.patient_id)
    )::int n`);
  return { consultas: e.n, ...hijos, hijos_de_otro_paciente: mal.n };
}

/** Lo que HAY en la base (se lee después de escribir; no se confía en contadores). */
async function estado() {
  const [r] = await prisma.$queryRawUnsafe(`SELECT
    (SELECT count(*) FROM medical_records.visitas WHERE origen = 'backfill')::int visitas_backfill,
    (SELECT count(*) FROM medical_records.clinical_encounters)::int consultas_total,
    (SELECT count(*) FROM medical_records.clinical_encounters WHERE visita_id IS NULL)::int consultas_sin_visita,
    (SELECT count(*) FROM medical_records.clinical_encounters e JOIN medical_records.visitas v ON v.id = e.visita_id
      WHERE v.fecha <> e.encounter_date::date OR v.patient_id <> e.patient_id OR v.doctor_id <> e.doctor_id)::int consultas_con_visita_que_no_cuadra,
    (SELECT count(*) FROM medical_records.patient_media   WHERE visita_id LIKE 'vbf\\_%')::int patient_media,
    (SELECT count(*) FROM medical_records.prescriptions   WHERE visita_id LIKE 'vbf\\_%')::int prescriptions,
    (SELECT count(*) FROM medical_records.medical_reports WHERE visita_id LIKE 'vbf\\_%')::int medical_reports,
    (SELECT count(*) FROM medical_records.patient_media h JOIN medical_records.clinical_encounters e ON e.id=h.encounter_id
      WHERE h.visita_id IS DISTINCT FROM e.visita_id)::int media_con_visita_distinta_a_su_consulta`);
  return r;
}

(async () => {
  try {
    console.log(`MODO: ${mode}\n`);
    console.log('Estado antes:', await estado());

    if (mode === 'dry') {
      console.log('\nLo que haría (read-only):', await pendiente());
      return;
    }

    if (mode === 'undo') {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`),
        ...['clinical_encounters', ...HIJOS].map(t =>
          prisma.$executeRawUnsafe(`UPDATE medical_records.${t} SET visita_id = NULL WHERE visita_id LIKE 'vbf\\_%'`)),
        prisma.$executeRawUnsafe(`DELETE FROM medical_records.visitas WHERE origen = 'backfill'`),
      ]);
      console.log('\nEstado después del UNDO:', await estado());
      return;
    }

    const antes = await pendiente();
    console.log('\nPendiente:', antes);
    if (antes.hijos_de_otro_paciente !== 0) { console.log('❌ Hay hijos ligados a la consulta de OTRO paciente. No se corre.'); return; }

    // Una sola transacción: o queda todo, o nada.
    const r = await prisma.$transaction([
      prisma.$executeRawUnsafe(`SET LOCAL lock_timeout = '5s'`),
      prisma.$executeRawUnsafe(`
        INSERT INTO medical_records.visitas (id, patient_id, doctor_id, fecha, origen, created_at, updated_at)
        SELECT 'vbf_' || e.id, e.patient_id, e.doctor_id, e.encounter_date::date, 'backfill', now(), now()
          FROM medical_records.clinical_encounters e
         WHERE e.visita_id IS NULL
        ON CONFLICT (id) DO NOTHING`),
      prisma.$executeRawUnsafe(`
        UPDATE medical_records.clinical_encounters e
           SET visita_id = 'vbf_' || e.id
         WHERE e.visita_id IS NULL
           AND EXISTS (SELECT 1 FROM medical_records.visitas v WHERE v.id = 'vbf_' || e.id)`),
      // Regla del hueco #4: la visita de un hijo es la de SU consulta.
      ...HIJOS.map(t => prisma.$executeRawUnsafe(`
        UPDATE medical_records.${t} h
           SET visita_id = e.visita_id
          FROM medical_records.clinical_encounters e
         WHERE h.encounter_id = e.id
           AND h.visita_id IS NULL
           AND e.visita_id IS NOT NULL`)),
    ]);
    const [, visitas, consultas, ...hijos] = r;
    console.log('\nFilas escritas (lo INTENTADO):', { visitas, consultas, ...Object.fromEntries(HIJOS.map((t, i) => [t, hijos[i]])) });
    console.log('\nEstado después (lo que HAY):', await estado());
  } catch (e) {
    console.log('ERROR (la transacción se revirtió completa):', e.meta?.message || e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
