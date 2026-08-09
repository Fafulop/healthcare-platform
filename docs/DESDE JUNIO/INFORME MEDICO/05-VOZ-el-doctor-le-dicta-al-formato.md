# 05 — VOZ: el doctor le dicta AL FORMATO

> Tipo **PLAN**. Escrito el **2026-08-09**. Nada implementado.
> 🔴 **Este documento SUSTITUYE el enfoque B3 de [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §3**
> (mapear `customData` → campos del formato). Ver §1: no es que sea difícil, es que es el
> problema equivocado.

## 0. En una frase

El doctor mira el formato de la aseguradora en el visor, **dicta**, y el LLM escribe las respuestas
**directo en los campos de ese formato**. Puede además **adjuntar las consultas o recetas que
quiera** como contexto. Nada de mapear esquemas de plantillas.

## 1. 🔴 Por qué se abandona el mapeo de `customData`

El plan anterior era: leer `ClinicalEncounter.customData`, resolver sus claves a etiquetas con
`resolveRecetaCustomContent`, y mapearlas a los campos del formato. **Dos razones lo tumban, y la
segunda es definitiva.**

### a) No escala, y el número real lo confirma

Medido en prod el 2026-08-09:

| | |
|---|---|
| Consultas | **197** |
| **Con `customData`** | **158 — el 80%** |
| Plantillas distintas | **40** (de 2 a 26 campos) |
| `customData` huérfano (plantilla borrada) | 0 |

Y eso con **11 doctores**. La proyección del usuario: *"imagina mil doctores, cada uno con diez
plantillas"* ⇒ 10,000 esquemas inventados **después** de que shipeamos, contra 3 formatos. Ningún
mapeo estático sobrevive eso, y un LLM que traduzca esquema→esquema hereda el mismo problema.

### b) La plantilla **no tiene** lo que pide la aseguradora

Ésta es la que mata el enfoque. AXA pide `Código ICD`, `Estadificación TNM`, fecha de
hospitalización, técnica quirúrgica detallada. **Nada de eso está en el expediente**
([`04-MAPEO`](04-MAPEO-expediente-a-formato.md) §3), ni en la plantilla del doctor, ni en ningún
lado. Ningún mapeo puede producir un dato que nunca se capturó.

⇒ **El mapeo no es difícil: resuelve el problema equivocado.** El hueco no se llena traduciendo
esquemas, se llena porque **el médico lo dicta**.

## 2. La inversión: el esquema conocido va del lado chico

```
❌ ANTES   1000 doctores × 10 plantillas × N formatos  →  mapeos imposibles de mantener
✅ AHORA   contexto libre (voz + documentos elegidos)  →  UN esquema conocido
```

El conocimiento de esquema se pone donde es **chico, conocido y versionado**: el formato de la
aseguradora. Son 3, cambian cada varios años, y **ya sabemos extraerlos** —
`geometriaDelFormato()` devuelve cada campo con su etiqueta. Ese es el contrato de salida del LLM,
y ya está construido.

Todo lo demás —la voz, las plantillas adjuntas, las recetas— entra como **contexto sin estructura**.
No hay nada que mapear.

## 3. Lo que ya existe y se reusa (no se reinventa)

| Pieza | Dónde |
|---|---|
| Grabar y transcribir | `POST /api/voice/transcribe` · `VoiceRecordingModal` |
| Transcripción → JSON estructurado con un **esquema dinámico** | `POST /api/voice/structure` + `generateCustomTemplateSystemPrompt` |
| Reglas anti-alucinación ya redactadas | `custom-template-prompts.ts`: *NEVER INVENT DATA · empty is ALWAYS better than a guess* |
| `customData` → etiquetas en español | `resolveRecetaCustomContent` (con fallback si borraron la plantilla) |
| Los campos del formato con su etiqueta | `geometriaDelFormato()` |
| Procedencia `voice` / `llm` + pintado **ÁMBAR** | ya en el visor y en el conjunto CERRADO de `AnswerOrigin` |

> 💡 **El precedente exacto ya corre en producción:** el flujo de *nueva consulta* arma el prompt
> desde el `FieldDefinition[]` de una plantilla —un esquema que no existía al compilar— y el
> resultado **cae directo en el formulario**. Aquí es lo mismo, cambiando la plantilla del doctor
> por el formato de la aseguradora.

## 4. 🔴 Se escribe DIRECTO en el formulario. Sin card de confirmación.

Decidido con el usuario el 2026-08-09, y **corrige una mala aplicación de la regla del agente**.

La regla `propuesta → card → confirmación` de `CLAUDE.md` existe porque **el agente escribe en la
BASE DE DATOS** (citas, facturas). Aquí el LLM escribe en un **borrador que el doctor está mirando**,
igual que el flujo de nueva consulta. La seguridad no la da el card, la dan tres cosas que ya
existen:

1. Lo que escribe el modelo sale **ÁMBAR** — se ve de un vistazo qué tocó.
2. **Nada sale del consultorio** sin que el doctor marque el consentimiento.
3. **Emitir es un acto aparte y explícito**.

⇒ Un card encima de eso es fricción que enseña a hacer clic sin leer.

## 5. El tamaño del prompt — medido, no estimado

Medido sobre el AXA oficial el 2026-08-09:

| | chars | ≈ tokens |
|---|---|---|
| **Esquema COMPLETO (255 campos de texto)** | 12,482 | **≈ 3,566** |
| p1 · 64 campos | | 794 |
| p2 · 17 campos | | 294 |
| p3 · 46 campos | | 904 |
| p4 · 9 campos | | 223 |
| **p5 · 117 campos** | | **1,321** |
| p6 · 2 campos | | 28 |

⚠️ **Un número de tokens sin su modelo al lado es una trampa.** Esto es conteo de caracteres ÷ 3.5
(español), no el tokenizador real; sirve para dimensionar, no para facturar.

**El costo no es el problema.** ~3.5k tokens de esquema + unos minutos de dictado + una plantilla
adjunta ≈ 6–8k tokens de entrada. Es una llamada ordinaria.

**El riesgo es la exactitud sobre un espacio de salida grande**, y hay dos hechos que ayudan:

- **Los 117 campos de la p5 son la tabla de insumos y distribuidores** (`Cantidad`/`Insumo`/`Marca`/
  `RFC`/`Correo` × 15). Nadie dicta renglones de compras. El dictado real vive en las páginas 1–3:
  **≈ 2,000 tokens**.
- **Acotar la llamada a la página que el doctor está viendo** reduce el prompt *y* el espacio de
  campos que el modelo puede llenar mal. Es la palanca de exactitud más barata que hay.

## 6. El flujo

```
1. El doctor abre el informe (el formato real, con lo determinista ya puesto en VERDE)
2. Elige qué adjuntar: esta consulta · otras consultas · recetas   [opcional]
3. Aprieta grabar y dicta mirando la hoja
4. transcribe -> structure(esquema = campos de ESA página/sección + contexto adjunto)
5. El servidor VALIDA las claves contra los campos reales y escribe las que existen
6. Caen en ÁMBAR sobre la hoja. El doctor corrige lo que quiera (pasa a azul cielo)
7. Consentimiento -> emitir
```

## 7. Reglas duras

1. **El servidor valida la salida.** El modelo devuelve `{clave: valor}` y el servidor **descarta y
   reporta** toda clave que no sea un campo real de ese formato. Es regla 0: el veredicto de "este
   campo existe" no se le cree al modelo ([`GENERAL AGENTES`](../AGENTES/GENERAL%20AGENTES)).
2. **Vacío es una respuesta válida.** El prompt **no dice** *calcula*, *deduce* ni *infiere* sobre
   datos clínicos — en este repo eso es deuda de regla 0, invisible hasta que bajas de modelo.
3. **Nunca se inventa un CIE-10, un TNM ni un número de póliza.** Es el peor caso posible de esta
   funcionalidad: un dato falso en un documento médico-legal firmado.
4. **Sólo escribe campos del formato.** No toca el expediente ni inventa campos.
5. **Se registra qué se adjuntó.** El informe es médico-legal: hay que poder reconstruir por qué
   dice lo que dice ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §6).
6. **Lo determinista no se RE-DERIVA con el modelo.** `patient.dateOfBirth` se copia del
   expediente, no se le pide al LLM que lo deduzca del dictado
   ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §3): meter un dato determinista a un
   modelo lo vuelve probabilístico gratis.
   ⚠️ **Esto NO contradice §9.2.** Son dos cosas distintas: el pre-llenado nunca sale del modelo
   (entrada), pero si el doctor **dicta explícitamente** un valor distinto, sí pisa el verde
   (salida) — pasa a ámbar y queda el original para "restaurar del expediente".

## 8. Privacidad — adjuntar a mano es una VENTAJA

Que el doctor **elija** qué consultas y recetas adjuntar no es sólo UX: es **minimización de datos**
bajo la LFPDPPP. Mandar el expediente completo a un tercero para llenar una hoja sería mandar
mucho más de lo necesario. El usuario propuso la selección explícita, y además de dar mejor
contexto, reduce la superficie.

⚠️ Los datos van a un proveedor externo (`LLM_PROVIDER`, hoy OpenAI). Eso ya pasa hoy en el flujo de
voz de consultas, pero **para el informe conviene decirlo en el aviso de privacidad**, porque el
propósito es distinto: transferencia a una aseguradora.

## 9. Las cuatro decisiones — RESUELTAS con el usuario (2026-08-09)

### 1. El dictado se acota **POR PÁGINA**

Un micrófono en cada página, para que **el alcance se VEA y no se adivine**:

```
┌─ Página 3 ──────────────────── 🎤 Dictar esta página · 46 campos ─┐
│  [la hoja de AXA con sus cajas]                                   │
└───────────────────────────────────────────────────────────────────┘
```

- Mientras graba, **esa** página se resalta y las demás se atenúan.
- Al terminar: las cajas llenadas se ponen **ámbar** y la página dice *"8 campos llenados"*.
- Salida de emergencia: **"Dictar toda la hoja"**. A ~3.5k tokens el formato completo es asequible;
  por página es por **exactitud**, no por costo.

> 🔴 **Por qué el alcance tiene que ser VISIBLE:** si no, el doctor dicta el informe entero mirando
> la página 1, la mayor parte no aterriza en ningún lado y la pantalla se ve como si hubiera
> funcionado. Es el mismo modo de falla que los campos azules pero no editables: un resultado
> convincente que se tragó lo que el usuario dio. ⇒ También hay que **reportar lo que NO se pudo
> colocar**, no sólo lo que se llenó.

### 2. El LLM puede sobrescribir **CUALQUIER** campo, incluido el verde

Decidido: sin restricción. El valor pasa a **ámbar**, así que el cambio se ve.

⚠️ **Con una salvaguarda que lo hace seguro:** se **conserva el valor determinista original**, para
que el campo pueda ofrecer *"restaurar del expediente"*. Sin eso, un dictado desviado pisa un dato
bueno del expediente y no hay vuelta atrás. Es barato y encaja en el modelo de procedencia que ya
existe.

### 3. La transcripción **NO se guarda**

Minimización de datos: una vez que el documento está bien, el audio y su texto no aportan.

ℹ️ **Es consistente con lo que ya hace la plataforma**: verificado el 2026-08-09 — no hay tabla de
transcripciones en el esquema y `/api/voice/transcribe` sólo llama al proveedor y devuelve. No se
está inventando una postura nueva.

⚠️ El costo: [`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §6 pide poder reconstruir por
qué el documento dice lo que dice. Queda la procedencia **por campo** (`origin: voice`), no el
dictado crudo. Se acepta el intercambio.

### 4. Un segundo dictado **ACUMULA** — merge que IGNORA los nulos

El usuario lo intuyó bien (*"that might create some issues"*). Son tres, y las tres tienen regla:

1. **No se puede BORRAR por voz.** Si los nulos se ignoran, *"quita el diagnóstico"* no vacía nada.
   La alternativa —que los nulos pisen— sería peor: cada dictado borraría todo lo que no mencionó.
   ⇒ **Regla: para vaciar un campo, se vacía a mano.**
2. **Acumular + poder pisar cualquier campo (§9.2) deja que un dictado desviado arruine datos
   buenos.** Lo acotan el alcance por página, el ámbar, y el "restaurar del expediente" de §9.2.
3. **Cada dictado es INDEPENDIENTE.** Como no se guarda la transcripción (§9.3), el dictado #2 ve
   los valores ACTUALES de los campos y el audio nuevo — nunca el audio anterior. Evita que la
   deriva se acumule y es más fácil de razonar.

Corregir funciona natural: *"no, el diagnóstico es neumonía"* pisa el valor anterior; lo que no se
mencionó se queda como estaba.

## 9b. Editar por voz — qué se puede y qué no

Se dicta **las veces que haga falta**. Volver a dictar un campo **reemplaza** su valor: eso ES
editar por voz y funciona. Lo único que la voz no puede hacer es **vaciar**.

| | |
|---|---|
| Volver a dictar con otro valor | ✅ pisa el anterior |
| Agregar campos que no se habían mencionado | ✅ se acumulan |
| **Dejar un campo en blanco** | ❌ a mano (§9.4) |

## 10. 🔴 HUECOS detectados al revisar el plan (2026-08-09)

Revisión pedida por el usuario. Los dos primeros **los agrava la voz en particular** y hay que
resolverlos ANTES de construir el dictado.

### 10.1 🔴 WinAnsi: el dictado hace probables los caracteres que NO se imprimen

`render-pdf` **omite el campo entero** si trae un carácter que la fuente del formato no codifica
(`winansi.ts`, medido): `HCG-β` · `≥ 3 días` · `mejoría → alta` · `T ≈ 38°`.

Tecleando eso es raro. **Dictando no:** decir *"mayor o igual a tres días"* y que el transcriptor
escriba `≥` es el caso normal, no el borde. Hoy ese campo **no sale en el PDF** y sólo se cuenta en
`problemas`, que **ninguna UI enseña** ⇒ el doctor emite un informe con un campo faltante y sin
señal.

⇒ **Dos arreglos, los dos baratos:**
1. El prompt pide símbolos **en palabras** (`mayor o igual a`, `beta`, `aproximadamente`).
2. El visor avisa **al escribir**, con `caracteresNoImprimibles()` que ya existe: *"quita el `≥`,
   este formato no lo puede imprimir"*.

### 10.2 🔴 El texto largo no cabe, y no hay auto-ajuste

`setText()` se llama sin `setFontSize` ni control de largo.
[`02-PLAN`](02-PLAN-el-formato-y-los-pasos.md) §7 prometía *"auto-ajuste de tamaño, nunca recorte
silencioso"* y **nunca se implementó**. Tecleando salen entradas cortas; **dictando salen párrafos**,
y hay campos de 43 pt de ancho (`Edad`). ⇒ Hace falta auto-ajuste o un aviso de "no cabe" — nunca
un recorte callado.

### 10.3 Carrera: teclear mientras el dictado se procesa

El doctor dicta, y mientras el LLM piensa se pone a teclear en un campo. Cuando llega el merge, le
pisa lo que escribió. ⇒ Regla: **el resultado del dictado NO pisa campos editados a mano después de
que empezó la grabación**.

### 10.4 Las casillas: el doctor va a esperar que se marquen

Decir *"el procedimiento es en hospital"* y que la casilla no se mueva es una sorpresa razonable.
Las casillas quedan fuera del dictado v1 (§11) — pero **la UI tiene que decirlo**, en vez de dejar
que el doctor lo descubra revisando el PDF.

### 10.5 Informe ya emitido

El micrófono no debe existir si `status === 'issued'`. El PATCH ya contesta 409, pero ofrecer el
botón es invitar al error.

### 10.6 Tiers y permisos de usuario secundario — sin decidir

Las rutas del informe cuelgan de `/api/medical-records/*`, así que **heredan el permiso
`expedientes`**: un usuario secundario con ese toggle puede generar informes y dictarlos. ¿Es lo
que se quiere? ¿Y el dictado está disponible en tier **CORE** o sólo en FULL? Ninguna de las dos
está resuelta ([`../TIERS`](../TIERS)).

### 10.7 Un fallo del LLM pierde el dictado

Como no se guarda la transcripción (§9.3), un 500 obliga a volver a dictar todo. ⇒ Conservar la
transcripción **en memoria del cliente** durante la sesión, para poder reintentar sin regrabar.
(No es persistirla: al recargar se va, que es justo lo que §9.3 pide.)

### 10.8 Costo por doctor

`/api/voice/structure` ya llama a `logTokenUsage`. El dictado del informe **debe reusarlo**, o el
gasto de esta funcionalidad queda invisible en los reportes de consumo.

### 10.9 `sessionType` nuevo

`/api/voice/structure` despacha por `VoiceSessionType`. El informe necesita su propio tipo; no se
puede colgar del de consultas porque el esquema de salida es otro.

### ✅ Y un hueco que se resuelve solo

§9.2 dice "conservar el valor determinista original para restaurar", sin decir **dónde**. No hace
falta guardarlo: **`construirPrefillDeterminista()` es una función PURA**, así que restaurar es
volver a correrla y tomar ese campo. Cero almacenamiento nuevo.

## 11. Lo que NO resuelve

- **Los campos que nadie puede saber** siguen vacíos si el doctor no los dicta. El LLM no los
  inventa: ése es el punto.
- **Las casillas** (22 campos / 49 recuadros en AXA, grupos excluyentes) no entran en v1 del
  dictado: primero texto.
- **GNP** sigue bloqueado por la pregunta abierta #0 — cuál formato rige.
