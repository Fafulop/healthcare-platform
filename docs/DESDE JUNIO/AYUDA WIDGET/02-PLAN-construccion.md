# 🛠️ Plan de construcción

> **Tipo: DECISIÓN / REFERENCIA** mientras se construye; cada fase que shippea se resume en
> [`SESSION-REFRESCO`](SESSION-REFRESCO.md) y su detalle se congela.
>
> Creado el **2026-09-20**. Nada de esto está construido todavía.

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
| **4** | Resto de las áreas | Sí | Mediano |
| **5** | Unificar manual ↔ guías JSX | Evita que se contradigan | Por decidir |
| **6** | Video guionado | Sí | Grande, proyecto aparte |

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
