# 🔬 EVIDENCIA — la demo que tardó 4 min 46 s, turno por turno

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día.
>
> **Todo lo que sigue sale de `public.agent_tool_calls` y `public.bookings` en PROD**
> (consulta read-only 2026-08-05, método
> [`../AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`](../AGENTE%20AGENDA/TOOLING-acceso-railway-db-agenda.md)).
> **No hay nada reconstruido de memoria.** Lo único inferido está marcado ⚠️ INFERIDO.
>
> Es la primera vez que la traza de tools (bitácora **#32**, en prod desde el 2026-07-31)
> sirve para lo que se construyó: **replayar un fallo en vivo** en lugar de teorizar sobre él.

---

## 1. El contexto

Una demo con una doctora real el **2026-08-03**, entre las 23:34 y las 23:58 UTC
(≈17:34–17:58 hora de México). Doctor `cmr46vwnq0041ms11tkl13glm` — **no es `dr-prueba`**, y
ese detalle resultó ser la mitad de la explicación (§4).

Reporte del usuario, antes de mirar la traza:

> *«El agente simplemente no podía crear una cita. Tardó muchísimo porque la doctora le decía
> algo y el agente volvía con otra pregunta. Nunca contestó mal — pero algo que a mano toma
> cinco segundos le tomó como un minuto de ida y vuelta.»*

La traza confirma el fenómeno y **corrige la magnitud**: no fue un minuto, fueron **4 min 46 s**
y **7 turnos** sólo para la cita final.

## 2. La reconstrucción

Estado de la traza al momento de la consulta: **29 filas · 20 turnos · 2 doctores**, del
2026-07-31 20:16 al 2026-08-03 23:58.

| Hora UTC | Turno | Tools (en orden) | Qué devolvió |
|---|---|---|---|
| 23:34:57 | `378956ac` | `propose_create_range` ×2 | rangos 04-ago y 06-ago, 09:30–14:30 |
| 23:39:59 | `8640a524` | `get_bookings` 10→16 ago | `totalEncontradas: 0` |
| 23:45:18 | `1b0cf73a` | `propose_create_range` | 05-ago 09:30–14:30 |
| 23:46:56 | `e87de66f` | `propose_create_range` | 05-ago otra vez, ahora `intervalMinutes: 15` |
| 23:50:31 | `38318fb7` | `get_day_schedule` 04-ago | 1 cita, 1 rango |
| 23:50:44 | `c808caae` | `get_bookings` → `propose_cancel_booking` | cancela la cita de prueba |
| **23:53:48** | `318a10cc` | `find_patient` → `get_availability` | **0 expedientes · `fechasDisponibles: 0`** |
| 23:54:56 | `9a2f6b7b` | `propose_create_range` | **11-ago 09:30–15:30** ← *para poder agendar* |
| 23:56:32 | `3661c2aa` | `find_patient` | 0 expedientes (otra vez) |
| 23:56:45 | `a8935c10` | `get_services` | 2 servicios — **y pregunta, no propone** |
| 23:57:07 | `1bc6e01d` | `get_services` | 2 servicios — **pregunta otra vez** |
| 23:57:33 | `b2250734` | `get_services` → `propose_create_booking` | **`{"error": …}`** (114 chars) |
| 23:58:23 | `e99e6956` | `get_services` → `propose_create_booking` | propuesta OK → card |
| **23:58:34** | — | *(el doctor confirma la card)* | **cita creada** |

**Del primer intento de agendar (23:53:48) a la cita creada (23:58:34): 4 min 46 s · 7 turnos ·
`get_services` llamado 4 veces** para los mismos 2 servicios.

## 3. Las cuatro causas, cada una con su evidencia

### 3.1 Los campos de contacto obligatorios cuestan un turno entero — y se falsean

Los dos `propose_create_booking` son idénticos salvo por un campo:

```
23:57:33  { date, serviceId, startTime, isFirstTime, patientName,
            patientEmail, patientPhone, appointmentMode }          → error
23:58:23  { ...lo mismo..., patientWhatsapp }                      → propuesta OK
```

El doctor de la demo tiene los **nueve** toggles de contacto en `true`. La falta de
`patientWhatsapp` quemó un turno completo.

⚠️ **Y lo más revelador no pasó por el agente.** Otra cita de ese mismo doctor, creada a las
23:39:11 **desde la UI**:

```
patient_name      : "juan perez"
patient_phone     : "."
patient_whatsapp  : "."
patient_email     : "dra.mayraloza@gmail.com"   ← el correo de la propia doctora
```

Puntos, y su propio correo. **La barrera no es del agente: la doctora ya la estaba saltando en
el picker.** Consecuencia de diseño — relajar sólo el agente le daría una capacidad que la UI
no tiene, justo lo que **CIT-6** prohíbe (`../AGENTE AGENDA/SESSION-REFRESCO.md`, Decisiones).
El arreglo tiene que vivir en la configuración/endpoint, donde alcanza a las dos superficies.

### 3.2 Exigir un rango costó dos turnos y dejó basura en prod

`get_availability` para el 11-ago devolvió `fechasDisponibles: 0` — **correcto**: ese día no
tenía ningún rango publicado. Pero con eso la única salida fue que el agente **creara un rango**
(23:54:56, 09:30–15:30) cuyo único propósito era desbloquear una cita a las 14:30.

**El picker del doctor habría tomado las 14:30 directo desde `480f7f72`.** Es exactamente la
incoherencia de [`../../CITAS/SESSION-REFRESCO.md`](../../CITAS/SESSION-REFRESCO.md) §9,
capturada en el acto. El rango del 11-ago sigue en prod y no responde a ninguna intención real
de la doctora.

### 3.3 El agente pregunta en vez de actuar

Los turnos `a8935c10` (23:56:45) y `1bc6e01d` (23:57:07) llamaron `get_services` y **se
detuvieron a preguntar**. Dos turnos, cero propuestas, ningún dato nuevo que no cupiera en una
sola pregunta del primer turno.

⚠️ INFERIDO: la traza guarda tools, no el texto. Que cada turno corresponda a un mensaje de la
doctora es inferencia — sólida (un turno = una invocación del endpoint) pero inferencia. **El
contenido exacto de las preguntas no está registrado en ningún lado.**

### 3.4 Nada sobrevive de un turno al siguiente

`get_services` cuatro veces seguidas para los mismos dos servicios. El historial de la
conversación sí viaja, pero el modelo re-consulta igual. Cada respuesta de la doctora reinicia
la recolección.

## 4. Por qué la suite de 84 casos no puede ver nada de esto

| Doctor | Los 9 toggles de contacto |
|---|---|
| `dr-prueba` (fixture de los evals) | **todos `false`** |
| El doctor de la demo | **todos `true`** |

**Los evals corren contra el único doctor donde la barrera está apagada.** El camino de
"faltan campos de contacto" no es flaky ni intermitente: es **inalcanzable** para la suite.

Se suma al punto ciego ya documentado (`../AGENTE AGENDA/SESSION-REFRESCO.md`, bitácora #32b:
los evals no pasan por `route.ts`). La regla que sale de aquí: **un fixture con la
configuración más permisiva del sistema no prueba el sistema** — prueba el mejor caso.

## 5. Lo que la traza NO dice

Honestidad sobre los límites, para que nadie construya de más sobre este documento:

- **No hay texto de las preguntas ni de las respuestas.** Sabemos qué tools corrieron y qué
  devolvieron en resumen; no sabemos con qué palabras el agente pidió el WhatsApp.
- **`agent_tool_calls` registra la PROPUESTA, no la ejecución.** Que la cita existe se confirmó
  aparte, contra `public.bookings`.
- **Un turno sin tools no deja fila.** Si la doctora y el agente cruzaron mensajes sin invocar
  nada, esos turnos son invisibles aquí — o sea, **7 turnos es un piso, no un techo**.
- **`duration_ms` mide la tool, no el turno.** Los 4 min 46 s salen de los `created_at`, e
  incluyen el tiempo humano de leer y contestar. Es la métrica correcta para "cuánto tardó la
  doctora", no para "cuánto tardó el modelo".

## 6. La conclusión que importa

**El modelo no se equivocó ni una vez.** Ninguna tool falló (`ok = true` en las 29 filas de la
traza), ninguna lista vacía se narró como si fuera otra cosa, ningún horario fue inventado —
justo la conducta que las bitácoras #32 y #33 pelearon.

Lo que costó los minutos fue **arquitectura**: campos obligatorios, un modelo de rangos que ya
no aplica, y una política conversacional que pregunta de a un dato. **Un agente especializado
sólo en citas habría producido esta misma transcripción**, y eso es un dato duro para
[`../GENERAL AGENTES/10-ANALISIS`](../GENERAL%20AGENTES/10-ANALISIS-especializar-agente-por-area.md).

---

*Consultas usadas: `agent_tool_calls` agrupado por `turn_id`; `bookings` por `doctor_id`;
`doctors` para los toggles. Todas SELECT. Creado 2026-08-05.*
