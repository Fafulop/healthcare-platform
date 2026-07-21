# NUEVOS USUARIOS — Diseño técnico

> **⚠️ CANONICAL LIVE HANDOFF (leer primero cada sesión):**
> [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) — estado actual, qué falta de la validación
> en vivo, y qué sigue. Este doc (01-DISENO) es la referencia técnica profunda; el REFRESCO
> es el resumen operativo.
>
> **Estado:** DISEÑO 2026-07-20, implementación EN CURSO. Requisitos cerrados en
> [`00-REQUISITOS-usuarios-secundarios.md`](00-REQUISITOS-usuarios-secundarios.md).
> Todo lo citado aquí (archivos, líneas, rutas) fue verificado en código el 2026-07-20.
>
> **PR A-D SHIPPED** (`d6c48256`..`345b2a09`, 2026-07-20/21) — feature completa en prod.
> `/code-review ultra` sobre B+C+D: 0 findings en B/C, 4 CONFIRMED en D (§15), corregidos
> y pusheados junto con el resto. **Validación en vivo EN CURSO 2026-07-21** (dr-prueba +
> segundo gmail real como member, andreabarbagal@gmail.com) — pasos 1-3+7 de §9
> confirmados limpios; 3 rondas de bug hunt dirigido (§16, hallazgos 1-5) encontraron
> **9 bugs reales de la misma familia** (superficies owner-only expuestas a members sin
> guard) y los corrigió. **6 commits COMMITEADOS, sin pushear todavía:** `27c04273`,
> `0824a18d`, `216e1606`, `3c89cd07`, `d8217f44`, `4a18f7e8`. Pendiente: pasos 4-6 de §9 +
> OK del usuario para push — detalle exacto de qué falta en SESSION-REFRESCO.md.
>
> Convenciones de BD según `docs/NEW.MD-GUIDES/database-architecture.md`: NO `prisma db push`;
> migraciones SQL standalone idempotentes, aplicadas a Railway ANTES de pushear el código;
> smoke read-only vía script tsx temporal en `packages/database/` (o .cjs en scratchpad +
> `railway run --service pgvector`).

---

## 1. Modelo de datos

### 1.1 `public.doctor_members` — membresías (fuente de verdad)

```sql
-- Migration: add-doctor-members.sql
-- Purpose: usuarios secundarios por portal + permisos por bloque
-- Date: 2026-07-XX

CREATE TABLE IF NOT EXISTS public.doctor_members (
    id           TEXT PRIMARY KEY,                    -- cuid generado por Prisma
    user_id      TEXT NOT NULL,
    doctor_id    TEXT NOT NULL,
    role         VARCHAR(10) NOT NULL,                -- 'OWNER' | 'MEMBER'
    status       VARCHAR(10) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'REVOKED'
    permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,  -- { "<toggleKey>": true|false } — ausente = false (fail-closed)
    invited_by   TEXT,                                -- user_id del dueño que invitó (NULL para OWNER backfill)
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at   TIMESTAMP(3),

    CONSTRAINT doctor_members_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT doctor_members_doctor_id_fkey FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT doctor_members_role_chk CHECK (role IN ('OWNER','MEMBER')),
    CONSTRAINT doctor_members_status_chk CHECK (status IN ('ACTIVE','REVOKED'))
);

-- Regla v1 "un gmail = un portal": PARCIAL sobre ACTIVE.
-- Revocados no ocupan slot (pueden ser invitados a otro portal después).
-- Quitar este índice = paso 1 de multi-portal (v2), cero migración de datos.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_active_per_user
    ON public.doctor_members(user_id) WHERE status = 'ACTIVE';

-- Un solo OWNER activo por doctor.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_owner_per_doctor
    ON public.doctor_members(doctor_id) WHERE role = 'OWNER' AND status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS doctor_members_doctor_idx ON public.doctor_members(doctor_id);

-- BACKFILL: cada doctor existente con User linkeado se vuelve OWNER.
INSERT INTO public.doctor_members (id, user_id, doctor_id, role, status, permissions)
SELECT 'dm_' || u.id, u.id, u.doctor_id, 'OWNER', 'ACTIVE', '{}'::jsonb
FROM public.users u
WHERE u.doctor_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

Notas:
- **`permissions` del OWNER se ignora** (el owner siempre tiene todo); vive en la fila por
  uniformidad, no se lee.
- **`status = 'REVOKED'` en vez de borrar la fila**: (a) el member removido ve la pantalla
  "acceso revocado" en lugar de caer al onboarding de crear-doctor (requisito G2), (b) queda
  rastro de que existió, (c) el índice parcial libera su slot UNIQUE automáticamente.
- `User.doctorId` NO se toca: queda como columna legacy de owners. El read path canónico es
  membresía-primero con fallback a la columna (§3.1) — así el deploy de PR-A es un no-op
  para todos los usuarios existentes aunque el backfill fallara en una fila.

### 1.2 `public.member_invites` — invitaciones

```sql
CREATE TABLE IF NOT EXISTS public.member_invites (
    id           TEXT PRIMARY KEY,
    doctor_id    TEXT NOT NULL,
    email        TEXT NOT NULL,                        -- SIEMPRE lowercase (normalización única; sin dot-folding)
    permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- toggles elegidos al invitar
    status       VARCHAR(10) NOT NULL DEFAULT 'PENDING', -- PENDING|ACCEPTED|DECLINED|REVOKED|EXPIRED
    invited_by   TEXT NOT NULL,                        -- user_id del owner
    expires_at   TIMESTAMP(3) NOT NULL,                -- created_at + 7 días
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP(3),

    CONSTRAINT member_invites_doctor_id_fkey FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id) ON DELETE CASCADE,
    CONSTRAINT member_invites_status_chk
        CHECK (status IN ('PENDING','ACCEPTED','DECLINED','REVOKED','EXPIRED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS member_invites_one_pending
    ON public.member_invites(doctor_id, email) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS member_invites_email_idx ON public.member_invites(email);
```

- v1 **no envía email**: la invitación aparece cuando ese gmail inicia sesión (§6.2). El
  dueño avisa a su asistente por su cuenta. (Mandar email real con los tokens del dueño =
  nicety v2 — decisión menor abierta.)
- `EXPIRED` se marca lazy: al leerla (login del invitado o lista del owner), si
  `expires_at < now()` se trata como expirada.

### 1.3 `public.member_audit_log` — auditoría barata (G6, opción b)

Modelada sobre el patrón existente `PatientAuditLog` (schema.prisma:2115 — ya existe
auditoría por-paciente con userId/userRole en medical records; esta tabla cubre el resto).

```sql
CREATE TABLE IF NOT EXISTS public.member_audit_log (
    id         BIGSERIAL PRIMARY KEY,
    doctor_id  TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    method     VARCHAR(8) NOT NULL,       -- POST/PUT/PATCH/DELETE
    path       VARCHAR(300) NOT NULL,     -- pathname, sin query string, SIN body
    toggle_key VARCHAR(40),               -- toggle que autorizó el write (NULL = allowlist neutral)
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS member_audit_doctor_idx ON public.member_audit_log(doctor_id, created_at);
```

- Se escribe **solo para writes de MEMBERS** (métodos mutantes), en los dos choke points de
  enforcement (§4), fire-and-forget (`.catch(console.error)`, nunca rompe el request — mismo
  patrón que `logAudit` en medical-auth.ts:83).
- Sin retention job en v1 (deuda compartida con `llm_token_usage` / `agent_tool_errors`).

### 1.4 Prisma models

Espejo de las tablas en `schema.prisma` (`@@schema("public")`, `@@map` correspondientes),
con relaciones `User.memberships DoctorMember[]` y `Doctor.members DoctorMember[]`.
⚠️ Los índices parciales (one_active_per_user, one_owner_per_doctor, one_pending) **no son
expresables en Prisma** → solo en el SQL. NO corren `prisma db push` contra Railway (además
del composite FK conocido, ahora también dropearía estos índices… no: Prisma ignora índices
que no modela — pero el riesgo del composite FK sigue; ver database-architecture.md §6).

---

## 2. Registry de permisos — una sola constante

**Ubicación: `packages/database/src/permissions.ts`** (exportada desde `@healthcare/database`)
— es el único paquete que ya importan los dos consumidores (apps/doctor y apps/api).

```ts
export const PERMISSION_KEYS = [
  'perfil', 'perfil_publico', 'contenido', 'blog',
  'citas', 'expedientes', 'tareas', 'notas', 'reportes',
  'flujo', 'pagos', 'facturacion', 'sat', 'conciliacion',
  'ventas', 'compras', 'productos', 'ayuda',
  'asistente_ia',
] as const;
export type PermissionKey = typeof PERMISSION_KEYS[number];

export const INVITE_DEFAULTS: Record<PermissionKey, boolean> = {
  citas: true, tareas: true, notas: true, ayuda: true,
  /* todo lo demás */ ...: false,
};

export function hasPermission(perms: unknown, key: PermissionKey): boolean {
  return perms != null && typeof perms === 'object' && (perms as any)[key] === true;
  // fail-closed: clave ausente/desconocida/valor no-true = false (requisito G9)
}
```

Los **4 consumidores** derivan de aquí: sidebar (§5.1), diálogo Equipo (§6.1), mapa
ruta→toggle (§4.3), mapeo módulos del agente (§7.1). Prohibido duplicar la lista.

---

## 3. Capa de resolución (la cintura estrecha)

### 3.1 Helper compartido

`packages/database/src/membership.ts`:

```ts
export interface EffectiveAccess {
  doctorId: string | null;     // doctor efectivo (membresía ACTIVE, fallback User.doctorId)
  isOwner: boolean;            // role OWNER o resuelto por fallback legacy
  permissions: Record<string, boolean> | null;  // null para owner (= todo)
  membershipRevoked: boolean;  // true si NO hay ACTIVE pero existe REVOKED (pantalla "acceso revocado")
}

export async function resolveEffectiveAccess(prisma, userId, legacyDoctorId): Promise<EffectiveAccess>
```

Lógica: membresía `ACTIVE` primero → si no hay, fallback `legacyDoctorId` como owner (cubre
cualquier fila no backfilleada; deploy no-op) → si tampoco, buscar `REVOKED` para el flag.
Una sola query a `doctor_members` por request (índice parcial la hace barata).

### 3.2 Punto 1 — callback `session()` (packages/auth/src/nextauth-config.ts:75)

```ts
const access = await resolveEffectiveAccess(prisma, user.id, user.doctorId);
session.user.doctorId = access.doctorId;          // ← doctorId EFECTIVO (antes: user.doctorId crudo)
session.user.isOwner = access.isOwner;
session.user.permissions = access.permissions;    // null = owner
session.user.membershipRevoked = access.membershipRevoked;
```

- Con database sessions este callback corre **en cada request** → toggles y revocaciones
  aplican al siguiente request sin re-login (requisito central, gratis).
- `medical-auth.ts` (rutas internas del doctor app) lee `user.doctorId` de la sesión →
  members quedan scoped al doctor correcto sin tocar sus ~50 consumidores.
- El auto-refresh del layout (`dashboard/layout.tsx:48-54`) dispara con `doctorId: null` —
  para members con membresía activa ya no es null (sesión trae el efectivo), no hay loop.
- Los tipos van a los dos `next-auth.d.ts`.

### 3.3 Punto 2 — `validateAuthToken` (apps/api/src/lib/auth.ts:36)

- La query de user (línea 70) se amplía a `include: { memberships: { where: { status:'ACTIVE' } } }`
  (una query, no dos) y el return gana `isOwner` + `permissions`; `doctorId` pasa a ser el
  **efectivo**. `getAuthenticatedDoctor` / `getAuthenticatedDoctorStripe` (líneas 154-213)
  funcionan sin cambios porque leen `user.doctorId` del return.
- ⚠️ `getAuthenticatedDoctorStripe` exige `role === 'DOCTOR'` (línea 190): los members
  también tienen role DOCTOR en `users` → pasa. Correcto (Pagos es un toggle normal).
- **Aquí mismo vive el enforcement** (§4.2) — validateAuthToken ya recibe `request`.

### 3.4 Punto 3 — minteo del agente (api-token.ts:29)

**Cero cambios.** Mintea `email + sub + sessionVersion`; el API re-resuelve con el punto 2.
El token nunca lleva doctorId ni permisos → no hay claims que puedan quedar stale.

---

## 4. Enforcement

### 4.1 Principio

- **Owner / fallback legacy:** sin checks (todo permitido). El deploy es un no-op para todos
  los usuarios actuales — esta es la propiedad de seguridad de regresión #1.
- **ADMIN:** fuera del mapa (rutas admin usan `requireAdminAuth`; sin interacción).
- **MEMBER:** cada request autenticado pasa por `checkRoutePermission(pathname, method, access)`.
  Fail-closed: ruta autenticada no mapeada y no allowlisted → 403.
- Cortesía UI aparte (§5); la frontera real es esta.

### 4.2 Choke points (2, uno por app)

1. **apps/api** — dentro de `validateAuthToken` (todas las rutas autenticadas pasan por él o
   por sus wrappers `require*`): tras resolver el user, si `!isOwner` →
   `checkRoutePermission(new URL(request.url).pathname, request.method, access)`; throw
   `AuthError(403, 'PERMISSION_BLOCKED')` si falla; si pasa y el método es mutante →
   insert fire-and-forget a `member_audit_log`.
   - `skipVersionCheck` (kill-sessions) no salta el permission check.
2. **apps/doctor rutas internas** — dentro de `requireDoctorAuth` de `medical-auth.ts:19`
   (mismo patrón, `request.nextUrl.pathname`). Los endpoints que NO usan medical-auth se
   inventarían en implementación (checklist §9) — cualquier ruta interna autenticada que no
   pase por el helper se migra a él o recibe el check manual.

El matcher vive en `packages/database/src/permissions.ts` junto al registry:
`ROUTE_PERMISSION_MAP: Array<{ prefix: string; app: 'api'|'doctor'; key: PermissionKey | 'NEUTRAL' | 'OWNER_ONLY' }>`
— **prefijo más específico gana** (necesario: `medical-records/tasks` vs `medical-records`).

### 4.3 Mapa ruta→toggle v1 (primera pasada, verificada contra `ls` de rutas 2026-07-20)

**apps/api** (`apps/api/src/app/api/*`):

| Prefijo | Toggle |
|---|---|
| `/api/appointments`, `/api/calendar` | `citas` |
| `/api/facturacion` | `facturacion` |
| `/api/sat-descarga` | `sat` |
| `/api/stripe`, `/api/mercadopago` | `pagos` |
| `/api/practice-management/ledger` | `flujo` |
| `/api/practice-management/conciliacion-bancaria` | `conciliacion` |
| `/api/practice-management/ventas`, `.../cotizaciones`, `.../clients` | `ventas` |
| `/api/practice-management/compras`, `.../proveedores` | `compras` |
| `/api/practice-management/products`, `.../product-attributes`, `.../areas` | `productos` |
| `/api/articles` | `blog` |
| `/api/doctors`, `/api/reviews`, `/api/settings` | `perfil` |
| `/api/analytics`, `/api/llm-usage` | `reportes` |
| `/api/telegram` | **OWNER_ONLY** (config de notificaciones = Integraciones) |
| `/api/uploadthing`, `/api/users`, `/api/auth` | NEUTRAL (allowlist) |
| `/api/appointment-form`, `/api/fiscal-form`, `/api/cron`, webhooks | públicos/CRON_SECRET — no pasan por validateAuthToken, fuera del mapa |

**apps/doctor** (`apps/doctor/src/app/api/*`):

| Prefijo | Toggle |
|---|---|
| `/api/medical-records/tasks` | `tareas` ← **más específico gana** |
| `/api/medical-records` | `expedientes` |
| `/api/notes` | `notas` |
| `/api/custom-templates` | `expedientes` (form builder; emitir receta es lo legal, no editar plantillas) |
| `/api/bank-statement-import`, `/api/bank-statement-parse` | `conciliacion` |
| `/api/agenda-agent` | `asistente_ia` (+ filtrado de módulos §7) |
| `/api/doctor` | GET: NEUTRAL (DoctorProfileContext alimenta todo el dashboard — nombre en sidebar etc.); writes: `perfil` |
| `/api/prescription-template` | **OWNER_ONLY** (pestaña Receta PDF, identidad legal — G4/§3.5 de 00) |
| `/api/team/*` (nuevo, §6) | **OWNER_ONLY** (excepto `my-invites`/accept/decline: NEUTRAL) |
| `/api/appointments-chat`, `/api/encounter-chat`, `/api/patient-chat`, `/api/prescription-chat`, `/api/sale-chat`, `/api/purchase-chat`, `/api/quotation-chat`, `/api/task-chat`, `/api/ledger-chat`, `/api/form-builder-chat`, `/api/voice`, `/api/llm-assistant` | **OWNER_ONLY** (superficies IA legacy, §5.3 de 00) |
| `/api/activity-logs`, `/api/pwa-icon` | NEUTRAL (verificar contenido de activity-logs en implementación; si expone datos cross-block → OWNER_ONLY) |

**Owner-only quirúrgico dentro de rutas permitidas** (no mapeable por prefijo):

- **Emitir receta** (`POST` de issue en medical-records/prescriptions): guard explícito
  `if (!access.isOwner) 403` EN el endpoint — un member con `expedientes` ON puede leer/
  capturar, jamás emitir (la firma+cédula se estampan al emitir).
- **Pestañas Equipo/Integraciones** de mi-perfil: server-side son `/api/team` (OWNER_ONLY) y
  los endpoints de Google connect (viven en `/api/auth`/NextAuth — el connect de Calendar
  del owner; verificar en implementación qué endpoint exacto guarda `googleCalendarId` y
  marcarlo OWNER_ONLY).

Casos cross-block que NO se tocan (regla §3.6 de 00 — efectos internos de acciones
permitidas): completar cita escribe ledger server-side; emitir factura escribe ledger;
"Buscar paciente" desde citas usa endpoints de link de booking (familia `citas`), no abre
rutas clínicas.

### 4.4 Respuesta 403 estándar

`{ error: 'PERMISSION_BLOCKED', toggle: '<key>' }` — la UI la distingue de un 403 genérico
y muestra "El dueño de la cuenta no te ha dado acceso a esta sección".

---

## 5. UI del doctor app

### 5.1 Sidebar y páginas

- `Sidebar.tsx`: cada `NavItem` gana `permissionKey`; se filtra con `session.user.permissions`
  (owner = todo). Deriva del registry, no de una lista local.
- Guard de página: componente `PermissionGate` en el layout del dashboard que mapea
  `pathname → key` (mismo registry) y renderiza pantalla "sin acceso a esta sección" en vez
  de la página. Las páginas no se tocan una por una; los fetches igualmente morirían en 403.
- **Dashboard home** (`/dashboard/page.tsx`): revisar en implementación qué widgets agrega;
  cada widget se envuelve en el mismo gate por key (riesgo #3 de 00 §8).
- mi-perfil con `perfil` ON para un member: pestañas **Integraciones**, **Receta PDF** y
  **Equipo** no se renderizan (y sus endpoints están bloqueados server-side igual).

### 5.2 Pantallas nuevas

| Ruta | Qué muestra |
|---|---|
| `/invitacion` | Invitaciones pendientes del email logueado → Aceptar / Rechazar (G1: aceptación explícita) |
| pantalla "acceso revocado" | cuando `membershipRevoked` (estado en el layout, no ruta pública) |
| "sin acceso a esta sección" | PermissionGate (§5.1) |

Routing en el dashboard layout (orden): sesión sin `doctorId` efectivo →
(a) `membershipRevoked` → pantalla revocado; (b) fetch `GET /api/team/my-invites` con
pendientes → redirect `/invitacion`; (c) nada → flujo actual (onboarding crear-doctor).
El auto-refresh existente (layout.tsx:48-54) queda para el caso (c) legacy.

---

## 6. Flujo Equipo (owner) e invitaciones

### 6.1 Pestaña "Equipo" en mi-perfil (owner-only)

- Lista members activos (nombre/foto/email del User + toggles) y invitaciones pendientes.
- **Editar toggles inline** — guardado = `PATCH /api/team/members/[id]` escribe
  `doctor_members.permissions`; efecto en el siguiente request del member (§3.2), sin avisos.
- Invitar: email + los 19 toggles prellenados con `INVITE_DEFAULTS` (§2).
- Revocar member (→ `status='REVOKED'`, `revoked_at`) y revocar invitación pendiente.

### 6.2 Endpoints nuevos (apps/doctor, session-based vía medical-auth)

| Endpoint | Auth | Acción |
|---|---|---|
| `GET/POST /api/team/members` | OWNER | listar / — |
| `PATCH/DELETE /api/team/members/[id]` | OWNER | editar permisos / revocar (DELETE = status REVOKED, nunca borra fila) |
| `GET/POST /api/team/invites` | OWNER | listar / crear (email lowercase; rechazar si ya hay member ACTIVE con ese email en ESTE doctor) |
| `DELETE /api/team/invites/[id]` | OWNER | revocar pendiente |
| `GET /api/team/my-invites` | cualquier user autenticado | pendientes no expiradas para MI email |
| `POST /api/team/my-invites/[id]/accept` | cualquier user autenticado | ver transacción abajo |
| `POST /api/team/my-invites/[id]/decline` | cualquier user autenticado | marca DECLINED |

**Transacción de accept** (las validaciones G1/G2 viven AQUÍ, no solo al crear el invite):

```
$transaction:
  1. invite existe, email == user.email (lowercase), status PENDING, expires_at > now()
     (si expiró: marcar EXPIRED, 410)
  2. user NO tiene doctor_members ACTIVE en ningún portal Y user.doctorId IS NULL
     (regla v1 un-portal; dueños de portal no pueden aceptar → 409 con mensaje claro)
  3. INSERT doctor_members (MEMBER, ACTIVE, permissions del invite, invited_by)
     — el índice parcial one_active_per_user es el backstop contra la carrera
       de dos accepts simultáneos (P2002 → 409)
  4. UPDATE invite → ACCEPTED, responded_at
```

- Owner-guard de los endpoints OWNER: `access.isOwner === true` (del §3), NO el toggle
  `perfil` — un member con perfil ON sigue sin poder tocar `/api/team` (G10).
- El owner no puede revocarse a sí mismo (guard en members/[id]).

---

## 7. Agente IA

### 7.1 Filtrado de módulos

Mapeo en el registry (§2), regla conservadora aprobada (módulo ON solo si TODOS sus toggles ON):

```ts
export const AGENT_MODULE_REQUIREMENTS: Record<string, PermissionKey[]> = {
  agenda:     ['citas'],
  expediente: ['expedientes'],
  flujo:      ['flujo', 'pagos', 'conciliacion'],
  facturas:   ['facturacion', 'sat'],
  fiscal:     ['facturacion', 'sat'],
};
```

Cambios en `lib/agenda-agent/`:

- `modules/registry.ts`: nueva `enabledModules(access): AgentModule[]` — owner devuelve
  `AGENT_MODULES` **por referencia** (idéntico); member filtra por requirements. `ALL_TOOLS`
  y colisión de nombres siguen calculándose sobre el total (invariante de build).
- `prompt.ts`: hoy compone sobre `AGENT_MODULES` como constante de módulo (líneas 156-158).
  Pasa a `buildSystemPrompt(modules)` + `buildTools(modules)`, **memoizados por firma del
  set** (`modules.map(m=>m.name).join(',')`) — el resultado del set completo debe ser
  **BYTE-IDÉNTICO** al actual (verificación sha256, mismo método que el refactor `2fdbedd6`)
  para no invalidar el prompt cache de todos los owners en prod.
- `run-turn.ts` / route: reciben el set según `access`; el dispatch usa el MISMO set filtrado
  (un tool de módulo bloqueado no existe ni para dispatch — no solo se esconde del prompt).
- Prompt: sección INTRO/capacidades se compone por-módulo ya; para members el texto
  "fuera de tu alcance" cubre los dominios ausentes de forma natural (no enumerar qué le
  bloquearon — el agente solo dice que ese tema no está disponible en esta cuenta).

**Costo de caching aceptado:** cada set de módulos distinto = prefijo distinto = entrada de
cache separada. Los owners (mayoría) comparten los bytes actuales; un member con set
recortado paga su propio cache write frío la primera vez. Sin cambio de arquitectura.

### 7.2 Gate del panel

- `GET/POST /api/agenda-agent` → toggle `asistente_ia` (mapa §4.3).
- El panel (`AgendaAgentPanel` vía `AgentContext`) no se monta si `asistente_ia` OFF **o**
  `enabledModules(access)` queda vacío.
- Token del member minteado igual (su email); `ToolContext.doctorId` = doctorId efectivo de
  la sesión → las tools del member operan sobre el portal correcto y el API re-chequea
  permisos en cada llamada de tool (defensa en profundidad: una tool de un módulo que se
  colara igual moriría en 403 del API).
- Presupuesto: sin cambios — `llm_token_usage` va por doctorId (compartido, aceptado G8).

### 7.3 Evals

- Suite actual corre como owner → **baseline intacto (60/60 esperado; el prompt del set
  completo es byte-idéntico)**.
- Nuevos tests de composición (unit, no eval-LLM): (a) owner ⇒ referencia idéntica +
  sha256 estable; (b) member sin `sat` ⇒ facturas Y fiscal ausentes (regla ALL); (c) member
  con solo `citas` ⇒ solo agenda; (d) set vacío ⇒ panel-hidden flag.
- 1-2 evals de member (persona con solo agenda): pregunta de facturas → el agente declina
  sin inventar y sin nombrar "bloqueado por el dueño". Se corren con un flag de permisos en
  el runner (el runner mintea token propio — necesita poder simular member).

---

## 8. Orden de PRs (cada uno deployable, prod-safe)

> Regla de oro: **el enforcement existe ANTES de que pueda existir el primer member.**
> Los PR A-C son invisibles para los usuarios actuales; el D activa la feature.

| PR | Contenido | Riesgo de regresión / verificación |
|---|---|---|
| **A** | Migraciones (3 tablas + backfill) aplicadas a Railway ANTES del push · modelos Prisma · registry §2 · `resolveEffectiveAccess` · session() + validateAuthToken ampliados | El más delicado: toca el auth de TODO. Owners resuelven por membresía backfilleada (o fallback columna). Smoke pre-push: script read-only que corre `resolveEffectiveAccess` contra prod para N users reales y asserta `doctorId efectivo == users.doctor_id` en todos. Post-deploy: login real + panel agente + una página por bloque |
| **B** | Enforcement §4 (checkRoutePermission en ambos choke points, inerte para owners) · audit log · sidebar/PermissionGate leyendo permisos (owners ven todo) | Cero members aún ⇒ ningún check activo. Verificar: suite evals 60/60 (agente owner intacto) + click-through de bloques en prod |
| **C** | Agente §7 (enabledModules + prompt memoizado byte-idéntico + gate del panel) | sha256 del prompt owner == baseline; evals 60/60; unit tests de composición |
| **D** | `/api/team/*` · pestaña Equipo · `/invitacion` · pantalla revocado · routing del layout | Validación live (§9). Hasta este deploy no puede existir ningún member |

Cada PR sigue las reglas del repo: SQL a prod antes del código, smoke de query shapes nuevos
read-only, `pnpm-lock.yaml` si hay deps nuevas, explicación + OK del usuario antes de cada push.

## 9. Checklist de implementación / validación live

**Implementación (verificar, no asumir):**
- [ ] Inventario de rutas internas del doctor app que NO usan `requireDoctorAuth` de
      medical-auth → migrarlas o check manual (§4.2.2).
- [ ] Contenido de `/api/activity-logs` y `/api/settings` → confirmar toggle asignado.
- [ ] Endpoint exacto del Google Calendar connect → OWNER_ONLY (§4.3).
- [ ] Widgets del dashboard home → gates por key (§5.1).
- [ ] Endpoint de issue de receta exacto → guard owner-only quirúrgico.
- [ ] `next-auth.d.ts` ×2 actualizados; ningún consumidor de `session.user.doctorId` roto
      (grep de consumidores listado 2026-07-20: medical-auth, DoctorProfileContext, ~14 páginas).
- [ ] Runner de evals: flag para simular permisos de member (§7.3).

**Validación live (dr-prueba + un segundo gmail real como member) — EN CURSO 2026-07-21,
member real = andreabarbagal@gmail.com:**
1. [x] Invitar al gmail B con defaults → login B → pantalla `/invitacion` → aceptar →
   dashboard con sidebar recortado (solo Citas/Tareas/Notas/Ayuda). **Confirmado en prod
   read-only**: invite PENDING→ACCEPTED, doctor_members creado ACTIVE con los permisos
   exactos del invite (ver §16 para el detalle).
2. [x] B: página bloqueada por URL directa → "sin acceso" (confirmado, screenshot real:
   `/dashboard/facturacion` → pantalla PermissionGate). [x] Endpoint bloqueado por curl con
   token real de B → **`403 {"error":"PERMISSION_BLOCKED"}`** en `/api/facturacion/profile`;
   endpoint permitido (`/api/appointments/bookings`) → `200` con datos reales. [x] Cita
   creada por B → Calendar event con `google_event_id` bajo el `google_calendar_id` del
   OWNER (Andrea no tiene ni puede tener conexión de Calendar propia — confirmado, ver §16).
3. [x] Owner activa `facturacion`+`sat` en vivo → sidebar de B lo muestra en el SIGUIENTE
   refresh, sin re-login (confirmado). **Encontró bug real** — ver §16 hallazgo 1.
   Módulos del agente con `asistente_ia` ON: NO probado aún (asistente_ia seguía OFF).
4. [ ] Pendiente.
5. [ ] Pendiente.
6. [ ] Pendiente.
7. [x] Owner: cero cambios observados en todo lo probado hasta ahora.


Bug adicional fuera de esta lista, encontrado por el usuario probando la agenda: el botón
verde "Asistente" DENTRO de la página de citas no abría el panel para B — ver §16 hallazgo 2.

## 10. Riesgos residuales

1. **PR-A toca el session callback y validateAuthToken** — el blast radius es "todo el
   login". Mitigación: fallback a `User.doctorId` (§3.1), smoke pre-push contra prod
   (§8), y deploy en horario de bajo uso.
2. Costo por request: +1 query indexada en session() y +0 en validateAuthToken (se amplía
   la query existente con include). Aceptable; medir si el p95 del API se mueve.
3. Prompt cache frío por member nuevo (§7.1) — aceptado, volumen de members bajo.
4. `db push` contra Railway sigue prohibido (composite FK + ahora índices parciales viven
   solo en SQL — aunque Prisma no dropea índices que no modela, la política no cambia).
5. Toggles incoherentes (Reportes ON / Flujo OFF filtra números) — responsabilidad del
   dueño en v1, documentado en 00 §3.1.

---

## 11. PR A — as-built + review (COMPLETADO, SHIPPED)

Construido tal cual el diseño §1/§3. Gates: migración aplicada a prod (backfill 9 OWNER,
0 mismatches), smoke read-only con el shape EXACTO de la nueva query (`effective==legacy`
11/11 usuarios), tsc limpio ambas apps. Review inline: 1 hallazgo CONFIRMED corregido — sin
el guard, una tabla `doctor_members` ausente en prod (orden de deploy invertido) habría
tronado CADA request autenticado en apps/api (`memberships` include falla) en vez de fallar
abierto hacia el owner legacy; se agregó catch de `P2021` que re-consulta sin memberships.
**`/code-review ultra` sobre la rama: 0 findings** en los 13 archivos del PR (el único
hallazgo fue un typo en un doc no relacionado, en el working tree). Commit `d6c48256`,
pusheado 2026-07-20.

## 12. PR B — as-built + review

Construido según §4/§5 con una desviación del plan original (documentada abajo). Sin
migración SQL — PR B es código de aplicación puro sobre las tablas de PR A.

**Desviaciones vs el plan original:**
- El inventario real de rutas (verificado con `ls`, no muestreado) dio **149 rutas en
  apps/api + 71 en apps/doctor = 220** (el diseño estimaba una primera pasada parcial).
  El mapa terminó con **61 reglas** de prefijo (varias rutas comparten prefijo padre).
- Clasificaciones nuevas no anticipadas en el diseño, resueltas durante la construcción:
  `doctors/*/google-calendar` y `doctors/*/telegram` → OWNER_ONLY (Integraciones, no
  cubierto explícitamente en el diseño pero consistente con §3.4 de 00); `stripe/connect` y
  `mercadopago/connect` (onboarding del proveedor de pago) → OWNER_ONLY, separado de las
  rutas de uso diario (`pagos`); `facturacion/csd` y `sat-descarga/fiel` (identidad fiscal)
  → OWNER_ONLY, separado de `facturacion`/`sat` de uso diario; `activity-logs` (feed
  cross-block) → OWNER_ONLY conservador (§9 del diseño lo dejaba como pendiente de
  verificar contenido — se resolvió así, no se abrió un toggle nuevo).
- El diseño no especificaba el toggle maestro del agente aplicado al endpoint
  `/api/agenda-agent` con verbo GET incluido (no solo POST) — se mapeó sin restricción de
  método, consistente con que la UI ya esconde el panel completo cuando `asistente_ia` está
  OFF (nadie llama GET si el panel no se monta).

**Review inline (02-METODO ángulos 7-9), ejecutado ANTES de correr el script de inventario
(el orden importa: el ángulo 7 se ejecuta construyendo el propio inventario, no después):**

- **Ángulo 7 (bypass del matcher)**: el script de inventario (`scripts/check-route-permission-coverage.ts`)
  ES este ángulo — recorrió las 220 rutas reales y no una muestra. Encontró (indirectamente,
  vía el compilador) **2 comentarios JSDoc con `'doctors/*/telegram'` dentro de un bloque
  `/** ... */`** — el `*/` literal dentro del string cerraba el comentario antes de tiempo y
  corrompía el resto del archivo. No es un hallazgo de seguridad, pero es exactamente el
  tipo de error invisible sin correr el parser real. Corregido reescribiendo los comentarios
  sin el patrón `*/`.
- **Ángulo 9 (dirección de fallo), 1 CONFIRMED, corregido**: un usuario totalmente
  desvinculado (role `DOCTOR`, sin `doctorId`, sin membresía — alguien a medio-onboarding
  antes de que un admin lo vincule) resuelve `isOwner: false` por construcción en
  `computeEffectiveAccess`. Sin guard adicional, esto disparaba `enforceMemberRoute` en
  CADA ruta que tocara, reemplazando el error específico existente
  (`getAuthenticatedDoctor`: "No doctor profile linked to this account") por el nuevo
  `PERMISSION_BLOCKED` genérico — mismo 403, pero el mensaje cambia y algún manejo
  downstream podría depender del texto viejo. Fix: la condición de enforcement en
  `apps/api/src/lib/auth.ts` ganó `&& access.doctorId` — sin doctor que resolver, la
  petición cae a los checks existentes basados en `doctorId` sin inventar un nuevo camino de
  bloqueo. Se revisó el lado `apps/doctor` (`medical-auth.ts`) y NO necesitó el mismo fix:
  ya lanza su propio check de `doctorId` ANTES de llegar al bloque de enforcement.
- **Ángulo 8 (escalación de privilegios)**: `/api/team` no existe todavía (PR D) — nada que
  escalar aún; confirmado que ADMIN hace bypass de enforcement sin importar `isOwner`
  (`user.role !== 'ADMIN'` en la condición); confirmado que el guard de recetas vive en el
  endpoint (`issue/route.ts`), no solo escondido en UI.
- Se trazaron los ~60 sitios que desestructuran `requireDoctorAuth()` — los campos nuevos
  (`isOwner`, `permissions`) son puramente aditivos, ningún call site se rompe.

**Gates:**
- `scripts/check-route-permission-coverage.ts`: **227 archivos de ruta cubiertos, 0 sin
  mapear** (61 reglas + allowlist `users`/`cron` + prefijos públicos/webhook/cron).
- tsc limpio en ambas apps (re-verificado tras el fix del ángulo 9).
- Sin gate de prod nuevo: el enforcement es un no-op para los 11 usuarios reales (mismo
  hecho que probó el smoke de PR A — `isOwner=true` para todos), no se requiere una segunda
  sonda porque la condición que lo garantiza (`!access.isOwner`) es la misma que PR A ya
  verificó en prod.
- Evals del agente: NO corridos todavía para PR B — el diseño (§7.3) los pedía para PR C
  (filtrado de módulos); PR B solo toca el choke point de auth, que los owners atraviesan
  sin cambio de comportamiento por construcción, así que el argumento de "no-op" no depende
  de correr la suite. Queda como ítem abierto correr la suite completa como gate de PUSH del
  PR C, no de este.

Estado: construido, revisado, gates verdes, **pendiente de commit** (esperando `/code-review
ultra` opcional + OK del usuario, mismo protocolo que PR A).

---

*Creado 2026-07-20. Verificado contra código: nextauth-config.ts (database sessions, session
callback), apps/api/src/lib/auth.ts (validateAuthToken + wrappers), medical-auth.ts
(requireDoctorAuth + logAudit/PatientAuditLog), api-token.ts (mint por email),
modules/registry.ts + prompt.ts (composición por AGENT_MODULES), rutas reales de ambas apps
(`ls`), pendientes→/api/medical-records/tasks, reportes→/api/analytics+/api/llm-usage.
§11-§12 añadidos tras completar PR A (shipped) y construir PR B (2026-07-20).*

## 13. PR C — as-built + review

Construido según §7, con UNA desviación real vs el diseño (no un ajuste cosmético):

**Hallazgo de diseño (descubierto construyendo, no antes):** 01-DISENO §7.1 afirmaba
"INTRO/capacidades se compone por-módulo ya" — FALSO al releer `prompt.ts` real. Solo
`domainModel`/`domainRules` se componen por módulo; `INTRO` y `RESILIENCE` son prosa
compartida escrita a mano que ENUMERA las 9 capacidades de TODOS los módulos sin
condicionar a cuáles están presentes. Sin corregir esto, un member con módulos filtrados
recibiría un prompt que afirma con confianza capacidades cuyas tools no existen para él —
justo la categoría "contenido que afirma hechos" que 02-METODO exige revisar siempre.
**Fix:** `MEMBER_SCOPE_NOTE` — un párrafo genérico (no enumera qué está bloqueado) insertado
SOLO cuando el set de módulos es un subconjunto propio; el path owner/set-completo no lo
incluye nunca (probado por el gate, no solo afirmado).

**Piezas construidas:**
- `modules/registry.ts`: `AGENT_MODULE_REQUIREMENTS` (mapeo módulo→toggles, regla ALL);
  `enabledModules(access)` — owner devuelve `AGENT_MODULES` **por referencia** (no copia);
  `buildTools(modules)` generalizado, `ALL_TOOLS` sigue siendo el mismo valor top-level.
- `prompt.ts`: `composePrompt(modules)` + `buildSystemPrompt(modules)` memoizado por firma
  de nombres de módulo; `STABLE_SYSTEM_PROMPT` sigue siendo la MISMA constante (mismo
  nombre, mismo valor) — nada que la importe en otro lugar se rompe.
- `run-turn.ts`: `modules` opcional en `AgendaTurnInput` (default `AGENT_MODULES` — el eval
  runner sigue probando el owner sin cambios); **defensa en profundidad** — `allowedToolNames`
  (Set) bloquea el dispatch de cualquier tool fuera del set filtrado ANTES de llamar al
  executor, aunque el modelo nunca podría solicitarla (no está en `tools` del request) — el
  01-DISENO §7.1 pedía explícitamente "no existe ni para dispatch, no solo se esconde".
- `route.ts`: calcula `modules` desde `authCtx.isOwner/permissions`; **set vacío con
  `asistente_ia` ON** (owner activa el toggle IA sin ningún dominio) → respuesta amistosa sin
  llamar al modelo (cero tokens gastados) — simplificación de v1 vs el ideal del diseño
  ("el panel se esconde igual"): el panel SIGUE visible en ese caso raro, pero no revienta ni
  gasta presupuesto; ocultar el panel completo requeriría exponer `AGENT_MODULE_REQUIREMENTS`
  al cliente, fuera de alcance v1.

**Gate de identidad de bytes (`scripts/check-agent-prompt-identity.ts`, 12/12 checks):**
sha256 del prompt owner impreso y estable; `buildSystemPrompt(AGENT_MODULES) ===
STABLE_SYSTEM_PROMPT` (no tautológico — construido independientemente); `buildTools` mismo
orden/cantidad que `ALL_TOOLS`; el addendum de member NUNCA aparece en el path owner; reglas
de filtrado verificadas (agenda-only → 1 módulo; flujo exige LOS 3 toggles, parcial lo
excluye; permissions null/vacío → 0 módulos, fail-closed). **Verificado además por diff**:
las únicas líneas removidas de `prompt.ts` son la construcción antigua de
`STABLE_SYSTEM_PROMPT` (9 líneas), ningún string de INTRO/RESILIENCE/RULES/FORMAT fue tocado
— la prueba de bytes no depende de confiar en la refactorización, el diff la corrobora.

**Gates:** tsc limpio doctor app. Evals del agente (suite 60) **NO corridos** — gasto real
de API, se pospone a que el usuario decida (la garantía de cero-riesgo para el owner ya está
prendida: misma referencia de módulos + mismo string de prompt + mismo código de dispatch
que antes de esta PR).

## 14. PR D — as-built + review

Construido según §6, con las piezas nuevas no completamente detalladas en el diseño
original resueltas durante la construcción:

**Piezas construidas:**
- Migración: NINGUNA (PR D es código de aplicación puro sobre las tablas de PR A).
- Helpers nuevos en `medical-auth.ts`: `requireAnyAuth` (cualquier usuario autenticado,
  doctorId opcional — el caso exacto de alguien revisando sus invitaciones ANTES de
  pertenecer a cualquier portal) y `requireOwnerAuth` (envuelve `requireDoctorAuth` +
  `isOwner`, no el toggle `perfil` — 00-REQUISITOS §3.4).
- 7 endpoints bajo `/api/team/`: `members` (GET), `members/[id]` (PATCH/DELETE),
  `invites` (GET/POST), `invites/[id]` (DELETE), `my-invites` (GET),
  `my-invites/[id]/accept` (POST, transacción), `my-invites/[id]/decline` (POST).
- `AppError` nueva clase en `api-error-handler.ts` (error estructurado con status explícito
  404/409/410 — no existía antes, los helpers previos solo cubrían 400/401/403 genéricos).
- `PERMISSION_LABELS` añadido al registry (`packages/database/src/permissions.ts`) — las
  etiquetas del diálogo de Equipo derivan del MISMO registry que el sidebar, nunca driftean.
- UI: `TeamSection.tsx` (pestaña Equipo — lista + edición inline + diálogo de invitar con
  `INVITE_DEFAULTS` prellenados), `/invitacion` (pantalla de aceptar/rechazar, fuera del
  layout del dashboard — mismo patrón que `/consent`), `RevokedAccessScreen.tsx`.
- Routing en `dashboard/layout.tsx`: chequeo de invitaciones pendientes ANTES del flujo de
  onboarding existente, pantalla de revocado ANTES del render normal.

**Review inline (02-METODO ángulos 4 y 8), con un hallazgo real:**
- **Ángulo 8 (escalación), verificado sin fix necesario**: `invite.email !== email` bloquea
  aceptar la invitación de otro (los ids son cuid, no adivinables, y aunque se adivinaran el
  check de email lo detiene); el 404 es IDÉNTICO para "no existe" y "existe pero es de otro
  email" (sin oracle de existencia); `members/[id]` PATCH/DELETE rechazan tocar filas
  `role:'OWNER'`; `sanitizePermissions` sólo acepta las 19 claves conocidas del registry
  (claves extra en el body se ignoran, nunca se guardan).
- **Ángulo 4 (¿qué cambia entre proponer y ejecutar?), backstop PROBADO en prod (no solo
  argumentado)**: dos accepts simultáneos del mismo usuario (doble click, o dos invitaciones
  de dos doctores distintos) bajo READ COMMITTED podrían ambos leer "sin membresía activa" y
  ambos intentar crear — el índice parcial `doctor_members_one_active_per_user` es el
  backstop. **Smoke de escritura-con-rollback contra prod** (patrón de
  database-architecture.md, mismo método que validó el composite FK en 2026-07-08):
  transacción real crea membership 1, intenta membership 2 para el mismo user_id → **P2002
  confirmado**, luego throw intencional → CERO filas commiteadas. El backstop es real, no
  solo teórico.
- **1 CONFIRMED, corregido — encontrado revisando la interacción revoked×invite**: el efecto
  de chequeo de invitaciones pendientes en `dashboard/layout.tsx` excluía explícitamente a
  los usuarios con `membershipRevoked:true`. Pero re-invitar a un member removido es un flujo
  soportado explícitamente (00-REQUISITOS §2.3: "un gmail removido queda libre para ser
  invitado a otro portal") — sin el fix, ese usuario re-invitado quedaría atorado en la
  pantalla "Acceso revocado" PARA SIEMPRE (el efecto nunca corría, nunca lo mandaría a
  `/invitacion`). Fix: se quitó la exclusión de `membershipRevoked` del efecto — ahora
  revisa invitaciones pendientes SIEMPRE que no haya doctorId efectivo, revocado o no.

**Gates:** tsc limpio doctor app · inventario de rutas 234/234 cubierto (63 reglas, +7 vs
PR B) · smoke de constraint contra prod (arriba) · sin gate de prod nuevo más allá de eso —
PR D no toca los choke points de auth (solo agrega endpoints nuevos detrás de ellos).

---

*§13-§14 añadidos tras construir PR C y PR D en la misma sesión (2026-07-20), antes de
cualquier commit — decisión explícita del usuario: construir C y D primero, review inline
completo en cada uno (no se salta por costo), UN solo `/code-review ultra` cubriendo B+C+D
al final para conservar cuota (quedan 2 de 3 gratis tras PR A).*

## 15. `/code-review ultra` sobre B+C+D — hallazgos y fixes (2026-07-21)

4 hallazgos, los 4 CONFIRMED y corregidos (severidad "nit" — ninguno era explotable ni
rompía nada visible, pero los 4 eran errores reales de construcción, no ruido). Los 4 caen
en categorías que el review inline de PR D ya cubría en teoría (ángulos 4 y 8) — ultra los
cazó donde el review inline no llegó a mirar con suficiente profundidad. Ningún hallazgo en
PR B o PR C.

1. **Escritura EXPIRED muerta dentro de la transacción de accept** (`accept/route.ts`): el
   `tx.memberInvite.update({status:'EXPIRED'})` corría DENTRO del `$transaction` y el
   `throw` inmediato después revertía TODO, incluida esa escritura — la fila se quedaba
   PENDING para siempre en vez de EXPIRED (sin impacto visible: el 410 al usuario era
   correcto igual, y los sweeps lazy de los GET la limpiaban eventualmente). Fix: mover el
   `updateMany` de expiración ANTES de abrir la transacción (mismo patrón que los sweeps
   existentes), re-chequear el estado de expiración dentro sin volver a escribir.
2. **Comparación de email sensible a mayúsculas** (4 sitios: `accept`, `decline`,
   `my-invites` GET, `invites` POST el check de miembro existente): `invite.email` se
   normaliza a minúsculas al crear la invitación, pero `users.email` (poblado por Google
   OAuth) se guarda TAL CUAL — dominios Google Workspace pueden preservar mayúsculas en el
   claim OIDC. Un asistente invitado con email mixed-case habría visto CERO invitaciones
   pendientes (silencioso, sin error) y quedado atorado en el flujo de onboarding de
   doctor. Fix: comparación `toLowerCase()` en accept/decline; `mode: 'insensitive'` de
   Prisma (soportado en postgresql) en los 3 queries de BD.
3. **Lost-update race en revoke/decline de invitaciones** (`invites/[id]` DELETE,
   `my-invites/[id]/decline`, y por consistencia también `members/[id]` DELETE): patrón
   `findFirst` (sin lock) → chequeo en JS → `update where:{id}` (sin filtro de estado) — si
   un accept/decline/expire concurrente comitea en esa ventana, el update subsiguiente lo
   sobreescribe en silencio. Sin hueco de seguridad (la fila `doctor_members` ya creada por
   un accept legítimo queda intacta), pero el rastro de auditoría de la invitación mentiría
   sobre qué pasó. Fix: `updateMany` con `status:'PENDING'` (o `'ACTIVE'` para members) en
   el WHERE — el UPDATE re-evalúa la fila ACTUAL al ejecutarse, así que `count===0` détecta
   la carrera perdida de forma atómica, tratado como idempotente (ya-respondida).
4. **Variante simétrica encontrada en auto-review de los fixes, no por ultra** (mismo
   archivo `accept/route.ts`, línea de escritura ACCEPTED): la escritura final de
   `tx.memberInvite.update({status:'ACCEPTED'})` DENTRO de la transacción de accept tenía el
   MISMO patrón sin guardia — un revoke del dueño en la ventana exacta de ejecución de la
   transacción de accept podía comitear entre la lectura inicial (línea 33) y esta escritura
   final, y el update ciego lo sobreescribiría de vuelta a ACCEPTED dejando parada la
   membresía recién creada a pesar del revoke. Fix: mismo patrón `updateMany` +
   `count===0` → throw — pero aquí el throw debe TUMBAR toda la transacción (incluida la
   creación del `doctorMember`), no solo reportar idempotencia, porque un revoke a mitad de
   vuelo debe ganar limpio.

**Gates post-fix:** tsc limpio (apps/doctor) tras cada fix y al final. Sin gate de prod
nuevo — estos son cambios de lógica pura sobre queries ya smoke-testeadas (los 4 sitios ya
usan patrones de query verificados; `mode:'insensitive'` es sintaxis Prisma estándar para
postgresql, no un query shape nuevo que amerite smoke read-only). Pendiente: commit de los
fixes (nuevo commit, no amend, per regla del repo) + OK del usuario antes de push.

**Estado 2026-07-21: fixes commiteados (`345b2a09`) y pusheados junto con B/C/D.**

## 16. Validación en vivo — hallazgos reales (2026-07-21, EN CURSO)

Feature completa en prod. Método: dr-prueba como OWNER (ya logueado), `andreabarbagal@gmail.com`
como MEMBER real (login real en `https://doctor.tusalud.pro/login`, no simulado) — el usuario
ejecuta cada paso en su navegador, yo verifico contra prod read-only entre pasos (más un curl
directo con el token real de Andrea vía `/api/auth/get-token`, para probar el límite server-side
sin depender de que la UI lo esconda). Pasos 1-3 y 7 del checklist §9 confirmados limpios; 4-6
pendientes. Dos bugs reales encontrados, ambos por el mismo mecanismo — probar con un humano real
en vez de solo argumentar desde el código — y ambos ya corregidos:

### Hallazgo 1 — endpoints de solo-lectura de estado agrupados bajo el mismo OWNER_ONLY que la escritura

**Síntoma reportado por Andrea:** tras el toggle en vivo de `facturacion`+`sat`, su sidebar sí
mostró Facturación (paso 3 confirmado), pero DENTRO de la página solo veía las pestañas
Configuración y Guía — ni Mis Facturas, ni Nueva Factura, ni REP, ni Nota de Crédito.

**Causa:** `apps/doctor/src/app/dashboard/facturacion/page.tsx` calcula
`isReady = profile && csdStatus?.csdUploaded && csdStatus.facturamaStatus === "active"` y
gatea esas 4 pestañas en `isReady`. `csdStatus` viene de `GET /api/facturacion/csd/status`,
que PR B mapeó bajo la MISMA regla `{ prefix: 'facturacion/csd', key: 'OWNER_ONLY' }` que la
subida real del certificado (`POST /api/facturacion/csd`) — un error de granularidad: el
diseño trataba "csd" como una unidad, pero el endpoint real separa CLARAMENTE la lectura de
estado (booleans + RFC + fechas, `apps/api/.../csd/status/route.ts:44-55` — nunca la llave
privada) de la escritura del material sensible. El status 403 de Andrea hacía que
`csdStatus` quedara `undefined`, `isReady` false, y la página escondía las 4 pestañas en
silencio — sin error visible, exactamente el patrón "se ve roto pero no truena" que hace
estos bugs difíciles de cazar solo leyendo código.

**Búsqueda proactiva del mismo patrón** (antes de que otro usuario lo encontrara): mismo
molde exacto en `sat-descarga/fiel` (GET/POST/DELETE comparten la MISMA url — split por
método, no por path) y en `stripe/connect/status` + `mercadopago/connect/status` (split por
path, igual que CSD). Los tres devuelven solo booleans/metadata, nunca credenciales.

**Fix** (`packages/database/src/route-permissions.ts`, commit `27c04273`): reglas más
específicas — `facturacion/csd/status` → toggle `facturacion`; `sat-descarga/fiel` con
`methods:['GET']` → toggle `sat` (POST/DELETE siguen OWNER_ONLY); `stripe/connect/status` y
`mercadopago/connect/status` → toggle `pagos`. Verificado con un script de 10 casos contra el
matcher real (borrado tras usar) — los 10 resolvieron como se esperaba. Ruta de subida/borrado
de credenciales intacta en OWNER_ONLY en los tres casos.

**Lección para el mapa de rutas:** cuando un endpoint mezcla "¿está configurado?" con "aquí
está el secreto", son DOS endpoints (o el mismo path con métodos distintos) con DOS niveles
de exposición — agruparlos bajo una sola regla por prefijo es demasiado grueso. Antes de
marcar algo OWNER_ONLY por "toca credenciales", verificar qué devuelve el GET específicamente.

### Hallazgo 2 — segundo punto de apertura del panel del agente, nunca gateado

**Síntoma:** el usuario probó el botón verde "Asistente" DENTRO de la página de citas (no el
botón flotante del layout) — no pasó nada, sin error.

**Causa:** `DashboardLayout.tsx` (PR B) gatea el botón flotante Y el montaje de
`AgendaAgentPanel` con `can("asistente_ia")` — pero `apps/doctor/src/app/dashboard/appointments/page.tsx`
tiene su PROPIO botón "Asistente" (esmeralda, línea ~259) que llama al MISMO `openAgentPanel()`
de `AgentContext`, construido antes de esta feature y nunca tocado por PR B. Ese `open()` solo
cambia un booleano en contexto — como el panel nunca se monta para un member sin
`asistente_ia`, el click no hacía nada visible (ni error, ni feedback).

**Fix** (`apps/doctor/src/app/dashboard/appointments/page.tsx`, commit `0824a18d`): mismo
guard `usePermissions().can("asistente_ia")` alrededor del botón. Grep de TODOS los
consumidores de `useAgentActions` en el repo confirmó que este era el ÚNICO otro punto de
apertura — no quedan más.

**Lección:** al gatear un componente compartido (el panel), hay que grepear TODOS los
call-sites que puedan intentar abrirlo, no solo el punto "principal" donde vive el montaje.
Un `open()` sin componente montado falla en silencio — el peor tipo de bug para detectar sin
un humano real haciendo click.

### Hallazgo 3 — 3 widgets globales exponían superficies IA/Calendar owner-only

**No encontrado por el usuario probando** — encontrado por un bug hunt dirigido después de
los hallazgos 1-2, arrancando de una observación: `GoogleCalendarBanner.tsx` (montado
globalmente en `dashboard/layout.tsx` para CUALQUIER visita, incluidos members) solo se
degradaba a salvo para un member POR ACCIDENTE — su llamada a
`GET /doctors/*/google-calendar/status` (OWNER_ONLY) recibe un 403, pero la forma del cuerpo
de error (`{error:...}`, sin `connected`/`enabled`) hace que el chequeo `!data.connected &&
!data.enabled` sea `true` y el banner nunca se muestre — correcto en efecto, pero por
casualidad de forma, no por diseño. Revisar depender de eso es frágil (angle 9: si el shape
del error cambia algún día, deja de degradarse a salvo). Al revisar el resto de los widgets
montados globalmente en el mismo layout con el mismo criterio, aparecieron dos MÁS con el
mismo problema pero SIN degradación accidental:

- **`ChatWidget.tsx`** (chat de ayuda legacy, botón flotante "?"): CERO chequeo de owner.
  Un member que le da click y manda un mensaje recibe 403 de `/api/llm-assistant/chat`
  (correctamente OWNER_ONLY por 00-REQUISITOS §5.3) y **el string crudo
  "PERMISSION_BLOCKED" se renderiza como respuesta del chat** — peor que silencioso.
- **`VoiceAssistantHubWidget.tsx`** (botón flotante Sparkles índigo): mismo patrón, solo
  chequeaba `doctorId` (que los members SÍ tienen) no `isOwner`; su modal llama a
  `voice/*`, todo OWNER_ONLY.

**Fix** (commit `216e1606`): los 3 ganan `usePermissions().isOwner` — Chat y Voice se
esconden completo (`return null`) si no es owner; el banner de Calendar salta su fetch
explícitamente en vez de confiar en la forma accidental del 403.

**Lección:** el patrón de bug de los hallazgos 1 y 2 ("¿qué más comparte esta forma?") vale
la pena aplicarlo proactivamente una vez encontrado el primer caso, no solo reactivamente
cuando el usuario lo reporta — encontrar 2 de 3 ANTES de que Andrea los tropezara fue puro
bug hunt dirigido, no validación en vivo.

### Hallazgo 4 — los 8 paneles de chat legacy no verificaban isOwner en NINGÚN punto de disparo

**Continuación directa del hallazgo 3.** Al preguntarse "¿un segundo bug hunt vale la pena?"
se revisaron sistemáticamente TODOS los consumidores de `*ChatPanel` (los 8 endpoints
`*-chat` que 00-REQUISITOS §5.3 decidió owner-only: task/patient/sale/purchase/quotation/
ledger/encounter/prescription-chat). Los 8 comparten el MISMO patrón, y ninguno tenía guard:

1. **Apertura por URL** (`?chat=true`, leído por cada hook `use*Page`/`useNew*Form`) — un
   member navegando directo a `/dashboard/pendientes/new?chat=true` (o cualquiera de los
   otros 5) auto-abría el panel sin chequeo alguno.
2. **Botón inline "Chat IA"** en la página misma (independiente del punto 1) — visible y
   clickeable para CUALQUIER usuario con el toggle de dominio ON, sin importar `asistente_ia`
   ni `isOwner`.
3. **Los links "Acciones Rápidas" del dashboard home** (agregados en PR B) estaban gateados
   por el toggle de DOMINIO (`can("expedientes")`, `can("tareas")`, etc.) — la clasificación
   equivocada: como los 6 links apuntan TODOS a flujos `?chat=true`, el gate correcto era
   `isOwner`, no el permiso del módulo (un member con `tareas:true` de todos modos no debe
   ver el atajo "Nueva Tarea con Chat IA", porque el backend al que apunta es owner-only).

**Fix:** los 8 hooks (`useNewTask`, `useNewPatientPage`, `useNewLedgerEntry`,
`useNewEncounterPage`, `useNewPrescriptionForm`, más los 3 page.tsx autocontenidos de
compras/cotizaciones/ventas) ganan `usePermissions().isOwner`, devuelto donde aplica, y:
- el efecto que lee `?chat=true` ahora exige `isOwner` además del query param;
- el botón inline "Chat IA" se esconde completo (`{isOwner && (...)}`) en las 8 páginas;
- los 6 links de Acciones Rápidas en dashboard home cambiaron de `can(dominio)` a `isOwner`.

**No tocado a propósito:** `AppointmentChatPanel.tsx` (usa `appointments-chat`, también
OWNER_ONLY) solo se importa en `/dashboard/appointments/v1/page.tsx` — página legacy sin
links entrantes, ya marcada para borrar como follow-up acordado (memoria
`project_agentes_por_bloque`). Endurecer código que se va a borrar no es buen uso del
esfuerzo; queda como nota, no como fix.

**Lección (refuerza la del hallazgo 3):** una vez que un bug es "componente compartido sin
gate", vale la pena enumerar TODOS los consumidores de ese patrón por grep en vez de
confirmarlo caso por caso — los 8 endpoints legacy comparten arquitectura idéntica
(hook `use*` + `searchParams.get('chat')` + botón inline), así que el bug, una vez
identificado en 2 lugares, era casi seguro que estuviera en los otros 6 también.

### Hallazgo 5 — voice/transcribe y form-builder-chat: features EN páginas member-accessible

**Segunda vuelta del bug hunt (ronda 3), buscando la variante contraria a 3-4:** ahí, la
página ENTERA era owner-only por diseño (chat legacy). Aquí es al revés — la página SÍ es
para members (Notas con `notas:true`, Custom Templates con `expedientes:true`), pero tiene
un botón de voz/IA incrustado que llama a un endpoint OWNER_ONLY:

- **`useNotesPage.ts` + `usePatientNotes.ts`**: el botón de dictado por voz (mic) llama
  `POST /api/voice/transcribe` (OWNER_ONLY) directo, sin componente compartido de por medio
  — invisible al grep de "ChatPanel" que encontró los hallazgos 3-4, solo apareció al buscar
  fetches crudos a los 8 prefijos legacy + voice + llm-assistant. Nota interesante: esta vez
  el fallo YA degradaba con un mensaje razonable ("no se pudo transcribir el audio", por la
  forma del cuerpo `{error:"PERMISSION_BLOCKED"}` sin `.success`/`.message` cayendo al
  default) — pero seguía siendo confuso para un member con acceso legítimo a Notas.
- **`FormBuilder.tsx`** (usado por `custom-templates`, toggle `expedientes`): el botón
  "Asistente IA" del Toolbar llama `form-builder-chat` (OWNER_ONLY).

**Fix:** en Notas, guard `if (!isOwner)` dentro de `toggleRecording` con un mensaje claro
("El dictado por voz no está disponible en esta cuenta") en vez de dejar que falle contra la
API. En FormBuilder, `onToggleAIChat` se pasa como `undefined` cuando `!isOwner` — Toolbar.tsx
YA trataba el handler como opcional (`{onToggleAIChat && (<button.../>)}`), así que el botón
desaparece con un cambio de una línea, sin tocar Toolbar.tsx.

**Verificado limpio, sin fix necesario:** `VoiceRecordingModal`/`VoiceChatSidebar` embebidos
directamente en las 7 páginas `/new` — su estado `modalOpen` nunca se dispara desde un botón
en esas páginas (dead state); solo se alimentan vía sessionStorage desde el flujo del
`VoiceAssistantHubWidget` (hallazgo 3), que ya quedó gateado — protección transitiva.

**Lección (generaliza 3-4):** dos variantes del mismo bug conviven — (a) página entera
owner-only con botón inline sin gate (3-4), (b) página member-accessible con UN feature
interno owner-only sin gate (5). El grep por NOMBRE de componente compartido (`*ChatPanel`)
encuentra (a); hace falta grep por RUTA de API (`/api/voice/`, `/api/<prefijo>-chat`) para
encontrar (b), porque ahí no hay un componente reusado con nombre reconocible — es una
llamada `fetch()` suelta dentro de una feature que por lo demás es legítima para el member.

**Estado:** tsc limpio (apps/doctor) tras cada tanda. Todo lo de esta sesión de bug hunt
(hallazgos 1-5) sigue en commits locales — **sin pushear**, pendiente del resto de §9 y del
OK del usuario.
