# NUEVOS USUARIOS — SESSION REFRESCO

> **Leer esto primero cada sesión.** Resumen operativo de estado + próximos pasos.
> Para el porqué y el detalle técnico: `00-REQUISITOS-usuarios-secundarios.md` (requisitos,
> CERRADOS), `01-DISENO-tecnico.md` (diseño + as-built + reviews de cada PR, incl. §16 con
> los 9 bugs del bug hunt), `02-METODO-review.md` (cómo se revisa cada PR de esta feature).

## Qué es

Usuarios secundarios (staff/asistentes) por portal de doctor, con 19 toggles de permiso
granulares (18 secciones del sidebar + "Asistente IA"), invitación explícita por email,
enforcement server-side en ambos apps (doctor + api).

## Estado ahora mismo (2026-07-21)

**Feature completa construida (PR A→D) + 3 rondas de bug hunt post-validación. Todo
PUSHEADO Y DESPLEGADO Y VERIFICADO 2026-07-21 (`345b2a09..14b1872c`):**

```
27c04273  fix: status-read endpoints (csd/status, fiel GET, connect/status) mal marcados OWNER_ONLY
0824a18d  fix: botón "Asistente" en /appointments no gateado
216e1606  fix: 3 widgets globales (ChatWidget, VoiceAssistantHubWidget, GoogleCalendarBanner) sin isOwner
3c89cd07  fix: los 8 paneles de chat legacy (*-chat) + 6 quick-actions del dashboard home sin isOwner
d8217f44  fix: voice/transcribe en Notas + form-builder-chat en custom-templates sin isOwner
4a18f7e8  docs: header + método del bug hunt (02-METODO §3.2)
```

Todo el código tiene tsc limpio. **Verificado con curl real usando el token de Andrea
post-deploy:** `GET /api/facturacion/csd/status` y `GET /api/sat-descarga/fiel` pasaron de
`403 PERMISSION_BLOCKED` a `200` con los datos correctos — los fixes están confirmados vivos
en prod, no solo pusheados. Ver el gotcha de deploy abajo — el push NO alcanzó por sí solo,
hizo falta un redeploy manual del servicio `@healthcare/api`.

**Ronda paso-4 (2026-07-21, `c9ad9b60`+`99ce4cb5`, PUSHEADO+DESPLEGADO+VERIFICADO EN VIVO):**
arrancando el paso 4 apareció un bug de **familia NUEVA** — el ingreso de completar una cita se
creaba con un SEGUNDO POST del cliente al endpoint flujo-gated, así que un member con `citas` sin
`flujo` recibía 403 y el ingreso se perdía en silencio. Fix: el ingreso pasa a ser efecto
server-side de la PATCH de completar (detalle completo en **01-DISENO §17 hallazgo 6**). El bug
hunt de la misma familia gateó 2 superficies cross-block más (checkbox "Emitir factura" en el
modal de completar → `facturacion`; "vincular CFDI a movimiento existente" en SAT → `flujo`).
Deploy verificado per-service: `@healthcare/api` y `@healthcare/doctor` en HEAD `99ce4cb5`, ambos
SUCCESS. **Ojo:** este fix tiene dependencia dura api↔doctor — el cliente nuevo ya NO hace el POST
viejo, así que si el api no despliega, TODA completación (owners incluidos) pierde el ingreso;
siempre verificar que `@healthcare/api` llegue a SUCCESS antes de darlo por vivo.

**Confirmado funcionalmente en vivo (2026-07-21):** (A2) member vía el **agente** — Andrea (sin
`flujo`) completó una cita a futuro (Pepito López, $1,500 efectivo) → fila `ledger_entries`
verificada read-only en prod: `origin='cita'`, monto/área (`Ingresos Consulta`)/subárea/paciente
correctos, `has_comprobante=false`, `doctor_id`=OWNER (no Andrea), `transaction_date`=fecha de la
cita. (A2b) member vía el **botón "Completar" de la tabla** — WORKED. (A1) **regresión owner** —
dr-prueba completa una cita → una sola fila de ingreso, correcta — WORKED. **El fix está cerrado.**

**Commits de docs COMMITEADOS PERO SIN PUSHEAR** (el código `99ce4cb5` sí está vivo): `cf8a97e6`
(docs NUEVOS USUARIOS: §17 + este REFRESCO) y `2d7fe6fd` (docs AGENTE AGENDA: bug conocido "card
fantasma"). Pushearlos cuando se retome (son solo docs, sin efecto en prod).

## Validación en vivo — dónde se quedó

Método: dr-prueba = OWNER (doctor de prueba, `cmni1bov90000mk0lyeztr3ad`), `andreabarbagal@gmail.com`
= MEMBER real (login real, no simulado). Checklist completo en `01-DISENO §9`.

**Hecho y confirmado (pasos 1-3 y 7):**
1. Invitar → aceptar → `doctor_members` correcto (verificado en prod read-only).
2. Página bloqueada por URL → "sin acceso"; endpoint bloqueado curl con token real de Andrea
   → `403 PERMISSION_BLOCKED`; endpoint permitido → `200`. Cita creada por Andrea sincronizó
   al Calendar del OWNER (no el de ella — confirma diseño "Google del member = solo
   identidad").
3. Toggle en vivo (`facturacion`+`sat`) → sidebar de Andrea se actualizó en el siguiente
   request, sin re-login. (Esto es lo que expuso el hallazgo 1 — ver 01-DISENO §16.)
7. Owner: cero cambios observados en todo lo probado.

**Pendiente:**
4. ✅ **CERRADO** — ver arriba (fix del ingreso de cita shippeado + verificado en vivo: agente,
   botón de tabla, regresión owner). Sub-pruebas menores DIFERIDAS (no bloquean, todas son
   polish respaldado por el 403 server-side; la pérdida de datos ya se corrigió y verificó):
   - **A3 idempotencia** (completar una cita ya pagada vía link → toast "ya estaba registrado",
     sin duplicar): el usuario no supo cómo montarlo → diferido.
   - **B1 gate SAT** (`sat` sin `flujo`, en Descarga SAT: "Registrar" un CFDI que tenga entradas
     similares → nota "necesitas permiso de Flujo de Dinero", sin lista, "Crear nuevo" funciona):
     difícil de disparar (necesita un CFDI cuyo monto/fecha matchee una entrada existente) →
     diferido. Verificado por código + tsc, no en vivo.
   - **B2 gate checkbox factura** (`facturacion` OFF: el checkbox "Emitir factura (CFDI)" del
     modal Completar desaparece): NO probado en vivo. Requiere (i) un paciente con datos fiscales
     completos en el booking y (ii) owner poner `facturacion` OFF a Andrea (ahora está ON). Pasos
     exactos en el chat de esta sesión / abajo en "Qué sigue".
5. Owner revoca a Andrea → verificar pantalla "Acceso revocado"; re-invitar a Andrea (mismo
   portal u otro) → verificar que el slot se liberó y el flujo de re-invitación funciona
   (esto es justo lo que el fix de `dashboard/layout.tsx` en PR D corrigió — confirmarlo en
   vivo cierra ese hallazgo). **PENDIENTE.**
6. Revisar `member_audit_log` en prod — debe tener SOLO los writes de Andrea, con el
   `toggle_key` correcto en cada fila. **PENDIENTE.** Nota: tras el fix del ingreso de cita, una
   completación de member = UN solo write auditado (la PATCH de `citas`), SIN fila de `flujo`
   aparte (los 403 nunca se auditan) — eso es lo esperado, no un hueco.

## Qué sigue (en orden)

0. **PUSHEAR los 2 commits de docs** (`cf8a97e6`, `2d7fe6fd`) — están locales, sin pushear.
1. **Pasos 5-6 de la validación en vivo** (revoke/re-invite + audit log) — lo único de la
   validación que aún importa. Método read-only: `reference_prod_db_tooling` (memoria) —
   scratchpad `.cjs` + `railway run --service pgvector`.
2. **B2 (gate del checkbox de factura)** si se quiere cerrar el polish: (a) como Andrea con
   `facturacion` ON, abrir **Completar** en un booking cuyo paciente TENGA datos fiscales →
   el checkbox "Emitir factura (CFDI)" debe aparecer; (b) owner pone `facturacion` OFF a
   Andrea; (c) reabrir Completar → el checkbox debe DESAPARECER. B1 (SAT) y A3 (idempotencia)
   quedaron diferidos por ser difíciles de montar (ver paso 4 arriba).
3. **Correr la suite de evals del agente** (60 casos, gasto real de API, nunca corrida
   todavía) — sobre todo para probar PR C (filtrado de módulos), que solo tiene la garantía
   de identidad de bytes para el owner, cero evals para el path de member. Aprovechar para
   sembrar un eval del path member de completar-cita (ingreso server-side).
4. **Fix de la "card fantasma" del agente** (bug conocido, ver AGENTE AGENDA SESSION-REFRESCO
   bitácora #23): guardarraíl de prompt para que el agente no anuncie una card antes de llamar
   `propose_*`. Es su propia pasada (cambia bytes del prompt → cache + evals).
5. **Fuera de alcance v1** (ver 00-REQUISITOS §7): multi-portal, caps de presupuesto IA por
   member, borradores de receta por members, transferencia de ownership.

**Estado de datos de prueba en prod:** dr-prueba (`cmni1bov90000mk0lyeztr3ad`) = OWNER;
`andreabarbagal@gmail.com` = MEMBER ACTIVE con `citas`/`sat`/`facturacion`/`expedientes`/
`tareas`/`notas`/`ayuda`/`asistente_ia` ON y `flujo`/`pagos`/`conciliacion` OFF. Se crearon
varias citas COMPLETADAS de prueba con sus ingresos (Pepito López $1,500, y las de A1/A2) —
limpiar si estorban.

## Gotchas para la próxima sesión

- **⚠️ El push a `main` NO garantiza que TODOS los servicios de Railway se desplieguen.**
  Descubierto en vivo 2026-07-21: tras pushear los 6 commits de fixes, `@healthcare/doctor`
  se redesplegó automáticamente (`railway status --json` mostraba su `latestDeployment.meta.commitHash`
  ya en el nuevo commit), pero **`@healthcare/api` se quedó silenciosamente en el commit
  viejo** — sin error, sin aviso, el dashboard no lo señala como fallido, simplemente nunca
  disparó el auto-deploy. Esto causó una validación en vivo confusa: la UI de Andrea se veía
  actualizada (porque el doctor app SÍ desplegó) pero los endpoints seguían bloqueados
  (porque el api NO había desplegado) — parecía un bug de lógica cuando en realidad era un
  servicio entero corriendo código de ayer.
  - **Cómo detectarlo:** `railway status --json` (con el servicio correcto linkeado) →
    buscar `"serviceName"` + el `commitHash` de su `latestDeployment.meta` — compararlo
    contra `git rev-parse HEAD`. Si no coincide, ese servicio no desplegó.
  - **Cómo NO arreglarlo:** `railway redeploy` **no sirve** — solo re-corre el build del
    ÚLTIMO deployment ya registrado (el commit viejo), no jala el commit nuevo de git.
  - **Cómo SÍ arreglarlo:** `railway up` (con el CLI linkeado al servicio correcto y el
    directorio local en el mismo commit que `origin/main`) — sube y despliega el código
    LOCAL directo, sin pasar por el trigger de git. Confirmar éxito con `railway status
    --json` (commitHash correcto + status SUCCESS) — el status puede quedarse en
    "BUILDING" un rato incluso después de que el build log muestre "image push" terminado
    (el rollout/healthcheck post-build tarda aparte); no asumir que terminó hasta ver
    `SUCCESS`, y verificar con una prueba real (curl con token) — no solo con el status.
  - **No investigado todavía:** POR QUÉ el auto-deploy de `@healthcare/api` no se disparó
    esa vez — podría ser un problema de webhook/integración de GitHub específico de ese
    servicio en Railway. Vale la pena revisarlo si vuelve a pasar.

- **`prisma db push` contra Railway revierte** el composite FK de bookings Y los índices
  parciales de `doctor_members` (uno-activo-por-user, uno-owner-por-doctor) — nunca correrlo
  sin re-aplicar `add-booking-patient-composite-fk.sql` después (`database-architecture.md §6`).
- **El patrón de bug de esta sesión** (superficie owner-only alcanzable sin guard) puede
  reaparecer si se agrega una nueva feature de IA/voz — antes de darla por segura, aplicar
  el método de 02-METODO §3.2 (grep por componente compartido Y por ruta de API cruda).
- **dr-prueba y andreabarbagal@gmail.com son datos de prueba reales en prod** (no un
  sandbox separado) — la membresía de Andrea sigue ACTIVA en prod ahora mismo; si se
  necesita un estado limpio para seguir probando, revocarla o dejarla como está a propósito
  para retomar el paso 5.
- **Ultra**: quedan 1 de 3 ejecuciones gratis (se usaron 2: una en PR A, otra en B+C+D). Los
  6 commits de esta ronda de bug-hunt NO pasaron por ultra — solo review inline (justificado:
  son fixes de gate de UI, mecánicos y de bajo riesgo cada uno, no lógica replicada ni
  contenido que afirma hechos — ver la heurística de clasificación en 02-METODO §1).

## Contexto rápido para orientarse en el código

- Registry de permisos: `packages/database/src/permissions.ts` (19 claves) +
  `route-permissions.ts` (mapa ruta→toggle, ambas apps) + `membership.ts` (resolución
  efectiva de doctorId/isOwner/permissions).
- Enforcement: dentro de `apps/api/src/lib/auth.ts` (`validateAuthToken`) y
  `apps/doctor/src/lib/medical-auth.ts` (`requireDoctorAuth`/`requireOwnerAuth`/`requireAnyAuth`).
- UI courtesy: `apps/doctor/src/lib/permissions-client.ts` (`usePermissions()` hook) — es
  el hook que TODOS los fixes de esta sesión usan para esconder botones/features.
- Agente: `apps/doctor/src/lib/agenda-agent/modules/registry.ts` (`enabledModules`,
  `AGENT_MODULE_REQUIREMENTS`) + `prompt.ts` (`buildSystemPrompt` memoizado).
- Equipo/invitaciones: `apps/doctor/src/app/api/team/*` + `TeamSection.tsx` (pestaña Equipo
  en mi-perfil) + `/invitacion` (pantalla de aceptar/rechazar).
- Scripts de gate (correr antes de cada push que toque este mapa):
  `scripts/check-route-permission-coverage.ts` (inventario de rutas) y
  `scripts/check-agent-prompt-identity.ts` (identidad de bytes del prompt del agente).
