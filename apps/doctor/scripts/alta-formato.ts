/**
 * INFORME MÉDICO — dar de alta el formato de una aseguradora nueva.
 *
 * AXA se hizo a mano, con scripts de un solo uso que se tiraron al cerrar cada
 * sesión. Funciona para UNA aseguradora y es carísimo para la sexta: cada
 * formato nuevo vuelve a derivar lo mismo desde cero, incluidas las trampas que
 * ya mordieron una vez y que nadie se va a acordar de buscar.
 *
 * Esto es esa derivación, en el repo y repetible. NO decide nada: mide, propone
 * y AVISA. Quien da de alta el formato corrige la propuesta a mano —es un
 * documento médico-legal y una equivalencia inventada se ve igual de bien que
 * una correcta (04-MAPEO §1).
 *
 * ─── Uso ──────────────────────────────────────────────────────────────────────
 *   npx tsx scripts/alta-formato.ts inspeccionar <ruta.pdf>
 *   npx tsx scripts/alta-formato.ts campos <plano.pdf> <salida.pdf>
 *   npx tsx scripts/alta-formato.ts sql "<insurer>|<name>|<version>"
 *
 *   inspeccionar  Mide el PDF y saca el reporte completo: identidad, campos,
 *                 casillas, TRAMPAS y una propuesta de diccionario.
 *   campos        Sólo para un PDF PLANO (0 campos, caso Allianz): le pone los
 *                 campos por vecindad y guarda el PDF que será la base.
 *                 ⚠️ Ese archivo YA NO es el oficial byte a byte ⇒
 *                 `camposPropios: true` y `fields_added_by_us = TRUE`.
 *   sql           Genera el INSERT de `insurance_forms` DESDE el diccionario del
 *                 repo. Nunca se teclea: 60 entradas y una errata silenciosa
 *                 deja campos sin llenar en un PDF que se ve bien.
 *
 * ─── Las cuatro cosas que hay que tocar para agregar una aseguradora ─────────
 *   1. el PDF oficial            → apps/doctor/public/formatos/<archivo>.pdf
 *   2. el diccionario tonto      → src/lib/informe-medico/dicts/<slug>.ts
 *   3. una entrada en FORMATOS   → src/lib/informe-medico/formatos/index.ts
 *   4. una fila en la BD         → prisma db execute (JAMÁS `db push`)
 *
 * Todo lo demás —pre-llenado, canónico, render, flatten, visor, chat, casillas—
 * ya es agnóstico de la aseguradora y no se toca.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { CAMPOS_CANONICOS, type CampoCanonico } from '../src/lib/informe-medico/canonical';
import { capacidadDeCaja } from '../src/lib/informe-medico/capacidad';
import { caracteresNoImprimibles } from '../src/lib/informe-medico/winansi';
import { geometriaDelFormato } from '../src/lib/informe-medico/geometria-formato';
import {
  casillasParaElAgente,
  etiquetasDeLaHoja,
  type GrupoCasillas,
} from '../src/lib/informe-medico/etiquetas-de-la-hoja';
import { agregarCamposAFormatoPlano } from '../src/lib/informe-medico/add-fields';
import { claveFormato, FORMATOS } from '../src/lib/informe-medico/formatos';
import { nombrePdfDeClaveCruda, esClaveCruda } from '../src/lib/informe-medico/types';

// ─────────────────────────────────────────────────────────────────────────────
// Presentación
// ─────────────────────────────────────────────────────────────────────────────

const linea = (s = '') => console.log(s);
function titulo(t: string) {
  linea('');
  linea(`── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`);
}

/** Un aviso que hay que LEER. Se cuentan al final para que no se pierdan. */
const avisos: string[] = [];
function avisar(s: string) {
  avisos.push(s);
  linea(`  🔴 ${s}`);
}
function ojo(s: string) {
  linea(`  ⚠️  ${s}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalización para empatar nombres — la MISMA regla que usa el servidor al
// resolver la etiqueta de una casilla, para que la propuesta no empate cosas
// que en producción no empatarían.
// ─────────────────────────────────────────────────────────────────────────────

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    // ⚠️ El prefijo `p1_`, `p2_`… lo ponemos NOSOTROS al ponerle campos a un
    // formato plano (`add-fields.ts`), no la aseguradora. Si no se quita,
    // `p1_Edad` no empata con `edad` y la propuesta se queda casi vacía justo en
    // los formatos donde más falta hace. Medido en Allianz: 6 conceptos con el
    // prefijo, 17 sin él.
    .replace(/^p\d+ /, '');
}

/**
 * Cómo se llama cada concepto canónico en las hojas reales.
 *
 * ⚠️ Esto es para PROPONER, no para decidir. Las aseguradoras le dicen `Talla` o
 * `Estatura` a lo mismo, pero también le dicen `Diagnóstico` a cosas que NO son
 * lo mismo (la tabla de 10 renglones de AXA contra el `Diagnóstico Definitivo`
 * único de GNP — 04-MAPEO §1). El script propone y el humano decide.
 */
const SINONIMOS: Partial<Record<CampoCanonico, string[]>> = {
  'paciente.apellidoPaterno': ['apellido paterno', 'primer apellido'],
  'paciente.apellidoMaterno': ['apellido materno', 'segundo apellido'],
  'paciente.nombres': ['nombres', 'nombre s', 'nombre del paciente', 'nombre del asegurado'],
  'paciente.nombreCompleto': ['nombre completo', 'nombre completo del paciente'],
  'paciente.fechaNacimiento': ['fecha de nacimiento', 'nacimiento', 'f de nacimiento'],
  'paciente.edad': ['edad', 'edad anos', 'anos'],
  'paciente.sexo': ['sexo', 'genero'],
  'paciente.telefono': ['telefono del paciente', 'telefono paciente', 'tel paciente'],
  'paciente.email': ['correo del paciente', 'email del paciente', 'e mail paciente'],
  'paciente.domicilio': ['domicilio del paciente', 'direccion del paciente'],
  // 🔴 `rfc` a secas NO va aquí. En Allianz `p2_RFC` está en el bloque del
  //    MÉDICO, pegado a `p2_Cedula_Profesional`: empataba exacto y proponía
  //    imprimir el RFC del paciente en la casilla del doctor, sin marcarlo
  //    siquiera como empate débil. Un campo ambiguo entre dos personas se deja
  //    CRUDO y lo decide quien mire la hoja.
  'paciente.rfc': ['rfc del paciente'],
  'paciente.numeroPoliza': ['numero de poliza', 'no de poliza', 'poliza', 'num poliza'],
  'paciente.polizaAseguradora': ['aseguradora', 'compania aseguradora'],
  'antecedentes.patologicos': ['antecedentes patologicos', 'antecedentes personales patologicos'],
  'antecedentes.alergias': ['alergias', 'alergia'],
  'antecedentes.medicacionHabitual': ['medicacion habitual', 'medicamentos habituales'],
  'paciente.tipoSangre': ['tipo de sangre', 'grupo sanguineo'],
  'consulta.fecha': ['fecha de la consulta', 'fecha de consulta'],
  'consulta.motivo': ['motivo de consulta', 'motivo de la consulta'],
  'vitales.talla': ['talla', 'estatura'],
  'vitales.peso': ['peso'],
  'vitales.tensionArterial': ['tension arterial', 'ta', 'presion arterial'],
  'vitales.frecuenciaCardiaca': ['frecuencia cardiaca', 'fc', 'pulso'],
  'vitales.temperatura': ['temperatura', 'temp'],
  'vitales.saturacionOxigeno': ['saturacion de oxigeno', 'saturacion', 'spo2'],
  'clinico.padecimientoActual': ['padecimiento actual', 'evolucion del padecimiento'],
  'clinico.exploracionFisica': ['exploracion fisica', 'datos relevantes de exploracion fisica'],
  'clinico.diagnostico': ['diagnostico', 'diagnostico definitivo', 'impresion diagnostica'],
  'clinico.tratamiento': ['tratamiento', 'tratamiento propuesto', 'plan de tratamiento'],
  'medico.nombre': ['nombre del medico', 'medico tratante', 'nombre del medico tratante'],
  'medico.especialidad': ['especialidad'],
  'medico.cedulaProfesional': ['cedula profesional', 'cedula'],
  'medico.cedulaEspecialidad': ['cedula de especialidad', 'cedula especialidad'],
  // 🔴 Igual que `rfc`: `telefono`, `email` y `domicilio` A SECAS son ambiguos
  //    ENTRE DOS PERSONAS, y son peores que el RFC porque empatan EXACTO — la
  //    propuesta salía sin ninguna advertencia. En una hoja con `Teléfono` en
  //    el encabezado del paciente, la herramienta proponía imprimir el del
  //    MÉDICO en la casilla del paciente. Allianz se salvó de casualidad: sus
  //    tres campos viven en el bloque del médico.
  //    Un campo ambiguo entre dos personas se queda CRUDO y lo decide quien
  //    mire la hoja impresa.
  'medico.telefono': ['telefono del medico', 'telefono medico'],
  'medico.email': ['correo del medico', 'e mail del medico'],
  'medico.domicilio': ['domicilio del consultorio', 'direccion del consultorio'],
  'informe.lugar': ['lugar'],
  'informe.fecha': ['fecha'],
  'informe.lugarYFecha': ['lugar y fecha'],
};

/**
 * Un empate PARCIAL (prefijo o "contiene") sólo cuenta si el término tiene
 * sustancia.
 *
 * 🔴 El guard estaba sólo en `includes`, y `startsWith` se colaba: `fecha`
 * (5 letras) empataba con `p3_Fecha_exacta_de_la_cirugia_ddmmaa` y la
 * herramienta proponía escribir la fecha del INFORME en la casilla de la fecha
 * de la CIRUGÍA, con un `⚠️ empate débil` como toda advertencia. Es justo la
 * confusión que 06-AGENTE §11 documenta: *la fecha de un documento no es la
 * fecha de lo que cuenta.*
 */
const LARGO_MINIMO_PARCIAL = 8;

interface Candidato {
  clave: CampoCanonico;
  nombrePdf: string;
  /** 3 = el nombre ES la etiqueta · 2 = empieza igual · 1 = la contiene. */
  fuerza: number;
  termino: string;
}

/**
 * Empata campos del PDF contra el canónico.
 *
 * 🔴 Deliberadamente TONTO y conservador. Un empate por "contiene" sobre un
 * término corto (`edad`, `ta`, `rfc`) engancha cualquier cosa, así que sólo
 * cuenta cuando el término tiene sustancia. Y cuando hay más de un candidato NO
 * se elige: se listan los dos. Elegir el equivocado en silencio es exactamente
 * el error que este documento no puede permitirse.
 */
function proponerDiccionario(nombresPdf: string[]): {
  propuesta: Map<CampoCanonico, Candidato[]>;
  sinConcepto: string[];
} {
  const propuesta = new Map<CampoCanonico, Candidato[]>();
  const usados = new Set<string>();

  for (const [claveStr, sinonimos] of Object.entries(SINONIMOS)) {
    const clave = claveStr as CampoCanonico;
    const terminos = [normalizar(CAMPOS_CANONICOS[clave]), ...(sinonimos ?? []).map(normalizar)];
    const encontrados: Candidato[] = [];

    for (const nombrePdf of nombresPdf) {
      const n = normalizar(nombrePdf);
      if (n === '') continue;
      let mejor: Candidato | null = null;
      for (const t of terminos) {
        if (t === '') continue;
        let fuerza = 0;
        // 🔴 La igualdad EXACTA es el único empate que no necesita que el
        //    término tenga sustancia: `ta` == `ta` es el campo, no un prefijo
        //    de otro. Los empates PARCIALES sí la necesitan, los dos.
        if (n === t) fuerza = 3;
        else if (t.length >= LARGO_MINIMO_PARCIAL && n.startsWith(`${t} `)) fuerza = 2;
        else if (t.length >= LARGO_MINIMO_PARCIAL && n.includes(t)) fuerza = 1;
        if (fuerza > (mejor?.fuerza ?? 0)) mejor = { clave, nombrePdf, fuerza, termino: t };
      }
      if (mejor) encontrados.push(mejor);
    }

    if (encontrados.length === 0) continue;
    encontrados.sort((a, b) => b.fuerza - a.fuerza);
    // Sólo se conservan los del mejor nivel: si hay un empate exacto, los
    // "contiene" de más son ruido.
    const tope = encontrados[0].fuerza;
    const finalistas = encontrados.filter((c) => c.fuerza === tope);
    propuesta.set(clave, finalistas);
    for (const c of finalistas) usados.add(c.nombrePdf);
  }

  return { propuesta, sinConcepto: nombresPdf.filter((n) => !usados.has(n)) };
}

/**
 * 🔴 La colisión AL REVÉS: dos conceptos canónicos apuntando al MISMO campo.
 *
 * La deduplicación de arriba es por clave canónica, así que nada impedía
 * proponer `paciente.domicilio` **y** `medico.domicilio` sobre el mismo
 * `Domicilio del paciente` (uno empata exacto, el otro por prefijo). Si eso se
 * pega tal cual en el diccionario, `render-pdf` escribe los dos valores en el
 * mismo campo del PDF y **el último gana en silencio**: la hoja sale con el
 * domicilio de la otra persona y nada lo reporta.
 */
function colisiones(propuesta: Map<CampoCanonico, Candidato[]>): Map<string, CampoCanonico[]> {
  const porCampo = new Map<string, CampoCanonico[]>();
  for (const [clave, candidatos] of propuesta) {
    for (const c of candidatos) {
      porCampo.set(c.nombrePdf, [...(porCampo.get(c.nombrePdf) ?? []), clave]);
    }
  }
  return new Map([...porCampo].filter(([, claves]) => claves.length > 1));
}

// ─────────────────────────────────────────────────────────────────────────────
// inspeccionar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 🔴 `updateMetadata: false` NO es un detalle.
 *
 * Por default `PDFDocument.load` **reescribe `/Producer` a `pdf-lib` y `/ModDate`
 * a AHORA, en memoria, nada más abrir el archivo**. Medido: el AXA del repo se
 * lee como `Adobe PDF Library 16.0.5 · 2022-08-30` con esta bandera y como
 * `pdf-lib · hoy` sin ella.
 *
 * Importa porque el `Producer` es justo la huella con la que 03-FORMATOS §2
 * distingue el PDF oficial del de un tercero que le puso campos. Sin esto, la
 * herramienta acusa a TODOS los formatos de venir de un intermediario —
 * incluido el que acaba de bajar de la aseguradora.
 */
const SIN_TOCAR = { ignoreEncryption: true, updateMetadata: false } as const;

/**
 * 🔴 ¿Se puede LEER el contenido del PDF? Se pregunta ANTES que nada.
 *
 * Un archivo dañado en la descarga abre perfecto: el árbol de páginas está bien,
 * los metadatos se leen, `pdf-lib` no protesta y `getPageCount()` da 3. Lo que
 * no se puede es DESCOMPRIMIR el contenido de las páginas.
 *
 * Medido con el Allianz oficial bajado el 2026-08-14: pdf.js avisa
 * `Bad FCHECK in flate stream` y devuelve **0 operadores en las 3 páginas**.
 * Sin esta comprobación, el síntoma que se ve es "0 reglas detectadas" — que se
 * lee como *este formato no se puede automatizar* cuando lo que pasa es que
 * **el archivo está roto**. Son dos conclusiones opuestas: una manda a escribir
 * un extractor nuevo, la otra a volver a bajar el PDF.
 *
 * También separa el caso caro de verdad (03-FORMATOS §4): un ESCANEO trae
 * operadores de imagen y cero texto. Eso sí es un formato difícil, no un archivo
 * roto.
 */
async function revisarLegibilidad(bytes: Uint8Array): Promise<'ok' | 'escaneo' | 'ilegible'> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { OPS } = pdfjs;
  // 🔴 Un PDF lo bastante roto hace que pdf.js LANCE al abrirlo, y `pdf-lib` ya
  //    lo dejó pasar (`ignoreEncryption`), así que la ejecución llega hasta
  //    aquí. Sin este catch, la excepción sube hasta `main().catch`, imprime un
  //    stack y **se lleva por delante los avisos** — justo el mensaje
  //    "el archivo está roto, vuelve a bajarlo" que esta función existe para
  //    dar. No poder leerlo ES el diagnóstico, no un fallo del programa.
  let doc: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  } catch {
    return 'ilegible';
  }
  try {
    let ops = 0;
    let texto = 0;
    let imagenes = 0;
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const lista = await page.getOperatorList();
      ops += lista.fnArray.length;
      for (const fn of lista.fnArray) {
        if (fn === OPS.showText || fn === OPS.showSpacedText) texto++;
        if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) imagenes++;
      }
    }
    if (ops === 0) return 'ilegible';
    if (texto === 0 && imagenes > 0) return 'escaneo';
    return 'ok';
  } finally {
    await doc.destroy();
  }
}

/**
 * El on-state con el que una casilla viene marcada de fábrica, o `null`.
 *
 * 🔴 NO se usa `isChecked()`. pdf-lib compara el `/V` del campo contra el
 * on-state del PRIMER recuadro, así que un grupo cuyo valor de fábrica es la
 * SEGUNDA opción (`S1 = /N`, Femenino) se reporta como no marcado. Medido sobre
 * AXA: `isChecked()` encuentra 4 de las 9 que trae puestas. Es la misma familia
 * de error que hacía que `check()` marcara la primera opción sin importar cuál
 * eligió el doctor.
 */
function marcadaDeFabrica(c: PDFCheckBox): string | null {
  try {
    const v = c.acroField.getValue();
    const nombre = (v?.asString?.() ?? '').replace(/^\//, '');
    return nombre !== '' && nombre !== 'Off' ? nombre : null;
  } catch {
    return null;
  }
}

async function inspeccionar(ruta: string) {
  const bytes = new Uint8Array(await readFile(ruta));
  const pdf = await PDFDocument.load(bytes, SIN_TOCAR);
  const form = pdf.getForm();
  const campos = form.getFields();
  const paginas = pdf.getPages();

  titulo('IDENTIDAD');
  linea(`  archivo    : ${path.basename(ruta)} (${(bytes.length / 1024).toFixed(0)} KB)`);
  linea(`  páginas    : ${pdf.getPageCount()}`);
  linea(`  creator    : ${pdf.getCreator() ?? '—'}`);
  linea(`  producer   : ${pdf.getProducer() ?? '—'}`);
  linea(`  creado     : ${pdf.getCreationDate()?.toISOString() ?? '—'}`);
  linea(`  modificado : ${pdf.getModificationDate()?.toISOString() ?? '—'}`);

  // 🔴 La regla de 03-FORMATOS §5: el PDF base sale del dominio de la
  // aseguradora. Un `Producer: pdf-lib` significa que ALGUIEN lo reprocesó — y
  // los 3 formatos de Eleonor decían exactamente eso, con campos que la
  // aseguradora nunca puso y una versión 7 años atrasada.
  if (/pdf-lib/i.test(pdf.getProducer() ?? '')) {
    avisar(
      'El `Producer` es pdf-lib: este archivo pasó por pdf-lib, así que NO es el que ' +
        'publicó la aseguradora tal cual. Si acabas de correr `campos` sobre un formato ' +
        'plano, es lo ESPERADO y va con `camposPropios: true`. Si no, verifica de dónde ' +
        'salió y que sea la versión vigente (03-FORMATOS §5).'
    );
  }
  if (pdf.isEncrypted) avisar('El PDF viene CIFRADO. pdf-lib no lo va a poder guardar.');

  const legible = await revisarLegibilidad(bytes);
  if (legible === 'ilegible') {
    avisar(
      'EL ARCHIVO ESTÁ ROTO: sus páginas no tienen ni un operador legible ' +
        '(pdf.js: «Bad FCHECK in flate stream»). Se abre y se le ven los metadatos, pero ' +
        'no hay contenido que extraer. Vuelve a bajarlo del sitio de la aseguradora.'
    );
    resumen();
    return;
  }
  if (legible === 'escaneo') {
    avisar(
      'El PDF es un ESCANEO: trae imágenes y CERO texto. Es el caso caro de ' +
        '03-FORMATOS §4 — no hay etiquetas de dónde deducir los campos, así que hay que ' +
        'estamparlos por coordenadas a mano. No se ha visto ninguno todavía.'
    );
  }

  titulo('GEOMETRÍA DE LAS PÁGINAS');
  let geometriaRara = false;
  paginas.forEach((p, i) => {
    const media = p.getMediaBox();
    const crop = p.getCropBox();
    const rot = p.getRotation().angle % 360;
    const desplazada = Math.abs(crop.x) > 0.5 || Math.abs(crop.y) > 0.5;
    const recortada =
      Math.abs(crop.width - media.width) > 0.5 || Math.abs(crop.height - media.height) > 0.5;
    if (rot !== 0 || desplazada || recortada) geometriaRara = true;
    linea(
      `  p${i + 1}: ${Math.round(media.width)}×${Math.round(media.height)} rot=${rot}` +
        `${desplazada ? ' CROP-DESPLAZADO' : ''}${recortada ? ' CROP-RECORTADO' : ''}`
    );
  });
  if (geometriaRara) {
    avisar(
      'Página rotada o con CropBox desplazado. El visor NO va a dibujar ninguna caja ' +
        '(`geometriaDelFormato` devuelve `cajas: []` a propósito): el lienzo de pdf.js y las ' +
        'coordenadas del widget se medirían con reglas distintas y TODAS caerían mal.'
    );
  }

  titulo('CAMPOS');
  if (campos.length === 0) {
    linea('  0 campos — el PDF es PLANO.');
    ojo('Caso Allianz. Antes de nada corre:');
    linea(`      npx tsx scripts/alta-formato.ts campos "${ruta}" <salida.pdf>`);
    linea('  y vuelve a inspeccionar la SALIDA. Y marca `camposPropios: true`.');
    resumen();
    return;
  }

  const texto = campos.filter((c) => c instanceof PDFTextField) as PDFTextField[];
  const casillas = campos.filter((c) => c instanceof PDFCheckBox) as PDFCheckBox[];
  const otros = campos.filter((c) => !(c instanceof PDFTextField) && !(c instanceof PDFCheckBox));
  linea(`  total: ${campos.length}  ·  texto: ${texto.length}  ·  casilla: ${casillas.length}  ·  otros: ${otros.length}`);
  if (otros.length > 0) {
    ojo(
      `${otros.length} campos que no son texto ni casilla (firmas, botones, radios). ` +
        'El motor NO los llena; sólo se avisan si el diccionario los nombra.'
    );
    for (const o of otros.slice(0, 10)) linea(`      ${o.constructor.name}  ${o.getName()}`);
  }

  // El diccionario vacío hace que TODO salga como campo crudo, que es justo lo
  // que se quiere para inventariar una hoja que todavía no tiene diccionario.
  const geo = await geometriaDelFormato(bytes, {});
  const cajasPorPagina = new Map<number, number>();
  for (const c of geo.cajas) cajasPorPagina.set(c.pagina, (cajasPorPagina.get(c.pagina) ?? 0) + 1);
  linea(
    `  recuadros por página: ${paginas
      .map((_, i) => `p${i + 1}=${cajasPorPagina.get(i) ?? 0}`)
      .join(' · ')}`
  );
  if (geo.sinUbicar.length > 0) {
    const motivos = new Map<string, number>();
    for (const s of geo.sinUbicar) motivos.set(s.motivo, (motivos.get(s.motivo) ?? 0) + 1);
    for (const [m, n] of motivos) avisar(`${n} campos SIN UBICAR (${m}) — el visor no los dibuja.`);
  }

  titulo('TRAMPAS');
  let trampas = 0;

  // 1. `maxLength`. Es la que tumbó la descarga de TODOS los PDFs: las 7 cajas
  //    de fecha de AXA declaran 8 (`ddmmaaaa`) y el pre-llenado escribe
  //    `dd/mm/aaaa`. `setText` LANZA y se cae el documento entero.
  const conMax = geo.cajas.filter((c) => c.maxLength !== undefined);
  if (conMax.length > 0) {
    trampas++;
    ojo(`${conMax.length} campos declaran \`maxLength\`:`);
    for (const c of conMax.slice(0, 20)) {
      const nombre = esClaveCruda(c.clave) ? nombrePdfDeClaveCruda(c.clave) : c.clave;
      const fecha = c.maxLength !== undefined && c.maxLength <= 10;
      linea(`      max=${String(c.maxLength).padStart(3)}  p${c.pagina + 1}  ${nombre}${fecha ? '   ← ¿fecha sin separadores?' : ''}`);
    }
    if (conMax.length > 20) linea(`      … y ${conMax.length - 20} más`);
    linea('      El renderer ya normaliza `dd/mm/aaaa` → `ddmmaaaa` y omite lo que');
    linea('      no cabe en vez de tumbar el PDF, pero el PROMPT tiene que saberlo.');
  }

  // 2. Casillas marcadas DE FÁBRICA. La hoja "en blanco" de AXA traía 9, una de
  //    ellas una declaración de facturación del médico.
  const marcadas = casillas
    .map((c) => ({ nombre: c.getName(), on: marcadaDeFabrica(c) }))
    .filter((c): c is { nombre: string; on: string } => c.on !== null);
  if (marcadas.length > 0) {
    trampas++;
    avisar(
      `${marcadas.length} casillas vienen MARCADAS de fábrica: ${marcadas
        .map((c) => `${c.nombre}=/${c.on}`)
        .join(', ')}`
    );
    linea('      `normalizarCasillas` las apaga al renderizar y `leerPdfBaseParaVisor`');
    linea('      al mostrarlas, pero hay que MIRAR qué afirman: en AXA una era');
    linea('      «Se ajusta a Tabulador médico».');
  }

  // 3. Cajas donde no cabe nada legible.
  const apretadas = geo.cajas.filter((c) => {
    if (c.tipo !== 'texto') return false;
    const cap = capacidadDeCaja(c.ancho, c.alto, c.multilinea, 0);
    return Number.isFinite(cap.maximo) && cap.maximo < 6;
  });
  if (apretadas.length > 0) {
    trampas++;
    ojo(`${apretadas.length} cajas de texto admiten menos de 6 caracteres a 6 pt (el mínimo legible).`);
  }

  // 4. Nombres de campo que el propio formato no puede imprimir. El nombre es la
  //    CLAVE con la que viaja la respuesta y con la que el modelo la nombra.
  const nombresRaros = campos
    .map((c) => c.getName())
    .filter((n) => caracteresNoImprimibles(n).length > 0);
  if (nombresRaros.length > 0) {
    trampas++;
    ojo(`${nombresRaros.length} nombres de campo traen caracteres fuera de WinAnsi: ${nombresRaros.slice(0, 5).join(', ')}`);
  }

  // 5. Nombres repetidos: en el AcroForm son EL MISMO campo con varios widgets.
  const cuenta = new Map<string, number>();
  for (const c of campos) cuenta.set(c.getName(), (cuenta.get(c.getName()) ?? 0) + 1);
  const repetidos = [...cuenta].filter(([, n]) => n > 1);
  if (repetidos.length > 0) {
    trampas++;
    ojo(`${repetidos.length} nombres aparecen más de una vez — marcar uno marca a sus hermanos.`);
  }

  if (trampas === 0) linea('  Ninguna de las trampas conocidas. (No quiere decir que no haya otras.)');

  titulo('CASILLAS — qué puede proponer el asistente');
  const etiquetas = await etiquetasDeLaHoja(bytes, {});
  const grupos = etiquetas.casillas;
  const permitidos = casillasParaElAgente(grupos);
  const permitidasClaves = new Set(permitidos.map((g) => g.clave));
  linea(`  ${grupos.length} grupos · el asistente ve ${permitidos.length} · bloqueados ${grupos.length - permitidos.length}`);
  for (const g of grupos) {
    const ok = permitidasClaves.has(g.clave);
    linea(
      `  ${ok ? '✅' : '⛔'} p${g.pagina} ${g.nombrePdf}` +
        `${g.pregunta ? `  «${g.pregunta}»` : '  (sin pregunta)'}`
    );
    linea(`        ${g.opciones.map((o) => `${o.etiqueta}=/${o.onState}`).join(' · ') || '(sin opciones)'}`);
  }
  // 🔴 Se cuentan los WIDGETS del PDF contra las opciones que se pudieron
  //    etiquetar. Preguntar por `opciones.some(o => !o.etiqueta)` no sirve:
  //    `etiquetasDeLaHoja` DESCARTA la opción sin etiqueta antes de meterla al
  //    grupo, así que ese filtro nunca encuentra nada. Una pregunta de 4
  //    recuadros llegaría al doctor y al modelo como una de 3, con todos los
  //    contadores cuadrando.
  const recuadrosDelPdf = new Map<string, number>();
  for (const c of casillas) recuadrosDelPdf.set(c.getName(), c.acroField.getWidgets().length);
  const incompletos = grupos.filter(
    (g) => (recuadrosDelPdf.get(g.nombrePdf) ?? g.opciones.length) > g.opciones.length
  );
  for (const g of incompletos) {
    avisar(
      `«${g.pregunta ?? g.nombrePdf}» tiene ${recuadrosDelPdf.get(g.nombrePdf)} recuadros en la hoja ` +
        `y sólo ${g.opciones.length} con etiqueta: al doctor y al modelo les falta una opción.`
    );
  }
  revisarConsentimientos(grupos, permitidasClaves);

  titulo('PROPUESTA DE DICCIONARIO — para pegar en dicts/<slug>.ts');
  const nombresTexto = texto.map((c) => c.getName());
  const { propuesta, sinConcepto } = proponerDiccionario(nombresTexto);
  linea('  // 🔴 PROPUESTA AUTOMÁTICA. Revisa CADA renglón contra la hoja impresa.');
  linea('  const ESCALARES: FieldDict = {');
  for (const [clave, candidatos] of propuesta) {
    if (candidatos.length === 1) {
      const c = candidatos[0];
      linea(`    '${clave}': ${JSON.stringify(c.nombrePdf)},${c.fuerza < 3 ? '   // ⚠️ empate débil' : ''}`);
    } else {
      linea(`    // ⚠️ AMBIGUO — elige uno: '${clave}'`);
      for (const c of candidatos) linea(`    //   ${JSON.stringify(c.nombrePdf)}`);
    }
  }
  linea('  };');
  linea('');
  for (const [nombrePdf, claves] of colisiones(propuesta)) {
    avisar(
      `DOS conceptos apuntan al MISMO campo «${nombrePdf}»: ${claves.join(' y ')}. ` +
        'Si se pegan los dos, el renderer escribe ambos y el último gana EN SILENCIO. Elige uno.'
    );
  }
  linea(`  Campos de texto sin concepto canónico: ${sinConcepto.length} de ${nombresTexto.length}.`);
  linea('  No es un problema: son campos CRUDOS (`campo:<nombre>`) y el doctor');
  linea('  escribe en ellos igual. El canónico es a propósito chico (04-MAPEO §1).');
  const faltantes = (Object.keys(CAMPOS_CANONICOS) as CampoCanonico[]).filter((k) => !propuesta.has(k));
  if (faltantes.length > 0) {
    linea('');
    linea(`  Canónicos SIN campo en esta hoja (${faltantes.length}): ${faltantes.join(', ')}`);
    linea('  Se quedan sin escribir y se reportan como `sin-campo-en-el-formato`.');
  }

  resumen();
}

/**
 * 🔴 El peor bug que ha tenido esta funcionalidad: al derivar las casillas
 * entraron TODAS al catálogo del modelo, incluido el consentimiento LFPDPPP del
 * PACIENTE. El doctor daba un solo Guardar para la tanda y el PDF aplanado
 * afirmaba una autorización que el paciente nunca firmó.
 *
 * `casillasParaElAgente()` lo filtra con una regex en español. Una aseguradora
 * nueva puede redactar su consentimiento con otras palabras — y entonces el
 * filtro no lo agarra y nadie se entera. Por eso se revisa POR FORMATO.
 */
function revisarConsentimientos(grupos: GrupoCasillas[], permitidas: Set<string>) {
  const SOSPECHA = /autoriz|acept|consent|privacidad|firma|declaro|manifiesto|tabulador|honorarios|asegurad/i;
  const coladas = grupos.filter((g) => {
    if (!permitidas.has(g.clave)) return false;
    const t = `${g.pregunta ?? ''} ${g.nombrePdf} ${g.opciones.map((o) => o.etiqueta).join(' ')}`;
    return SOSPECHA.test(t);
  });
  if (coladas.length > 0) {
    avisar(
      `${coladas.length} grupos que el asistente SÍ puede marcar suenan a consentimiento o ` +
        'facturación: ' +
        coladas.map((g) => `${g.nombrePdf}«${g.pregunta ?? ''}»`).join(', ')
    );
    linea('      Lo que firma un humano no lo propone un modelo. Si alguno lo es,');
    linea('      hay que ampliar CONSENTIMIENTO_O_FACTURACION en etiquetas-de-la-hoja.ts');
    linea('      y volver a correr esto.');
  }
}

function resumen() {
  titulo('RESUMEN');
  if (avisos.length === 0) {
    linea('  Sin avisos rojos. Sigue faltando mirar la hoja con los ojos.');
  } else {
    linea(`  ${avisos.length} avisos que hay que resolver antes de dar de alta el formato:`);
    avisos.forEach((a, i) => linea(`   ${i + 1}. ${a}`));
  }
  linea('');
  linea('  🔴 Nada de esto es el CLIC. Type-check, gates y este reporte no dicen que');
  linea('     las cajas caigan en su raya: eso se ve abriendo el visor y el PDF.');
  linea('');
}

// ─────────────────────────────────────────────────────────────────────────────
// campos — el caso PLANO
// ─────────────────────────────────────────────────────────────────────────────

async function ponerCampos(entrada: string, salida: string) {
  const bytes = new Uint8Array(await readFile(entrada));
  const antes = await PDFDocument.load(bytes, SIN_TOCAR);
  if (antes.getForm().getFields().length > 0) {
    avisar('Este PDF YA tiene campos. No se le ponen encima: inspecciónalo tal cual.');
    resumen();
    return;
  }

  // Sin esto, un archivo roto se reporta como "0 reglas detectadas" y parece un
  // formato que no se puede automatizar.
  const legible = await revisarLegibilidad(bytes);
  if (legible !== 'ok') {
    avisar(
      legible === 'ilegible'
        ? 'EL ARCHIVO ESTÁ ROTO (0 operadores legibles). No hay nada de dónde sacar las reglas. Vuelve a bajarlo.'
        : 'El PDF es un ESCANEO (imágenes, cero texto): no hay etiquetas que leer, así que la colocación automática NO aplica.'
    );
    resumen();
    return;
  }

  const r = await agregarCamposAFormatoPlano(bytes);
  await writeFile(salida, r.pdf);

  titulo('CAMPOS PUESTOS SOBRE UN FORMATO PLANO');
  const conNombre = r.campos.filter((c) => c.name);
  const porIzquierda = r.campos.filter((c) => c.via === 'izquierda').length;
  const porArriba = r.campos.filter((c) => c.via === 'arriba').length;
  linea(`  reglas detectadas : ${r.campos.length}`);
  linea(`  campos creados    : ${conNombre.length}`);
  linea(`  etiqueta izquierda: ${porIzquierda}   ·   arriba: ${porArriba}`);
  linea(`  sin etiqueta      : ${r.sinEtiqueta}`);
  linea(`  no creados        : ${r.noCreados.length}`);
  linea(`  guardado en       : ${salida}`);

  const porPagina = new Map<number, number>();
  for (const c of conNombre) porPagina.set(c.page, (porPagina.get(c.page) ?? 0) + 1);
  linea(`  por página        : ${[...porPagina].sort((a, b) => a[0] - b[0]).map(([p, n]) => `p${p}=${n}`).join(' · ')}`);

  linea(`  grupos de opciones : ${r.casillas.length} (${r.casillas.reduce((n, g) => n + g.opciones.length, 0)} recuadros □)`);
  for (const g of r.casillas) {
    linea(`      p${g.page} ${g.nombre}${g.pregunta ? `  «${g.pregunta}»` : '  (sin pregunta)'}`);
    linea(`        ${g.opciones.map((o) => `${o.etiqueta}=/${o.onState}`).join(' · ')}`);
  }

  if (r.sinEtiqueta > 0) {
    ojo(`${r.sinEtiqueta} reglas quedaron sin nombre — son las que se corrigen a mano.`);
  }
  for (const nc of r.noCreados) linea(`      no creado: p${nc.page} «${nc.label}» — ${nc.motivo}`);

  linea('');
  linea('  Nombres propuestos (los primeros 40):');
  for (const c of conNombre.slice(0, 40)) linea(`      p${c.page}  ${c.name}`);

  avisar(
    'Este PDF ya NO es el oficial byte a byte: los campos se los pusimos nosotros. ' +
      'Va con `camposPropios: true` y `fields_added_by_us = TRUE` (03-FORMATOS §5).'
  );
  ojo(`Ahora: npx tsx scripts/alta-formato.ts inspeccionar "${salida}"`);
  resumen();
}

// ─────────────────────────────────────────────────────────────────────────────
// sql — el INSERT, GENERADO desde el diccionario del repo
// ─────────────────────────────────────────────────────────────────────────────

function sql(clave: string) {
  const formato = FORMATOS.find((f) => claveFormato(f) === clave);
  if (!formato) {
    console.error(`No hay un formato con la clave "${clave}". Los que hay:`);
    for (const f of FORMATOS) console.error(`  ${claveFormato(f)}`);
    process.exit(1);
  }

  const entradas = Object.keys(formato.dict).length;
  // El JSON va escapado a la manera de Postgres: la comilla simple se duplica.
  const json = JSON.stringify(formato.dict).replace(/'/g, "''");

  linea(`-- INFORME MÉDICO — alta del formato ${formato.insurer} en \`insurance_forms\`.`);
  linea('--');
  linea('-- GENERADO por scripts/alta-formato.ts desde el diccionario del repo. No se');
  linea(`-- teclea: son ${entradas} entradas y una errata silenciosa deja campos sin`);
  linea('-- llenar en un PDF que se ve bien.');
  linea('--');
  linea('-- El PDF base NO va aquí: vive en `public/formatos/`. `pdf_url` lo dice con');
  linea('-- el prefijo `repo:` en vez de fingir una URL.');
  linea('--');
  linea('-- Idempotente: si la fila ya existe se actualiza el diccionario.');
  linea('');
  linea('INSERT INTO medical_records.insurance_forms');
  linea('  (id, insurer, name, version, source_url, fetched_at, pdf_url, field_dict, fields_added_by_us, is_active, created_at, updated_at)');
  linea('VALUES (');
  linea('  gen_random_uuid()::text,');
  linea(`  '${formato.insurer.replace(/'/g, "''")}',`);
  linea(`  '${formato.name.replace(/'/g, "''")}',`);
  linea(`  '${formato.version.replace(/'/g, "''")}',`);
  linea(`  '${formato.sourceUrl.replace(/'/g, "''")}',`);
  linea('  NOW(),');
  linea(`  'repo:public/formatos/${formato.archivo}',`);
  linea(`  '${json}'::jsonb,`);
  linea(`  ${formato.camposPropios ? 'TRUE' : 'false'},`);
  linea('  TRUE,');
  linea('  NOW(),');
  linea('  NOW()');
  linea(')');
  linea('ON CONFLICT (insurer, name, version) DO UPDATE');
  linea('  SET field_dict = EXCLUDED.field_dict,');
  linea('      pdf_url    = EXCLUDED.pdf_url,');
  linea('      source_url = EXCLUDED.source_url,');
  // 🔴 `fields_added_by_us` TIENE que refrescarse. Si la fila ya existía con el
  //    default (FALSE) y este PDF lleva campos puestos por nosotros, el UPDATE
  //    dejaba el diccionario nuevo y la procedencia MINTIENDO: la fila seguiría
  //    afirmando que el PDF es el original intacto de la aseguradora, que es
  //    exactamente lo que 03-FORMATOS §5 obliga a registrar.
  linea('      fields_added_by_us = EXCLUDED.fields_added_by_us,');
  linea('      fetched_at = EXCLUDED.fetched_at,');
  linea('      updated_at = NOW();');
  linea('');
  linea('-- ⚠️ `UNIQUE (insurer, name) WHERE is_active` vive en prod: si ya hay otra');
  linea('--    VERSIÓN activa de este mismo formato, este INSERT falla. Hay que');
  linea('--    desactivar la vieja primero — a propósito, para que el dropdown no');
  linea('--    ofrezca las dos y alguien mande la obsoleta (03-FORMATOS).');
  linea('');
  linea('-- ROLLBACK (sólo mientras no haya informes: form_id es RESTRICT)');
  linea('-- DELETE FROM medical_records.insurance_forms');
  linea(`--  WHERE insurer = '${formato.insurer}' AND name = '${formato.name}' AND version = '${formato.version}';`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [comando, a, b] = process.argv.slice(2);
  switch (comando) {
    case 'inspeccionar':
      if (!a) return uso();
      return inspeccionar(a);
    case 'campos':
      if (!a || !b) return uso();
      return ponerCampos(a, b);
    case 'sql':
      if (!a) return uso();
      return sql(a);
    default:
      return uso();
  }
}

function uso() {
  console.error('Uso:');
  console.error('  npx tsx scripts/alta-formato.ts inspeccionar <ruta.pdf>');
  console.error('  npx tsx scripts/alta-formato.ts campos <plano.pdf> <salida.pdf>');
  console.error('  npx tsx scripts/alta-formato.ts sql "<insurer>|<name>|<version>"');
  console.error('');
  console.error('Formatos dados de alta en el repo:');
  for (const f of FORMATOS) console.error(`  ${claveFormato(f)}`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
