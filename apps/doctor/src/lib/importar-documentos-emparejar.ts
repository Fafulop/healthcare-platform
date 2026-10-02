/**
 * PACIENTE MIGRATION I2 — lo PURO de la pantalla de importar documentos: qué es cada archivo, a qué
 * paciente va (por el nombre de su carpeta y archivo) y de qué fecha es. Sin React, sin servidor, sin
 * Prisma: se prueba en Node (`scripts/patient-import/emparejar-probe.ts`).
 * Diseño: docs/DESDE JUNIO/PACIENTE MIGRATION/02-DISENO-importar-documentos.md §4 y §6b.
 */

export const MAX_ARCHIVOS = 300;
const MB = 1024 * 1024;

// ─── Qué es cada archivo (D1, G4, D1b, D1c) ─────────────────────────────────────────────────

export type TipoImport = 'pdf' | 'imagen' | 'word';
export type Clasificacion = { ok: true; tipo: TipoImport; mime: string } | { ok: false; motivo: string };

const IMAGENES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
/** Topes por tipo: los de las rutas de subida (`medicalDocuments` 32 MB, `medicalImages` 16 MB) y D1b. */
export const TOPE_BYTES: Record<TipoImport, number> = { pdf: 32 * MB, imagen: 16 * MB, word: 5 * MB };

export function extension(nombre: string) {
  const i = nombre.lastIndexOf('.');
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : '';
}

/** Por la EXTENSIÓN (el MIME del navegador falla seguido con Word); el servidor vuelve a decidir con su libro. */
export function clasificarArchivo(nombre: string, bytes: number): Clasificacion {
  const ext = extension(nombre);
  let r: Clasificacion;
  if (ext === 'pdf') r = { ok: true, tipo: 'pdf', mime: 'application/pdf' };
  else if (IMAGENES[ext]) r = { ok: true, tipo: 'imagen', mime: IMAGENES[ext] };
  else if (ext === 'docx') r = { ok: true, tipo: 'word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  else if (ext === 'doc') return { ok: false, motivo: 'Word viejo (.doc): guárdalo como .docx o PDF' };
  else if (ext === 'heic' || ext === 'heif') return { ok: false, motivo: 'Foto HEIC: conviértela a JPG' };
  else return { ok: false, motivo: 'Tipo no admitido (sólo PDF, JPG, PNG, WebP o Word .docx)' };
  if (bytes > TOPE_BYTES[r.tipo]) {
    const mb = Math.round(TOPE_BYTES[r.tipo] / MB);
    return { ok: false, motivo: r.tipo === 'word' ? `Word de más de ${mb} MB: guárdalo como PDF` : `Pesa más de ${mb} MB` };
  }
  if (bytes === 0) return { ok: false, motivo: 'El archivo está vacío' };
  return r;
}

// ─── A qué paciente va (G6, G8, §4.2) ───────────────────────────────────────────────────────

export interface PacienteParaEmparejar {
  id: string;
  firstName: string;
  lastName: string;
  internalId: string | null;
  archivado: boolean;
}

export type Emparejamiento =
  | { estado: 'uno'; patientId: string; por: 'folio' | 'nombre' }
  | { estado: 'varios'; candidatos: string[] }
  | { estado: 'ninguno' };

/** Minúsculas, sin acentos, sólo letras y números separados por un espacio. */
export function normalizar(t: string) {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const palabras = (t: string) => normalizar(t).split(' ').filter(Boolean);

/** La ruta sin la extensión del archivo: «Pepito Pérez/lab 2023.pdf» → «Pepito Pérez/lab 2023». */
function rutaSinExtension(ruta: string) {
  const i = ruta.lastIndexOf('.');
  const j = ruta.lastIndexOf('/');
  return i > j ? ruta.slice(0, i) : ruta;
}

/**
 * El paciente de un archivo, por su RUTA (carpetas + nombre):
 *  1. **Folio**: si alguna palabra de la ruta ES el folio de un paciente (`P1787611671312`,
 *     `MIG-718315B8-0001` → se compara normalizado), ése — si es uno solo.
 *  2. **Nombre**: un paciente es candidato si TODAS las palabras de su nombre y apellidos están en la
 *     ruta (sin acentos, sin mayúsculas, en cualquier orden). Si hay varios, gana el de nombre MÁS
 *     LARGO sólo si es el único con ese largo («Pepito Pérez García» le gana a «Pepito Pérez» cuando la
 *     ruta trae las tres palabras); si empatan → «varios» (homónimos: decide el doctor).
 *  Un nombre de UNA sola palabra no empareja (demasiado ambiguo: «Ana», «Luis»).
 */
export function emparejar(ruta: string, pacientes: PacienteParaEmparejar[]): Emparejamiento {
  const norm = normalizar(rutaSinExtension(ruta));
  const enRuta = new Set(norm.split(' ').filter(Boolean));
  // El folio puede venir con guiones: se busca como secuencia de palabras normalizadas.
  const porFolio = pacientes.filter((p) => {
    if (!p.internalId) return false;
    const f = normalizar(p.internalId);
    return f.length >= 4 && ` ${norm} `.includes(` ${f} `);
  });
  if (porFolio.length === 1) return { estado: 'uno', patientId: porFolio[0].id, por: 'folio' };
  if (porFolio.length > 1) return { estado: 'varios', candidatos: porFolio.map((p) => p.id) };

  const candidatos = pacientes
    .map((p) => ({ p, w: [...new Set([...palabras(p.firstName), ...palabras(p.lastName)])] }))
    .filter(({ w }) => w.length >= 2 && w.every((x) => enRuta.has(x)));
  if (candidatos.length === 0) return { estado: 'ninguno' };
  if (candidatos.length === 1) return { estado: 'uno', patientId: candidatos[0].p.id, por: 'nombre' };
  const max = Math.max(...candidatos.map((c) => c.w.length));
  const largos = candidatos.filter((c) => c.w.length === max);
  if (largos.length === 1) return { estado: 'uno', patientId: largos[0].p.id, por: 'nombre' };
  return { estado: 'varios', candidatos: largos.map((c) => c.p.id) };
}

/** La carpeta de una ruta («a/b/c.pdf» → «a/b»; sin carpeta → ''). Para «arreglar uno arregla su carpeta». */
export function carpetaDe(ruta: string) {
  const j = ruta.lastIndexOf('/');
  return j >= 0 ? ruta.slice(0, j) : '';
}

// ─── De qué fecha es (D3, G3) ───────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9,
  oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};

const dos = (n: number) => String(n).padStart(2, '0');

function isoSiValida(y: number, m: number, d: number, hoy: string): string | null {
  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31-feb
  const iso = `${y}-${dos(m)}-${dos(d)}`;
  return iso <= hoy ? iso : null; // nunca en el futuro
}

/**
 * Una fecha escrita en el NOMBRE del archivo (o de su carpeta), o null. Formatos: `2023-05-14`,
 * `2023_05_14`, `20230514`, `14-05-2023`, `14.05.2023`, `14_05_2023` y «14 may 2023» / «14 mayo 2023»
 * / «14-mayo-2023». Las numéricas con el año al final se leen **día-mes** (formato mexicano — G3).
 * Se toma la del NOMBRE del archivo si hay; si no, la de la carpeta más cercana. `hoy` = 'YYYY-MM-DD'.
 */
export function fechaDeNombre(ruta: string, hoy: string): string | null {
  const partes = rutaSinExtension(ruta).split('/').reverse(); // primero el archivo, luego sus carpetas
  for (const parte of partes) {
    const t = normalizar(parte);
    let m: RegExpExecArray | null;
    if ((m = /\b(\d{4})[ ](\d{1,2})[ ](\d{1,2})\b/.exec(t))) {
      const r = isoSiValida(+m[1], +m[2], +m[3], hoy); if (r) return r;
    }
    if ((m = /\b(\d{4})(\d{2})(\d{2})\b/.exec(t))) {
      const r = isoSiValida(+m[1], +m[2], +m[3], hoy); if (r) return r;
    }
    if ((m = /\b(\d{1,2})[ ](\d{1,2})[ ](\d{4})\b/.exec(t))) {
      const r = isoSiValida(+m[3], +m[2], +m[1], hoy); if (r) return r;
    }
    if ((m = /\b(\d{1,2})[ ]([a-z]+)[ ](\d{4})\b/.exec(t)) && MESES[m[2]]) {
      const r = isoSiValida(+m[3], MESES[m[2]], +m[1], hoy); if (r) return r;
    }
  }
  return null;
}

/** 'YYYY-MM-DD' de un instante, en hora de México (la fecha de modificación del archivo). */
export function diaEnMexico(ms: number) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
}

/** La fecha propuesta: la del nombre; si no, la de modificación del archivo; nunca en el futuro. */
export function fechaPropuesta(ruta: string, lastModified: number, hoy: string) {
  const delNombre = fechaDeNombre(ruta, hoy);
  if (delNombre) return { fecha: delNombre, origen: 'nombre' as const };
  const mod = diaEnMexico(lastModified);
  return { fecha: mod <= hoy ? mod : hoy, origen: 'archivo' as const };
}
