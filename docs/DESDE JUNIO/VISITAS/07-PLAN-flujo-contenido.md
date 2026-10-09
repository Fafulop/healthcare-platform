# 07 — PLAN: el tratamiento como flujo contenido (menos clics, menos vocabulario)

> **Estado (2026-10-09): P1 EN PROD Y PROBADO** — `4fdb6295` + arreglo del menú `4cb571bd` (doctor
> SUCCESS). Review inline: 4 hallazgos, arreglados y corridos (`estadoEnPalabras` contra 13 tipos de
> sesión). Probado en Chrome sobre «Seguimiento del 10 oct»: renglones de estado, sin «Ligar»,
> canceladas plegadas (con la fecha de su visita), PDF con las mismas palabras, «⋯» hacia abajo y —en
> la última tarjeta— hacia ARRIBA (el clic encontró que «Borrar» quedaba fuera de pantalla). No visto
> aún: la cabecera con «próxima: …» (ese tratamiento no tiene citas activas).
>
> **P2 (2026-10-09): EN PROD `486c3515` (doctor SUCCESS).** Probado en Chrome («Nombre Prueba», sin
> citas): «Nueva Visita» sin cita muestra «Sin cita, hoy o antes…»; con mañana escrita, «Crear visita»
> → toast «Una visita sin cita no puede ser en el futuro…» y NO se creó nada. No visto aún: elegir una
> cita futura (ese paciente no tiene citas) ni el «Desligar» escondido. Regla `rechazarVisitaFuturaSinCita`
> (lib/visitas) en POST y PATCH de visitas; corrida con TZ=UTC: ayer/hoy pasan, mañana/+30 rechazan
> (400), con fechas de `parseFecha` y de `@db.Date`. Prod (sólo lectura): 3 visitas sin cita con fecha
> futura, las 3 de dr-prueba y sesiones de tratamiento — no se tocan. Además de lo planeado: «Desligar
> la cita» se esconde si la visita es de una cita futura (dejaría una visita futura sin cita).
> **P3 sin empezar.**
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

**P3a — «Agendar seguimiento» en la página de la visita. (Después de P3b.)**

- Botón en la visita (no en visitas canceladas ni con permiso faltante: necesita `citas`).
- Abre un modal con **un renglón** de `FilasDeSesiones` (servicio · precio · fecha · hora ·
  disponibilidad «libre») + contacto/modalidad como en «Agendar sesiones». Reutiliza
  `useAgendaDeSesiones` / `agendarFilas` tal cual.
- Al confirmar:
  1. **Visita que YA es de un tratamiento activo:** se reutiliza «Agregar sesión» TAL CUAL
     (`AgendarSesionesModal` modo `nueva` + su ruta): cero servidor nuevo. Terminado/cancelado → el
     botón dice «Reactiva el tratamiento para agendar su seguimiento» y lleva a él.
  2. **Visita suelta — servidor (una transacción):** crea «Seguimiento del <día>» con sesión 1 = esta
     visita (y su cita, si la tiene y está libre — misma regla que `unirComoSeguimiento`, que se
     factoriza para no duplicarla) y sesión 2 vacía con su servicio y precio. Forma: `POST
     …/tratamientos` con `desdeVisita: <visitaId>`; smoke test read-only contra prod ANTES del push
     (query shape nuevo).
  2. **Cliente:** agenda la sesión nueva con `range-bookings/instant` + `paraSesion` (el camino de
     siempre: correo, Google Calendar, precio de la sesión). Si la cita falla, la sesión queda «Sin
     fecha» con su botón Agendar — igual que «Nuevo tratamiento» hoy. No se inventa atomicidad nueva.
- Toast: «Seguimiento agendado: 23 oct 10:00 · sesión 2 de «Seguimiento del 9 oct»» con enlace al
  tratamiento.
- Clics: hoy ~8 pantallas/clics → 1 botón + llenar fecha/hora + «Agendar».

**P3b — «También en la agenda» en «Abrir visita hoy» (sesión sin cita). SE HACE PRIMERO.**

Investigado 2026-10-09 (código de `apps/api/.../range-bookings/instant/route.ts` + prod en sólo
lectura):

| Pregunta | Respuesta |
|---|---|
| ¿Correo de confirmación? | Sí, siempre — salvo `avisoEnResumen` (T5). Se apaga. |
| ¿SMS? | Sólo con `sms_enabled` = `'false'` en prod hoy. Se apaga igual, por si un día se prende. |
| ¿Recordatorio? | No: el cron avisa `offset` (2 h) ANTES; una cita creada «ahora» ya pasó esa ventana. |
| ¿Google Calendar? | Crea el evento (es el espejo en la agenda: bien). Sin `attendees`: no invita al paciente. |
| ¿Choque de horario? | 409 «Este horario se traslapa con una cita existente (10:00–10:45)…». |
| ¿Sin servicio? | `serviceId` es OBLIGATORIO (400). |
| ¿Contacto del paciente? | Exigido según el doctor: **7 de 13** doctores exigen correo+teléfono+WhatsApp, y **254 de 337** pacientes activos NO tienen correo (96 sin teléfono). |

⇒ **Decisión del usuario (2026-10-09):** en este modo NO se exige el contacto (el paciente está
enfrente; no hay a quién avisar). Sin eso, la casilla fallaría para 3 de cada 4 pacientes.

**Servidor (`apps/api`, ruta `range-bookings/instant`):** nuevo campo `enConsulta: true` («el paciente
está aquí ahora»). Vale SÓLO si: lo manda un DOCTOR autenticado (no admin, no público) · `date` = HOY en
hora de la clínica · trae `paraSesion`. Si no se cumple → 400 (no se ignora en silencio). Con él:
- no se exige correo / teléfono / WhatsApp;
- no se manda correo ni SMS (como `avisoEnResumen`, pero sin resumen después);
- todo lo demás igual: traslape, servicio del doctor, `patientId`, precio de la sesión, evento de
  Calendar, ligar la sesión (`ligarSesionAlAgendar`).
Deploy: toca `apps/api` ⇒ despliega el servicio API (verificar su `commitHash`, no sólo el de doctor).

**Cliente (pantalla del tratamiento):** el `practiceConfirm` de «Abrir visita hoy» se vuelve un modal
chico:
- **Servicio** (select de tus servicios; default = el de la sesión; obligatorio si va a la agenda) y
  **Hora** (default = ahora, HH:MM de la clínica).
- Casilla **«También en la agenda»**, marcada. Sólo aparece con permiso `citas` (si no, el modal es el
  de hoy: visita sola).
- Marcada → `instant` con `enConsulta` → `POST …/visitas` con ese `bookingId` (la sesión ya tiene la
  cita: la visita entra sola, G3) → se navega a la visita. La cita queda **Agendada** (CONFIRMED) y se
  cobra al concluirla, como cualquier otra (NO nace «completada»: se saltaría el modal de cobro).
- Si `instant` falla (traslape, horario bloqueado): el error se queda EN el modal; se cambia la hora o
  se desmarca la casilla.
- Si la cita se creó pero la visita no: toast «La cita se creó pero la visita no: ábrela desde la
  sesión» y se recarga (la sesión ya muestra su cita con «Abrir visita»).
- Desmarcada → lo de hoy (`paraSesion`, visita sola) + el aviso «Sin cita: no se cobra desde la agenda».
- Ayuda en el mismo commit: manual (tratamientos), guía de sesiones y `capabilities.ts`.

Verificación P3b: smoke read-only de lo que lea `enConsulta` (si agrega un query) · prueba a mano en
prod con dr-prueba: casilla marcada → cita de hoy en la agenda, sin correo, visita de esa cita, la
sesión dice «Agendada»; concluirla cobra; desmarcada → visita sola + aviso; hora ocupada → error en
el modal. Los datos de prueba se cancelan al final (no se borran).

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
