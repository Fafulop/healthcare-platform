# 08 — PLAN: la cita nace con su visita, y ya no se liga nada a mano

> **Estado (2026-10-09): plan APROBADO. F1 escrito y revisado, esperando OK de commit.** F2 y F3 sin
> empezar.
>
> F1 tocó TAMBIÉN apps/api (dos líneas): `enConsulta` ahora vale con `patientId` aunque no haya sesión
> (lo necesita «También en la agenda» de «Nueva Visita») ⇒ el push despliega api Y doctor. Candado del
> mismo día también en el SERVIDOR (`rechazarSiHayCitaEseDia` en POST y PATCH de visitas); smoke SÓLO
> LECTURA 8/8 (días de «Nombre Prueba» + 5 días con citas vivas en prod). La creación de la cita de hoy
> se factorizó en `useCitaEnConsulta` (la usan P3b y «Nueva Visita»). PATCH de visitas ya no liga:
> se borró el código de G3 al ligar/desligar (`exigirSinSesionAlDesligar`).
> Sigue a `07-PLAN-flujo-contenido.md` (P1–P3 en prod). Origen: la pregunta «¿si ligo la visita a la cita
> y luego la completo, se crea otra?» (no: una cita tiene a lo más una visita, `visitas.booking_id`
> único) y la propuesta del usuario de quitar el ligar y que la visita exista desde que se agenda.

## 0. Decisiones del usuario (2026-10-09) — no se re-litigan

1. **Ya no se liga una cita a una visita a mano** (ni al crearla ni después). Desde el expediente se
   crea una visita (hoy o antes) y, si hace falta, su cita en ese momento («También en la agenda»).
2. **La cita nace con su visita**: en cuanto se agenda (Pendiente/Agendada) y tiene expediente, existe
   su visita; el doctor puede subir cosas antes de la cita. Concluir sigue cobrando igual.
3. **Cita cancelada / no asistió:** su visita VACÍA se borra; con contenido **se queda**, marcada «cita
   cancelada» (nunca se pierde nada clínico).
4. **Visitas próximas** en la tarjeta «Visitas»: se muestran como **«Próxima · 15 oct 10:00»**, aparte.
5. **Borrar una cita cuya visita tiene contenido: NO** — 409 «tiene contenido clínico: cancélala». Con la
   visita vacía, se borra la visita junto con la cita.
6. **Una segunda visita el mismo día que una cita: NO.** «Nueva Visita» ofrece abrir la de su cita.

## 1. Lo que se midió (prod, sólo lectura, 2026-10-09)

| Dato | Valor |
|---|---|
| Visitas por origen | 15 de cita · 39 manuales sin cita · 9 manuales ligadas a mano |
| Mismo paciente y día: una «Sin cita» + una de cita (el doble) | **6 casos, 1 doctor** (probable prueba) — se dejan |
| Citas activas futuras CON expediente y SIN visita | **7** (2 doctores) → pase único al lanzar |
| Citas activas SIN expediente (`patient_id` NULL; las públicas nacen PENDING sin él) | **183** — su visita nace al ligar el expediente |

## 2. Radio de impacto

| Dónde | Qué cambia |
|---|---|
| `packages/database/src/visitas.ts` — `syncVisitaForBooking` | De «crear al concluir» a **reconciliar** en cada cambio: activa/concluida con expediente ⇒ tiene visita (crear o ajustar fecha); cancelada/no asistió ⇒ visita vacía se borra, con contenido se queda |
| apps/api — 4 rutas que crean citas (`bookings`, `bookings/instant`, `range-bookings`, `range-bookings/instant`) | Tras crear, `syncVisitaForBooking` (falla abierto: agendar NUNCA depende de la visita) |
| apps/api — `bookings/[id]` PATCH | Llamarla en todo cambio de estado (cancelar, no asistió, reactivar), no sólo al concluir / ligar expediente |
| apps/api — `bookings/[id]` DELETE | Visita vacía ⇒ se borra con la cita; con contenido ⇒ 409 |
| apps/api + packages — reagendar (`reagendaDe`) | La visita de la vieja **pasa a la nueva** para TODA cita (hoy sólo sesiones: `moverVisitaALaCitaNueva`); la nueva NO crea una propia si recibe la vieja |
| apps/doctor — «Nueva Visita» | Sin «¿De qué cita?»; candado del mismo día; «También en la agenda» (como P3b) |
| apps/doctor — página de la visita | Fuera «Ligar una cita…» / «Desligar la cita»; «cita cancelada» si aplica |
| apps/doctor — rutas de visitas | `POST …/visitas` con `bookingId` y `PATCH` de `bookingId` ⇒ 400 (ya no se liga); quedan crear sin cita y editar |
| apps/doctor — P3b y «Abrir visita» del tratamiento | Usar la visita que YA creó el servidor (si no, 409 «La cita ya tiene una visita») |
| apps/doctor — tarjeta Visitas, línea de tiempo | «Próxima» aparte; la exportación de cuenta (apps/api) salta las vacías |
| Ayuda | manual, guía E3, `capabilities.ts`, prosa del agente: «la visita se abre sola al completar» deja de ser cierto |
| Deploy | api **y** doctor juntos (`packages/**` no está en ningún `watchPatterns`) |

**No cambia:** el cobro al concluir · `lastVisitDate` (sale de las consultas) · el estado de las sesiones
(visita antes de concluir = Agendada, ya soportado) · recordatorios · Google Calendar · la sugerencia
«¿A qué visita pertenece?» (últimos 7 días hasta HOY: no propone visitas futuras).

## 3. Huecos y su regla

1. **Reagendar = crear nueva + cancelar vieja en DOS peticiones.** La visita viaja al CREAR la nueva
   (`reagendaDe`); si cancelar la vieja falla, queda la vieja activa SIN visita (no dos visitas) y la
   pantalla ya avisa «cancélala desde la agenda».
2. **Re-activar una cita cancelada** (vuelve a Agendada): la reconciliación le crea su visita otra vez
   (o recupera la que se quedó con contenido).
3. **Cita pasada a OTRO expediente:** la visita vacía del anterior se borra (como hoy); con contenido se
   queda en el expediente anterior SIN cita (es corrección de un error de captura; se audita). El nuevo
   paciente recibe su visita.
4. **Crear la visita falla ABIERTO** (agendar nunca se cae por ella) ⇒ puede haber cita activa sin
   visita; se repara en el siguiente cambio de la cita o al concluir (como hoy). Por eso el candado del
   mismo día mira **si hay CITA ese día**, no si hay visita.
5. **Citas sin expediente (183):** no tienen visita hasta ligar el expediente; ligarlo ahora crea la
   visita también si la cita está activa (hoy sólo si está concluida).
6. **PENDING del widget público:** cuenta como activa (tiene visita si tiene expediente).
7. **Cambiar la hora/fecha de la misma cita** («Horario → Editar»): la visita muestra el día de la cita
   (se lee de ella); la reconciliación ajusta el respaldo `fecha`.
8. **Ventas, notas, recetas, fotos, plantillas** ya cuelgan de `visitaId`: no cambian. Subir antes de la
   cita queda en su visita futura (decisión 2).

## 4. Fases (un commit cada una; review y OK antes de cada push)

### F1 — sin ligar a mano + candado del mismo día (sólo apps/doctor, riesgo bajo)

- «Nueva Visita»: fuera «¿De qué cita?». Fecha hoy o antes (P2). Si el paciente tiene **cita ese día**:
  el botón es **«Abrir la visita de su cita»** (si ya existe) o «Abrir visita» de esa cita (la crea con la
  ruta de hoy mientras F2 no esté); no se crea una suelta ese día.
- Casilla **«También en la agenda»** (marcada) como en P3b, fuera de tratamientos: crea la cita de hoy
  (`enConsulta`, sin pedir contacto ni avisar) y su visita. Requiere `citas`.
- Página de la visita: fuera «Ligar una cita…» / «Desligar la cita».
- Rutas: `PATCH …/visitas/[id]` con `bookingId` ⇒ 400; `POST …/visitas` con `bookingId` se QUEDA
  (lo usan «Abrir visita» de la cita y P3b hasta F2).
- «¿Es seguimiento?» se queda (sesión siguiente / visita anterior), sin el selector de cita.
- Ayuda en el mismo commit.

### F2 — la cita nace con su visita (apps/api + packages + apps/doctor, riesgo ALTO)

- `syncVisitaForBooking` → reconciliador (regla de §2). Llamado en: las 4 rutas de alta, todo cambio de
  estado en PATCH, ligar/desligar expediente, DELETE (con su 409).
- Reagendar mueve la visita para toda cita.
- Cliente (mismo deploy, compatible con la API vieja y la nueva): P3b y «Abrir visita» usan la visita
  que trae la respuesta / la que ya existe; si no existe, la crean como hoy.
- Pase único: visitas para las 7 citas activas con expediente (script con verificación antes y después).
- Smoke SÓLO LECTURA de toda forma nueva de query antes del push; prueba a mano en prod (dr-prueba):
  agendar → visita aparece; subir una nota antes; reagendar → la nota viaja; cancelar vacía → se borra;
  cancelar con nota → se queda «cita cancelada»; borrar con nota → 409; concluir → cobra, sin duplicar.
- Revisión externa recomendada (`/code-review ultra`, la dispara el usuario): toca agenda, cobro y
  expediente a la vez.

### F3 — «Próxima» en la tarjeta Visitas (apps/doctor) + exportación sin vacías (apps/api)

## 5. Verificación

type-check (api con `NODE_OPTIONS=--max-old-space-size=6144`) · `pnpm gates` · review inline antes de
pedir el OK · smoke read-only de queries nuevas · `commitHash` de api Y doctor tras el push · prueba en
prod con pantalla Y BD · resultados aquí y en `SESSION-REFRESCO`.
