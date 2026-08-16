# 06 — AGENTE: el doctor CONVERSA con el formato

> Tipo **PLAN**. Escrito el **2026-08-09**. ✅ **CONSTRUIDO el 2026-08-09** (§11) · **probado en vivo y corregido el 2026-08-10** (§12).
> Sucede a [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md): el dictado de un solo tiro
> **se probó y no alcanza**. Ver §1.
> ⚠️ Toca al ASISTENTE ⇒ se rige por [`../AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md`](../AGENTES/GENERAL%20AGENTES/08-EMPIEZA-AQUI.md).

## 1. Por qué el dictado de un tiro no alcanza

Veredicto del usuario tras probarlo: *"works in very simple pages, so not really useful right now"*.

El diagnóstico: **el dictado le pide al doctor que ya sepa qué necesita el formato.** Con 255
campos, nadie lo sabe. El doctor habla de lo que tiene en la cabeza; la hoja pide cosas que él no
mencionó porque no sabía que se las estaban preguntando. El resultado es una hoja a medio llenar y
la sensación de que la función no sirve.

⇒ **La conversación invierte quién pregunta.** El agente ya conoce el formato: puede decir *qué
falta* y **preguntarlo**. Eso convierte una hoja de 255 campos en una entrevista guiada.

## 2. 🔴 LA HOJA ES EL CARD (corregido por el usuario, 2026-08-09)

Mi primer borrador ponía las propuestas **en el chat**, como una lista que el doctor aprueba. El
usuario lo corrigió, y su versión es mejor:

1. Se abre un **chat**, como los otros flujos agénticos del app.
2. El agente **ya tiene precargado el esquema del formato**.
3. El doctor manda un mensaje.
4. El agente extrae los valores y los coloca **EN LA HOJA DE LA ASEGURADORA, en vivo** —
   *"not saw in the chat with the LLM"*.
5. El doctor **corrige tecleando encima**, sobre la hoja.
6. Cuando está listo, **GUARDA a mano**.

**Por qué es mejor que un card en el chat:** una propuesta se juzga por si **cabe en ESA casilla de
ESA hoja**, y eso no se puede juzgar desde una lista abstracta. Puesta en su lugar, el doctor ve el
contexto, el tamaño, y qué hay alrededor. La hoja ES la superficie de revisión.

### Lo que esto CAMBIA en el código

🔴 **Hace falta un estado PENDIENTE, que hoy no existe.** Ahora mismo cada edición hace `PATCH` al
salir del campo: se persiste al instante. En este flujo los valores del agente **se ven pero NO se
guardan** hasta que el doctor aprieta Guardar.

| | Hoy | Con el agente |
|---|---|---|
| Escribir en un campo | `PATCH` al salir del campo | ⬜ por decidir (§10 #5) |
| Valor propuesto por el agente | — | **Pendiente**: visible, sin guardar |
| Confirmar | implícito | **Guardar**, explícito |
| Salir con cambios sin guardar | no aplica | hay que avisar |

## 3. 🔴 Cómo encaja con la regla del asistente

La regla dura es
([`08-EMPIEZA-AQUI`](../AGENTES/GENERAL%20AGENTES/08-EMPIEZA-AQUI.md) §1):

> **Escrituras = propuesta → card → el doctor confirma → el CLIENTE ejecuta.**

La versión del usuario **la cumple en sustancia**: hay propuesta (valores pendientes), hay revisión
(la hoja), hay confirmación explícita (Guardar) y **ejecuta el cliente** (el `PATCH` sale del
navegador al guardar; el servidor del agente nunca muta el informe). Lo único que cambia es **dónde
vive el card**: en la hoja, no en el chat.

⚠️ **Y corrige a [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md) §4** en el punto que importa:
ahí el dictado escribía **y persistía** de inmediato. Aquí no se persiste hasta Guardar.

## 4. 🔴 ES UN FLUJO CONTENIDO, NO un módulo del asistente

**Corregido por el usuario (2026-08-09).** Mi borrador decía que `informe` sería el sexto módulo
del asistente. **Está mal, y el error fue mío por confundir dos cosas distintas del app:**

| | Qué es | Ejemplos | Lo gobierna |
|---|---|---|---|
| 🟢 **El ASISTENTE** | UN agente conversacional que crece por módulos de dominio | agenda · facturas · fiscal · flujo · expediente | [`AGENTES/`](../AGENTES) y `08-EMPIEZA-AQUI` |
| 🔵 **Flujos CONTENIDOS** | Funciones de IA que se disparan y viven solas | nueva consulta por voz · notas · el dictado del informe | Nada de lo anterior |

Leí `08-EMPIEZA-AQUI` —que documenta **el asistente**— y apliqué sus reglas a un contexto que no
gobierna. **El informe es 🔵.**

**Verificado en el código (2026-08-09):** ni `/api/voice/structure` ni el `dictar` del informe
importan `agenda-agent`. Son independientes. El dictado que ya está en prod **ya era** un flujo
contenido.

⇒ **Lo que se cae de §8:** no hay módulo nuevo, ni entrada en `AGENT_MODULE_REQUIREMENTS`, ni
`02-CAPACIDADES`, ni evals del agente, ni prompt que crezca para los turnos de agenda y facturas.
El costo era bastante menor de lo que estimé.

📌 **Dónde SÍ se documenta:** [`GENERAL AGENTES/06-MAPA-superficie-IA`](../AGENTES/GENERAL%20AGENTES/06-MAPA-superficie-IA.md),
que lista **todos** los endpoints de LLM del app, no sólo los del asistente.

## 5. ~~Las tools~~ — 🔴 NO HAY TOOLS, y la razón está MEDIDA

Este era el borrador:

| Tool | Tipo | Qué hacía |
|---|---|---|
| ~~`get_campos_informe`~~ | lectura | los campos, acotables por página |
| ~~`get_contexto_informe`~~ | lectura | consultas y recetas del paciente |
| ~~`propose_llenar_informe`~~ | propuesta | los valores propuestos |

**Se cayó entero al medir la premisa de §8** ("los 255 campos no caben en el prompt"):

| | |
|---|---|
| Campos de texto de AXA | **255** |
| El catálogo completo | **15.3 KB · ~3,800 tokens** |
| El prompt de sistema entero (reglas + catálogo) | **18.8 KB · ~4,700 tokens** |

Caben de sobra. Y servirlos completos **no es un ahorro de trabajo: es el producto**. El agente
sólo puede decir *qué falta* si ve la hoja ENTERA; acotado por página vuelve a poner al doctor a
adivinar qué le están preguntando, que es exactamente por lo que el dictado de un tiro no
alcanzó (§1).

⇒ **Un solo JSON por turno**, con el mismo `getChatProvider()` que ya usa el dictado:

```
{ "mensaje": "qué falta y qué te pregunto", "campos": { "clave": "valor" } }
```

🔴 **El servidor del agente jamás muta el informe.** El `PATCH` lo dispara el cliente cuando el
doctor guarda, contra el endpoint que ya existe.

### Lo que sustituye a la validación que daban los schemas de las tools

Sin tools no hay schema que valide los nombres de campo, así que la validación es explícita y
server-side (regla 0). Cada clave que devuelve el modelo se comprueba **contra la hoja real**:
existe · es de texto · imprime en WinAnsi. Lo que no pasa va a `descartados` y **el cliente lo
enseña** — es el antídoto exacto a la debilidad conocida de la arquitectura C
([`06-MAPA-superficie-IA`](../AGENTES/GENERAL%20AGENTES/06-MAPA-superficie-IA.md) §1): *el
modelo inventa nombres, el cliente aplica NADA y el chat dice "listo"*.

## 6. Lo que hace que SIRVA (y que el dictado no tenía)

1. **El agente dice qué falta.** *"De la página 2 faltan 8 campos. Los tres que casi siempre
   rechazan si van vacíos: fecha de hospitalización, técnica quirúrgica y CIE-10."*
2. **Pregunta.** *"¿Fue ambulatoria o con hospitalización?"* — el doctor no tiene que adivinar qué
   quiere la hoja.
3. **Reparte un relato largo.** El doctor cuenta el caso de corrido y el agente lo parte entre
   campos, **poniéndolo en la hoja** para que se vea dónde quedó cada pedazo.
4. **Se corrige en su lugar**, viendo la casilla real, no una lista.
5. **Sabe lo que NO se puede llenar.** CIE-10, TNM y póliza no están en el expediente
   ([`04-MAPEO`](04-MAPEO-expediente-a-formato.md) §3): en vez de inventarlos, los PIDE.

## 7. El privacy tier: ERA FALSA ALARMA

Mi borrador levantó un conflicto con la regla de `modules/expediente.ts` —*el asistente NUNCA
devuelve contenido clínico*— y propuso una excepción (opción A, que el usuario aprobó).

⚠️ **Esa regla gobierna al asistente 🟢, no a los flujos contenidos 🔵.** Y el precedente ya existe
y está en producción: **el flujo de nueva consulta por voz estructura `subjective`, `assessment` y
SOAP completos** desde el dictado (`voice-assistant/prompts.ts`). Un flujo contenido que trabaja con
contenido clínico no es una excepción: es lo normal en esa categoría.

⇒ **No hace falta excepción, ni tocar `02-CAPACIDADES`, ni el comentario de privacy tier de
`expediente.ts`.** El asistente 🟢 sigue exactamente igual de ciego que hoy.

**Lo que SÍ se conserva del razonamiento**, porque son buenos límites por sí solos y no por la
regla que creí que aplicaba:

1. El flujo lee clínico **sólo del `encounterId` ligado a ESE informe** — el doctor eligió esa
   consulta al crear el informe; leer otras sería pasarse de lo que pidió.
2. **Los datos van a un proveedor externo** (`LLM_PROVIDER`, hoy OpenAI). Ya pasa con la consulta
   por voz, pero el propósito aquí es distinto —transferencia a una aseguradora— y conviene que el
   aviso de privacidad lo diga ([`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md) §8).
3. **Adjuntar consultas es explícito**, elegido por el doctor: minimización de datos.

> 🔎 **Lección:** leer el doc de gobierno equivocado produce trabajo y preocupación de más. `CLAUDE.md`
> manda a `AGENTES/` "todo lo relacionado con **el asistente**" — y el informe no es el asistente.

## 8. El costo, honesto

- ~~Un módulo nuevo del asistente~~ **NO APLICA** (§4): es un flujo contenido.
- **El estado PENDIENTE** (§2) es el cambio de fondo: hoy cada edición persiste al salir del campo.
- **Un endpoint de conversación** con historial, sobre el que ya existe (`dictar`).
- **Pruebas propias del flujo** — no las del agente, pero sí algo que verifique que no se degrada.
- ~~**Los 255 campos no caben en el prompt.** Van por tool, acotados por página.~~
  🔴 **FALSO, medido:** son ~3,800 tokens y caben enteros. Ver §5. La suposición venía de
  [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md) §5, donde acotar por página tenía otro
  motivo (el doctor dicta MIRANDO una página), no el tamaño.

## 9. Qué se conserva de 05-VOZ

El dictado **no se tira**: se vuelve una forma de *entrar* al chat. La transcripción alimenta el
mensaje del doctor en vez de escribir directo en la hoja. Lo que ya está construido y sigue
sirviendo: `transcribir-audio.ts`, la validación server-side de claves, `capacidad.ts`, y las
reglas anti-alucinación del prompt.

⚠️ **Y el aviso de `05-VOZ` §4 (sin card) queda revertido para el chat.** Se conserva sólo si
alguna vez se deja el dictado directo como atajo aparte.

## 10. Abierto

| # | Pregunta |
|---|---|
| ~~1~~ | ~~§7: ¿A, B o C?~~ **RESUELTO: opción A** (§7) |
| 2 | ¿El chat vive SÓLO en la pantalla del informe, o también se puede preguntar desde el panel global ("¿qué le falta al informe de Ana?") |
| 3 | ¿El agente puede proponer sobre campos VERDES (deterministas), o sólo vacíos y ámbar? (05-VOZ §9.2 dijo que sí a todo, con "restaurar del expediente") |
| ~~4~~ | ~~¿Card por campo o por tanda?~~ **RESUELTO: no hay card en el chat — la hoja es el card** (§2) |
| ~~5~~ | ~~¿El tecleo manual sigue guardando al salir del campo?~~ **RESUELTO: NO — TODO queda pendiente hasta Guardar** (opción 1B) |
| ~~6~~ | ~~¿Guardar aplica todo o se descarta campo por campo?~~ **RESUELTO: se puede descartar CAMPO POR CAMPO** (opción 2B) |

### Las dos decisiones, con lo que cuestan (usuario, 2026-08-09)

**1B — nada se guarda hasta Guardar.** Una sola regla para toda la hoja, sin la ambigüedad de "esta
caja ya se guardó y esta no". El precio: **se puede perder trabajo** si se cierra la pestaña o
truena el navegador, cosa que hoy no pasa porque cada edición persiste al salir del campo. ⇒ Hace
falta aviso de "tienes cambios sin guardar" al salir. **Se descartó 1B+** (respaldo en el navegador):
no se va a meter texto clínico del paciente en `localStorage` sin decidirlo a propósito.

**2B — descartar campo por campo.** Cada valor pendiente lleva una ✕ que lo devuelve a como estaba.
El caso que lo justifica: el agente pisa un `Diagnóstico` que **ya estaba bien** — sin la ✕ habría
que reescribir el original de memoria. Y es el caso normal de uso, porque el agente se va a usar
sobre todo para **rellenar huecos** de una hoja ya empezada.

Además: un **"descartar toda la tanda"**, para que una propuesta mala no se deshaga ocho veces.

---

## 11. ✅ LO CONSTRUIDO (2026-08-09)

### Las piezas

| Archivo | Qué es |
|---|---|
| `lib/informe-medico/prompt-chat.ts` | El prompt, partido en **estable** (reglas + catálogo) y **volátil** (lo ya escrito + consultas) |
| `api/…/reports/[reportId]/chat/route.ts` | El endpoint. Acepta texto (JSON) o **voz** (multipart) |
| `informe/ChatInforme.tsx` | El panel flotante |
| `lib/informe-medico/campos-dictables.ts` | 🔧 extraído: la lista de campos que comparten **dictado y chat** |
| `lib/informe-medico/contexto-clinico.ts` | 🔧 extraído: una consulta del expediente → texto para el modelo |

Las dos extracciones no son limpieza: estaban **en línea dentro de `dictar/route.ts`**, y
copiarlas al chat es cómo los dos endpoints acaban ofreciendo conjuntos de campos distintos —
el dictado llena un campo y el chat dice que no existe.

### El orden del prompt es una decisión de COSTO

El catálogo va **primero** y se manda idéntico en cada turno; lo que cambia (lo ya escrito, las
consultas, el mensaje) va **después**, en un segundo mensaje de sistema. Los proveedores cachean
el **prefijo común**: mientras el catálogo no se reordene, los ~4,700 tokens se cobran una vez
por conversación y no una por turno. Por eso `camposDictables()` ordena por (página, clave) en
vez de dejar el orden del AcroForm.

⚠️ ~~**Es una expectativa, no una medición.**~~ → **MEDIDO el 2026-08-11**: una llamada real
devolvió `cached_tokens: 6528` en el segundo turno. El prefijo estable SÍ se cachea; era lo
único que este apartado afirmaba sin comprobar.

### 🔴 El ORDEN DE LAS TAREAS también decide si sirve (2026-08-11)

Distinto del orden de los bloques (que es costo): el orden de la LISTA DE TAREAS dentro del
prompt decide **si el modelo usa el expediente o lo ignora**.

Durante dos días la lista decía, en este orden:

> 1. Di qué falta · 2. **PREGUNTA** · 3. Coloca lo que haya **en su mensaje**

Colocar estaba acotado **al mensaje del médico**, y el expediente se entregaba como lectura de
fondo sin ninguna instrucción de extraer de él. Resultado con un mensaje corto ("llena el
formulario"): el asistente **preguntaba por el diagnóstico que tenía delante en una receta que el
doctor le había marcado**. No era el modelo fallando — era obediencia.

Invertido: **extraer del expediente primero**, el mensaje después, y preguntar al final (y sólo
por lo que NO esté en las fuentes).

| | campos colocados |
|---|---|
| Orden viejo, mensaje "llena el formulario" | **4** |
| Orden nuevo, mismo mensaje | **13** |

🔎 **La lección, transferible a cualquier prompt:** entregarle contexto a un modelo **no** es
pedirle que lo use. Si la lista de tareas no dice "extrae de ahí", el contexto es decoración.

### ⚠️ Y el arreglo trajo su propio riesgo (hallazgo del review, mismo día)

La primera versión decía *"devolver `campos: {}` es un turno FALLIDO"*. Eso **contradecía** la
regla de formato 90 líneas más abajo (*"`campos` puede ir vacío: un turno en el que sólo
preguntas es un turno bueno"*) y, peor, dejaba al modelo entre dos órdenes imposibles cuando el
pre-llenado ya había copiado todo lo extraíble: *vacío = fallo* y *repetir lo ya escrito =
prohibido*. La única salida es **inventar**, en una hoja con CIE-10, TNM y fechas.

Y probándolo salió justo eso: con la hoja llena, el modelo escribió
`Fecha de diagnóstico = 20082024` — **la fecha de la consulta** — cuando el expediente dice
"diagnosticado en 2019". De ahí la regla nueva: **la fecha de un documento no es la fecha de lo
que cuenta**; sólo se escribe una fecha que el texto diga con todas sus letras, y si sólo hay año,
se pregunta el día y el mes. Verificado: ahora pone `2019` y pregunta.

### El disparador: un BOTÓN, no adivinar qué escribir

Marcar una fuente **no llena la hoja** — sólo se la entrega al chat — y el único disparador era
escribirle un mensaje. El doctor marcaba cinco casillas, no veía cambiar nada, y concluía que
estaba roto (y tenía razón: nada lo decía). Ahora hay un botón **"Llenar la hoja con lo que
marqué"** junto a las casillas, que abre el chat y manda el turno por él — visible, no por
detrás. El invariante no se toca: cae en ámbar y no se guarda hasta apretar Guardar.

### ~~Lo que el chat NO hace: marcar casillas~~ → **YA LAS MARCA** (2026-08-10)

> ⚠️ **Esto decía que las casillas quedaban fuera "a propósito" porque los on-states son opacos
> (`/1`, `/M`, `/CE`) y cerrarlo pediría el motor de vecindad del paso 3. El motor YA EXISTÍA
> (`add-fields.ts`) y una sola medición bastó. La decisión estaba bien razonada y era falsa.**

El nombre no dice nada, pero **el texto impreso al lado sí**: la etiqueta de cada recuadro es lo
que está a su **derecha**, y la pregunta del grupo lo que está a la **izquierda del primero**.
Resuelven **49 de 49**. Ver `etiquetas-de-la-hoja.ts` y §12.

### Lo verificado, y lo que eso NO cubre

Corrido contra el AXA **real** (`scratchpad/verificar-chat.mts`):

| | |
|---|---|
| Campos ofrecidos al agente | **255**, páginas 1–6 |
| Claves ofrecidas que NO llegarían al PDF | **0** ✅ |
| Dictado (p1) === el subconjunto p1 del chat | ✅ idénticos |
| Casillas coladas en el catálogo | **0** ✅ |
| Descarta un campo inventado | ✅ |
| Descarta `mejoría → alta` por la `→` | ✅ |
| Respeta `null` ("no sé") y `""` (no borra) | ✅ |

`type-check` ✅ · los **5 gates** ✅ (`gate:routes` cubre la ruta nueva sin tocar el mapa de
permisos: cuelga de `/api/medical-records/*` y hereda `expedientes`) · `next build` ✅ con
`/api/medical-records/patients/[id]/reports/[reportId]/chat` en la lista de rutas.

🔴 **Nada de esto es el CLIC.** No se ha mandado un solo mensaje: no hay ninguna respuesta real
del modelo, ni se ha visto una propuesta caer en ámbar sobre la hoja. Lo verificado es la mitad
determinista —el catálogo, la validación, el prompt— y por construcción no puede decir si el
agente **conversa bien**, que es justo lo que el dictado falló.

---

## 12. 🔴 LO QUE FALLÓ AL PROBARLO, Y POR QUÉ (2026-08-10)

Veredicto del usuario tras usarlo: *"it's getting better, but still a long way to go"* — las
fechas no aterrizaban, ninguna casilla se marcaba, y el chat tapaba la hoja.

### Las fechas y las casillas eran EL MISMO bug

Al modelo se le daban los **nombres internos del AcroForm**. En AXA muchos no significan nada:

| Lo que veía el modelo | Lo que es |
|---|---|
| `campo:Día_4` | Fecha de **cirugía** |
| `campo:Día_6` | Fecha de **alta** |
| `campo:Consultorio_2` | Consultorio · Hospital · Gabinete · Otro |
| `campo:Sí_3` | el Sí/No de «¿Es cáncer?» |

Nadie elige un campo cuyo nombre no dice qué es. Lo que sí lo dice es el **texto impreso
alrededor** ⇒ `etiquetas-de-la-hoja.ts`, sobre el motor de vecindad que ya existía.

- **Casillas:** etiqueta = texto a la **derecha**; pregunta del grupo = texto a la **izquierda
  del primer recuadro**. 49/49.
- 🔴 **El modelo devuelve la ETIQUETA, jamás el on-state.** `/H` lo resuelve el servidor contra
  el PDF. Y si no empata con ninguna opción **se descarta**: no se aproxima "la más parecida",
  porque en un grupo excluyente eso es afirmarle algo falso a la aseguradora.
- 🔴 **La pregunta del grupo sale del recuadro más a la izquierda, no del primero que devuelve
  `getWidgets()`** — ese orden no es visual. En `MAM` el primer widget es "Maternidad" y a su
  izquierda está "Accidente", otra opción del mismo grupo.

### La trampa de la fecha: `Día_4` no es una caja de día

Es **una caja ancha para la fecha entera**, con las guías `Día`/`Mes`/`Año` impresas encima y la
pregunta un renglón más arriba. Tomar la guía como etiqueta daba `Día_4 → "Mes"`,
`Día_5 → "Mes"`, `Día_6 → "Mes"`: las tres iguales y ninguna correcta — y peor que inútil,
porque le dice al modelo que escriba un mes donde va la fecha de alta. Se saltan las guías
(`GUIA_DE_FECHA`) y se sube un renglón.

Y faltaba lo más simple: **el prompt nunca decía en qué formato va una fecha.** El pre-llenado
escribe `dd/mm/aaaa` y el modelo escribía prosa, así que la hoja salía con dos formatos. Ahora es
regla dura, y una fecha incompleta ("en marzo") se **pregunta** en vez de completarse.

### La pantalla

Mismas clases que `AgendaAgentPanel`: en `lg` el chat es `static` —un hermano flex, la hoja se
encoge— y por debajo cae a barra lateral y a hoja inferior. Se abre con la pestaña del borde
derecho. El `abierto` vive en la PÁGINA: la hoja necesita saberlo para soltar su `max-w-4xl`.

### Lo que sigue abierto

- Los grupos de una sola casilla (`ANP`, `ANP1`…) tienen como "opción" la pregunta misma
  (`¿Fuma?`): marcarla significa "sí". Funciona, pero se lee raro en el prompt.
- La pregunta de `S1` (Masculino/Femenino) sale como «nacimiento:», arrastrada del campo de al
  lado. Las opciones se explican solas, así que no cambia nada — pero es ruido.
- **Nadie le ha vuelto a hablar al chat con esto puesto.**

### 🔴🔴 Qué casillas NO puede tocar el agente (hallazgo del review, 2026-08-10)

Al derivar las 49 casillas **entraron todas** al catálogo del modelo — incluidos los
consentimientos LFPDPPP del **paciente** (`Sí acepto`, `Autorizo el tratamiento y transferencia
de mis datos personales…`, p6, la página que dice *"Para ser llenado por el Asegurado afectado"*)
y la declaración de **facturación** del médico (`Se ajusta a Tabulador médico`, p5).

El doctor dice *"el paciente ya autorizó"*, el modelo lo marca, el doctor da **un solo Guardar**
para la tanda, y el PDF aplanado **afirma una autorización que el paciente nunca firmó**.

⇒ `casillasParaElAgente()` — de 22 grupos el agente ve **13**:

1. **Consentimientos y facturación** (`autoriz`, `acepto`, `tabulador`, `firma`, `datos
   personales`…): no son del médico y tienen consecuencia legal.
2. **Grupos de una sola opción** (`ANP` = `¿Fuma?`): el modelo sólo puede MARCAR, nunca negar. El
   doctor dice "no fuma" y la única cadena que puede emitir marca la casilla.
3. **Sin pregunta y con opciones genéricas** (`Sí_2` = `Sí | No`): indistinguible de `Sí_3`
   («¿Es cáncer?»), y el servidor aceptaría el grupo equivocado porque la etiqueta empata.

**La hoja no cambia:** el visor las dibuja desde la geometría y el doctor las marca a mano. Lo
que se quita es que las proponga un modelo.

> 🔎 **Lección:** derivar el catálogo *de la hoja* lo hizo COMPLETO, y completo incluía cosas que
> ningún agente debe firmar. Al automatizar "qué campos existen" hay que decidir aparte **qué
> campos son suyos** — no son la misma pregunta.

---

## 13. El chat con la TERCERA aseguradora — GNP (2026-08-15)

Pregunta del usuario al cerrar GNP: *"¿el formato de GNP está mapeado para que el LLM lo entienda
como AXA y Allianz?"*. Se midió el catálogo REAL que recibe el modelo, no el diccionario:

| | AXA | Allianz | **GNP** |
|---|---|---|---|
| Campos de texto ofrecidos | 255 | 73 | **55** |
| Con el rótulo ILEGIBLE (nombre crudo y opaco) | 0 | 0 | **1** (`CPT`) |
| Grupos de opción que el asistente puede marcar | 13 de 22 | 12 de 14 | **5 de 7** |
| ¿Necesitó mapa de `etiquetas` a mano? | no | **sí, 61 de 73** | **no** |

GNP no lo necesita por lo mismo que AXA: **los nombres los puso la aseguradora**
(`Diagnóstico Definitivo`, `Cédula profesional`). Allianz sí, porque los inventamos nosotros.

### 🔴 Los RADIOS entran al catálogo como un grupo de casillas más

Las 7 preguntas de opción de GNP se ofrecen con la MISMA forma que las casillas de AXA: el modelo
devuelve la **etiqueta impresa** (`Enfermedad`) y el servidor la resuelve contra el on-state real
(`/Opción2`). Nunca al revés — si el modelo pudiera mandar el on-state, un `/Opción2` inventado
marcaría una opción que nadie eligió.

**Verificado con una llamada REAL a gpt-4o** (~3,055 tokens de entrada, la mitad que AXA), con un
mensaje clínico corriente: **9 colocaciones, 0 descartadas** — 5 campos de texto y 4 grupos
(`Causa atención → /Opción2`, `Tipo de Trámite → /Opción1`, `Estancia → /Opción2`,
`Tipo padecimiento → /Opción2`), y preguntó por lo que no podía saber (nombre, fecha de
nacimiento, póliza, hospital) en vez de inventarlo.

⚠️ **Dos grupos quedan FUERA del alcance del agente** (`Relación otro padecimiento` y
`Complicaciones`): son `Sí | No` pelados, sin pregunta derivable. Es la regla 3 de
`casillasParaElAgente()`, la misma que bloquea `Sí_2` en AXA — sin la pregunta, un `Sí` es
indistinguible entre grupos y el servidor aceptaría el equivocado. Los marca el doctor.

💡 Y al revés: **`Genero` (M | F) SÍ lo ve el asistente**, así que aunque el pre-llenado no puede
poner el sexo —el canónico dice `"Masculino"` y el campo pide `M`— basta con decírselo al chat.

⚠️ **Un rótulo que conviene corregir:** el modelo escribió el diagnóstico también en
`Padecimiento relacionado`, que en la hoja significa *otro* padecimiento distinto con el que se
relaciona. El nombre del campo no lo dice. Es la forma leve de *un rótulo pobre se obedece mal*, y
se arregla con una línea de `ETIQUETAS_GNP` — pendiente.
