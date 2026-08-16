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
 * Resultado sobre el Allianz oficial (2026-08-14): **57 reglas → 52 campos de
 * texto**, 41 por la izquierda y 11 por arriba, **más 14 grupos de casillas con
 * 33 recuadros** deducidos de los `□` impresos. Verificado a ojo por el usuario.
 *
 * ⚠️ La primera corrida (2026-08-08) daba 61 → 56: 4 de esas "rayas" eran la
 * misma raya contada dos veces, y se creaban campos ENCIMADOS.
 *
 * ⚠️ El PDF que sale de aquí YA NO es el oficial byte a byte. Se marca con
 * `insurance_forms.fields_added_by_us = true`.
 */
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  type PDFPageLeaf,
} from 'pdf-lib';
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

/**
 * Un recuadro de opción DIBUJADO: el glifo `□` de la capa de texto.
 *
 * 🔴 En un formato plano las preguntas de opción no son campos, son un carácter
 * impreso. Medido en el Allianz oficial: **33 `□`** (U+25A1), cada uno con su
 * posición y su etiqueta impresa a la derecha — exactamente la misma estructura
 * que las 22 casillas de AXA, sólo que dibujada en vez de declarada.
 */
export interface Recuadro { x: number; y: number; w: number }

/** Lo que se saca de UNA pasada por el PDF: reglas, recuadros y textos. */
export interface GeometriaPagina {
  pagina: number;
  /** Ancho de la página en puntos: hace falta para saber dónde termina un hueco. */
  ancho: number;
  reglas: Regla[];
  recuadros: Recuadro[];
  textos: Texto[];
}

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
  const visibles = await visibilidadDeBloquesOc(pdfBase);
  const tarea = getDocument({ data: new Uint8Array(pdfBase) });
  const doc = await tarea.promise;
  try {
    const salida: GeometriaPagina[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      // `includeMarkedContent` para poder DESCARTAR lo que no se ve. Sin la
      // bandera, los marcadores no vienen y no hay forma de distinguirlo.
      const crudo = await page.getTextContent({ includeMarkedContent: true });
      const contenido = { items: soloVisible(crudo.items, visibles[p - 1] ?? []) };
      salida.push({
        pagina: p,
        ancho: page.getViewport({ scale: 1 }).width,
        reglas: reglasDeOperadores(await page.getOperatorList(), OPS),
        recuadros: recuadrosDeContenido(contenido),
        textos: textosDeContenido(contenido),
      });
    }
    return salida;
  } finally {
    await doc.destroy();
  }
}

/**
 * 🔴 Deja fuera el texto que está en una CAPA APAGADA.
 *
 * El GNP oficial es un archivo de preprensa con tres capas (`Frente`, `Reverso`,
 * `REGISTROS`) y su página 1 lleva dentro una copia COMPLETA e invisible del
 * arte de la página 2 — mismas cadenas, mismas coordenadas. Medido: 245 items
 * de texto de los que sólo 126 se ven.
 *
 * `getTextContent()` no sabe de visibilidad: devuelve las dos capas mezcladas.
 * Y como las etiquetas de esta funcionalidad se deducen por CERCANÍA, derivar
 * sobre esa mezcla produce rótulos tomados de un texto que el médico no tiene
 * delante — la falla que en esta carpeta ya tiene nombre: *un rótulo pobre se
 * ignora, uno FALSO se obedece*.
 *
 * ⚠️ Se emparejan por ORDEN: el n-ésimo `beginMarkedContentProps` con tag `OC`
 * es el n-ésimo `/OC /MCn BDC` del content stream. Los dos salen del MISMO
 * stream y en el mismo orden, así que la correspondencia se sostiene; lo que no
 * se puede es pedirle el id a pdf.js, que lo devuelve `null` en este archivo.
 */
function soloVisible(items: unknown[], visibilidad: boolean[]): unknown[] {
  // Sin capas, o con todas encendidas: no se filtra nada. ⚠️ **Allianz SÍ tiene
  // capas** (4 OCGs de Illustrator) — lo que no tiene es ninguna en `/OFF`, así
  // que pasa por aquí y sale intacto. AXA no tiene `/OCProperties`.
  if (visibilidad.length === 0 || visibilidad.every(Boolean)) return items;
  // 🔴 GUARDA: el emparejamiento es POSICIONAL, así que sólo vale si los dos
  // lados cuentan lo mismo. pdf.js emite bloques `/OC` que este lado no ve —los
  // que van dentro de un Form XObject, y los `/OC <</Type/OCMD …>> BDC` con el
  // diccionario en línea— y con un solo bloque de diferencia TODAS las banderas
  // se recorren: se tira texto visible o se conserva el oculto, en silencio y
  // produciendo justo las etiquetas falsas que esto existe para evitar.
  //
  // Si no cuadra se falla ABIERTO (no se filtra nada), que es como se comportaba
  // antes de que existiera el filtro: una hoja con etiquetas de más es peor que
  // una con etiquetas de otra página, pero mucho mejor que una con las
  // equivocadas y sin señal.
  const bloquesOc = items.filter(
    (it) =>
      (it as { type?: string }).type === 'beginMarkedContentProps' &&
      (it as { tag?: string }).tag === 'OC'
  ).length;
  if (bloquesOc !== visibilidad.length) return items;

  const salida: unknown[] = [];
  const pila: boolean[] = [];
  let siguiente = 0;
  for (const it of items) {
    const tipo = (it as { type?: string }).type;
    if (tipo === 'beginMarkedContentProps' || tipo === 'beginMarkedContent') {
      // Sólo los bloques de contenido OPCIONAL cuentan para el emparejamiento;
      // un `/Span BDC` cualquiera no consume una posición de la lista.
      const esOc = (it as { tag?: string }).tag === 'OC';
      pila.push(esOc ? (visibilidad[siguiente++] ?? true) : (pila[pila.length - 1] ?? true));
      continue;
    }
    if (tipo === 'endMarkedContent') { pila.pop(); continue; }
    if (pila.length > 0 && pila[pila.length - 1] === false) continue;
    salida.push(it);
  }
  return salida;
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

    // 🔴 Un Form XObject TAMBIÉN transforma, con su `/Matrix`, y pdf.js lo
    // emite como un operador aparte — no como `save` + `transform`. Ignorarlo
    // no sólo saca mal las reglas de dentro del XObject: deja la pila
    // DESBALANCEADA (su `End` haría un `restore` de más) y a partir de ahí toda
    // la página sale corrida. Allianz no lo trae y por eso no mordió.
    if (fn === OPS.paintFormXObjectBegin || fn === OPS.beginGroup) {
      pila.push([...ctm] as Matriz);
      // ⚠️ pdf.js manda la matriz como **Float32Array**, no como Array:
      // `Array.isArray()` da false y el transform no se aplicaría nunca —
      // quedaría arreglada la pila y roto justo lo que se venía a arreglar.
      const matriz = (args as unknown[] | undefined)?.[0] as ArrayLike<number> | undefined;
      if (matriz && matriz.length === 6 && typeof matriz[0] === 'number') {
        ctm = multiplicar(ctm, Array.from(matriz) as Matriz);
      }
      continue;
    }
    if (fn === OPS.paintFormXObjectEnd || fn === OPS.endGroup) {
      ctm = pila.pop() ?? [1, 0, 0, 1, 0, 0];
      continue;
    }

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
  //
  // 🔴 Antes se comparaban las ESQUINAS (`|Δy| <= 2 && |Δx| <= 3`) y se colaban
  // duplicados: las dos versiones de una raya no empiezan exactamente en el
  // mismo sitio. Medido en el Allianz oficial, 4 pares sobrevivían —
  // `CAUSA` (Δx=7), `Especifique` (Δx=4), `Antecedentes_Heredo-Familiares`
  // (Δy=4) e `Indique_motivo_de_hospitalizacion` (Δy=3)— y se creaban DOS
  // campos encimados sobre el mismo blanco. El de arriba tapa al de abajo: el
  // doctor escribe en uno, el PDF final imprime el otro vacío, y no hay ningún
  // aviso porque para el motor son dos campos perfectamente válidos.
  //
  // Lo correcto es comparar el TRASLAPE, no las esquinas: dos rayas que ocupan
  // el mismo renglón y se solapan casi por completo son la misma raya. Los
  // pares legítimos (el renglón de continuación de una respuesta larga) están
  // separados 21 pt o más, muy lejos de esta tolerancia.
  const TOLERANCIA_MISMA_RAYA = 6;
  const TRASLAPE_MINIMO = 0.7;
  const unicas: Regla[] = [];
  for (const r of salida.sort((a, b) => b.y - a.y || a.x - b.x)) {
    const gemela = unicas.findIndex((u) => {
      if (Math.abs(u.y - r.y) > TOLERANCIA_MISMA_RAYA) return false;
      const inicio = Math.max(u.x, r.x);
      const fin = Math.min(u.x + u.w, r.x + r.w);
      // 🔴 El denominador es la raya MÁS LARGA, no la más corta. Con la más
      // corta, una raya CONTENIDA en otra da 1.0 siempre, así que un blanco
      // chico dentro de un renglón largo (una casilla `No.` dentro de una fila
      // ancha) se fusionaría con él y desaparecería — y a diferencia de un
      // `createTextField` que revienta, esto no deja rastro en `noCreados`: el
      // reporte se ve limpio y a la hoja le falta un blanco.
      return Math.max(0, fin - inicio) / Math.max(u.w, r.w) > TRASLAPE_MINIMO;
    });
    if (gemela < 0) { unicas.push(r); continue; }
    // Se queda la MÁS ANCHA (cubre el blanco entero) y, a igual ancho, la de
    // más abajo: es la raya sobre la que de verdad se escribe.
    const u = unicas[gemela];
    if (r.w > u.w || (r.w === u.w && r.y < u.y)) unicas[gemela] = r;
  }
  return unicas;
}

/**
 * Las capas de contenido opcional del PDF y si están encendidas.
 *
 * Sólo para el reporte de alta: un formato con una capa APAGADA lleva texto que
 * existe en el archivo y no se ve, y eso cambia cómo hay que leer la hoja
 * (03-FORMATOS §3). Un PDF sin capas devuelve `[]`.
 */
export async function capasDelPdf(
  pdfBase: Uint8Array
): Promise<Array<{ nombre: string; visible: boolean }>> {
  try {
    const pdf = await PDFDocument.load(new Uint8Array(pdfBase), { updateMetadata: false });
    const ocProps = pdf.catalog.lookupMaybe(PDFName.of('OCProperties'), PDFDict);
    if (!ocProps) return [];
    const grupos = ocProps.lookupMaybe(PDFName.of('OCGs'), PDFArray);
    const d = ocProps.lookupMaybe(PDFName.of('D'), PDFDict);
    const baseApagado = d?.get(PDFName.of('BaseState'))?.toString() === '/OFF';
    const refs = (clave: string): Set<string> => {
      const arr = d?.lookupMaybe(PDFName.of(clave), PDFArray);
      const s = new Set<string>();
      if (!arr) return s;
      for (let i = 0; i < arr.size(); i++) {
        const r = arr.get(i);
        if (r instanceof PDFRef) s.add(r.toString());
      }
      return s;
    };
    const apagados = refs('OFF');
    const encendidos = refs('ON');

    const salida: Array<{ nombre: string; visible: boolean }> = [];
    for (let i = 0; i < (grupos?.size() ?? 0); i++) {
      const ref = grupos!.get(i);
      const dict = ref instanceof PDFRef ? pdf.context.lookup(ref) : ref;
      const nombre =
        dict instanceof PDFDict ? String(dict.get(PDFName.of('Name'))).replace(/^\(|\)$/g, '') : '?';
      const clave = ref instanceof PDFRef ? ref.toString() : '';
      const visible = apagados.has(clave) ? false : baseApagado ? encendidos.has(clave) : true;
      salida.push({ nombre, visible });
    }
    return salida;
  } catch {
    return [];
  }
}

/**
 * Por página y en el orden del content stream, si cada bloque `/OC … BDC` se ve.
 *
 * Un arreglo VACÍO para una página significa "no hay capas" — el caso de AXA y
 * de Allianz, donde nada se filtra y el comportamiento no cambia.
 *
 * La visibilidad sale del `/OCProperties /D` del catálogo: `/OFF` lista los
 * grupos apagados, y `/BaseState /OFF` invierte el default (entonces manda
 * `/ON`). Se resuelve con pdf-lib porque pdf.js no expone el id del grupo en el
 * texto extraído.
 */
async function visibilidadDeBloquesOc(pdfBase: Uint8Array): Promise<boolean[][]> {
  try {
    const pdf = await PDFDocument.load(new Uint8Array(pdfBase), { updateMetadata: false });
    const ocProps = pdf.catalog.lookupMaybe(PDFName.of('OCProperties'), PDFDict);
    if (!ocProps) return [];
    const d = ocProps.lookupMaybe(PDFName.of('D'), PDFDict);
    const baseApagado = d?.get(PDFName.of('BaseState'))?.toString() === '/OFF';

    const listado = (clave: string): Set<string> => {
      const arr = d?.lookupMaybe(PDFName.of(clave), PDFArray);
      const s = new Set<string>();
      if (!arr) return s;
      for (let i = 0; i < arr.size(); i++) {
        const ref = arr.get(i);
        if (ref instanceof PDFRef) s.add(ref.toString());
      }
      return s;
    };
    const apagados = listado('OFF');
    const encendidos = listado('ON');

    return pdf.getPages().map((page) => {
      const props = page.node.Resources()?.lookupMaybe(PDFName.of('Properties'), PDFDict);
      if (!props) return [];
      // `/MC0 -> ref del OCG`, para traducir el nombre que aparece en el stream.
      const refDe = new Map<string, string>();
      for (const clave of props.keys()) {
        const v = props.get(clave);
        if (v instanceof PDFRef) refDe.set(clave.asString(), v.toString());
      }
      const stream = contenidoDeLaPagina(pdf, page);
      const orden = [...stream.matchAll(/\/OC\s*(\/[^\s/[\]<>]+)\s*BDC/g)].map((m) => m[1]);
      return orden.map((nombre) => {
        const ref = refDe.get(nombre);
        if (!ref) return true;                        // no se pudo resolver: no se oculta nada
        if (apagados.has(ref)) return false;
        if (baseApagado) return encendidos.has(ref);
        return true;
      });
    });
  } catch {
    // Un PDF que no se deja inspeccionar no debe dejar sin etiquetas al formato:
    // se sigue como si no hubiera capas, que es lo que pasaba antes.
    return [];
  }
}

/** El content stream de una página, ya descomprimido. Puede venir en varios. */
function contenidoDeLaPagina(pdf: PDFDocument, page: { node: PDFPageLeaf }): string {
  const contents = page.node.get(PDFName.of('Contents'));
  const streams: PDFRawStream[] = [];
  const agregar = (o: unknown) => {
    const v = o instanceof PDFRef ? pdf.context.lookup(o) : o;
    if (v instanceof PDFRawStream) streams.push(v);
  };
  const resuelto = contents instanceof PDFRef ? pdf.context.lookup(contents) : contents;
  if (resuelto instanceof PDFArray) {
    for (let i = 0; i < resuelto.size(); i++) agregar(resuelto.get(i));
  } else {
    agregar(resuelto);
  }
  return streams
    .map((s) => {
      try { return Buffer.from(decodePDFRawStream(s).decode()).toString('latin1'); }
      catch { return ''; }
    })
    .join('\n');
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

/** Los recuadros `□` de una página, que `textosDeContenido` deja fuera a propósito. */
function recuadrosDeContenido(contenido: { items: unknown[] }): Recuadro[] {
  return contenido.items
    .filter((i): i is { str: string; transform: number[]; width: number } =>
      typeof i === 'object' && i !== null && 'str' in i &&
      typeof (i as { str: unknown }).str === 'string' &&
      (i as { str: string }).str.trim() === '□')
    .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width || 9 }));
}

/** Las guías impresas de una fecha: `DD` `MM` `AAAA`, o `Día` `Mes` `Año`. */
const GUIA_DE_FECHA_SUELTA = /^(DD|MM|AAAA|D[ií]a|Mes|A[ñn]o)$/i;

/** Un hueco deducido SIN raya: sólo por lo que dice la hoja alrededor. */
export interface HuecoDeducido { page: number; x: number; y: number; w: number; label: string | null }

/** Una fecha deducida de sus guías: no tiene raya debajo, sólo los rótulos. */
export type FechaPropuesta = HuecoDeducido;

/** El margen que se respeta al extender un hueco hasta el borde de la hoja. */
const MARGEN = 24;

/**
 * 🔴 Los IMPORTES tampoco tienen raya: los marca el `$` impreso.
 *
 * Medido en la p3 del Allianz oficial, bajo «Programación de Cirugía»:
 *
 * ```
 * [23]Cirujano $      [225]Ayudante $      [413]Anestesista $
 * ```
 *
 * Cero rayas en ese renglón, así que no se creaba ningún campo y el presupuesto
 * de honorarios —tres cantidades que la aseguradora usa para autorizar el
 * procedimiento— no se podía escribir. Lo reportó el usuario probando la hoja.
 *
 * El hueco va DESPUÉS del `$` y llega hasta donde empieza la siguiente etiqueta
 * del renglón, o hasta el margen si es la última.
 */
export function importesDibujados(pagina: GeometriaPagina): HuecoDeducido[] {
  const huecos: HuecoDeducido[] = [];
  for (const t of pagina.textos) {
    if (!/\$\s*$/.test(t.s)) continue;
    // 🔴 Una etiqueta tiene LETRAS. Sin esto, un monto ya impreso en la hoja
    // (`1,500 $`) se lee como etiqueta y se le pone un campo encima.
    const etiqueta = t.s.replace(/\s*\$\s*$/, '').trim();
    if (etiqueta !== '' && !/\p{L}/u.test(etiqueta)) continue;

    const inicio = t.x + t.w + 2;
    // 🔴 El hueco termina en lo siguiente del renglón, sea TEXTO o RECUADRO.
    // `textosDeContenido` excluye los `□` a propósito, así que mirando sólo el
    // texto el importe se estiraba POR ENCIMA de una casilla y la tapaba: el
    // doctor ya no puede marcarla, y nada lo reporta. Medido: 9 pt de traslape
    // con una casilla a 200 pt.
    const topes = [
      ...pagina.textos.filter((o) => o !== t && Math.abs(o.y - t.y) <= 5 && o.x > t.x + t.w).map((o) => o.x),
      ...pagina.recuadros.filter((r) => Math.abs(r.y - t.y) <= 5 && r.x > t.x + t.w).map((r) => r.x),
    ].sort((a, b) => a - b);
    const fin = topes.length > 0 ? topes[0] - 4 : pagina.ancho - MARGEN;
    if (fin - inicio < 20) continue;   // no cabe nada: no es un hueco de captura
    huecos.push({
      page: pagina.pagina,
      x: inicio,
      y: t.y,
      w: fin - inicio,
      label: etiqueta || null,
    });
  }
  return huecos;
}

/**
 * 🔴 Las fechas de un formato plano NO se detectan por la raya, porque **no
 * tienen raya**.
 *
 * Medido en el Allianz oficial: **18 fechas** —toda la rejilla de antecedentes
 * patológicos (cáncer, obesidad, diabetes, cardíacos…), las de hospitalización
 * y las de tratamiento— y en esa zona de la hoja hay exactamente **2** rayas.
 * Las celdas están dibujadas como tabla, y lo único que dice dónde va la fecha
 * son las guías `DD MM AAAA` impresas dentro.
 *
 * Sin esto el doctor abre la hoja y **no puede escribir NI UNA fecha**: no hay
 * campo que clicar y el pre-llenado no tiene dónde escribir. Es exactamente lo
 * que reportó el usuario al probar Allianz en la app.
 *
 * Una corrida de guías contiguas = UNA fecha, y el campo cubre la corrida
 * entera — igual que en AXA, donde `Día_4` es una caja ancha para la fecha
 * completa con las tres guías impresas encima.
 */
export function fechasDibujadas(pagina: GeometriaPagina): FechaPropuesta[] {
  const guias = pagina.textos.filter((t) => GUIA_DE_FECHA_SUELTA.test(t.s.trim()));
  if (guias.length === 0) return [];

  const filas = new Map<number, Texto[]>();
  for (const g of guias) {
    const k = [...filas.keys()].find((k) => Math.abs(k - g.y) <= 5) ?? g.y;
    filas.set(k, [...(filas.get(k) ?? []), g]);
  }

  const fechas: FechaPropuesta[] = [];
  for (const [y, fila] of filas) {
    const orden = fila.sort((a, b) => a.x - b.x);
    // Guías contiguas = la misma fecha. Un hueco grande separa dos columnas de
    // la rejilla: `DD MM AAAA … DD MM AAAA` son DOS fechas, no una.
    const corridas: Texto[][] = [];
    for (const g of orden) {
      const ultima = corridas[corridas.length - 1];
      const previa = ultima?.[ultima.length - 1];
      if (previa && g.x - (previa.x + previa.w) < 22) ultima.push(g);
      else corridas.push([g]);
    }

    for (const c of corridas) {
      // 🔴 Una guía SOLA no es una fecha. El campo se dibuja ENCIMA de las
      // guías (es lo correcto para `DD MM AAAA`: la caja las cubre), así que
      // una palabra suelta —`Mes` como pregunta de verdad, o un `AAAA` que es
      // el encabezado de una columna— generaba un campo de 30 pt tapando el
      // texto impreso. Las 18 fechas de Allianz son corridas de TRES.
      if (c.length < 2) continue;

      const x = c[0].x;
      const w = c[c.length - 1].x + c[c.length - 1].w - x;
      // 🔴 La etiqueta ignora las OTRAS guías: si no, la fecha de la segunda
      // columna se llamaría "AAAA" —la última guía de la primera— y las nueve
      // de la rejilla saldrían con el mismo nombre.
      const izquierda = pagina.textos
        .filter((t) => !GUIA_DE_FECHA_SUELTA.test(t.s.trim()) && Math.abs(t.y - y) <= 6 && t.x + t.w <= x + 4)
        .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
      // Si no hay nada a la izquierda, el encabezado de su columna.
      const arriba = izquierda
        ? undefined
        : pagina.textos
            .filter((t) => !GUIA_DE_FECHA_SUELTA.test(t.s.trim()) && t.y > y && t.y - y < 40 &&
              t.x < x + w && t.x + t.w > x)
            .sort((a, b) => a.y - b.y)[0];
      fechas.push({ page: pagina.pagina, x, y, w, label: (izquierda ?? arriba)?.s ?? null });
    }
  }
  return fechas;
}

/** Una opción de un grupo dibujado, con dónde va su recuadro. */
export interface OpcionDibujada { onState: string; etiqueta: string; x: number; y: number; w: number }

/** Un grupo de opciones EXCLUYENTES deducido de la hoja. */
export interface GrupoDibujado {
  page: number;
  nombre: string;
  pregunta: string | null;
  opciones: OpcionDibujada[];
}

/** `Sí`/`No` — etiquetas que no nombran a su grupo (misma idea que en el catálogo del agente). */
const OPCION_GENERICA = /^(s[ií]|no)$/i;

/**
 * Agrupa los `□` de una hoja en preguntas de opciones excluyentes.
 *
 * 🔴 El corte NO es por renglón. Medido en Allianz, la fila `y=628` trae DOS
 * preguntas juntas:
 *
 *   «El padecimiento ocasionó u ocasionará incapacidad?»  □Si □No  □Parcial □Total
 *
 * Meterlas en un grupo haría que marcar «Parcial» DESMARCARA «Si» — el PDF
 * guarda un valor por campo. La regla que separa bien las 13 filas: las
 * genéricas (`Sí`/`No`) van juntas y las que se explican solas van juntas; el
 * corte está donde cambia la clase.
 *
 * La pregunta es el texto a la IZQUIERDA del primer recuadro de la fila, y la
 * heredan los dos grupos: «incapacidad» aplica igual a `Si|No` que a
 * `Parcial|Total`, y las opciones ya los distinguen.
 */
export function casillasDibujadas(pagina: GeometriaPagina): GrupoDibujado[] {
  const filas = new Map<number, Recuadro[]>();
  for (const r of pagina.recuadros) {
    const clave = [...filas.keys()].find((k) => Math.abs(k - r.y) <= 5) ?? r.y;
    filas.set(clave, [...(filas.get(clave) ?? []), r]);
  }

  const grupos: GrupoDibujado[] = [];

  for (const [y, recuadros] of filas) {
    const enOrden = recuadros.sort((a, b) => a.x - b.x);

    // La etiqueta de cada recuadro: el texto que EMPIEZA justo a su derecha.
    const etiquetados = enOrden.map((r) => {
      const t = pagina.textos
        .filter((t) => Math.abs(t.y - y) <= 5 && t.x >= r.x + r.w - 2 && t.x <= r.x + r.w + 40)
        .sort((a, b) => a.x - b.x)[0];
      return { recuadro: r, etiqueta: t?.s ?? '' };
    });

    // La pregunta de la FILA: lo que hay a la izquierda del primer recuadro.
    const primero = enOrden[0];
    const pregunta = pagina.textos
      .filter((t) => Math.abs(t.y - y) <= 5 && t.x + t.w <= primero.x + 4)
      .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0]?.s ?? null;

    // El corte: cambia la clase de etiqueta ⇒ empieza otro grupo.
    const tandas: Array<typeof etiquetados> = [];
    for (const e of etiquetados) {
      const ultima = tandas[tandas.length - 1];
      const generica = OPCION_GENERICA.test(e.etiqueta);
      const mismaClase = ultima && OPCION_GENERICA.test(ultima[ultima.length - 1].etiqueta) === generica;
      if (mismaClase) ultima.push(e);
      else tandas.push([e]);
    }

    for (const tanda of tandas) {
      // Sin etiqueta no se puede nombrar la opción, y un on-state inventado
      // marcaría un recuadro que nadie eligió. Se descarta la tanda entera.
      if (tanda.some((t) => t.etiqueta === '')) continue;

      // 🔴 El nombre va SIN desambiguar. Quien crea los campos lleva un contador
      // ÚNICO para casillas y textos, y desambiguar aquí también hacía que dos
      // contadores se pisaran: si una raya ya tomó `base`, el grupo A pasa a
      // `base_2` y el grupo B —que aquí ya se llamaba `base_2`— choca con él.
      // `createCheckBox` truena y una pregunta entera de la hoja se queda sin
      // recuadros que marcar.
      const nombre = `p${pagina.pagina}_${slug(pregunta ?? tanda[0].etiqueta)}`;

      // 🔴 Dos opciones del MISMO grupo no pueden compartir on-state. El PDF
      // guarda UN valor por campo, así que dos recuadros con la misma clave
      // `/N` se encienden JUNTOS: la hoja afirmaría dos respuestas a una
      // pregunta excluyente. Pasa por dos caminos reales — una fila con dos
      // preguntas de Sí/No (todas genéricas, no las corta la clase), y dos
      // etiquetas que coinciden en los primeros 20 caracteres del slug, que en
      // esta misma hoja ya se truncan (`Programacion_de_Ciru`).
      const vistos = new Map<string, number>();
      const opciones = tanda.map((t) => {
        const base = slug(t.etiqueta).slice(0, 18) || 'On';
        const n = (vistos.get(base) ?? 0) + 1;
        vistos.set(base, n);
        return {
          // El on-state es un token interno: sin acentos ni espacios porque es
          // un /Name del PDF. Lo que ve el modelo es la ETIQUETA.
          onState: n === 1 ? base : `${base}_${n}`,
          etiqueta: t.etiqueta,
          x: t.recuadro.x,
          y: t.recuadro.y,
          w: t.recuadro.w,
        };
      });

      grupos.push({ page: pagina.pagina, nombre, pregunta, opciones });
    }
  }
  return grupos;
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
  /**
   * La etiqueta COMO SE LE ENSEÑA A UN HUMANO (y al modelo), que no es el
   * nombre del campo.
   *
   * 🔴 En un formato plano el nombre lo inventamos nosotros a partir del texto
   * vecino, y a veces ese texto no basta: `¿Cuál?`, `Especifique`, `AAAA` o
   * `y cantidad)` no dicen nada fuera de su renglón. Medido en Allianz: de 73
   * campos, **61 llegaban al asistente con el nombre crudo** (`campo:p1_AAAA`)
   * como única pista.
   *
   * Se antepone la pregunta que manda en el renglón —el texto más a la
   * izquierda— así que `¿Cuál?` se convierte en
   * *"Referido por otro médico o unidad: — ¿Cuál?"*. **No se adivina nada**: es
   * texto impreso en la hoja, el mismo del que salió el nombre.
   */
  etiquetaLarga: string | null;
}

/** Etiquetas que no significan nada fuera de su renglón. */
const ETIQUETA_GENERICA =
  /^(¿?cu[áa]l\??:?|especifique:?|otros?:?|otro ?\(s\):?|aaaa|dd|mm|causa|padecimiento:?|y cantidad\)?|s[ií]:?|no:?|\d+)$/i;

/**
 * La etiqueta legible de un hueco: si la suya no dice nada por sí sola, se le
 * antepone la pregunta que manda en el renglón.
 */
function etiquetaLargaDe(label: string | null, x: number, y: number, textos: Texto[]): string | null {
  if (!label) return label;
  if (!ETIQUETA_GENERICA.test(label.trim())) return label;

  // Candidatos a "pregunta que manda en el renglón": lo que hay a la izquierda
  // que no sea una guía de fecha, ni una opción genérica, ni la etiqueta misma.
  const candidatos = textos
    .filter((t) => {
      if (Math.abs(t.y - y) > 6) return false;
      if (t.x + t.w > x + 4) return false;
      const s = t.s.trim();
      return s !== label.trim() && s !== '' &&
        !GUIA_DE_FECHA_SUELTA.test(s) && !ETIQUETA_GENERICA.test(s);
    })
    .sort((a, b) => a.x - b.x);

  // 🔴 SÓLO se antepone si el renglón tiene UNA pregunta. Con dos o más, el
  //    renglón es una REJILLA de columnas y el texto de más a la izquierda es
  //    el de OTRA columna.
  //
  //    Medido en el Allianz real, fila y≈351:
  //      [24]Diabetes Mellitus [DD MM AAAA]  [231]Hipertensivos [DD MM AAAA]  [429]____
  //    El hueco de x=429 está en la mitad derecha y se rotulaba
  //    **"Diabetes Mellitus — AAAA"**: le decía al modelo que escribiera el año
  //    de la diabetes en el blanco de al lado de hipertensivos. Un rótulo FALSO
  //    se obedece; uno pobre se ignora. Con dos candidatos no se inventa nada y
  //    se deja la etiqueta pelona, que es honesta.
  if (candidatos.length !== 1) return label;
  return `${candidatos[0].s} — ${label}`;
}

export interface ResultadoAltaFormato {
  /** El PDF con los campos puestos. Este es el que se guarda como base. */
  pdf: Uint8Array;
  /** Propuesta para revisión humana: no todos los nombres salen bien. */
  campos: CampoPropuesto[];
  sinEtiqueta: number;
  /** Reglas que no se pudieron convertir en campo (nombre repetido, etc.). */
  noCreados: { page: number; label: string; motivo: string }[];
  /** Las fechas deducidas de sus guías impresas (no tienen raya). */
  fechas: FechaPropuesta[];
  /** Los importes deducidos del `$` impreso (tampoco tienen raya). */
  importes: HuecoDeducido[];
  /**
   * `nombre del campo -> lo que dice la HOJA`, para que el asistente no reciba
   * `p1_AAAA` como etiqueta. Se arma aquí porque es el único sitio donde se
   * conocen a la vez el nombre inventado y el texto impreso del que salió.
   */
  etiquetas: Record<string, string>;
  /** Los grupos de opciones que se dedujeron de los `□` impresos. */
  casillas: GrupoDibujado[];
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
  const etiquetas: Record<string, string> = {};
  const noCreados: { page: number; label: string; motivo: string }[] = [];
  const usados = new Map<string, number>();

  // Una sola pasada por el PDF para todas las páginas (antes: dos por página).
  const geo = await geometriaDelPdf(pdfBase);

  for (const { pagina: p, reglas, textos } of geo) {
    for (const r of reglas) {
      const { label, via } = etiquetaDe(r, textos);
      if (!label) {
        campos.push({ page: p, ...r, label: null, via: null, name: null, etiquetaLarga: null });
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
        const larga = etiquetaLargaDe(label, r.x, r.y, textos);
        if (larga) etiquetas[name] = larga;
        campos.push({ page: p, ...r, label, via, name, etiquetaLarga: larga });
      } catch (e) {
        // `createTextField` truena si el nombre ya existe (una etiqueta que slug
        // a un `_2` ya tomado, o un PDF que no era tan "plano" como se creía).
        // Se salta ESE campo; no se aborta el alta entera del formato.
        noCreados.push({ page: p, label, motivo: e instanceof Error ? e.message : String(e) });
        campos.push({ page: p, ...r, label, via, name: null, etiquetaLarga: etiquetaLargaDe(label, r.x, r.y, textos) });
      }
    }
  }

  // ── Las FECHAS: las guías `DD MM AAAA` impresas, que no traen raya ────────
  const fechas: FechaPropuesta[] = [];
  for (const geoPagina of geo) {
    for (const f of fechasDibujadas(geoPagina)) {
      // Si una raya ya cubre ese hueco (AXA-style: caja ancha CON las guías
      // encima), no se duplica el campo.
      const yaHay = campos.some(
        (c) => c.name && c.page === f.page && Math.abs(c.y - f.y) <= 8 &&
          c.x < f.x + f.w && c.x + c.w > f.x
      );
      if (yaHay) continue;

      // Si la etiqueta ya dice "Fecha de …", no se le antepone otra:
      // `Fecha_Fecha_de_ingreso` se lee peor y no dice nada de más.
      const etiqueta = f.label ? slug(f.label) : '';
      const base = /^fecha/i.test(etiqueta)
        ? `p${f.page}_${etiqueta}`
        : `p${f.page}_Fecha${etiqueta ? `_${etiqueta}` : ''}`;
      const n = (usados.get(base) ?? 0) + 1;
      usados.set(base, n);
      const name = n === 1 ? base : `${base}_${n}`;
      try {
        const field = form.createTextField(name);
        field.addToPage(pages[f.page - 1], {
          x: f.x, y: f.y - 2, width: f.w, height: 11, borderWidth: 0,
        });
        field.setFontSize(8);
        fechas.push({ ...f, label: name });
        // Si la etiqueta impresa ya dice "Fecha de …", no se prefija otra vez.
        etiquetas[name] = !f.label ? 'Fecha'
          : /^fecha/i.test(f.label) ? f.label
          : `Fecha — ${f.label}`;
      } catch (e) {
        noCreados.push({
          page: f.page,
          label: `fecha «${f.label ?? name}»`,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // ── Los IMPORTES: el `$` impreso marca dónde va la cantidad ───────────────
  const importes: HuecoDeducido[] = [];
  for (const geoPagina of geo) {
    for (const h of importesDibujados(geoPagina)) {
      const yaHay = campos.some(
        (c) => c.name && c.page === h.page && Math.abs(c.y - h.y) <= 8 &&
          c.x < h.x + h.w && c.x + c.w > h.x
      );
      if (yaHay) continue;

      const base = `p${h.page}_Importe${h.label ? `_${slug(h.label)}` : ''}`;
      const n = (usados.get(base) ?? 0) + 1;
      usados.set(base, n);
      const name = n === 1 ? base : `${base}_${n}`;
      try {
        const field = form.createTextField(name);
        field.addToPage(pages[h.page - 1], {
          x: h.x, y: h.y - 2, width: h.w, height: 11, borderWidth: 0,
        });
        field.setFontSize(8);
        importes.push({ ...h, label: name });
        etiquetas[name] = h.label ? `Importe — ${h.label}` : 'Importe';
      } catch (e) {
        noCreados.push({
          page: h.page,
          label: `importe «${h.label ?? name}»`,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // ── Las casillas: los `□` impresos se vuelven grupos de verdad ────────────
  //
  // 🔴 Se fabrica la MISMA forma que trae AXA —un campo, N recuadros, cada uno
  // con SU on-state— porque así el resto del motor (geometría, etiquetas,
  // render, el catálogo del agente) funciona sin tocar una línea. pdf-lib crea
  // todos los recuadros con el mismo on-state (`/Yes`), que es exactamente el
  // bug que hacía que marcar una opción marcara a sus hermanas, así que hay que
  // renombrarlos uno por uno.
  const casillas: GrupoDibujado[] = [];
  for (const geoPagina of geo) {
    for (const propuesto of casillasDibujadas(geoPagina)) {
      // 🔴 El nombre se decide contra el MISMO contador que los campos de
      // texto. Una pregunta con opciones suele traer además una raya en el
      // mismo renglón («¿Hubo complicaciones? □Si □No ____»), y las dos salen
      // con el mismo nombre derivado: `createCheckBox` reventaba por nombre
      // repetido y el grupo desaparecía. Con el `catch` de abajo mudo, eso se
      // veía como "29 de 33 recuadros" y nada decía por qué.
      const n = (usados.get(propuesto.nombre) ?? 0) + 1;
      usados.set(propuesto.nombre, n);
      const grupo = n === 1 ? propuesto : { ...propuesto, nombre: `${propuesto.nombre}_${n}` };
      try {
        const cb = form.createCheckBox(grupo.nombre);
        for (const o of grupo.opciones) {
          cb.addToPage(pages[grupo.page - 1], {
            x: o.x, y: o.y - 1, width: Math.max(8, o.w), height: Math.max(8, o.w), borderWidth: 0,
          });
        }
        const widgets = cb.acroField.getWidgets();
        widgets.forEach((w, i) => {
          const destino = grupo.opciones[i]?.onState;
          if (!destino) return;
          const ap = w.dict.get(PDFName.of('AP')) as PDFDict | undefined;
          const normal = ap?.get(PDFName.of('N')) as PDFDict | undefined;
          if (!normal) return;
          const actual = normal.keys().map((k) => k.asString().replace(/^\//, '')).find((k) => k !== 'Off');
          if (!actual) return;
          const stream = normal.get(PDFName.of(actual));
          if (stream) normal.set(PDFName.of(destino), stream);
          if (actual !== destino) normal.delete(PDFName.of(actual));
          // Todas apagadas: lo que trae marcado de fábrica una hoja es una
          // afirmación que nadie eligió (la lección de las 9 de AXA).
          w.setAppearanceState(PDFName.of('Off'));
        });
        casillas.push(grupo);
      } catch (e) {
        // Un grupo que no se pueda crear no tumba el alta del formato, pero
        // TAMPOCO se calla: un grupo perdido en silencio es una pregunta que la
        // hoja hace y el informe no puede contestar.
        noCreados.push({
          page: grupo.page,
          label: `casillas «${grupo.pregunta ?? grupo.nombre}»`,
          motivo: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return {
    pdf: await pdf.save(),
    campos,
    fechas,
    importes,
    casillas,
    etiquetas,
    // Se cuentan las reglas SIN ETIQUETA, no las que no tienen `name`: un campo
    // que reventó en `createTextField` entra con `name: null` pero CON label, y
    // contarlo aquí infla el número que la pantalla de revisión usa para decir
    // cuántas reglas hay que etiquetar a mano. Los que reventaron ya van en
    // `noCreados`.
    sinEtiqueta: campos.filter((c) => !c.label).length,
    noCreados,
  };
}

/** Arranque del diccionario: `slug(etiqueta) -> nombre real`. Se revisa a mano. */
export function diccionarioPropuesto(campos: CampoPropuesto[]): FieldDict {
  const dict: FieldDict = {};
  for (const c of campos) if (c.name) dict[c.name] = c.name;
  return dict;
}
