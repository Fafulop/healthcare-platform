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

## 4. La decisión de arquitectura: un MÓDULO, no otro agente

`08-EMPIEZA-AQUI` §1: *"un solo agente conversacional que crece por módulos de dominio — no son
varios agentes que se hablan entre sí, esa decisión está tomada y no se re-litiga"*.

⇒ **`informe` es el sexto módulo** (junto a agenda · expediente · flujo · facturas · fiscal), con
su entrada en `AGENT_MODULE_REQUIREMENTS`. Requiere `expedientes`, igual que el informe mismo.

**Pero se abre DENTRO de la pantalla del informe**, con el `reportId` ya sembrado. No es otro
agente: es el mismo, con contexto. El panel global no sabe qué hoja estás viendo, y ese contexto
es justamente lo que hace útil la conversación.

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

## 7. 🔴 EL CONFLICTO QUE HAY QUE RESOLVER: el privacy tier

`modules/expediente.ts` lleva una decisión explícita y marcada como no re-litigable:

> El asistente devuelve **SOLO metadatos** (conteos, fechas, tipos, estatus) y datos
> administrativos. **El CONTENIDO clínico — SOAP, `chiefComplaint`, `clinicalNotes`, diagnóstico,
> vitales — NUNCA aparece en ningún select de ese archivo.**

**El informe médico es contenido clínico de principio a fin.** Un módulo `informe` que lea
diagnósticos y los proponga rompe esa regla de frente.

**No es una contradicción tonta:** la regla nació para que el asistente *general* —al que se le
pregunta "¿cuántos pacientes activos tengo?"— no acabe recitando diagnósticos en un panel lateral.
El informe es otro contexto: el doctor **ya está mirando** ese expediente, en una pantalla dedicada,
para mandarlo a una aseguradora.

⇒ **Hace falta una excepción EXPLÍCITA y AUDITADA**, no una que se cuele:

| Opción | Qué implica |
|---|---|
| **A. Excepción acotada al módulo `informe`** | El módulo lee clínico **sólo del `encounterId` ligado a ESE informe**, y sólo cuando hay un informe abierto. El asistente general sigue sin ver nada. Hay que escribirlo en `02-CAPACIDADES` y en el privacy tier |
| **B. El clínico no pasa por el agente** | El agente sólo conversa y propone; los valores los saca el pre-llenado determinista y el doctor dicta el resto. Respeta la regla pero pierde el punto 3 de §6 |
| **C. Re-litigar el privacy tier** | El más caro y el que más cosas mueve. **No recomendado** |

### ✅ DECIDIDO: opción A (usuario, 2026-08-09)

El módulo `informe` **sí lee contenido clínico**, con estos límites:

1. **Sólo del `encounterId` ligado a ESE informe.** No es una llave al expediente entero.
2. **Sólo cuando hay un informe abierto** — el `reportId` es obligatorio en toda tool del módulo.
3. **El asistente general no cambia.** `modules/expediente.ts` sigue devolviendo sólo metadatos.

🔴 **Obligación que crea esta decisión** (y que no se cumple escribiéndola sólo aquí): cuando el
módulo se construya, la excepción tiene que quedar escrita **en la carpeta de AGENTES**, no en esta:

- `AGENTES/GENERAL AGENTES/02-CAPACIDADES` — la matriz y §4, con el módulo y sus tools.
- **El comentario de privacy tier de `modules/expediente.ts`** — ahí es donde alguien va a leer
  "el contenido clínico NUNCA sale" y necesita ver, en el mismo lugar, que hay UNA excepción
  acotada y por qué.
- `AGENTE EXPEDIENTE/SESSION-REFRESCO.md` — el estado vivo del dominio.

⚠️ **Todavía NO se escribe nada de eso:** `02-CAPACIDADES` describe lo que existe HOY, y el módulo
no existe. Escribirlo antes sería documentar algo falso — el error exacto que
[`08-EMPIEZA-AQUI`](../AGENTES/GENERAL%20AGENTES/08-EMPIEZA-AQUI.md) §3 previene. Va **junto** con
el código, no antes.

## 8. El costo, honesto

- **Un módulo nuevo** = tools + entrada en `AGENT_MODULE_REQUIREMENTS` + `02-CAPACIDADES` (matriz y
  §4) + `00-BLUEPRINT` §1 + el `SESSION-REFRESCO` del dominio ([`07-CONVENCIONES`](../AGENTES/GENERAL%20AGENTES/07-CONVENCIONES-docs.md) §5).
- **Evals.** La suite tiene 87 casos y un módulo nuevo pide los suyos. Sin evals, el módulo se
  degrada en silencio en cuanto alguien toque el prompt.
- **El prompt crece.** Hoy son 5 módulos; el sexto suma tools y descripciones a *cada* turno del
  asistente, no sólo a los del informe. Hay que medir el efecto en los otros módulos.
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
