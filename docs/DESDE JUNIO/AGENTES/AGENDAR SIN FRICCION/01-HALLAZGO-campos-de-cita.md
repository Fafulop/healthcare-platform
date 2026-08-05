# 🕳️ HALLAZGO — al agente lo gobierna un botón gris que describe un flujo MUERTO

> **Tipo: DECISIÓN / REFERENCIA.** Se mantiene al día.
>
> Salió de una pregunta del usuario el 2026-08-05: *«¿el botón gris "Campos de Cita" de la
> página de citas lo mira siquiera el agente? Se hizo hace mucho y a lo mejor ya no refleja
> cómo funciona.»* **La sospecha era correcta**, y la forma exacta en que es correcta importa
> más que el hecho.
>
> Verificado contra el CÓDIGO y contra PROD (read-only, 2026-08-05). No deducido.

---

## 1. Qué escribe ese botón

`BookingFieldSettingsModal.tsx` presenta **tres secciones independientes**, cada una con sus
tres toggles (correo · teléfono · WhatsApp):

| Sección en el modal | Columnas | Quién la obedece HOY |
|---|---|---|
| 🌐 **Reserva pública**<br>*"Cuando el paciente agenda desde tu perfil"* | `booking_public_*` | El widget público (`RangeBookingWidget` → `/range-bookings`, sin auth) |
| 📅 **Horarios disponibles**<br>*"Cuando agendas desde un horario existente"* | `booking_horarios_*` | El flujo de **slots legacy** … y **EL AGENTE** |
| ⏰ **Nuevo horario**<br>*"Cuando creas un horario nuevo para el paciente"* | `booking_instant_*` | El **picker del doctor** (`BookPatientModal:603` → `/range-bookings/instant`) |

El agente aparece en la fila de en medio por partida doble: su pre-check lee esas columnas
(`proposals.ts:778-786`) y su ejecutor postea a `/range-bookings`, que para un llamador con rol
DOCTOR lee **las mismas** (`range-bookings/route.ts:101-109`). Hoy son coherentes entre sí.

## 2. El problema: esa sección describe un flujo que ya no existe

*"Cuando agendas desde un horario existente"* es el **modelo de slots**, el de la página v1.
Medido en prod el 2026-08-05:

| | |
|---|---|
| Slots con fecha futura | **0** |
| Fecha del slot más reciente | 2026-06-30 (ya pasó) |
| Slots en total | 1,941 |
| Citas creadas alguna vez contra un slot | 104 |
| **Última cita por slot** | **2026-04-23** — hace ~3½ meses |

En la página de citas actual **no hay forma de llegar a ese flujo**. O sea: de los dos
consumidores de `booking_horarios_*`, uno está muerto y el otro es el asistente.

> 🔑 **El asistente heredó, sin que nadie lo decidiera, la configuración de un flujo retirado —
> y el modal no tiene ninguna sección que diga "asistente".** Un doctor que quiera configurar
> qué le pide el agente no tiene cómo adivinar que el control se llama *"Horarios disponibles"*.

Y la simétrica: *"Nuevo horario · cuando creas un horario nuevo para el paciente"* es hoy la
etiqueta del **único camino vivo por el que un doctor agenda** — el picker. Desde
CITAS `480f7f72` ese picker **no crea ningún horario**: toma una hora escrita. La etiqueta
sigue hablando el idioma de los rangos para algo que ya no los usa.

## 3. Y la división en tres nunca se ha usado

Consulta a los 11 doctores de prod (2026-08-05):

| | |
|---|---|
| Doctores que personalizaron algo | **4** de 11 |
| Doctores cuyas **tres secciones difieren entre sí** | **0** |

Los cuatro que tocaron los toggles pusieron **lo mismo en las tres secciones**. Ejemplos:
`dra-adriana-michelle` apagó teléfono en las tres; `dra-patricia-roldan-mora` apagó correo en
las tres; `dr-prueba` apagó las nueve.

**La distinción sobre la que está construido el modal jamás se ha ejercido.** No es evidencia
de que sea inútil en teoría — es evidencia de que hoy cuesta complejidad y no compra nada.

## 4. El punto ciego que esto le abre a los evals

| Doctor | Los 9 toggles |
|---|---|
| `dr-prueba` — fixture de TODA la suite | **todos `false`** |
| El doctor de la demo ([`00`](00-EVIDENCIA-traza-demo.md)) | **todos `true`** |

La suite corre contra el único doctor con la barrera apagada, así que el camino "faltan campos
de contacto" **no puede fallar en los evals: no se ejecuta nunca**. Por eso un fallo tan
reproducible como el de la demo convivió con corridas en verde.

> **Regla que sale de aquí:** *un fixture configurado en el modo más permisivo del sistema no
> prueba el sistema, prueba su mejor caso.* Hermana del punto ciego de #32b (los evals no pasan
> por `route.ts`), pero de otra clase: aquí el código SÍ está cubierto — lo que no está cubierto
> es la **configuración** bajo la que corre.

## 5. La trampa que esto le pone al plan

[`02-PLAN`](02-PLAN-agendar-freeform.md) mueve el ejecutor del agente de `/range-bookings` a
`/range-bookings/instant`, para igualarlo al picker. Efecto lateral **no obvio**:

```
hoy:      pre-check (horarios)  +  ejecutor /range-bookings (horarios)     → coherente
ingenuo:  pre-check (horarios)  +  ejecutor /instant        (instant)      → INCOHERENTE
```

Una card pasaría la validación y luego **400** en la ejecución, para cualquier doctor cuyas dos
secciones difieran. Hoy no difieren en ningún doctor (§3), así que **el bug no se
manifestaría** — hasta que alguien use el modal como está diseñado. Es exactamente el molde de
la bitácora **#12**: *asumir la semántica de un endpoint en vez de leerla*.

**Por eso el cambio de ejecutor y el de `missingContactFields` son UN solo cambio, nunca dos.**

## 6. Hacia dónde debería ir

Con el picker en freeform, la frontera entre *"Horarios disponibles"* y *"Nuevo horario"* **es**
la frontera rango / sin-rango que [`02-PLAN`](02-PLAN-agendar-freeform.md) quiere borrar. Las
dos secciones describen el mismo acto: *el doctor agenda*.

El estado honesto son **dos grupos**, no tres:

| Grupo | Cubre |
|---|---|
| **El paciente agenda** | widget público |
| **Yo agendo** | picker **y** asistente, un solo ajuste |

Con el agente leyendo el mismo grupo que el picker, las dos superficies del doctor quedan
**incapaces de divergir** — que es la misma enfermedad del §5, curada en la fuente en vez de
parchada. Las columnas ya existen: es re-etiquetar el modal y apuntar el agente al mismo grupo.
**No hay migración.**

⚠️ **Lo que NO se decide aquí:** si los tres campos deberían seguir siendo obligatorios cuando
agenda el doctor. Eso es producto (§3.1 de [`00`](00-EVIDENCIA-traza-demo.md) muestra a una
doctora escribiendo `"."` para saltárselos), y está anotado como decisión abierta en
[`SESSION-REFRESCO`](SESSION-REFRESCO.md) §4.

---

*Fuentes: `BookingFieldSettingsModal.tsx` (secciones), `BookPatientModal/index.tsx:603` y `:350`
(qué obedece el picker), `proposals.ts:778-786` (el pre-check del agente),
`range-bookings/route.ts:101-109` e `instant/route.ts:82-97` (qué exige cada endpoint), y tres
consultas read-only a prod. Creado 2026-08-05.*
