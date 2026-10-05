# PRUEBAS Y GUÍAS — probar la app como la usa un doctor, y enseñarle a usarla

> **Tipo: ÍNDICE.** Creada el 2026-10-02 a pedido del usuario: «la prueba más importante del proyecto».
> Si llegas en frío: lee **`SESSION-REFRESCO.md`** (estado vivo) y luego **`00-PLAN.md`**.

## Por qué existe

El producto va a ser **muy barato**: no habrá una persona que atienda a los doctores. Todo el soporte
será **guías paso a paso, el widget «?» y videos cortos**. Si un doctor no entiende cómo hacer algo
solo, el producto no funciona. Por eso aquí se hacen tres cosas, en este orden:

1. **Probar** cada flujo de Agenda y Expediente de punta a punta en PRODUCCIÓN (navegador + base de
   datos + logs), incluido cómo cada uno deja (o no) su ingreso en **Flujo de Dinero**.
2. **Corregir** lo que no hace lo que creemos — el código (con plan y OK del usuario, como siempre) y
   los documentos (manual del widget, docs de diseño).
3. **Escribir la guía** de cada flujo para el doctor (pasos exactos, qué va a ver, qué pasa con su
   dinero, qué hacer si algo sale mal). Esas guías alimentan la página «Flujos» de Ayuda (fase **H3**
   de `../AYUDA WIDGET/`) y después los **videos** (fase H4).

## Archivos

| Archivo | Tipo | Qué tiene |
|---|---|---|
| [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) | ESTADO | Dónde vamos, qué sigue, qué bloquea. Se lee primero, se escribe al final |
| [`00-PLAN.md`](00-PLAN.md) | PLAN | Meta, alcance, método, reglas de datos, fases |
| [`01-CATALOGO-flujos.md`](01-CATALOGO-flujos.md) | REFERENCIA (viva) | Cada flujo: pasos, lo que debe verse, lo que debe quedar en la BD, su efecto en Flujo de Dinero, y su estado |
| [`02-BITACORA.md`](02-BITACORA.md) | BITÁCORA | Cada corrida: qué se hizo, evidencia (pantalla **y** BD), resultado |
| [`03-HALLAZGOS.md`](03-HALLAZGOS.md) | REFERENCIA (viva) | Bugs, desvíos doc↔código y huecos de UX, con su estado y su arreglo |
| [`05-PENDIENTES.md`](05-PENDIENTES.md) | ESTADO (vivo) | **Lo que queda**, una línea por pendiente con la recomendación (y opciones si hay que decidir) y el orden sugerido — la lista para tachar |
| [`GUIAS/`](GUIAS/) | GUÍAS (para el doctor) | Una guía por flujo, en español, lista para la página «Flujos» y para el guion del video |

## Relación con lo que ya existe

- `../VISITAS/04-PRUEBAS-flujos-verificados.md` — pruebas de Visitas/Tratamientos (2026-10-01). Sus
  reglas y trampas se heredan aquí (00-PLAN §4); sus flujos F1–F13 se re-corren en este catálogo.
- `../AYUDA WIDGET/` — el widget y el capítulo de ayuda (H1 en prod; H2 capítulos; **H3 = página
  «Flujos»**; H4 = videos). Esta carpeta produce el contenido de H3/H4.
- `apps/doctor/src/lib/ayuda/manual-del-doctor.md` — el manual que lee el widget. Todo hallazgo de
  «el manual dice X y la app hace Y» se corrige ahí, en el mismo commit que la UI si cambia la UI.
