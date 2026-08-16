/**
 * QUÉ DICE LA HOJA alrededor de cada campo.
 *
 * 🔴 Por qué existe (2026-08-10, tras probar el chat en vivo):
 *
 * Al agente se le estaban dando los **nombres internos** del AcroForm, que en
 * AXA muchas veces no significan nada:
 *
 *   `campo:Día_4`      ← es el DÍA de una fecha… ¿de qué pregunta?
 *   `campo:Día_6`      ← en realidad es el AÑO
 *   `Consultorio_2`    ← el grupo Consultorio/Hospital/Gabinete/Otro
 *   `Sí_3`             ← el Sí/No de "¿Es cáncer?"
 *
 * Con eso, ni las fechas aterrizaban ni se podía marcar una casilla: el modelo
 * no puede elegir un campo cuyo nombre no dice qué es. Lo que sí lo dice es el
 * **texto impreso alrededor**, y eso ya se sabe leer — es el mismo motor de
 * vecindad que le puso campos al Allianz plano (`add-fields.ts`).
 *
 * Medido sobre el AXA oficial: las 49 casillas resuelven su etiqueta por el
 * texto **a la derecha**, y la pregunta del grupo por el texto **a la izquierda**
 * del primer recuadro.
 *
 *   TE            → Urgencia · Hospitalización · Corta estancia/ambulatoria · Consultorio
 *   Consultorio_2 → Consultorio · Hospital · Gabinete · Otro
 *   Sí_3          → "¿Es cáncer?"  Sí · No
 */
import { PDFCheckBox, PDFDocument, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { geometriaDelPdf, type Texto } from './add-fields';
import { claveCruda, type FieldDict } from './types';
import { onStateDelWidget, rectDelWidget } from './geometria-formato';

/** Una opción de un grupo de casillas: qué dice en la hoja y su on-state. */
export interface OpcionCasilla {
  /** El on-state de ESE recuadro (`H`, `2`, `On`). Lo pone el servidor, nunca el modelo. */
  onState: string;
  /** Lo que está impreso junto al recuadro: "Hospitalización". */
  etiqueta: string;
}

/** Un campo de casillas = un grupo de opciones EXCLUYENTES. */
export interface GrupoCasillas {
  clave: string;
  nombrePdf: string;
  /** 1-based. */
  pagina: number;
  /** La pregunta a la izquierda del primer recuadro, si la hay ("¿Es cáncer?"). */
  pregunta: string | null;
  opciones: OpcionCasilla[];
}

export interface EtiquetasHoja {
  /** `clave -> lo que dice la hoja`, sólo para los campos de texto que lo necesitan. */
  contexto: Record<string, string>;
  casillas: GrupoCasillas[];
}

/** El texto que TERMINA justo antes de la caja, en el mismo renglón. */
function aLaIzquierda(textos: Texto[], x: number, y: number, max: number): Texto | undefined {
  return textos
    .filter((t) => Math.abs(t.y - y) <= 6 && t.x + t.w <= x + 4 && t.x + t.w >= x - max && t.s !== '')
    .sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
}

/** El texto que EMPIEZA justo después de la caja: la etiqueta normal de una casilla. */
function aLaDerecha(textos: Texto[], x: number, w: number, y: number, max: number): Texto | undefined {
  return textos
    .filter((t) => Math.abs(t.y - y) <= 6 && t.x >= x + w - 4 && t.x <= x + w + max && t.s !== '')
    .sort((a, b) => a.x - b.x)[0];
}

/**
 * 🔴 Las GUÍAS de una caja de fecha: `Día`, `Mes`, `Año`, `Día Mes`…
 *
 * Medido en AXA: `Día_4` NO es una caja de día. Es **una caja ancha para la
 * fecha entera** (x=63..179) con las tres guías impresas ENCIMA (Día en x=63,
 * Mes en x=96, Año en x=142) y la pregunta de verdad un renglón más arriba
 * ("Fecha de cirugía:").
 *
 * Tomar la guía como etiqueta daba `Día_4 -> "Mes"`, `Día_5 -> "Mes"` y
 * `Día_6 -> "Mes"`: las tres cajas con el mismo nombre y **ninguna con el
 * suyo**. Eso no es sólo inútil, es peligroso — le dice al modelo que escriba
 * un mes donde va la fecha de alta.
 */
const GUIA_DE_FECHA = /^(d[ií]a|mes|a[ñn]o)(\s+(d[ií]a|mes|a[ñn]o))*:?$/i;

/**
 * La pregunta que manda sobre una caja: lo de arriba o lo de la izquierda,
 * **saltándose las guías de fecha**.
 *
 * Se acepta una banda vertical generosa (hasta 40 pt) porque la pregunta suele
 * vivir por encima de la fila de guías, y se admiten candidatos a la izquierda
 * porque la mitad de las fechas de AXA se rotulan así
 * (`Fecha de padecimiento:  [Día Mes Año]`).
 */
function preguntaDeLaCaja(textos: Texto[], x: number, w: number, y: number): string | null {
  const candidatos = textos
    .filter((t) => {
      if (t.s.trim() === '' || GUIA_DE_FECHA.test(t.s.trim())) return false;
      const dy = t.y - y;
      if (dy < -6 || dy > 40) return false;
      const solapa = t.x < x + w - 2 && t.x + t.w > x + 2;
      const izquierda = t.x + t.w <= x + 4 && t.x + t.w >= x - 300;
      return solapa || izquierda;
    })
    // El más cercano hacia arriba; a igual altura, el más pegado a la caja.
    .sort((a, b) => (a.y - y) - (b.y - y) || (b.x + b.w) - (a.x + a.w));

  if (candidatos.length === 0) return null;
  const mejor = candidatos[0];

  // Una etiqueta partida en dos renglones ("Fecha de" / "nacimiento:") llega
  // como dos items: si el más cercano arranca en minúscula es la CONTINUACIÓN,
  // y sola no dice nada. Se le pega el de arriba.
  if (/^[a-záéíóúñ]/.test(mejor.s.trim())) {
    const encima = candidatos.find((t) => t.y > mejor.y + 2);
    if (encima) return `${encima.s.trim()} ${mejor.s.trim()}`;
  }
  return mejor.s.trim();
}

/**
 * 🔴 ¿Es el TÍTULO de una sección y no una pregunta?
 *
 * Estas hojas rotulan sus bloques en VERSALES —`FICHA DE IDENTIFICACIÓN`,
 * `TRÁMITE`, `HISTORIA CLÍNICA`, `DATOS DEL HOSPITAL`— y un título así puede
 * quedar a la izquierda del primer recuadro de un grupo. Medido en GNP: el
 * grupo `Causa atención` (Embarazo · Enfermedad · Accidente) tomaba
 * **"IDENTIFICACIÓN"** como su pregunta.
 *
 * No es una etiqueta pobre, es una FALSA: le dice al modelo que ese grupo
 * pregunta algo que no pregunta. Y en esta carpeta la regla ya está pagada tres
 * veces — cuando no se puede saber, la etiqueta se deja pelona y quien mire la
 * hoja la corrige.
 */
function esEncabezadoDeSeccion(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, '');
  return letras.length >= 4 && letras === letras.toUpperCase();
}

/** Limpia el relleno de puntos y guiones bajos con el que los formatos dibujan las rayas. */
function limpiar(s: string): string {
  return s.replace(/[_.]{2,}/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}

/**
 * 🔴 Un nombre de campo es OPACO cuando no dice qué se escribe en él. Sólo a
 * ésos se les busca contexto: para `Apellido paterno` el nombre ya es mejor que
 * cualquier cosa que se deduzca de la hoja, y sustituirlo sería empeorarlo.
 */
/**
 * ⚠️ **NO ampliar esto para "arreglar" nombres feos de un formato plano.**
 *
 * Se intentó el 2026-08-14: quitar el prefijo `pN_` antes de las pruebas, para
 * que `p1_AAAA` se declarara opaco y el modelo recibiera la pregunta impresa en
 * vez del nombre. Medido sobre el Allianz real, el resultado fue PEOR:
 *
 * | campo | contexto que se derivaba |
 * |---|---|
 * | `vitales.tensionArterial` (`p2_TA`) | **"Mts."** ← la unidad de la caja de Talla de al lado |
 * | `campo:p1_AAAA` | **"Hipertensivos"** |
 * | `campo:p1_y_cantidad_2` | `"y cantidad) y cantidad)"` |
 *
 * Y como el contexto **PISA la etiqueta canónica** (`campos-dictables.ts`), al
 * modelo se le habría presentado el campo de la TENSIÓN ARTERIAL de un
 * documento médico-legal bajo el rótulo "Mts.". Un nombre poco informativo se
 * ignora; un rótulo FALSO se obedece — y aquí invita a escribir una estatura en
 * la casilla de la presión.
 *
 * Un nombre feo se corrige mirando la hoja y escribiéndolo en el diccionario,
 * no adivinándolo con geometría.
 */
function esOpaco(nombre: string): boolean {
  return (
    /^(D[ií]a|Mes|A[ñn]o)(\s|_|\d|$)/i.test(nombre) ||   // cajas de fecha partidas
    /^(undefined|Text|Check\s?Box|Campo|Field)/i.test(nombre) ||
    /^P\d+_\d+$/i.test(nombre) ||                        // el estilo de GNP
    nombre.trim().length <= 3
  );
}

/**
 * 🔴🔴 QUÉ CASILLAS PUEDE PROPONER EL AGENTE — y por qué no todas.
 *
 * Hallazgo del `/code-review` (2026-08-10). Al derivar las 49 casillas de la
 * hoja entraron al catálogo del modelo, entre otras:
 *
 *   `Autorizo el tratamiento y transferencia de mis datos personales…`  (p6)
 *   `Sí acepto` / `Sí acepto_2`                                          (p6)
 *   `Se ajusta a Tabulador médico`                                       (p5)
 *
 * La página 6 de AXA dice literalmente **"Para ser llenado por el Asegurado
 * afectado"** y está junto a **"Firma del Asegurado"**: son los consentimientos
 * LFPDPPP del PACIENTE. Y `Se ajusta a Tabulador médico` es una declaración de
 * FACTURACIÓN del médico.
 *
 * El caso concreto: el doctor dice *"el paciente ya autorizó mandar sus datos"*,
 * el modelo devuelve `{"casillas":{"campo:Sí acepto":"Sí acepto"}}`, cae en
 * ámbar, el doctor da Guardar (uno solo, para toda la tanda) y **el PDF final
 * afirma una autorización que el paciente nunca firmó**. Es exactamente lo que
 * el consentimiento propio del app existe para no hacer.
 *
 * Se excluyen TRES familias. Ninguna desaparece de la hoja: el doctor las sigue
 * marcando a mano en el visor. Lo que se quita es que las proponga un modelo.
 */
const CONSENTIMIENTO_O_FACTURACION =
  /autoriz|acepto|consent|tabulador|firma|datos personales|aviso de privacidad|resp?onsabilidad civil|convenio|comprom|compa[ñn][ií]a de seguros/i;

/** `Sí`, `No`, `Si acepto`… — etiquetas que no dicen NADA fuera de su pregunta. */
const GENERICA = /^(s[ií]|no)$/i;

export function casillasParaElAgente(casillas: GrupoCasillas[]): GrupoCasillas[] {
  return casillas.filter((g) => {
    const texto = `${g.pregunta ?? ''} ${g.clave} ${g.opciones.map((o) => o.etiqueta).join(' ')}`;

    // 1) Consentimientos del paciente y declaraciones de facturación. Nunca.
    if (CONSENTIMIENTO_O_FACTURACION.test(texto)) return false;

    // 2) Una sola opción ⇒ el modelo SÓLO puede marcarla; no existe forma de
    //    decir "no". En AXA son `ANP`/`ANP1`/`ANP2` (`¿Fuma?`,
    //    `¿Consume bebidas alcohólicas?`…): el doctor dice "no fuma" y la única
    //    cadena que el modelo puede emitir MARCA la casilla — la hoja acaba
    //    afirmando lo contrario de lo que le dijeron.
    if (g.opciones.length < 2) return false;

    // 3) Sin pregunta Y con opciones genéricas (`Sí | No`) el grupo no se puede
    //    nombrar: `Sí_2` y `Sí_3` («¿Es cáncer?») son indistinguibles para el
    //    modelo, y el servidor aceptaría el equivocado porque la ETIQUETA empata.
    //    Un grupo sin pregunta pero con opciones que se explican solas
    //    (`Consultorio | Hospital | Gabinete | Otro`) sí se queda.
    if (g.pregunta === null && g.opciones.every((o) => GENERICA.test(o.etiqueta))) return false;

    return true;
  });
}

/**
 * Igual que la geometría: mismo PDF + mismo diccionario ⇒ mismas etiquetas.
 * Sin caché, cada turno del chat volvería a abrir el PDF con pdf.js y a recorrer
 * el texto de las 6 páginas. La clave lleva el `updatedAt` de la fila para que
 * editar el `field_dict` en la BD invalide sola.
 */
const cache = new Map<string, EtiquetasHoja>();

/**
 * ⚠️ El PDF se pide con un THUNK, no como bytes. Con el buffer por parámetro,
 * cada turno del chat y cada dictado leían ~1 MB del disco **aunque la caché
 * fuera a acertar**. Es el mismo patrón de `geometriaCacheada`: la lectura vive
 * dentro del camino de fallo.
 */
export async function etiquetasCacheadas(
  claveCache: string,
  dict: FieldDict,
  leerPdf: () => Promise<Uint8Array>
): Promise<EtiquetasHoja> {
  const guardadas = cache.get(claveCache);
  if (guardadas) return guardadas;
  try {
    const e = await etiquetasDeLaHoja(await leerPdf(), dict);
    cache.set(claveCache, e);
    return e;
  } catch {
    // Perder las etiquetas no debe tumbar el chat: se cae a los nombres del
    // PDF, que es exactamente como funcionaba antes de que esto existiera.
    return { contexto: {}, casillas: [] };
  }
}

export async function etiquetasDeLaHoja(
  pdfBase: Uint8Array,
  dict: FieldDict
): Promise<EtiquetasHoja> {
  const pdf = await PDFDocument.load(pdfBase);
  const pages = pdf.getPages();
  const geo = await geometriaDelPdf(pdfBase);

  const canonicaDe = new Map<string, string>();
  for (const [clave, nombrePdf] of Object.entries(dict)) canonicaDe.set(nombrePdf, clave);

  const contexto: Record<string, string> = {};
  const casillas: GrupoCasillas[] = [];

  for (const field of pdf.getForm().getFields()) {
    const nombrePdf = field.getName();
    const clave = canonicaDe.get(nombrePdf) ?? claveCruda(nombrePdf);
    const esTexto = field instanceof PDFTextField;
    // Un grupo de RADIO es un grupo de opciones excluyentes igual que uno de
    // casillas, y sus nombres de opción son tan opacos como los on-states de
    // AXA: GNP las llama `Opción1`…`Opción4`. Nadie —ni el modelo ni una
    // persona— puede elegir "Opción3" sin el texto impreso al lado.
    const esCasilla = field instanceof PDFCheckBox || field instanceof PDFRadioGroup;
    if (!esTexto && !esCasilla) continue;

    /** Los recuadros con su posición: la pregunta se decide DESPUÉS, con todos. */
    const crudas: Array<OpcionCasilla & { x: number; y: number; pagina: number }> = [];
    let paginaGrupo = 1;

    for (const widget of field.acroField.getWidgets()) {
      // Misma resolución de página que el resto del motor: `/P` es OPCIONAL.
      const pRef = widget.P();
      let pagina = pRef ? pages.findIndex((p) => p.ref === pRef) : -1;
      if (pagina < 0) {
        const ref = pdf.context.getObjectRef(widget.dict);
        const encontrada = ref ? pdf.findPageForAnnotationRef(ref) : undefined;
        pagina = encontrada ? pages.indexOf(encontrada) : -1;
      }
      if (pagina < 0) continue;

      const r = rectDelWidget(widget);
      const textos = geo[pagina]?.textos ?? [];

      if (esTexto) {
        // Sólo si el nombre no dice nada: si no, se conserva el nombre.
        if (!esOpaco(nombrePdf)) continue;
        const p = preguntaDeLaCaja(textos, r.x, r.ancho, r.y);
        if (p) contexto[clave] = limpiar(p);
        continue;
      }

      // ── Casillas y radios ───────────────────────────────────────────────
      paginaGrupo = pagina + 1;
      const onState = onStateDelWidget(widget);
      if (!onState) continue;   // un recuadro sin on-state no se puede marcar

      const der = aLaDerecha(textos, r.x, r.ancho, r.y, 170);
      const etiqueta = der ? limpiar(der.s) : '';
      // Sin etiqueta el recuadro no se ofrece: marcar "la opción 3" a ciegas en
      // un documento médico-legal es exactamente lo que no se va a hacer.
      if (etiqueta === '') continue;
      crudas.push({ onState, etiqueta, x: r.x, y: r.y, pagina });
    }

    if (esCasilla && crudas.length > 0) {
      // 🔴 La pregunta sale del recuadro MÁS A LA IZQUIERDA de su renglón, no
      // del primero que devuelva `getWidgets()`: ese orden no es el visual. En
      // `MAM` el primer widget es "Maternidad" y a su izquierda está
      // "Accidente" — otra opción del mismo grupo, que se habría tomado como la
      // pregunta.
      const primero = [...crudas].sort((a, b) => a.y - b.y || a.x - b.x)[0];
      const etiquetas = new Set(crudas.map((o) => o.etiqueta));
      const izq = aLaIzquierda(geo[primero.pagina]?.textos ?? [], primero.x, primero.y, 220);
      const texto = izq ? limpiar(izq.s) : '';
      // 🔴 Un encabezado se descarta… SALVO que suene a consentimiento o
      // facturación. `casillasParaElAgente` decide qué puede proponer el modelo
      // buscando esas palabras en `pregunta + clave + opciones`: si se le quita
      // la pregunta, un grupo rotulado **"CONSENTIMIENTO INFORMADO"** en
      // versales —con opciones que no son `Sí`/`No`, así que tampoco lo atrapa
      // la regla 3— se volvería proponible por un modelo. Es exactamente el
      // `Sí acepto` del 2026-08-10 entrando por una puerta nueva, y prefiero un
      // rótulo feo a un guardarraíl con un hueco.
      const util =
        texto.length > 3 &&
        !etiquetas.has(texto) &&
        (!esEncabezadoDeSeccion(texto) || CONSENTIMIENTO_O_FACTURACION.test(texto));
      const pregunta = util ? texto : null;

      casillas.push({
        clave, nombrePdf, pagina: paginaGrupo, pregunta,
        opciones: crudas.map(({ onState, etiqueta }) => ({ onState, etiqueta })),
      });
    }
  }

  casillas.sort((a, b) => a.pagina - b.pagina || a.clave.localeCompare(b.clave));
  return { contexto, casillas };
}
