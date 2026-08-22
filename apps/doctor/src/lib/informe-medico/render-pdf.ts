/**
 * INFORME MÉDICO — los DOS renders del mismo informe (02-PLAN §4b).
 *
 *   renderFinal()    → lo que recibe la aseguradora: limpio y APLANADO
 *   renderBorrador() → lo que revisa el médico: dos capas de color, SÓLO LECTURA
 *
 * 🔴 El borrador NUNCA se manda. Los tres formatos dicen en su propio texto que
 * no son válidos con tachaduras ni enmendaduras; una hoja con recuadros de color
 * encima es peor que una en blanco.
 *
 * Probado punta a punta el 2026-08-08 contra el AXA oficial (277 campos) y el
 * Allianz oficial: 10/10 y 12/12 campos llenados, 0 campos vivos tras aplanar, y
 * los acentos y la ñ intactos (`Muñoz`, `Peña`, `María de los Ángeles`).
 */
import {
  PDFCheckBox,
  PDFDocument,
  PDFName,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  rgb,
  StandardFonts,
  type PDFField,
  type PDFForm,
} from 'pdf-lib';
import { nombrePdfDe, type Answers, type FieldDict } from './types';
import { capacidadDeCaja, PT_MAXIMO } from './capacidad';
import { empataOpcion, onStateDelWidget, rectDelWidget } from './geometria-formato';
import { caracteresNoImprimibles } from './winansi';

/** Azul: aquí SE PUEDE escribir (campo vacío). */
const COLOR_VACIO = rgb(0.83, 0.89, 0.97);
/** Verde: aquí YA HAY contenido, venga de donde venga. */
const COLOR_LLENO = rgb(0.80, 0.93, 0.79);

/** Un campo que no se pudo escribir, y por qué. Nunca se traga en silencio. */
export interface CampoOmitido {
  campoCanonico: string;
  nombrePdf: string;
  motivo:
    | 'no-existe'                    // el diccionario nombra un campo que este PDF no tiene
    | 'sin-campo-en-el-formato'      // NORMAL: el canónico tiene el dato y esta hoja no lo pide
    | 'no-es-de-texto'
    | 'caracteres-no-imprimibles'
    | 'no-cabe-en-el-campo'          // supera el `maxLength` DURO del PDF
    | 'rechazado-por-el-pdf'         // `setText` lanzó por cualquier otra razón
    | 'opcion-no-existe'             // grupo de radio: el valor no es una de sus opciones
    | 'no-cabe';                     // SÍ se escribió, pero en letra ilegible
  /** Sólo para `caracteres-no-imprimibles`: qué hay que quitar. */
  caracteres?: string[];
  /** Sólo para `no-cabe`: cuántos caracteres sobran para que se lea. */
  sobran?: number;
  /** Sólo para `no-cabe-en-el-campo`: el tope del PDF y el largo del valor. */
  tope?: number;
  largo?: number;
  /** `rechazado-por-el-pdf`: lo que dijo pdf-lib. `opcion-no-existe`: el valor. */
  detalle?: string;
}

export interface RenderResult {
  pdf: Uint8Array;
  llenados: number;
  /** Todo lo que había que escribir y no se pudo — incluido lo benigno. */
  omitidos: CampoOmitido[];
  /** Los omitidos que de verdad son un PROBLEMA (excluye `sin-campo-en-el-formato`). */
  problemas: CampoOmitido[];
  /**
   * Campos que SÍ se escribieron pero saldrán en letra ilegible.
   *
   * 🔴 Van aparte de `omitidos`/`problemas` a propósito: esos dos significan
   * "no se pudo escribir", y un campo apretado sí se escribió y sí cuenta en
   * `llenados`. Mezclarlos hacía que CUALQUIER campo justo marcara el export
   * entero como problemático — el mismo "enseñar a ignorar el aviso" que este
   * archivo evita en `sin-campo-en-el-formato`.
   */
  ilegibles: CampoOmitido[];
  /** Widgets cuya página no se pudo resolver: NO se pintaron (sólo borrador). */
  widgetsSinPagina: number;
}

/**
 * Escribe las respuestas en el PDF usando el diccionario del formato.
 * No aplana ni pinta: eso lo deciden las dos funciones públicas de abajo.
 */
function aplicarRespuestas(form: PDFForm, answers: Answers, dict: FieldDict) {
  const omitidos: CampoOmitido[] = [];
  const ilegibles: CampoOmitido[] = [];
  let llenados = 0;

  normalizarCasillas(form, answers, dict);

  // 🔴 Se recorren las RESPUESTAS, no el diccionario. El diccionario sólo cubre
  // los campos que el sistema sabe PRE-LLENAR (60 de los 255 de texto de AXA);
  // recorrerlo dejaba fuera todo lo que el doctor escribiera a mano en un campo
  // CRUDO: se guardaba en el JSON y NUNCA aparecía en el PDF. Un informe al que
  // le faltan los campos que el médico tecleó, sin ningún aviso.
  for (const [campoCanonico, respuesta] of Object.entries(answers)) {
    if (!respuesta) continue;
    const vacia = respuesta.value.trim() === '';

    const nombrePdf = nombrePdfDe(campoCanonico, dict);
    // Un valor vacío no escribe nada... salvo en una CASILLA, que hay que poder
    // DESMARCAR: si el PDF base la trae marcada por default, saltarse el vacío
    // dejaría el informe final afirmando algo que el doctor destildó. La casilla
    // se resuelve abajo; para texto, seguir de largo.
    if (vacia && !esPosibleOpcion(form, nombrePdf)) continue;

    if (nombrePdf === null) {
      // ⚠️ Esto es NORMAL, no una falla: el pre-llenado produce ~46 valores
      // canónicos y AXA no pide todos (`paciente.sexo`, `nombreCompleto`…).
      // Va con motivo propio para que la UI no grite "5 campos omitidos" en
      // cada informe sano y acabe enseñándose a ignorar el aviso — que es
      // cuando deja de servir para los omitidos que SÍ importan.
      omitidos.push({ campoCanonico, nombrePdf: '', motivo: 'sin-campo-en-el-formato' });
      continue;
    }

    let field;
    try {
      field = form.getField(nombrePdf);
    } catch {
      // Se nombra un campo que ESTE PDF no tiene: casi siempre el diccionario
      // contra otra versión del formato.
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'no-existe' });
      continue;
    }

    // Una casilla se marca, no se escribe. Cualquier valor no vacío la marca:
    // el JSON guarda `'1'`, pero un `'x'` o un `'sí'` de un informe viejo
    // significan lo mismo y no deben perderse.
    if (field instanceof PDFCheckBox) {
      if (vacia) field.uncheck();
      else { marcarOpcion(field, respuesta.value); llenados++; }
      continue;
    }

    // 🔴 Un grupo de RADIO es lo mismo que un grupo de casillas para el doctor
    // —una pregunta con opciones excluyentes— pero el PDF lo modela aparte y
    // pdf-lib expone otra API. GNP trae 7 (`Genero`, `Tipo de Trámite`,
    // `Causa atención`…) y sin esto la hoja se queda con 7 preguntas que nadie
    // puede contestar, incluido el sexo del paciente.
    //
    // El valor guardado es el de exportación del PDF (`Opción2`), igual que en
    // las casillas se guarda el on-state: así el JSON dice cuál opción se eligió
    // y no hace falta inventar un mapa aparte.
    if (field instanceof PDFRadioGroup) {
      if (vacia) {
        field.clear();
        continue;
      }
      // 🔴 Si el valor no empata con ninguna opción NO se aproxima la más
      // parecida. En un grupo excluyente eso es afirmarle a la aseguradora algo
      // que el médico no eligió — la misma regla que ya rige para las etiquetas
      // que el modelo devuelve (06-AGENTE §12).
      const elegida = field.getOptions().find((o) => empataOpcion(respuesta.value, o));
      // 🔴 Si `getOptions()` no lo reconoce, se intenta contra los ON-STATES
      // antes de rendirse: son lo que guarda el resto del motor y en Zurich las
      // dos listas NO coinciden (ver `marcarPorOnState`). Sin esta vía, sus 15
      // grupos se limpiaban y la respuesta del médico no llegaba al PDF.
      if (elegida === undefined && marcarPorOnState(field, respuesta.value)) {
        llenados++;
        continue;
      }
      if (elegida === undefined) {
        // 🔴 Y se APAGA antes de reportarlo. `normalizarCasillas` no lo tocó
        // —el campo tiene respuesta, así que cuenta como "contestado"— y si
        // además se sale por aquí sin limpiar, lo que sobrevive al aplanado es
        // la preselección DE FÁBRICA del PDF. Medido en el GNP oficial: un valor
        // que no empata dejaba `Relación otro padecimiento = Opción1`, o sea la
        // hoja afirmándole a la aseguradora un "Sí" que nadie contestó — el bug
        // que este mismo cambio venía a cerrar, por una tercera puerta.
        field.clear();
        omitidos.push({ campoCanonico, nombrePdf, motivo: 'opcion-no-existe', detalle: respuesta.value });
        continue;
      }
      try {
        field.select(elegida);
        llenados++;
      } catch (e) {
        omitidos.push({
          campoCanonico, nombrePdf, motivo: 'rechazado-por-el-pdf',
          detalle: e instanceof Error ? e.message : String(e),
        });
      }
      continue;
    }

    if (!(field instanceof PDFTextField)) {
      // Existe, pero es una firma o un botón. Antes esto caía en el mismo saco
      // que "no existe" y el diagnóstico salía equivocado.
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'no-es-de-texto' });
      continue;
    }

    // 🔴 ANTES de escribir: si el texto trae algo que WinAnsi no codifica, el
    // `save()` de más abajo truena y se cae el informe ENTERO. Se omite ESTE
    // campo y se reporta con el carácter culpable, sin reescribir nada.
    const malos = caracteresNoImprimibles(respuesta.value);
    if (malos.length > 0) {
      omitidos.push({ campoCanonico, nombrePdf, motivo: 'caracteres-no-imprimibles', caracteres: malos });
      continue;
    }

    // 🔴 `maxLength` del PROPIO campo: es un tope DURO del PDF, distinto del
    // visual de `capacidadDeCaja`. Las 7 cajas de fecha de AXA lo declaran en 8
    // porque quieren `ddmmaaaa` — sin separadores. Escribirles `03/03/2026` (10)
    // hace que `setText` LANCE, y con eso se cae el informe ENTERO: es la causa
    // de que no se pudiera bajar ni el borrador ni el final.
    const tope = field.getMaxLength();
    let texto = respuesta.value;
    if (tope !== undefined && texto.length > tope) {
      // Una fecha `dd/mm/aaaa` cabe en 8 si se le quitan las barras, y eso NO
      // pierde información: es el formato que la hoja pide.
      //
      // 🔴 Y lo mismo vale para un TELÉFONO. Medido contra los 8 doctores de
      // prod con `clinic_phone`: `55 5280 4422`, `333 848 6234` y
      // `+52 3311846091` pasan de 10 caracteres y se omitían enteros, así que
      // 3 de 8 recibían un informe de MetLife SIN el teléfono del consultorio
      // (su caja declara `maxLength = 10`). Quitar espacios, guiones y
      // paréntesis no pierde ni un dígito; el `+52` sí es información, pero
      // sólo se descarta cuando sin él SÍ cabe y son los 10 dígitos nacionales.
      const sinSeparadores = texto.replace(/[/\-.\s()]/g, '');
      const soloDigitos = sinSeparadores.replace(/^\+?52/, '');
      if (/^\d{2}\d{2}\d{4}$/.test(sinSeparadores) && sinSeparadores.length <= tope) {
        texto = sinSeparadores;
      } else if (/^\d+$/.test(sinSeparadores) && sinSeparadores.length <= tope) {
        // Puro dígito y ya cabe sin la puntuación: `55 5280 4422` → `5552804422`.
        texto = sinSeparadores;
      } else if (/^\d{10}$/.test(soloDigitos) && soloDigitos.length <= tope) {
        // `+52 33 1184 6091` → `3311846091`: el lada del país se cae sólo si lo
        // que queda son exactamente los 10 dígitos nacionales.
        texto = soloDigitos;
      } else {
        // NUNCA se recorta a ciegas: media fecha o medio diagnóstico es peor que
        // un hueco, y en un documento médico-legal es una afirmación falsa.
        omitidos.push({ campoCanonico, nombrePdf, motivo: 'no-cabe-en-el-campo', tope, largo: texto.length });
        continue;
      }
    }

    // 🔴 Y aun así, un `setText` que lance NO puede tumbar el documento. Es la
    // misma regla que ya rige para WinAnsi: se omite ESE campo y se reporta.
    // Sin esto, cualquier restricción del PDF que no hayamos previsto (formato,
    // comb, validación) vuelve a dejar al doctor sin poder bajar NADA.
    try {
      field.setText(texto);
    } catch (e) {
      omitidos.push({
        campoCanonico, nombrePdf, motivo: 'rechazado-por-el-pdf',
        detalle: e instanceof Error ? e.message : String(e),
      });
      continue;
    }
    llenados++;
    // Los `comb` van SIEMPRE en automático: con un tamaño fijo pdf-lib no dibuja
    // NADA, y dos campos de AXA ya vienen así de fábrica (ver la función).
    if (field.isCombed()) forzarTamanoAutomatico(field);

    // 🔴 `pdf-lib` no recorta: encoge la letra hasta 3 pt y desborda. El valor SÍ
    // se escribe (borrarlo sería perder lo que tecleó el médico), pero se reporta
    // para que la UI diga "esto no se va a poder leer" — nunca en silencio.
    // 🔴 Se toma el recuadro donde PEOR cabe, entre los MEDIBLES.
    //
    // pdf-lib ajusta el tamaño de letra de cada recuadro por separado: si el
    // campo tiene uno de 43 pt y otro de 300, el texto sale ilegible en el chico
    // aunque en el grande se lea. Quedarse con el mejor caso silenciaba
    // justamente el recuadro que sale mal — y el visor, que mide cada uno, lo
    // pintaba en rojo: las dos superficies contradiciéndose otra vez.
    //
    // Los inmensurables (ancho/alto <= 0, muñones ocultos) se SALTAN: si se
    // contaran, su `sobran: 0` ganaría y callaría al campo entero.
    let peor: { excede: boolean; sobran: number } | null = null;
    for (const w of field.acroField.getWidgets()) {
      const r = rectDelWidget(w);
      const cap = capacidadDeCaja(r.ancho, r.alto, field.isMultiline(), respuesta.value.length);
      if (!Number.isFinite(cap.maximo)) continue;
      if (!peor || cap.sobran > peor.sobran) peor = cap;
    }
    if (peor?.excede) {
      ilegibles.push({ campoCanonico, nombrePdf, motivo: 'no-cabe', sobran: peor.sobran });
    }
  }
  return { omitidos, ilegibles, llenados };
}

/**
 * 🔴🔴 EL TOPE DE TAMAÑO DE LETRA — y por qué se hace en DOS pasadas.
 *
 * El problema: `pdf-lib` deja los campos en tamaño AUTOMÁTICO y su generador
 * estira el texto hasta llenar el recuadro. Medido en el GNP oficial, la palabra
 * `Migraña` en la caja de `Diagnóstico Definitivo` (407×64) salía a **56 pt**.
 *
 * 🔴 Lo que NO se puede hacer es estimar el tamaño uno mismo y fijarlo. Con el
 * tamaño en `0`, `layoutMultilineText`/`layoutSinglelineText` **miden las
 * glifos de verdad y encogen hasta que quepa**: sale chiquito, pero **completo**.
 * En cuanto se fija un tamaño, esas funciones **no comprueban nada** y lo que
 * sobra se dibuja fuera del recorte del widget y **desaparece sin aviso**. Una
 * estimación optimista (ancho medio 0.5 em, sin contar el borde ni el ajuste por
 * palabras) convierte "se lee chico" en "falta media frase" — en un documento
 * médico-legal, exactamente al revés de lo que queremos.
 *
 * ⇒ La regla segura: **NO calcular; sólo BAJAR lo que pdf-lib ya calculó.**
 *
 *   1ª pasada: `updateFieldAppearances()` — pdf-lib mide y escribe en el `/DA`
 *              de cada campo el tamaño que SÍ cabe.
 *   se lee ese tamaño; si supera `PT_MAXIMO`, se baja a `PT_MAXIMO`.
 *   2ª pasada: la que hace `flatten()` — dibuja con el tamaño ya acotado.
 *
 * Es seguro **por construcción**: sólo se reduce, y un texto que cabe a 20 pt
 * cabe a 11 (menos ancho por línea y menos líneas). Nunca se sube nada, así que
 * es imposible provocar un recorte.
 */
function acotarTamanosDeLetra(form: PDFForm) {
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    // Los `comb` van SIEMPRE en automático (ver `forzarTamanoAutomatico`).
    if (field.isCombed()) continue;

    // ⚠️ El tamaño puede vivir en el WIDGET y no en el campo: pdf-lib resuelve
    // `widgetFontSize ?? fieldFontSize` y **el widget no hereda del padre**. Si
    // sólo se acotara el campo, un widget con `/DA` propio ganaría y el tope
    // sería un no-op silencioso.
    const objetivos: Array<{ leer: () => string | undefined; escribir: (da: string) => void }> = [];
    for (const w of field.acroField.getWidgets()) {
      if (w.getDefaultAppearance()) {
        objetivos.push({ leer: () => w.getDefaultAppearance() ?? undefined, escribir: (da) => w.setDefaultAppearance(da) });
      }
    }
    if (objetivos.length === 0) {
      objetivos.push({
        leer: () => field.acroField.getDefaultAppearance() ?? undefined,
        escribir: (da) => field.acroField.setDefaultAppearance(da),
      });
    }

    for (const o of objetivos) {
      const da = o.leer();
      if (!da) continue;
      const m = /(\/[^\s]+\s+)([\d.]+)(\s+Tf)/.exec(da);
      if (!m) continue;
      const actual = Number(m[2]);
      // `0` es automático: ya se resolvió en la 1ª pasada, y si sigue en 0 es que
      // el campo está vacío. Nada que acotar.
      if (!(actual > PT_MAXIMO)) continue;
      try {
        o.escribir(da.replace(m[0], `${m[1]}${PT_MAXIMO}${m[3]}`));
        // 🔴 Sin esto el tope es un NO-OP silencioso. La 1ª pasada ya dejó
        // GENERADO el stream de apariencia a 56 pt, y tanto `flatten()` como
        // `updateFieldAppearances()` sólo REGENERAN los campos marcados como
        // sucios: el `/DA` decía 11 y la hoja seguía imprimiendo 56.
        form.markFieldAsDirty(field.ref);
      } catch {
        // Nunca se tumba el documento por un tamaño de letra.
      }
    }
  }
}


/**
 * Pone el tamaño de letra en AUTOMÁTICO (`0 Tf`) conservando la fuente.
 *
 * 🔴🔴 Es OBLIGATORIO en los campos `comb`, y costó caro descubrirlo. Un comb
 * reparte los caracteres en `maxLength` celdas de ancho fijo y `pdf-lib` calcula
 * él mismo el tamaño; con uno FIJO su generador **no dibuja nada**: el valor
 * sigue en el `/V` —`getText()` lo devuelve— pero el PDF aplanado sale VACÍO ahí.
 *
 * Y no basta con no tocarlos: **dos campos del AXA oficial ya vienen con tamaño
 * fijo de fábrica** (`Día_2` y `Día_3`, `/Helv 10 Tf`) y por eso **nunca han
 * impreso nada, con ningún valor, desde que existe la funcionalidad** — 2 de las
 * 7 cajas de fecha de la hoja que más se usa. Verificado: con `0 Tf` imprimen.
 */
function forzarTamanoAutomatico(field: PDFTextField) {
  for (const objetivo of [
    ...field.acroField.getWidgets().filter((w) => w.getDefaultAppearance()),
    field.acroField,
  ]) {
    const da = objetivo.getDefaultAppearance();
    if (!da) continue;
    // `/Helv 10 Tf 0 g` -> `/Helv 0 Tf 0 g`. Se conserva la FUENTE del formato:
    // es la que su `/DR` declara.
    const auto = da.replace(/(\/[^\s]+\s+)[\d.]+(\s+Tf)/, '$10$2');
    if (auto === da) continue;
    try {
      objetivo.setDefaultAppearance(auto);
    } catch {
      // Nunca se tumba el documento por un tamaño de letra.
    }
  }
}

/**
 * 🔴 Apaga TODA casilla que el doctor no haya contestado.
 *
 * La hoja "en blanco" de AXA **no viene en blanco**: 9 de sus 22 casillas traen
 * un valor de fábrica (`Consultorio_2 = /1`, `Se ajusta a Tabulador médico =
 * /On`, `Sí_5`, `No_6`, `MAM`…). Como el render sólo tocaba los campos con
 * respuesta, esas marcas sobrevivían al aplanado y el informe **afirmaba cosas
 * que el médico nunca eligió** — incluida una declaración de facturación. Es
 * exactamente lo que prohíbe la regla de 01-FUENTES §4: sin fuente, vacío.
 *
 * Se apagan ANTES de aplicar las respuestas, así que lo que el doctor sí marcó
 * se vuelve a encender enseguida.
 */
function normalizarCasillas(form: PDFForm, answers: Answers, dict: FieldDict) {
  // Los campos del PDF que SÍ tienen respuesta del doctor.
  const contestados = new Set<string>();
  for (const [clave, r] of Object.entries(answers)) {
    if (!r || r.value.trim() === '') continue;
    const nombre = nombrePdfDe(clave, dict);
    if (nombre) contestados.add(nombre);
  }

  for (const field of form.getFields()) {
    const esCasilla = field instanceof PDFCheckBox;
    // 🔴 Los RADIOS vienen de fábrica igual que las casillas: el GNP oficial
    // trae `Relación otro padecimiento` preseleccionado en `Opción1`. Como el
    // apagado sólo miraba `PDFCheckBox`, esa marca sobrevivía al aplanado y el
    // informe le afirmaba a la aseguradora una respuesta que el médico nunca
    // dio — el mismo bug de las 9 casillas de AXA, por la otra puerta.
    const esRadio = field instanceof PDFRadioGroup;
    if (!esCasilla && !esRadio) continue;
    if (contestados.has(field.getName())) continue;
    // `uncheck()`/`clear()` y no tocar el dict a mano: marcan el campo como
    // sucio, y eso hace que `flatten()` le regenere una apariencia /Off. Varias
    // casillas de AXA no traen apariencia /Off propia y, sin regenerarla,
    // aplanar truena.
    try {
      if (esCasilla) field.uncheck();
      else field.clear();
    } catch {
      // Una opción que no se deja apagar no debe tumbar el informe entero.
    }
  }
}

/**
 * Marca UNA opción de un grupo de casillas.
 *
 * 🔴 `check()` de pdf-lib pone el on-state del PRIMER recuadro, así que en un
 * grupo (`MAM` = `/M` `/A` `/E` `/S`) siempre marcaba el primero sin importar
 * cuál eligió el doctor. El valor guardado ES el on-state, que es como el PDF
 * lo modela: un valor por campo que dice qué recuadro está encendido.
 *
 * `valor` que no empate con ningún on-state (p.ej. el `'1'` que guardó una
 * versión anterior) cae a `check()`, que al menos marca el primero en vez de
 * perder la respuesta.
 */
function marcarOpcion(field: PDFCheckBox, valor: string) {
  const elegido = marcarPorOnState(field, valor);
  // Sin on-state que empate, una casilla suelta se marca igual: el JSON guarda
  // `'1'`, pero un `'x'` o un `'sí'` de un informe viejo significan lo mismo.
  if (!elegido) field.check();
}

/**
 * Pone `/V` y los `/AS` a partir del ON-STATE de los recuadros. Devuelve `true`
 * si alguno empató.
 *
 * 🔴 Sirve para CASILLAS **y para RADIOS**, y lo segundo no es teórico: el
 * `getOptions()` de pdf-lib y los on-states reales pueden NO coincidir, y
 * entonces el motor se contradice consigo mismo. Medido:
 *
 *   GNP    `Genero`  → getOptions() ["M","F"]                    · on-states ["M","F"]   ✅ iguales
 *   Zurich `Group10` → getOptions() ["Opción1","Opción1","Opción2","Opción2"] · on-states ["0","1"]  🔴
 *
 * El resto del motor —el catálogo del asistente, el visor, `etiquetasDeLaHoja`—
 * guarda el ON-STATE (`"0"`). Con `getOptions()` como única vía, ese valor no
 * empataba con nada, el grupo se LIMPIABA y la elección del médico no llegaba al
 * PDF: los 15 grupos de Zurich, en silencio, con `problemas` contándolos y
 * ninguna UI enseñándolos. Es la misma familia que el `S#ED` de GNP — dos
 * mitades del motor leyendo la misma opción de dos maneras.
 *
 * ⚠️ **Límite conocido, anotado sin arreglar a medias:** esta vía hace que un
 * `'1'` de LEGADO —el `?? '1'` de `InformeVisor` y los informes viejos que
 * guardaban `'1'` por "marcada"— EMPATE con el on-state `"1"` de una hoja cuyos
 * estados son `"0"`…`"3"` (Zurich), y marque la SEGUNDA opción en vez de
 * reportarse como `opcion-no-existe`. Hoy no se alcanza: todos los recuadros de
 * Zurich traen on-state definido, así que ese `?? '1'` nunca dispara, y no hay
 * informes de Zurich (el formato no existía). Se deja escrito porque convierte
 * un fallo RUIDOSO en una respuesta silenciosamente equivocada, y el arreglo
 * —distinguir "valor de legado" de "on-state real"— pide un dato que hoy no se
 * guarda en `answers`.
 */
function marcarPorOnState(field: PDFCheckBox | PDFRadioGroup, valor: string): boolean {
  const widgets = field.acroField.getWidgets();
  const estados = widgets.map((w) => onStateDelWidget(w));

  // Tolera que un informe viejo haya guardado el nombre ESCAPADO del PDF
  // (`S#ED`) en vez del texto (`Sí`).
  const elegido = estados.find((e) => e !== undefined && empataOpcion(valor, e));
  if (elegido === undefined) return false;

  const on = PDFName.of(elegido);
  field.acroField.dict.set(PDFName.of('V'), on);
  widgets.forEach((w, i) => {
    w.dict.set(PDFName.of('AS'), estados[i] === elegido ? on : PDFName.of('Off'));
  });
  return true;
}

/**
 * ¿Ese nombre es un campo de OPCIONES (casilla o radio) de este formato?
 * Barato y sin tirar.
 *
 * Importa para el valor VACÍO: en un campo de texto no escribir nada da igual,
 * pero una opción hay que poder DESMARCARLA. Si el vacío se saltara, una opción
 * que el PDF trae puesta de fábrica y el doctor destildó saldría marcada en el
 * informe final.
 */
function esPosibleOpcion(form: PDFForm, nombrePdf: string | null): boolean {
  if (nombrePdf === null) return false;
  try {
    const f = form.getField(nombrePdf);
    return f instanceof PDFCheckBox || f instanceof PDFRadioGroup;
  } catch {
    return false;
  }
}

/** Los omitidos que hay que enseñarle a alguien. */
function soloProblemas(omitidos: CampoOmitido[]): CampoOmitido[] {
  return omitidos.filter((o) => o.motivo !== 'sin-campo-en-el-formato');
}

/**
 * ¿Este campo ya tiene algo? Decide el color del borrador.
 *
 * 🔴 No basta con `getText()`: **sólo los campos de texto lo tienen**. Una
 * casilla usa `isChecked()` y un desplegable `getSelected()`, así que
 * preguntarles por `getText` devuelve `undefined` y las 45 casillas de AXA
 * saldrían en AZUL —"aquí se puede escribir"— aunque estuvieran marcadas.
 */
function tieneContenido(field: PDFField): boolean {
  try {
    if (field instanceof PDFTextField) return (field.getText() ?? '').trim() !== '';
    if (field instanceof PDFCheckBox) return field.isChecked();
    if (field instanceof PDFRadioGroup) return field.getSelected() !== undefined;
    if (field instanceof PDFDropdown) return field.getSelected().length > 0;
    if (field instanceof PDFOptionList) return field.getSelected().length > 0;
  } catch {
    // Un campo con la apariencia corrupta no debe tumbar el borrador entero.
    return false;
  }
  return false;
}

/**
 * FINAL — el PDF que se descarga o se le manda al paciente.
 * Aplanado: los campos dejan de existir y el informe firmado no se puede editar.
 */
export async function renderFinal(
  pdfBase: Uint8Array | ArrayBuffer,
  answers: Answers,
  dict: FieldDict
): Promise<RenderResult> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const { omitidos, ilegibles, llenados } = aplicarRespuestas(form, answers, dict);

  // 1ª pasada: pdf-lib mide y deja en cada `/DA` el tamaño que SÍ cabe; luego se
  // acota lo que salga gigante. Ver `acotarTamanosDeLetra`.
  form.updateFieldAppearances();
  acotarTamanosDeLetra(form);

  // 🔴 Sin esto el informe llega EDITABLE a la aseguradora. (Y de paso hace la
  // 2ª pasada de apariencias, ya con los tamaños acotados.)
  form.flatten();

  return { pdf: await pdf.save(), llenados, omitidos, problemas: soloProblemas(omitidos), ilegibles, widgetsSinPagina: 0 };
}

/**
 * BORRADOR — sólo para el médico.
 *
 * Dos capas de color: azul donde se puede escribir, verde donde ya hay algo.
 * Resuelve la pregunta real al abrir un formato de 277 campos: *¿dónde escribo
 * y qué ya está hecho?*
 *
 * ⚠️ SÓLO LECTURA a propósito. Los colores se pintan al generar (son una foto:
 * un PDF no reacciona, escribir en un campo azul no lo pone verde). Y si el
 * doctor pudiera teclear aquí, ese valor viviría sólo en este archivo — fuera
 * del JSON de respuestas — y al regenerar el borrador desaparecería en silencio.
 * Se edita en la app; esto es para revisar e imprimir.
 */
export async function renderBorrador(
  pdfBase: Uint8Array | ArrayBuffer,
  answers: Answers,
  dict: FieldDict
): Promise<RenderResult> {
  const pdf = await PDFDocument.load(pdfBase);
  const form = pdf.getForm();
  const { omitidos, ilegibles, llenados } = aplicarRespuestas(form, answers, dict);

  // El MISMO tope que el final: el borrador es la superficie de revisión, y si
  // enseñara la palabra a 56 pt y el final a 11 el doctor estaría revisando una
  // hoja distinta de la que se manda.
  form.updateFieldAppearances();
  acotarTamanosDeLetra(form);
  form.updateFieldAppearances();

  const pages = pdf.getPages();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  let widgetsSinPagina = 0;

  for (const field of form.getFields()) {
    const lleno = tieneContenido(field);

    field.enableReadOnly();

    for (const widget of field.acroField.getWidgets()) {
      const r = rectDelWidget(widget);
      // `/P` es OPCIONAL en el spec y muchos generadores no lo ponen. Cuando
      // falta hay que buscar la página que referencia al widget — es lo que
      // hace `flatten()` por dentro, y por eso el FINAL sí funciona en PDFs
      // donde el borrador se quedaba sin pintar NADA (277 widgets, 0 recuadros,
      // reportado sólo como un contador que ninguna UI lee todavía).
      // ⚠️ `findPageForAnnotationRef` devuelve una **PDFPage**, no una PDFRef.
      // Mezclarlas compila (la unión se traslapa) y la comparación con `p.ref`
      // es SIEMPRE falsa: el fallback quedaría de adorno.
      const pRef = widget.P();
      const porP = pRef ? pages.find((p) => p.ref === pRef) : undefined;
      const widgetRef = porP ? undefined : pdf.context.getObjectRef(widget.dict);
      const page = porP ?? (widgetRef ? pdf.findPageForAnnotationRef(widgetRef) : undefined);
      // Sin página no se pinta: hacerlo en la 1 con las coordenadas de OTRA
      // tira recuadros de color encima del texto impreso, sin ninguna señal.
      if (!page) { widgetsSinPagina++; continue; }
      page.drawRectangle({
        x: r.x,
        y: r.y,
        width: r.ancho,
        height: r.alto,
        color: lleno ? COLOR_LLENO : COLOR_VACIO,
        opacity: 0.55,
        borderWidth: 0,
      });
    }
  }

  // Aviso + leyenda arriba de la primera página.
  const p1 = pages[0];
  const { width, height } = p1.getSize();
  p1.drawRectangle({ x: 0, y: height - 26, width, height: 26, color: rgb(1, 0.95, 0.95), opacity: 0.95 });
  p1.drawText('BORRADOR — sólo lectura. Se edita en la app. NO enviar a la aseguradora.', {
    x: 14, y: height - 17, size: 9, font, color: rgb(0.7, 0.1, 0.1),
  });
  p1.drawRectangle({ x: 330, y: height - 21, width: 16, height: 9, color: COLOR_VACIO });
  p1.drawText('se puede escribir', { x: 350, y: height - 19, size: 7.5, font, color: rgb(0.25, 0.25, 0.3) });
  p1.drawRectangle({ x: 448, y: height - 21, width: 16, height: 9, color: COLOR_LLENO });
  p1.drawText('ya tiene contenido', { x: 468, y: height - 19, size: 7.5, font, color: rgb(0.25, 0.25, 0.3) });

  return { pdf: await pdf.save(), llenados, omitidos, problemas: soloProblemas(omitidos), ilegibles, widgetsSinPagina };
}
