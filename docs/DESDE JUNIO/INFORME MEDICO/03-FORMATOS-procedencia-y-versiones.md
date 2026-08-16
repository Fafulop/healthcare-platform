# 03 — PROCEDENCIA: de dónde salen los PDFs y cuál es el bueno

> Tipo **HALLAZGO / CONTRATO**. Medido el **2026-08-08** contra los sitios oficiales.
> Nace de una pregunta del usuario: *"estos PDFs me los dio una empresa que no es la aseguradora,
> ¿vale la pena buscar los oficiales?"*
> **Respuesta corta: sí, y encontró dos problemas serios.**

## 0. ✅ DECISIÓN (2026-08-08): se usan los PDFs OFICIALES

Del usuario:

> *"Creo que deberíamos ir con los que sí podemos bajar de la aseguradora."*

**El PDF base se baja del dominio de la aseguradora.** v1 arranca con **estas 3** (Allianz, AXA,
GNP) y las demás se suman después.

### Y el tercero tiene nombre: **Eleonor** (`eleonor.mx`)

El usuario sacó los PDFs de **una cuenta de doctor real en Eleonor** — o sea, no es un
intermediario cualquiera: es un **producto vivo que ya hace esto** con médicos de verdad.

Eso cambia el peso de la evidencia en los dos sentidos:

- ✅ **A favor de Eleonor:** si sus formatos se usan a diario y las aseguradoras los aceptan, son
  evidencia de **lo que funciona en la práctica** — que no siempre es lo que está publicado en el
  sitio. Las aseguradoras suelen repartir formatos a proveedores por canales que no son su web.
- ⚠️ **En contra:** su Allianz se basa en un documento de **2016** cuando Allianz publica uno de
  **2023**, y su GNP no coincide con el publicado. No se puede verificar desde afuera.

🔵 **Se queda anotado como PLAN B:** si un formato oficial llega a ser rechazado por la
aseguradora, la versión de Eleonor es la primera pista de cuál es el que sí aceptan.

## 1. Qué se comparó

Los 3 PDFs que mandó el usuario (bajados de **Eleonor**) contra el PDF que **publica la
aseguradora en su propio dominio**.

| | Del tercero | Oficial de la aseguradora | Veredicto |
|---|---|---|---|
| **AXA** | 6 pág · **326** campos · creado `2022-03-31` | 6 pág · **277** campos · `AI-346 FEBRERO 2022` · creado `2022-03-31` | ✅ **Mismo documento.** El oficial YA es rellenable |
| **GNP** | 3 pág · **132** campos · creado `2022-07-19` | **2 pág** · **62** campos · creado `2016-09-30`, mod `2020-10-13` | ⚠️ **Documentos DISTINTOS** — se usa el OFICIAL (§3) |
| **Allianz** | 3 pág · **126** campos · creado **`2016-12-29`** | 3 pág · **0 campos (plano)** · creado **`2023-02-26`** | 🔴 **El del tercero está ~7 años atrasado** |

Fuentes oficiales usadas:
- AXA — `axa.mx/documents/51602/160260/GM-FORM-InformeMedico-FEB22.pdf`
- GNP — `gnp.com.mx/.../Informe-Medico-GMM-GNP.pdf`
- Allianz — portal de documentos de `componentes.allianz.com.mx`

## 2. La huella que lo delata

`Producer` y las fechas cuentan la historia completa:

| | `Creator` | `Producer` | Creado | Modificado |
|---|---|---|---|---|
| AXA del tercero | Adobe InDesign 17.1 | **pdf-lib** | 2022-03-31 | **2026-08-08** |
| AXA oficial | Adobe InDesign 17.1 | Adobe PDF Library 16.0.5 | 2022-03-31 | 2022-08-30 |
| Allianz del tercero | Adobe InDesign CS6 | **pdf-lib** | **2016-12-29** | **2026-08-05** |
| Allianz oficial | Adobe Illustrator CC 22.0 | Adobe PDF library 15.00 | **2023-02-26** | 2023-02-26 |
| GNP del tercero | **pdf-lib** | **pdf-lib** | 2022-07-19 | **2026-08-08** |
| GNP oficial | Adobe Illustrator CC 2015.3 | Adobe PDF library 15.00 | 2016-09-30 | 2020-10-13 |

**Lectura:** el tercero tomó los PDFs de las aseguradoras y **les agregó los campos con `pdf-lib`**,
hace días (`ModDate` de 2026-08-05 y 2026-08-08). Los campos rellenables **no son oficiales**: son
de él.

⚠️ **El caso de GNP es el peor:** su `Creator` **también** es pdf-lib — se perdió toda huella de
Adobe, o sea que el archivo fue reconstruido, no sólo anotado. Y su `CreationDate` (2022) **no es
confiable**: pdf-lib la escribe al generar.

## 3. Lo que esto cambia, formato por formato

### ✅ AXA — usar el oficial, y punto

Misma `CreationDate` exacta que el de Eleonor ⇒ es el mismo documento base. Y **el oficial ya trae
277 campos AcroForm puestos por Adobe**: la aseguradora lo publica rellenable.

Los ~49 campos extra de Eleonor son suyos, no de AXA. No hay razón para preferir su copia.

> 🎉 **Y el oficial tiene MEJORES nombres de campo que el de Eleonor.** Medido:
> `Nombres` · `Apellido paterno` · `Apellido materno` · `Edad` · `Talla` · `Peso` ·
> `Tensión arterial` · `Lugar`. Mapean **directo** contra `Patient` y los `vitals*` de
> `ClinicalEncounter` ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §2 y §3-B1).
> El campo `Datos del Asegurado afectado paciente`, que sí existía en el de Eleonor, **no existe en
> el oficial** — era invención suya.

> 💡 AXA además publica versiones marcadas **"Llenable"** de otros formatos (p.ej. la Solicitud de
> Siniestros `AI-466 Octubre 2025`). Vale la pena buscar esa variante para cada formato suyo.

### ✅ GNP — RESUELTO el 2026-08-15: se usa el OFICIAL

El del tercero tiene **3 páginas y 132 campos**; el que publica GNP tiene **2 páginas y 62**. No es
el mismo formato reformateado: **es otro documento**.

**Decisión del usuario (2026-08-15): el oficial**, igual que con AXA y Allianz. Se volvió a bajar
de `gnp.com.mx` ese día y se midió: 2 págs · **62 campos** (55 de texto + **7 grupos de radio**) ·
`Producer: Adobe PDF library 15.00` · creado 2016-09-30, modificado 2020-10-13. La clave de versión
impresa en la hoja es **`402087SCinfmed_0217`**, y es la que va en `insurance_forms`.

> 🔎 **Y desmiente lo que estos docs decían de GNP.** [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md)
> §3 lo clasificaba como 🔴 *"puramente posicional — `P1_7`, `P2_15`, cero semántica"* y por eso
> parecía el formato caro. **Eso era el archivo de Eleonor.** El oficial trae nombres tan buenos
> como los de AXA (`Apellido paterno`, `Diagnóstico Definitivo`, `Cédula profesional`), así que **no
> necesita mapa de `etiquetas`** y el trabajo de la "pantalla de revisión" se cae casi entero.
>
> La lección se repite: **una propiedad medida sobre el PDF de un tercero no es una propiedad del
> formato.**

⚠️ **Es un archivo de PREPRENSA**, y eso trae tres cosas que ningún otro formato tenía:

| | |
|---|---|
| Mide **684×864** (carta + 36 pt de rebase) | cosmético; las cajas caen bien porque todo vive en el mismo sistema de coordenadas |
| Trae **marcas de registro** y leyendas `Pantone 1585 C · 133 LPI` en el rebase, en una capa ENCENDIDA | se deja **tal cual lo publica GNP** (§5): el archivo sigue siendo el suyo byte a byte, y cualquier médico que lo baje imprime lo mismo |
| Su **página 1 lleva dentro una copia INVISIBLE del arte de la página 2** | 🔴 esto sí muerde — abajo |

### 🔴 La capa apagada: 245 items de texto de los que sólo se ven 126

El PDF tiene tres capas de contenido opcional (`Frente`, `Reverso`, `REGISTROS`; por default
`Reverso` va **apagada**). La página 1 contiene el arte de las dos caras, y el de la página 2 está
en la capa apagada — **con las mismas cadenas y en las mismas coordenadas** que la página 2 real
(`Tipo de estancia` sale en `x=76 y=477` en las dos).

`getTextContent()` **no sabe de visibilidad**: devuelve las dos capas mezcladas. Y como en esta
funcionalidad las etiquetas se deducen por CERCANÍA, derivar sobre esa mezcla produce rótulos
sacados de un texto que el médico no tiene delante. Es la falla que aquí ya tiene nombre —
*un rótulo pobre se ignora, uno FALSO se obedece*— sólo que servida en bandeja.

⇒ `geometriaDelPdf()` filtra por capa antes de entregar el texto (`add-fields.ts`).

⚠️ **Allianz también tiene capas** (4 OCGs de Illustrator) — lo que no tiene es ninguna APAGADA, así
que pasa por el filtro y sale intacto; AXA no tiene `/OCProperties`. Verificado: los dos dan
exactamente los mismos grupos, opciones y contextos que antes del cambio.

⚠️ **Dos límites conocidos del filtro**, anotados a propósito (ninguno se dispara en los 3 formatos
de hoy): el emparejamiento es POSICIONAL y no ve bloques `/OC` dentro de un Form XObject ni con el
diccionario en línea —hay una guarda que compara conteos y **falla abierto** si no cuadran— y las
**rayas** (`reglas`) no se filtran por capa, sólo el texto y los recuadros. Eso último sólo mordería
en un formato que fuera **plano Y con capas apagadas** a la vez.

### 🔴 Allianz — el del tercero está obsoleto

El oficial es de **febrero 2023**; el del tercero se creó en **diciembre 2016**. Son ~7 años y
Allianz claramente rehizo el formato (cambió hasta la herramienta: InDesign → Illustrator).

**Mandar el formato viejo es exactamente el riesgo que esta funcionalidad existe para evitar:** el
informe se rechaza y al paciente no le cubren el gasto.

⚠️ **Y el oficial de Allianz tiene 0 campos: es plano.**

> ✅ **RESUELTO el 2026-08-08.** Se le pusieron **56 campos automáticamente**, deduciendo la
> posición de las reglas dibujadas y el nombre del texto vecino — sin un solo clic. Llenado 12/12,
> flatten OK, acentos OK. Método y trampas en [`SESSION-REFRESCO`](SESSION-REFRESCO.md).
> **Falta mirarlo con los ojos:** aquí las posiciones las dedujo el algoritmo, no la aseguradora.

## 4. ⚠️ Corrección al plan: el calibrador NO estaba del todo muerto

[`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §2 lo dio por cancelado porque los 3 PDFs del
tercero traían campos. **Pero esos campos los puso el tercero.** El oficial de Allianz —el que
deberíamos usar— es plano.

**El estado real es: depende del formato, y ahora sabemos cómo distinguirlo.**

| El PDF oficial… | Qué se hace |
|---|---|
| …ya trae campos AcroForm (**AXA**) | Se llena por nombre. Gratis |
| …es plano pero tiene capa de texto (**Allianz**) | Hay que **ponerle los campos una vez** con `pdf-lib`, o estampar por coordenadas |
| …es plano y sin capa de texto | El caso caro. **No se ha visto ninguno** |

💡 **Y hay un atajo para el caso 2:** el oficial de Allianz tiene capa de texto con coordenadas
(`(24, 730) "Informe Médico"`, etc.). Se pueden **proponer las posiciones automáticamente** desde
las etiquetas y que el humano sólo corrija. Es lo que ya describe
[`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §3 para derivar el diccionario — el mismo motor
sirve para las dos cosas.

⇒ La herramienta se necesita, pero **es más chica que el calibrador original**: se apoya en el
texto del PDF en vez de arrancar de una hoja en blanco.

## 5. La regla que queda

🔴 **El PDF base sale del dominio de la aseguradora, no de un tercero.** Un formato de un
intermediario puede estar atrasado (Allianz: 7 años), reconstruido (GNP) o llevar campos que la
aseguradora nunca puso (AXA: +49).

🔴 **Cada formato guarda de dónde se bajó y cuándo.** `insurance_forms` necesita `sourceUrl` y
`fetchedAt` además de la versión. Sin eso, dentro de un año nadie sabe si el PDF que está en la
base es el vigente.

🔴 **Los campos que agregamos nosotros son NUESTROS, y hay que saberlo.** Si le ponemos campos al
PDF plano de Allianz, ese archivo ya no es el oficial byte a byte. Se anota en el registro.

## 6. Pendiente

| # | Qué | Quién |
|---|---|---|
| ~~1~~ | ~~**GNP: ¿cuál es el formato vigente?**~~ **RESUELTO 2026-08-15: el OFICIAL** (§3) | — |
| 2 | Confirmar que el Allianz de feb-2023 es el último (el portal puede tener más de uno) | Usuario |
| ~~3~~ | ~~¿De qué empresa vienen estos PDFs?~~ **RESUELTO: Eleonor (`eleonor.mx`), de una cuenta de doctor real** (§0) | — |
| 4 | Conseguir los oficiales del resto de aseguradoras (sólo se vieron 3) | Usuario |
| 5 | Revisar si redistribuir el formato de la aseguradora dentro del producto tiene implicación legal | Usuario |
