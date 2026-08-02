# 🔄 SESSION-REFRESCO — CITAS / calendario

> **Para la próxima sesión.** Dónde quedó todo el 2026-08-02 y qué sigue. Tipo
> **ESTADO / BITÁCORA**: se actualiza al cerrar cada sesión.
> El detalle histórico (qué se construyó y por qué) vive en [`README.md`](README.md);
> el guion de prueba a mano, en
> [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md).

## En una frase

El **calendario Día · Semana · Mes · Año** está **en producción** (2 commits), pero
**lo que se probó a mano es sólo una parte del primer deploy**; y la funcionalidad que el
doctor pidió al final —**clic en una cita → modal con sus acciones**— **NO está construida**.

---

## 1. Qué está en prod

| Commit | Qué |
|---|---|
| `07ff7ed0` | El calendario Día/Semana/Mes/Año, reemplazando el mini-calendario + panel de día |
| `c8fe484c` | Arreglos tras probarlo: franja "Rangos", canceladas ocultas, interruptor "Todas las fechas", barrido de zona horaria, 7 hallazgos de review |

Ambos empujados a `main` (= producción, sin staging). Antes de nada: **verificar el
`commitHash` del servicio doctor**; un push a `main` no garantiza que el servicio se
redespliegue (`railway redeploy` reenvía el commit viejo, `railway up` sí funciona).

**Rollback:** `git revert --no-edit c8fe484c` deja el calendario como estaba a media mañana;
revertir también `07ff7ed0` lo quita entero. No hay esquema, ni SQL, ni migración, ni
lockfile de por medio — todo es cliente.

---

## 2. ⚠️ Qué está probado y qué NO

Esto es lo más importante de este documento.

| | Estado |
|---|---|
| `07ff7ed0`, Tier 1 (bloque gris no se come el clic · navegación rápida · chip del rango) | ✅ **Probado por el doctor, pasó** |
| `07ff7ed0`, el resto de la sección J | ❌ Sin correr |
| `c8fe484c` **completo** | ❌ **Sin probar por nadie.** Sólo se confirmó que desplegó |

Todo lo automático (type-check, build, los 5 gates, 28 comprobaciones de
`event-model.ts`) está **verde en los dos commits** — y en esta sesión eso demostró valer
poco: **cinco rondas de `/code-review`, cinco con hallazgos reales**, y **tres veces el bug
lo había introducido la ronda anterior al arreglar otra cosa**. El más caro (bloqueaba crear
horarios desde fuera de México) pasó type-check, build y gates sin despeinarse.

**Conclusión operativa: verde en automático no dice nada sobre si esto funciona. Falta el clic.**

### Qué correr primero (sección J, 20 checks)

Ojo: **J-9, J-14 y J-18b se reescribieron** en `c8fe484c` porque describían el comportamiento
VIEJO. Un tester con la versión anterior del guion marcaría como FALLO una implementación
correcta. Usar siempre el guion del repo, no la memoria.

1. **J-14 / J-9** — el chip del rango ahora vive en la franja **"Rangos"** (bajo los
   encabezados de día, FUERA de la rejilla). Comprobar que se lee sin hover, en táctil, y que
   el intervalo se ve también en Semana.
2. **J-18** — cancelar una cita: desaparece del calendario y su horario queda clicable.
3. **J-18b** — una **COMPLETADA** sigue dibujándose y **conserva su tooltip** (en Semana el
   nombre va truncado y el tooltip es lo único que deja leerlo).
4. **J-11** — vista Año: los meses **pasados** deben estar tintados. Si salen en blanco,
   volvió el bug del predicado.
5. **J-4 + zona horaria** — cambiar la zona del sistema a Madrid o Tokio a última hora del día
   de la clínica: la tabla y el calendario deben coincidir en qué día es "hoy", **y crear un
   horario debe seguir funcionando** (eso estaba roto).

### Sin cobertura en el guion (código nuevo de `c8fe484c`)

No alcancé a escribirles check. Van a mano:

- **Refrescar en vista Año.** Estando en Año, crear un rango / bloquear / "Refrescar" / que el
  agente escriba → los datos deben actualizarse. Antes `enabled` silenciaba también las
  llamadas explícitas y no pasaba nada, sin aviso.
- **La selección no se teletransporta.** En Mes viendo agosto, clic en el "26" gris de julio,
  luego `›` dos veces → el día resaltado debe quedar dentro del periodo visible, y pedir
  vista Día no debe aterrizar en una fecha que nunca se vio. (La lógica del clamp sí se
  verificó aparte; falta verla en pantalla.)

---

## 3. 🎯 LO SIGUIENTE: clic en una cita → modal con sus acciones

**Es lo que el doctor pidió y lo único que quedó sin hacer.** Se discutió, se propusieron tres
rutas, se recomendó una… y la decisión se quedó sin tomar porque la conversación saltó a las
canceladas. **Retomar esto primero.**

### Lo que se quiere

Clic en el bloque de una cita en el calendario → se abre un modal con **todo lo que hoy se
puede hacer desde la fila de "Todas las Citas"**: completar (precio + forma de pago),
reagendar, cancelar, formulario pre-consulta, link de pago, ¿necesita factura? + datos
fiscales, confirmación por correo/WhatsApp, vincular expediente, bloqueo extendido.

### ⚠️ Corrección a una estimación mía que era pesimista

En la sesión dije que esto era «un refactor cuidadoso de un archivo de 1,256 líneas». **Es
falso, y no hay que empezar por ahí.** Investigando al final resultó que **la extracción ya
existe** (viene del rediseño de julio):

- **`StatusActions`** vive en `_components/BookingsSection.tsx` (~línea 866). Es autónomo:
  recibe `booking` + **8 handlers** + una prop `layout: "card" | "table" | "expanded"`.
- **Ya se renderiza en DOS sitios** con exactamente los mismos props: la tarjeta móvil
  (~línea 393) y la fila desplegada de escritorio (~línea 555). Un modal sería el **tercer**
  sitio, no una reimplementación.
- **No está exportado** — es local al archivo. Ése es el único cambio estructural.

### Lo que `StatusActions` NO trae

Cuatro controles viven en la fila de la tabla, no dentro de él. Si el modal debe tenerlos hay
que renderizarlos aparte (todos son componentes ya existentes en el mismo archivo):

| Control | Handler | Dónde está hoy |
|---|---|---|
| `ExtendedBlockControl` | `onUpdateExtendedBlock` | ~línea 344 |
| `FacturaCheckbox` | `onUpdateFacturaSolicitada` | ~línea 362 |
| `PriceCell` | `onUpdatePrice` | ~línea 383 |
| Vincular expediente | `onUpdatePatientLink` | columna de expediente |

### Ruta recomendada

1. **Exportar `StatusActions`** (o moverlo a `_components/StatusActions.tsx` y que
   `BookingsSection` lo importe). Cero cambios de comportamiento en la tabla.
2. **`BookingDetailModal`** que renderice `StatusActions` + los cuatro controles de arriba.
3. **Cablear el `onClick`** del bloque de cita en `TimeGrid` (y `MonthGrid` si se quiere).
   `page.tsx` ya tiene los 12 handlers en la mano — se los pasa a `BookingsSection`, así que
   dárselos al modal es repetir un prop-drilling que ya existe.

**NO reimplementar las acciones en un componente nuevo.** Lógica replicada es la fuente #1 de
bugs reales de este repo, y aquí sería garantía de deriva entre la tabla y el modal.

### Trampas conocidas

- **`StopClick`** (`BookingsSection.tsx:57`) existe porque `StatusActions` renderiza el
  `CompleteBookingModal` DENTRO de sí mismo: sin frenar la propagación, un clic en ese modal
  burbujea y desmonta el modal a media captura. Un modal sobre un calendario tiene el mismo
  riesgo — **modal dentro de modal**, revisarlo explícitamente.
- Los bloques de cita **ya reciben eventos de puntero** (se quitó el `pointer-events-none` en
  `c8fe484c`), así que el `onClick` entra limpio. Pero un bloque de cita se dibuja **encima
  de un hueco libre clicable** (z-10 sobre z-5) cuando la cita libera su horario
  (`COMPLETED`/`NO_SHOW`): al cablear el clic hay que decidir a propósito qué gana. Hoy gana
  el bloque, que para el modal es justo lo que se quiere.
- La tabla **no se tocó** en toda la sesión y su propia prueba a mano (secciones **A–I**,
  del rediseño de julio) **sigue sin correrse**. Si se refactoriza `BookingsSection`, correrla.

---

## 4. Decisiones abiertas (del doctor, no del código)

1. **Cancelar una cita la hace desaparecer de las DOS superficies.** El calendario ya no la
   dibuja, y el filtro de entrada de la tabla es *Activas*, que sólo conserva
   `PENDING`/`CONFIRMED`. Hay que abrir el desplegable de estados para volver a verla. No se
   pierde nada, pero puede *sentirse* como pérdida. Mitigación si molesta: que la tabla entre
   con *Todos los estados*.
2. **`min=` de los inputs de fecha ahora usa el día de la CLÍNICA.** Para un doctor en Tijuana
   (UTC−7) a última hora, el día de la clínica ya es mañana, así que no podría crear un rango
   para lo que en su reloj sigue siendo hoy. Es coherente (la plataforma define el día en hora
   de CDMX) pero es un borde elegido, no obvio.

## 5. Watch-item abierto

**`handleBookInGap` no precarga fecha ni hora** (`page.tsx`). Al clicar un hueco, el modal de
agendar abre vacío. El aviso ya **no** promete fecha/hora (decía "Agendar cita: {fecha} a las
{hora}" y el doctor podía creer que venían puestas y agendar mal), pero pasarlas de verdad
exige tocar los props de `BookPatientModal`. **Se cerraría de paso** si se hace el modal de la
sección 3.

---

## 6. Lo que conviene no re-aprender

- **Un conjunto, una pregunta.** El bug más grave de la sesión fue reusar
  `INACTIVE_STATUSES` (escrito para "¿libera el horario?", donde `COMPLETED` pertenece) para
  medir carga de trabajo en la vista de Año — que por eso pintaba **en blanco todo el pasado**.
  Hoy son tres conjuntos con nombre propio en `_lib/event-model.ts`: `FREES_THE_SLOT`,
  `NO_WORKLOAD`, `HIDDEN_IN_CALENDAR`. **El nombre ambiguo era el bug.**
- **Las comprobaciones ya no viven en un scratchpad.** `apps/doctor/scripts/event-model-check.ts`
  (28, exit 0). Correr con `cd apps/doctor && npx tsx scripts/event-model-check.ts`. Antes los
  "17/24/28 checks" eran números que sólo existían en la prosa y no podían fallar nunca.
- **La deriva de docs muerde.** Dos veces un check de la sección J quedó describiendo
  comportamiento que ya no existía: J-18 iba a pasar trivialmente sin probar nada, y J-9/J-14
  habrían hecho que un tester reprobara una implementación correcta. **Al cambiar
  comportamiento, revisar si algún check lo describe.**
- **Ojos frescos ganan.** El pase inline (el autor revisando su propio diff) no encontró los
  tres hallazgos más graves que sí encontró `/code-review`. Playbook:
  [`../AGENTES/GENERAL AGENTES/05-METODO-code-review.md`](../AGENTES/GENERAL%20AGENTES/05-METODO-code-review.md).

## 7. Datos de prueba en prod

Se crearon fixtures en un doctor de prueba para el **11 de agosto de 2026**: rango 09:00–13:00
(intervalo 30 min), citas a las 10:00 (CONFIRMADA, con bloqueo extendido hasta 11:30), 11:00
(dos, solapadas), 12:00 (**cancelada** durante la prueba) y 06:30 (fuera de rango a propósito),
más un bloqueo 16:30–17:00. El rango 16:00–18:00 **se borró** probando J-14. Reconstruir lo que
falte antes de retomar el guion.
