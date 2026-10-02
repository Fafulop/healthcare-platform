// PACIENTE MIGRATION I1 probe — runs the REAL `guardarTanda` (apps/doctor/src/lib/importar-documentos.ts)
// against prod inside ONE transaction that ALWAYS rolls back. Audit rows go to an in-memory collector
// (never to prod). dr-prueba / «pepit perez»; the StoredFile rows it needs are created inside the tx.
// Correr (desde packages/database):
//   railway run --service pgvector sh -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx --tsconfig ../../apps/doctor/tsconfig.json ../../scripts/patient-import/importar-documentos-probe.ts'
import { prisma } from '@healthcare/database';
import { guardarTanda, type AuditoriaDeImport } from '@/lib/importar-documentos';

const ROLLBACK = new Error('ROLLBACK');
const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);
const doctorId = 'cmni1bov90000mk0lyeztr3ad';
const patientId = 'cmt7tu1as0007ms0ttc4pwijd';
const cola = Date.now().toString(36);
const diaEnMexico = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });

(async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const otroDoctor = await tx.doctor.findFirst({ where: { NOT: { id: doctorId } }, select: { id: true } });
      const pacienteAjeno = await tx.patient.findFirst({ where: { NOT: { doctorId } }, select: { id: true } });
      const key = `PROBE-IMP-${cola}`;
      await tx.storedFile.create({ data: { doctorId, fileKey: key, url: `https://utfs.io/f/${key}`, sizeBytes: 12345, kind: 'medicalDocuments' } });
      const keyAjena = `PROBE-IMP-AJENO-${cola}`;
      // Un PDF del mismo doctor pero de OTRA ruta de subida (una factura del flujo de dinero).
      const keyFactura = `PROBE-IMP-FACT-${cola}`;
      await tx.storedFile.create({ data: { doctorId, fileKey: keyFactura, url: `https://utfs.io/f/${keyFactura}`, sizeBytes: 5, kind: 'ledgerAttachments' } });
      if (otroDoctor) {
        await tx.storedFile.create({ data: { doctorId: otroDoctor.id, fileKey: keyAjena, url: `https://utfs.io/f/${keyAjena}`, sizeBytes: 1, kind: 'medicalDocuments' } });
      }

      const audit: AuditoriaDeImport[] = [];
      const archivo = (ref: string, extra: Record<string, unknown> = {}) => ({
        ref, tipo: 'archivo', patientId, fecha: '2023-05-14', ruta: `Pepit/${ref}.pdf`, fileName: `${ref}.pdf`,
        fileUrl: `https://utfs.io/f/${key}`, mimeType: 'application/pdf', fileSize: 999999999, ...extra,
      });
      const nota = (ref: string, extra: Record<string, unknown> = {}) => ({
        ref, tipo: 'nota', patientId, fecha: '2023-05-14', ruta: `Pepit/${ref}.docx`, fileName: `${ref}.docx`,
        texto: 'Paciente refiere dolor lumbar.\nPlan: reposo.', ...extra,
      });

      const r = await guardarTanda(tx, { doctorId, userId: 'probe' }, `PROBE-${cola}`, [
        archivo('a1'),
        archivo('a1', { ref: 'a1-otra-vez' }),                                   // G1
        archivo('a2', { fileUrl: 'https://utfs.io/f/NO-EXISTE-' + cola }),         // no está en su libro
        archivo('a3', { fileUrl: `https://utfs.io/f/${keyAjena}` }),               // archivo de OTRO doctor
        archivo('a4', { mimeType: 'image/heic' }),                                // G4
        archivo('a5', { fileUrl: `https://otro-sitio.example/f/${key}` }),          // host ajeno, llave real
        archivo('a6', { fileUrl: `https://utfs.io/f/${keyFactura}` }),            // factura (otra ruta de subida)
        archivo('a7', { mimeType: 'image/png' }),                                 // PDF que dice ser imagen
        nota('n1'),
        nota('n1', { ref: 'n1-otra-vez' }),                                       // G1
        nota('n1', { ref: 'n1-otro-texto', texto: 'Otro documento con el mismo nombre y fecha.' }), // NO es duplicado
        nota('n2', { texto: '   ' }),                                             // G5 sin texto
        nota('n3', { texto: 'x'.repeat(100_001) }),                               // demasiado largo
        nota('n4', { fecha: '2999-01-01' }),                                      // futuro
        nota('n5', { fecha: '2023-02-31' }),                                      // fecha imposible
        ...(pacienteAjeno ? [nota('n6', { patientId: pacienteAjeno.id })] : []),  // paciente ajeno
      ], async (a) => { audit.push(a); });

      // `verificar` (sólo lectura, ANTES de subir): a1 ya quedó guardado (12345 bytes) → ya_importado;
      // otro nombre o tamaño → nuevo; no escribe nada.
      const antes = await tx.patientMedia.count({ where: { patientId } });
      const v = await guardarTanda(tx, { doctorId, userId: 'probe' }, `PROBE-${cola}`, [
        { ref: 'v1', tipo: 'verificar', patientId, fileName: 'a1.pdf', bytes: 12345 },
        { ref: 'v2', tipo: 'verificar', patientId, fileName: 'a1.pdf', bytes: 999 },
        { ref: 'v3', tipo: 'verificar', patientId, fileName: 'nuevo.pdf', bytes: 12345 },
        { ref: 'v4', tipo: 'verificar', patientId, fileName: 'a1.pdf' },
      ], async (a) => { audit.push(a); });
      const despues = await tx.patientMedia.count({ where: { patientId } });
      const dv = (ref: string) => v.find((x) => x.ref === ref)?.estado;
      ok('verificar: mismo nombre y tamaño → ya_importado', dv('v1') === 'ya_importado');
      ok('verificar: otro tamaño u otro nombre → nuevo', dv('v2') === 'nuevo' && dv('v3') === 'nuevo');
      ok('verificar: sin tamaño → error', dv('v4') === 'error');
      ok('verificar no escribe (ni registros ni bitácora)', antes === despues, `${antes} → ${despues}`);

      const de = (ref: string) => r.find((x) => x.ref === ref);
      ok('archivo PDF de su libro → guardado', de('a1')?.estado === 'guardado', JSON.stringify(de('a1')));
      ok('G1 el mismo archivo otra vez → ya_importado', de('a1-otra-vez')?.estado === 'ya_importado');
      ok('URL que no está en su libro → error', de('a2')?.estado === 'error', de('a2')?.motivo);
      ok('archivo de OTRO doctor → error', !otroDoctor || de('a3')?.estado === 'error', de('a3')?.motivo);
      ok('G4 HEIC → error', de('a4')?.estado === 'error', de('a4')?.motivo);
      // a5: llave real con un host AJENO. Tiene otro nombre (no es duplicado) ⇒ se guarda, pero con la
      // URL del LIBRO, nunca la que mandó el navegador:
      const m5 = await tx.patientMedia.findUnique({ where: { id: de('a5')!.id! } });
      ok('host ajeno → se guarda con la URL del LIBRO', de('a5')?.estado === 'guardado' && m5?.fileUrl === `https://utfs.io/f/${key}`, m5?.fileUrl);
      ok('nota del Word → guardado', de('n1')?.estado === 'guardado');
      ok('mismo nombre y fecha, OTRO texto → se guarda (no es duplicado)', de('n1-otro-texto')?.estado === 'guardado');
      ok('PDF de otra ruta de subida (factura) → error', de('a6')?.estado === 'error', de('a6')?.motivo);
      ok('PDF que dice ser imagen → error (manda el libro)', de('a7')?.estado === 'error', de('a7')?.motivo);
      ok('G1 la misma nota otra vez → ya_importado', de('n1-otra-vez')?.estado === 'ya_importado');
      ok('G5 Word sin texto → error', de('n2')?.estado === 'error', de('n2')?.motivo);
      ok('texto > 100 000 → error', de('n3')?.estado === 'error', de('n3')?.motivo);
      ok('fecha futura → error', de('n4')?.estado === 'error');
      ok('31 de febrero → error', de('n5')?.estado === 'error');
      if (pacienteAjeno) ok('paciente de otro doctor → error', de('n6')?.estado === 'error', de('n6')?.motivo);

      // Lo que QUEDÓ escrito (la forma que Prisma aceptó), leído de vuelta.
      const media = await tx.patientMedia.findUnique({ where: { id: de('a1')!.id! } });
      ok('media: «Historial importado», sin visita, tamaño del LIBRO (no el del navegador)',
        media?.category === 'Historial importado' && media.visitaId === null && media.fileSize === 12345 && media.mediaType === 'document',
        `${media?.category} · ${media?.fileSize}`);
      ok('la URL guardada es la del LIBRO (utfs.io), no la que mandó el navegador', media?.fileUrl === `https://utfs.io/f/${key}`, media?.fileUrl);
      ok('G2 media: captureDate = 14 may en México', !!media && diaEnMexico(media.captureDate) === '2023-05-14', media?.captureDate.toISOString());
      const n = await tx.patientNote.findUnique({ where: { id: de('n1')!.id! } });
      ok('nota: primer renglón «Importado de n1.docx · 14 may 2023»', !!n && n.content.startsWith('Importado de n1.docx · 14 may 2023\n\nPaciente refiere'), n?.content.split('\n')[0]);
      ok('D7/G2 nota: createdAt Y updatedAt = 14 may en México (Prisma acepta updatedAt explícito)',
        !!n && diaEnMexico(n.createdAt) === '2023-05-14' && diaEnMexico(n.updatedAt) === '2023-05-14',
        `${n?.createdAt.toISOString()} / ${n?.updatedAt.toISOString()}`);
      ok('bitácora: 4 renglones (los 4 guardados: a1, a5, n1, n1-otro-texto; verificar no escribe) con batchId', audit.length === 4 && audit.every((a) => a.changes.batchId === `PROBE-${cola}`),
        audit.map((a) => a.action).join(','));

      throw ROLLBACK;
    }, { timeout: 60000 });
  } catch (e) {
    if (e !== ROLLBACK) { console.log('ERROR:', (e as Error).message); process.exitCode = 1; }
  }
  const quedo = await prisma.storedFile.count({ where: { fileKey: { startsWith: `PROBE-IMP-` } } });
  ok('revertido: no quedó nada (StoredFile de prueba = 0)', quedo === 0, String(quedo));
  await prisma.$disconnect();
  for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length} · revertido`);
  if (f) process.exitCode = 1;
})();
