# 08 — ALTA de un formato nuevo: el procedimiento repetible

> Tipo **PROCEDIMIENTO**. Escrito el **2026-08-14**, al empezar la segunda aseguradora.
> Sucede a AXA, que se hizo a mano. Aquí está lo que hay que hacer para la #2 y para la #20.
> 🟢 La herramienta existe: `apps/doctor/scripts/alta-formato.ts`.

## 0. Por qué existe este documento

AXA salió bien, pero salió **en scripts de un solo uso que se tiraron al cerrar cada sesión**
(`SESSION-REFRESCO`: *"si hacen falta otra vez, se reescriben en 5 minutos"*). Eso es cierto para
el script y falso para lo que el script sabía: las trampas se descubrieron una por una, a lo largo
de tres sesiones, varias de ellas en producción. La aseguradora #3 las volvería a descubrir.

⇒ La derivación vive en el repo, **con las trampas dentro**, y este documento dice cómo se usa.

## 1. Lo que cuesta agregar una aseguradora — cuatro cosas

| # | Pieza | Dónde |
|---|---|---|
| 1 | El PDF oficial | `apps/doctor/public/formatos/<archivo>.pdf` |
| 2 | El diccionario tonto `canónico → campo AcroForm` | `src/lib/informe-medico/dicts/<slug>.ts` |
| 3 | Una entrada en `FORMATOS[]` | `src/lib/informe-medico/formatos/index.ts` |
| 4 | Una fila en `insurance_forms` | SQL manual + `prisma db execute` |

🟢 **Nada más.** Pre-llenado, canónico, render, `flatten`, visor, chat, casillas, procedencia,
WinAnsi y `maxLength` **ya son agnósticos de la aseguradora**. `formatoDe()` empata por
`insurer|name|version` y no hay un solo `if` por aseguradora en el motor. Eso es lo que hace que
la #2 sea barata — y es la razón por la que el canónico existe (04-MAPEO §1).

## 2. Los pasos

```bash
# 1. Medir el PDF y sacar el reporte completo
npx tsx scripts/alta-formato.ts inspeccionar <ruta.pdf>

# 2. SÓLO si el oficial es PLANO (0 campos, caso Allianz):
npx tsx scripts/alta-formato.ts campos <plano.pdf> <salida.pdf>
npx tsx scripts/alta-formato.ts inspeccionar <salida.pdf>   # y otra vez el reporte

# 3. Escribir dicts/<slug>.ts corrigiendo la propuesta, y agregar la entrada a FORMATOS

# 4. Generar el SQL DESDE el diccionario — nunca a mano
#    ⚠️ La clave es la del formato NUEVO. Copiar la de AXA aquí escribe el
#    INSERT de AXA dentro del archivo de otra aseguradora, y aplicarlo
#    re-actualiza AXA contra prod.
npx tsx scripts/alta-formato.ts sql "<insurer>|<name>|<version>" > \
  packages/database/prisma/migrations/seed-formato-<slug>.sql

# (sin argumentos lista las claves dadas de alta en el repo)
npx tsx scripts/alta-formato.ts sql
```

Y después, lo que ningún script cubre: **abrir el visor y mirar la hoja**, llenar un informe de
punta a punta y **abrir el PDF**.

## 3. Lo que el reporte revisa por ti

Cada renglón de esta lista es un bug que ya pasó una vez.

| Comprobación | De dónde salió |
|---|---|
| **¿Se puede LEER el archivo?** 0 operadores ⇒ está roto | Allianz, 2026-08-14 (§5) |
| ¿Es un escaneo? (imágenes y cero texto) | El caso caro de 03-FORMATOS §4 |
| `Producer` / `Creator` / fechas **sin que pdf-lib los pise** | §4 |
| Página rotada o con CropBox desplazado | El visor devuelve `cajas: []` y no dibuja nada |
| **`maxLength`** por campo | Las 7 cajas `ddmmaaaa` de AXA que tumbaban TODO el PDF |
| **Casillas marcadas de fábrica** | Las 9 de AXA, una de ellas de facturación |
| Cajas donde no cabe nada legible a 6 pt | `capacidad.ts` |
| Nombres de campo fuera de WinAnsi | El campo no se imprime y se omite |
| Nombres repetidos (un campo, varios recuadros) | Marcar uno marca a sus hermanos |
| **Qué casillas puede proponer el asistente, y cuáles NO** | §6 — el peor bug que ha tenido esto |
| Propuesta de diccionario contra el canónico | El trabajo manual que queda |

## 4. 🔴 `updateMetadata: false`, o la herramienta se acusa a sí misma

`PDFDocument.load()` **reescribe `/Producer` a `pdf-lib` y `/ModDate` a AHORA nada más abrir el
archivo**, en memoria. Medido sobre el AXA del repo:

| Cómo se lee | Producer | ModDate |
|---|---|---|
| `load(bytes)` — el default | `pdf-lib` | hoy |
| `load(bytes, { updateMetadata: false })` | **`Adobe PDF Library 16.0.5`** | **2022-08-30** |

Importa porque el `Producer` es **la huella con la que 03-FORMATOS §2 distingue el PDF oficial del
de un tercero que le puso campos**. Sin la bandera, la herramienta acusa de intermediario a todos
los formatos, incluido el que se acaba de bajar de la aseguradora. Pasó: la primera corrida sobre
el Allianz oficial dijo "este archivo no es el que publicó la aseguradora" y era mentira.

> 🔎 **Lección:** una herramienta de medición que modifica lo que mide no da un dato, da un
> artefacto. Y el artefacto tenía exactamente la forma del hallazgo que buscábamos.

## 5. 🔴 Un PDF roto NO se ve roto (Allianz, 2026-08-14)

El Allianz oficial que se bajó ese día abría perfecto: 3 páginas, 612×792, rot 0, sin cifrar,
`Adobe PDF library 15.00`, creado 2023-02-27 — **todos los metadatos correctos**. Y `pdf-lib` lo
cargaba sin una queja.

Lo que no se podía era leerlo:

```
Warning: Indexing all PDF objects                    ← el xref está roto, pdf.js lo reconstruye
Warning: Invalid stream: "Bad FCHECK in flate stream: 72, 239"   ← ×6
⇒ 0 operadores y 0 items de texto en las 3 páginas
```

Los streams de contenido tienen cabecera zlib inválida. El archivo se dañó en la descarga.

🔴 **Por qué esto merece una comprobación propia:** el síntoma que se ve es
**"0 reglas detectadas"**, y eso se lee como *este formato no se puede automatizar* — que manda a
escribir un extractor nuevo. La causa real era *el archivo está roto*, que manda a volver a bajarlo.
Son dos conclusiones opuestas a partir del mismo número, y la cara es la equivocada.

⚠️ Y hay que **mirar los warnings de pdf.js**. Estuvieron ahí desde la primera corrida, filtrados
con un `grep -v Warning` porque el `standardFontDataUrl` es ruido. El diagnóstico estaba impreso en
pantalla y tapado a propósito.

## 6. 🔴 Lo que el humano tiene que decidir, formato por formato

El script **propone**. Estas tres cosas no se automatizan y hay que mirarlas en cada aseguradora:

### a) El diccionario

Medido contra el AXA hecho a mano (20 escalares): la propuesta acertó **13**, se declaró **ambigua
en 4**, se calló **1** que no podía saber, y **discrepó en 1** marcándolo como empate débil.
**Cero elecciones equivocadas en silencio** — que es el único comportamiento aceptable aquí.

Los dos que se negó a elegir son justo los que necesitaron cabeza humana:
- `informe.fecha` → el campo se llama **`Información general`** (el generador del PDF le agarró la
  etiqueta equivocada); se resolvió por geometría, no por nombre.
- `clinico.tratamiento` → hay 12 candidatos, y `plan` es tratamiento **propuesto**, no el
  `Tratamiento recibidoRow1` de la tabla, que es **pasado**. Mapearlo ahí diría algo falso.

⚠️ **No forzar equivalencias.** `Diagnóstico` de AXA (10 renglones) y `Diagnóstico Definitivo` de
GNP (uno) no son el mismo concepto clínico (04-MAPEO §1).

### b) Las casillas que el asistente puede marcar

`casillasParaElAgente()` filtra consentimientos y facturación **con una regex en español**
(`autoriz|acepto|consent|tabulador|firma|datos personales|…`). Una aseguradora nueva puede
redactar su consentimiento con otras palabras, y entonces **el filtro no lo agarra y nadie se
entera**. El reporte marca los grupos permitidos que suenan a consentimiento, para revisarlos.

Esto es el peor bug que ha tenido la funcionalidad: el modelo podía marcar
*"Autorizo el tratamiento y transferencia de mis datos personales"* de la página del PACIENTE, el
doctor daba un solo Guardar, y el PDF aplanado afirmaba una autorización que nadie firmó.

> 🔎 **Lección (06-AGENTE §12):** derivar el catálogo *de la hoja* lo hace COMPLETO, y completo
> incluye cosas que ningún agente debe firmar. **"Qué campos existen" y "cuáles son suyos" son dos
> preguntas distintas.**

### c) Que las cajas caigan en su raya

Sólo se ve con los ojos. Los números pueden cuadrar (60/60 ubicadas, nada fuera de la hoja) y la
hoja verse mal en un navegador al 130%.

## 7. El estado de cada aseguradora

| | PDF oficial | Estado |
|---|---|---|
| **AXA** | ✅ ya trae 277 campos | 🟢 **EN PROD y funcionando** |
| **Allianz** | ✅ bajado del portal de Allianz el 2026-08-14 · **PLANO** (0 campos) | 🟡 **construido, sin desplegar y SIN MIRAR** |
| **GNP** | ⚠️ el de Eleonor (3 pág) y el oficial (2 pág) son documentos **distintos** | ⛔ bloqueado en el usuario: cuál rige |

### Allianz — lo que quedó (2026-08-14)

La primera copia que se bajó estaba **corrupta** (§5); la buena se bajó del portal de documentos de
Allianz. Tras deduplicar las rayas encimadas (§9): **57 reglas → 52 campos de texto**, 41 por la
izquierda + 11 por arriba, 5 sin etiqueta, 0 no creados, **más 14 grupos de casillas (33 recuadros)**.

| Pieza | |
|---|---|
| `public/formatos/allianz-gmm-informe-medico-2023-02.pdf` | el oficial CON los campos que le pusimos |
| `dicts/allianz.ts` | **12** entradas, todas verificadas a mano |
| Entrada en `FORMATOS` | `Allianz \| GMM Informe Médico \| FEBRERO 2023`, `camposPropios: true` |
| `migrations/seed-formato-allianz.sql` | generado desde el diccionario · **NO aplicado a prod** |

**Probado con el motor real** (pre-llenado → `renderFinal` → `flatten` → leer el PDF de vuelta):
12 campos escritos, **0 problemas**, **0 ilegibles**, **0 campos vivos** tras aplanar, y los
acentos intactos (`Muñoz`, `Peña`, `María de los Ángeles`).

### 🔴 En un formato plano, MUCHOS huecos no tienen raya (2026-08-14)

La premisa del extractor era *"donde se escribe hay una raya dibujada"*. **En Allianz es falsa en
la mayoría de los huecos**, y sólo se descubrió cuando el usuario abrió la hoja en la app y no pudo
escribir. Tres familias, y ninguna deja rastro en el operator list:

| Familia | Cómo se detecta | Cuántas en Allianz |
|---|---|---|
| **Fechas** | la corrida de guías `DD MM AAAA` impresas | **18** |
| **Importes** | la etiqueta que termina en `$` | **3** |
| **Opciones** | el glifo `□` (U+25A1) | **33** en 14 grupos |

**Las fechas son el caso que más duele.** Toda la rejilla de antecedentes patológicos —cáncer,
obesidad, diabetes, neurológicas, cardíacos, hepáticos, hipertensivos, VIH/SIDA— pide una fecha por
renglón, y en esa zona de la hoja hay exactamente **2 rayas**. Las celdas están dibujadas como
tabla. Resultado antes del arreglo: el doctor no podía escribir **ni una sola fecha** en el informe,
y el pre-llenado no tenía dónde escribir tampoco.

Los **importes** son los tres honorarios de «Programación de Cirugía» (`Cirujano $`, `Ayudante $`,
`Anestesista $`): el presupuesto con el que la aseguradora autoriza el procedimiento. El hueco va
después del `$` y llega hasta la siguiente etiqueta del renglón, o hasta el margen.

> 🔎 **La lección, transferible al siguiente formato plano:** "no se detectó ninguna raya" y "aquí
> no se escribe" no son lo mismo. Antes de dar por bueno un formato hay que contar los huecos
> **contra lo que la hoja pregunta**, no contra lo que el extractor encontró. Los tres conteos
> salen ahora en el reporte de `alta-formato` justo para eso.

### ✅ Y las CASILLAS de un formato plano también se deducen (2026-08-14)

Primero se dio por hecho que un formato plano no podía tener casillas —la colocación automática
sólo creaba campos de TEXTO— y se anotó como limitación. **Era falso, igual que cuando se dijo lo
mismo de AXA.** Las opciones están impresas como el glifo **`□` (U+25A1)** en la capa de texto: 33
en el Allianz oficial, cada uno con su posición y su etiqueta a la derecha. Es la misma estructura
que AXA, sólo que dibujada en vez de declarada.

⇒ `casillasDibujadas()` las agrupa y `agregarCamposAFormatoPlano()` fabrica **la misma forma que
tiene AXA**: un campo por grupo, N recuadros, **cada uno con SU on-state**. Por eso el resto del
motor —geometría, etiquetas, render, el catálogo del agente— funciona **sin tocar una línea**.

**Resultado en Allianz: 14 grupos, 33 de 33 recuadros.**

🔴 **El corte NO es por renglón.** La fila `y=628` trae DOS preguntas:

```
«El padecimiento ocasionó u ocasionará incapacidad?»   □Si □No   □Parcial □Total
```

Meterlas en un grupo haría que marcar «Parcial» **desmarcara** «Si» — el PDF guarda un valor por
campo. La regla que separa bien las 13 filas: las genéricas (`Sí`/`No`) van juntas y las que se
explican solas van juntas; el corte está donde cambia la clase.

⚠️ **pdf-lib crea todos los recuadros con el mismo on-state (`/Yes`)** — que es exactamente el bug
que hacía que marcar una opción marcara a sus hermanas. Hay que renombrarlos uno por uno.
**Verificado** eligiendo la 4ª de 4, la 2ª de 2 y la 2ª de 3: en las tres se marca **una sola** y
es la correcta.

🔴 **Dos grupos quedaron fuera del alcance del agente**, y hubo que ampliar la regex para ello:
`Tiene convenio con la aseguradora` y `…informe complementario … a la Compañía de Seguros`. No son
hechos clínicos, son declaraciones administrativas con consecuencia legal. AXA sigue en 13 de 22,
sin cambio.

> 🔎 **Y una trampa que casi se traga 4 recuadros:** una pregunta con opciones suele traer además
> una raya en el mismo renglón (`¿Hubo complicaciones? □Si □No ____`), así que la casilla y el campo
> de texto salen con el MISMO nombre derivado. `createCheckBox` reventaba por nombre repetido, un
> `catch` mudo se lo comía, y el reporte decía "29 de 33" sin explicar por qué. Ahora el nombre se
> decide contra el mismo contador que los campos de texto, y un grupo que no se pueda crear se
> REPORTA en `noCreados`.

🔴 **Nadie lo ha visto.** Las 56 posiciones las dedujo el algoritmo, no Allianz. De la corrida del
2026-08-08 sigue pendiente **mirar las páginas 2 y 3**, que nunca se han visto — y ahora hay campos
en las tres.

⚠️ **Seis conceptos se dejaron SIN mapear a propósito**, con su razón escrita en `dicts/allianz.ts`:
`clinico.diagnostico`, `clinico.tratamiento`, `clinico.exploracionFisica`, `paciente.rfc`,
`informe.fecha` y el hospital.

## 8. 🔴 Lo que encontró el `/code-review` — el emparejador proponía cosas peligrosas

Tres de sus hallazgos son de la MISMA familia, y la familia es lo que hay que recordar:
**un empate por texto no sabe de quién es el campo.**

| | |
|---|---|
| `paciente.rfc` → `p2_RFC` | Empate **EXACTO**, sin advertencia. Pero `p2_RFC` está en el bloque del **médico**: habría impreso el RFC del paciente en la casilla del doctor |
| `medico.telefono` → `Teléfono` · `medico.email` → `E-mail` · `medico.domicilio` → `Domicilio` | Lo mismo al revés y **peor**: empatan exacto, así que salían **sin ninguna marca**. En una hoja con `Teléfono` en el encabezado del PACIENTE, la herramienta proponía imprimir ahí el del médico. Allianz se salvó de casualidad |
| `informe.fecha` → `p3_Fecha_exacta_de_la_cirugia` | El guard de "términos con sustancia" cubría sólo `includes`; `startsWith` no. `fecha` (5 letras) enganchaba la fecha de la CIRUGÍA con un `⚠️ empate débil` como toda defensa |

⇒ Los términos ambiguos entre dos personas (`rfc`, `telefono`, `email`, `domicilio` a secas) se
quitaron del emparejador, y el largo mínimo aplica ahora a los DOS empates parciales.

Y dos más, de la misma cosecha:

- **La colisión al revés**: dos conceptos canónicos apuntando al mismo campo del PDF. Si se pegan
  los dos, el renderer escribe ambos y **el último gana en silencio**. Ahora se detecta y se avisa.
- **`ON CONFLICT` no refrescaba `fields_added_by_us`**: re-correr el seed sobre una fila vieja
  dejaba el diccionario nuevo y la procedencia MINTIENDO — la fila afirmando que el PDF es el
  original intacto de la aseguradora.

> 🔎 **Lección:** el emparejador se escribió "conservador" y aun así proponía tres cosas que un
> humano distraído habría pegado. Ser conservador con la FUERZA del empate no sirve de nada si el
> término no distingue **de quién** es el dato.
