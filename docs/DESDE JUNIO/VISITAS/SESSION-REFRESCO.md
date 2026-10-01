# VISITAS — SESSION-REFRESCO (handoff para la próxima sesión)

> **Actualizado: 2026-10-01 (fase 2: T2 — la API de tratamientos — escrita y revisada; antes: fase 1 LANZADA a todos el 2026-09-29, backfill DESCARTADO).** Léelo PRIMERO. Dice dónde estamos, qué
> ya está en prod, qué sigue y qué trampas ya se pisaron. El diseño vive en `01-DISENO`, el plan paso a
> paso en `02-PLAN-fase-1.md` (§4 backfill, §5.1 D1, §5.2 D2, §5.3 D3, §5.4 D4). Este doc NO repite eso:
> lo señala.

## 0. ⏭️ EMPIEZA AQUÍ (cierre de la sesión del 2026-09-29)

**Estado exacto al irse el usuario:**

1. **✅ T1 de la fase 2 (Tratamientos): APLICADO EN PROD Y COMMITEADO** (el commit de
   `create-tratamientos.sql`: `git log -- packages/database/prisma/migrations/create-tratamientos.sql`;
   no despliega nada — sólo `packages/**`, docs y scripts). Las tablas
   `medical_records.tratamientos` y `medical_records.tratamiento_sesiones` existen en prod (vacías,
   verificadas por definición: 7 FKs, 5 CHECKs, 11 índices). Van en ese commit: `packages/database/prisma/migrations/create-tratamientos.sql`, `schema.prisma` (modelos
   `Tratamiento` / `TratamientoSesion`), `docs/NEW.MD-GUIDES/database-architecture.md` (entrada
   DB-only), `03-PLAN-fase-2.md`, `01-DISENO` (G11), este doc, y los scripts
   `scripts/visitas/tratamientos-probe-t1.cjs` (probe 25/25 en tx revertida) y
   `tratamientos-run-t1.cjs` (la corrida real con verificación antes del commit).
   Type-check de los 4 apps limpio, `pnpm gates` en verde.
   Lo ajeno que sigue sin commitear en el árbol NO es de visitas: BBVA (`informe-medico/*`,
   `dicts/bbva.ts`, el PDF, `reports/[reportId]/chat/route.ts`), `ANALISIS CAT/`,
   `scripts/demo-seed/`, `.claude/settings.local.json` — nunca `git add -A`.
2. **✅ T2 (la API de tratamientos) — 2026-10-01: escrita, smoke 26/26 contra prod, review en 3 pasadas.**
   Cómo quedó, las 3 desviaciones aprobadas y las reglas que añadió el review: `03-PLAN-fase-2.md`
   §3.1. Toca código de la fase 1 (G3 en las rutas de visitas + `cargarCitaLigable` en
   `lib/visitas.ts`). Nadie llama esas rutas hasta T3.
   T2 en prod: `272762a6` (doctor, SUCCESS verificado por `commitHash`).
   **T3 (la UI) — 2026-10-01: escrita detrás de la lista de dr-prueba** (`tratamientosUiActiva()`);
   decisiones y archivos en `03-PLAN` §4.1. En prod `75afeae9` (doctor SUCCESS).
   ✅ **Probada a mano en prod (Chrome, dr-prueba, paciente «pepit perez» — sin correo) 2026-10-01:**
   tarjeta vacía → «Nuevo tratamiento» (sin campo de plantilla) → 3 sesiones «Por agendar» · ligar
   cita nueva → «Agendada» con fecha/hora y desaparece de los otros selectores · ligar visita →
   «Hecha» y la visita dice «Sesión 2 de 3 — PRUEBA T3» · cancelar con cita: el diálogo de TRES
   salidas («No cancelar nada» no toca nada; «sesión y cita» cancela las dos) · «Borrar» con
   ligadas → 409 y el aviso apunta a «Cancelar tratamiento» · desligar visita/cita y borrar → ok.
   Verificado en la BD: 0 tratamientos/sesiones al final, auditoría completa. Queda en la agenda
   la cita de prueba CANCELADA (2 oct 10:00, nota «PRUEBA T3 tratamientos - borrar») — borrarla a
   mano si se quiere.
   ✅ **G6 (exportar cuenta) — 2026-10-01:** `tratamientos.csv` (sólo si hay tratamientos), una
   fila por sesión con HECHOS (cancelada sí/no, la cita con su estatus, la visita), no el estado
   derivado — así no hay segunda copia de `estadoDeSesion()`. Sin sección en el HTML por paciente
   (decisión del usuario: el CSV basta; el LEEME lo dice). Corrido de verdad contra prod (lectura)
   con un tratamiento de prueba en dr-prueba: filas = pantalla; luego borrado.
   ✅ **Reagendar lleva la sesión (2026-10-01):** reagendar = cancelar + crear; la sesión pasa a la
   cita nueva con `POST /api/appointments/reagendar-sesion` (agenda y asistente, sólo el caso
   limpio; la tarjeta del asistente lo dice). Lo robusto —en el servidor, dentro del reagendado—
   es de T4 (`03-PLAN` §5). En prod `de02ce11`. ✅ Probado a mano (Chrome, dr-prueba, «pepit perez»
   sin correo): sesión 1 en la cita del 2 oct 11:00 → «Reagendar» a 12:00 → toast «La sesión 1 de 2
   de «PRUEBA REAGENDAR» pasó a la nueva cita» y la sesión quedó en la de 12:00; auditoría
   `link_sesion_cita` con motivo «cita reagendada». Limpieza: tratamiento borrado, las dos citas de
   prueba CANCELADAS. Visto de paso (NO es de esto, ya existía): el modal de reagendar dice «Correo
   enviado automáticamente» aunque la cita no tenga correo (no se mandó: `confirmationEmailSentAt`
   null), y reagendar desde la agenda NO copia las notas de la cita.
   ✅ **LANZAMIENTO de Tratamientos a todos (2026-10-01):** `tratamientosUiActiva()` → `!!doctorId`;
   manual (sección «Tratamientos» + perfil y visita), guía y `capabilities.ts` en el MISMO commit.
   26 rótulos citados verificados contra los `.tsx`. Revertir = revertir el commit completo.
   ✅ **T4 (2026-10-01, escrito; ver `03-PLAN` §5.1):** reagendar en el SERVIDOR (`reagendaDe` en
   las 3 rutas que crean la cita; `pasarSesionAlReagendar` en packages/database; la ruta
   `/api/appointments/reagendar-sesion` del navegador se BORRÓ) · «Sesión N de M — X» en la agenda
   (tabla, tarjeta y modal; el nombre lo ve todo el que ve la agenda — decisión del usuario) · G1b y
   P2 dentro de `syncVisitaForBooking` · y dos bugs viejos de reagendar (las notas se perdían; el
   «Correo enviado» sin correo). Decisiones YA tomadas (no re-litigar): P1 estado
   DERIVADO (sólo `cancelada` se guarda), **P2 revisado: la sesión SIEMPRE guarda su visita**, P3
   números fijos, P4 `precio_paquete` sin usar hasta T6, P5 seguimientos al final, G10 todos los
   planes, T1–T4 antes que el dinero (T5–T6).
3. **Pendientes de la fase 1 (limpieza, en §3 abajo):** probar Visitas con un doctor que NO sea
   dr-prueba (el usuario tiene que iniciar sesión con esa cuenta en Chrome); la regla del mismo día
   en el servidor; y, tras unos días estables, quitar `visitasUiActiva()` y las ramas viejas.
4. **Commits de la sesión 2026-09-29 (en prod):** `65c35499` tarjetas 3 + «Ver N más» · `dd95ffd9`
   D5 · `f0597749` D5b · `1a1387d6` contacto de emergencia + notas generales tras la flecha ·
   `9b5842de` «Consultas sin visita» aparte · `959bd54c` fechas de consulta un día antes ·
   `8fc957b7` export con visitas (api) · `42ed7f01` **LANZAMIENTO de Visitas a todos** ·
   `a5e58d52` «Última visita» al borrar/editar consulta · `3e92d0ee` / `86b1dd19` docs y plan fase 2.

## 1. Dónde estamos, en una línea

**Fase 1 (Visita) LANZADA a todos los doctores el 2026-09-29** (commit de lanzamiento: ver `git log
-- apps/doctor/src/lib/visitas-ui.ts`, `42ed7f01`). D4, D5 y D5b probados a mano en dr-prueba (D5b además
con la bitácora de auditoría de prod). Exportar cuenta incluye visitas (`8fc957b7`). El backfill NO va:
lo creado antes de las visitas se queda «Sin visita». **Lanzamiento probado en prod (Chrome, sesión de
dr-prueba, 2026-09-29): 1, 2, 3a, 3b, 4, 5 y 6 ✅** — ver §3.1. **Falta: la prueba con un doctor que NO
sea dr-prueba, y el commit de limpieza** (ver §3).


## 2. Qué está en prod (commits, en orden)

| Commit | Qué | Servicio |
|---|---|---|
| `90c1363a` | **A** — tabla `visitas` + `visita_id` en los 5 hijos (SQL manual, FKs compuestas) | (BD; `packages/**`) |
| `e14e27b4` | **C** — `scripts/visitas/backfill-visitas.cjs` (SÓLO ensayado: 293 / 150 / 12 / 29) | — |
| `059ec27c` | **D1 + D1b** — `syncVisitaForBooking` (`packages/database/src/visitas.ts`): visita automática al concluir la cita y al ligar el expediente | api |
| `6235902d` | **D2** — API `…/patients/[id]/visitas` y `…/visitas/[visitaId]` (`apps/doctor/src/lib/visitas.ts`) | doctor |
| `02b07a4a` | Fuga de permisos en «Citas e Ingresos» (`lib/booking-permisos.ts`) | doctor |
| `f4f213d4` + `ec700274` | 🔴 **SEGURIDAD** — `GET /appointments/slots` y `/bookings/[id]` eran PÚBLICOS (datos del paciente + código que cancela la cita); telegram sin dueño. Cerrado | doctor, api |
| `7f091166` | Rotación de los 201 `confirmationCode` activos | — |
| `e637fe84` | **D3** — cada consulta/foto/receta/nota/informe guarda su visita (`resolverVisitaDeHijo`, `moverConsultaDeVisita`) | doctor |
| (commit de D4, 2026-09-26 — ver `git log -- apps/doctor/src/lib/visitas-ui.ts`) | **D4** — «Nueva Visita» + tarjeta «Visitas» + pantalla de la visita + `?visitaId=` en plantillas/fotos/recetas/notas, **sólo dr-prueba**; y `lastVisitDate` = la consulta más reciente (para TODOS). Detalle en 02-PLAN §5.4 | doctor |

| `65c35499` | Tarjetas del perfil: 3 más nuevas + «Ver N más» (`ListaColapsable`), Historial → 3 + «Ver todas» (la ruta del paciente trae `take: 5`), orden de Citas e Ingresos arreglado, notas de la cita en la visita — **para TODOS** | doctor |
| `dd95ffd9` | **D5** — «¿A qué visita pertenece?» al crear foto/receta/nota FUERA de una visita (sugiere la de los últimos 7 días), **sólo dr-prueba**. Detalle en 02-PLAN §5.5 | doctor |

**En prod hay 0 visitas reales** al cierre del 2026-09-25 (ninguna cita concluida desde D1). La primera
aparecerá sola cuando un doctor concluya una cita con expediente ligado.

## 3. Qué sigue (en este orden)

1. **Probar con un doctor que NO sea dr-prueba** (el lanzamiento se probó sólo en dr-prueba): el
   perfil dice «Nueva Visita» + «Visitas»; «¿A qué visita pertenece?» en Recetas/Docs/Notas; la
   Línea de Tiempo abre el modal con `?nuevaVisita=1`. Claude no puede entrar a otra cuenta: el
   usuario inicia sesión en Chrome y Claude corre la misma lista.
   - Ya probado en prod con dr-prueba (2026-09-29, leído del DOM, no del resumen de `find` —que
     dijo «no está deshabilitado» y era falso—): perfil con «Nueva Visita» + «Visitas» · el modal
     pre-elige la cita de hoy y ofrece «Abrir su visita» · «Agregar plantilla» con la fecha
     `disabled` · **3b: «Editar Consulta» de una plantilla dentro de una visita con la fecha
     `disabled`** (plantilla «PRUEBA 3b» creada y borrada) · selector en Recetas/Docs/Notas con la
     visita de hoy sugerida · Línea de Tiempo → modal y `?nuevaVisita=1` borrado · widget «?»
     contesta desde la sección nueva (se salta «crear/abrir la visita» antes de «Agregar
     plantilla»: resumen del modelo, no el manual).
   - Efecto de la prueba 3b: «test vistas lopez» quedó con «Última visita» 2026-09-29 (antes «—»),
     por el bug de abajo.
2. **Commit de limpieza** (unos días después, si nada falla): `visitasUiActiva()` ya devuelve `true`
   para cualquier doctor con sesión — quitarla de las 14 pantallas junto con las ramas que ya no
   corren (la tarjeta «Historial de Consultas» y el botón «Nueva Consulta» del perfil, el aviso "no
   disponible" de la pantalla de la visita). Pendientes chicos de D4: el selector de plantillas aún no
   dice «Plantilla SOAP»; la pantalla de la visita recarga listas completas (costo). Además (code
   review del lanzamiento, diferido a propósito):
   - `encounters/new` SIN `?visitaId=` sigue existiendo (por URL o rama muerta) y crea una consulta
     suelta con fecha editable, titulada «Nueva Consulta»: quitarla o mandarla a «Nueva Visita».
   - ⏸️ **APLAZADO A PROPÓSITO (medido 2026-09-29):** `GET …/encounters` devuelve filas COMPLETAS
     (SOAP, signos, customData) y la llaman 4 pantallas (perfil vía `useVisitasDelPaciente`, visor de
     fotos, uploader, nueva receta). En prod hoy: máx **6** consultas por paciente (prom. 1.3), máx
     **10.8 KB** por paciente (prom. 2.2 KB), ~0.5 KB con sólo los campos que usan; 54–66 ms. No vale
     el riesgo: `EncounterCard` (tarjeta «Consultas sin visita») arma su descripción de `customData`,
     que es justo lo pesado — recortarlo obliga a copiar esa lógica al servidor. **Retomar cuando un
     paciente pase ~50 consultas o la respuesta ~100 KB** (import grande o doctor con años de uso).
     Re-medir con el query de tamaños (sum de `length(row_to_json(e)::text)` por paciente).
   - ✅ (2026-09-29) Comentarios que mentían: `ORIGEN_TEXTO` 'backfill' (pantalla de la visita),
     `lib/visitas.ts`, `packages/database/src/visitas.ts` y `agenda-agent/modules/expediente.ts`.
   - ⏳ **SIGUIENTE de esta lista:** la regla «mismo día / la fecha no cambia» se cuida sólo en la
     UI: el PUT de consultas acepta `encounterDate` aunque la consulta esté en una visita (el
     «Editar» ya la bloquea; una llamada directa a la API o una pantalla futura no). Arreglo: el PUT
     rechaza (409) cambiar la fecha de una consulta que vive en una visita, y «Traer aquí» /
     «Mover a…» en el servidor exigen el mismo día. Chico; smoke contra prod + review completo.
   - ✅ (2026-09-29) **Borrar una consulta, y editar su FECHA, recalculan «Última visita»** — pero
     SÓLO si esa consulta la fijaba (mismo día UTC; al editar, también si la nueva fecha la rebasa).
     Un helper en `encounters/[encounterId]/route.ts`. Motivo: la importación de pacientes también llena `lastVisitDate`, a
     veces sin consultas, y ésa no se toca. Medido en prod: 227/229 pacientes con día = su consulta
     más reciente (los 2 distintos: «test vistas lopez», de la prueba 3b, y uno de otro doctor —16 abr
     vs 13 abr—, probablemente este mismo bug de antes; ninguno se corrige solo). Smoke en
     transacción revertida con Guillermo: 27 ago → 18 ago.
3. ✅ **D6 — Manual de Ayuda + guías + `capabilities.ts`**: en el commit de lanzamiento (sección
   «Visitas» nueva, «Consultas» desde la visita, D5/D5b en Recetas/Docs/Notas, «Completar una
   cita»). Todas las «etiquetas» citadas se verificaron contra los `.tsx`.
4. ✅ **Exportar cuenta** (`apps/api/src/lib/exportar-cuenta.ts`) ya incluye visitas (2026-09-29,
   LFPDPPP, DISEÑO §9): `visitas.csv` (sólo si hay visitas), columna «Visita» en consultas/recetas/
   adjuntos.csv y sección «Visitas» + renglón «Visita» en cada expediente HTML. El día de una visita
   con cita es el de la CITA, leído igual que la app (slot primero). Etiqueta «AAAA-MM-DD HH:MM», con
   «(1)», «(2)» si dos visitas del mismo paciente chocan. Corrida real read-only contra prod: dr-prueba
   6 visitas bien; un doctor sin visitas no recibe `visitas.csv`. Servicio: **api**.
   - Barrido (punto 5) medido el 2026-09-29: **0 / 0 / 0** en las tres revisiones — hoy no hay nada
     que reparar; basta volver a correr el conteo justo antes de lanzar.
5. ✅ **Lanzamiento (2026-09-29):** `visitasUiActiva()` → `true` para todos (una línea, revertible),
   el botón de la Línea de Tiempo pasa a «Nueva Visita» (abre el modal en el perfil) y el texto
   (manual, guía, `capabilities.ts`) en el MISMO commit. Barrido re-medido justo antes: ver el
   mensaje del commit. ~~backfill~~ DESCARTADO. Regla del mismo día CONFIRMADA por el usuario.
6. Los títulos del modal de voz siguen diciendo «Nueva Consulta» a propósito (dictar una consulta
   sigue siendo eso); no se tocaron.

**Fase 2 (Tratamiento): plan APROBADO en `03-PLAN-fase-2.md` (2026-09-29)** — P1 estado derivado de
la cita (sólo `cancelada` se guarda), T1–T4 primero (sin dinero), dinero (T5–T6) después; §8 lista
los 11 huecos de la revisión y dónde se arregla cada uno. **✅ T1 aplicado en prod (2026-09-29):**
tablas `tratamientos` y `tratamiento_sesiones` vacías, verificadas por definición; P2 revisado en el
review (la sesión siempre guarda su visita). **Siguiente: T2 (la API).** Fase 3 (Progreso) — DISEÑO §8, nada construido.

## 4. Decisiones del usuario (no re-litigar)

- **Backfill DESCARTADO (2026-09-29):** "no me importan los que ya se crearon" — pocos doctores. Lo
  creado antes de las visitas se queda «Sin visita» (las plantillas viejas aparecen en «Consultas sin
  visita» y se pueden traer a una visita del MISMO día). Con eso cae la razón de la lista de dr-prueba
  (el backfill tenía que correr antes que los doctores); la lista se queda sólo hasta que D5b, exportar
  y el manual estén listos. `scripts/visitas/backfill-visitas.cjs` queda en el repo, sin correr.
- **D5 recortado + D5b (2026-09-29):** SIN etiquetas ni filtros en los libros mayores (redundantes con
  la pantalla de la visita). Sí: elegir la visita al CREAR fuera de ella (D5) y MOVER lo ya creado
  (D5b). Fotos/notas/recetas son agnósticas de fecha (el laboratorio del 15 entra en la visita del
  12); sólo las plantillas llevan la regla del mismo día.
- **Sugerencia = la visita más reciente de los ÚLTIMOS 7 DÍAS**, si no «Ninguna» (2026-09-29): meter
  en silencio algo en una visita de hace meses es peor que dejarlo suelto.
- **Una receta EMITIDA no cambia de visita** (2026-09-29): la ruta sólo edita borradores; no se toca.

- **D4 va detrás de una lista (sólo dr-prueba) hasta el lanzamiento** (2026-09-26). *(La razón
  original —el backfill antes que los doctores— cayó con el backfill, ver arriba.)* Crear la visita pasa por un MODAL (no al
  clic), y los «+» reusan las páginas que ya existen con `?visitaId=`.
- **Visitas NO tiene toggle propio**: hereda `expedientes`. Hora/servicio de la cita → `citas`; cobro
  → `flujo`; ligar una cita exige `citas`.
- **Ver DATOS no depende del plan**: `puedeVer` = dueño/admin todo, member = su toggle. El plan recorta
  FUNCIONES por ruta, no la lectura (con el techo, un dueño FREE dejaba de ver sus facturas).
- **Códigos de confirmación regenerados** (opción 1): los de correos viejos ya no cancelan en línea.
- **Las fugas de permisos que sólo afectan a AYUDANTES quedan aparcadas** ("estamos perdiendo mucho
  tiempo"): lista en `NUEVOS USUARIOS/05-COBERTURA-19-toggles.md` §"Fugas por CAMPO" (Mis Citas y el
  agente muestran montos con sólo `citas`; timeline muestra la hora de la cita; y una DECISIÓN pendiente:
  ¿los datos fiscales del paciente son de expediente o de facturación?). También pendiente: que
  Pendientes pinte los avisos `citasOcultas` / `citasIncompletas` que el servidor ya manda.

## 5. Trampas que ya se pisaron (no repetir)

- **`prisma db push` REVIERTE las FKs compuestas** de visitas y bookings. Migraciones = SQL manual.
- **El `_count` de Prisma sobre una relación arma `GROUP BY` sobre la tabla hija COMPLETA.** Usar
  `count()` / `groupBy` filtrado por paciente y visita.
- **El backfill corre UNA vez, ANTES de la UI, nunca después:** desde D3 «Sin visita» puede ser una
  decisión del doctor y re-correrlo la desharía sin auditoría.
- **`apps/api` NO tiene middleware de auth**: cada ruta se autentica sola; un GET que lo olvida es
  PÚBLICO. Toda ruta nueva de apps/api: `validateAuthToken` Y comparar dueño del recurso.
- **Un re-enganche "por paciente y día"** en D1 se probó y se QUITÓ: agarraba visitas de citas
  borradas o de otra cita del mismo día. Desligar el paciente deja la visita intacta.
- **Lo que no se puede ver correr** (reglas dentro de rutas que exigen sesión) se revisa en code
  review y se prueba a mano con la UI: en D4 probar mover SÓLO la visita de una consulta (no debe
  borrar `followUpDate`) y que mover una consulta arrastre sus fotos/recetas/informes.
- **D4 — «la fecha de una plantilla ES la de su visita» se cuida SÓLO en la UI** (02-PLAN §5.4): mover
  y traer ofrecen sólo el mismo día; con plantillas, la visita no cambia de fecha ni liga citas de otro
  día. Mover NO reescribe `encounterDate`. ✅ Regla CONFIRMADA por el usuario el 2026-09-29 (y ya la
  describe el manual).
- **`lastVisitDate` ya no se estampa con la consulta nueva:** se recalcula como la consulta más
  reciente (estamparla la movía hacia ATRÁS al agregar a una visita pasada; "sólo hacia adelante"
  dejaba pegada para siempre una fecha futura mal tecleada). Smoke read-only 2026-09-26: 8/8 iguales.
- **Varios archivos del expediente tienen fin de línea CRLF:** un reemplazo con `\n` en un script no
  encuentra nada y NO falla ruidoso. Usar la herramienta Edit o normalizar antes.
- Smoke tests contra prod: patrón en el scratchpad de la sesión (transacción que SIEMPRE revienta);
  `railway run --service pgvector …` con `DATABASE_PUBLIC_URL`; imports dinámicos en Windows con
  `file:///C:/…`. El clasificador a veces bloquea scripts que escriben en prod: el usuario los corre
  en SU PowerShell (sin `!`).

## 6. Proceso que el usuario espera

Plan antes de código → OK → código → type-check + `pnpm gates` + smoke contra prod → code review (y
review de los arreglos del review) → OK explícito para commit/push → verificar `commitHash` por
servicio en Railway. Hablarle en inglés; docs de esta carpeta en español.
