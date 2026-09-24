# 🛠️ Plan de construcción

> **Tipo: DECISIÓN / REFERENCIA** mientras se construye; cada fase que shippea se resume en
> [`SESSION-REFRESCO`](SESSION-REFRESCO.md) y su detalle se congela.
>
> Creado el **2026-09-20**. Nada de esto está construido todavía.
>
> ⚠️ **Corrección 2026-09-23:** las Fases 0–2 están hechas y en prod (`SESSION-REFRESCO`), y la
> Fase 3 empezó. **Las Fases 4, 5 y 6 se replantearon** tras la prueba de longitud: ver
> [§ Replanteamiento 2026-09-23](#replanteamiento-2026-09-23--guías-por-tarea--widget-especializado).
> Lo de abajo se deja como estaba, marcado donde ya no aplica.

---

## El orden, y por qué ES ese orden

La tentación es empezar por el widget, porque es lo que se ve. Sería un error: **el widget es
un multiplicador del manual**, y multiplicar un manual vacío o viejo da respuestas vacías o
viejas, dichas con total seguridad.

| # | Fase | Sirve para algo por sí sola | Tamaño |
|---|---|---|---|
| **0** | Auditar lo que ya hay | Sí — arregla guías que quizá ya mienten | Chico |
| **1** | El manual de las 2 áreas grandes | **Sí** — doctores leyéndolo, sin una línea de IA | Mediano |
| **2** | El widget, punta a punta | Sí | Mediano |
| **3** | Los evals | No para el doctor; imprescindible para nosotros | Chico-mediano |
| **4** | ~~Resto de las áreas~~ → **Guías por tarea** (§ Replanteamiento) | Sí | Mediano |
| **5** | ~~Unificar manual ↔ guías JSX~~ → resuelto por construcción en el replanteamiento | Evita que se contradigan | — |
| **6** | ~~Video guionado~~ → clips cortos dentro de cada guía; el guionado queda para después | Sí | Mediano |

**Cada fase deja algo que sirve.** Si esto se detiene después de la 1, quedan docs buenos; si
se detiene después de la 2, queda un widget que contesta.

---

## Fase 0 — Auditar lo que ya existe

Las guías se escribieron **antes** de las cuatro mudanzas de menú del 2026-09-20. Antes de
añadir una palabra, hay que saber qué de lo escrito ya es falso.

- Revisar `CitasGuide`, `ExpedientesGuide`, `PagosGuide` contra la UI de hoy.
- Anotar lo que haya drifteado (el formato de corrección con fecha de `07-CONVENCIONES`).
- **Entregable:** una lista de desviaciones. Puede ser corta — el `grep` inicial no encontró
  menciones a «Editar Perfil» ni a «Integraciones», que eran las sospechosas.

---

## Fase 1 — El manual, por orden de importancia

**Agenda y Expediente primero, y por mucho.** Son lo que un doctor usa todos los días y donde
se atora.

Para cada área:
- Qué es y para qué sirve, en dos líneas.
- **Los flujos completos**, incluidas las permutaciones (en Agenda: con rango, sin rango,
  freeform, reprogramar, cancelar, no-show…).
- Qué NO se puede hacer, y qué hacer en su lugar.
- Encabezados **estables y citables** (`## Agenda` → `### Agendar sin rango`).

> ⚠️ Escribir esto obliga a mirar el código, no la memoria. En este repo ya pasó que un doc
> describiera un sync de Google Calendar **que nunca existió**. Un manual con un flujo
> inventado es peor que no tenerlo: el doctor intenta y falla.

**Entregable:** `manual-del-doctor.md` cubriendo Agenda y Expediente. Publicable tal cual.

---

## Fase 2 — El widget punta a punta

Con el manual de la fase 1, aunque falten áreas.

1. `mapa-de-rutas.ts` — la tabla curada de rutas.
2. `prompt.ts` — manual + reglas + mapa. Con la salida de «no sé».
3. `proveedores/` — la interfaz y DOS implementaciones (para poder comparar desde el día uno).
4. `POST /api/ayuda/chat` — auth, tope de mensajes, registro de tokens **con su modelo**.
5. `AyudaWidget.tsx` — botón flotante + panel, copiando el molde de `AgendaAgentPanel`,
   **sin cards**, mandando la ruta actual como contexto.

**Decisiones que hay que tomar en esta fase, no después:**
- ¿El widget vive en TODAS las pantallas o sólo en las documentadas? (Si aparece en una pantalla
  sin manual, su mejor respuesta es «no sé» — y eso decepciona más que no estar.)
- ¿Una cuenta **congelada** puede usarlo? (`01-ARQUITECTURA` §5: hay que meterlo a
  `RUTAS_DE_CUENTA_CONGELADA` a propósito, o queda bloqueado por default.)
- ¿Se guarda la conversación? Empezar por **no** — menos superficie, menos datos, nada que
  proteger.

---

## Fase 3 — Los evals

`scripts/ayuda-evals.ts`, con el patrón del agente.

- 20–30 casos para empezar, la mitad de Agenda/Expediente.
- **Casos fuera del manual a propósito**, donde la respuesta correcta es «no sé». Son los
  importantes: miden lo único que de verdad puede salir mal.
- Correr contra **los dos modelos** y comparar costo y calidad con números.
- **DOS corridas antes de declarar nada**: una sola no distingue regresión de ruido.

---

## Fase 4 — El resto de las áreas

Flujo de dinero · Pagos · Facturación · Perfil · Tareas · Notas… en ese orden aproximado.
Habilitar las pestañas `Perfil & Contenido` y `Gestión de Práctica` que hoy están apagadas.

---

## Fase 5 — Unificar manual y guías JSX

Cuando el manual cubra lo mismo que las guías, **habrá dos verdades** y van a divergir.

Tres salidas, por decidir cuando lleguemos:
- **(a)** El manual es la fuente y las guías se generan de él (lindas, pero menos control visual).
- **(b)** Las guías se retiran y `/dashboard/ayuda` pasa a ser el manual renderizado + el widget.
- **(c)** Conviven, con un gate que verifique que no se contradicen.

No decidir esto **también es una decisión** — la de dejar que se separen.

---

## Fase 6 — Video guionado

Proyecto aparte, con su propio plan. Lo esencial ya está en
[`00-POR-QUE`](00-POR-QUE-y-decisiones.md) §6: grabación **guionada**, donde el mismo script
maneja la app, graba y genera la narración, de modo que romperse sea ruidoso. Materia prima ya
sembrada: `scripts/demo-seed/seed-cardio.cjs`.

---

## Replanteamiento 2026-09-23 — guías por tarea + widget especializado

> **Tipo: PLAN.** Nada de esta sección está construido. Reemplaza a las Fases 4–6 de arriba.

### Por qué cambia el plan

La prueba de longitud del 2026-09-23 (`SESSION-REFRESCO`, bitácora) midió lo que `00-POR-QUE`
§3 suponía: con `gpt-4o-mini`, **meter el manual entero deja de funcionar bien mucho antes de
que deje de caber**. A ~45.6k tokens: citas 15→12 de 18, dos respuestas inventadas, latencia
~1 s → ~13 s, y ~4 preguntas por minuto por el tope de OpenAI compartido con prod. La Fase 4
tal como estaba (escribir TODAS las áreas en el manual del widget) lleva justo ahí.

Y la propuesta del usuario resuelve lo mismo de otra forma: **el doctor que quiere aprender
necesita ver cómo se hace, en pocos pasos y con un clip**, no un chat.

### El diseño, en una frase

**El widget se especializa en Agenda y Expediente** (el manual entero, como hoy: ~7.4k tokens,
el tamaño medido que funciona) **y para todo lo demás sólo conoce un ÍNDICE de guías**, al que
enlaza. La página `/dashboard/ayuda` se vuelve **guías cortas por tarea, agrupadas por área, con
pasos y un clip**.

| | Agenda y Expediente | Flujo de Dinero y el resto |
|---|---|---|
| El widget | Contesta desde el manual completo | «Eso no lo explico aquí, pero hay una guía: …» → enlace |
| Si no hay guía | — | «No lo sé» (la salida honesta que ya funciona) |
| La página | Guías cuyo texto SALE del manual | Guías con sus propios pasos |

El prompt crece ~1k tokens (≈50 guías × ~20 tokens), no ~38k.

### Las tres piezas

**A. El catálogo de guías — `apps/doctor/src/lib/ayuda/guias.ts`** (UNA fuente)

```ts
interface Guia {
  id: string;            // 'crear-receta' — estable: es la URL y lo que cita el widget
  area: 'agenda' | 'expediente' | 'flujo-de-dinero' | …;
  titulo: string;        // 'Cómo crear una receta'
  seccionDelManual?: string;  // 'Expediente > Recetas' — sólo Agenda/Expediente
  pasos?: string[];      // sólo las áreas SIN manual
  video?: { url: string; grabadoEl: string };  // opcional: una guía sin clip es válida
  marcas?: ('depende-del-plan' | 'solo-titular')[];
}
```

**Una verdad por tema, por construcción** (esto es lo que la vieja Fase 5 quería evitar a mano):
- En **Agenda y Expediente**, la guía **no trae pasos propios**: la página rinde el texto de la
  sección del manual que nombra (`seccionDelManual`). El manual ya está escrito para el doctor;
  escribir los pasos dos veces es la divergencia que `00-POR-QUE` §5 teme.
- En las **demás áreas**, los `pasos` de la guía son la fuente. Si algún día esa área entra al
  widget, sus pasos se mueven al manual y la guía pasa a apuntar ahí.

**B. La página `/dashboard/ayuda`, reescrita**
- Pestañas por área (Agenda · Expediente · Flujo de Dinero · …), cada una con su lista de guías.
- Cada guía: título, **clip** (si hay), **pasos numerados**, y «grabado el <fecha>».
- **`?guia=<id>` abre una guía.** La página ya lee `?tab=` (`page.tsx:65`); se extiende. Así el
  widget y cualquier botón de «Ayuda» de la app pueden mandar a una guía concreta.
- **Reemplaza** `CitasGuide` y `ExpedientesGuide` — no se arreglan (la auditoría las encontró
  obsoletas desde abril; `03-AUDITORIA`). `PagosGuide` vive en `/dashboard/pagos` y se decide aparte.
- Arreglo de paso: el botón «Ayuda» de Citas manda a `?tab=citas`, que no existe (`03-AUDITORIA` §6).

**C. El widget enlaza guías**
- El prompt gana el **índice** (id · área · título) — nunca los pasos.
- La respuesta JSON gana `guias: [id]`, y el **servidor valida cada id contra el catálogo** y
  arma la URL él (`/dashboard/ayuda?guia=<id>`): mismo patrón que `enlaces` contra el mapa de
  rutas. **Un id inventado se tira**; el modelo no puede mandar a una guía que no existe.
- Casos nuevos en `ayuda-probar.ts`: preguntas de Flujo de Dinero que deben enlazar la guía
  correcta, y preguntas sin guía que deben terminar en «no lo sé». Dos corridas.

### Reglas para los clips (lo que evita que se vuelvan deuda)

El costo de un video no es grabarlo: es **mantenerlo cierto** (`00-POR-QUE` §6 — el menú cambió
cuatro veces un solo día). Por eso:

1. **El texto es la fuente; el clip sólo ilustra.** Si se contradicen, manda el texto.
2. **Un clip = una tarea**, 30–90 segundos. Regrabar uno cuesta minutos, no una tarde.
3. **«Grabado el <fecha>» visible** en cada clip: uno viejo se nota solo.
4. **Sin narración por ahora** (o subtítulos): la voz es lo más caro de rehacer. La grabación
   guionada (script que maneja la app, graba y genera la narración) sigue siendo el destino;
   no bloquea empezar.
5. Datos de demo: dr-prueba ya tiene 8 expedientes de cardiología sembrados para esto
   (`scripts/demo-seed/seed-cardio.cjs` — ⚠️ al 2026-09-23 esa carpeta **no está en git**, sólo
   en la máquina del usuario). Nunca grabar datos de un paciente real.

### El gate que por fin se construye

Cada «rótulo» entre comillas del manual **y** de los `pasos` de las guías tiene que existir como
texto en algún `.tsx` (`03-AUDITORIA` §5.4). Es lo que habría cazado la guía de Citas obsoleta
desde abril, y ahora hay DOS lugares que pueden quedarse viejos. Más: cada `seccionDelManual`
existe en el manual, y cada `id` es único.

### En qué orden

| # | Qué | Sirve sola |
|---|---|---|
| **G1** | `guias.ts` + la página nueva, **sólo Agenda y Expediente, sólo texto** (sale del manual) | Sí — reemplaza las guías obsoletas |
| **G2** | El gate de rótulos | Sí |
| **G3** | El widget enlaza guías (índice + validación + casos nuevos) | Sí |
| **G4** | Clips de Agenda y Expediente | Sí |
| **G5** | Flujo de Dinero: guías con pasos escritos **desde el código**, luego clips | Sí |
| **G6** | Resto de áreas, por uso | Sí |

**Primeras guías** (las que propuso el usuario, en el orden en que un doctor las necesita):

| Guía | Área | ¿El manual ya lo cubre? |
|---|---|---|
| Crear un servicio | Agenda (se hace en Perfil Público) | ⚠️ **No como paso a paso**: el manual sólo dice dónde (`Antes de empezar > Lo que conviene tener configurado`). Hay que escribir la sección desde el código |
| Agendar una cita con ese servicio | Agenda | ✅ `Agenda > Agendar una cita` |
| Crear un paciente | Expediente | ✅ `Expediente > Crear un paciente` |
| Crear una plantilla | Expediente | ✅ `Expediente > Plantillas` |
| Crear una receta | Expediente | ✅ `Expediente > Recetas` |
| Subir una imagen | Expediente | ✅ `Expediente > Documentos y galería` |

### Lo que NO cambia

Sin RAG · sin datos del doctor · sin escrituras · `gpt-4o-mini` · el tope diario de 60.

### Lo que hay que decidir antes de G4 (los clips)

| Pregunta | Opciones |
|---|---|
| **¿Dónde viven los clips?** | **UploadThing** (lo que hay; hoy se usan ~0.2 GB de los 2 GB del plan gratis, y unas decenas de clips lo llenarían) · **Cloudflare R2** (decidido en `IMAGE MIGRATION`, no empezado; 10 GB gratis y **sin costo por reproducción**, que en video es lo que importa) · **YouTube no listado** (cero infraestructura; a cambio, marca y recomendaciones ajenas dentro de la app) |
| **¿Quién graba?** | Es trabajo de producto, como el manual |
| **¿Con qué herramienta?** | Captura de pantalla simple ahora; guionada después |

G1–G3 no dependen de ninguna de estas.

---

## Lo que hay que decidir antes de empezar

| Pregunta | Por qué bloquea |
|---|---|
| **¿Qué modelo se prueba primero?** | Empezar por el barato (`gpt-4o-mini`) y medir si alcanza es más informativo que empezar caro |
| **¿El widget en todas las pantallas?** | Cambia el alcance del manual de la fase 1 |
| **¿Cuenta congelada, sí o no?** | Cambia el route map, y el default es «no» |
| **¿Quién escribe el manual?** | Es escritura de producto, no de código. Es el trabajo más grande de todo esto |

La última es la de verdad. **Todo lo demás son días; el manual son semanas**, y es lo único que
no se puede automatizar — porque es exactamente el conocimiento que hoy tendría una persona de
soporte.
