// PACIENTE MIGRATION I2 — casos de las funciones PURAS de la pantalla (sin red, sin BD).
// Correr: npx tsx --tsconfig apps/doctor/tsconfig.json scripts/patient-import/emparejar-probe.ts
import {
  clasificarArchivo, emparejar, fechaDeNombre, fechaPropuesta, carpetaDe, normalizar, type PacienteParaEmparejar,
} from '@/lib/importar-documentos-emparejar';

const res: [string, boolean, string?][] = [];
const ok = (n: string, c: boolean, x = '') => res.push([n, !!c, x]);
const HOY = '2026-10-01';

const P = (id: string, firstName: string, lastName: string, internalId: string | null = null, archivado = false): PacienteParaEmparejar =>
  ({ id, firstName, lastName, internalId, archivado });
const pacientes = [
  P('pepito', 'Pepito', 'Pérez', 'P1787611671312'),
  P('pepito-garcia', 'Pepito', 'Pérez García'),
  P('maria1', 'María José', 'López'),
  P('maria2', 'María José', 'López'),               // homónima
  P('ana', 'Ana', ''),                              // un solo nombre: no empareja por nombre
  P('mig', 'Luis', 'Ramírez Soto', 'MIG-718315B8-0001'),
  P('arch', 'Rocío', 'Sandoval', null, true),
];
const e = (ruta: string) => emparejar(ruta, pacientes);

// Emparejar
ok('carpeta con el nombre (acentos y mayúsculas da igual)', JSON.stringify(e('PEPITO PEREZ/lab.pdf')) === JSON.stringify({ estado: 'uno', patientId: 'pepito', por: 'nombre' }), JSON.stringify(e('PEPITO PEREZ/lab.pdf')));
ok('orden apellido-nombre', (e('Perez Pepito - receta.pdf') as { patientId?: string }).patientId === 'pepito');
ok('el nombre más largo gana si es único', (e('Pepito Perez Garcia/consulta.docx') as { patientId?: string }).patientId === 'pepito-garcia');
ok('homónimos → varios (decide el doctor)', e('Maria Jose Lopez/estudio.pdf').estado === 'varios');
ok('sin nombre reconocible → ninguno', e('escaneo_0001.pdf').estado === 'ninguno');
ok('un solo nombre («Ana») no empareja', e('Ana/consulta.pdf').estado === 'ninguno');
ok('folio en el nombre → ése', JSON.stringify(e('P1787611671312 laboratorio.pdf')) === JSON.stringify({ estado: 'uno', patientId: 'pepito', por: 'folio' }));
ok('folio MIG con guiones', (e('expedientes/MIG-718315B8-0001.pdf') as { patientId?: string }).patientId === 'mig');
ok('archivado también empareja', (e('Rocio Sandoval/rx.jpg') as { patientId?: string }).patientId === 'arch');
ok('la EXTENSIÓN no cuenta como palabra', e('Pepito.pdf').estado === 'ninguno');
ok('palabra suelta parcial no empareja («Pep Perez»)', e('Pep Perez.pdf').estado === 'ninguno');
ok('carpetaDe', carpetaDe('a/b/c.pdf') === 'a/b' && carpetaDe('c.pdf') === '');
ok('normalizar', normalizar('  José-Ñúñez_2023 ') === 'jose nunez 2023', normalizar('  José-Ñúñez_2023 '));

// Fechas
const f = (r: string) => fechaDeNombre(r, HOY);
ok('2023-05-14', f('lab 2023-05-14.pdf') === '2023-05-14');
ok('2023_05_14', f('lab_2023_05_14.pdf') === '2023-05-14');
ok('20230514', f('scan20230514.pdf') === null && f('scan 20230514.pdf') === '2023-05-14', String(f('scan 20230514.pdf')));
ok('14-05-2023 se lee día-mes', f('receta 14-05-2023.pdf') === '2023-05-14');
ok('05-04-2023 = 5 de abril (día-mes)', f('05-04-2023.pdf') === '2023-04-05');
ok('14.05.2023', f('14.05.2023 rx.jpg') === '2023-05-14');
ok('«14 may 2023»', f('Consulta 14 may 2023.docx') === '2023-05-14');
ok('«14 mayo 2023»', f('14 mayo 2023.docx') === '2023-05-14');
ok('«3-septiembre-2022»', f('3-septiembre-2022.pdf') === '2022-09-03');
ok('31 de febrero → no es fecha', f('31-02-2023.pdf') === null);
ok('futura → no', f('2027-01-01.pdf') === null);
ok('la del archivo gana a la de la carpeta', f('2020-01-01/lab 2023-05-14.pdf') === '2023-05-14');
ok('si el archivo no trae, la de la carpeta', f('Consulta 14 may 2023/foto1.jpg') === '2023-05-14');
ok('número suelto no es fecha', f('Expediente 12345.pdf') === null);
const prop = fechaPropuesta('sin fecha.pdf', Date.UTC(2023, 4, 15, 3, 0), HOY); // 15 may 03:00 UTC = 14 may en México
ok('sin fecha en el nombre → la del archivo, en hora de México', prop.fecha === '2023-05-14' && prop.origen === 'archivo', JSON.stringify(prop));
ok('archivo «modificado en el futuro» → hoy', fechaPropuesta('x.pdf', Date.UTC(2030, 0, 1), HOY).fecha === HOY);

// Tipos
ok('PDF ok', clasificarArchivo('a.PDF', 1000).ok === true);
ok('JPG ok', (clasificarArchivo('a.jpeg', 1000) as { tipo?: string }).tipo === 'imagen');
ok('docx = word', (clasificarArchivo('a.docx', 1000) as { tipo?: string }).tipo === 'word');
ok('.doc rechazado', !clasificarArchivo('a.doc', 1000).ok);
ok('HEIC rechazado', !clasificarArchivo('IMG_1.HEIC', 1000).ok);
ok('xlsx rechazado', !clasificarArchivo('a.xlsx', 1000).ok);
ok('Word > 5 MB rechazado', !clasificarArchivo('a.docx', 6 * 1024 * 1024).ok);
ok('PDF de 32 MB ok, de 33 no', clasificarArchivo('a.pdf', 32 * 1024 * 1024).ok && !clasificarArchivo('a.pdf', 33 * 1024 * 1024).ok);
ok('vacío rechazado', !clasificarArchivo('a.pdf', 0).ok);

for (const [n, p, x] of res) console.log(`${p ? 'OK  ' : 'FAIL'} ${n}${x ? `  (${x})` : ''}`);
const fallas = res.filter((r) => !r[1]).length;
console.log(`\n${res.length - fallas}/${res.length}`);
if (fallas) process.exitCode = 1;
