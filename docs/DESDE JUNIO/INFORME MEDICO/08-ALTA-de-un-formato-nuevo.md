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

# 2b. REVISAR CON LOS OJOS — es donde han salido TODOS los bugs reales:
npx tsx scripts/alta-formato.ts mapa <salida.pdf> ~/Downloads/MAPA.pdf   # cada campo con su nombre
npx tsx scripts/alta-formato.ts demo <salida.pdf> ~/Downloads/DEMO.pdf   # la hoja con todo lleno

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
| **Grupos de RADIO** y qué traen seleccionado de fábrica | GNP, 2026-08-15 (§7) |
| Widgets con el `/Rect` invertido (alto o ancho negativo) | GNP: 4, uno de ellos no se podía escribir (§7) |
| Texto en una capa OPCIONAL apagada | GNP: 119 items invisibles sobre la p1 (03-FORMATOS §3) |
| ¿Es un escaneo? (imágenes y cero texto) | El caso caro de 03-FORMATOS §4 |
| `Producer` / `Creator` / fechas **sin que pdf-lib los pise** | §4 |
| Página rotada o con CropBox desplazado | El visor devuelve `cajas: []` y no dibuja nada |
| **`maxLength`** por campo | Las 7 cajas `ddmmaaaa` de AXA que tumbaban TODO el PDF |
| **Casillas marcadas de fábrica** | Las 9 de AXA, una de ellas de facturación |
| Cajas donde no cabe nada legible a 6 pt | `capacidad.ts` |
| Nombres de campo fuera de WinAnsi | El campo no se imprime y se omite |
| Nombres repetidos (un campo, varios recuadros) | Marcar uno marca a sus hermanos |
| **Qué casillas puede proponer el asistente, y cuáles NO** | §6 — el peor bug que ha tenido esto |
| **De qué lado del recuadro está su etiqueta** (se mide por grupo, no se supone) | §7d — Ve por Más rotulaba con la opción SIGUIENTE |
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

### c) 🔴 Los campos que la aseguradora nombró MAL — y por qué NO mapearlos no basta

Lo trajo Ve por Más (2026-08-21) y cambia cómo se lee todo este documento. Dos de sus campos vienen
con un nombre que **describe otra cosa**:

| Nombre del campo | Lo que es de verdad | Cómo se supo |
|---|---|---|
| `Resultado de la exploración física y de los estudios anexar…` | la caja de la **TALLA** (31 pt) | encima está impreso `Talla_______cms.` |
| `Antecedentes perinatales 4` (573 pt) | la caja de **PADECIMIENTO ACTUAL** | está bajo ese encabezado impreso; el 4º renglón perinatal real es `Antecedentes perinatales_4` |

🔴 **Y la reacción intuitiva —"si no sé qué es, no lo mapeo"— es la TRAMPA, no la salida.** Un campo
sin concepto canónico **no desaparece**: se le sigue ofreciendo al modelo como campo CRUDO **con su
nombre del PDF de etiqueta**. O sea que el catálogo decía «Resultado de la exploración física…»
sobre una caja de 10 caracteres que imprime dentro de `Talla (cms.)`. El médico dicta la
exploración, el modelo elige el campo cuyo nombre lo dice, y la exploración acaba en la talla.

⇒ **Mapear el campo a su concepto REAL es lo que borra el rótulo falso**, porque entonces la
etiqueta sale del canónico y no del nombre. Dejarlo sin mapear lo deja armado.

### 🔴 Y el contador de "rótulos ilegibles" NO ve esto

El indicador que se usa desde GNP —cuántos campos llegan al modelo con el nombre crudo— da **0 para
Ve por Más**, igual que AXA. Es verdad y mide lo que no importa: `esOpaco()` caza nombres que se
*ven* opacos (`Día_4`, `Text Field 12`, ≤3 letras) y **un nombre largo, fluido y FALSO le pasa por
encima**. Los dos campos de arriba puntúan como perfectamente legibles.

> 🔎 **La lección:** *ilegible* y *falso* son dos defectos distintos, y el segundo es el peligroso.
> Un contador de legibilidad en verde **no dice nada** sobre si los rótulos son ciertos; eso sigue
> pidiendo leer el texto impreso alrededor de la caja, formato por formato.

### 🔴 El campo `…1` de un bloque NO suele ser su primera línea (MetLife, 2026-08-21)

Cuando un bloque de texto largo se reparte en varios campos numerados, el `…1` es muchas veces **la
cola del renglón donde va impreso el rótulo**, y el ancho lo delata:

| bloque | `…1` | `…2` | `…3` |
|---|---|---|---|
| `Detallar resultados de exploración física…` | **45 pt** | 567 pt | 567 pt |
| `a Principales signos síntomas…` | **311 pt** | 567 pt | 567 pt |
| `h Indicar el tratamiento…` | **165 pt** | 567 pt | 567 pt |

La propuesta automática ofrece el `…1` en los tres, y mapear ahí mete la exploración física entera
en una caja de 45 pt. ⚠️ **Y no hay regla que sirva de atajo:** en `Antecedentes personales
patológicos` de la MISMA hoja el `1` sí es la línea ancha, porque ahí el rótulo va en su propio
renglón. **Se mide bloque por bloque, con el ancho del widget delante.**

### 🔴 Cuando la hoja tiene VARIOS bloques de médico, el nombre del campo no dice de quién es

MetLife trae **cuatro**: su §6 es *Equipo quirúrgico* (`a) Anestesiólogo`, `b) Primer ayudante`,
`c) Otro`, `d) Otro`) y su §7 es *Datos del médico*. Los campos se llaman `Nombre completo_2`, `_3`,
`_4` y `Cédula profesional especialidad`…`_5`, sin nada que los distinga. El médico tratante es el
de la **§7**.

La propuesta automática ofrecía `medico.especialidad → "Especialidad"`, que es la del participante
*c) Otro* — **el mismo error que `p2_RFC` en Allianz** (§8), que empataba exacto y vivía en el
bloque del médico. Y aquí el `etiquetas` no es cosmético: sin él **el modelo ve cuatro cajas
`Nombre completo` idénticas** y no puede elegir.

⇒ El mapa de etiquetas hace falta en dos casos distintos, y conviene no confundirlos:
**(a)** formato PLANO, porque los nombres los inventamos nosotros (§7b, Allianz); **(b)** formato
CON campos donde los nombres existen pero **no distinguen a quién pertenecen** (MetLife).

🔴 **Y si se cubre un bloque, hay que cubrirlos TODOS.** El `/code-review` encontró que rotular
`a)` y `b)` y dejar crudos `c)`, `d)` y el del tratante es **peor que no rotular ninguno**: los
nombrados insinúan que los otros son otra cosa. En MetLife eran 15 campos (`Número celular_5`,
`Registro Federal de Contribuyentes_3`…) distinguidos sólo por un `_N` sin significado.

### 🔴 Una fecha partida en TRES cajas: las tres reciben la MISMA etiqueta

MetLife parte cada fecha en `D6`/`M6`/`A6` (`maxLength` 2/2/4). Los tres nombres miden ≤3
caracteres ⇒ `esOpaco()` los manda a la derivación por vecindad, y como la pregunta impresa es UNA
sola, **las tres cajas salen con la misma etiqueta**. Medido: `D1`, `M1` y `A1` llegaban al modelo
las tres como «Lugar y fecha:».

Con tres campos indistinguibles y topes 2/2/4, escribir el DÍA en la caja del AÑO se acepta en
silencio (2 ≤ 4) y la aseguradora recibe una fecha falsa. `GUIA_DE_FECHA` descarta los rótulos
`Día`/`Mes`/`Año` a propósito —en AXA son guías sobre UNA caja ancha y tomarlas daba tres campos
llamados «Mes» (§7)— así que en una hoja de tres cajas no queda ningún discriminador.

⇒ Se resuelve en el `etiquetas` del formato, que es donde vive lo que la geometría no puede saber:
`D6 → "Fecha de ingreso — DÍA (2 dígitos)"`. **El prefijo del nombre sí discrimina**; la etiqueta
sólo lo hace explícito.

### 🔴 Un `maxLength` chico OMITE datos reales — medirlo contra PROD, no contra un ejemplo

`Teléfono del consultorio` de MetLife declara `maxLength = 10`. El renderer rescataba sólo las
cadenas con forma de FECHA, así que cualquier teléfono más largo se omitía entero. Medido contra
los 8 doctores de prod con `clinic_phone`: **3 de 8** (`55 5280 4422`, `333 848 6234`,
`+52 3311846091`) recibirían el informe **sin el teléfono del consultorio**.

⇒ El rescate ahora también quita la puntuación de un teléfono (no pierde un solo dígito) y, sólo si
lo que queda son exactamente los 10 dígitos nacionales, el `+52`. Lo que sigue sin caber se **omite
y se reporta**, nunca se recorta. Verificado con los 8 valores reales: los 8 imprimen.

### 🔴 Hay hojas cuyas OPCIONES no son casillas: son cajas de texto de 1 carácter

SURA no usa casillas para sus preguntas importantes. Usa **13 campos de TEXTO con
`maxLength = 1`** donde se contesta escribiendo una `X` al lado de la opción. Es la familia de los
RADIOS de GNP —un tipo de pregunta que el motor no conocía— otra vez por una puerta nueva.

**Y trae dos consecuencias que no se ven hasta que se miden:**

**1. `casillasParaElAgente()` NO las protege.** Esa función filtra CASILLAS; para el motor esto es
texto, así que sus tres reglas no se aplican. Quedaban al descubierto justo los casos que existen
para bloquear: `Si`/`No_3` (el par de «¿Hubo complicaciones?», que es la regla 3) y
`Cirujano`/`Cirujano_2`, dos preguntas distintas —Médico 1 y Médico 2— separadas por un `_2`.

**2. 🔴 No hay exclusividad ESTRUCTURAL.** Una casilla de verdad no puede quedar doblemente
marcada: el PDF guarda **un valor por campo**. Éstas son N campos independientes, así que nada
impide que queden marcados el `Sí` **y** el `No` de la misma pregunta — y la hoja aplanada le
afirma a la aseguradora las dos cosas.

⇒ `FormatoEnRepo.opcionesDeTexto` declara los grupos y **el SERVIDOR impone la exclusividad**. Si
llegan dos del mismo grupo se descarta el grupo ENTERO y se reporta: elegir "la primera" o "la más
probable" es lo mismo que ya está prohibido al resolver un grupo excluyente.

> 🔎 **La lección:** dejarlo en una regla del prompt —*"nunca marques dos del mismo grupo"*— **no
> es un guardarraíl, es una esperanza.** Es regla 0 y la había dejado en prosa: el veredicto de qué
> queda marcado en un documento médico-legal no se le pregunta al modelo.

⚠️ **Y una nota de método para la próxima hoja rara:** al mapear estas opciones puse una etiqueta
«¿Acepta tabulador?» que (a) es una **declaración de facturación**, justo la familia que
`casillasParaElAgente` bloquea, y (b) era **falsa** — la hoja pregunta «¿Forma parte de nuestra
red?». Las dos cosas se vieron leyendo el texto impreso. Cuando el guardarraíl automático no
alcanza, el rótulo a mano es el único filtro que queda: hay que verificarlo contra la hoja, no
contra lo que suena razonable.

### 🔴 Un CONSENTIMIENTO puede vivir en un campo de TEXTO — y ahí el guardarraíl no lo ve

`casillasParaElAgente()` —lo que impide que un modelo firme el `Sí acepto` de AXA— **sólo mira
casillas**. Zurich pone su consentimiento LFPDPPP en un campo de **TEXTO** (`40`: *«…sus datos
personales generales y sensibles… consentimiento expreso… Aviso de Privacidad»*), así que el
guardarraíl no lo alcanzaba y el modelo lo recibía en su catálogo **con una etiqueta que le decía
exactamente qué era**.

🔴 **Y NO basta con no mapearlo**, que es lo que yo había escrito en el dict: un campo sin concepto
canónico se sigue ofreciendo como campo CRUDO. Es la misma lección de §6c, cometida otra vez tres
aseguradoras después. Lo único que lo saca del catálogo es `camposVetadosParaElAgente`.

⇒ **Al dar de alta un formato hay que buscar el consentimiento y la facturación en los campos de
TEXTO, no sólo en las casillas.** El reporte de `alta-formato` avisa de los grupos sospechosos; para
el texto, hoy, hay que mirar la hoja.

### d) Que las cajas caigan en su raya

Sólo se ve con los ojos. Los números pueden cuadrar (60/60 ubicadas, nada fuera de la hoja) y la
hoja verse mal en un navegador al 130%.

## 7. El estado de cada aseguradora

| | PDF oficial | Estado |
|---|---|---|
| **AXA** | ✅ ya trae 277 campos | 🟢 **EN PROD y funcionando** |
| **Allianz** | ✅ bajado del portal de Allianz el 2026-08-14 · **PLANO** (0 campos) | 🟢 **EN PROD**, poco probado a mano |
| **GNP** | ✅ bajado de `gnp.com.mx` el 2026-08-15 · ya trae **62 campos** (55 texto + **7 radios**) | 🟢 **EN PROD y probado por el usuario** (`d51d570c`) |
| **Ve por Más** | ✅ bajado de `vepormas.com` el 2026-08-21 · ya trae **113 campos** (86 texto + 27 grupos de UNA casilla) | 🟢 **EN PROD** (`49d780ce`) · dict de 22 entradas · 0 al asistente (todos los grupos son de una opción) |
| **MetLife** | ✅ bajado de `metlife.com.mx` el 2026-08-21 · ya trae **164 campos** (133 texto + 31 grupos de UNA casilla) | 🟢 **EN PROD** (`57fa9be1`) · dict de 14 + mapa de 57 etiquetas |
| **SURA** | ✅ bajado de `segurossura.com.mx` el 2026-08-21 · ya trae **106 campos** (82 texto + 24 casillas) | 🟢 **EN PROD** (`62030184`) · dict de 14 + 45 etiquetas + 7 grupos excluyentes de TEXTO |
| **Zurich** | ✅ bajado de `zurich.com.mx` el 2026-08-21 · ya trae **86 campos** (71 texto + **15 radios**) | 🟡 **CONSTRUIDO, sin fila en prod.** Dict de 12 + 25 etiquetas + **15 preguntas de grupo** + 1 campo VETADO |

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

### 🔴 Y el review de los detectores nuevos — 3 defectos, ninguno visible en Allianz

Se probaron `fechasDibujadas` e `importesDibujados` con geometría **sintética**: cada caso una
hipótesis de fallo concreta. De siete, cuatro salieron limpias y **tres eran reales** — y las tres
son latentes, es decir: Allianz da los mismos números con y sin el arreglo, así que ninguna
medición sobre esta hoja las habría encontrado.

| Defecto | Qué pasaba | Cómo se vio |
|---|---|---|
| **El importe TAPABA una casilla** | `textosDeContenido` excluye los `□` a propósito, así que el hueco del `$` no los veía como tope y se estiraba por encima. Un campo de texto sobre una casilla = el doctor ya no puede marcarla | 9 pt de traslape medidos |
| **Una guía SUELTA creaba un campo** | El campo se dibuja ENCIMA de las guías (correcto para `DD MM AAAA`), así que un `Mes` que fuera una pregunta de verdad, o un `AAAA` de encabezado, ponía un campo de 30 pt tapando el texto impreso | `Mes` suelto → 1 campo |
| **Un monto ya impreso se leía como etiqueta** | `1,500 $` acaba en `$` ⇒ campo `Importe_1500` encima de la cifra | idem |

⇒ El importe se corta contra **texto Y recuadros**; una fecha necesita **≥2 guías**; una etiqueta
de importe tiene que traer **letras**.

**Regresión tras los tres arreglos:** Allianz idéntico (57 reglas → 52 campos, 18 fechas, 3
importes, 14 grupos / 33 recuadros), **0 de 106 recuadros solapados** (rect contra rect, no sólo
misma fila), AXA sin cambio (277 campos, 13/22 grupos al asistente).

> 🔎 **Por qué importa aunque hoy no se vea:** los tres se disparan en la SIGUIENTE hoja plana, y
> los tres producen un campo que se ve perfectamente normal encima de algo que ya estaba impreso.
> Es el modo de falla de esta funcionalidad entera: no un error, una hoja convincente y falsa.

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

### GNP — lo que enseñó la tercera aseguradora (2026-08-15)

Salió barata en diccionario y **cara en motor**: fue la primera hoja que trajo cosas que el
motor nunca había visto. Las cuatro valen para la #4.

**1. 🔴 Grupos de RADIO.** GNP tiene **7** (`Genero`, `Tipo de Trámite`, `Causa atención`,
`Tipo padecimiento`, `Relación otro padecimiento`, `Complicaciones`, `Estancia`) y el motor sólo
sabía de texto y casillas — `geometria-formato.ts` los excluía *"a propósito"*. Con eso, 7 preguntas
de la hoja no tenían dónde contestarse, incluido el sexo del paciente, en un formato cuyo propio
texto dice **"favor de no dejar preguntas ni espacios sin contestar"**.

Un radio es, para el doctor, lo mismo que un grupo de casillas: N recuadros, uno encendido, y el
valor guardado es el estado de exportación del elegido. Por eso comparten camino y el visor, la
procedencia y el catálogo del asistente **no aprendieron nada nuevo** — igual que cuando se
fabricaron las casillas dibujadas de Allianz (§7).

⚠️ Y traían el mismo regalo que AXA: **`Relación otro padecimiento` viene preseleccionado de
fábrica** en `Opción1`. Como el apagado sólo miraba `PDFCheckBox`, esa marca sobrevivía al aplanado
y el informe le afirmaba a la aseguradora una respuesta que el médico nunca dio. **Es el bug de las
9 casillas de AXA, por la otra puerta** — al agregar un tipo de campo hay que preguntarse también
qué trae puesto de fábrica.

**2. 🔴 `/Rect` invertido: 4 widgets con ALTO NEGATIVO.** El spec del PDF declara el rectángulo con
dos esquinas opuestas **en cualquier orden**, y `pdf-lib` resta sin normalizar. El visor calcula
`top = altoPagina - y - alto`, así que un alto de `-56` baja la caja 56 pt y le pone un `height`
negativo que el navegador descarta: `Antecedentes perinatales` (318×−56) **no se podía escribir**.
De paso, `capacidadDeCaja` los trataba como inmensurables y se los saltaba, así que esos campos
nunca se revisaban por legibilidad. Un solo `rectDelWidget()` compartido lo cierra. AXA y Allianz no
traen ninguno: por eso nunca se había visto.

**3. 🔴 Texto en una capa APAGADA** — la trampa más fea, en 03-FORMATOS §3. Deducir etiquetas sobre
un texto invisible es *el rótulo falso* otra vez.

**4. 🔴 El nombre de un campo puede venir ESCAPADO.** Un nombre del PDF escapa lo que no es ASCII
imprimible: `Opción2` se guarda como `Opci#F3n2` y `Sí` como `S#ED`. `asString()` devuelve el
literal escapado y `getOptions()` el texto decodificado — mezclarlos hace que el valor que guarda el
visor **no empate con ninguna opción** y la elección del médico se descarte en silencio. Se lee con
**`decodeText()`**, y el empate tolera las dos formas porque en prod ya hay un informe que guardó
`campo:Check Box1 = S#ED`.

> 🔎 **La lección de la tercera:** las dos primeras aseguradoras se parecían más entre sí de lo que
> nadie notó. Cada formato nuevo no sólo trae un diccionario: trae **una suposición del motor que
> resulta ser falsa**. Aquí fueron cuatro, y **ninguna la habrían encontrado los gates ni el
> type-check** — las cuatro dan una hoja que se ve perfectamente normal.

⚠️ **Y dos defectos eran de la HERRAMIENTA, no de la hoja**, lo cual es peor porque falsean la
revisión: `mapa` no rotulaba 15 campos (el nombre no cabía en su `maxLength`, o el campo no traía
`/DA` y `setFontSize` lanzaba dentro del mismo `try` que el rótulo) y `demo` no marcaba los radios y
reportaba *"3 problemas"* en una hoja sana. Un contador que nunca da cero enseña a ignorarlo.
Los dos arreglados: **55/55 rotulados y 62/62 llenos con 0 problemas**.

## 7c. 🔴 EL TAMAÑO DE LETRA: por qué NO se calcula, se ACOTA (2026-08-16)

Reporte del usuario: *"escribo `Migraña` en una caja grande y en el PDF sale una palabra
enorme"*. Cierto y medido — `Diagnóstico Definitivo` de GNP (407×64) imprimía esa palabra a
**56 pt**, y `Antecedentes No Patológicos` a 59 pt. `pdf-lib` deja los campos en tamaño
**automático** y su generador estira el texto hasta llenar el recuadro; en una caja de una línea
no se nota porque el alto lo acota (11–12 pt), en una multilínea sí.

🔴 **Y el arreglo obvio —estimar el tamaño y fijarlo— es PEOR que el problema.** Con el tamaño en
`0`, `layoutMultilineText`/`layoutSinglelineText` **miden las glifos de verdad y encogen hasta que
quepa**: sale chico pero **completo**. En cuanto se fija un tamaño, esas funciones **no comprueban
nada** y lo que sobra se dibuja fuera del recorte del widget y **desaparece sin aviso**. Una
estimación optimista (ancho medio 0.5 em, sin descontar el borde ni el ajuste por palabras)
convierte *"se lee chico"* en *"falta media frase"* — al revés de lo que hace falta en un
documento médico-legal. Lo cazó el `/code-review` con el cálculo del ancho real de Helvetica.

⇒ **La regla: no calcular, sólo BAJAR lo que pdf-lib ya calculó.**

```
1ª pasada  updateFieldAppearances()  → pdf-lib mide y escribe en el /DA el tamaño que SÍ cabe
           acotarTamanosDeLetra()    → si supera PT_MAXIMO (11), se baja a 11
2ª pasada  flatten()                 → dibuja con el tamaño ya acotado
```

Es seguro **por construcción**: sólo se reduce, y lo que cabe a 20 pt cabe a 11. Medido en GNP:
3 caracteres → 11 pt (antes 56) · 308 → 11 pt · **791 → 7 pt y completo** (por debajo del tope, no
se toca). Cero texto perdido de más frente a HEAD, en los tres formatos.

⚠️ **Tres trampas dentro de la trampa**, y las tres daban un no-op silencioso:

1. **Hay que marcar el campo como SUCIO** (`form.markFieldAsDirty`). La 1ª pasada ya dejó generado
   el stream de apariencia a 56 pt, y `flatten()` sólo regenera lo sucio: el `/DA` decía 11 y la
   hoja seguía imprimiendo 56.
2. **El tamaño puede vivir en el WIDGET**, no en el campo: pdf-lib resuelve
   `widgetFontSize ?? fieldFontSize` y **el widget no hereda del padre**.
3. **Los campos `comb` van SIEMPRE en automático** — abajo.

### 🔴🔴 Y así salió que DOS fechas de AXA no imprimían NADA, desde siempre

Un campo `comb` reparte los caracteres en `maxLength` celdas y pdf-lib calcula él mismo el tamaño.
**Con uno fijo, su generador no dibuja nada**: el valor sigue en el `/V` —`getText()` lo
devuelve— y el PDF aplanado sale VACÍO ahí, con `llenados` y `problemas` diciendo que todo bien.

Son **14 campos entre AXA y GNP y son TODAS las fechas** (y los teléfonos). Al probarlo salió que
**`Día_2` y `Día_3` del AXA oficial ya vienen con `/Helv 10 Tf` de fábrica**, así que **nunca han
impreso nada, con ningún valor, desde que existe la funcionalidad** — 2 de las 7 cajas de fecha de
la hoja que más se usa. Se fuerzan a `0 Tf` y desde entonces imprimen.

> 🔎 **La lección, y es de método:** el arreglo llevaba `llenados=4 · problemas=0 · ilegibles=0` y
> había borrado la fecha de la hoja. Los contadores cuentan lo que se INTENTÓ escribir, no lo que
> se IMPRIMIÓ. Para esto hace falta la comprobación que ahora existe: llenar todos los campos,
> aplanar, **leer el PDF de vuelta** y exigir que cada valor aparezca.

⚠️ **Pendiente conocido (PRE-EXISTENTE, no lo introduce esto):** con texto muy largo pdf-lib deja
de encoger en un mínimo y recorta. Medido con valores de 180 caracteres: AXA pierde 21 campos y
los **avisa los 21**; Allianz pierde 14 y **calla 2** (`p2_Senale_los_resultados_de_examenes_de_
laborat_2`, `p2_Hubo_complicaciones`), porque el aviso usa la misma estimación de 0.5 em que es
optimista. Ahí la estimación es SEGURA —sólo decide si avisar— pero conviene afinarla.

## 7d. 🔴 DE QUÉ LADO ESTÁ LA ETIQUETA — no se supone, se MIDE (2026-08-21)

Lo trajo la aseguradora #4 y es la suposición del motor más vieja que había: desde el 2026-08-10
`etiquetas-de-la-hoja.ts` daba por hecho que **la etiqueta de un recuadro es el texto a su
DERECHA**. No es una convención del PDF — era una **coincidencia de las tres primeras
aseguradoras**. Medido sobre los seis formatos:

**Los votos que emite el motor** (no una medición aparte — instrumentando `votosDeLado`):

| | vota izq | vota der | se abstiene |
|---|---|---|---|
| AXA | 0 | 45 | 4 |
| Allianz | 0 | 27 | 6 |
| GNP | 0 | 19 | 0 |
| **Ve por Más** | **27** | 0 | 0 |
| **MetLife** | **28** | 0 | 3 |
| **SURA** | **19** | **6** | 0 |

```
AXA         [x] Hospital     ← recuadro y luego la palabra
Ve por Más  Agudo [x]        ← la palabra y luego el recuadro
```

Con la regla vieja, Ve por Más rotulaba cada recuadro con la opción **SIGUIENTE**: el médico marca
lo que lee como «Agudo» y la hoja le afirma **«Crónico»** a la aseguradora. Es *un rótulo pobre se
ignora, uno FALSO se obedece* servido en 27 casillas — y ningún gate lo alcanza, porque la hoja se
ve perfectamente normal.

⇒ **Se decide por GRUPO** (mayoría de sus recuadros; el que tiene los dos textos casi a la misma
distancia **se abstiene**), y **lo que no se decide solo cae a la mayoría de LA HOJA**, nunca a una
constante. El grupo tiene que poder contradecir a su hoja: **SURA mezcla los dos estilos** y sus
pares `Sí`/`No` rotulan por la derecha mientras el resto rotula por la izquierda.

### 🔴 La primera versión de este arreglo TRAÍA EL BUG QUE VENÍA A ARREGLAR

Salió del `/code-review` y se confirmó **ejecutando**, no leyendo. La primera versión resolvía el
empate con un `der` fijo — «la conducta de siempre», que sonaba conservador. En una hoja que rotula
por la IZQUIERDA es rotular mal. Medido en MetLife: **tres grupos sin un solo voto**, los tres
cayendo al `der` de emergencia:

```
[izq="Congénito" 12.71 · der="Adquirido" 14.38]   →  rotulaba "Adquirido"
[izq="Sí" 6.65 · der="No" 8.56]                   →  rotulaba "No"
```

Un `Sí` rotulado `No` en la hoja que firma un médico. Es el patrón que esta carpeta ya tiene
fichado —*un arreglo salido de un review no viene bendecido*— con `type-check` y los 5 gates en
verde. Con la mayoría de la hoja como red, los tres resuelven bien.

⚠️ **Y hay que ser honesto con el alcance de «por grupo»: cuando el grupo tiene UN solo recuadro,
«por grupo» es «por recuadro».** Es el caso de los 27 de Ve por Más, los 31 de MetLife y 23 de los
24 de SURA. Lo que sostiene el mecanismo son **la abstención y la mayoría de la hoja**, no la
agrupación.

**Regresión, con AXA de oráculo:** AXA **49/49** opciones · Allianz **33/33** · GNP **19/19**, los
tres con los mismos grupos y los mismos que ve el asistente (13 · 12 · 5) y aplanando a 0 campos
vivos. Y las tres hojas nuevas pasan a resolver el **100 %** de sus recuadros (27 · 31 · 25).

⚠️ **Un guardarraíl que NO se ha visto correr:** un lado sólo vota si además puede rotular, para que
una raya de relleno (`__________`) —votante perfecto, etiqueta inútil tras `limpiar()`— no arrastre
a un grupo hacia un lado donde después se queda sin opciones y **desaparece entero, en silencio**.
Instrumentado sobre los 6 formatos: **0 vetos**. Es preventivo y no está ejercitado; la rama que sí
corre mucho es la de «un solo lado rotulable» (28 veces en AXA).

> 🔎 **La lección, que ya es la de siempre pero con dos vueltas nuevas:**
>
> 1. La suposición no estaba escrita como suposición, estaba escrita como **medición** — *"medido
>    sobre el AXA oficial: las 49 casillas resuelven por la derecha"*. Era cierta y era **local**.
>    Una propiedad medida sobre tres formatos no es una propiedad de los formatos, igual que una
>    medida sobre el PDF de un tercero no es una propiedad del formato (03-FORMATOS §5).
> 2. 🔴 **Y la primera redacción de este mismo §7d citaba números que el código NO produce.** Decía
>    «AXA 43 der / 1 izq» y un ejemplo de `Sí_3` con `Cédula profesional:` a 0.3 pt — los dos salían
>    de un script de sondeo con OTROS filtros (banda vertical de 8 pt en vez de 6, sin tope de
>    distancia), no de `votosDeLado`. El motor mide `Sí_3` como `«¿Es cáncer?»` a 5.56 pt y `Sí` a
>    2.78 pt, y AXA vota **0/45**. Lo cazó el `/code-review` instrumentando la función de verdad.
>    ⇒ **Un número que justifica un diseño tiene que salir de la función que se shipeó**, no de un
>    sondeo parecido: quien re-calibre `EMPATE_PT` lo haría contra una cifra que no existe.

## 7b. 🔴 En un formato PLANO, las ETIQUETAS son una pieza aparte del diccionario

Ésta es la diferencia de fondo entre AXA y Allianz, y hay que tenerla presente en cada formato
plano que venga después.

| | AXA | Allianz |
|---|---|---|
| Quién nombró los campos | **la aseguradora** | **nosotros**, del texto vecino |
| Qué ve el asistente | `Apellido paterno`, `Tensión arterial` | `p1_AAAA`, `p1_y_cantidad`, `p1_CAUSA` |

Medido: de los 73 campos de texto de Allianz, **61 llegaban al modelo con el nombre crudo como
única pista**. No es un detalle cosmético — es exactamente la causa por la que las fechas de AXA no
aterrizaban hasta que se les dio contexto (`06-AGENTE` §12): *nadie elige un campo cuyo nombre no
dice qué es*, ni un modelo ni una persona.

⇒ `FormatoEnRepo.etiquetas` — `nombre del campo → lo que dice la HOJA` — que
`alta-formato campos` genera y el dict del formato guarda. Resultado: **61 ilegibles → 7**.

**Tres reglas que lo hacen seguro:**

1. **Es texto IMPRESO, no una interpretación.** Es el mismo del que salió el nombre, sin pasar por
   el slug, así que conserva acentos (`Cáncer`, no `Cancer`).
2. **Cuando la etiqueta sola no dice nada, se le antepone la pregunta del renglón — pero SÓLO si
   el renglón tiene UNA.** `¿Cuál?` se vuelve `Referido por otro médico o unidad: — ¿Cuál?`.
   🔴 Con dos o más preguntas el renglón es una **rejilla de columnas** y la de más a la izquierda
   es la de OTRA columna: el hueco de `x=429` en la fila
   `[24]Diabetes Mellitus […] [231]Hipertensivos […] [429]____` se rotulaba
   **"Diabetes Mellitus — AAAA"**, mandando el año de la diabetes al blanco de hipertensivos.
   Lo cazó el `/code-review` **después de shipear**. Con ambigüedad no se antepone nada.
3. **La corrección a mano MANDA sobre la geometría.** El merge va
   `{ ...contexto, ...etiquetasPorClave(formato) }` y no al revés: si un nombre es opaco
   (`P1_7` de GNP) la geometría propone algo, pero lo que escribió un humano lo pisa. Al revés
   —como se shipeó primero— las correcciones a mano se perdían en silencio.
4. **Las MISMAS etiquetas en las tres superficies**: el chat, la lista de campos del doctor y el
   visor. Si el chat propone "Fecha — Diabetes Mellitus" y la lista dice
   `p1_Fecha_Diabetes_Mellitus`, el doctor no encuentra el renglón que acaba de aceptar.
5. **Los campos con concepto canónico NO se pisan**: conservan su etiqueta del canónico, que es la
   buena. El mapa se indexa por CLAVE (`campo:p1_AAAA`), no por nombre — indexarlo mal habría sido
   un no-op silencioso, con el modelo viendo el nombre crudo y todos los contadores en verde.

⚠️ **Quedan 7 que la hoja no explica ni con su renglón** (`p1_Especifique`, `p1_AAAA`,
`p1_y_cantidad_2`, `p1_padecimiento`, `p1_CAUSA`, `p2_Cual`, `p2_car_procedimiento`):
necesitan que alguien MIRE la hoja impresa y corrija el mapa a mano. **Eran "3" mientras dos de
ellas mentían** — quitar las falsas SUBE el conteo, y eso es lo correcto. Eso es
**la pantalla de revisión que 02-PLAN §3 pidió desde el principio**, sólo que en forma de un
`Record<string, string>` en el dict — y las correcciones a mano sobreviven a regenerar el PDF
mientras el nombre del campo no cambie.

> 🔎 **Lección para el siguiente formato plano:** el diccionario canónico y las etiquetas son
> **dos problemas distintos**. El primero decide qué se PRE-LLENA; el segundo decide si el
> asistente y el doctor pueden siquiera SABER qué es cada blanco. Un formato plano necesita los
> dos, y sólo el primero salta a la vista.

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
