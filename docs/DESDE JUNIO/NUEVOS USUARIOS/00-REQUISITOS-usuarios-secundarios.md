# NUEVOS USUARIOS — Requisitos: usuarios secundarios con permisos por bloque

> **Estado:** REQUISITOS CERRADOS 2026-07-20 (sesión con el usuario; 5 decisiones finales aprobadas).
> Ningún código escrito aún. Siguiente paso: diseño técnico (`01-DISENO-*.md`).
>
> **Qué es:** hoy cada cuenta de doctor permite UN solo usuario (Google OAuth, 1:1 vía
> `User.doctorId @unique`). Esta feature permite que el usuario principal (dueño) invite a
> usuarios secundarios (asistentes, staff) a su portal, y que les active/desactive el acceso a
> funciones por bloque — incluyendo qué módulos del agente IA ven.

---

## 1. Modelo de datos y alcance v1

### 1.1 Decisión de arquitectura (Opción A — aprobada)

- **Nueva tabla `doctor_members`**: `user_id`, `doctor_id`, `role (OWNER | MEMBER)`,
  `permissions` (JSON de toggles), `invited_by`, timestamps.
- Los doctores existentes se **backfillean** como filas `OWNER` a partir de `User.doctorId`.
- **v1: constraint `UNIQUE(user_id)`** — un gmail pertenece a UN solo portal. El caso
  "misma asistente para dos doctores" queda fuera de v1 (workaround: segundo gmail).
  Habilitarlo después = quitar el constraint + construir picker/switcher de portal
  (cero migración de datos). Ese fue el motivo de elegir tabla desde el día 1.
- **Fuente de verdad: la tabla de membresías** (G11). `User.doctorId` se mantiene como columna
  legacy sincronizada para owners durante la transición; el read path canónico resuelve
  membresía PRIMERO. El diseño debe elegir un único punto de resolución para evitar drift.

### 1.2 La cintura estrecha (verificado en código 2026-07-20)

Solo hay **tres puntos** donde se resuelve "como quién actúo"; si esos tres resuelven
doctorId efectivo + permisos desde `doctor_members`, el resto del código (cientos de rutas)
funciona sin tocarse:

1. **Callback `session()` de NextAuth** (`packages/auth/src/nextauth-config.ts`) — alimenta
   todas las páginas del doctor app y las rutas internas vía `medical-auth.ts` (lee
   `user.doctorId` de la sesión).
2. **`validateAuthToken` en `apps/api/src/lib/auth.ts`** — busca el User por email en CADA
   request (líneas 65-96) y lee `doctorId` de la fila.
3. **Minteo de token del agente** (`api-token.ts`) — mintea por email; el API lo resuelve
   con el punto 2, así que queda cubierto.

Bonus ya resuelto: Calendar/email se buscan **por doctorId, no por usuario actuante**
(`getCalendarTokens(doctorId)` en `apps/api/src/lib/appointments-utils.ts`) → la decisión
"siempre los tokens del dueño" (§4) se cumple automáticamente, cero cambios.

La app usa **database sessions** (NextAuth v5, `strategy: "database"`) — cada request hace
lookup a BD, por eso los cambios de permisos y las revocaciones aplican en el siguiente
request sin re-login (§3.3).

---

## 2. Invitaciones y ciclo de vida

### 2.1 Flujo de invitación

- El dueño invita **por email** desde una nueva pestaña **"Equipo"** en `/dashboard/mi-perfil`
  (pestaña siempre owner-only, ver §3.4).
- La invitación crea una fila pendiente con los toggles elegidos + **expiración** + opción de
  **revocar** antes de aceptarse.
- **G1 — aceptación EXPLÍCITA, nunca auto-attach:** cuando el gmail invitado inicia sesión,
  ve una pantalla "Dr. X te invitó a su portal — Aceptar / Rechazar". Un typo en el email NO
  puede regalar acceso a datos de pacientes en silencio.
- Normalización de email: comparación en lowercase. **NO** hacer dot-folding de gmail.

### 2.2 Colisiones con el onboarding de doctores (G2)

- Gmail invitado que **ya es dueño de un portal** → invitación rechazada al aceptar (regla
  v1 un-portal). El check se hace en el accept, no solo al crear el invite.
- Gmail que **ya es member ACTIVE de otro portal** → otro doctor SÍ puede crear la invitación
  (queda `PENDING`), pero el accept la rechaza con 409 mientras siga activa en otro lado;
  además el layout no le muestra el invite automáticamente porque tiene doctorId efectivo.
  Walkthrough end-to-end verificado contra código en `01-DISENO §6.3`.
- Un member que después quiere su **propio portal** → primero debe salir de la membresía.
- El layout del dashboard tiene un auto-refresh cuando `session.user.doctorId` es null
  (`apps/doctor/src/app/dashboard/layout.tsx:48-54`) — los members DEBEN recibir el doctorId
  efectivo en la sesión o caen en ese loop.
- Un member **removido** ve una pantalla "sin acceso" distinta — NUNCA el flujo de onboarding
  de crear-perfil-de-doctor.

### 2.3 Remoción y lockout

- El dueño puede remover un member en cualquier momento (borrar la fila de membresía).
- Lockout inmediato garantizado por el lookup por-request (§1.2): sin fila de membresía, el
  siguiente request no resuelve doctor → pantalla "sin acceso".
- Un gmail removido queda libre para ser invitado a otro portal (se libera el slot UNIQUE).

---

## 3. Permisos

### 3.1 Granularidad: toggle por ítem del sidebar (decisión del usuario)

Un toggle ON/OFF por cada ítem, editable por el dueño **en cualquier momento** (aplican en el
siguiente request del member — sin re-login, garantizado por database sessions + lookup
por-request). Lista v1 (19 toggles):

| # | Toggle | Notas |
|---|---|---|
| 1 | Editar Perfil | Aun ON: pestañas Equipo e Integraciones siempre owner-only (§3.4) |
| 2 | Perfil Público | Solo esconde el link externo (la página pública es pública) |
| 3 | Contenido Audiovisual | |
| 4 | Mi Blog | |
| 5 | Mis Citas | |
| 6 | Expedientes Médicos | Emisión de recetas SIEMPRE owner-only aunque esté ON (§3.5) |
| 7 | Tareas | |
| 8 | Notas | |
| 9 | Reportes | Muestra datos de dinero — coherencia con Flujo es responsabilidad del dueño |
| 10 | Flujo de Dinero | |
| 11 | Pagos | |
| 12 | Facturación | Emitir CFDI con el CSD del doctor SÍ permitido (práctica normal de asistentes) |
| 13 | Descarga SAT | |
| 14 | Conciliación Bancaria | |
| 15 | Ventas | |
| 16 | Compras | |
| 17 | Productos y Servicios | |
| 18 | Ayuda | |
| 19 | **Asistente IA** | Toggle maestro del agente (G3, §5) — no existe como ítem del sidebar |

### 3.2 Defaults al invitar (aprobado)

El diálogo de invitación muestra los 19 toggles, prellenados con el default seguro:
**ON: Mis Citas, Tareas, Notas, Ayuda. OFF: todo lo demás** (clínico + dinero + perfil + IA).
El dueño ajusta antes de enviar.

### 3.3 Enforcement — tres superficies, server-side manda

1. **UI**: esconder ítems del sidebar / páginas bloqueadas (cortesía, no seguridad).
2. **API**: el enforcement REAL. Por **familia de rutas** mapeada a cada toggle (no por ruta
   individual) en los puntos de resolución de §1.2. Un member con token válido no puede
   llamar endpoints de un bloque OFF.
3. **Agente**: composición de módulos filtrada por permisos (§5).

### 3.4 Zonas owner-only permanentes (sin toggle)

- **Pestaña Equipo** (mi-perfil): un member con Editar Perfil ON no puede editar sus propios
  permisos (escalación).
- **Pestaña Integraciones** (mi-perfil): es la conexión Google del dueño.
- **Emisión de recetas** (§3.5).
- **Superficies IA legacy** (§5.3).

### 3.5 Recetas — acto legal del doctor (G4, aprobado)

El sistema de recetas estampa automáticamente la **firma + cédula del doctor** al emitir.
Prescribir es un acto legalmente reservado al clínico. Por lo tanto: **emitir recetas es
owner-only SIEMPRE**, sin importar el toggle de Expedientes. (Members pueden en todo caso
capturar borradores en v2 — fuera de alcance v1.) La pestaña **Receta PDF** de mi-perfil
(identidad/firma del doctor) cae bajo la misma regla: owner-only.

**Contraste explícito:** emitir CFDI con el CSD del doctor NO se restringe (toggle
Facturación normal) — que asistentes facturen es práctica estándar.

### 3.6 Dependencias cross-block — la regla (G5, aprobado)

**Un toggle gobierna su superficie de usuario (página + su familia de rutas); los efectos
internos de una acción permitida siempre proceden.** Ejemplos:

- Completar una cita crea su LedgerEntry aunque Flujo de Dinero esté OFF.
- Emitir factura escribe al ledger aunque Flujo esté OFF.
- **Regla de metadatos aprobada:** member con Mis Citas ON pero Expedientes OFF SÍ puede usar
  "Buscar paciente" para ligar expedientes desde la tabla de citas (ve nombres de pacientes —
  tier metadatos), pero las páginas/rutas de medical-records quedan bloqueadas (nada clínico).

### 3.7 Registry único fail-closed (G9)

UNA constante registry define los 19 toggles y alimenta a los 4 consumidores: sidebar,
diálogo de Equipo, mapa ruta→toggle del API, y mapeo de módulos del agente. **Clave
desconocida (features futuras) = OFF para members.** Sin registry único, los 4 driftean.

---

## 4. Google del member = solo identidad (aprobado)

- Los eventos de Calendar y los emails salientes usan SIEMPRE los tokens del dueño (ya
  automático, §1.2 bonus).
- **G7 aceptado en v1:** el provider único pide scopes calendar + gmail.send a todos; los
  members los otorgan sin que se usen. Opcional barato: no copiar tokens de members en el
  signIn callback. Camino de login con scopes reducidos = v2.

---

## 5. Agente IA

### 5.1 Toggle maestro (G3, aprobado)

**Asistente IA** = toggle 19. OFF → el panel no existe para ese member. ON → módulos según §5.2.

### 5.2 Regla de mapeo módulo↔toggles (conservadora, aprobada)

Un módulo del agente se habilita **solo si TODOS sus ítems de sidebar mapeados están ON**:

| Módulo agente | Requiere ON |
|---|---|
| agenda | Mis Citas |
| expediente | Expedientes Médicos |
| flujo | Flujo de Dinero + Pagos + Conciliación Bancaria |
| facturas | Facturación + Descarga SAT |
| fiscal | Facturación + Descarga SAT |

- Módulo bloqueado = **removido por completo** (reads Y proposals no existen en la
  composición; el prompt dice que el tema no está disponible en esta cuenta). Nada de
  "reads sí, writes no" — filtraría datos que la UI esconde.
- Set de módulos vacío con toggle IA ON → el panel se esconde igual.
- El agente recoge cambios de permisos en el siguiente mensaje (composición por-request +
  token por-turno).

### 5.3 Superficies IA legacy = owner-only (aprobado)

ChatWidget v1 (vivo hasta PR 4), voice assistant, y los 8 endpoints hermanos `*-chat`
(encounter/patient/prescription/sale/purchase/quotation/task/ledger): **owner-only en v1**.
Solo el panel nuevo es elegible para members.

### 5.4 Presupuesto compartido (G8, aceptado v1)

`llm_token_usage` y el cap diario van por doctorId → members consumen el presupuesto del
dueño (visible en la barra de "Uso de hoy"). Caps por member = v2.

---

## 6. Auditoría (G6 — opción b aprobada)

**Tabla `audit_log` barata, escrita en la capa de auth del API solo para writes iniciados
por members:** ruta, método, user_id, doctor_id, timestamp — SIN body. Un insert a nivel
middleware. Nada de columnas `created_by` por tabla en v1 (caro, toca demasiadas tablas).
Contexto salud + dinero hace inevitables las preguntas "¿quién hizo esto?".

---

## 7. Fuera de alcance v1 (explícito)

- Multi-portal (mismo gmail en N portales) — la tabla ya lo permite, falta picker/switcher.
- Caps de presupuesto IA por member.
- Login con scopes Google reducidos para members.
- Borradores de receta por members.
- Transferencia de ownership de un portal.
- Warnings de coherencia entre toggles (ej. Reportes ON + Flujo OFF filtra números).
- Auditoría con columnas `created_by` / diff de cambios.
- Retirar superficies IA legacy (eso es PR 4 del proyecto agentes, no de esta feature).

---

## 8. Riesgos / gotchas conocidos para el diseño

1. **Prod directo:** main deploya a prod sin staging. La migración `doctor_members` +
   `audit_log` va por SQL aplicado a prod ANTES del push (convención del repo), y todo query
   shape nuevo se smoke-testea read-only vía railway (`TOOLING-acceso-railway-db*.md`).
2. **`prisma db push` revierte el composite FK** de bookings (conocido) — re-aplicar
   `add-booking-patient-composite-fk.sql` si alguien lo corre.
3. El **dashboard home** (`/dashboard/page.tsx`) puede agregar datos de varios bloques —
   revisar en diseño si necesita gating por widget.
4. Sesiones UI de mi-perfil: cada usuario ve SUS sesiones (per-user, sin cambio); el kill
   switch por member = remoción de membresía (§2.3), no sessionVersion.
5. ADMIN_EMAILS / role ADMIN: sin interacción con esta feature (verificar en diseño que las
   rutas admin no pasen por el mapa de permisos).
6. `pnpm-lock.yaml`: cualquier dep nueva regenera el lockfile en el mismo commit (Railway
   frozen-lockfile).

---

*Creado 2026-07-20. Decisiones tomadas en sesión: opción A de modelo, granularidad por ítem
de sidebar (18 + toggle IA), módulo-removido-completo para el agente, tokens Google siempre
del dueño, recetas owner-only, audit_log barato, regla de metadatos para pacientes, defaults
seguros al invitar.*
