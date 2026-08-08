# 02 — PLAN: el formato de salida y el orden de los pasos

> Tipo **PLAN**. Escrito el **2026-08-08**. Ningún paso está hecho.
> ⚠️ **Reescrito el mismo día** tras medir 3 PDFs reales: la premisa original (escaneos planos,
> estampado por coordenadas, calibrador) **era falsa**. Ver §2.
> El "qué se llena y de dónde" vive en [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md).

## 1. Tres artefactos, no uno

| | Qué | Quién lo escribe | Cuándo |
|---|---|---|---|
| **1. El PDF original** | El formato oficial de la aseguradora, tal cual | Nadie — es inmutable | Se sube una vez |
| **2. El diccionario de campos** | Qué significa cada campo AcroForm del PDF | Se revisa una vez por formato | Al dar de alta el formato |
| **3. Las respuestas** | El JSON con lo que el doctor llenó | El doctor (y el pre-llenado) | Cada informe |

El PDF que recibe la aseguradora es **derivado**:

```
original + diccionario + respuestas → pdf-lib llena los campos → flatten → PDF final
```

Nada se "edita en PDF".

## 2. ⚠️ Los formatos NO son escaneos: son PDFs con campos rellenables

**Medido el 2026-08-08 sobre 3 formatos reales** (`pdfjs-dist`, script en scratchpad):

| Formato | Páginas | **Campos AcroForm** | Capa de texto | Rotación | Cifrado / XFA |
|---|---|---|---|---|---|
| **Allianz México** — Informe Médico | 3 | **126** (77 texto · 33 casilla · 16 s/tipo) | ✅ ~5,500 chars | 0 | No / No |
| **AXA Seguros** — GMM Informe Médico | 6 | **326** (264 texto · 45 casilla · 17 s/tipo) | ✅ ~8,500 chars | 0 | No / No |
| **GNP** — Informe médico GM | 3 | **132** (68 texto · 43 casilla · 3 radio · 18 s/tipo) | ✅ ~5,700 chars | 0 | No / No |

Los tres: **sin cifrar, sin XFA, sin restricciones de permisos, sin rotación, tamaño carta**.

> 🔴 **El grep crudo del PDF dice `/AcroForm 0` y MIENTE.** Son PDF 1.7 con *object streams*
> (`/ObjStm`) — los objetos están comprimidos y `grep` no los ve. Sólo un parser de verdad
> (`pdfjs-dist`, `pdf-lib`) los encuentra. No concluir "no tiene campos" desde un grep.

**Y el `Producer` de los tres es literalmente `pdf-lib`** (el `Creator` es Adobe InDesign en dos de
ellos). O sea: estos archivos **ya pasaron por pdf-lib** y sobrevivieron. Es la señal de
compatibilidad más fuerte que se puede pedir antes de escribir una línea.

> 🔴 **LEER ANTES DE CONFIAR EN ESTA TABLA:** estos 3 PDFs son de un **tercero**, no de las
> aseguradoras, y **los campos se los puso el tercero con pdf-lib**. El PDF oficial de **Allianz**
> es **plano (0 campos)**. Ver [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) — cambia el
> veredicto del calibrador.

### Lo que esto elimina del plan

| Lo que decía el plan viejo | Estado |
|---|---|
| Estampar texto en coordenadas x/y sobre un escaneo | ⚠️ **Innecesario donde el oficial ya trae campos (AXA); sigue haciendo falta donde es plano (Allianz)** |
| Calibrador de coordenadas con clics (§3 vieja) | ⚠️ **Reducido, no cancelado** — ver [`03-FORMATOS`](03-FORMATOS-procedencia-y-versiones.md) §4 |
| La trampa del origen invertido (PDF abajo-izq vs canvas arriba-izq) | ❌ **No aplica.** Ya no tocamos coordenadas para escribir |
| ~30–60 min de mapeo manual por formato | ❌ **Se cae.** Los campos ya existen y ya tienen rect |
| `maxWidth` y wrap manual del texto | ⚠️ **Sigue vivo pero más fácil** — el widget tiene ancho propio y `pdf-lib` puede auto-ajustar |

**Esto quita la mayor parte del riesgo y probablemente la mitad del trabajo.**

## 3. El trabajo que SÍ queda: el diccionario de campos

Los campos existen, pero **sus nombres no siempre dicen qué son**. Los tres formatos caen en tres
niveles distintos, y esto define el único trabajo manual que queda:

| Nivel | Formato | Ejemplos de nombre | Qué hace falta |
|---|---|---|---|
| 🟢 **Auto-descriptivo** | **AXA** | `DiagnósticoRow1` · `Fecha de diagnóstico ddmmaaaaRow1` · `Tratamiento recibidoRow1` | Casi nada. El nombre ES la etiqueta |
| 🟡 **Ambiguo** | **Allianz** | `Reembolso` · `Congénito` · `Agudo` · pero también `Si`, `No_2`, `Si_3`, `No_4` | Las parejas Sí/No no dicen a QUÉ pregunta responden |
| 🔴 **Puramente posicional** | **GNP** | `P1_1` · `P1_7` · `P2_15` · `P2_16` | Cero semántica. Todo hay que derivarlo |

### Cómo se resuelve barato

Tenemos **las dos mitades con coordenadas**: el `rect` de cada campo y la posición `(x, y)` de cada
fragmento de texto de la página. Entonces la etiqueta se **deriva por cercanía**: para cada campo,
el texto inmediatamente a su izquierda o arriba es casi siempre su etiqueta.

Eso genera un diccionario propuesto automáticamente. Encima va una **pantalla chica de revisión**
(admin): lista de campos, etiqueta propuesta, y a qué dato del expediente mapea. El humano corrige
lo que salió mal en vez de teclear 130 filas.

> 💡 Esto es **mucho más barato que el calibrador cancelado**: no hay que hacer clic en cada campo
> para ubicarlo, sólo confirmar o corregir un texto ya propuesto.

⚠️ **Los 16–18 campos "sin tipo" de cada formato** (`type: ""`) hay que revisarlos aparte: suelen
ser botones o firmas, no datos. No asumir que son texto.

⚠️ **AXA tiene tablas repetidas** (`...Row1`…`RowN`). Un diagnóstico por renglón. El modelo de
respuestas tiene que soportar listas, no sólo pares campo→valor.

## 4. Dónde viven los formatos — **no en `custom_templates`**

Tentación: reusar `EncounterTemplate` con un flag `isInforme`, como se hizo con `isReceta` e
`isPreAppointment`. **No.**

`encounter_templates` está scopeado por `doctorId` (`@@unique([doctorId, name])`). Los formatos de
aseguradora son **oficiales e idénticos para todos**: copiarlos por doctor significa que arreglar
un mapeo hay que arreglarlo N veces, y que dos doctores mandan versiones distintas del mismo
formato oficial.

Van en tablas **a nivel plataforma**, dadas de alta por admin:

```
insurance_forms          -- aseguradora, nombre del formato, VERSIÓN, el PDF original,
                         -- el diccionario de campos, activo/inactivo
medical_reports          -- el informe de UN paciente: patientId, encounterId, formId,
                         -- respuestas (JSON con procedencia), consentimiento, status,
                         -- quién y cuándo
```

⚠️ **Versionar el formato.** AXA ya trae su versión impresa en la hoja (`AI - 346 • FEBRERO 2022`).
Cuando cambien la hoja, los informes ya emitidos deben seguir reproduciéndose con el diccionario
viejo: un `medical_reports` apunta a una **versión**, no al formato "actual".

## 4b. DOS renders del mismo informe: BORRADOR y FINAL

De las mismas respuestas salen **dos PDFs distintos**, y no se pueden confundir.

| | **BORRADOR** | **FINAL** |
|---|---|---|
| Para quién | Sólo el médico | La aseguradora / el paciente |
| Colores | **Dos capas** (abajo) | Ninguno |
| Campos | **Sólo lectura** (`enableReadOnly()`) | **Aplanados** (`flatten()`) |
| Aviso | Barra roja "NO enviar a la aseguradora" | Nada |

🔴 **El borrador NUNCA se manda.** Los tres formatos dicen en su propio texto que **no son válidos
con tachaduras ni enmendaduras**; una hoja con recuadros de color encima es peor que una en blanco.

### Las dos capas de color (idea del usuario, 2026-08-08)

| Color | Significa |
|---|---|
| 🟦 Azul suave | **Aquí se puede escribir** — campo del formato que está vacío |
| 🟩 Verde suave | **Aquí ya hay contenido** — sin importar quién lo puso |

Resuelve el problema real al abrir un formato de **277 campos**: *¿dónde puedo escribir y qué ya
está hecho?* Probado sobre el AXA oficial: 11 en verde, 266 en azul, en las 6 páginas.

> 💡 **Extensión opcional (no hecha):** sombrear DENTRO del verde por procedencia — verde para lo
> copiado del expediente, ámbar para lo que redactó el LLM. El doctor barre con la vista los
> ámbar y los lee con cuidado. Conserva la regla de procedencia de
> [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §4 sin ensuciar la señal principal.
> Sólo vale la pena si dos colores resultan insuficientes.

### 🔴 Por qué el borrador es de SÓLO LECTURA

Los colores se **pintan en la página** al generar: son una foto, no estado vivo. Un PDF no
reacciona — si el doctor escribe en un campo azul, **no se pone verde**. (Acrobat tiene JavaScript
de formulario que podría recolorear, pero Chrome, Edge, Firefox y Preview de macOS lo ignoran.)

Y el problema de fondo es peor que el color: si el doctor teclea en el PDF, **ese valor vive sólo
en ese archivo** — fuera del JSON de respuestas. El pre-llenado, la procedencia, el LLM y el
re-emitir para otra aseguradora trabajan contra el JSON. Al regenerar el borrador, lo que tecleó
**desaparece en silencio**.

⇒ **Se edita en la app** (formulario HTML, donde el color SÍ es vivo y cambia al teclear) **y el
PDF es una foto para revisar e imprimir.** El ciclo:

```
editar en la app (colores vivos) → regenerar borrador (foto) → se ve bien → emitir FINAL (limpio)
```

## 5. Entrega

Confirmado con el usuario: **descargar el PDF** y **mandárselo al paciente**. Emitir correo directo
a la aseguradora **queda fuera de v1**.

> 💡 `apps/api/src/lib/gmail.ts` arma `multipart/alternative` con puro HTML — **no sabe adjuntar
> archivos**. Al no mandarle correo a la aseguradora, esa deuda no entra a v1.

Para el paciente se reusa el patrón de token de
`apps/public/src/app/formulario-cita/[token]/page.tsx`: recibe un link, abre una página, descarga el
PDF. Además de ahorrar el adjunto, mantiene PDFs clínicos fuera del correo — mejor postura bajo
LFPDPPP.

⚠️ **Aplanar el PDF antes de entregarlo** (`form.flatten()` en pdf-lib). Si se manda con los campos
vivos, cualquiera puede editar el informe firmado por el doctor. Los tres formatos advierten en su
propio texto que **no aceptan tachaduras ni enmendaduras**.

## 6. Los pasos, en orden

| # | Paso | Por qué en este lugar |
|---|---|---|
| **0** | ✅ **HECHO** — medir los PDFs reales | Descubrió que son rellenables y borró el paso más caro |
| **1** | ✅ **HECHO 2026-08-08** — tablas `insurance_forms` + `medical_reports` EN PROD (SQL manual + `prisma db execute`) | Todo lo demás necesita dónde guardar |
| **2** | `pdf-lib`: llenar por nombre + `flatten`, contra **AXA** (el de nombres más limpios) | Prueba el motor de salida en el caso más fácil |
| **3** | Derivar el diccionario por cercanía + pantalla de revisión (admin) | Convierte GNP (`P1_7`) en algo mapeable |
| **4** | Pre-llenado **determinista**: fuentes A + B1 + B2 | Sin LLM. La mayor parte del valor, lo más barato |
| **5** | Pantalla del doctor: dropdown de formato, formulario HTML, procedencia visible, exportar | Ya hay qué mostrar y qué pre-llenar |
| **6** | LLM sobre `customData` (B3) + voz | Lo último: es lo único que puede equivocarse |
| **7** | Link con token al paciente | Independiente; puede ir antes si urge |

🔴 **El paso 2 va antes que el 3.** Escribir el diccionario antes de saber que el llenado funciona
es mapear a ciegas.

💡 **Los pasos 4 y 5 ya son entregables.** Con pre-llenado determinista, edición manual y descarga,
la funcionalidad **ya sirve** aunque el 6 nunca llegue.

## 7. Riesgos (los que quedan)

| Riesgo | Mitigación |
|---|---|
| Un formato futuro SÍ es escaneo plano | Entonces vuelve el estampado por coordenadas **para ese formato**. El diseño lo aísla: cambia el renderer, no el resto |
| Nombres de campo sin semántica (GNP) | Derivación por cercanía + revisión humana (§3) |
| El PDF se entrega editable | `flatten()` obligatorio antes de entregar (§5) |
| La aseguradora cambia el formato | Versionado (§4) |
| El doctor confía en el pre-llenado y firma sin leer | Procedencia visible ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §4) |
| El texto no cabe en el campo | El widget tiene ancho; auto-ajuste de tamaño, nunca recorte silencioso |
| Acentos rotos al escribir | Los formatos son en español (`Diagnóstico`, `Programación`). Verificar la codificación de fuente al llenar — es el bug clásico de pdf-lib con caracteres no-WinAnsi |

## 8. Lo que hay que probar con un clic, no con type-check

`pnpm type-check` + `pnpm gates` + smoke de BD **no es "probado"**. Falta el clic:

1. Elegir un formato, ver el pre-llenado, corregir un campo, exportar.
2. **Abrir el PDF exportado y compararlo contra el oficial** — cada valor en su casilla, **con los
   acentos correctos**, y el archivo ya aplanado (que no se pueda editar).
3. Abrir el link como paciente y descargarlo.
