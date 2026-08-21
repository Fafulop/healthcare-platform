# 🔄 SESSION-REFRESCO — INFORME MÉDICO

> **Handoff canónico de esta carpeta.** Lee sólo el bloque **EMPIEZA AQUÍ** de aquí abajo: trae el
> estado, lo que sigue abierto y cómo comprobar que nada se rompió. Todo lo que viene después son
> **bitácoras por sesión, de la más nueva a la más vieja** — sirven para entender *por qué* algo
> es como es, no para saber dónde estamos.

---

# ⏱️ EMPIEZA AQUÍ — cierre del 2026-08-21

## Lo que pasó

Se abrió el trabajo de **las aseguradoras que faltan**. El usuario dio una lista de ~16; se bajaron
**14 PDFs de los dominios oficiales**, se midieron todos y se ordenaron por lo que cuestan:
[`09-CATALOGO`](09-CATALOGO-aseguradoras-pendientes.md). Y se construyó la **cuarta aseguradora,
Ve por Más**.

| | |
|---|---|
| `8cd8c41e` **commiteado, NO pusheado** | el motor: la etiqueta de una casilla ya no se supone a la derecha |
| Ve por Más | **sin commitear** · PDF + `dicts/vepormas.ts` (22 entradas) + entrada en `FORMATOS` + `seed-formato-vepormas.sql` **sin aplicar** |

## 🔴 Lo que hay que hacer ANTES de pushear

1. **Aplicar `seed-formato-vepormas.sql` a prod** (`prisma db execute` con la URL pública, jamás
   `db push`) y verificarlo leyendo la fila de vuelta. Hasta que exista, `formatoDe()` no empata y
   **el desplegable NO ofrece Ve por Más**. Es el mismo orden que se siguió con GNP: la fila ANTES
   del push.
2. **MIRAR la hoja.** Hay dos PDFs en `Downloads/`: `vepormas-MAPA-de-campos.pdf` y
   `vepormas-DEMO-todo-lleno.pdf`. Nadie ha abierto Ve por Más en el visor. Los 4 bugs reales de
   Allianz los encontró el usuario en la pantalla con todos los contadores en verde.

## 🔴 Las dos lecciones caras de esta sesión

**1. Una "medición" del motor puede ser una coincidencia de la muestra.** El rótulo de una casilla
se tomaba del texto **a la derecha** — cierto para AXA, Allianz y GNP, y FALSO para Ve por Más,
MetLife y SURA, que rotulan por la izquierda. Sin arreglarlo, el médico marca lo que lee como
«Agudo» y la hoja le afirma «Crónico». Ahora el lado se MIDE, por grupo, con la mayoría de la hoja
como red ([`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §7d).

⚠️ **Y la primera versión del arreglo traía el bug que venía a arreglar**: el empate caía a un `der`
fijo y eso rotulaba un `Sí` de MetLife como `No`. Lo cazó el `/code-review`. *Un arreglo salido de
un review no viene bendecido* — otra vez, con type-check y 5 gates en verde.

**2. NO mapear un campo no lo desactiva.** Ve por Más trae dos campos que la aseguradora nombró mal
(uno llamado «Resultado de la exploración física…» que es la caja de la TALLA). Dejarlos sin mapear
—que parecía lo prudente— **los deja llegándole al modelo con ese nombre de etiqueta**. Mapearlos a
su concepto real es lo que borra el rótulo falso ([`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §6c).

🔎 **Y el contador de "rótulos ilegibles" no ve esto**: da 0 para Ve por Más porque `esOpaco()` caza
nombres que se VEN opacos, y un nombre largo, fluido y falso le pasa por encima. *Ilegible* y
*falso* son dos defectos distintos.

## Cómo se verifica que nada se rompió

Lo de la sesión anterior sigue valiendo, más el cuarto formato. **AXA es el oráculo:**

```
AXA     277 campos · 22 grupos · 13 al asistente · 49 opciones
Allianz  87 campos · 14 grupos · 12 al asistente · 33 opciones
GNP      62 campos ·  7 grupos ·  5 al asistente · 19 opciones
Ve+Más  113 campos · 27 grupos ·  0 al asistente · 27 opciones
```

🔴 **Y la comprobación que ningún contador da:** llenar todo, aplanar y **LEER EL PDF DE VUELTA**
exigiendo que cada valor aparezca. Ve por Más: **22 de 22 impresos**.

## Lo que sigue

**MetLife → SURA** (tier 1), luego la derivación de etiquetas para un PDF **con campos** y nombres
opacos —que hoy sólo existe para los PLANOS y es lo que destraba el tier 2 entero—, luego tier 2 y
tier 3. Y quedan **4 nombres sin confirmar** con el usuario: Multiva, Latinoamericana, Prevem y
«sisnova»; Atlas no se pudo bajar (reto HTML del servidor) y Pan-American no publica su hoja.

---

# ⏱️ Cierre del 2026-08-16

**Nada a medias. Todo commiteado, pusheado y desplegado (SUCCESS).**
`main` == `origin/main` == **`5788823f`**.

## El estado, en una tabla

| | |
|---|---|
| **AXA** · GMM Informe Médico `AI-346 FEBRERO 2022` | 🟢 EN PROD y **en uso diario** · 277 campos (255 texto · 22 grupos, 13 al asistente) |
| **Allianz** · GMM Informe Médico `FEBRERO 2023` | 🟢 EN PROD · oficial PLANO ⇒ 87 campos que le pusimos nosotros (73 texto · 14 grupos, 12 al asistente) |
| **GNP** · Informe Médico GMM `402087SCinfmed_0217` | 🟢 EN PROD y **probado por el usuario** · 62 campos (55 texto · **7 radios**, 5 al asistente) |
| Motor, pantalla, visor, chat, informe a nivel paciente | 🟢 EN PROD desde el 11-08 |

Los tres commits de estas dos sesiones: `d51d570c` (GNP) · `2cbd2be1` (tamaño de letra) ·
`5788823f` (docs). Sólo se mueve `@healthcare/doctor`; los otros tres servicios salen `SKIPPED`.

## 🔴 LO QUE SIGUE ABIERTO — la lista para la próxima sesión

Ninguna es difícil; **las dos primeras necesitan OJOS sobre la hoja impresa, no código.**

1. 🔴 **`clinico.tratamiento` de GNP, SIN mapear.** La hoja tiene UN campo `Tratamiento` y no se
   sabe, sin mirarla, si pregunta por el tratamiento **DADO** o el **PROPUESTO**. `plan` es el
   propuesto; en AXA equivocarse ahí habría dicho algo falso, así que se dejó vacío a propósito
   (razón escrita en `dicts/gnp.ts`). Se cierra con una línea en el dict.
2. 🔴 **`Padecimiento relacionado` de GNP induce al modelo a repetir el diagnóstico.** En la hoja
   significa *otro* padecimiento distinto con el que se relaciona, y el nombre del campo no lo
   dice. Visto en una llamada real. Se arregla con **una línea de `ETIQUETAS_GNP`** (el mapa
   `nombre → lo que dice la hoja`, como el de Allianz) — y hay que **volver a llamar al modelo**
   para comprobar que cambia la conducta, no basta con escribirlo.
3. **`paciente.sexo` no llega al radio `Genero`**: el canónico entrega `"Masculino"` y el campo
   pide su valor de exportación (`M`). Empatarlos pide una tabla de equivalencias por formato que
   hoy no existe, y aproximar en un grupo excluyente está PROHIBIDO. Hoy lo marca el doctor de un
   clic, o se lo dice al chat (`Genero` sí está entre los 5 grupos que el asistente ve).
4. **Las 7 etiquetas de Allianz que la hoja no explica** (`p1_Especifique`, `p1_AAAA`,
   `p1_y_cantidad_2`, `p1_padecimiento`, `p1_CAUSA`, `p2_Cual`, `p2_car_procedimiento`) **y las 4
   de AXA de la misma clase** (`Cuál`, `Días`, `Hasta`, `Total`). Una línea cada una.
5. **Los 6 conceptos de Allianz SIN mapear** (razón en `dicts/allianz.ts`): diagnóstico,
   tratamiento, exploración física, RFC, fecha del informe y hospital.
6. ⚠️ **PRE-EXISTENTE, no lo introdujo nada de esto:** con texto muy largo pdf-lib deja de encoger
   y RECORTA. Medido con valores de 180 caracteres: AXA pierde 21 campos y **los avisa los 21**;
   Allianz pierde 14 y **CALLA 2** (`p2_Senale_los_resultados_de_examenes_de_laborat_2`,
   `p2_Hubo_complicaciones`), porque el aviso usa una estimación de 0.5 em que es optimista. Ahí
   estimar es SEGURO —sólo decide si avisar— pero conviene afinarlo (08-ALTA §7c).
7. **Deuda vieja que sigue viva:** `informe.fecha` se calcula al CREAR y se congela, así que un
   borrador creado el 1 y emitido el 20 imprime `01/08` (**DIFERIDO por el usuario**);
   `/api/…/dictar` es un endpoint LLM vivo **sin UI que lo llame**; y el autoguardado al salir del
   campo **ya no existe** (1B) sin que nadie decidiera si se quiere así.

## 🔴 Lo que NADIE ha visto con los ojos

Es lo único que de verdad falta, y sólo lo puede hacer el usuario:

- **Las 3 páginas de Allianz renderizadas en el navegador** con sus 87 campos — pendiente desde el
  08-08. Se revisó el MAPA en PDF, que no es lo mismo que el visor pintando cajas sobre un lienzo.
- **Las 2 fechas de AXA que acaban de empezar a imprimir** (`Día_2`, `Día_3`). Se verificaron
  leyendo el PDF por código, no en pantalla.
- **Un informe de GNP de punta a punta**: marcar un radio que NO sea el primero de su grupo,
  Guardar, bajar borrador y final.

## Cómo se verifica que nada se rompió (todo en local, sin desplegar)

```bash
cd apps/doctor && npx tsc --noEmit          # los scripts/ SÍ entran
cd ../.. && pnpm gates                      # los 5
cd apps/doctor
npx tsx scripts/alta-formato.ts inspeccionar public/formatos/axa-gmm-informe-medico-2022-02.pdf
#   → 277 campos · 22 grupos · 13 al asistente     (AXA es el ORÁCULO)
npx tsx scripts/alta-formato.ts inspeccionar public/formatos/allianz-gmm-informe-medico-2023-02.pdf
#   → 87 campos · 14 grupos · 12 al asistente
npx tsx scripts/alta-formato.ts inspeccionar public/formatos/gnp-informe-medico-gmm-0217.pdf
#   → 62 campos (55 texto · 7 radios) · 5 al asistente · avisa 1 opción de fábrica,
#     4 rects invertidos y la capa APAGADA
npx tsx scripts/alta-formato.ts demo <cualquiera> /tmp/x.pdf
#   → llenados == respuestas · 0 problemas · 0 campos vivos tras flatten
```

🔴 **Y la comprobación que ningún contador da:** llenar todos los campos, aplanar y **LEER EL PDF
DE VUELTA** exigiendo que cada valor aparezca. Es la única que caza el texto que se escribió y no
se imprimió — hoy pasan los **383 campos** de los tres formatos. Se rehace en 5 minutos con un
script de scratchpad; no está en el repo.

⚠️ Hay `OPENAI_API_KEY` en `apps/doctor/.env.local`: **se puede llamar al modelo DE VERDAD** desde
un script, sin desplegar. Es lo que destapó el bug del prefijo `campo:` tras dos sesiones en verde,
y lo que confirmó que GNP le llega bien al asistente. Un contrato con un LLM no se verifica
leyendo el prompt.

## Lo que NO se re-litiga

- El PDF es una **SALIDA**, nunca la superficie de captura.
- Un campo **sin fuente se queda VACÍO y marcado**. Nunca se adivina.
- Nada se guarda hasta **Guardar** (1B); se descarta campo por campo (2B).
- El informe es un flujo **CONTENIDO**, no un módulo del asistente.
- El PDF base sale del **dominio de la aseguradora** (03-FORMATOS §5).
- `prisma db push` **REVIERTE** 3 cosas que viven sólo en prod (FK compuesta, índice único parcial
  y la FK `DEFERRABLE` sin la cual **borrar un paciente truena**). SQL manual + `prisma db execute`
  con la URL **pública** — nunca `railway run` para esto (`NEW.MD-GUIDES/database-architecture.md`).
- En un grupo excluyente **no se aproxima "la opción más parecida"**: si no empata, se descarta.

## 🔎 Las tres lecciones que más se han repetido aquí

1. **Un rótulo pobre se ignora; uno FALSO se obedece.** Pasó con `Mts.` sobre la tensión arterial,
   con `p2_RFC` del bloque del médico, con `"Diabetes Mellitus — AAAA"` en el blanco de
   hipertensión, y con `IDENTIFICACIÓN` como pregunta de un grupo de GNP. Cuando no se pueda
   saber, **la etiqueta se deja pelona** y quien mire la hoja la corrige.
2. **Los contadores cuentan lo que se INTENTÓ, no lo que se IMPRIMIÓ.** El arreglo del tamaño de
   letra llevaba `llenados=4 · problemas=0 · ilegibles=0` y había borrado la fecha de la hoja.
3. **Una propiedad medida sobre el PDF de un TERCERO no es una propiedad del formato.** Por eso
   02-PLAN §3 tildó a GNP de "puramente posicional" durante una semana, y era falso.

---

# 🗒️ 2026-08-16 — el TAMAÑO DE LETRA del PDF (bitácora)

## Qué reportó el usuario

*"Escribo `Migraña` en una caja grande y en el PDF sale una palabra enorme."* Cierto: medido,
**56 pt** en `Diagnóstico Definitivo` de GNP y 59 pt en `Antecedentes No Patológicos`. `pdf-lib`
deja los campos en tamaño AUTOMÁTICO y estira el texto hasta llenar el recuadro.

## 🔴 Y el arreglo obvio era PEOR que el problema

Estimar el tamaño y fijarlo **pierde texto**: con `0` (automático) pdf-lib mide las glifos y
encoge hasta que quepa —chico pero COMPLETO—, y con un tamaño fijo **no comprueba nada** y lo que
sobra se dibuja fuera del recorte y desaparece. Lo cazó el `/code-review`.

⇒ La regla que quedó: **no calcular, sólo BAJAR lo que pdf-lib ya calculó** (1ª pasada mide, se
acota a 11 pt, 2ª pasada dibuja). Seguro por construcción: sólo se reduce. Detalle y las tres
trampas de no-op en [`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §7c.

Medido en GNP: 3 chars → **11 pt** (antes 56) · 308 → 11 pt · **791 → 7 pt y completo**.

## 🔴🔴 Y de paso: DOS fechas de AXA no imprimían NADA, desde siempre

Un campo `comb` con tamaño FIJO no dibuja nada en pdf-lib. `Día_2` y `Día_3` del AXA oficial ya
vienen con `/Helv 10 Tf` de fábrica ⇒ **nunca han impreso, con ningún valor** — 2 de las 7 cajas
de fecha de la hoja que más se usa. Ahora se fuerzan a automático y salen.

🔎 **La lección de método:** mi primer arreglo llevaba `llenados=4 · problemas=0 · ilegibles=0` y
había BORRADO la fecha de la hoja. Los contadores cuentan lo que se intentó escribir, no lo que se
imprimió. Ahora hay una comprobación que llena todo, aplana y **lee el PDF de vuelta**: los 383
campos de los tres formatos imprimen.

---

# 🗒️ 2026-08-15 — la TERCERA aseguradora, GNP (bitácora)

> ✅ **CERRADO: GNP está EN PROD** (`d51d570c`, deploy SUCCESS) y el usuario lo probó —
> *"it run and it's fine, looks very good"*. La fila de `insurance_forms` se aplicó ANTES del push
> y se verificó leyéndola de vuelta (20 entradas idénticas al repo, acentos intactos, los 22
> informes existentes intactos). Lo de abajo se conserva como bitácora.

## Lo que quedó abierto de GNP

1. 🔴 **Decidir `clinico.tratamiento`**: GNP tiene UN campo `Tratamiento` y no se sabe, sin ver la
   hoja, si pregunta por el tratamiento DADO o el PROPUESTO. Se dejó SIN mapear a propósito — en AXA
   equivocarse ahí habría dicho algo falso.
2. **`paciente.sexo` no se mapea al radio `Genero`**: el canónico entrega `"Masculino"` y el campo
   pide su valor de exportación (`M`). Empatarlos pide una tabla de equivalencias por formato que
   hoy no existe, y aproximar en un grupo excluyente está prohibido. El médico lo marca de un clic
   — y el ASISTENTE sí puede ponerlo, porque `Genero` está entre los 5 grupos que ve.

## Qué se hizo

**El PDF es el OFICIAL de `gnp.com.mx`** (`Producer: Adobe PDF library 15.00`, leído con
`updateMetadata: false`), versión impresa en la hoja **`402087SCinfmed_0217`**. Con eso se cierra la
pregunta #0 que llevaba una semana bloqueando esta aseguradora.

| | |
|---|---|
| Campos | **62** — 55 de texto + **7 grupos de radio** (19 recuadros) |
| Diccionario | **20 entradas**, todas verificadas contra la hoja · 0 inválidas |
| Pre-llenado real | 19 de 20 escritos · **0 problemas · 0 ilegibles · 0 campos vivos** tras aplanar |
| Etiquetas de los radios | **7 grupos y 19/19 opciones**, derivadas del texto impreso |
| Al asistente | **5 de 7 grupos** (se bloquean los dos `Sí/No` sin pregunta) |

🎉 **Y GNP salió BARATO en diccionario**: 02-PLAN §3 lo daba por 🔴 *"puramente posicional, `P1_7`,
cero semántica"* — **eso era el PDF de Eleonor**. El oficial tiene nombres tan buenos como los de
AXA, así que no necesita mapa de `etiquetas` y la "pantalla de revisión" se cae casi entera.

## 🔴 Lo caro fue el MOTOR: cuatro suposiciones que resultaron falsas

Ninguna la habrían encontrado los gates ni el type-check, y las cuatro producen una hoja que se ve
perfectamente normal. Detalle en [`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §7.

1. **Grupos de RADIO** — el motor sólo sabía de texto y casillas (`geometria-formato.ts` los
   excluía *"a propósito"*). Eran **7 preguntas sin dónde contestarse**, incluido el sexo, en una
   hoja que dice *"favor de no dejar preguntas ni espacios sin contestar"*. Ahora comparten camino
   con las casillas: mismo visor, misma procedencia, mismo catálogo del asistente.
   ⚠️ Y traían el regalo de AXA: **`Relación otro padecimiento` viene preseleccionado de fábrica**
   y el apagado sólo miraba `PDFCheckBox` ⇒ el PDF aplanado afirmaba una respuesta que nadie dio.
2. **4 widgets con el `/Rect` INVERTIDO** (alto negativo). El visor los dibujaba sin altura y 56 pt
   más abajo: `Antecedentes perinatales` **no se podía escribir**, y `capacidadDeCaja` se los
   saltaba como "inmensurables", así que nunca se revisaban por legibilidad.
3. **Texto en una capa APAGADA**: la p1 lleva una copia INVISIBLE del arte de la p2, en las mismas
   coordenadas (245 items de texto, 126 visibles). Deducir etiquetas ahí es *el rótulo falso*
   servido en bandeja. `geometriaDelPdf()` ahora filtra por capa.
4. **Los nombres de opción vienen ESCAPADOS**: `Opción2` se guarda como `Opci#F3n2`. `asString()`
   da el literal escapado y `getOptions()` el texto — mezclarlos descartaba **en silencio** la
   opción que eligió el médico. Se lee con `decodeText()` y el empate tolera las dos formas, porque
   en prod hay un informe que guardó `campo:Check Box1 = S#ED`.

## 🔴 Y un bug VIVO que destapó, en AXA y Allianz

`medico.nombre` salía de `doctorFullName` a secas. Medido contra los **11 doctores de prod**: esa
columna se usa de dos maneras incompatibles —a veces trae el nombre completo, a veces **sólo los
nombres de pila** con los apellidos en `Doctor.lastName`, y **4 de 11 tienen `lastName` vacío**.

⇒ Para *Adriana Michelle*, *David* y *Quebradita*, **los informes de AXA y Allianz se están
generando hoy con el nombre del médico SIN APELLIDO**, en la casilla con la que la aseguradora
identifica a quien trató al paciente.

`nombreDelMedico()` compone desde las dos columnas, quita el título y deja los tres campos **vacíos
y avisados** cuando no hay apellidos — nunca parte el nombre completo a ojo, porque eso daba
`paterno = "Michelle"` y `paterno = "David"`.

⚠️ **Lo que NO se hizo:** `paciente.sexo` no se mapea al radio `Genero`. El canónico entrega
`"Masculino"` y el radio pide su valor de exportación (`M`); empatarlos pide una tabla de
equivalencias por formato que hoy no existe, y aproximar en un grupo excluyente está prohibido. El
médico lo marca de un clic.

## 🔴 El `/code-review` — 7 hallazgos, y el peor era el bug que este cambio venía a cerrar

Corrido ANTES de sembrar y de empujar. Los cinco que se arreglaron, todos **verificados
ejecutándose**, no leyendo el código:

1. **🔴 Un radio con un valor que no empata conservaba la preselección DE FÁBRICA.**
   `normalizarCasillas` no lo apagaba —el campo tiene respuesta, así que cuenta como
   "contestado"— y la rama del radio se salía reportando `opcion-no-existe` sin limpiar. Resultado
   medido sobre el GNP real: la hoja aplanada salía con `Relación otro padecimiento = Opción1`,
   o sea un **"Sí" que nadie contestó**. Es la MISMA falla que el cambio venía a cerrar, por una
   tercera puerta. Ahora se hace `clear()` antes de reportar.
2. **🔴 El VISOR no empataba igual que el renderer.** Al pasar el on-state a decodificado (`Sí`),
   el visor —que comparaba con `===`— pintaría **vacía** la casilla del informe que en prod guardó
   `S#ED`, mientras el renderer la marca. El doctor la da por no contestada y el PDF sale
   afirmándola. `empataOpcion` se movió a `types.ts` (que NO importa pdf-lib, porque el visor es
   cliente) y ahora la usan las dos superficies. Misma corrección en el endpoint del chat, que le
   estaba pasando `S#ED` al modelo como "lo ya contestado".
3. **🔴 El nombre del médico con solapamiento PARCIAL.** `Dr. Gerardo Lopez Fafutis` + `lastName
   Lopez` daba `"… Fafutis Lopez"` en la línea de la FIRMA. Ahora ese caso no compone: los
   apellidos se ponen (salen de `lastName`, que es confiable), los nombres se dejan vacíos y se
   avisa.
4. **🔴 Los avisos del nombre del médico salían en AXA y Allianz**, que no tienen esas casillas —
   *"escríbelas aquí"* apuntando a un campo que no existe, en TODOS los informes. Es el contador
   que nunca da cero. `avisosDelFormato()` los filtra por el diccionario de la hoja.
5. **🔴 `esEncabezadoDeSeccion` le abría un hueco al guardarraíl del agente.**
   `casillasParaElAgente` busca `autoriz|acepto|consent|…` en `pregunta + clave + opciones`;
   anular una pregunta en VERSALES quitaba de ahí un `CONSENTIMIENTO INFORMADO` y el grupo se
   volvía proponible por un modelo. Ahora un encabezado se conserva si suena a consentimiento.

Y dos que se **anotaron sin arreglar**, los dos latentes y con su razón:

- **El emparejamiento de capas es POSICIONAL** y no ve los bloques `/OC` que viven dentro de un
  Form XObject ni los `/OC <</Type/OCMD …>>` en línea. Ninguno de los 3 formatos los trae (medido:
  0 `Do`, 0 dicts en línea), pero un desfase de uno filtraría la capa EQUIVOCADA en silencio ⇒ se
  agregó una **guarda que compara los dos conteos y falla ABIERTO** si no cuadran.
- **Las `reglas` (rayas) NO se filtran por capa**, sólo los textos y los recuadros: el operator
  list se lee aparte. Hoy no muerde porque ningún formato es plano **y** con capas apagadas a la
  vez — pero el siguiente que lo sea pondría campos escribibles sobre arte invisible. Anotado aquí
  a propósito, sin arreglar a medias.

> 🔎 **Y una afirmación mía era falsa:** los comentarios decían *"un formato sin capas —AXA,
> Allianz— no cambia en nada"*. **Allianz SÍ tiene capas** (4 OCGs de Illustrator); lo que no tiene
> es ninguna apagada. Corregido en el código y aquí.

## Lo que se verificó, y lo que eso NO cubre

`type-check` ✅ · **5 gates** ✅ · AXA y Allianz **idénticos** tras cada paso (277/255/22 con 13 de
22 al asistente · 87/73/14 con 12 de 14 · los dos aplanan a 0 campos vivos) · el valor de LEGADO
`S#ED` sigue marcando la casilla correcta · una opción inventada se DESCARTA en vez de aproximarse.

🔴 **Nada de esto es el CLIC.** Nadie ha abierto GNP en el visor, ni ha marcado un radio en la
pantalla, ni ha bajado un informe de GNP. Y la lección del 08-14 sigue vigente: **los 4 bugs reales
de Allianz los encontró el usuario usando la pantalla, con todos los contadores en verde.**

---

# 🗒️ 2026-08-14 — Allianz, la segunda (bitácora)

**Nada a medias. Todo commiteado, pusheado, desplegado (SUCCESS) y verificado dentro del
contenedor.** `main` == `origin/main` == `ffb735a5` (+ el commit de cierre).

## Qué quedó vivo hoy

**La segunda aseguradora, ALLIANZ, está EN PROD** — y con ella la herramienta para las que
siguen. El doctor ya la ve en el desplegable y la fila está en `insurance_forms`.

| | |
|---|---|
| **AXA** | 277 campos · 22 grupos (13 al asistente) · **en uso** |
| **Allianz** | 87 campos (73 texto + 14 grupos, 33 recuadros) · oficial PLANO, los campos se los pusimos nosotros |
| Herramienta | `apps/doctor/scripts/alta-formato.ts` — `inspeccionar · campos · mapa · demo · sql` |
| Procedimiento | [`08-ALTA-de-un-formato-nuevo.md`](08-ALTA-de-un-formato-nuevo.md) ← **el documento para la #3** |

Seis commits: `e1d7d105` (Allianz + herramienta) · `c3d91ea4` (fechas e importes) ·
`519b1e39` (3 defectos latentes) · `4e1f8a7f` (etiquetas para el agente) · `ffb735a5` (2 etiquetas
FALSAS + 4 hallazgos del review) · el de cierre.

## 🔴 LO PRIMERO: lo que necesita OJOS, no código

Todo lo de abajo está bloqueado en mirar la hoja impresa. Nada es difícil; nadie más puede hacerlo.

1. **Las 7 etiquetas de Allianz que la hoja no explica** — `p1_Especifique`, `p1_AAAA`,
   `p1_y_cantidad_2`, `p1_padecimiento`, `p1_CAUSA`, `p2_Cual`, `p2_car_procedimiento`.
   Una línea cada una en `ETIQUETAS_ALLIANZ` (`dicts/allianz.ts`). Hoy son honestas pero vagas:
   el asistente las ve y no sabe qué son.
2. **Las 4 de AXA de la misma clase** — `Cuál`, `Días`, `Hasta`, `Total`. Las dos últimas están en
   la fila `Sí No Parcial Total ___ ___` de la p2 y parecen nombradas por la opción de al lado, no
   por lo que el blanco pregunta.
3. **Los 6 conceptos de Allianz SIN mapear** (razón escrita en `dicts/allianz.ts`): diagnóstico,
   tratamiento, exploración física, RFC, fecha del informe y hospital.
4. **NADIE ha visto las 3 páginas de Allianz renderizadas en el navegador** con los 87 campos.
   Se revisó el mapa en PDF, que no es lo mismo que el visor pintando cajas sobre un lienzo.
5. ~~**GNP sigue bloqueado en el usuario**: ¿el de Eleonor (3 págs) o el oficial (2 págs)?~~
   ✅ **RESUELTO 2026-08-15: el OFICIAL, y ya está EN PROD.**

Para 1, 2 y 4 hay dos PDFs recién generados en `Downloads/`:
`allianz-MAPA-de-campos.pdf` (cada campo rotulado con su nombre) y
`allianz-DEMO-todo-lleno.pdf` (la hoja como la recibiría la aseguradora). Se regeneran con
`alta-formato mapa|demo`.

## 🔎 La lección del día, y ya tiene nombre

**Un rótulo pobre se ignora; uno FALSO se obedece.** Pasó TRES veces hoy, las tres intentando ser
útil derivando algo de la geometría:

| | |
|---|---|
| `vitales.tensionArterial` → **"Mts."** | la unidad de la caja de al lado |
| `paciente.rfc` → **`p2_RFC`** | que está en el bloque del MÉDICO |
| `p1_AAAA` → **"Diabetes Mellitus — AAAA"** | el hueco está en la mitad de *Hipertensivos* |

Las tres llegaron a shipear o casi. Ninguna la habrían encontrado los gates, el type-check ni el
`next build`. ⇒ **Cuando no se pueda saber, hay que dejar la etiqueta pelona**, y quien mire la
hoja la corrige.

Y la de método: **los 4 bugs REALES de Allianz los encontró el usuario usando la pantalla** — los
campos encimados, las fechas no editables, los importes, y "¿el agente entiende esto?". Los
contadores estaban en verde en los cuatro casos.

## Cómo se verifica que nada se rompió (todo corre en local, sin desplegar)

```bash
cd apps/doctor
npx tsc --noEmit                 # los scripts/ SÍ entran
cd ../.. && pnpm gates           # los 5
cd apps/doctor
npx tsx scripts/alta-formato.ts inspeccionar public/formatos/axa-gmm-informe-medico-2022-02.pdf
#   → 277 campos · 22 grupos · 13 al asistente   (AXA es el ORÁCULO: si cambia, algo se rompió)
npx tsx scripts/alta-formato.ts inspeccionar public/formatos/allianz-gmm-informe-medico-2023-02.pdf
#   → 87 campos · 14 grupos · 12 al asistente
npx tsx scripts/alta-formato.ts demo public/formatos/allianz-gmm-informe-medico-2023-02.pdf /tmp/x.pdf
#   → 87/87 llenados · 0 problemas · 0 campos vivos tras flatten
```

⚠️ **Hay `OPENAI_API_KEY` en `apps/doctor/.env.local`**: se puede llamar al modelo DE VERDAD desde
un script, sin desplegar. Es lo que destapó el bug del prefijo `campo:` tras dos sesiones en verde.
Un contrato con un LLM no se verifica leyendo el prompt.

## Lo que NO se re-litiga

- El PDF es una SALIDA, nunca la superficie de captura.
- Un campo sin fuente se queda VACÍO y marcado. Nunca se adivina.
- Nada se guarda hasta **Guardar** (1B); se descarta campo por campo (2B).
- El informe es un flujo **CONTENIDO**, no un módulo del asistente.
- `prisma db push` REVIERTE 3 cosas que viven sólo en prod. SQL manual + `prisma db execute`.
- El PDF base sale del **dominio de la aseguradora** (03-FORMATOS §5).

---


> **Handoff canónico de esta carpeta.** Estado vivo. Se actualiza al cerrar cada sesión.
> Última actualización: **2026-08-09**.

## Estado en una línea

**La funcionalidad ya EXISTE de punta a punta y está EN PROD.** Desde una consulta se elige el
formato, se pre-llena del expediente, se corrige, se descarga borrador o final y se marca emitido.
El usuario la abrió en vivo y se ve bien; falta generar un informe completo y **mirar el PDF**.

| | |
|---|---|
| Tablas + columnas de póliza | ✅ **EN PROD** (`3bad4c32` + 2 deltas del review) |
| `pdf-lib` + `pdfjs-dist` declaradas | ✅ con `pnpm-lock.yaml` en el mismo commit |
| `src/lib/informe-medico/` (motor de PDF) | ✅ **EN PROD** (`df14d647`, build verde 2026-08-09) |
| **Paso 4 — pre-llenado determinista** | ✅ **EN PROD** (`10b62279`) |
| **Paso 5 — endpoints + pantalla** | ✅ **EN PROD** (`15764dce`) y abierto en vivo |
| Fila de AXA en `insurance_forms` | ✅ **EN PROD** (60 entradas de diccionario) |

### El push de `df14d647` — build verde (2026-08-09)

Era el primer commit que Railway sí iba a construir (dependencias nuevas + un endpoint vivo).
**Sólo se redesplegó `@healthcare/doctor`**, que es lo correcto: los otros tres servicios no
tocan nada de esto. `BUILDING` → `SUCCESS` en ~2 min, y la app responde.

⚠️ **Lo que el build verde NO prueba:** el `serverExternalPackages: ["pdfjs-dist"]` sólo importa
cuando algo llama a `add-fields.ts` en runtime, y **nada lo llama todavía** (no hay endpoints). Ese
riesgo está diferido, no descartado. Igual el 409 de borrar-consulta-con-informes: inalcanzable
mientras `medical_reports` tenga 0 filas.

## Qué se hizo el 2026-08-08

1. Se exploró qué existe ya en el repo que sirva (resultado: **casi todo**).
2. Se le preguntó al usuario las tres decisiones que ramificaban el diseño. Respondió:
   - **Fidelidad:** las aseguradoras exigen **su formato exacto**. (Dijo que eran escaneos planos;
     al medirlos resultó que **no** — ver abajo. La exigencia de fidelidad sí se sostiene.)
   - **Entrega:** **descarga** + **link/correo al paciente**. NO correo directo a la aseguradora.
   - **Llenado:** los cuatro — manual, automático de la ficha, LLM sobre el expediente, y voz.
3. Se leyó el esquema real (`packages/database/prisma/schema.prisma`) para no inventar columnas.
4. Se escribieron `README.md`, `01-FUENTES` y `02-PLAN`.
5. **El usuario mandó 3 PDFs reales y se midieron** ⇒ la premisa de "escaneos planos" resultó
   **falsa**, y `02-PLAN` se reescribió el mismo día.

## 🎉 Lo más importante: NO son escaneos

Medido con `pdfjs-dist` sobre los 3 formatos que mandó el usuario:

| Formato | Págs | **Campos AcroForm** | Texto | Rot | Cifrado/XFA |
|---|---|---|---|---|---|
| **Allianz México** | 3 | **126** | ✅ | 0 | No |
| **AXA Seguros** (GMM) | 6 | **326** | ✅ | 0 | No |
| **GNP** | 3 | **132** | ✅ | 0 | No |

Los tres traen **campos rellenables**, capa de texto, tamaño carta, sin rotación, sin cifrado, sin
XFA y sin restricciones de permisos. Y el `Producer` de los tres es **`pdf-lib`** — ya pasaron por
la librería que íbamos a usar y sobrevivieron.

⇒ **Se cancela el calibrador de coordenadas** (era el paso más caro: ~30–60 min por formato).
⇒ Se llena **por nombre de campo**, y se aplana con `flatten()` antes de entregar.

> 🔴 **Trampa que costó un rato:** el `grep` crudo del PDF dice `/AcroForm 0` y **miente**. Son PDF
> 1.7 con object streams (`/ObjStm`): los objetos van comprimidos y grep no los ve. Sólo un parser
> real los encuentra. **No concluir "no tiene campos" desde un grep.**

### Lo que sí quedó de trabajo: los nombres de los campos

Existen, pero no todos dicen qué son. Tres niveles:

| Nivel | Formato | Ejemplo |
|---|---|---|
| 🟢 auto-descriptivo | AXA | `DiagnósticoRow1` · `Fecha de diagnóstico ddmmaaaaRow1` |
| 🟡 ambiguo | Allianz | `Congénito`, pero también `Si`, `No_2`, `Si_3` (¿a qué pregunta?) |
| 🔴 posicional | GNP | `P1_7`, `P2_15` — cero semántica |

Se resuelve derivando la etiqueta **por cercanía** (tenemos el `rect` del campo y las coordenadas
de cada texto de la página) + una pantalla chica de revisión. Mucho más barato que el calibrador
cancelado. Ver [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §3.

## El hallazgo que más cambia el diseño

El usuario avisó que **las consultas no tienen un esquema fijo** — no todas son SOAP, los doctores
crean el suyo. Al leer el esquema resultó **más manejable de lo que suena**:

`ClinicalEncounter` es **híbrido, no un either/or**. Siempre trae columnas fijas
(`encounterDate`, `chiefComplaint`, `encounterType`, los **7 signos vitales**, `followUp*`) y
*además* SOAP nullable, y *además* `customData` (JSON libre) cuando la plantilla era propia.

⇒ **Sólo `customData` es impredecible.** Todo lo demás se mapea con código estático y aburrido.
Y hasta `customData` es interpretable, porque `EncounterTemplate.customFields` guarda `label` y
`labelEs` de cada campo: se le puede dar al LLM *"Tipo de Lesión: nevo displásico"* en vez de
*"tipoLesion: nevo"*.

**Ya existe el precedente exacto de esa resolución** y hay que reusarlo, no reescribirlo:
`apps/doctor/src/lib/receta-custom-content.ts` (`resolveRecetaCustomContent`), con su fallback a la
clave cruda cuando la plantilla fue borrada.

## Las tres decisiones que no se re-litigan

1. **El PDF es una SALIDA, nunca la superficie de captura.** Se teclea contra un JSON en un
   formulario HTML; el PDF se genera y se aplana al final.
2. **Los formatos de aseguradora NO van en `encounter_templates`.** Esa tabla está scopeada por
   `doctorId`; los formatos oficiales son de plataforma y **versionados**.
3. **Un campo sin fuente se queda vacío y marcado.** Nunca se adivina, y cada valor propuesto carga
   su procedencia (determinista vs. interpretado por el LLM).

## 🔴 Y después: los PDFs eran de un TERCERO, y dos están mal

El usuario avisó que los PDFs se los dio **una empresa que no es la aseguradora**. Se compararon
contra el sitio oficial de cada una ⇒ [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md):

| | Del tercero | Oficial | Veredicto |
|---|---|---|---|
| **AXA** | 6p · 326 campos | 6p · **277 campos**, ya rellenable | ✅ Mismo doc — **usar el oficial** |
| **GNP** | 3p · 132 campos | **2p** · 62 campos | ⚠️ **Documentos distintos** — preguntar cuál rige |
| **Allianz** | 3p · creado **2016-12-29** | 3p · creado **2023-02-26** · **0 campos (plano)** | 🔴 El del tercero está **~7 años atrasado** |

**Los campos rellenables los puso el tercero con `pdf-lib` hace días** (`ModDate` 2026-08-05 /
2026-08-08). No son oficiales.

⚠️ **Esto corrige el hallazgo anterior:** el calibrador **no estaba cancelado, sólo reducido**. El
oficial de AXA ya trae campos, pero el de Allianz es plano y hay que ponérselos. Como sí tiene capa
de texto con coordenadas, las posiciones se pueden **auto-proponer** desde las etiquetas — el mismo
motor que deriva el diccionario (`02-PLAN` §3).

🔴 **Regla nueva:** el PDF base se baja del **dominio de la aseguradora**, y `insurance_forms`
guarda `sourceUrl` + `fetchedAt` además de la versión.

## ✅ Paso 2 VALIDADO el 2026-08-08 (en scratchpad, nada tocó el repo)

Se instaló `pdf-lib` **fuera del repo** y se llenó el **AXA OFICIAL**:

| Qué se probó | Resultado |
|---|---|
| Campos del oficial | **277** (255 de texto) |
| Llenado por nombre | **10/10** ✅ |
| `form.flatten()` | ✅ **0 campos vivos, 0 anotaciones** — el informe llega no editable |
| **Acentos y ñ** | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Neumonía` · `Antibiótico` · `oxígeno` — **todos intactos** |

Salida verificada leyendo el PDF generado de vuelta:

```
Guadalajara, Jalisco  Muñoz  Peña  María de los Ángeles  47  1.62 m  68.4 kg
130/85 mmHg  Neumonía adquirida en la comunidad  Antibiótico IV · oxígeno suplementario
```

### ✅ Y el CLIC lo dio el usuario (2026-08-08)

> *"axa lleno looks good and cant be edited"*

Abrió el PDF generado: **se ve bien y no se puede editar.** Eso cubre lo único que no se podía
verificar desde aquí (no hay renderizador de PDF en este entorno): que los valores caigan dentro de
sus casillas, que los acentos y la ñ se rindan como letras, y que el `flatten()` de verdad deje el
documento muerto.

⇒ **El motor de salida está PROBADO de punta a punta, con el clic incluido.** No queda riesgo
conocido en la generación del PDF: nombres de campo, acentos, flatten y apariencia, los cuatro
verificados.

(Copias para inspección: `Downloads/axa-lleno.pdf` y `Downloads/axa-oficial-vacio.pdf`.)

## ✅ ALLIANZ resuelto el 2026-08-08 — el PDF plano ya tiene campos

Era el único hueco de v1: el oficial de Allianz trae **0 campos**. Se le pusieron
**automáticamente**, sin hacer un solo clic.

### Cómo (y es reutilizable para cualquier formato plano)

1. **Sacar las reglas dibujadas** — las rayitas sobre las que escribe el doctor. Salen del
   *operator list* del PDF (`OPS.constructPath`), filtrando lo ancho y delgado (`w≥25`, `h≤3`).
2. **Deducir la etiqueta de cada regla** por vecindad:
   - **(a) por la izquierda** — el texto que termina justo antes de donde arranca la regla, en el
     mismo renglón (±6 pt). Es el caso normal: `Edad ______`.
   - **(b) por arriba** — si no hay nada a la izquierda, el texto de encima que esté **más
     centrado** sobre la regla. Así `Apellido Paterno` (la leyenda de la columna) le gana a
     `Nombre del Paciente:` (el título de la sección, pegado al margen).
3. **Crear el campo** con `form.createTextField(nombre)` + `addToPage` sobre la regla.

### Resultado

| | |
|---|---|
| Reglas detectadas (3 páginas) | **61** |
| Campos creados | **56** |
| Sin etiqueta (quedan para revisión manual) | 5 |
| Etiquetados por la izquierda | 43 |
| Etiquetados por arriba | 13 |
| Llenado de prueba | **12/12** ✅ |
| `flatten()` | ✅ 0 campos vivos, 0 anotaciones |
| Acentos | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Colecistectomía` · `Hernández` |

Salió `p1_Apellido_Paterno`, `p1_Apellido_Materno`, `p1_Nombres`, `p1_Edad`, `p1_Estado_Civil`,
`p1_FUM`, `p1_No_de_Embarazos`, `p1_Partos`, `p1_Mencione_cirugias_realizadas`… — **nombres
utilizables directamente**.

⚠️ **No todos salen bien, y eso es lo esperado.** `p1_AAAA` (una línea de fecha etiquetada con el
encabezado `AAAA`), `p1_y_cantidad` (la pregunta se partió en dos fragmentos de texto y agarró el
final), `p1_CAUSA` (la tabla de diagnósticos). **Ese es justo el trabajo de la pantalla de
revisión** (`02-PLAN` §3): el humano corrige un puñado, no teclea 56.

### Dos trampas que costaron un rato

- 🔴 **El `minMax` de `constructPath` está en coordenadas LOCALES del path, no de la página.** Hay
  que llevar la matriz de transformación (`OPS.transform` / `save` / `restore`) y aplicarla. Sin
  eso todas las reglas salen en `x=0, y=0` — y parece que el extractor "funciona".
- 🔴 **`setFontSize()` truena si el campo no está en una página todavía** (`No /DA entry found`).
  El orden correcto es `addToPage()` **y luego** `setFontSize()`.

### ✅ El CLIC lo dio el usuario (2026-08-08)

> *"the first one is the name, looks good. The last one is Antecedentes Perinatales, which also
> renders correctly."*

**La colocación automática es correcta.** Y la prueba es más fuerte de lo que parece: el nombre
está **arriba** de la página (y≈563) y Antecedentes Perinatales **abajo** (y≈196). Si la matriz de
transformación estuviera mal —origen invertido, escala equivocada, deriva acumulada— esos dos
**no** podrían caer bien los dos. Que ambos extremos queden en su raya valida el mapeo de
coordenadas en toda la altura de la hoja.

⇒ **El riesgo de colocación, que era EL riesgo de Allianz, está descartado.**

⚠️ **Lo que sigue sin verificarse: las páginas 2 y 3.** Los 12 valores de prueba eran todos de la
página 1. Las otras dos tienen campos creados pero nunca se les puso un valor ni se miraron.

## ✅ BORRADOR con dos capas de color — probado el 2026-08-08

Idea del usuario: al abrir el formato, el médico debe ver **dónde puede escribir** y **qué ya está
lleno**, en dos colores distintos.

Construido sobre el AXA oficial y **abierto por el usuario: "looks good in general"**.

| | |
|---|---|
| 🟦 Azul suave | se puede escribir (campo vacío) — **266** |
| 🟩 Verde suave | ya tiene contenido — **11** |
| Barra roja arriba | "BORRADOR — sólo lectura. NO enviar a la aseguradora" |
| Campos | **277/277 en sólo lectura** |

### El hallazgo del usuario al probarlo

> *"cuando escribo en uno azul, no se pone verde"*

**Correcto y no tiene arreglo en un PDF:** los colores se pintan en la página al generar, son una
foto. Un PDF no reacciona (el JavaScript de formulario de Acrobat lo ignoran Chrome, Edge, Firefox
y Preview).

⚠️ **Pero el síntoma destapó un problema mayor:** si el doctor puede teclear en el PDF, ese valor
vive **sólo en ese archivo**, fuera del JSON de respuestas — y al regenerar el borrador
**desaparece en silencio**.

⇒ **Decisión: el borrador es de SÓLO LECTURA.** Se edita en la app (ahí el color sí es vivo); el
PDF es una foto para revisar e imprimir. Regla completa en
[`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §4b.

Archivo: `Downloads/axa-BORRADOR.pdf`.

## ✅ PASO 1 — las tablas EN PROD (2026-08-08)

Corrido con el método del TOOLING (`railway run --service pgvector` + `prisma db execute`), **no
con `prisma db push`**. Archivo: `packages/database/prisma/migrations/create-informe-medico.sql`.

### Pre-vuelo read-only ANTES de tocar nada

| | |
|---|---|
| Schemas | `medical_records`, `practice_management`, `public` ✅ |
| ¿Existían las tablas nuevas? | **NO** ✅ |
| ¿Existían las columnas de póliza? | **NO** ✅ |
| PK de `patients` / `clinical_encounters` / `doctors` | **todas `text`** ⇒ las FK son `text` |
| Pacientes en prod | **198** |

### Lo que quedó

- **`medical_records.insurance_forms`** — catálogo a nivel plataforma: aseguradora, nombre,
  **versión**, `source_url` + `fetched_at` (procedencia), `pdf_url`, `field_dict` (JSONB),
  `fields_added_by_us` (TRUE para Allianz), `is_active`. Unique `(insurer, name, version)`.
- **`medical_records.medical_reports`** — el informe: `doctor_id`, `patient_id`, `encounter_id`,
  `form_id`, `answers` (JSONB con procedencia), `status`, `consent_given`/`consent_at`,
  `issued_at`, `created_by`.
- **`patients.numero_poliza`** + **`patients.poliza_aseguradora`** — nullable, el hueco de GNP.

> ℹ️ Nombres de tabla en **inglés** (`insurance_forms`, `medical_reports`) por consistencia con el
> resto del schema (`patients`, `clinical_encounters`, `prescriptions`), aunque el dominio se
> llame "informe médico".

### Verificado contra prod, sin confiar en el "Script executed successfully"

| | |
|---|---|
| Columnas | las 12 + 13 ✅ |
| Índices | **8** ✅ |
| FKs | **4**, con `CASCADE` / `SET NULL` / **`RESTRICT`** en `form_id` ✅ |
| Columnas nuevas en `patients` | las 2, nullable ✅ |
| **Filas tocadas** | **0** — 198 pacientes, 0 con póliza ✅ |

### Y el smoke de las FORMAS DE QUERY nuevas, por el cliente Prisma

**9/9 ✅** — `findMany` con `isActive`, `findUnique` por la unique compuesta, `include: { form }`
(el JOIN de la UI), include anidado paciente+consulta, `count`, `select` de las columnas nuevas,
`count({ numeroPoliza: null })` → **198**, la relación inversa `patient.medicalReports`, y filtro
por **JSON path** dentro de `answers`.

⚠️ El primer intento del smoke falló con un error de conexión transitorio; la misma query pasó al
reintentar y en la corrida completa. **No era el schema.**

### `schema.prisma` actualizado en el MISMO commit

`InsuranceForm` + `MedicalReport` + las 2 columnas de `Patient` + las relaciones inversas en
`Doctor`, `Patient` y `ClinicalEncounter`. `prisma validate` ✅ y `prisma generate` corrido.
**Si la BD y el schema divergen, el siguiente `db push` "arregla" la diferencia borrando la tabla.**

### Drift: hay, y es del REPO, no de este cambio

`prisma migrate diff` pide 471 líneas. De lo nuevo pide dos cosas: quitar el `DEFAULT` de
`updated_at` y recrear las 4 FK por `ON UPDATE CASCADE`.

**Las dos son el patrón que YA tiene el repo entero:** el mismo `DROP DEFAULT` sale para
`cfdi_drafts`, `patient_notes`, `bank_statements`, `doctor_fiscal_profiles` y 2 más; y la recreación
de FKs sale para una docena de tablas. **Las tablas nuevas quedaron idénticas a sus hermanas a
propósito** — mismo criterio que tomó CONSULTORIOS.

**Rollback** (nada lo lee todavía): está escrito al pie del `.sql`.

### El `/code-review` del paso 1 — 15 hallazgos, 3 eran del ESQUEMA y se corrigieron en prod

Las tablas tenían **0 filas**, así que arreglarlas salió gratis. Aplicado y verificado el mismo día:

1. **🔴 Faltaba el aislamiento por doctor.** `medical_reports` tenía FKs sueltas a `doctor_id` y
   `patient_id`: nada a nivel BD impedía que un informe apuntara al paciente de **otro doctor** —
   y de ahí sale un PDF con PHI ajena. Ahora lleva la **FK compuesta**
   `(patient_id, doctor_id) → patients(id, doctor_id)`, el mismo patrón que
   `bookings_patient_id_doctor_id_fkey`, apoyada en el índice `patients_id_doctor_id_key` que ya
   estaba en prod.
2. **🔴 `encounter_id` era `SET NULL` y las consultas SÍ se borran de verdad**
   (`clinicalEncounter.delete` en `encounters/[encounterId]/route.ts`). Borrar una consulta dejaba
   un informe **ya emitido** sin saber de dónde salió — justo lo que `01-FUENTES` §6 declara
   obligatorio. Ahora es **`RESTRICT`**.
3. **🟡 Podía haber dos versiones ACTIVAS del mismo formato** — el dropdown ofrecería la vigente y
   la superseded a la vez, y elegir la vieja es el rechazo que `03-FORMATOS` existe para evitar.
   Ahora hay un **índice único parcial** `UNIQUE (insurer, name) WHERE is_active`.

⚠️ **Ni la FK compuesta ni el índice parcial los sabe modelar Prisma** ⇒ `prisma db push` los
revertiría, igual que ya pasa con la FK compuesta de `bookings`. Los dos están comentados en
`schema.prisma` y viven en el `.sql`.

Lo demás eran **afirmaciones desactualizadas en estos docs** (que ya se corrigieron): el encabezado
que decía "cero tablas", el nombre fantasma `informe_medico` (shipeó como `medical_reports`),
preguntas abiertas ya resueltas, y dos hallazgos de hechos verificados aparte:

- **`pdfjs-dist` NO está instalada.** Sólo existe bajo `node_modules/.pnpm` como transitiva de
  `pdf-parse`; `node_modules/pdfjs-dist` no existe. Hay que declarar **dos** dependencias, no una.
- **Hay CUATRO implementaciones de la edad y tres tienen un bug de zona horaria** que hace cumplir
  años **un día antes** en UTC-6. Medido. Detalle y tabla en `01-FUENTES` §2.

> 🔎 **Un hallazgo del review estaba al revés:** decía que el bug de edad daba `edad−1` **el día
> del cumpleaños**. Medido: el día del cumpleaños las dos funciones dan lo mismo; la mala falla
> **el día ANTERIOR**, dando `edad+1`. El bug es real, la descripción no lo era.

## ✅ El motor ya vive EN EL REPO (2026-08-08)

`apps/doctor/src/lib/informe-medico/`, con `pdf-lib@^1.17.1` y `pdfjs-dist@^5.4.296` declaradas en
`apps/doctor/package.json` y `pnpm-lock.yaml` regenerado **en el mismo commit**.

> `pdfjs-dist` se fijó en la línea **5.x** —la que ya estaba en el store como transitiva de
> `pdf-parse`— y no en la 6.2.108 publicada: todo el código de medición está probado contra
> 5.4.296 y así no entra un segundo major al store.

| Módulo | Qué hace |
|---|---|
| `types.ts` | `AnswerOrigin` (conjunto CERRADO), `AnswerValue` con procedencia, `FieldDict` |
| `winansi.ts` | Qué caracteres NO puede imprimir el formato |
| `render-pdf.ts` | `renderFinal()` (llena + aplana) · `renderBorrador()` (dos capas + sólo lectura) |
| `add-fields.ts` | Ponerle campos a un formato PLANO (Allianz): reglas + etiqueta por vecindad |

`serverExternalPackages: ["pdfjs-dist"]` en `next.config.ts`: el "fake worker" hace un `import()`
dinámico de `pdf.worker.mjs` que el bundler no resuelve — funciona con `tsx` en local y truena con
`Cannot find module` en la ruta desplegada.

## 🔴 El `/code-review` del paso 1 — dos hallazgos CAROS y uno que venía mal

### 1. Cualquier `β`, `≥` o `→` tumbaba el informe ENTERO

`setText()` no falla; **falla `save()`**, y ahí se cae la generación completa, no un campo. Medido
contra el AXA oficial:

| Texto | |
|---|---|
| `Neumonía de Muñoz` · `dolor — intenso` · `dijo “me duele”` | ✅ pasa (los acentos SÍ son WinAnsi) |
| `HCG-β elevada` · `≥ 3 días` · `mejoría → alta` · `T ≈ 38°` | 🔴 **TRUENA** |

⇒ `winansi.ts` valida ANTES de escribir. **No se reescribe el texto del médico**: cambiar `β` por
"beta" en un documento firmado es peor que no imprimirlo. El campo se OMITE y se REPORTA con el
carácter culpable, para que la UI diga exactamente qué quitar:

```
omitido Tratamiento recibidoRow1 :: caracteres-no-imprimibles ["β","≥","→"]
```

### 2. 🔴 El `RESTRICT` que puse ROMPÍA borrar un paciente — y el arreglo del review tampoco servía

Probado contra prod dentro de una transacción con **rollback** (no quedó nada):

| `medical_reports.encounter_id` | Borrar CONSULTA con informe | Borrar PACIENTE |
|---|---|---|
| `RESTRICT` (lo que se shipeó) | ✅ bloquea | 🔴 **TRUENA** |
| `NO ACTION` (lo que sugirió el review) | ✅ bloquea | 🔴 **TRUENA IGUAL** |
| **`NO ACTION DEFERRABLE INITIALLY DEFERRED`** | ✅ bloquea (23503) | ✅ **funciona** |

Borrar un paciente dispara sus DOS cascades (a `clinical_encounters` y a `medical_reports`) en un
orden que no controlamos. Sin `DEFERRABLE`, la comprobación cae al final de la sentencia interna
del cascade y protesta aunque el informe se iba a borrar de todos modos. **Diferida se comprueba
hasta el COMMIT**, cuando ya no queda nada que apunte.

⚠️ Prisma no sabe expresar `DEFERRABLE` ⇒ es la **tercera** cosa que `db push` revertiría, junto con
la FK compuesta y el índice parcial. Las tres están comentadas en `schema.prisma`.

> 🔎 **Lección de método:** el review acertó el problema y falló el remedio. `NO ACTION` a secas
> no arregla nada aquí. Sin la prueba con rollback se habría "arreglado" y seguiría roto.
> Y mi PRIMERA corrida de esa prueba dijo "borrar la consulta PASÓ ❌" — era la prueba la que
> estaba rota (el parche no empató por un acento), no la restricción.

### Lo demás que salió del review

- Buffer de pdf.js **detached**: se transfiere al worker; ahora va una COPIA por llamada y se abre
  el PDF **una sola vez** con `destroy()` (antes: dos aperturas por página, todas sin cerrar).
- Widget sin `/P` ya no se pinta en la página 1 con coordenadas de OTRA página: se salta y se cuenta.
- "el campo no existe" ya no se confunde con "existe pero es una casilla".
- Un nombre de campo repetido ya no aborta el alta entera del formato.
- Borrar una consulta con informes devolvía **400 "referencia inválida"** — lo contrario de la
  verdad. Ahora es **409** con el número de informes que la bloquean.

## ✅ PASO 4 — el pre-llenado determinista (2026-08-09)

Tres módulos nuevos y una deuda vieja saldada. **Sin LLM y sin base de datos**: el pre-llenado es
una función pura, y por eso se pudo verificar campo por campo antes de que exista una pantalla.

| Archivo | Qué hace |
|---|---|
| `lib/edad.ts` | La edad, **UNA sola implementación** (antes 4, con 3 rotas — abajo) |
| `informe-medico/canonical.ts` | El canónico: **38** campos escalares + la lista de 10 medicamentos |
| `informe-medico/prefill.ts` | `construirPrefillDeterminista(entrada) → { answers, avisos }` |
| `informe-medico/dicts/axa.ts` | `campoCanónico → campo AcroForm` del AXA oficial |

### Verificado contra el PDF OFICIAL, no contra los docs

Los 27 nombres de campo del diccionario **se leyeron del PDF con pdf-lib**, no se copiaron de la
prosa de `04-MAPEO`. La corrida completa con un paciente realista:

| | |
|---|---|
| Campos canónicos con valor | **46** |
| Escritos en el AXA oficial | **27** · **0 omitidos** ⇒ los 27 nombres existen y son de texto |
| Tras `flatten()` | **0 campos vivos** |
| Acentos leídos de vuelta | ✅ `Muñoz` · `Peña` · `María de los Ángeles` · `Neumonía` |

Y el caso ESCASO (paciente con casi todo en NULL): **19 con valor, 59 en `empty`**, todos con
`value: ''` y `source: null`. Ningún fallo se disfrazó de vacío legítimo.

### 🔴 La edad estaba mal HOY, y el pre-llenado la habría copiado

`01-FUENTES` §2 decía que había 4 implementaciones y 3 con un bug de zona horaria. Se extrajo
`lib/edad.ts` y las cuatro apuntan ahí. Medido en esta máquina (UTC-6, 2026-08-09):

| Nacimiento | La vieja | La correcta |
|---|---|---|
| 1979-08-**10** (cumple MAÑANA) | **47** ❌ | **46** ✅ |
| 1979-08-09 · 1979-08-11 · 1980-05-15 | igual | igual |

⚠️ **Esto no era teórico: falla el día ANTERIOR al cumpleaños, y hoy es ese día para ese paciente.**
El arreglo también corrige la edad que ya se mostraba en el perfil del paciente, el timeline, las
tarjetas y el PDF de receta — las tres copias malas vivían ahí.

### Cuatro decisiones que quedaron tomadas en el código

1. **`Talla` sale en `cm`, no en `m`.** Todo el repo guarda `vitalsHeight` en centímetros
   (`VitalsInput`, el prompt de voz, el PDF de consulta). El `1.62 m` de la prueba del 2026-08-08
   era dato tecleado a mano, no del expediente: el pre-llenado escribe `162 cm`.
2. **`plan` NO va a `Tratamiento recibidoRow1`.** Ese renglón es tratamiento **pasado**; `plan` es
   el propuesto. Va a `Tratamiento propuesto quirúrgico no quirúrgico`.
3. **La cédula de especialidad se queda VACÍA si no se puede saber cuál rige.** Se descarta la
   entrada de "médico general" (ésa es la profesional, y repetirla haría que el informe declare la
   misma cédula dos veces) y, con varias especialidades, sólo se llena si una empata con
   `primarySpecialty`. "La primera" sería inventar cuál ejerce en este caso.
4. **Partir el apellido emite un AVISO**, siempre. Es una heurística (`de la Cruz`,
   `Ponce de León`) y el doctor tiene que verla. El `source` dice que viene de una heurística pero
   el `origin` sigue siendo `deterministic`: el conjunto está CERRADO en tres lugares ya shipeados.

Los `avisos` son un canal aparte de las respuestas — `medicamentos-truncados` (más de 10 recetados),
`apellido-heuristico`, `apellido-unico`, `sexo-desconocido`. Sin ellos el informe sale corto y se
ve completo.

### 🔴 El `/code-review` del paso 4 — la fecha estaba mal por la MISMA razón que la edad

Seis hallazgos reales, todos arreglados y verificados. El caro es el primero:

**1. `consulta.fecha` y la fecha de emisión salían en UTC.** `toISOString()` toma el día **UTC**, y
`ClinicalEncounter.encounterDate` **no es `@db.Date`: es un timestamp con hora.** Medido:

| Consulta | Lo que escribía | Correcto |
|---|---|---|
| 2026-08-09 **18:30** en CDMX (UTC-6) | **10/08/2026** ❌ | 09/08/2026 |
| 2026-08-09 09:00 | 09/08/2026 | 09/08/2026 |

Una consulta de las 6 de la tarde salía fechada **al día siguiente**, en el campo que la aseguradora
cruza contra la fecha del siniestro. Es **la misma clase de bug de zona horaria** que acabábamos de
extirpar de la edad, reintroducida en el mismo archivo el mismo día.

⇒ Ahora son **dos** helpers, y la diferencia es del esquema, no de gusto:
`fechaCalendario()` lee componentes **UTC** (para `@db.Date`, que Prisma devuelve a medianoche UTC)
y `fechaMomento()` lee componentes **locales** (para timestamps y para el "hoy" de la emisión).
Un `YYYY-MM-DD` pelón se trata como día calendario: `new Date('2026-08-05')` sería el día 4 en local.

**2–5. En el motor que ya está en prod** (`df14d647`), tres de ellos con el mismo patrón — algo
falla y se reporta como un vacío legítimo:

- **El borrador podía salir SIN PINTAR NADA.** `/P` es **opcional** en el spec del PDF y muchos
  generadores no lo ponen; sin él no se resolvía la página y el widget se saltaba. Un formato de
  277 campos habría dado un borrador "exitoso" con **cero recuadros** y un contador que ninguna UI
  lee. Ahora cae al `findPageForAnnotationRef()` — que es justo lo que hace `flatten()` por dentro,
  y por eso el FINAL sí funcionaba en esos PDFs.
- **Las 45 casillas de AXA se pintaban de AZUL** ("aquí se puede escribir") aunque estuvieran
  marcadas: sólo los campos de texto tienen `getText()`. Ahora cada tipo se pregunta por lo suyo
  (`isChecked()`, `getSelected()`).
- **El tracker de la matriz ignoraba los Form XObject.** pdf.js emite `paintFormXObjectBegin` con
  la `/Matrix` como operador **aparte**, no como `save` + `transform`. Un formato que envuelva su
  contenido en un XObject no sólo sacaba mal las reglas de dentro: dejaba la **pila desbalanceada**
  y corría el resto de la página. Allianz no lo trae y por eso no mordió.
- **`sinEtiqueta` contaba de más**: incluía las reglas cuyo `createTextField` reventó (que ya van
  en `noCreados`), inflando el número que la pantalla de revisión usa para decir cuánto hay que
  etiquetar a mano.

**6.** Este mismo doc decía "40 campos escalares" y son **38**.

**Regresión verificada tras los arreglos:** Allianz da **exactamente** los mismos números de antes
(61 reglas → 56 campos, 43 por la izquierda + 13 por arriba, 5 sin etiqueta, 0 no creados) y AXA
sigue en **0 omitidos** con `widgetsSinPagina: 0`.

> 🔎 **Lección:** `lib/edad.ts` se extrajo *para* matar un bug de zona horaria, y el pre-llenado
> que lo usaba metió otro igual tres funciones más abajo. Saber del bug no basta: lo que separa
> los dos casos es **si la columna es `@db.Date` o un timestamp**, y eso hay que mirarlo en el
> esquema cada vez.

### ⚠️ Lo que falta antes de creerle a esto

- **El CLIC.** Nadie ha abierto `Downloads/axa-PREFILL.pdf`. Que los 27 campos existan y se
  escriban **no prueba que sean los correctos**: `Nombre` (campo 217, entre `Tipo de participación`
  y `Especialidad`) se mapeó al médico por su posición en el bloque, y eso hay que verlo.
- **No hay fila en `insurance_forms`.** El diccionario de AXA vive en el repo porque todavía no
  existe la pantalla de alta; su lugar definitivo es `field_dict`.
- **Nada llama a esto.** Sigue sin haber endpoint ni pantalla (paso 5).

## ✅ PASO 5 — endpoint + pantalla (2026-08-09)

**Un doctor ya puede llegar.** Desde una consulta: botón *Informe* → elegir formato → pre-llenado →
corregir → descargar borrador/final → marcar emitido.

| | |
|---|---|
| `GET /api/medical-records/insurance-forms` | el dropdown |
| `GET·POST /patients/:id/reports` | crear corre el pre-llenado y lo GUARDA |
| `GET·PATCH /patients/:id/reports/:reportId` | leer · corregir · consentimiento · emitir |
| `GET …/pdf?tipo=borrador\|final` | render |
| `…/encounters/[encounterId]/informe` | la pantalla |

Todo cuelga de `/api/medical-records/*`, así que **hereda el permiso `expedientes`** sin tocar el
mapa de rutas — el `gate:routes` confirma 243/243 rutas cubiertas.

### Las decisiones del paso 5

1. **El PDF base vive en `public/formatos/`** (única carpeta que se despliega con garantía) y se lee
   con `fs`, nunca por HTTP. Es la hoja EN BLANCO que AXA ya publica: no es PHI.
2. **La fila de `insurance_forms` manda sobre el diccionario**; el del repo es la semilla y sólo se
   usa si la fila trae `{}`. Una sola regla: dos diccionarios "prefiriendo el que se vea mejor" es
   cómo divergen en silencio.
3. **Vaciar un campo guarda `empty`, no `""`.** "No hay dato" y "lo borré a propósito" siguen siendo
   cosas distintas de punta a punta.
4. **El cliente sólo puede escribir `origin: 'manual'` o `'empty'`.** Si pudiera declarar
   `deterministic`, se borraría la diferencia entre "lo copió el sistema" y "lo tecleó alguien".
5. **Un informe emitido no se edita** (409); se genera uno nuevo. La aseguradora ya tiene su copia.
6. **El FINAL no se genera sin consentimiento** registrado (LFPDPPP). El borrador sí: no sale del
   consultorio.
7. **Un formato que la BD conoce y este build no sabe generar no se ofrece** y se rechaza con 409.

### ✅ La fila de AXA, EN PROD

Corrida con `prisma db execute` vía `railway run --service pgvector`. El `.sql` está **generado**
desde `dicts/axa.ts`, no tecleado: 60 entradas y una errata silenciosa deja campos sin llenar en un
PDF que se ve bien.

Verificado **sin confiar en el "Script executed successfully"**: 1 fila, `is_active`, 60 entradas de
`field_dict`, acentos intactos (`Información general`, `GMM Informe Médico`), y el diccionario de
prod **idéntico byte a byte** al del repo (60/60 claves) — que importa porque el render prefiere el
de la BD.

### 🔴 El `/code-review` del paso 5 — DOS de mis arreglos anteriores eran FALSOS

Nueve hallazgos. Los dos primeros son la lección:

1. **El fallback de `/P` no hacía nada.** `findPageForAnnotationRef` devuelve una **`PDFPage`**, no
   una `PDFRef`; se asignó a `pageRef` y se comparó contra `p.ref` ⇒ **siempre falso**. TypeScript
   no lo vio porque la unión se traslapa. El arreglo que se reportó como hecho era decorativo.
2. **La matriz del Form XObject tampoco se aplicaba.** pdf.js la manda como **`Float32Array`**, así
   que `Array.isArray()` daba `false`. Se había arreglado el balanceo de la pila y dejado roto justo
   lo que se venía a arreglar.

> 🔎 **Lección:** *"lo arreglé, type-check y gates en verde"* no dice nada sobre si el arreglo
> **corre**. Los dos eran no-ops silenciosos. Un arreglo que no se puede observar ejecutándose —
> aunque sea con un `console.log` o un conteo— no está verificado.

**Y un hallazgo del review estaba MAL:** decía que el helper de pdf-lib devuelve la primera página
con `/Annots` porque `indexOf` da `-1`. **No:** el `PDFArray.indexOf` de pdf-lib devuelve
`undefined` cuando no está, así que la comprobación es correcta. Medido sobre los 277 campos de
AXA: **304/304 widgets a su página correcta.** Se delegó en el helper en vez de reescribirlo.

Los otros siete, todos arreglados:

- **Las recetas en `draft` se declaraban a la aseguradora** como el tratamiento del paciente
  (`status` viene por default en `draft`). Ahora sólo `issued` + `expired` — la vencida SÍ fue el
  tratamiento; que hoy esté vencida no la borra de la historia.
- **La pantalla se quedaba con `campos` viejos tras un PATCH:** el chip seguía diciendo "del
  expediente" sobre algo tecleado a mano, y teclear `A→B→A` **no mandaba el PATCH** de vuelta,
  dejando **`B`** en el servidor. Ahora relee y los inputs son controlados.
- **Callejón sin salida tras emitir:** 409 al editar y ningún camino a generar otro. Ahora lo hay.
- **Los avisos se perdían al recargar** — ahora se RECALCULAN en el GET.
- **Una fecha mal formada salía como `"NaN/NaN/NaN"` marcada `deterministic`.** Ahora cae a `empty`.
- **El campo de la FECHA del encabezado de AXA se llama `Información general`** (el generador le
  agarró la etiqueta equivocada). Confirmado por geometría: x=307,y=587, junto a `Lugar`
  (x=35,y=586). Sin esto **todo informe de AXA salía con la fecha del encabezado en blanco**.

Regresión tras los arreglos: AXA **0 omitidos** y `widgetsSinPagina: 0`; Allianz igual que siempre
(61 reglas → 56 campos, 5 sin etiqueta, 0 no creados).

### ✅ Desplegado y CLICKEADO (2026-08-09)

`15764dce` → **SUCCESS**, y **sólo se movió `@healthcare/doctor`** (los otros tres servicios no
tocan nada de esto). El usuario lo abrió en vivo: ***"apparently all gud"*.**

Verificado DENTRO del contenedor, que era el riesgo abierto del paso 5 (¿se despliega el PDF base?):

```
-rw-rw-r-- 330612  /app/apps/doctor/public/formatos/axa-gmm-informe-medico-2022-02.pdf
pid=29  cwd=/app/apps/doctor  next-server (v16.0.10)
```

El archivo está completo y `next-server` corre con cwd `/app/apps/doctor`, que es contra lo que
resuelve el `path.join(process.cwd(), 'public', 'formatos', …)` de `leerPdfBase`.

> ⚠️ **PID 1 es `pnpm` y su cwd es `/app`.** Si se hubiera mirado el proceso de arriba, la ruta
> habría parecido equivocada. Hay que mirar el proceso de `next-server`, no el de arranque.

🔎 **Corrección a lo que decía este doc:** el PDF en blanco **NO** queda públicamente descargable.
El middleware redirige `/formatos/*` a `/login` como todo lo demás.

### ⚠️ Lo que el clic NO cubre

*"Apparently all gud"* dice que la pantalla abre y se ve bien. **No** confirma, salvo que se haya
probado a propósito:

| | |
|---|---|
| Descargar el **borrador** y mirarlo | ⬜ por confirmar |
| Marcar consentimiento → descargar el **FINAL** | ⬜ por confirmar |
| Que el encabezado de AXA salga con `Lugar` **y** fecha (el arreglo de hoy) | ⬜ por confirmar |
| Corregir un campo y ver que el chip pase a "lo escribiste tú" | ⬜ por confirmar |
| El **409 de borrar una consulta con informes** | ⬜ sigue inalcanzable hasta que exista una fila |

⇒ Antes de considerarlo cerrado, generar UN informe completo de punta a punta y abrir el PDF.

## ✅ EL VISOR — el formato de AXA con las cajas encima (2026-08-09)

Pedido del usuario después de ver el paso 5: *"instead of just the fields opening in our format, I
was hoping the PDF like format from AXA opens with the fields already inputted… and that they were
have the colors there."*

Tenía razón: la lista de campos carga el mismo dato pero pierde lo que lo hace obvio — **ver la
hoja llenarse**. Y es justo lo que `02-PLAN` §4b anticipaba al decir *"se edita en la app, ahí el
color SÍ es vivo"*: la regla de "el borrador es de sólo lectura" era sobre el **archivo
descargado**, no sobre un editor dentro de la app.

### Cómo funciona

La página del PDF se pinta en un `<canvas>` con pdf.js y encima van `<input>`s absolutos, uno por
campo del diccionario. **Se teclea en HTML, nunca en el PDF**: el valor va al mismo JSON de
respuestas, así que el visor y la lista son dos caras del mismo dato. Los colores por fin están
vivos porque son CSS: escribir en una caja azul la pone azul-cielo al instante.

| | |
|---|---|
| 🟦 azul | vacío — puedes escribir |
| 🟩 verde | vino del expediente |
| 🟦 azul cielo | lo escribiste tú |
| 🟧 ámbar | lo redactó la IA (paso 6) |

Piezas nuevas: `GET /insurance-forms/:formId/pdf` (la hoja en blanco), `GET …/geometria` (dónde cae
cada campo), `InformeVisor.tsx`, y pestañas **Formato** / **Lista de campos** — la lista se queda de
red por si el render falla en algún navegador.

**El worker de pdf.js se copia a `public/pdfjs/` en `prebuild`** (`scripts/copy-pdf-worker.mjs`) en
vez de dejárselo al bundler: ese import dinámico es exactamente lo que ya tronó una vez en la ruta
desplegada. El archivo también va commiteado, por si el `prebuild` no corriera.

### La geometría, verificada antes de dibujar nada

```
páginas: 6 × 609×794 · cajas ubicadas: 60 · sin ubicar: 0 · fuera de la hoja: 0
informe.lugar  p1 pdf(35,586)  -> css(left=35,  top=195)
informe.fecha  p1 pdf(307,587) -> css(left=307, top=193)
```

Que esos dos queden lado a lado en el encabezado es LA prueba de que el volteo de coordenadas
(PDF mide desde abajo-izquierda, CSS desde arriba-izquierda) está bien: si estuviera invertido
caerían hasta abajo de la hoja.

⚠️ Las 60 cajas caen en las páginas 1, 2, 3 y 5. **Las páginas 4 y 6 se ven sin cajas** — es
correcto (se mapean 60 de los 277 campos de AXA), pero parece vacío.

### 🔴 El `/code-review` del visor — habrías abierto 6 hojas EN BLANCO

Cinco hallazgos, y el primero era un bloqueador garantizado en cada montaje:

**`cargando` tapaba los `<canvas>`.** El return temprano no los montaba, así que cuando corría el
efecto de render los 6 se saltaban por `if (!canvas) continue`; luego `cargando` pasaba a false, los
lienzos aparecían — y el efecto ya no volvía a correr. **Seis páginas blancas con las cajas flotando
encima, y tocar el zoom "arreglaba" la hoja.** Ahora la guarda es `!geo`.

> 🔎 **Tercera vez hoy con la misma forma:** el código correcto en sí mismo, equivocado sobre
> CUÁNDO corre. Type-check, los 5 gates y un `next build` verde pasaron por encima de los tres.

Los otros cuatro:

- **Un guardado fallido tiraba lo tecleado**: `guardarCampo` resolvía normal con `!r.ok`, así que la
  caja se revertía al valor viejo con el aviso hasta arriba de una hoja de 6 páginas. Ahora devuelve
  un booleano y el borrador sobrevive al fallo.
- **Las casillas se descartaban en silencio** — rompiendo justo la invariante que `sinUbicar`
  existe para sostener. Hoy es latente (AXA mapea 0), pero se dispara en cuanto se edite un
  `field_dict` en la BD, que es el camino de "corregir un mapeo sin desplegar" que el diseño ofrece.
- **El volteo asume MediaBox en el origen y sin rotación**, pero pdf.js arma su viewport con el
  **CropBox** y aplica `/Rotate`. Un formato rotado pondría TODAS las cajas mal, sin ningún error.
  Ahora se detecta y no se dibuja nada: mejor mandar a la lista que enseñar cajas convincentes en el
  renglón equivocado de un documento médico-legal. (AXA y Allianz: rot 0 en todas sus páginas.)
- **A 250% × dpr 2 las 6 páginas piden ~290MB de lienzo**; Safari tira el backing store y las
  páginas se ponen blancas — idéntico al síntoma del bloqueador. `escala × dpr` queda acotado.

## ✅ TODA la hoja es editable (2026-08-09)

El usuario abrió el visor y cachó el desajuste: *"in the rendered application I can just edit very
few inputs. And when I download the draft, I can see a lot of blue ones that in theory should also
be able to be edited in the live form but currently can't."*

Tenía razón, y los números eran feos:

| | Antes | Ahora |
|---|---|---|
| Cajas editables en el visor | 60 | **304** (255 de texto + 49 widgets de casilla) |
| Azules en el borrador pero NO editables | **195** | 0 |
| Páginas con cajas | 1, 2, 3, 5 | **las 6** |

Las dos vistas se manejaban con listas distintas: el borrador pinta **todos** los campos del
AcroForm (`form.getFields()`), y el visor sólo los del **diccionario**. El borrador era el honesto.

### La corrección de fondo: el diccionario no decide dónde se teclea

El diccionario mapea **conceptos canónicos → campos del PDF** para PRE-LLENAR. No tiene por qué
decidir en qué blancos puede escribir un humano. Lo que no mapea ahora es un **campo CRUDO**:
`campo:<nombre en el PDF>` (`types.ts`), que se guarda en el mismo `answers` con `origin: 'manual'`.
Las claves canónicas nunca llevan `:`, así que no pueden chocar.

> 🔴 **Lo que casi se rompe:** `renderFinal` recorría el DICCIONARIO. Con campos crudos, lo que el
> doctor tecleara se guardaba en el JSON y **jamás llegaba al PDF** — un informe al que le faltan
> justo los campos que escribió el médico, sin ningún aviso. Ahora se recorren las RESPUESTAS.
> Verificado leyendo el PDF de vuelta: `J18.9` y `No aplica` salen impresos.

Y hubo que separar los omitidos **benignos** de los problemas: al recorrer respuestas, un informe
sano reportaba "5 omitidos" porque el pre-llenado produce canónicos que AXA no pide
(`paciente.sexo`, `nombreCompleto`…). Un contador que nunca da cero enseña a ignorarlo. Ahora
`problemas` excluye `sin-campo-en-el-formato`: informe sano = **0**, mapeo roto = **1**.

### 🔴 El `/code-review` — mi propia guarda de rotación vaciaba TODO

Seis hallazgos reales. El grave era mío y del review anterior:

**La guarda de página rotada devuelve `cajas: []` SIN lanzar excepción**, así que el `catch` que
caía al diccionario nunca se ejecutaba: `claves` quedaba vacío y el doctor veía el visor vacío **y**
la lista vacía con "0 de 0 campos" — con el pre-llenado ya guardado en la BD. Una guarda de
seguridad que causaba pérdida total de datos en la UI. Ahora las claves son la **unión** de hoja +
diccionario + respuestas ya guardadas (`campos-del-informe.ts`): el caso rotado ofrece 61 claves.

- **Respuestas sin caja desaparecían de las dos vistas** pero SÍ se escribían en el PDF. Cubierto
  por la misma unión.
- **El aviso mandaba a una pestaña que, por construcción, no tenía esos campos.**
- **Cada `blur` releía el PDF del disco y parseaba los 277 campos**, en una ruta que sirve PHI.
  Ahora se cachea por formato, con clave que incluye el `updatedAt` de la fila para que editar el
  `field_dict` en la BD invalide solo.
- **Una casilla se podía marcar pero NUNCA desmarcar**: el valor vacío se saltaba antes de llegar a
  la rama de casilla. Sobre un PDF base con una casilla marcada por default, destildarla igual
  emitía el informe con la casilla puesta — una afirmación falsa en un documento médico-legal.
  Probado con `Sí acepto` premarcada.
- **Un 401 devuelve HTML** y `.json()` tronaba: el doctor leía `Unexpected token '<'` en vez de
  "se venció la sesión".

> 🔎 **Un hallazgo estaba MAL, y los dos reviews se contradecían entre sí:** decía que pnpm 10 no
> corre `prebuild`, dejando el copiado del worker como código muerto. **Se probó borrando el worker
> y reconstruyendo dos veces** — con `pnpm --filter` y con `turbo run build`, que es la ruta real de
> Railway. Las dos lo regeneraron. Un hallazgo de review es una hipótesis, no un veredicto.

⚠️ **49 widgets de casilla contra 22 campos de casilla:** varios campos tienen más de un recuadro
en la hoja compartiendo un valor. Marcar uno marca sus hermanos. Es como está armado el PDF, no un
bug, pero sorprende la primera vez.

## ✅ Las CASILLAS son grupos excluyentes, no booleanos (2026-08-09)

El usuario probó el visor: *"if I click on one, the other two also get selected… and when I download
that PDF, no check marks are checked at all."*

Los dos síntomas salen de **la misma premisa equivocada**: yo trataba cada casilla como un booleano
independiente. **No lo son.** Medido en el AXA oficial:

| Campo | Recuadros | on-states |
|---|---|---|
| `MAM` | 4 | `/M` `/A` `/E` `/S` |
| `TE` | 4 | `/U` `/H` `/CE` `/C` |
| `Consultorio_2` | 4 | `/1` `/2` `/3` `/4` |
| `Sí acepto` | 2 | `/On` `/O` |

Son **22 campos con 49 recuadros**: un campo = un grupo de opciones mutuamente excluyentes, y el
PDF guarda **UN valor por campo** que dice cuál recuadro está encendido. De ahí los dos bugs:

1. **Se marcaban todos los hermanos** — los 4 recuadros compartían la misma clave, así que un solo
   valor los pintaba a los cuatro.
2. **La marca caía en el recuadro equivocado** — `check()` de pdf-lib pone el on-state del
   **PRIMER** recuadro. Si el doctor elegía la tercera opción, el PDF marcaba la primera; mirando
   la casilla que uno tocó, se ve **sin marcar**.

### El arreglo: el VALOR es el on-state

Es como lo modela el PDF, así que no hace falta inventar claves nuevas ni migrar nada:
`answers['campo:MAM'] = { value: 'E' }` significa "la opción `/E`". El recuadro se pinta marcado
sólo si el valor es **el suyo**, y al renderizar se pone `/V` al on-state elegido y el `/AS` de cada
recuadro en consecuencia.

Un valor que no empate con ningún on-state (el `'1'` que guardó la versión anterior) cae a
`check()`: marca el primero en vez de perder la respuesta.

**Verificado** eligiendo la TERCERA opción de `MAM`:

```
el visor marcaría: M=·  A=·  E=✔  S=·      ← sólo una
/V del campo = /E    /AS por recuadro = /Off /Off /E /Off
49 de 49 casillas con on-state detectado
```

> 🔎 **Lo que NO se pudo reproducir:** "cero marcas". El código viejo sí marcaba el primer recuadro
> de cada grupo. La explicación más probable es que la marca caía en una opción distinta de la que
> el doctor tocó — que al mirar la casilla que uno eligió se lee exactamente como "no se marcó
> nada". El arreglo cubre las dos lecturas, pero conviene confirmarlo con los ojos.

## 🔴 La hoja "EN BLANCO" de AXA NO viene en blanco (2026-08-09)

El usuario: *"algunas casillas vienen como pre-marcadas de forma borrosa… `Consultorio` tiene esa
marca y yo no la seleccioné, pero al descargar el PDF sale marcada."*

Medido sobre el AXA **oficial**: **9 de sus 22 casillas traen valor de fábrica.**

```
Consultorio_2                /V=/1     ← el ejemplo del usuario
Se ajusta a Tabulador médico /V=/On    ← una declaración de FACTURACIÓN
Sí_5 /On · No_6 /On · MAM /M · S1 /N · ANP3 /3 · Check Box1 /n · Sí acepto_2 /O
```

Como el render sólo tocaba los campos CON respuesta, esas marcas sobrevivían al aplanado y **el
informe afirmaba cosas que el médico nunca eligió**, en un documento que él firma. Es exactamente
lo que prohíbe la regla de [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §4 — sin fuente,
vacío — sólo que aplicada a casillas, que es donde no se había pensado.

### Dos arreglos, porque eran dos superficies

1. **Al renderizar** (`normalizarCasillas`): antes de aplicar respuestas se apaga **toda** casilla
   sin contestar. Lo que el doctor sí marcó se vuelve a encender enseguida.
2. **En el visor**: pdf.js dibuja la apariencia guardada de cada widget, así que las 9 marcas
   salían pintadas en el lienzo **debajo** de una casilla HTML vacía — de ahí lo "borroso", y de
   ahí que no se pudieran desmarcar: para la app nunca estuvieron marcadas. La hoja de fondo se
   sirve normalizada (`leerPdfBaseParaVisor`).

> ⚠️ Se usa `field.uncheck()` y no se tocan los diccionarios a mano: `uncheck()` marca el campo
> como sucio y eso hace que `flatten()` le regenere una apariencia `/Off`. Varias casillas de AXA
> **no traen apariencia `/Off` propia** (`Check Box2`, `Consultorio_2`, `Matutino`: sus widgets sólo
> tienen `/1 /2 /3 /4`), y aplanar sin regenerarla truena con `Failed to extract appearance ref`.

**Verificado** con el caso exacto del usuario — el doctor elige **Hospital** y nada más:

```
hoja original       : 9 casillas marcadas de fábrica
hoja para el VISOR  : 0
borrador y final    : ["Consultorio_2=/2"]   ← sólo Hospital
```

## ✅ EL CHAT — conversar con el formato (2026-08-09)

El paso 6. El agente ya conoce la hoja: **dice qué falta, pregunta, y coloca lo que el doctor le
cuenta en ÁMBAR sobre el formato** — no en una lista dentro del chat. Plan y detalle en
[`06-AGENTE`](06-AGENTE-conversar-con-el-formato.md) §11.

### 🔴 Se cayeron las tools, y la razón está MEDIDA

`06-AGENTE` §8 daba por hecho que "los 255 campos no caben en el prompt" y diseñaba **tres
tools** para servirlos por página. Se midió antes de construir:

| | |
|---|---|
| Los 255 campos de texto de AXA | **15.3 KB · ~3,800 tokens** |
| El prompt de sistema entero | **18.8 KB · ~4,700 tokens** |

Caben de sobra ⇒ **un solo JSON por turno**, sin tool loop. Y no es un atajo: servirlos completos
**es el producto**, porque el agente sólo puede decir *qué falta* si ve la hoja ENTERA. Acotado
por página volvería a poner al doctor a adivinar qué le preguntan, que es justo por lo que el
dictado de un tiro no alcanzó.

⚠️ **Sin tools no hay schema que valide los nombres de campo** ⇒ la validación es explícita y
server-side: cada clave se comprueba contra la hoja real (existe · es de texto · imprime en
WinAnsi) y lo que no pasa se DEVUELVE en `descartados` para que el cliente lo enseñe. Es el
antídoto a la debilidad conocida de la arquitectura C: *el modelo inventa nombres, el cliente no
aplica nada y el chat dice "listo"*.

### El orden del prompt es una decisión de costo

Catálogo **primero** (idéntico en cada turno) y lo volátil después, en un segundo mensaje de
sistema: los proveedores cachean el **prefijo común**. Por eso `camposDictables()` ordena por
(página, clave) y no deja el orden del AcroForm. ⚠️ Lo medido es el **tamaño**, no el ahorro.

### 🔴 El chat NO marca casillas, a propósito

Las 22 casillas de AXA quedan fuera del catálogo. Sus on-states son opacos (`/1`, `/M`, `/CE`):
nadie puede saber que `/2` es "Hospital" sin mirar la hoja, y proponer uno sería **afirmarle algo
a la aseguradora sin saber qué**. El agente lo DICE con palabras y el doctor la marca en el
visor. La UI lo advierte al pie, para que la ausencia no se lea como una falla.

### Dos extracciones que no son limpieza

`campos-dictables.ts` (la lista de campos) y `contexto-clinico.ts` (una consulta → texto) vivían
**en línea dentro de `dictar/route.ts`**. Copiarlas al chat es cómo los dos endpoints acaban
ofreciendo conjuntos distintos — el dictado llena un campo y el chat dice que no existe.
Verificado: el subconjunto de la página 1 del chat es **idéntico** al del dictado.

### Y de paso, dos cosas que estaban mal

- **`toISOString()` en la fecha de las consultas que se le mandan al modelo.** El servidor corre
  en UTC: una consulta de las 6 de la tarde en CDMX se le presentaba al modelo fechada **al día
  siguiente**. Ahora va con `timeZone: 'America/Mexico_City'` explícito, que es la convención del
  repo (`agenda-agent/dates.ts`, facturas, fiscal). **Es el mismo bug del paso 4, tercera vez.**
- **`origin: 'llm'` se guardaba con `source: 'dictado'`.** El PATCH mapeaba todo lo que no fuera
  `manual`/`empty` a "dictado", así que lo que redactó el modelo iba a quedar declarado como algo
  que el médico dijo con su boca. En un documento médico-legal, quién lo escribió es la mitad del
  dato. Ahora hay una tabla `origin → source` y `llm` es **`asistente`**.

### Lo verificado — y lo que NO cubre

Contra el AXA real: **255** campos ofrecidos (páginas 1–6) · **0** claves que no llegarían al
PDF · dictado p1 === chat p1 · **0** casillas coladas · descarta el campo inventado y la `→`.
`type-check` ✅ · los 5 gates ✅ · `next build` ✅ con la ruta nueva en la lista.

🔴 **Nada de eso es el CLIC.** No se ha mandado un solo mensaje: no hay ninguna respuesta real
del modelo ni se ha visto una propuesta caer en ámbar sobre la hoja. Lo verificado es la mitad
determinista, y por construcción no dice si el agente **conversa bien** — que es exactamente lo
que el dictado falló.

### 🔴 El `/code-review` — 12 hallazgos, y los DOS peores no eran del chat

Son del **estado PENDIENTE** (`a6aa9841`), y los dos son la misma lección: **1B rompió la
invariante de que lo que se ve es lo que está guardado**, y tres superficies seguían leyendo
de la base como si nada hubiera cambiado.

**1. 🔴 Emitir con pendientes = PÉRDIDA TOTAL, en silencio.** `emitir()` mandaba
`{status:'issued'}` sin guardar nada. El doctor conversa, ve 12 valores en ámbar sobre la hoja,
aprieta *Marcar como emitido* → se emite con las respuestas **viejas**; `emitido` esconde la
barra ámbar y pone el visor en sólo lectura; los 12 valores desaparecen **sin un solo mensaje**,
y el informe ya no se puede editar (409). La aseguradora recibe la hoja sin ellos.

**2. 🔴 El PDF se genera de lo GUARDADO.** `/pdf` lee `report.answers` de la base. Descargar el
**borrador** —que ES la superficie de revisión— devolvía una hoja a la que le faltan justo los
campos recién puestos, y se ve completa. Igual el **final**, que es el que se manda.

⇒ Los dos se arreglan con la misma regla, ahora **visible**: con pendientes, los botones de
descargar y de emitir se **deshabilitan** y dicen por qué. El PDF siempre refleja lo guardado.

> 🔎 **La lección:** cambiar *cuándo* se persiste no es un cambio de UI. `type-check`, los 5
> gates y `next build` pasaron por encima de los dos, porque no hay nada mal tipado: hay una
> invariante que dejó de valer y tres lectores que no se enteraron. **Al mover el momento del
> guardado hay que ir a buscar a TODOS los que leen de la base.**

Los otros diez, todos arreglados:

- **Guardar tiraba lo tecleado mientras el PATCH viajaba** — `abrirInforme` hacía
  `setPendientes({})` a ciegas. Ahora sólo se limpia lo que se mandó **y no ha vuelto a cambiar**.
- **Una caída de red al Guardar era muda**: sin `catch`, la ruedita paraba y ya — mismo aspecto
  que antes de apretar. (Y en este repo los "no puedo entrar" suelen ser DNS del cliente.)
- **El DICTADO seguía leyendo `answers` para saber qué está lleno** — que desde 1B está siempre
  vacío. Dictabas la página 1, corregías dos campos a mano, volvías a dictar y el modelo
  **re-proponía encima de tus correcciones**. Ahora recibe los mismos `pendientes` que el chat.
- **El micrófono del chat se quedaba ABIERTO al emitir**: `if (deshabilitado) return null` no
  desmonta, y la limpieza que cierra el `MediaRecorder` corre al desmontar. Ahora el panel se
  monta sólo si el informe se puede editar (que es como `DictadoPagina` ya lo hacía).
- **Un campo recién VACIADO se le reportaba al agente como lleno** — el cliente filtraba los
  vacíos, así que el modelo lo veía con su valor guardado, no lo contaba como faltante y
  preguntaba sobre un dato que el doctor acababa de quitar.
- **`String(bruto)` convertía un objeto anidado en `"[object Object]"`** y lo dejaba caer en
  ámbar sobre la hoja, listo para guardarse en un documento médico-legal. Pasaba en el chat y
  **ya pasaba en el dictado**; arreglados los dos.
- **El chip de procedencia enseñaba el origen GUARDADO** junto a un valor pendiente: una
  propuesta de la IA salía marcada *"sin dato en el expediente"*. El chip es la señal de
  `01-FUENTES` §4 para saber dónde leer con cuidado, y apuntaba al revés.
- **El aviso de "cambios sin guardar" no salía en Safari** — falta `e.returnValue = ''`.
- El 400 del PATCH seguía diciendo que los orígenes válidos eran dos, y son cuatro.
- Y este mapa de IA tenía el blockquote **partiendo la tabla** de endpoints.

⚠️ **Lo que el review NO puede cubrir:** el harness verifica el catálogo y la validación
determinista, pero **ningún arreglo de la UI se ha visto correr**. Los dos graves son
precisamente de interacción.

## ✅ EL CHAT, PROBADO EN VIVO — los 3 arreglos (2026-08-10)

Veredicto del usuario: *"it's getting better, but still a long way to go"*. Tres cosas concretas:
**las fechas no aterrizaban**, **ninguna casilla se marcaba**, y **el chat tapaba la hoja**.

### 🔴 Las fechas y las casillas eran EL MISMO bug

Al modelo se le estaban dando los **nombres internos del AcroForm**, que en AXA muchas veces no
significan nada:

| Lo que veía el modelo | Lo que es de verdad |
|---|---|
| `campo:Día_4` | **Fecha de cirugía** |
| `campo:Día_6` | **Fecha de alta** |
| `campo:Consultorio_2` | el grupo Consultorio · Hospital · Gabinete · Otro |
| `campo:Sí_3` | el Sí/No de **"¿Es cáncer?"** |

Nadie puede elegir un campo cuyo nombre no dice qué es. Lo que sí lo dice es **el texto impreso
alrededor**, y eso ya se sabía leer: es el mismo motor de vecindad que le puso campos al Allianz
plano (`add-fields.ts`). Nuevo `etiquetas-de-la-hoja.ts`.

**Casillas — resuelven las 49 de 49.** La etiqueta es el texto **a la derecha** del recuadro; la
pregunta del grupo, el texto a la **izquierda del primero**:

```
TE            → Urgencia · Hospitalización · Corta estancia/ambulatoria · Consultorio
Consultorio_2 → Consultorio · Hospital · Gabinete · Otro
Sí_3          → «¿Es cáncer?»  Sí · No
```

🔴 **El modelo devuelve la ETIQUETA, nunca el on-state.** `/H` lo resuelve el servidor contra el
PDF. Si el modelo pudiera mandar el on-state, un `/2` inventado marcaría una opción que nadie
eligió en un documento que el médico firma. Y si la etiqueta no empata con ninguna del grupo **se
descarta** — no se aproxima "la más parecida", porque en un grupo excluyente eso es afirmar algo
falso. Verificado: elegir `Consultorio` marca **`/C`, el 4º recuadro**, no el 1º.

> ⚠️ **Corrijo lo que yo mismo escribí ayer.** El commit anterior decía que las casillas quedaban
> fuera "a propósito, porque los on-states son opacos y haría falta el motor del paso 3". El motor
> ya existía y una sola medición bastó. La decisión estaba bien razonada y era **falsa**.

### 🔴 Y la trampa de las fechas: `Día_4` NO es una caja de día

Es **una caja ancha para la fecha entera** (x=63..179) con las tres guías impresas ENCIMA
(`Día` en x=63, `Mes` en x=96, `Año` en x=142) y la pregunta un renglón más arriba. La primera
versión del extractor tomaba la guía como etiqueta y daba:

```
Día_4 -> "Mes"     Día_5 -> "Mes"     Día_6 -> "Mes"
```

Las tres con el mismo nombre y ninguna con el suyo — y no sólo inútil: **le dice al modelo que
escriba un mes donde va la fecha de alta.** Ahora se saltan las guías (`GUIA_DE_FECHA`) y se sube
un renglón. Las 7 cajas de fecha quedan con su pregunta real.

**Y faltaba lo más simple:** el prompt **nunca decía en qué formato va una fecha**. El pre-llenado
determinista escribe `dd/mm/aaaa`; el modelo escribía prosa. Ahora es regla dura, con el caso de
la fecha incompleta ("en marzo") resuelto: se **pregunta**, no se completa.

### La pantalla: mismo patrón que el asistente verde

El chat era un panel flotante que tapaba la hoja. Ahora usa las clases de `AgendaAgentPanel`: en
`lg` es **`static`**, o sea un HERMANO FLEX — la hoja se encoge en vez de quedar tapada — y por
debajo cae a barra lateral fija y a hoja inferior en móvil. Se abre con la **pestaña del borde
derecho**, igual que el asistente. El `abierto` vive en la PÁGINA porque la hoja tiene que saberlo
para soltar el `max-w-4xl`.

### Verificado (harness contra el AXA real)

7/7 cajas de fecha con su pregunta · 49/49 recuadros etiquetados · 22 grupos, 0 con etiquetas u
on-states repetidos · ninguna "pregunta" es una opción de su propio grupo · la etiqueta empata sin
acentos ni mayúsculas · una opción inventada se descarta · el grupo inexistente se descarta.
Prompt: ~5,300 tokens. `type-check` ✅ · 5 gates ✅ · `next build` ✅.

### 🔴🔴 El `/code-review` — el agente podía FIRMAR EL CONSENTIMIENTO DEL PACIENTE

8 hallazgos. El primero es el peor bug que ha tenido esta función, y lo metí yo al derivar las
casillas: **entraron TODAS al catálogo del modelo**, incluidas

```
p6  Autorizo el tratamiento y transferencia de mis datos personales…
p6  Sí acepto  /  Sí acepto_2          ← «Para ser llenado por el Asegurado afectado»
p5  Se ajusta a Tabulador médico       ← declaración de FACTURACIÓN del médico
```

La página 6 de AXA es del **paciente** y está junto a *"Firma del Asegurado"*. El camino
completo: el doctor dice *"el paciente ya autorizó mandar sus datos"* → el modelo devuelve
`{"casillas":{"campo:Sí acepto":"Sí acepto"}}` → el servidor lo acepta (la etiqueta empata) → cae
en ámbar en la p6 → el doctor da **un solo Guardar** para toda la tanda → **el PDF final aplanado
afirma una autorización que el paciente nunca firmó.** Es justo lo que el consentimiento propio
del app existe para no hacer, y `render-pdf.ts` ya señalaba `Se ajusta a Tabulador médico` como
la razón de apagar casillas de fábrica.

⇒ **`casillasParaElAgente()`**: de 22 grupos, el agente ve **13**. Se excluyen tres familias:

| | Por qué |
|---|---|
| consentimientos y facturación (`autoriz`, `acepto`, `tabulador`, `firma`…) | no son del médico, y son las que tienen consecuencia legal |
| grupos de **una sola opción** (`ANP`=`¿Fuma?`, `ANP1`…) | el modelo SÓLO puede marcarla: el doctor dice "no fuma" y la única cadena emitible **marca** la casilla — la hoja afirma lo contrario |
| sin pregunta **y** con opciones genéricas (`Sí_2` = `Sí\|No`) | indistinguible de `Sí_3` («¿Es cáncer?»); el servidor aceptaría el grupo equivocado porque la etiqueta empata |

**Nada desaparece de la hoja:** el visor dibuja desde la geometría, así que el doctor las sigue
marcando a mano. Lo que se quita es que las proponga un modelo.

Los otros siete, todos arreglados:

- **El modelo era CIEGO a las casillas ya marcadas**: `yaLleno` se armaba sólo con los campos de
  texto, así que el prompt decía *"la hoja está vacía"* con casillas puestas — y el agente
  re-proponía "Hospitalización" cada turno. Es el bucle que los `pendientes` existen para evitar.
- **En `lg` el panel se estiraba al alto de la HOJA** (6 páginas, miles de px) porque la fila era
  `min-h-screen`: su `overflow-y-auto` no tenía nada que desbordar y **la caja de escribir
  quedaba al final del documento**. `AgendaAgentPanel` no lo sufre porque su padre es el
  `flex h-screen` de `DashboardLayout`. Ahora la fila es `lg:h-screen` y **scrollea la columna
  izquierda**.
- Una casilla que el modelo mandaba bajo `campos` se reportaba como *"no existe en esta hoja"* —
  falso, el grupo existe. Ahora se resuelve como casilla.
- Las **opciones reales** ya se enseñan cuando se descarta una que no existe (se calculaban y no
  se pintaban).
- `leerPdfBase` corría en **cada** turno aunque la caché fuera a acertar (~1 MB de disco por
  mensaje): ahora la lectura va dentro del camino de fallo, como en `geometriaCacheada`.
- El docblock de `campos-dictables.ts` seguía diciendo que las casillas quedaban fuera "a
  propósito" — el archivo que un lector abre primero.

**Verificado:** 22 grupos → 13 ofrecidos · las 9 peligrosas **bloqueadas** una por una · las 13
permitidas son exactamente las clínicas.

⚠️ **Sigue sin ser el clic:** nadie ha vuelto a hablarle al chat con esto puesto.

## 🔴🔴 EL BUG QUE LO EXPLICA CASI TODO: el modelo se come `campo:` (2026-08-10)

Segunda prueba del usuario: *"las fechas ya funcionan, las casillas siguen sin funcionar, el chat
se ve mucho mejor… aunque todavía no extrae muy bien"*.

**Por fin se hizo lo que no se había hecho nunca: UNA LLAMADA REAL al modelo** (hay
`OPENAI_API_KEY` en `apps/doctor/.env.local`, así que se puede sin desplegar). El modelo acertó
TODO y nosotros lo tirábamos:

```
"casillas": { "S1": "Masculino", "TE": "Hospitalización",
              "Check Box2": "Adquirido", "Sí_3": "Sí", "Sí_4": "Sí", "Sí_5": "No" }
"campos":   { "Día_4": "03/03/2026", … }
```

Las 6 casillas bien y la fecha de cirugía bien. Pero el catálogo dice **`campo:TE`** y el modelo
devuelve **`TE`**: se come el prefijo porque `campo:` se lee como una anotación de espacio de
nombres, no como parte del nombre. Y la validación era `clavesValidas.has(clave)` ⇒
**todo descartado en silencio.**

⚠️ **Sobrevivían sólo las claves CANÓNICAS** (`clinico.diagnostico`), que no llevan prefijo. De
ahí el patrón que se veía desde fuera: *algunas cosas sí y la mayoría no*. Y es la explicación
más probable del viejo veredicto del dictado, *"works in very simple pages"* — las páginas
"simples" son las de campos canónicos; los ~195 campos crudos de AXA nunca aterrizaron.

**Dos arreglos, no uno:**
1. `resolverClave()` en `types.ts` — tolerancia: exacta → con prefijo → sin prefijo. Se aplica en
   el chat (campos y casillas) **y en el dictado**, que tenía el mismo bug desde que shipeó.
2. Regla dura en el prompt: *copia la clave TAL CUAL, incluido `campo:`*.

**Verificado con OTRA llamada real:** el modelo ya devuelve `campo:TE`, y las 6 casillas + los 2
campos resuelven (`TE → /H`, `Check Box2 → /2`, `Sí_5 "No" → /o`, `Día_4 → 03/03/2026`).

> 🔎 **La lección:** todo lo determinista estaba verde —catálogo, geometría, validación, 49/49
> etiquetas— y la función seguía sin servir, porque **nadie había mirado lo que el modelo
> devuelve**. Un contrato con un LLM no se verifica leyendo el prompt: se verifica llamándolo.
> Y se podía llamar desde el primer día.

### Y las otras dos cosas que reportó

- **"Descargar borrador me manda a esta página …/pdf?tipo=borrador"** — la ruta responde con
  `Content-Disposition: attachment`, así que el archivo SÍ se bajaba, pero `window.open` dejaba
  una pestaña nueva en blanco enseñando la URL de la API. Ahora es un ancla `download`: baja sin
  abrir nada.
- **"Las páginas siguen con el dictado viejo (Dictar página 1 · 64 campos)"** — quitado. Lo
  sustituye el chat, que ya trae micrófono y además ve la hoja ENTERA; dictar apuntando a una
  sola página es exactamente lo que 05-VOZ probó y no alcanzó. Se borró `DictadoPagina.tsx` y su
  cableado.
  ⚠️ **El endpoint `/dictar` queda SIN UI que lo llame.** No se borró (sigue documentado en el
  mapa de superficie IA y acaba de recibir el arreglo del prefijo); decidir si se retira.

## 🔴 DÓNDE QUEDAMOS — 2026-08-09, fin de sesión

### ✅ El estado PENDIENTE — COMMITEADO (`a6aa9841`)

Decisiones 1B + 2B de [`06-AGENTE`](06-AGENTE-conversar-con-el-formato.md).
`type-check` ✅ · `next build` ✅ · `pnpm gates` ✅ · **sin push y sin clic.**

Archivos tocados:

| Archivo | Qué cambió |
|---|---|
| `informe/page.tsx` | `pendientes` sustituye a `borradores`; `editarCampo` · `descartarCampo` · `descartarTodo` · `guardarTodo`; barra ámbar pegajosa; aviso `beforeunload` |
| `informe/InformeVisor.tsx` | Sin guardado propio: `onEditar`/`onDescartar`/`pendientes`; borde ámbar punteado y ✕ por caja; las casillas también quedan pendientes |
| `dictar/route.ts` | **Ya NO escribe en la BD**: devuelve `valores` para que el cliente los ponga pendientes |
| `reports/[reportId]/route.ts` | El PATCH acepta `origin` `voice`/`llm` (el cliente es quien guarda); `deterministic` sigue siendo sólo del servidor |

**Qué cambió para el doctor:** teclear, marcar una casilla y dictar ya **no guardan**; todo queda
pendiente hasta el botón **Guardar**. Cada valor pendiente lleva una ✕ para volver a lo guardado, y
hay "descartar todo" para una tanda mala.

> ⚠️ **Esto cambia comportamiento que YA estaba en prod y probado** (el guardado al salir del
> campo). Es lo primero que hay que mirar al volver: ¿se siente bien perder el autoguardado, o pesa
> más el riesgo de perder trabajo?

### ~~Por dónde seguir~~ (esa lista ya se hizo — ver abajo el estado del 2026-08-10)

### Decisiones tomadas hoy que NO se re-litigan

- El informe es un **flujo CONTENIDO** (botón azul), **no** un módulo del asistente (botón verde).
  El privacy tier del asistente **no aplica**: el flujo de nueva consulta por voz ya estructura SOAP
  y diagnósticos en prod.
- **La HOJA es el card**: el agente pone los valores en el formato, no una lista en el chat.
- **1B**: nada se guarda hasta Guardar. Se descartó respaldar en `localStorage` (texto clínico).
- **2B**: se descarta campo por campo.
- Los informes los puede hacer **cualquiera con el permiso `expedientes`**, no sólo el dueño.

### Lo que sigue sin probarse con los ojos

- 🔴 **El CHAT** — recién escrito, nunca se le ha mandado un mensaje.
- El **dictado** (`96ea70ef`) — nunca se le ha hablado.
- El **estado pendiente** — recién escrito.
- **Allianz páginas 2 y 3**.

### ⚠️ Una sospecha que quedó ABIERTA (no se tocó)

`prefill.ts` `fechaMomento()` lee componentes **locales** (`getFullYear`…) para los timestamps.
Eso es correcto en esta máquina (UTC-6) y es lo que se midió en el paso 4 — pero **el servidor de
Railway corre en UTC**, donde "local" es UTC y el arreglo no arregla nada: `consulta.fecha` de una
consulta de las 18:30 volvería a salir **al día siguiente** en prod.

El resto del repo lo resuelve con `timeZone: 'America/Mexico_City'` explícito. **No se cambió**
—está fuera del alcance de esta sesión y toca un campo que la aseguradora cruza contra la fecha
del siniestro— pero hay que **verificar el `TZ` del contenedor** antes de emitir un informe real.

### Bloqueado por el usuario

- ~~**GNP**: ¿cuál formato rige?~~ ✅ RESUELTO 2026-08-15: el OFICIAL, y EN PROD.

## Lo siguiente

**Pasos 0 · 1 · 2 · 4 · 5: ✅** · **Allianz: ✅** · **Borrador: ✅** · **Motor: ✅ EN PROD**

- 🔴 **Volver a probar las CASILLAS**: elegir una opción que NO sea la primera de su grupo,
  descargar el PDF y confirmar que la marca cae donde se tocó.
- 🔴 **Abrir el VISOR y ver si las cajas caen en su raya.** La geometría cuadra en números
  (60/60, nada fuera de la hoja), pero que los números cuadren no es que se vea bien al 130% en un
  navegador. Es lo único que no se puede verificar desde aquí.
- 🔴 **Un informe COMPLETO de punta a punta**: corregir un campo, bajar el borrador, dar
  consentimiento, bajar el final y **mirar el PDF** (¿sale el encabezado con `Lugar` y fecha?).
- **Las casillas** de AXA (45) — hoy el visor las ubica pero no las dibuja.
- **El chat con el LLM** que pidió el usuario: propone valores, caen en el mismo JSON y se prenden
  en ÁMBAR sobre la hoja para que el doctor confirme. Es el paso 6, y encaja sin rediseñar nada.
- **Paso 3** — el diccionario de GNP (`P1_7`, cero semántica). ⚠️ Antes hay que resolver la
  pregunta abierta #0: **cuál formato de GNP rige**, el de Eleonor (3 pág) o el oficial (2 pág).
- **Paso 6** (LLM sobre `customData`) y **paso 7** (link con token al paciente).

⚠️ Sólo se vieron **3** formatos, y son los 3 con los que arranca v1 por decisión del usuario.

### Los scripts de la medición

Viven en el scratchpad de la sesión (no en el repo): `inspect-pdf.mjs` (páginas, rotación, texto,
anotaciones), `fields.mjs` (nombres, tipos y `rect` de cada campo), `perms.mjs` (cifrado, XFA,
permisos, productor). Usan el `pdfjs-dist` **que ya está instalado** en `node_modules`. Si hacen
falta otra vez, se reescriben en 5 minutos.

## Preguntas abiertas para el usuario

| # | Pregunta | Dónde |
|---|---|---|
| ~~0~~ | ~~**GNP: ¿cuál formato rige?**~~ ✅ **RESUELTO 2026-08-15: el OFICIAL, y EN PROD** | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §3 |
| ~~0b~~ | ~~¿Qué empresa dio estos PDFs?~~ **RESUELTO: Eleonor (`eleonor.mx`)**, de una cuenta de doctor real | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §0 |
| 1 | ¿Cuántas aseguradoras/formatos son en total? v1 arranca con 3 por decisión del usuario | [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §0 |
| 2 | ¿Quién da de alta un formato — admin de la plataforma o cada doctor? | [`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §4 |
| 3 | Consentimiento: ¿casilla del doctor o firma del paciente? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §7 |
| 4 | ¿Un informe puede juntar VARIAS consultas? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §8 |
| 5 | ¿Los adjuntos (estudios de `PatientMedia`) van con el informe? | [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §8 |

## Trampas anotadas antes de pisarlas

- **`pdf-lib` es dependencia nueva** ⇒ regenerar `pnpm-lock.yaml` en el MISMO commit o Railway
  falla el build con frozen lockfile y el push no shipea.
- **`grep` sobre un PDF miente** con object streams (ver arriba). Usar un parser.
- **Acentos.** Los formatos son en español (`Diagnóstico`, `Programación`). Es el bug clásico de
  pdf-lib con caracteres fuera de WinAnsi — hay que verificarlo en el paso 2, con los ojos.
- **Aplanar antes de entregar** (`flatten()`), o el informe firmado llega editable. Los tres
  formatos advierten en su propio texto que no aceptan tachaduras ni enmendaduras.
- **AXA trae tablas repetidas** (`DiagnósticoRow1..RowN`): el modelo de respuestas necesita listas,
  no sólo pares campo→valor.
- **~16–18 campos por formato vienen sin tipo** (`type: ""`) — probablemente botones o firmas. No
  asumir que son texto.
- **No hay CIE-10 en el expediente.** `assessment` es texto libre. Si un formato pide clave, se
  teclea — no se le pide al LLM que la deduzca.
- **`gmail.ts` no sabe adjuntar** (`multipart/alternative`, sólo HTML). Irrelevante para v1 porque
  al paciente se le manda un link con token, no un adjunto.
- **`prisma db push` revierte** cosas que viven en prod ⇒ las tablas nuevas van por SQL manual +
  `prisma db execute`.

## 🔴 NO SE PODÍA BAJAR NINGÚN PDF — y la causa fue mi arreglo de las fechas (2026-08-10)

Reporte del usuario: *"still cannot download the PDFs, none of both"*. Reproducido en 30 segundos
llamando al renderer con las respuestas que produce el chat:

```
🔴 TRUENA: Attempted to set text with length=10 for TextField
           with maxLength=8 and name=Día_4
```

**Las 7 cajas de fecha de AXA declaran `maxLength = 8`** — porque quieren `ddmmaaaa`, sin
separadores; el campo se llama literalmente así. La regla que metí ayer ("las fechas SIEMPRE como
`dd/mm/aaaa`") escribe 10 caracteres, `setText` **lanza**, y con eso se cae la generación del
documento COMPLETO: ni borrador ni final.

⚠️ **Se rompió justo cuando las fechas empezaron a funcionar.** Ninguna de esas 7 cajas está en el
diccionario determinista, así que el pre-llenado nunca las tocaba: hasta que el chat acertó una
fecha, el PDF salía bien.

> 🔎 **Y corrijo lo que dije antes:** diagnostiqué que *"el archivo sí se bajaba y `window.open`
> sólo dejaba una pestaña en blanco"*. **Falso.** Esa pestaña estaba enseñando el **500**. Cambiar
> a un ancla `download` no arregló nada — sólo volvió el fallo SILENCIOSO, que es peor. El
> síntoma que el usuario describía era el error, y lo leí como cosmético.

### Tres arreglos, y el importante es el tercero

1. **`maxLength` entra al catálogo** (`geometria-formato.ts` → `campos-dictables.ts`):
   `maxCaracteres = min(visual, maxLength)`. Antes se le anunciaban ~38 caracteres a una caja que
   acepta 8.
2. **Regla en el prompt:** si el campo admite 8 o menos, la fecha va sin barras (`03032026`).
3. 🔴 **UN CAMPO NO PUEDE TUMBAR EL DOCUMENTO.** En `render-pdf.ts`:
   - una fecha `dd/mm/aaaa` que no cabe se normaliza a `ddmmaaaa` (no pierde nada: es lo que la
     hoja pide);
   - lo que sigue sin caber se **omite y se reporta** — nunca se recorta a ciegas, porque media
     fecha en un documento médico-legal es una afirmación falsa;
   - y `setText` va dentro de un `try/catch` (`rechazado-por-el-pdf`). Es la misma regla que ya
     regía para WinAnsi, que existía **precisamente** porque un campo malo tiraba el informe
     entero — y aun así volvió a pasar por otra puerta.

**Verificado leyendo el PDF de vuelta:** se manda `03/03/2026` y el campo queda en **`03032026`**;
`TE`=/H, `Check Box2`=/2, `Sí_5`=/o; el final aplana a **0 campos vivos**; y un texto que de verdad
no cabe (18 caracteres en una caja de 8) **deja generar el PDF igual** y sale reportado.

## ❓ ¿Y las plantillas propias del doctor (no SOAP)?

Pregunta del usuario. La respuesta tiene dos partes porque `ClinicalEncounter` es **híbrido**:

| De dónde sale | ¿Llega al informe? | Color |
|---|---|---|
| Columnas FIJAS (fecha, motivo, los 7 signos vitales, SOAP) | ✅ pre-llenado automático | 🟩 **verde** (`deterministic`) |
| `customData` de una plantilla propia | ✅ **sólo por el CHAT** | 🟧 **ámbar** (`llm`) |

- El **pre-llenado determinista NO lee `customData`** (decisión de `04-MAPEO`: no escala y la
  plantilla no contiene lo que pide la aseguradora). Por eso nada de una plantilla propia sale
  verde.
- Pero el **chat SÍ lo recibe**: `contexto-clinico.ts` le pasa la consulta ligada al informe con
  `customData` **traducido a las etiquetas de su plantilla** (`labelEs`/`label`), así que el
  modelo lee *"Tipo de Lesión: nevo displásico"*, no *"tipoLesion: nevo"*.
- ⇒ Con una plantilla propia el doctor **tiene que conversar** para que ese contenido aterrice, y
  aterriza en ámbar, que es lo correcto: lo interpretó un modelo, no lo copió el sistema.

---

# 🔴 DÓNDE QUEDAMOS — 2026-08-14: la SEGUNDA aseguradora

> **Empieza por aquí.** Todo lo de abajo es historial.

**AXA funciona bien** (veredicto del usuario) ⇒ se abrió el trabajo de las demás aseguradoras.
Decidido con el usuario: **Allianz + GNP**, el usuario provee los PDFs, y **primero la
herramienta**. Procedimiento completo en [`08-ALTA`](08-ALTA-de-un-formato-nuevo.md).

## ✅ La herramienta de alta — `scripts/alta-formato.ts`

`inspeccionar` · `campos` (para un PDF plano) · `sql` (genera el INSERT desde el diccionario).
Reusa lo que ya existía (`geometriaDelFormato`, `etiquetasDeLaHoja`, `casillasParaElAgente`,
`capacidadDeCaja`, `caracteresNoImprimibles`, `agregarCamposAFormatoPlano`) — no reimplementa nada.

**Validada contra AXA, que es el oráculo**: reproduce 277 campos (255 texto · 22 casilla),
22 grupos → **13 que el asistente ve / 9 bloqueados**, las **7** cajas `maxLength=8`, y las **9**
casillas marcadas de fábrica con los mismos nombres y on-states que este doc registró en su día.
La propuesta de diccionario acertó **13 de los 20** escalares hechos a mano, se declaró ambigua en
4, se calló 1 y discrepó en 1 con aviso.

⚠️ **Y esa frase, tal como la escribí primero —"0 elecciones equivocadas en silencio"— era FALSA.**
Valía para AXA y no para Allianz: ahí el emparejador propuso `paciente.rfc → p2_RFC`, que está en
el bloque del MÉDICO, **con empate exacto y sin ninguna marca**. Lo cazó el `/code-review` con dos
hermanos más (`telefono`, `email`, `domicilio`) y un cuarto por otra puerta
(`informe.fecha → fecha de la CIRUGÍA`, porque el largo mínimo sólo cubría `includes` y no
`startsWith`). Todos corregidos — detalle en [`08-ALTA`](08-ALTA-de-un-formato-nuevo.md) §8.

🔎 **La lección:** ser conservador con la FUERZA del empate no sirve si el término no distingue
**de quién** es el dato. Y una propiedad medida sobre UN formato no es una propiedad de la
herramienta.

`type-check` ✅ · los **5 gates** ✅. **Sin commit y sin push.**

⚠️ Los `scripts/*.ts` SÍ entran al `type-check` (`include: **/*.ts`) — de hecho ahí salió un error
real (`OPS.paintJpegXObject` no existe en pdfjs 5.x).

## 🔴 Los DOS bugs que encontró el propio AXA, en mi script

Los dos son de método y valen más que el script:

1. **`PDFDocument.load()` reescribe `/Producer` a `pdf-lib` y `/ModDate` a AHORA.** Sin
   `updateMetadata: false`, la herramienta acusaba de "no es el PDF de la aseguradora" a **todos**
   los formatos — incluido el oficial. Dije eso del Allianz oficial y era **falso**: leído bien es
   `Adobe PDF library 15.00 · 2023-02-27`, exactamente el oficial. Una herramienta que modifica lo
   que mide no da un dato, da un artefacto — y éste tenía la forma del hallazgo que buscábamos.
2. **`isChecked()` de pdf-lib encuentra 4 de las 9 casillas marcadas de fábrica.** Compara el `/V`
   contra el on-state del PRIMER recuadro, así que un grupo cuyo valor de fábrica es la segunda
   opción (`S1 = /N`, Femenino) se reporta como no marcado. Es la misma familia del viejo `check()`
   que marcaba la primera opción sin importar cuál eligió el doctor. Se lee el `/V` directo.

## 🟡 ALLIANZ — construido, sin desplegar y SIN MIRAR

El PDF bueno se bajó **del portal de documentos de Allianz** (la primera copia estaba corrupta,
abajo). Tras deduplicar las rayas encimadas: **57 reglas → 52 campos de texto** (5 sin etiqueta,
0 fallidos) **+ 14 grupos de casillas con 33 recuadros**.

Quedó: el PDF con campos en `public/formatos/`, `dicts/allianz.ts` con **13** entradas verificadas
a mano, la entrada en `FORMATOS` (`camposPropios: true`) y `seed-formato-allianz.sql` **generado y
NO aplicado a prod**. Probado con el motor real: 13 escritos · 0 problemas · 0 ilegibles · 0 campos
vivos tras `flatten` · acentos intactos. `type-check` ✅ · 5 gates ✅.

🔴 **Nadie ha visto la hoja.** Las 56 posiciones las dedujo el algoritmo. Hay dos PDFs de prueba en
`Downloads/allianz-PRUEBA-final.pdf` y `-borrador.pdf` — **eso es lo que hay que abrir**. Y siguen
sin mirarse las **páginas 2 y 3**, pendientes desde el 08-08.

### 🔴 En un formato plano, la mayoría de los huecos NO tienen raya

Lo descubrió el usuario usando la app: no podía escribir **ninguna fecha**, ni los importes de la
p3. La premisa del extractor era "donde se escribe hay una raya", y en Allianz es falsa:

| Familia | Se detecta por | En Allianz |
|---|---|---|
| **Fechas** | la corrida de guías `DD MM AAAA` | **18** |
| **Importes** | la etiqueta que acaba en `$` | **3** (Cirujano · Ayudante · Anestesista) |
| **Opciones** | el glifo `□` | **33** en 14 grupos |

Toda la rejilla de antecedentes patológicos pide una fecha por renglón y en esa zona hay **2**
rayas: las celdas están dibujadas como tabla. Allianz pasa de 66 a **87 campos** (73 texto + 14
grupos).

🔎 **La lección:** "no se detectó ninguna raya" y "aquí no se escribe" no son lo mismo. Un formato
plano se valida contando los huecos **contra lo que la hoja pregunta**, no contra lo que encontró
el extractor — y eso, hasta ahora, sólo lo ve alguien abriendo la hoja.

### ✅ Las CASILLAS de Allianz — deducidas de los `□` impresos

Se había anotado como limitación ("un formato plano no puede tener casillas"). **Falso**, igual que
cuando se dijo de AXA: las opciones son el glifo `□` (U+25A1) de la capa de texto, **33** en la
hoja, con su etiqueta a la derecha. Se fabrican con **la misma forma que AXA** —un campo, N
recuadros, cada uno con SU on-state— así que geometría, etiquetas, render y el catálogo del agente
funcionan **sin tocar una línea**. Resultado: **14 grupos, 33/33 recuadros**.

Verificado eligiendo la **4ª de 4**, la 2ª de 2 y la 2ª de 3: se marca **una sola** y la correcta
(`/V=/Accidente`, `/AS=[/Off /Off /Off /Accidente]`). Es el bug de AXA evitado por construcción.

🔴 Dos grupos quedaron **fuera del alcance del agente** (hubo que ampliar la regex):
`Tiene convenio con la aseguradora` y `…informe complementario … a la Compañía de Seguros`. Son
declaraciones administrativas, no hechos clínicos. **AXA sigue en 13 de 22, sin cambio.**

⚠️ Tres trampas nuevas anotadas en `08-ALTA` §7: el corte de grupos **no es por renglón** (una fila
trae `Si|No` **y** `Parcial|Total`, y unirlos haría que marcar «Parcial» desmarcara «Si»); pdf-lib
crea todos los recuadros con el mismo on-state y hay que renombrarlos; y la casilla y el campo de
texto de un mismo renglón salen con el **mismo nombre**, lo que reventaba `createCheckBox` y un
`catch` mudo se lo comía (29 de 33 sin explicación).

⚠️ **Seis conceptos SIN mapear a propósito** (razón escrita en `dicts/allianz.ts`), uno de ellos
por TAMAÑO: `clinico.exploracionFisica` cabía en **110 caracteres** a 6 pt, así que se habría
marcado ilegible en casi todos los informes. Un mapeo que siempre avisa no es un mapeo.
`clinico.diagnostico` y `clinico.tratamiento` (no se sabe, sin ver la hoja, si Allianz pregunta por
el tratamiento dado o el propuesto — en AXA equivocarse ahí habría dicho algo falso), `informe.fecha`
(el candidato era la fecha de la CIRUGÍA), el hospital, y **`paciente.rfc`**: la propuesta lo empató
EXACTO con `p2_RFC`, que está en el bloque del **médico**. Habría impreso el RFC del paciente en la
casilla del doctor. Se corrigió el sinónimo para que no vuelva a pasar.

## 🔴 Y por qué la PRIMERA copia no servía: estaba CORRUPTA

Abre perfecto —3 páginas, 612×794, rot 0, sin cifrar, metadatos correctos de 2023— y `pdf-lib` no
protesta. Pero sus streams de contenido tienen cabecera zlib inválida:

```
Warning: Indexing all PDF objects                                  ← xref roto
Warning: Invalid stream: "Bad FCHECK in flate stream: 72, 239"     ← ×6
⇒ 0 operadores y 0 items de texto en las 3 páginas
```

⇒ **Hace falta volver a bajarlo.** Nada podía funcionar con este archivo: sin texto no hay reglas,
sin reglas no hay campos, y el visor pintaría hojas en blanco.

🔴 **Y el síntoma engañaba:** se ve como **"0 reglas detectadas"**, que se lee como *este formato no
se puede automatizar* — y manda a escribir un extractor nuevo en vez de a volver a bajar el PDF.
Ahora `revisarLegibilidad()` lo distingue de un escaneo de verdad y lo dice con esas palabras.

⚠️ **Los warnings de pdf.js estaban impresos desde la primera corrida y yo los filtraba** con
`grep -v Warning`, porque el `standardFontDataUrl` es ruido. El diagnóstico estuvo en pantalla todo
el tiempo, tapado a propósito.

## ✅ Lo que el usuario YA revisó (2026-08-14)

Abrió el mapa de campos y **la colocación es correcta** en las tres páginas. De paso su lectura
destapó **4 pares de campos ENCIMADOS** (`Especifique`, `CAUSA`, `Antecedentes_Heredo-Familiares`,
`Indique_motivo_de_hospitalizacion`): la misma raya detectada dos veces. La deduplicación existía
pero comparaba ESQUINAS (`|Δy|<=2 && |Δx|<=3`) y se le colaban; ahora compara **traslape** y quedan
57 reglas → **52 campos**, 0 encimados.

🔎 Todos los números decían que estaba bien —61 reglas, 56 campos, 0 fallidos— y el defecto sólo se
veía mirando la hoja.

⚠️ Y los nombres feos que reportó (`AAAA`, `y_cantidad`, `CAUSA`) **no eran errores de posición**:
son rayas cuya etiqueta se tomó del encabezado de columna.

🔴 **Se intentó "arreglarlos" con geometría y salió PEOR — revertido.** La idea era declararlos
opacos (quitando el prefijo `pN_` en `esOpaco`) para que el modelo recibiera la pregunta impresa.
Medido sobre la hoja real, el contexto derivado decía:

| campo | rótulo que se le habría dado al modelo |
|---|---|
| `vitales.tensionArterial` (`p2_TA`) | **"Mts."** ← la unidad de la caja de Talla de al lado |
| `campo:p1_AAAA` | **"Hipertensivos"** |

Y el contexto **PISA la etiqueta canónica**, así que el campo de la TENSIÓN ARTERIAL se habría
presentado como "Mts." — invitando a escribir una estatura ahí. Lo cazó el `/code-review`.

🔎 **La lección:** un nombre poco informativo se ignora; un rótulo FALSO se obedece. Un nombre feo
se corrige mirando la hoja y escribiéndolo en el diccionario, no adivinándolo con geometría.

## 🔴 El asistente NO entendía la hoja de Allianz — 61 de 73 campos (2026-08-14)

Pregunta del usuario: *"¿está todo bien mapeado para que el agente lo entienda?"*. Se midió, y la
respuesta era **NO**.

En AXA los nombres los puso la aseguradora (`Apellido paterno`). En Allianz los inventamos nosotros
del texto vecino, así que al modelo le llegaba `campo:p1_AAAA`, `campo:p1_y_cantidad`,
`campo:p1_CAUSA` como única pista — **61 de 73 campos de texto**. Es la MISMA causa por la que las
fechas de AXA no aterrizaban (`06-AGENTE` §12).

⇒ `FormatoEnRepo.etiquetas` (`nombre → lo que dice la hoja`), generado por `alta-formato campos` y
guardado en `dicts/allianz.ts`. **61 ilegibles → 7.** Ejemplos:

```
campo:p1_Cual         → "Referido por otro médico o unidad: — ¿Cuál?"
campo:p3_Importe_...  → "Importe — Cirujano"
```

Es texto IMPRESO, no interpretación: el mismo del que salió el nombre, con acentos, y con la
pregunta del renglón antepuesta cuando la etiqueta sola no dice nada. Los campos con concepto
canónico no se pisan.

⚠️ **El mapa se indexa por CLAVE (`campo:p1_AAAA`), no por nombre.** Indexarlo por nombre —que es
como se escribe— habría sido un **no-op silencioso**: el modelo seguiría viendo el nombre crudo y
todos los contadores en verde. Se cazó antes de shipear porque se midió el catálogo, no el código.

🔴 **Quedan 7 que ni con su renglón se entienden** (`p1_Especifique`, `p1_AAAA`,
`p1_y_cantidad_2`, `p1_padecimiento`, `p1_CAUSA`, `p2_Cual`, `p2_car_procedimiento`): hay que
MIRAR la hoja impresa y corregirlos a mano en `ETIQUETAS_ALLIANZ`.

🔴 **Y el `/code-review` encontró que DOS de las "resueltas" eran FALSAS** — se shipearon así.
`p1_AAAA` decía *"Diabetes Mellitus — AAAA"* y el hueco está en la mitad de *Hipertensivos* del
mismo renglón: le habría dicho al modelo que escribiera el año de la diabetes en el blanco de la
hipertensión. La causa: se anteponía el texto **más a la izquierda** del renglón, sin ver que un
renglón con DOS preguntas es una rejilla de columnas. Ahora sólo se antepone si hay UNA.

🔎 **Es la tercera vez hoy con la misma forma**, y ya con nombre propio: un rótulo pobre se ignora,
uno FALSO se obedece. Pasó con `Mts.`, con `p2_RFC` en el bloque del médico, y ahora con esto —
las tres veces intentando ser útil derivando algo de la geometría.

## Lo siguiente

1. 🔴 **ABRIR `Downloads/allianz-DEMO-todo-lleno.pdf`**: los 52 campos llenos y los 14 grupos
   marcados, por el motor real. Es la hoja como la recibiría la aseguradora.
2. 🔴 Decidir los 6 conceptos sin mapear mirando la hoja (arriba).
3. Aplicar `seed-formato-allianz.sql` a prod (`prisma db execute`, jamás `db push`) y desplegar.
   ⚠️ Hasta que esa fila exista, el dropdown NO ofrece Allianz: `formatoDe()` empata contra la BD.
4. 🔴 **GNP sigue bloqueado en el usuario**: ¿el de Eleonor (3 págs) o el oficial (2 págs)?
3. Lo de 08-11 que sigue sin probarse con el dedo: el paso 07 **nunca ha renderizado en un
   navegador**.

---

# 🔴 DÓNDE QUEDAMOS DE VERDAD — 2026-08-11, fin de sesión

> Lo de abajo (sección del 2026-08-10) es el historial; esto era el estado al cerrar el 08-11.

## ✅ CERRADO MÁS TARDE ESE MISMO DÍA (2026-08-11, tarde)

**El usuario probó los puntos 1 y 2 de la lista de abajo y dijo que los DOS están bien.** O sea:
el botón de autollenado con fuentes marcadas ✅, y los dos ⏳ que venían del 2026-08-10 (marcar una
casilla que no es la primera de su grupo · bajar borrador y final) ✅. Lo de abajo se conserva como
bitácora; ya no es la lista de pendientes.

🔴 **Sigue bloqueado en el usuario: GNP** — ¿el formato de Eleonor (3 págs) o el oficial (2 págs)?

### Y el chat del informe cambió de aspecto (`9670b7ea`, `1d6b3a42`)

`ChatInforme.tsx` entró en una unificación de los CUATRO chats del producto: el panel de agenda
quedó de plantilla y éste se alineó (encabezado, burbujas con avatar, caja de texto). Conserva el
azul como acento. Detalle en [`../SESION-2026-08-11-UI.md`](../SESION-2026-08-11-UI.md) §2.

Dos arreglos que le tocan directo, **ninguno visto en un navegador**:

- 🔴 **El cursor no volvía a la caja** después de mandar (lo reportó el usuario aquí; estaba en los
  cuatro chats). El arreglo tiene dos guardas, y la segunda existe porque **el primer intento
  reintrodujo el bug**: `turnoEncolado` se quedaba pegado si apretabas autollenado sin haber
  tecleado nunca, y entonces el siguiente mensaje escrito se comía el arreglo. Lo cazó el code
  review. La otra guarda evita robarte el cursor si estabas **corrigiendo una casilla de la hoja**
  mientras el asistente pensaba.
- **`z-[60]`**: con `z-[55]`, `GoogleCalendarBanner` tapaba el encabezado del panel entre `sm` y
  `lg` — la X y Limpiar no se podían apretar. **Ese defecto ya estaba en prod aquí.**

---

## ⏱️ LO PRIMERO, EN 30 SEGUNDOS *(escrito en la mañana del 2026-08-11 — ver el bloque de arriba)*

**Todo lo del 2026-08-11 está EN PROD y desplegado** (8 commits, último `0f17a76b`, deploy
SUCCESS). **No hay trabajo a medias ni nada sin commitear.**

**Lo único que falta es MIRARLO.** Nadie ha usado esta funcionalidad con el dedo. En orden:

1. 🔴 **Paciente → Informe → elegir ancla → marcar una receta → botón "Llenar la hoja con lo
   que marqué".** Es la primera prueba real del botón y del arreglo del prompt juntos.
   - Si **pregunta en vez de llenar** ⇒ el arreglo del prompt no aguanta con el payload real
     (medido 4→13 campos con llamadas reales, pero **una corrida por condición**).
   - Si **el botón no hace nada** ⇒ el disparo. Ya se le arreglaron 2 bugs LEYENDO, ninguno
     clicando.
   - Si **aparece una fecha que nadie escribió** ⇒ la regla anti-invención. Su sesgo por
     defecto es poner la fecha de la CONSULTA como fecha de diagnóstico.
2. 🔴 **Los DOS ⏳ que vienen del 2026-08-10 y siguen sin confirmar**: marcar una casilla que
   **NO** sea la primera de su grupo, y **bajar borrador + final**. Son de antes de todo lo de
   hoy (`697d6ce6`).
3. **Bloqueado en el usuario: GNP** — ¿el formato de Eleonor (3 págs) o el oficial (2 págs)?
   Nada avanza en esa aseguradora sin esa respuesta.

⚠️ **Los dos bugs REALES de hoy los encontró el usuario mirando la pantalla**, no los gates ni
tres rondas de code review: contar 3 recetas contra 2 en el ledger, y pegar un chat donde el
agente pedía lo que ya tenía. Lo que él vea mañana vale más que lo que se pueda verificar desde
aquí.

## 🔴 LO QUE APRENDIMOS MIRANDO LA PANTALLA (lo más útil del día)

El usuario abrió el informe y reportó tres cosas. Las tres eran ciertas y ninguna era
lo que parecía:

| Lo que dijo | Lo que era |
|---|---|
| *"usé la consulta del 20 de agosto y el formato dice 10 de agosto"* | **No hubo cambio de fecha.** La caja `Fecha:` de la p1 de AXA es la fecha DEL DOCUMENTO (va junto a `Lugar:`). Y **la fecha de la consulta NO TIENE CAJA en AXA**: `consulta.fecha` no está en el diccionario, así que se calcula, se guarda, se enseña en "Lista de campos" y se descarta al generar bajo `sin-campo-en-el-formato`. AXA pide fecha de padecimiento / diagnóstico / cirugía, nunca "de la consulta" |
| *"marqué todas las casillas y no pasó nada en el formato"* | **Correcto, y era el diseño**: marcar sólo se lo da al asistente; lo que aterriza llega al CONVERSAR, en ámbar. Pero **eso no estaba escrito por ningún lado**, así que era indistinguible de estar roto |
| *"no es claro si se está usando o no"* | No había forma de saberlo. Suya fue la idea del arreglo: **que el chat diga lo que está leyendo** |

Arreglado en `d685b8ce`: el chat declara su lectura (encabezado FIJO, fuera del scroll),
el informe abierto enseña su ancla, y el panel dice de entrada que marcar no llena la hoja.

🔎 **Lección de método:** una funcionalidad que no dice lo que hace se reporta como rota,
y con razón. Cuatro hallazgos del review de ese commit fueron TODOS "la UI afirma algo
que no siempre es cierto" — huérfanas listadas como leídas, un ancla vacía anunciada
como leída, el recuadro que se iba con el scroll, y un "el asistente la lee" cuando no
había asistente. Escribir el mensaje tranquilizador es la parte fácil; comprobar que es
verdad **en todos los estados** es el trabajo.

## 🔴 Y el segundo reporte del usuario: "le pedí llenar y me hizo preguntas"

Pegó la conversación: el chat mostraba *"Estoy leyendo: 📗 Consulta del 20/8/2024 · 📎
Receta · 📎 Receta"*, él escribió **"llena el formulario"**, y el asistente le preguntó
por el CIE-10 del LES **teniendo el diagnóstico en las recetas marcadas**.

**El modelo obedecía.** La lista de tareas del prompt decía, en ese orden: *1) di qué
falta · 2) PREGUNTA · 3) coloca lo que haya **en su mensaje***. Colocar estaba acotado al
MENSAJE; el expediente iba como lectura de fondo, sin ninguna instrucción de extraer de
él. Con un mensaje sin contenido clínico, hizo exactamente lo pedido.

Arreglado en `84a49f79`: extraer va PRIMERO, el mensaje después, preguntar al final.
**Medido con llamadas reales: 4 campos → 13**, mismo mensaje y mismas fuentes.

Y un **BOTÓN** — *"Llenar la hoja con lo que marqué"* — junto a las casillas: marcar no
llena nada, y el único disparador era escribirle un mensaje (había que adivinar que hacía
falta, y qué escribir).

⚠️ **Dos trampas que dejó ese arreglo, las dos ya cerradas y las dos vale la pena recordar:**
1. La primera versión decía *"devolver `campos: {}` es un turno FALLIDO"* — y eso
   **contradecía** la regla de formato de más abajo y, con la hoja ya llena por el
   pre-llenado, dejaba al modelo entre *vacío = fallo* y *repetir = prohibido*. La única
   salida es INVENTAR.
2. Probándolo salió exactamente eso: escribió `Fecha de diagnóstico = 20082024`, **la
   fecha de la consulta**, cuando el expediente dice "diagnosticado en 2019". Regla nueva:
   la fecha de un documento NO es la fecha de lo que cuenta.

🔎 **Lección:** entregarle contexto a un modelo no es pedirle que lo use — y cuando lo
empujas a llenar, el empujón mismo se vuelve presión para inventar. Las dos cosas sólo se
ven **llamando al modelo de verdad**; ningún gate las alcanza.

## El paso 07 está EN PROD y NADIE lo ha tocado con el dedo

Los CUATRO commits del día, todos con deploy **SUCCESS**:

| commit | qué |
|---|---|
| `64dad1a0` | el informe a nivel PACIENTE con fuentes elegidas (plan 07) |
| `b2bc3a68` | recetas vencidas etiquetadas + el bug de un día en lo que lee el ASISTENTE |
| `f5af288a` | el bug de un día en lo que se IMPRIME en el PDF (`informe.fecha` estampaba MAÑANA cada tarde) |
| `d685b8ce` | el flujo dice lo que hace (ver la sección de arriba) |
| `84a49f79` | **el BOTÓN que dispara el llenado + el prompt que se negaba a usar las fuentes** |
| `71a1ef4e` | docs: estas notas y las dos lecciones del prompt |
| `0f17a76b` | plegables: fuentes por tipo, e informes del paciente a los 2 más recientes |

La columna `sources` se aplicó a prod **antes** del push (sin ella, `findFirst` sobre
`medical_reports` da 42703 y tumba TODO el informe, no sólo lo nuevo). Rutas comprobadas vivas:
`/fuentes`, `/reports` y la pantalla nueva
`/dashboard/medical-records/patients/[id]/informe` contestan 307, no 404.

🔴 **Lo primero que hay que hacer es ABRIRLO:** paciente → Informe → elegir ancla → marcar una
nota → conversar. Nunca ha renderizado en un navegador.

Y siguen pendientes los **DOS ⏳ de la sesión anterior**, que ahora también se alcanzan desde la
puerta nueva: **marcar una casilla que NO sea la primera de su grupo** y **bajar borrador + final**.

## Lo que se midió (y lo que NO)

Llamada real a gpt-4o con el prompt real: sin fuentes coloca **2** campos, con fuentes **6**,
ninguno perdido, 0 descartados, +224 tokens. `cached_tokens: 6528` ⇒ el prefijo estable se cachea
de verdad. **Una sola corrida por condición**: es dirección, no medición.

⚠️ El modelo **dedujo** la fecha de diagnóstico de la fecha de la consulta, que el expediente no
decía. Ámbar lo cubre, pero las fuentes lo vuelven más dispuesto a rellenar fechas.

## El bug más caro que encontró el review (7 hallazgos)

Una fuente que desaparece del expediente después de elegirla —nota borrada, receta de vuelta a
borrador— **dejaba el informe atorado para siempre**: el id fantasma seguía en `sources`, viajaba
en cada `PATCH`, el servidor lo rechazaba con 409, y el panel no tenía casilla que desmarcar. No
se podía ni quitar OTRA fuente. Arreglado (se descarta + se reporta + huérfanas en rojo) y
**probado ejecutándose contra datos reales de prod**, no leyendo el código.

## Cerrado hoy: el BUG DE UN DÍA en las fechas

- ✅ **`prefill.ts` — CERRADO el 2026-08-11.** Esto era lo que sigue abajo, y ya está arreglado:
  ahora usa `fechas-de-fuente.ts` como todo lo demás. `consulta.fecha` va por la regla de clase
  (medianoche UTC ⇒ día; si no ⇒ instante en México) y **`informe.fecha` / `informe.lugarYFecha`
  van SIEMPRE en hora de México**, que es lo que estaba roto en prod todas las tardes.
  ⚠️ Los informes YA GUARDADOS no cambian: `answers` se escribió una vez y el pre-llenado sólo
  corre al crear. Un informe emitido ayer a las 20:00 conserva la fecha de mañana que se le puso.

  <details><summary>El diagnóstico original, para que no se re-litigue</summary>

  Usaba componentes **locales del servidor** (`getFullYear/Month/Date`).
  En el servicio `@healthcare/doctor` **`TZ` no está seteada**, así que en prod "local" = **UTC**.
  Y las columnas de fecha clínica se escriben con `new Date("YYYY-MM-DD")` ⇒ **medianoche UTC**
  (medido: `encounter_date` 193/199, `prescription_date` 41/41, `expires_at` 8/8).
  - ⇒ **`consulta.fecha` sale BIEN en prod hoy** (UTC de una medianoche UTC = el día correcto).
    Pero es **frágil**: basta con que alguien ponga `TZ=America/Mexico_City` para que TODAS las
    fechas del informe corran un día. Y **en local (máquina en México) YA sale mal**, así que dev
    y prod no coinciden.
  - 🔴 **`hoy` (línea ~302, la fecha de emisión) SÍ está mal**: es un instante real, y con el
    contenedor en UTC, entre las **18:00 y las 24:00 hora de México** estampa **MAÑANA**.
  - La regla correcta ya existe: **`lib/informe-medico/fechas-de-fuente.ts`**, un módulo PURO
    (sin Prisma) que importan el servidor y los componentes de cliente. Decide la zona por la
    **clase de la columna Y por el valor**: una fecha a medianoche UTC exacta es un día de
    calendario y se lee en **UTC**; cualquier otra es un instante y se lee en **México**. Lo
    segundo hace falta porque **6 de las 199 `encounter_date` traen hora de verdad** y leerlas en
    UTC las corría un día HACIA ADELANTE.
  </details>

## Sigue abierto (heredado, NO se tocó hoy)

- 🔴 **`informe.fecha` dice "Fecha de emisión" y NO es la de emisión.** Se calcula UNA vez, al
  CREAR el informe, y se congela en `answers`; la emisión real se escribe mucho después y en otro
  lado (`issuedAt = new Date()` al hacer `PATCH status: 'issued'`). Un borrador creado el 1 de
  agosto y emitido el 20 imprime **01/08** en el campo que la aseguradora cruza contra el
  siniestro. Hoy se le arregló un error de UN DÍA (la zona) a un campo que puede traer uno de
  SEMANAS. Hay que decidir: **recalcularlo al emitir** —cuidando no pisar una corrección manual
  del doctor, que sería `origin: 'manual'`— **o renombrarlo a "fecha de elaboración"**.
  (Lo encontró el code review del 2026-08-11.)

  📌 **DIFERIDO por el usuario (2026-08-11): se queda como está por ahora.** Y el dato que hacía
  falta para decidir, ya medido sobre el PDF oficial: **la hoja de AXA no dice ni "emisión" ni
  "elaboración"**. Dice `"Fecha:"` (p1) y `"Lugar y fecha"` (p5, junto a la firma). O sea que
  *"Fecha de emisión"* es **etiqueta NUESTRA** (`canonical.ts`), no de la aseguradora — el formato
  es agnóstico y no obliga a ninguna de las dos lecturas. Quien retome esto elige la semántica
  libremente; sólo que la elija a propósito.
- **`/api/…/dictar` sigue SIN UI** que lo llame. Endpoint LLM vivo y sin superficie.
- **El autoguardado al salir del campo YA NO EXISTE** (1B) y nadie decidió si se quiere así.
- **GNP**: ¿el formato de Eleonor (3 págs) o el oficial (2 págs)?
- **Allianz páginas 2 y 3** nunca se miraron.

---

# DÓNDE QUEDAMOS — 2026-08-10 (histórico)

## Todo está EN PROD y desplegado

| Commit | Qué |
|---|---|
| `a6aa9841` | estado PENDIENTE (1B + 2B) |
| `df7abc5b` | el CHAT + 12 hallazgos de review |
| `42ee7182` | fechas + casillas + layout, y 8 hallazgos más |
| `574c4ba4` | el modelo se come `campo:` — se descartaba casi todo |
| `697d6ce6` | un campo no puede tumbar el PDF (no se bajaba ninguno) |

Deploy `697d6ce6` **SUCCESS**. Sólo se mueve `@healthcare/doctor`; los otros 3 salen `SKIPPED`.

## Lo que el usuario probó y dijo

| | |
|---|---|
| Las **fechas** | ✅ "now work" |
| Las **casillas** | ⏳ seguían sin marcarse **hasta `574c4ba4`** — no confirmadas después |
| El **chat / layout** | ✅ "works way better" |
| **Bajar el PDF** | ⏳ roto hasta `697d6ce6` — **no confirmado después** |
| La **extracción** | 🟡 "still not extracting the data very well" — lo iba a seguir probando |

🔴 **Los dos ⏳ son lo primero que hay que confirmar con los ojos**: marcar una casilla que NO sea
la primera de su grupo, y bajar borrador + final.

## El bug de método que hay que recordar

Durante DOS sesiones todo lo determinista estaba en verde —catálogo, geometría, validación, 49/49
etiquetas, `type-check`, 5 gates, `next build`— y la función no servía. La causa: **nadie había
mirado lo que el modelo DEVUELVE**. Se come el prefijo `campo:`, y con eso se descartaba en
silencio todo lo que no fuera una clave canónica.

⇒ **Hay `OPENAI_API_KEY` en `apps/doctor/.env.local`: se puede llamar al modelo de verdad desde un
script, sin desplegar.** Es lo que destapó el bug, y se podía hacer desde el primer día.
Script de referencia (scratchpad, se reescribe en 5 min): arma el prompt real con
`promptsSistemaChat`, manda un mensaje de doctor, imprime la respuesta cruda y corre la validación.

## Lo siguiente que estaba acordado

**[`07-PLAN-informe-a-nivel-paciente.md`](07-PLAN-informe-a-nivel-paciente.md) — escrito y con las
4 preguntas CERRADAS por el usuario. Nada implementado.**

El informe pasa a crearse a **nivel paciente**, anclado a una **consulta OG** (que da el
pre-llenado 🟩 verde), y el doctor **elige** otras fuentes —consultas, notas, recetas— que se le
inyectan al chat en orden cronológico y caen en 🟧 ámbar.

Secuencia propuesta (no empezada):
1. Columna `sources` JSONB — SQL manual + `prisma db execute`, **nunca `db push`**; smoke read-only
   contra prod ANTES.
2. `contexto-clinico.ts` con los 3 tipos de fuente y orden cronológico.
3. `GET …/patients/:id/fuentes`.
4. Pantalla a nivel paciente + selector de ancla + panel de fuentes.

## Abierto, y NO es deuda menor

- ⚠️ **`prefill.ts` `fechaMomento()` lee componentes LOCALES y Railway corre en UTC.** El arreglo
  del paso 4 podría no arreglar nada en prod: una consulta de las 18:30 saldría fechada al día
  siguiente, en el campo que la aseguradora cruza contra el siniestro. **Verificar el `TZ` del
  contenedor.** El resto del repo usa `timeZone: 'America/Mexico_City'` explícito.
- **`/api/…/dictar` quedó SIN UI** que lo llame (se quitó el dictado por página). Endpoint LLM vivo
  y sin superficie: decidir si se retira.
- **El autoguardado al salir del campo YA NO EXISTE en prod** (1B) y el usuario nunca llegó a
  decidir si lo quiere así.
- **GNP**: ¿rige el formato de Eleonor (3 págs) o el oficial (2 págs)?
- **Allianz páginas 2 y 3** nunca se miraron.
