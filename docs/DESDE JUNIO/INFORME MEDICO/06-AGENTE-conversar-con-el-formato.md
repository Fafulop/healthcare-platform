# 06 — AGENTE: el doctor CONVERSA con el formato

> Tipo **PLAN**. Escrito el **2026-08-09**. Nada implementado.
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

## 5. Las tools (borrador)

| Tool | Tipo | Qué hace |
|---|---|---|
| `get_campos_informe` | lectura | Los campos del formato: cuáles están llenos, cuáles vacíos, de dónde salió cada valor. Acotable por página. **Es el "enseñar la lista" del punto 3 del usuario.** |
| `get_contexto_informe` | lectura | Qué consultas y recetas tiene ese paciente, para que el agente ofrezca adjuntarlas |
| `propose_llenar_informe` | **propuesta** | Devuelve `{campo, etiqueta, valorPropuesto, deDónde}`. El cliente los pinta **PENDIENTES sobre la hoja**; el `PATCH` sale sólo al Guardar |

🔴 **El servidor del agente jamás muta el informe.** El `PATCH` lo dispara el cliente cuando el
doctor guarda, contra el endpoint que ya existe.

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
- **Los 255 campos no caben en el prompt.** Van por tool, acotados por página, como en
  [`05-VOZ`](05-VOZ-el-doctor-le-dicta-al-formato.md) §5.

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
| 5 | **Con el estado pendiente, ¿qué pasa con el tecleo MANUAL?** ¿Sigue guardando al salir del campo (y conviven dos modelos), o TODO queda pendiente hasta Guardar? Lo segundo es más coherente pero cambia lo que ya está en prod y probado |
| 6 | ¿Guardar aplica **todo** lo pendiente o se puede descartar campo por campo? |
