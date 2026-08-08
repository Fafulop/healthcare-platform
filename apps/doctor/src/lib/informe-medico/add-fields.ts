/**
 * INFORME MÉDICO — ponerle campos a un formato PLANO (caso Allianz).
 *
 * El PDF oficial de Allianz trae **0 campos AcroForm**: las rayas y las etiquetas
 * están DIBUJADAS. No hay dónde escribir. Aquí se los ponemos UNA vez, y a partir
 * de ahí ese formato se llena igual que AXA (03-FORMATOS §4).
 *
 * Cómo, sin hacer un solo clic:
 *   1. Sacar las REGLAS dibujadas del operator list (`OPS.constructPath`),
 *      quedándose con lo ancho y delgado.
 *   2. Deducir la etiqueta por vecindad: el texto que termina justo a la izquierda
 *      en el mismo renglón, o si no, el de arriba MÁS CENTRADO sobre la regla.
 *   3. Crear el campo sobre la regla.
 *
 * Resultado medido el 2026-08-08 sobre el Allianz oficial: 61 reglas → 56 campos,
 * 43 por la izquierda y 13 por arriba; llenado de prueba 12/12; verificado a ojo
 * por el usuario (el primero y el último de la página caen en su raya).
 *
 * ⚠️ El PDF que sale de aquí YA NO es el oficial byte a byte. Se marca con
 * `insurance_forms.fields_added_by_us = true`.
 */
import { PDFDocument } from 'pdf-lib';
import type { FieldDict } from './types';

// pdfjs se carga dinámicamente: es pesado y sólo se usa al dar de alta un formato.
type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsCache: PdfjsModule | null = null;
async function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsCache) pdfjsCache = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsCache;
}

type Matriz = [number, number, number, number, number, number];

const multiplicar = (a: Matriz, b: Matriz): Matriz => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const aplicar = (m: Matriz, x: number, y: number): [number, number] =>
  [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export interface Regla { x: number; y: number; w: number }
export interface Texto { x: number; y: number; w: number; s: string }

/** Lo que se saca de UNA pasada por el PDF: reglas y textos de cada página. */
export interface GeometriaPagina { pagina: number; reglas: Regla[]; textos: Texto[] }

/**
 * Abre el PDF UNA vez y saca la geometría de todas las páginas.
 *
 * 🔴 Se le pasa una COPIA del buffer: pdf.js **transfiere** los TypedArray al
 * worker y los deja detached. Reusar el mismo `Uint8Array` en una segunda
 * llamada devuelve un buffer vacío — hoy sobrevive porque el worker falso de
 * Node no hace transfer, pero en cuanto haya worker real saldrían 0 textos,
 * todas las etiquetas null, y un PDF "exitoso" con CERO campos.
 *
 * Y se cierra con `destroy()`: antes se abría un documento por página y se
 * quedaban todos vivos.
 */
export async function geometriaDelPdf(pdfBase: Uint8Array): Promise<GeometriaPagina[]> {
  const { getDocument, OPS } = await getPdfjs();
  const tarea = getDocument({ data: new Uint8Array(pdfBase) });
  const doc = await tarea.promise;
  try {
    const salida: GeometriaPagina[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      salida.push({
        pagina: p,
        reglas: reglasDeOperadores(await page.getOperatorList(), OPS),
        textos: textosDeContenido(await page.getTextContent()),
      });
    }
    return salida;
  } finally {
    await doc.destroy();
  }
}

/**
 * Las reglas horizontales de una página, a partir de su operator list.
 *
 * 🔴 El `minMax` de `constructPath` viene en coordenadas LOCALES del path, NO de
 * la página: hay que llevar la matriz de transformación (`transform`/`save`/
 * `restore`) y aplicarla. Sin eso TODAS las reglas salen en `x=0, y=0` — y el
 * extractor *parece* funcionar, que es lo peligroso.
 */
function reglasDeOperadores(
  ops: { fnArray: number[] | ArrayLike<number>; argsArray: unknown[] },
  OPS: Awaited<ReturnType<typeof getPdfjs>>['OPS']
): Regla[] {
  let ctm: Matriz = [1, 0, 0, 1, 0, 0];
  const pila: Matriz[] = [];
  const salida: Regla[] = [];

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) { pila.push([...ctm] as Matriz); continue; }
    if (fn === OPS.restore) { ctm = pila.pop() ?? [1, 0, 0, 1, 0, 0]; continue; }
    if (fn === OPS.transform) { ctm = multiplicar(ctm, args as Matriz); continue; }
    if (fn !== OPS.constructPath) continue;

    const mm = (args as unknown[])[2] as ArrayLike<number> | undefined;
    if (!mm) continue;
    const [ax, ay] = aplicar(ctm, mm[0], mm[1]);
    const [bx, by] = aplicar(ctm, mm[2], mm[3]);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx);
    const y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    // Una raya de escribir es ANCHA y DELGADA. Lo alto son recuadros y barras.
    if (x1 - x0 < 25 || y1 - y0 > 3) continue;
    salida.push({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0) });
  }

  // La misma raya suele dibujarse dos veces (borde + relleno).
  const unicas: Regla[] = [];
  for (const r of salida.sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (unicas.some((u) => Math.abs(u.y - r.y) <= 2 && Math.abs(u.x - r.x) <= 3)) continue;
    unicas.push(r);
  }
  return unicas;
}

/** Los fragmentos de texto de una página, con su posición. */
function textosDeContenido(contenido: { items: unknown[] }): Texto[] {
  return contenido.items
    .filter((i): i is { str: string; transform: number[]; width: number } =>
      typeof i === 'object' && i !== null && 'str' in i &&
      typeof (i as { str: unknown }).str === 'string' &&
      (i as { str: string }).str.trim() !== '' && (i as { str: string }).str.trim() !== '□')
    .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str.trim() }));
}

/** La etiqueta de una regla: primero por la izquierda, si no por arriba. */
export function etiquetaDe(regla: Regla, textos: Texto[]): { label: string | null; via: 'izquierda' | 'arriba' | null } {
  const izq = textos
    .filter((t) => Math.abs(t.y - regla.y) <= 6 && t.x + t.w <= regla.x + 4 && t.x + t.w >= regla.x - 60)
    .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
  if (izq) return { label: izq.s, via: 'izquierda' };

  // Entre los de arriba gana el más CENTRADO sobre la regla: así la leyenda de la
  // columna ("Apellido Paterno") le gana al título de la sección ("Nombre del
  // Paciente:"), que arranca pegado al margen.
  const centro = regla.x + regla.w / 2;
  const arriba = textos
    .filter((t) => t.y > regla.y + 2 && t.y < regla.y + 26 &&
                   t.x < regla.x + regla.w - 2 && t.x + t.w > regla.x + 2)
    .sort((a, b) => (a.y - b.y) ||
      (Math.abs(a.x + a.w / 2 - centro) - Math.abs(b.x + b.w / 2 - centro)))[0];
  if (arriba) return { label: arriba.s, via: 'arriba' };

  return { label: null, via: null };
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!:().,/]/g, '').trim()
    .replace(/\s+/g, '_').replace(/_+/g, '_').slice(0, 44);
}

export interface CampoPropuesto extends Regla {
  page: number;
  label: string | null;
  via: 'izquierda' | 'arriba' | null;
  name: string | null;
}

export interface ResultadoAltaFormato {
  /** El PDF con los campos puestos. Este es el que se guarda como base. */
  pdf: Uint8Array;
  /** Propuesta para revisión humana: no todos los nombres salen bien. */
  campos: CampoPropuesto[];
  sinEtiqueta: number;
  /** Reglas que no se pudieron convertir en campo (nombre repetido, etc.). */
  noCreados: { page: number; label: string; motivo: string }[];
}

/**
 * Le pone campos de texto a un PDF plano y devuelve la propuesta de nombres.
 *
 * ⚠️ La salida es una PROPUESTA. Salen cosas como `p1_AAAA` (una fecha etiquetada
 * con el encabezado de su columna) o `p1_y_cantidad` (la pregunta venía partida en
 * dos fragmentos). Por eso hace falta la pantalla de revisión: el humano corrige
 * un puñado en vez de teclear 56.
 */
export async function agregarCamposAFormatoPlano(pdfBase: Uint8Array): Promise<ResultadoAltaFormato> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const campos: CampoPropuesto[] = [];
  const noCreados: { page: number; label: string; motivo: string }[] = [];
  const usados = new Map<string, number>();

  // Una sola pasada por el PDF para todas las páginas (antes: dos por página).
  const geo = await geometriaDelPdf(pdfBase);

  for (const { pagina: p, reglas, textos } of geo) {
    for (const r of reglas) {
      const { label, via } = etiquetaDe(r, textos);
      if (!label) {
        campos.push({ page: p, ...r, label: null, via: null, name: null });
        continue;
      }
      const base = `p${p}_${slug(label)}`;
      const n = (usados.get(base) ?? 0) + 1;
      usados.set(base, n);
      const name = n === 1 ? base : `${base}_${n}`;

      try {
        const field = form.createTextField(name);
        // addToPage ANTES que setFontSize: sin /DA, setFontSize truena con
        // "No /DA (default appearance) entry found for field".
        field.addToPage(pages[p - 1], {
          x: r.x + 1, y: r.y + 2, width: r.w - 2, height: 12, borderWidth: 0,
        });
        field.setFontSize(9);
        campos.push({ page: p, ...r, label, via, name });
      } catch (e) {
        // `createTextField` truena si el nombre ya existe (una etiqueta que slug
        // a un `_2` ya tomado, o un PDF que no era tan "plano" como se creía).
        // Se salta ESE campo; no se aborta el alta entera del formato.
        noCreados.push({ page: p, label, motivo: e instanceof Error ? e.message : String(e) });
        campos.push({ page: p, ...r, label, via, name: null });
      }
    }
  }

  return {
    pdf: await pdf.save(),
    campos,
    sinEtiqueta: campos.filter((c) => !c.name).length,
    noCreados,
  };
}

/** Arranque del diccionario: `slug(etiqueta) -> nombre real`. Se revisa a mano. */
export function diccionarioPropuesto(campos: CampoPropuesto[]): FieldDict {
  const dict: FieldDict = {};
  for (const c of campos) if (c.name) dict[c.name] = c.name;
  return dict;
}
