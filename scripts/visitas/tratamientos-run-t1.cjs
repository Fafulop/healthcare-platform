// T1 REAL RUN: applies create-tratamientos.sql in ONE transaction and verifies every FK, CHECK and
// index against the exact expected definitions BEFORE committing. Any mismatch -> throw -> rollback.
const fs = require('fs');
const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
const { PrismaClient } = require(require('path').join(__dirname, '../../packages/database/node_modules/@prisma/client'));
const prisma = new PrismaClient({ datasources: { db: { url } } });
const SQL = fs.readFileSync(require('path').join(__dirname, '../../packages/database/prisma/migrations/create-tratamientos.sql'), 'utf8');
function statements(sql) {
  const out = []; let cur = ''; let inDollar = false;
  const lines = sql.split(/\r?\n/);
  for (const raw of lines) {
    const line = inDollar ? raw : raw.replace(/--.*$/, '');
    cur += line + '\n';
    const n = (line.match(/\$\$/g) || []).length;
    if (n % 2 === 1) inDollar = !inDollar;
    if (!inDollar && /;\s*$/.test(line)) { if (cur.trim().replace(/;$/, '').trim()) out.push(cur.trim()); cur = ''; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const q = (s) => tx.$queryRawUnsafe(s);
      const stmts = statements(SQL);
      for (const s of stmts) await tx.$executeRawUnsafe(s);
      console.log('aplicadas', stmts.length, 'sentencias');
      const esperado = {
        tratamientos_patient_id_doctor_id_fkey: 'FOREIGN KEY (patient_id, doctor_id) REFERENCES medical_records.patients(id, doctor_id) ON DELETE CASCADE',
        tratamientos_plantilla_sugerida_id_fkey: 'FOREIGN KEY (plantilla_sugerida_id) REFERENCES medical_records.encounter_templates(id) ON DELETE SET NULL',
        tratamientos_doctor_id_fkey: 'FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE',
        tratamiento_sesiones_patient_id_doctor_id_fkey: 'FOREIGN KEY (patient_id, doctor_id) REFERENCES medical_records.patients(id, doctor_id) ON DELETE CASCADE',
        tratamiento_sesiones_tratamiento_id_patient_id_fkey: 'FOREIGN KEY (tratamiento_id, patient_id) REFERENCES medical_records.tratamientos(id, patient_id) ON DELETE CASCADE',
        tratamiento_sesiones_booking_id_doctor_id_fkey: 'FOREIGN KEY (booking_id, doctor_id) REFERENCES bookings(id, doctor_id) ON DELETE SET NULL (booking_id)',
        tratamiento_sesiones_visita_id_patient_id_fkey: 'FOREIGN KEY (visita_id, patient_id) REFERENCES medical_records.visitas(id, patient_id) ON DELETE SET NULL (visita_id)',
      };
      const chkEsperado = {
        tratamientos_estado_check: "CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'terminado'::character varying, 'cancelado'::character varying])::text[])))",
        tratamientos_sesiones_planeadas_check: 'CHECK (((sesiones_planeadas IS NULL) OR (sesiones_planeadas > 0)))',
        tratamientos_intervalo_dias_check: 'CHECK (((intervalo_dias IS NULL) OR (intervalo_dias > 0)))',
        tratamientos_precio_paquete_check: 'CHECK (((precio_paquete IS NULL) OR (precio_paquete >= (0)::numeric)))',
        tratamiento_sesiones_numero_check: 'CHECK ((numero > 0))',
      };
      const idxEsperado = {
        tratamientos_pkey: 'CREATE UNIQUE INDEX tratamientos_pkey ON medical_records.tratamientos USING btree (id)',
        tratamientos_patient_id_estado_idx: 'CREATE INDEX tratamientos_patient_id_estado_idx ON medical_records.tratamientos USING btree (patient_id, estado)',
        tratamientos_doctor_id_estado_idx: 'CREATE INDEX tratamientos_doctor_id_estado_idx ON medical_records.tratamientos USING btree (doctor_id, estado)',
        tratamientos_id_patient_id_key: 'CREATE UNIQUE INDEX tratamientos_id_patient_id_key ON medical_records.tratamientos USING btree (id, patient_id)',
        tratamientos_id_doctor_id_key: 'CREATE UNIQUE INDEX tratamientos_id_doctor_id_key ON medical_records.tratamientos USING btree (id, doctor_id)',
        tratamientos_plantilla_sugerida_id_idx: 'CREATE INDEX tratamientos_plantilla_sugerida_id_idx ON medical_records.tratamientos USING btree (plantilla_sugerida_id)',
        tratamiento_sesiones_pkey: 'CREATE UNIQUE INDEX tratamiento_sesiones_pkey ON medical_records.tratamiento_sesiones USING btree (id)',
        tratamiento_sesiones_tratamiento_id_numero_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_tratamiento_id_numero_key ON medical_records.tratamiento_sesiones USING btree (tratamiento_id, numero)',
        tratamiento_sesiones_booking_id_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_booking_id_key ON medical_records.tratamiento_sesiones USING btree (booking_id)',
        tratamiento_sesiones_visita_id_key: 'CREATE UNIQUE INDEX tratamiento_sesiones_visita_id_key ON medical_records.tratamiento_sesiones USING btree (visita_id)',
        tratamiento_sesiones_patient_id_idx: 'CREATE INDEX tratamiento_sesiones_patient_id_idx ON medical_records.tratamiento_sesiones USING btree (patient_id)',
      };
      const fks = Object.fromEntries((await q(`SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid IN ('medical_records.tratamientos'::regclass,'medical_records.tratamiento_sesiones'::regclass) AND contype='f'`)).map((r) => [r.conname, r.def]));
      const cks = Object.fromEntries((await q(`SELECT conname, pg_get_constraintdef(oid) def FROM pg_constraint WHERE conrelid IN ('medical_records.tratamientos'::regclass,'medical_records.tratamiento_sesiones'::regclass) AND contype='c'`)).map((r) => [r.conname, r.def]));
      const ixs = Object.fromEntries((await q(`SELECT c.relname, pg_get_indexdef(i.indexrelid) def FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE i.indrelid IN ('medical_records.tratamientos'::regclass,'medical_records.tratamiento_sesiones'::regclass)`)).map((r) => [r.relname, r.def]));
      const comparar = (nombre, esp, got) => {
        const mal = Object.entries(esp).filter(([k, v]) => got[k] !== v).map(([k]) => k);
        const sobran = Object.keys(got).filter((k) => !(k in esp));
        console.log(nombre, mal.length || sobran.length ? 'MAL' : 'OK', `(${Object.keys(got).length})`, mal.length || sobran.length ? JSON.stringify({ mal, sobran }) : '');
        return mal.length === 0 && sobran.length === 0;
      };
      const todo = [comparar('FKs', esperado, fks), comparar('CHECKs', chkEsperado, cks), comparar('índices', idxEsperado, ixs)].every(Boolean);
      const [{ n }] = await q(`SELECT (SELECT count(*) FROM medical_records.tratamientos) + (SELECT count(*) FROM medical_records.tratamiento_sesiones) AS n`);
      console.log('filas', Number(n));
      if (!todo || Number(n) !== 0) throw new Error('VERIFICACIÓN FALLÓ — rollback');
    }, { timeout: 60000, maxWait: 10000 });
    console.log('COMMIT ✔');
  } catch (e) { console.log('NO SE APLICÓ:', String(e.message).slice(0, 500)); }
  finally {
    const r = await prisma.$queryRawUnsafe(`SELECT to_regclass('medical_records.tratamientos')::text t, to_regclass('medical_records.tratamiento_sesiones')::text s`);
    console.log('en prod ahora:', r);
    await prisma.$disconnect();
  }
})();
