# 07 — PLAN: el informe se hace a nivel PACIENTE, con fuentes elegidas

> Tipo **PLAN**. Escrito el **2026-08-10**.
> 🟢 **IMPLEMENTADO Y EN PROD el 2026-08-11** (`64dad1a0`, deploy SUCCESS). Ver §12.
> Sucede a [`06-AGENTE`](06-AGENTE-conversar-con-el-formato.md), que ya funciona: el chat
> coloca valores sobre la hoja. Esto amplía **de dónde saca la información**.
>
> 🔴 **Nadie lo ha probado a mano todavía.** Type-check, gates, una llamada real al modelo
> y verificación read-only contra prod no son un clic.

## 1. De dónde sale la idea

El usuario, después de probar el chat con una plantilla propia:

> *"...no creamos el informe por plantilla o consulta, sino a nivel PACIENTE, y el doctor puede
> ver un desplegable con las notas o recetas por fecha y marcar las que necesita. Y en orden
> cronológico esas notas/recetas/plantillas se le inyectan al LLM para que las digiera como
> mensajes."*

Y la observación que lo hace obvio: **`customData` ya se le entrega al modelo como un bloque de
texto etiquetado** — digerido igual que un mensaje dictado. Si eso ya funciona para una consulta,
funciona para cualquier cosa del expediente.

## 2. 🔴 La decisión: hay una consulta ANCLA

**Decidido por el usuario (2026-08-10):**

> *"Debe ser a nivel paciente, pero tiene que venir de una consulta o una consulta previa. Y esa
> consulta debe ser como la capa de información OG, y las otras se pueden seleccionar desde ahí."*

| | Qué es | Qué aporta | Color |
|---|---|---|---|
| **La consulta ANCLA** | el episodio del que trata el informe | el **pre-llenado determinista**: fecha, motivo, los 7 signos vitales, SOAP | 🟩 verde |
| **Las fuentes elegidas** | otras consultas · notas · recetas | contexto que el **CHAT** interpreta y coloca | 🟧 ámbar |

### Por qué el ancla no se puede quitar

1. **El formato pregunta por un EPISODIO.** AXA pide *fecha de padecimiento*, *fecha de
   diagnóstico*, *fecha de cirugía*. Un informe "del paciente en general" no tiene esas fechas.
2. **Sin ancla no hay nada verde.** El pre-llenado determinista copia de columnas fijas de UNA
   consulta. Sin ella, la hoja entera nace ámbar — todo escrito por un modelo en un documento
   médico-legal. Es un retroceso, no una mejora.
3. **La procedencia.** `encounter_id` es lo que contesta *por qué este documento dice lo que
   dice* ([`01-FUENTES`](01-FUENTES-de-donde-sale-cada-campo.md) §6), y por eso su FK es
   `RESTRICT`: no se puede borrar la consulta que sostiene un informe emitido.

🔴 **Invariante que esto conserva, y que vale la pena escribir:**
**verde = copiado literal del ancla. Todo lo que venga de otra fuente es ámbar.** El color sigue
significando lo mismo que hoy, y el doctor sigue sabiendo dónde leer con cuidado.

## 3. Lo que YA existe (más de lo que parece)

| Pieza | Estado |
|---|---|
| `customData` → texto con las etiquetas de su plantilla | ✅ `contexto-clinico.ts` |
| El chat acepta `adjuntarEncounterIds` (hasta 5, con `where` de paciente+doctor) | ✅ **ya está, sin UI** |
| `medical_reports.encounter_id` **nullable** | ✅ sin migración |
| Orden cronológico de las consultas | ✅ `orderBy: encounterDate desc` |

⇒ Lo que falta es: **la UI del selector**, **notas y recetas como fuentes**, y **el punto de
entrada a nivel paciente**.

## 4. Las fuentes

Las tres viven en `medical_records` y **todas se filtran por `patientId` + `doctorId`** en el
`where`, nunca por los ids que mande el cliente.

| Fuente | Modelo | Qué se le manda al modelo |
|---|---|---|
| **Consulta** | `ClinicalEncounter` | motivo · SOAP · vitales · `customData` con las etiquetas de `EncounterTemplate.customFields` |
| **Nota** | `PatientNote` | `content` (texto libre) + su fecha |
| **Receta** | `Prescription` | diagnóstico · notas · medicamentos (`PrescriptionMedication`) · `customData` con las etiquetas de su plantilla |

🔴 **Sólo recetas `issued` y `expired`.** Una receta en `draft` **no fue** el tratamiento del
paciente, y declararla a la aseguradora es afirmar algo falso. Ya es la regla del pre-llenado
(hallazgo del review del paso 5) y se hereda tal cual. La vencida sí cuenta: fue tratamiento, que
hoy esté vencida no la borra de la historia.

> ⚠️ **CORRECCIÓN (2026-08-11), y no es menor.** `status = 'expired'` **no lo escribe nadie**:
> comprobado contra prod, hay 36 `issued`, 3 `cancelled`, 2 `draft` y **cero** `expired`. La
> vigencia vive en la columna **`expires_at`**, no en el status. Esta regla filtra bien lo que NO
> debe entrar (borradores y canceladas) pero **no dice nada sobre la vigencia**, que era la mitad
> de su intención.
>
> Lo destapó el usuario mirando la pantalla: *"me ofrece 3 recetas y en el ledger veo 2"*
> (Carmen Ruiz Ortega). El **ledger** las esconde por defecto cuando `expiresAt` ya pasó
> (`includeExpired`); el panel de fuentes las ofrecía. Las dos pantallas daban números distintos
> sin explicación.
>
> **Cómo quedó:** la vencida **se sigue ofreciendo** —§4 sigue en pie— pero **se dice que lo
> está**, en los dos lados: chip ámbar *"vencida el dd/mm/aaaa — el ledger de recetas no la
> enseña"* en el panel, y una primera línea `Vigencia: VENCIDA el dd/mm/aaaa (fue tratamiento, no
> es el actual)` en el texto que lee el modelo, para que no la presente como el tratamiento
> vigente. La comprobación vive en `recetaVencida()`, una sola función para las dos superficies.
>
> 🔎 **Lección:** una regla escrita con el vocabulario equivocado se implementa fielmente y aun
> así no hace lo que dice. Los 5 gates, el type-check y una llamada real al modelo estaban en
> verde; lo encontró alguien contando filas en dos pantallas.

## 5. Procedencia: una FK no alcanza para N fuentes

Hoy `encounter_id` (FK, `RESTRICT`, `DEFERRABLE`) sostiene la trazabilidad. Con varias fuentes
hace falta guardar **cuáles se usaron**, y hay una decisión de fondo:

- **El ANCLA conserva su FK y su `RESTRICT`.** Es el sostén legal del documento: no se borra la
  consulta de la que salió un informe emitido.
- **Las demás fuentes se guardan como INSTANTÁNEA**, no como FKs:
  `sources: [{ tipo, id, fecha, actualizadoEn }]` en una columna JSONB nueva.

**Por qué instantánea y no FK:**
- Poner `RESTRICT` sobre notas y recetas volvería **imborrable medio expediente** en cuanto se
  usaran en un informe.
- Y para auditar, lo que interesa es *qué se consultó*, no *que siga existiendo*. Una referencia
  que sobrevive al borrado es **mejor** registro que una FK que impide borrar.
- Se guarda `actualizadoEn` a propósito: si una nota se edita después, el id solo no dice que el
  modelo vio otra cosa. Con la fecha de actualización, la deriva se detecta.

⚠️ **No se copia el contenido clínico dentro de `sources`.** Duplicar PHI para auditar es crear un
segundo expediente que nadie mantiene ni borra.

## 6. El presupuesto del prompt (y por qué no es un detalle)

El prompt de sistema ya pesa **~5,300 tokens** (catálogo de 255 campos + 13 grupos de casillas).
Cinco consultas con notas y recetas pueden duplicarlo o triplicarlo.

- **Tope explícito** para el bloque de fuentes (arranque propuesto: ~6,000 tokens ≈ 24 KB).
- **Orden cronológico** — lo pidió el usuario y además ayuda: el modelo lee una historia, no un
  montón.
- 🔴 **Lo que no cabe se DICE.** *"Entraron 3 de las 5 fuentes que elegiste; las otras 2 no
  caben."* Nunca en silencio: en este repo **ya hubo un incidente por TAMAÑO de payload**
  (cap de 8 KB), y un recorte callado es indistinguible de "el modelo lo ignoró".

## 7. El flujo

```
/dashboard/medical-records/patients/[id]/informe          ← NUEVO, nivel paciente
   1. elegir la CONSULTA ANCLA   (lista por fecha)
   2. elegir el FORMATO
   3. pre-llenado determinista desde el ancla             → 🟩 verde
   4. panel FUENTES: consultas · notas · recetas por fecha, con casillas
   5. conversar → lo elegido se le inyecta al chat        → 🟧 ámbar
   6. revisar sobre la hoja · Guardar · consentimiento · emitir
```

**El punto de entrada de hoy no se rompe:** desde una consulta se sigue pudiendo crear el informe;
esa consulta entra directamente como ancla, sin preguntar. Es un atajo del mismo flujo.

## 8. Lo que NO cambia

- El chat sigue **proponiendo**, no escribiendo: pendientes → Guardar (1B).
- Las casillas de consentimiento y facturación siguen **fuera del alcance del agente**
  (`casillasParaElAgente`).
- El pre-llenado determinista **sólo lee el ancla**. Nada de otras fuentes entra en verde, y
  `customData` sigue sin mapearse a campos automáticamente ([`04-MAPEO`](04-MAPEO-expediente-a-formato.md) §3).
- La minimización de datos: **nada se adjunta solo**. Que el doctor elija es exactamente lo que
  [`06-AGENTE`](06-AGENTE-conversar-con-el-formato.md) §7.3 llama minimización, así que el
  selector no relaja la regla — la aplica.

## 9. El costo, honesto

| | |
|---|---|
| Columna `sources` JSONB | SQL manual + `prisma db execute` (nunca `db push`) |
| `contexto-clinico.ts` → 3 tipos de fuente con forma común y orden cronológico | medio |
| Presupuesto de tokens + reporte de lo que no cupo | chico, pero **no opcional** |
| Endpoint de fuentes disponibles (`GET …/patients/:id/fuentes`) | chico |
| Pantalla nivel paciente + selector de ancla | medio |
| Panel de fuentes dentro del informe | medio |

## 10. ~~Abierto~~ — CERRADO por el usuario (2026-08-10)

| # | Pregunta | Decisión |
|---|---|---|
| 1 | ¿El selector arranca vacío o propone algo? | **VACÍO.** Nada se adjunta solo: minimización de datos, y el doctor elige a propósito |
| 2 | ¿`PatientMedia` entra como fuente? | **NO.** No se puede leer el contenido de un estudio; "existe un estudio del 3/3" no aporta nada al formato |
| 3 | ¿Se puede cambiar el ancla después? | **NO.** Cambiarla invalidaría el pre-llenado verde ya revisado. Se genera un informe nuevo |
| 4 | ¿`PatientSummary` como fuente? | **NO.** Es IA sobre IA: el modelo interpretaría un texto que ya interpretó otro modelo, y la procedencia deja de significar nada |

## 11. 🔴 EL PAYLOAD: qué se hace de verdad

El usuario preguntó si conviene preocuparse por el tamaño. Hay que separar tres cosas que suelen
confundirse:

| | Situación |
|---|---|
| **¿Límite técnico?** | **No.** gpt-4o admite 128k de contexto. Medido hoy: el prompt real son **6,645 tokens**. Con 5 fuentes se iría a ~9–13k. Está lejísimos del techo |
| **¿Costo?** | **Modesto.** A $2.50/1M de entrada, 12k tokens ≈ **$0.03 por turno**; una conversación de 15 turnos ≈ $0.45 por informe. Contra lo que vale el informe, no es el problema |
| **¿Calidad?** | 🔴 **AQUÍ SÍ.** Un prompt más largo diluye la atención: el modelo elige peor entre 255 campos cuando además arrastra 8k tokens de historia clínica. **Esto no está medido** |

⚠️ **Y una precisión, para no arrastrar un susto equivocado:** el incidente de los **8 KB** de este
repo fue el cap del *payload de un card del asistente*, **no** el contexto de un LLM. No aplica
aquí. Citarlo como si aplicara sería justificar una decisión con un hecho falso.

### Qué se hace

1. **Presupuesto explícito** para el bloque de fuentes (~6,000 tokens).
2. 🔴 **Si no cabe, NO se recorta solo: se le dice al doctor que deseleccione.** Él eligió esas
   fuentes a propósito; quitarle una en silencio —o media— es deshacer su decisión sin avisar. El
   mensaje es *"lo que elegiste no cabe: quita una consulta o una receta"*, no un recorte callado.
   (Es la misma regla que ya rige para las fechas que no caben en su campo: se omite y se REPORTA,
   nunca se trunca.)
3. **El catálogo de campos NO se recorta** aunque se pudiera. Se manda idéntico cada turno a
   propósito, para que el proveedor cachee el prefijo: recortarlo a "sólo los campos vacíos"
   ahorraría ~1.5k tokens y **tiraría la caché de 4.7k**. Sale peor.
4. **Antes de optimizar, MEDIR.** La pregunta abierta es de calidad, no de tamaño: correr el mismo
   mensaje con y sin fuentes y comparar si el modelo sigue eligiendo bien el campo. Se puede hacer
   con llamadas reales — es lo que destapó el bug del prefijo `campo:`.

> 🔎 **Lección de método:** "el payload es grande" no es un diagnóstico. Grande **¿comparado con
> qué?** Contra el límite técnico no es nada; contra el costo es barato; contra la atención del
> modelo puede ser mucho — y es lo único de los tres que no sabemos.

## 12. 🟢 Cómo quedó (2026-08-11, `64dad1a0`)

| Pieza | Dónde |
|---|---|
| Columna `sources` JSONB | `migrations/add-informe-medico-sources.sql` — **aplicada a prod ANTES del push** |
| Los 3 tipos de fuente + presupuesto | `lib/informe-medico/contexto-clinico.ts` |
| Catálogo de lo elegible | `GET /api/medical-records/patients/:id/fuentes` |
| Pantalla compartida por las dos puertas | `components/informe-medico/PantallaInforme.tsx` |
| El panel de casillas | `components/informe-medico/PanelFuentes.tsx` |
| Entrada a nivel paciente | `/dashboard/medical-records/patients/[id]/informe` |

### Lo que se MIDIÓ con una llamada real a gpt-4o

Mismo mensaje, datos inventados, temperatura 0, **una corrida por condición**:

| | campos colocados | descartados | tokens de entrada |
|---|---|---|---|
| Sin fuentes | 2 | 0 | 6,737 |
| Con fuentes | **6** | 0 | 6,961 |

- El modelo **sí lee** el bloque de fuentes: los 4 campos de más salieron todos de ahí.
- **No se perdió ninguno.** La dilución de atención que temía §11 no se observó a este tamaño
  (+224 tokens). ⚠️ Una corrida no distingue una regresión del ruido: es evidencia direccional,
  no una medición.
- `cached_tokens: 6528` en la segunda llamada ⇒ **el prefijo estable SÍ se cachea**. Es la
  primera vez que se comprueba lo que `prompt-chat.ts` afirma en su encabezado.
- 🔴 El modelo **dedujo** la fecha de diagnóstico de la fecha de la consulta. El expediente no
  la decía. Cae en ámbar —el guardarraíl funciona— pero las fuentes lo vuelven más útil **y**
  más dispuesto a rellenar una fecha que nadie escribió.

### Decisiones que cambiaron durante la implementación

1. **Una fuente ilegible NO tumba el guardado.** Rechazar el `PATCH` entero dejaba el informe
   atorado para siempre: el id fantasma seguía en la columna, viajaba en cada guardado, y el
   panel —que se pintaba del catálogo vivo— no tenía casilla que desmarcar. Ahora se descarta,
   se REPORTA, y las huérfanas se pintan en rojo con su casilla para quitarlas.
2. **Un solo camino de resolución.** `resolverFuentesElegidas` usa `fuentesParaModelo`, el mismo
   que el chat. Antes releía el expediente ENTERO del paciente en cada clic de una casilla, y
   eran dos copias de "qué cuenta como fuente válida" que podían divergir.
3. **Las fuentes se guardan al marcarlas**, en contra de la regla 1B del resto de la pantalla:
   el chat las lee de la BASE, así que una marcada-y-no-guardada sería una que el doctor cree
   que el asistente lee y no.
