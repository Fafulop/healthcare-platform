# 07 — PLAN: el tratamiento como flujo contenido (menos clics, menos vocabulario)

> **Estado (2026-10-09): plan APROBADO. P1 escrito y revisado (inline: 4 hallazgos, arreglados y
> corridos — `estadoEnPalabras` contra 13 tipos de sesión, todo OK), type-check + 5 gates en verde;
> esperando OK de commit. P2 y P3 sin empezar.**
>
> Cambio sobre el plan en P1: los helpers de estado (`estadoEnPalabras`, `hechaPorVisita`,
> `proximaCita`) viven en `lib/tratamientos-ui.ts` (pantalla y PDF dicen lo mismo); y el GET del
> tratamiento ya no calcula `ocupadas` (sólo servía a los selectores de «Ligar»).
> Origen: revisión en prod de «Seguimiento del 10 oct» (paciente «Nombre Prueba», 2026-10-09) y la
> conversación que siguió. Este plan NO rehace tratamientos v2 (`06-PLAN`): recorta caminos y vocabulario.

## 0. Decisiones del usuario (2026-10-09) — no se re-litigan

1. **Visita y cita son espejo**: el mismo evento visto desde el expediente (visita) y desde la agenda
   (cita). Una cita existe ANTES (es plan); su visita nace cuando se atiende.
2. **Se conserva la flexibilidad**: se pueden crear visitas que NUNCA tengan cita en la agenda.
   - Fuera de tratamientos: «Nueva Visita» → «Sin cita» queda igual.
   - Dentro de un tratamiento: «Abrir visita hoy» y el seguimiento traen la casilla
     **«También en la agenda»**, marcada por default (el caso común sigue siendo un clic).
3. **Dentro del tratamiento sólo se CREA, no se liga**: fuera «Ligar una cita…» y «Ligar una visita…».
   La puerta para meter a un tratamiento una cita/visita hecha en otro lado es la que ya existe en el
   expediente: «Nueva Visita» → «¿Es seguimiento?» → «Sesión siguiente de «X»».
4. **«Seguimiento» crea la cita** (hacia adelante): «Agendar seguimiento» desde la visita.
5. **Fuera el vocabulario propio de la sesión** («Hecha / Agendada / Por agendar»): la tarjeta dice lo
   que ya dice la agenda (estado de la cita) o «Atendida» / «Sin fecha».
6. **Ninguna visita SIN cita con fecha futura.** Algo futuro sin cita es plan, no visita; para eso
   está la sesión «Sin fecha».

## 1. Por qué (lo que se vio en prod, 2026-10-09)

- La sesión 2 de «Seguimiento del 10 oct» tiene visita SIN cita fechada MAÑANA y cuenta como «Hecha»
  (`lib/tratamientos.ts:144`: visita sin cita ⇒ hecha, sin mirar la fecha). El «Resumen PDF» lo
  imprime así para el paciente.
- Una sesión sin cita no se puede cobrar (el cobro nace al concluir la cita): queda «Pendiente» para
  siempre y no hay aviso.
- La tarjeta de la sesión muestra chip de estado + renglón de cita + servicio + visita + 5–7 botones
  (ligar cita, ligar visita, servicio y precio, notas, cancelar, borrar). Demasiado.
- El seguimiento hoy cuesta: Expediente → Nueva Visita → seguimiento → Crear → ir al tratamiento →
  Agendar → llenar → Agendar. Y no crea cita.

## 2. Mapa de caminos (cómo queda)

| # | Desde | Acción | Hoy | Después |
|---|---|---|---|---|
| 1 | Expediente | Nueva Visita (con/sin cita, «¿Es seguimiento?») | igual | igual, salvo P2: sin cita ⇒ fecha ≤ hoy |
| 2 | Expediente | Nuevo tratamiento (N sesiones con fecha/hora o «después») | igual | igual |
| 3 | Tratamiento | Agregar sesión | igual | igual |
| 4 | Tratamiento | Agendar / Agendar sesiones / Reagendar | igual | igual |
| 5 | Tratamiento | Abrir visita (de su cita) | igual | igual |
| 5b | Tratamiento | Abrir visita hoy (sin cita) | visita sola | **casilla «También en la agenda»** (P3b) |
| 6 | Tratamiento | Ligar una cita… / Ligar una visita… | existe | **se quita de la UI** (P1) |
| 7 | Visita | — | — | **«Agendar seguimiento»** (P3a) |
| 8 | Visita | Ligar / desligar SU cita (guía A13) | igual | **igual** — es la flexibilidad visita↔cita |
| 9 | Agenda | Concluir la cita de una sesión → visita + cobro | igual | igual |

La API de ligar (`PATCH …/sesiones/[sesionId]` con `bookingId` / `visitaId`) **se queda**: la usa el
seguimiento del expediente por dentro y no estorba. Sólo se quita la UI.

## 3. Fases (un commit cada una, review antes de pedir el OK del push)

### P1 — la pantalla del tratamiento, contenida y callada (sólo UI, `apps/doctor`)

Archivo principal: `app/dashboard/medical-records/patients/[id]/tratamientos/[tratamientoId]/page.tsx`.

1. **Quitar** los selects «Ligar una cita…» y «Ligar una visita…» de `FilaSesion` (y `ligarCita` /
   `ligarVisita` de `useTratamientoDetalle` si nadie más los usa en esa pantalla).
2. **Un solo renglón de estado** en lugar del chip:
   - con cita visible → fecha · hora · servicio + la píldora de la cita (`BookingStatusPill`, la de la
     agenda: Pendiente · Confirmada · Completada · Cancelada · No asistió);
   - con visita sin cita → «Atendida · 9 oct» + aviso chico **«Sin cita: no se cobra desde la agenda»**
     (sólo con permiso `flujo`);
   - sin nada → «Sin fecha» junto al botón **Agendar**;
   - cita de otro paciente / desligada (los `motivo` de hoy) → la frase de `detalleDeSesion` tal cual.
3. **Canceladas abajo y plegadas**: «Ver canceladas (1)». No cuentan en nada visible arriba.
4. **Cabecera**: «2 de 4 atendidas · próxima: 10 oct 10:00» (la próxima = la cita activa más cercana
   de sus sesiones; sale de las sesiones ya derivadas, no se re-calcula nada de negocio).
5. **Acciones secundarias a un menú «⋯»** por sesión: Servicio y precio · Notas · Cancelar sesión /
   Reactivar · Borrar. A la vista sólo el botón principal (Agendar / Reagendar / Abrir visita).
6. **El texto del PDF** (`datosDelResumen` → columna «Estado») usa las mismas palabras que la pantalla.
7. **Mensajes que mandan a «ligar desde el tratamiento»** — hay que reescribirlos porque esa acción ya no
   existe: `FilasDeSesiones.tsx:297` (reagendar a medias) y cualquier otro que salga del grep
   `liga.*tratamiento|Ligar una` en `apps/doctor/src`. Nuevo texto: cancelar la cita que sobra en la
   agenda y usar «Reagendar» en la sesión.
8. **Docs de ayuda en el MISMO commit** (regla del widget): `lib/ayuda/manual-del-doctor.md`,
   `guias/T7-cancelar-reactivar-o-ligar-una-sesion.md` (sale la parte «Ligar»; se renombra si hace
   falta), `guias/T6-cobrar-una-sesion-y-la-cuenta.md`, y `lib/llm-assistant/capabilities.ts` si
   menciona «Por agendar» / «Hecha». Barrido de drift con TODAS las «etiquetas» citadas (memoria:
   drift test).

El estado derivado del servidor (`EstadoSesion` en `lib/tratamientos.ts`) NO cambia en P1: sigue
alimentando la cuenta, el conteo y el PDF. Sólo cambia cómo se dice.

### P2 — ninguna visita sin cita en el futuro (regla de servidor + UI)

1. `POST /api/medical-records/patients/[id]/visitas` sin `bookingId`: `fecha > hoy (zona de la
   clínica)` ⇒ **400** «Una visita sin cita no puede ser en el futuro: agenda una cita». Aplica también
   con `paraSesion` y con `seguimiento`.
2. El cambio de fecha de una visita sin cita (`guardarFecha` en la página de la visita) — misma regla.
3. UI: `max={hoy}` en el `<input type=date>` de «Nueva Visita» (sin cita) y de la fecha de la visita.
4. **Cuidado `@db.Date` vs timestamp** (memoria): comparar día contra día en la zona de la clínica;
   probar a las ≥18:00.
5. Datos existentes: contar en prod (read-only) cuántas visitas sin cita tienen fecha futura antes de
   decidir si se hace algo con ellas. No se tocan sin preguntar.

### P3 — «Agendar seguimiento» y «También en la agenda»

**P3a — «Agendar seguimiento» en la página de la visita.**

- Botón en la visita (no en visitas canceladas ni con permiso faltante: necesita `citas`).
- Abre un modal con **un renglón** de `FilasDeSesiones` (servicio · precio · fecha · hora ·
  disponibilidad «libre») + contacto/modalidad como en «Agendar sesiones». Reutiliza
  `useAgendaDeSesiones` / `agendarFilas` tal cual.
- Al confirmar:
  1. **Servidor (una transacción):** si la visita NO es de un tratamiento → crea «Seguimiento del <día>»
     con sesión 1 = esta visita (y su cita, si la tiene y está libre — misma regla que
     `unirComoSeguimiento`) y sesión 2 vacía. Si YA es de un tratamiento activo → agrega la sesión
     siguiente vacía. Si es de uno terminado/cancelado → 409 «reactívalo primero».
     Forma propuesta: extender `POST …/tratamientos` con `desdeVisita: <visitaId>` (o una ruta
     `POST …/visitas/[visitaId]/seguimiento`); se decide al escribirla, con smoke test read-only contra
     prod ANTES del push (query shape nuevo).
  2. **Cliente:** agenda la sesión nueva con `range-bookings/instant` + `paraSesion` (el camino de
     siempre: correo, Google Calendar, precio de la sesión). Si la cita falla, la sesión queda «Sin
     fecha» con su botón Agendar — igual que «Nuevo tratamiento» hoy. No se inventa atomicidad nueva.
- Toast: «Seguimiento agendado: 23 oct 10:00 · sesión 2 de «Seguimiento del 9 oct»» con enlace al
  tratamiento.
- Clics: hoy ~8 pantallas/clics → 1 botón + llenar fecha/hora + «Agendar».

**P3b — «También en la agenda» en «Abrir visita hoy» (sesión sin cita).**

- El confirm actual se vuelve un modal mínimo: hora (default = ahora, redondeada), servicio (default =
  el de la sesión) y la casilla **«También en la agenda»** (marcada).
- Marcada → `range-bookings/instant` hoy a esa hora con `paraSesion` → `POST …/visitas` con ese
  `bookingId` → se navega a la visita. La cita queda **Confirmada**; se cobra al concluirla, como
  cualquier otra (NO se crea «ya completada»: eso se saltaría el modal de cobro).
- Desmarcada → lo de hoy (`paraSesion`, visita sola) + el aviso «sin cita: no se cobra desde la agenda».
- **A verificar al escribirla** (abierto):
  - que una cita de HOY creada así NO le mande al paciente el correo de «tu cita fue agendada»
    (está ahí con el doctor) — revisar los flags de `instant` (`avisoEnResumen`, etc.);
  - qué hace `instant` si la hora choca con otra cita (¿rechaza?) → entonces ofrecer otra hora o
    desmarcar;
  - sesión sin servicio → el select pide uno (o se permite sin servicio si `instant` lo acepta).

## 4. Qué NO cambia

- La derivación de estado del servidor, la cuenta, el cobro al concluir, el reagendar con visita que
  viaja (V4 paso 2), «Nuevo tratamiento», «Agregar sesión», «Agendar sesiones».
- «Nueva Visita» y sus tres opciones de «¿Es seguimiento?» (salvo la fecha ≤ hoy sin cita).
- Ligar / desligar la cita DESDE LA VISITA (guía A13).
- El asistente de IA (oculto, `ASISTENTE_IA_VISIBLE = false`): no tiene herramientas de ligar
  sesiones; `proposals.ts` sólo LEE la sesión de una cita. Se revisa su prosa en P1 por si dice
  «Por agendar».

## 5. Verificación por fase

- `pnpm type-check` + `pnpm gates`; review (`GENERAL AGENTES/05-METODO-code-review.md`) ANTES de pedir
  el OK del commit.
- P2 y P3a: smoke test read-only del query nuevo contra prod (TOOLING) antes del push.
- Prueba a mano en PROD tras el deploy (Chrome, dr-prueba), pantalla **y** BD:
  - P1: tarjeta con cada estado (cita Confirmada, Completada, Cancelada, visita sin cita, sin fecha,
    cancelada plegada); que no exista «Ligar»; menú «⋯»; PDF con las mismas palabras.
  - P2: «Nueva Visita» sin cita con mañana → no deja; con cita de mañana → sí.
  - P3a: visita suelta → «Agendar seguimiento» → nace el tratamiento con 2 sesiones y la cita en la
    agenda; desde una visita que ya es sesión → agrega la siguiente.
  - P3b: «Abrir visita hoy» marcada → cita de hoy en la agenda + visita de esa cita; concluirla cobra;
    desmarcada → visita sola + aviso.
- Commitear verificado en `04-PRUEBAS-flujos-verificados.md` y el bloque de arriba de `SESSION-REFRESCO`.
