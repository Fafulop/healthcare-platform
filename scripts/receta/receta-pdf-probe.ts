// La receta en PDF: el dibujo MOVIDO a lib/receta-pdf.ts tiene que dar EXACTAMENTE el mismo PDF que el
// de antes (copiado tal cual en scripts/receta/_receta-pdf-viejo.ts). Se comparan los bytes de muchas
// variantes, con fecha de creación e id de archivo fijos. Sin red, sin BD.
// Correr: npx tsx --tsconfig apps/doctor/tsconfig.json scripts/receta/receta-pdf-probe.ts
import { jsPDF } from 'jspdf';
import { ajustesRx, dibujarReceta, nombreArchivoReceta, type RecetaParaPdf } from '@/lib/receta-pdf';
import { dibujarRecetaViejo } from './_receta-pdf-viejo';
import { DEFAULT_PDF_SETTINGS, type PdfSettings } from '@/types/pdf-settings';

const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const med = (i: number) => ({
  drugName: `Paracetamol ${i}`, presentation: 'Tabletas 500 mg', dosage: '1 tableta', frequency: 'cada 8 horas',
  duration: '5 días', quantity: '15', instructions: 'Tomar con alimentos. '.repeat(i % 3 + 1), warnings: i % 2 ? 'No combinar con alcohol' : '',
});
const base: RecetaParaPdf = {
  prescriptionDate: '2026-10-01T18:30:00.000Z', expiresAt: '2026-10-31',
  diagnosis: 'Lumbalgia mecánica aguda', clinicalNotes: 'Dolor de 3 días de evolución, sin irradiación. '.repeat(3),
  doctorFullName: 'Dra. Ana María López Pérez', doctorLicense: '1234567',
  doctorCredentials: [{ titulo: 'Médico Cirujano', cedula: '1234567' }, { titulo: 'Especialidad en Medicina Interna', cedula: '7654321' }],
  patient: { id: 'p', firstName: 'Paciente', lastName: 'de Ejemplo', internalId: 'P123', dateOfBirth: '1980-05-14', sex: 'Femenino' },
  medications: [med(1), med(2)] as any,
  imagingStudies: [{ studyName: 'Rayos X', region: 'Columna lumbar', indication: 'Dolor', urgency: 'Normal', notes: 'AP y lateral' }] as any,
  labStudies: [{ studyName: 'Biometría hemática', indication: 'Control', urgency: 'Normal', fasting: '8 horas', notes: '' }] as any,
  customData: null, template: null,
};
const conPlantilla: RecetaParaPdf = {
  ...base, medications: [] as any,
  template: { id: 't', name: 'Receta oftalmológica', customFields: [
    { name: 'od', label: 'Ojo derecho', order: 0, type: 'text' }, { name: 'oi', label: 'Ojo izquierdo', order: 1, type: 'text' },
    { name: 'indic', label: 'Indicaciones', order: 2, type: 'textarea' },
  ] as any },
  customData: { od: '-1.25 esf', oi: '-1.00 esf', indic: 'Uso permanente. '.repeat(20) },
};
const larga: RecetaParaPdf = { ...base, medications: Array.from({ length: 14 }, (_, i) => med(i + 1)) as any };

const ajustes = (p: Partial<PdfSettings>): PdfSettings => ({ ...DEFAULT_PDF_SETTINGS, ...p });
const variantes: [string, RecetaParaPdf, Partial<PdfSettings>, string, boolean][] = [
  ['default azul', base, {}, 'blue', false],
  ['con logo y firma', base, {}, 'green', true],
  ['sin color', base, {}, 'none', true],
  ['morado sin encabezado', base, { rxShowHeader: false }, 'purple', true],
  ['sin pie', base, { rxShowFooter: false }, 'red', true],
  ['sin caja de paciente ni diagnóstico ni notas', base, { rxShowPatientBox: false, rxShowDiagnosis: false, rxShowClinicalNotes: false }, 'gray', false],
  ['media carta', base, { rxPageSize: 'half-letter' as any }, 'blue', true],
  ['A5 horizontal', base, { rxPageSize: 'a5' as any, rxOrientation: 'landscape' }, 'blue', true],
  ['carta con márgenes grandes (membrete)', base, { rxPageSize: 'letter' as any, rxTopMarginMm: 60, rxBottomMarginMm: 70 }, 'blue', true],
  ['plantilla en vez de medicamentos', conPlantilla, {}, 'blue', true],
  ['larga (varias páginas)', larga, {}, 'blue', true],
  ['color desconocido → azul', base, {}, 'turquesa', false],
];

const bytes = (d: jsPDF) => { d.setCreationDate(new Date(0)); d.setFileId('0'.repeat(32)); return d.output(); };

for (const [n, rec, p, color, imgs] of variantes) {
  const s = ajustes(p);
  const rx = ajustesRx(s);
  const logo = imgs && rx.showLogo ? PNG : null;
  const sig = imgs && rx.showSignature ? PNG : null;
  const nuevo = bytes(dibujarReceta(jsPDF, rec, { colorScheme: color, logoB64: logo, sigB64: sig }, rx));
  const viejo = bytes(dibujarRecetaViejo(jsPDF, rec, s, color, logo, sig));
  const paginas = (nuevo.match(/\/Type \/Page\b/g) || []).length;
  ok(`idéntico: ${n}`, nuevo === viejo && nuevo.length > 1000, `${nuevo.length} bytes · ${paginas} pág.`);
}
ok('nombre del archivo', nombreArchivoReceta(base) === 'receta_Paciente_de_Ejemplo_01-10-2026.pdf', nombreArchivoReceta(base));

for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
const f = res.filter((r) => !r[1]).length;
console.log(`\n${res.length - f}/${res.length}`);
if (f) process.exitCode = 1;
