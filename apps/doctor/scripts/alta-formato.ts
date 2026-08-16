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
 *   npx tsx scripts/alta-formato.ts mapa <pdf> <salida.pdf>
 *   npx tsx scripts/alta-formato.ts demo <pdf> <salida.pdf>
 *   npx tsx scripts/alta-formato.ts sql "<insurer>|<name>|<version>"
 *
 *   inspeccionar  Mide el PDF y saca el reporte completo: identidad, campos,
 *                 casillas, TRAMPAS y una propuesta de diccionario.
 *   campos        Sólo para un PDF PLANO (0 campos, caso Allianz): le pone los
 *                 campos por vecindad y guarda el PDF que será la base.
 *                 ⚠️ Ese archivo YA NO es el oficial byte a byte ⇒
 *                 `camposPropios: true` y `fields_added_by_us = TRUE`.
 *   mapa          Rotula CADA campo con su propio nombre sobre la hoja real. Es
 *                 cómo se revisa la colocación de un formato plano de un vistazo
 *                 (así se cazaron 4 campos ENCIMADOS con todos los contadores en
 *                 verde).
 *   demo          La hoja con TODOS los campos llenos por el motor real, para
 *                 verla como la recibiría la aseguradora sin crear un informe.
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
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { CAMPOS_CANONICOS, type CampoCanonico } from '../src/lib/informe-medico/canonical';
import { capacidadDeCaja } from '../src/lib/informe-medico/capacidad';
import { caracteresNoImprimibles } from '../src/lib/informe-medico/winansi';
import { geometriaDelFormato, onStateDelWidget } from '../src/lib/informe-medico/geometria-formato';
import {
  casillasParaElAgente,
  etiquetasDeLaHoja,
  type GrupoCasillas,
} from '../src/lib/informe-medico/etiquetas-de-la-hoja';
import { agregarCamposAFormatoPlano, capasDelPdf } from '../src/lib/informe-medico/add-fields';
import { claveFormato, FORMATOS } from '../src/lib/informe-medico/formatos';
import { claveCruda, nombrePdfDeClaveCruda, esClaveCruda } from '../src/lib/informe-medico/types';
import { renderFinal } from '../src/lib/informe-medico/render-pdf';

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
  // Los RADIOS son grupos de opciones excluyentes igual que las casillas, y desde
  // GNP (2026-08-15) el motor los llena. Contarlos con las firmas y los botones
  // decía que 7 preguntas de la hoja no se podían contestar, y ya no es cierto.
  const radios = campos.filter((c) => c instanceof PDFRadioGroup) as PDFRadioGroup[];
  const otros = campos.filter(
    (c) => !(c instanceof PDFTextField) && !(c instanceof PDFCheckBox) && !(c instanceof PDFRadioGroup)
  );
  linea(
    `  total: ${campos.length}  ·  texto: ${texto.length}  ·  casilla: ${casillas.length}` +
      `  ·  radio: ${radios.length}  ·  otros: ${otros.length}`
  );
  if (otros.length > 0) {
    ojo(
      `${otros.length} campos que no son texto, casilla ni radio (firmas, botones). ` +
        'El motor NO los llena; sólo se avisan si el diccionario los nombra.'
    );
    for (const o of otros.slice(0, 10)) linea(`      ${o.constructor.name}  ${o.getName()}`);
  }

  // 🔴 `/Rect` invertido. El spec permite declararlo con las esquinas en
  // cualquier orden y pdf-lib resta sin normalizar: un alto negativo deja la caja
  // sin altura y corrida en el visor — es decir, un campo que NO SE PUEDE
  // ESCRIBIR, sin ningún error. GNP traía 4.
  let invertidos = 0;
  for (const c of campos) {
    for (const w of c.acroField.getWidgets()) {
      const r = w.getRectangle();
      if (r.width < 0 || r.height < 0) invertidos++;
    }
  }
  if (invertidos > 0) {
    linea(`  ℹ️  ${invertidos} widgets traen el /Rect invertido — normalizados por rectDelWidget().`);
  }

  // 🔴 Capas de contenido opcional. Si hay texto en una capa apagada, las
  // etiquetas por vecindad se derivarían de algo que el médico no ve.
  const capas = await capasDelPdf(bytes);
  if (capas.length > 0) {
    linea(`  ℹ️  capas de contenido opcional: ${capas.map((c) => `${c.nombre}${c.visible ? '' : ' (APAGADA)'}`).join(' · ')}`);
    if (capas.some((c) => !c.visible)) {
      ojo(
        'Hay capas APAGADAS: su texto existe en el archivo y NO se ve. La derivación ' +
          'de etiquetas ya lo filtra; no lo deshagas leyendo el texto por tu cuenta.'
      );
    }
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
      // La pista sólo se da cuando el campo DICE que es una fecha. Antes bastaba
      // con `maxLength <= 10` y entonces `Teléfono Médico` salía rotulado
      // "¿fecha sin separadores?": una pista falsa sobre qué escribir ahí, que es
      // justo el modo de falla que esta carpeta persigue.
      const fecha = /fecha|dd\s*mm|aaaa/i.test(nombre);
      linea(`      max=${String(c.maxLength).padStart(3)}  p${c.pagina + 1}  ${nombre}${fecha ? '   ← ¿fecha sin separadores?' : ''}`);
    }
    if (conMax.length > 20) linea(`      … y ${conMax.length - 20} más`);
    linea('      El renderer ya normaliza `dd/mm/aaaa` → `ddmmaaaa` y omite lo que');
    linea('      no cabe en vez de tumbar el PDF, pero el PROMPT tiene que saberlo.');
  }

  // 2. Casillas marcadas DE FÁBRICA. La hoja "en blanco" de AXA traía 9, una de
  //    ellas una declaración de facturación del médico.
  const marcadas = [
    ...casillas.map((c) => ({ nombre: c.getName(), on: marcadaDeFabrica(c) })),
    // 🔴 Los RADIOS vienen preseleccionados igual (GNP: `Relación otro
    // padecimiento = Opción1`) y hasta 2026-08-15 nadie los miraba.
    //
    // ⚠️ Se leen con `getSelected()`, que mira el `/V` del grupo — NO con
    // `isChecked()`: ése compara contra el on-state del PRIMER recuadro y en AXA
    // encuentra 4 de las 9. Es la misma familia del viejo `check()` que marcaba
    // la primera opción sin importar cuál eligió el doctor.
    ...radios.map((r) => ({ nombre: r.getName(), on: r.getSelected() ?? null })),
  ].filter((c): c is { nombre: string; on: string } => c.on !== null && c.on !== undefined);
  if (marcadas.length > 0) {
    trampas++;
    avisar(
      `${marcadas.length} opciones vienen MARCADAS de fábrica: ${marcadas
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


/**
 * MAPA — cada campo rotulado con su propio nombre, sobre la hoja real.
 *
 * Es la forma barata de revisar la colocación automática de un formato plano:
 * en vez de valores sueltos se ven TODOS los recuadros a la vez y la pregunta
 * es una sola — ¿lo que dice cada raya coincide con la etiqueta impresa a su
 * lado? Con esto el usuario cazó 4 pares de campos ENCIMADOS que ningún
 * contador delataba (todos los números estaban en verde).
 */
async function mapa(entrada: string, salida: string) {
  const pdf = await PDFDocument.load(new Uint8Array(await readFile(entrada)), SIN_TOCAR);
  const form = pdf.getForm();
  let n = 0;
  const sinRotular: string[] = [];
  for (const field of form.getFields()) {
    // Los grupos de opciones no llevan texto: se revisan en el DEMO, que los
    // marca. Se cuentan aparte para que su ausencia no parezca un fallo.
    if (field instanceof PDFCheckBox || field instanceof PDFRadioGroup) continue;
    if (!(field instanceof PDFTextField)) continue;
    try {
      // 🔴 El nombre se RECORTA al `maxLength` de la caja. Sin esto `setText`
      // lanza y el `catch` se lo traga: en GNP eran 15 campos —los 8 con tope,
      // entre ellos las cuatro fechas— que desaparecían del mapa **justo los
      // que hay que revisar**, y el reporte decía "40 campos" tan tranquilo.
      const tope = field.getMaxLength();
      const etiqueta = field.getName().replace(/^p\d+_/, '');
      field.setText(tope !== undefined ? etiqueta.slice(0, tope) : etiqueta);
      // 🔴 El tamaño de letra va APARTE y es opcional: `setFontSize` exige que el
      // campo tenga `/DA`, y 7 campos de GNP —los grandes de antecedentes,
      // padecimiento y diagnóstico— no lo traen. Junto al `setText` en el mismo
      // `try`, su excepción borraba del mapa el rótulo que SÍ se había puesto.
      // (El renderer de verdad nunca llama a `setFontSize`, por eso llena esos
      // campos sin problema: era un defecto de esta herramienta, no de la hoja.)
      try { field.setFontSize(7); } catch { /* se queda con su tamaño propio */ }
      n++;
    } catch {
      sinRotular.push(field.getName());
    }
  }
  form.flatten();
  await writeFile(salida, await pdf.save());
  linea(`${n} campos rotulados con su propio nombre → ${salida}`);
  if (sinRotular.length > 0) ojo(`${sinRotular.length} no se pudieron rotular: ${sinRotular.join(', ')}`);
  ojo('Ábrelo y compara: ¿lo que dice cada raya es la etiqueta impresa a su lado?');
}

/**
 * DEMO — la hoja con TODOS los campos llenos, por el motor real.
 *
 * Para ver el formato como lo recibiría la aseguradora, sin tener que crear un
 * informe. Los valores son de relleno; lo que se revisa es la COLOCACIÓN, si
 * algo se sale de su caja y si las casillas caen donde deben.
 */
async function demo(entrada: string, salida: string) {
  const base = new Uint8Array(await readFile(entrada));
  const pdf = await PDFDocument.load(base, SIN_TOCAR);
  const answers: Record<string, { value: string; source: null; origin: 'manual' }> = {};
  for (const f of pdf.getForm().getFields()) {
    const nombre = f.getName();
    // Las casillas y los RADIOS son lo mismo aquí: un grupo de opciones
    // excluyentes. Si los radios cayeran al relleno de texto, sus 7 grupos
    // saldrían en blanco en la hoja de demostración y el contador diría
    // "10 problemas" en un formato sano — que es como se enseña a ignorarlo.
    if (f instanceof PDFCheckBox || f instanceof PDFRadioGroup) {
      // La ÚLTIMA opción del grupo, no la primera: marcar la primera es
      // precisamente el bug que no se ve si sólo se prueba con la primera.
      const estados = f.acroField.getWidgets()
        .map((w) => onStateDelWidget(w))
        .filter((v): v is string => !!v);
      if (estados.length > 0) answers[claveCruda(nombre)] = { value: estados[estados.length - 1], source: null, origin: 'manual' };
      continue;
    }
    const tope = f instanceof PDFTextField ? f.getMaxLength() : undefined;
    answers[claveCruda(nombre)] = { value: etiquetaDeRelleno(nombre, tope), source: null, origin: 'manual' };
  }
  const r = await renderFinal(base, answers, {});
  await writeFile(salida, r.pdf);
  linea(`respuestas: ${Object.keys(answers).length}  ·  llenados: ${r.llenados}`);
  linea(`problemas : ${r.problemas.length}`);
  linea(`ilegibles : ${r.ilegibles.length} ${JSON.stringify(r.ilegibles.map((i) => `${i.campoCanonico}(+${i.sobran})`))}`);
  const final = await PDFDocument.load(r.pdf, SIN_TOCAR);
  linea(`campos vivos tras flatten: ${final.getForm().getFields().length}  (tiene que ser 0)`);
  linea(`→ ${salida}`);
}

/** Un valor de relleno que se reconoce de un vistazo en la hoja. */
function etiquetaDeRelleno(nombre: string, maxLength?: number): string {
  const base = /fecha/i.test(nombre)
    ? '15 03 2019'
    : /importe|honorario|presupuesto/i.test(nombre)
      ? '35,000.00'
      : /tel[eé]fono|celular|fax/i.test(nombre)
        ? '3312345678'
        : nombre.replace(/^p\d+_/, '').replace(/_/g, ' ').slice(0, 40);
  // 🔴 El relleno se recorta al tope DURO de la caja. Sin esto el demo reporta
  // "3 problemas" en una hoja perfectamente sana —el nombre del campo no cabe en
  // su propio `maxLength`— y un contador que nunca da cero enseña a ignorarlo,
  // que es justo lo que este archivo evita en todos lados.
  return maxLength !== undefined ? base.slice(0, maxLength) : base;
}

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

  linea(`  fechas (guías DD/MM/AAAA, sin raya): ${r.fechas.length}`);
  for (const f of r.fechas) linea(`      p${f.page} ${f.label}`);
  linea(`  importes (marcados con $, sin raya): ${r.importes.length}`);
  for (const h of r.importes) linea(`      p${h.page} ${h.label}`);
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
  linea('  // 🔴 ETIQUETAS — para pegar en dicts/<slug>.ts. NO es opcional en un');
  linea('  // formato plano: sin esto el asistente ve `p1_AAAA` como etiqueta.');
  linea('  // Es el texto IMPRESO en la hoja, no el nombre inventado del campo.');
  linea('export const ETIQUETAS: Record<string, string> = {');
  for (const [nombre, etiqueta] of Object.entries(r.etiquetas)) {
    linea(`  ${JSON.stringify(nombre)}: ${JSON.stringify(etiqueta)},`);
  }
  linea('};');

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
    case 'mapa':
      if (!a || !b) return uso();
      return mapa(a, b);
    case 'demo':
      if (!a || !b) return uso();
      return demo(a, b);
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
  console.error('  npx tsx scripts/alta-formato.ts mapa <pdf> <salida.pdf>        # cada campo con su nombre encima');
  console.error('  npx tsx scripts/alta-formato.ts demo <pdf> <salida.pdf>        # la hoja con TODO lleno');
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
