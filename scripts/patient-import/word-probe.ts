// PACIENTE MIGRATION I2 — el lector de Word REAL (`leerWord`, apps/doctor/src/lib/importar-documentos-word.ts)
// contra .docx de verdad que este script arma (texto, tabla, imagen, vacío, dañado). Sin red, sin BD.
// Correr: npx tsx --tsconfig apps/doctor/tsconfig.json scripts/patient-import/word-probe.ts
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { leerWord } from '@/lib/importar-documentos-word';

// jszip viene con mammoth (pnpm no lo sube): se resuelve desde la carpeta REAL de mammoth.
const requireDoctor = createRequire(fs.realpathSync(path.join(process.cwd(), 'apps/doctor/node_modules/mammoth/package.json')));
const JSZip = requireDoctor('jszip');

const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const p = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const imagen = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="100" cy="100"/><wp:docPr id="1" name="img"/>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
<pic:nvPicPr><pic:cNvPr id="1" name="img"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic>
</wp:inline></w:drawing></w:r></w:p>`;
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function docx(cuerpo: string, conImagen = false): Promise<ArrayBuffer> {
  const z = new JSZip();
  z.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  z.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${conImagen ? '<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}</Relationships>`);
  if (conImagen) z.file('word/media/image1.png', PNG_1PX);
  z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${cuerpo}</w:body></w:document>`);
  const buf: Buffer = await z.generateAsync({ type: 'nodebuffer' });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

(async () => {
  const tabla = `<w:tbl><w:tr><w:tc>${p('Glucosa')}</w:tc><w:tc>${p('95 mg/dL')}</w:tc></w:tr></w:tbl>`;
  const r1 = await leerWord(await docx(p('Consulta del 14 de mayo') + p('Paciente refiere dolor lumbar, 3 días.') + p('') + p('') + p('') + tabla + p('Plan: reposo y paracetamol.')));
  ok('texto normal → ok', r1.ok, r1.ok ? JSON.stringify(r1.texto.slice(0, 80)) : (r1 as { motivo: string }).motivo);
  ok('acentos y párrafos se conservan', r1.ok && r1.texto.includes('Paciente refiere dolor lumbar, 3 días.') && r1.texto.includes('Plan: reposo y paracetamol.'));
  ok('la tabla pasa como texto', r1.ok && r1.texto.includes('Glucosa') && r1.texto.includes('95 mg/dL'));
  ok('renglones en blanco seguidos se juntan (máx. 1)', r1.ok && !r1.texto.includes('\n\n\n'));
  ok('sin imágenes → 0', r1.ok && r1.imagenes === 0);

  const r2 = await leerWord(await docx(p('Rayos X de tórax') + imagen + p('Sin hallazgos.'), true));
  ok('con imagen → texto ok y avisa 1 imagen', r2.ok && r2.imagenes === 1 && r2.texto.includes('Sin hallazgos.'), JSON.stringify(r2).slice(0, 120));

  const r3 = await leerWord(await docx(imagen, true));
  ok('sólo imagen (escaneo pegado) → rechazado «no tiene texto»', !r3.ok && /no tiene texto/i.test((r3 as { motivo: string }).motivo));

  const r4 = await leerWord(await docx(p('x'.repeat(100_001))));
  ok('> 100 000 caracteres → rechazado', !r4.ok && /demasiado largo/i.test((r4 as { motivo: string }).motivo));

  const r5 = await leerWord(new TextEncoder().encode('esto no es un docx').buffer as ArrayBuffer);
  ok('archivo dañado → rechazado sin tronar', !r5.ok && /no se pudo leer/i.test((r5 as { motivo: string }).motivo));

  for (const [n, q, x] of res) console.log(`${q ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
  const f = res.filter((r) => !r[1]).length;
  console.log(`\n${res.length - f}/${res.length}`);
  if (f) process.exitCode = 1;
})();
