# NUEVOS USUARIOS — Diseño técnico

> **Estado:** DISEÑO 2026-07-20 — ningún código escrito. Requisitos cerrados en
> [`00-REQUISITOS-usuarios-secundarios.md`](00-REQUISITOS-usuarios-secundarios.md).
> Todo lo citado aquí (archivos, líneas, rutas) fue verificado en código el 2026-07-20.
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

**Validación live (dr-prueba + un segundo gmail real como member):**
1. Invitar al gmail B con defaults → login B → pantalla `/invitacion` → aceptar → dashboard
   con sidebar recortado (solo Citas/Tareas/Notas/Ayuda).
2. B: página bloqueada por URL directa → "sin acceso"; endpoint bloqueado por curl con token
   de B → 403 PERMISSION_BLOCKED; endpoint permitido (crear cita) → funciona y el evento
   Calendar sale del Google del OWNER (verificar en el calendar del owner).
3. Owner activa `facturacion`+`sat` en vivo → siguiente request de B ya ve Facturación;
   agente de B (si `asistente_ia` ON) gana módulos facturas/fiscal en el siguiente mensaje.
4. B con `flujo` OFF completa una cita (citas ON) → LedgerEntry se crea igual (regla §3.6
   de 00); verificar read-only en prod.
5. Owner revoca a B → siguiente request de B = pantalla revocado; su token viejo → 403 en
   todo. Re-invitar a B a OTRO portal de prueba → funciona (slot liberado).
6. `member_audit_log` tiene los writes de B (y solo los de B).
7. Owner: cero cambios — panel agente, evals, todas las páginas.

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

*Creado 2026-07-20. Verificado contra código: nextauth-config.ts (database sessions, session
callback), apps/api/src/lib/auth.ts (validateAuthToken + wrappers), medical-auth.ts
(requireDoctorAuth + logAudit/PatientAuditLog), api-token.ts (mint por email),
modules/registry.ts + prompt.ts (composición por AGENT_MODULES), rutas reales de ambas apps
(`ls`), pendientes→/api/medical-records/tasks, reportes→/api/analytics+/api/llm-usage.*
