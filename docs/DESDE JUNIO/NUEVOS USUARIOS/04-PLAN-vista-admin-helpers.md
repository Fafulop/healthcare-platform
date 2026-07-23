# NUEVOS USUARIOS — Plan: vista admin de helpers ligados a cada doctor

> 🔒 **SNAPSHOT — 2026-07-22. Extensión B CERRADA** (verificada en vivo: `/helpers` muestra a
> Andrea bajo dr-prueba). No se actualiza; estado en [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md).
> ⚠️ Nota de as-built que cuesta re-descubrir: el link del Navbar **no bastó** — `/dashboard`
> renderiza cards, no el Navbar, así que hizo falta el follow-up `64677f6f` para que la vista
> fuera alcanzable.
>
> **Estado original:** ✅ SHIPPED 2026-07-22 (as-built en §6, gates verdes, pusheado). Toca `@healthcare/api`
> + `@healthcare/admin`; sin migración, sin dependencia con doctor app.
> Base v1: `00-REQUISITOS`, `01-DISENO`. Límite de 1 helper = doc hermano
> `03-PLAN-limite-1-helper.md` (independiente). Todo lo citado verificado en código 2026-07-22.

---

## 1. El gap (verificado en código)

`apps/admin/src/app/users/page.tsx` lista `User` y muestra su doctor vía **`user.doctorId`** (el
link legacy de OWNER), con acciones Vincular/Desvincular (`PATCH /api/users/:id { doctorId }`).
El endpoint que la alimenta, `GET /api/users` (`apps/api/src/app/api/users/route.ts`), hace
`include: { doctor }` sobre `user.doctorId`.

**Los members (Andreas) NO aparecen ahí:** su fila `User` tiene `doctorId = null` (nunca se toca —
`01-DISENO §1.1`); su vínculo vive en `doctor_members`. En esa página un member se ve como
"Sin vincular", lo cual es engañoso — sí está vinculado, por membresía. Falta una vista que lea
`doctor_members` y muestre, por doctor, su helper.

---

## 2. API — nuevo endpoint admin-only

En `apps/api`, gated con `requireAdminAuth` de `@/lib/auth` (idéntico a `GET /api/users` y
`POST /api/doctors`; el admin app ya manda el token vía `authFetch`).

```
GET /api/admin/doctor-members   → requireAdminAuth
```
Devuelve membresías MEMBER activas con join a user + doctor:
```
[{ doctorId, doctorName, doctorSlug,
   memberEmail, memberName, memberImage,
   permissions,          // el JSON de toggles (para el resumen)
   invitedByEmail,       // quién lo invitó (owner)
   createdAt }]
```
- Fuente: `doctor_members WHERE role='MEMBER' AND status='ACTIVE'`, join `users` (email/name/image)
  y `doctors` (nombre/slug). **NO** leer `user.doctorId` (los members no lo tienen — es el error
  que hace invisibles a los helpers hoy).
- **Muestra helpers aunque el owner del doctor no esté linkeado** (el join es por `doctor_id`,
  independiente de `user.doctorId`) — un plus sobre la página actual.
- **Incluir invitaciones PENDING** (join opcional a `member_invites WHERE status='PENDING'`) para
  ver "invitado, aún no acepta" — útil sobre todo con el límite de 1 helper (`03-PLAN`).
- **Read-only en v1.** Revocar sigue siendo del owner (pestaña Equipo). Force-revoke desde admin =
  write futuro (requireAdminAuth + su propia entrada en el mapa de rutas, ver G1).

**Alternativa considerada (no recomendada):** extender `GET /api/users` con
`include: { memberships }` y derivar la vista user-céntrica. Rechazada: la petición es
doctor-céntrica ("helpers por doctor") y mezclar el concepto owner-link con membership en un solo
endpoint es justo la confusión que causó el gap. Endpoint dedicado = más claro.

---

## 3. UI admin

Con el límite de 1 helper (`03-PLAN`), cada doctor tiene 0 o 1 helper → tabla simple:

| Doctor | Helper (email) | Permisos (resumen) | Desde | Estado |
|---|---|---|---|---|

- **Resumen de permisos:** contar toggles ON de los 19, o listar los ON — derivar de
  `PERMISSION_LABELS` del registry `@healthcare/database` (mismo origen que la pestaña Equipo;
  nunca duplicar la lista).
- **Estado:** "Activo" (member) vs "Invitado (pendiente)" (invite) vs doctor "Sin asistente".
- **Ubicación (decisión al construir):**
  - Opción 1: columna/sub-fila "Helper" en `/users` existente.
  - **Opción 2 (recomendada):** página nueva `/helpers` dedicada — no mezcla owner-link (legacy
    `doctorId`) con membership, coherente con el endpoint dedicado de §2.

---

## 4. Gaps encontrados en el re-análisis (2026-07-22)

### G1 — Toda ruta nueva de apps/api DEBE entrar al mapa de permisos o el gate falla *(real)*

El script `scripts/check-route-permission-coverage.ts` (gate permanente de PR B, `01-DISENO §12`)
asserta que **todo** directorio bajo `apps/api/src/app/api/*` esté en `route-permissions.ts` o sea
público/allowlist explícito — si no, falla. `users` está mapeado `{ prefix: 'users', key:
'NEUTRAL' }` con el comentario "admin-guarded by requireAdminAuth on top". **Fix:** agregar el
nuevo prefijo — `{ prefix: 'admin', key: 'NEUTRAL' }` (o `'admin/doctor-members'` si se quiere
granular) — al crear el endpoint. Los ADMIN nunca pasan por el check de member (la condición de
enforcement excluye role ADMIN), pero el prefijo debe existir en el mapa para el gate de cobertura.
Sin esto el push del endpoint rompe el gate.

### G2 — Datos de dinero/salud expuestos: el resumen de permisos NO debe filtrar contenido *(nota)*

La vista muestra QUÉ permisos tiene el helper (metadatos), no los datos clínicos/financieros en sí
— correcto. Mantenerlo así: nada de pre-cargar expedientes/ledger del doctor en esta vista. Es
solo un directorio de accesos. (El admin ya puede ver todo por otros medios; el punto es no
construir una fuga nueva por descuido.)

### G3 — Serialización *(menor)*

`doctor_members` no tiene columnas BigInt (a diferencia de `member_audit_log`), así que el JSON
sale directo. `permissions` es JSONB → objeto JS directo. Sin gotcha de serialización.

### G4 — Doctores sin helper *(nota de UX)*

El endpoint (ACTIVE-only) no devuelve fila para doctores sin member. La UI debe listar TODOS los
doctores y marcar "Sin asistente" los que no tengan — o el admin creería que faltan doctores. Si
la vista se hace doctor-céntrica (recomendado), arrancar de la lista de doctores (`GET /api/doctors`,
ya pública) y hacer left-join contra el nuevo endpoint.

### G5 — Mostrar revocados/historial *(fuera de alcance v1)*

v1 muestra solo ACTIVE + PENDING. Ver el historial de revocados (auditoría de quién fue helper) es
útil pero es scope aparte; `doctor_members` conserva las filas REVOKED (nunca se borran, `01-DISENO
§18`), así que el dato existe cuando se quiera exponer.

---

## 5. Gates de entrega

- Sin migración (tablas ya existen).
- **Agregar el prefijo al mapa de rutas** (G1) y correr `check-route-permission-coverage.ts` verde.
- Smoke read-only del shape del query nuevo (join `doctor_members`↔`users`↔`doctors`, + PENDING de
  `member_invites`) contra prod ANTES de pushear — método `TOOLING-acceso-railway-db.md`.
- tsc limpio en `apps/admin` + `apps/api`.
- Explicación + OK del usuario antes del push.

---

*Creado 2026-07-22. Decisión del usuario: planear ahora, construir después. Re-análisis encontró
G1 (ruta nueva debe entrar al mapa de permisos o el gate de cobertura falla) como el gap de
integración real; G2-G5 notas. Estado prod: solo dr-prueba tiene 1 helper activo.*

---

## 6. As-built (2026-07-22) — construido, gates verdes, SIN commitear/pushear

**Piezas construidas:**
- **API** `apps/api/src/app/api/admin/doctor-members/route.ts` — GET, `requireAdminAuth`
  (confirmado que exige `role==='ADMIN'` → 403, `auth.ts:205`). Devuelve `{ members, pending }`:
  members activos (`role='MEMBER' AND status='ACTIVE'`) con user+doctor embebidos + `invitedByEmail`
  resuelto (lookup de `invitedBy` user_id → email, no es relación); pending NO expiradas
  (`expiresAt>=now`, filtro read-only, sin write de lazy-expire). Lee `doctor_members`, NUNCA
  `user.doctorId` (G1 del gap original — así los members SÍ se ven).
- **route-permissions.ts** — `{ prefix: 'admin', key: 'NEUTRAL' }` (G1 de §4): el coverage gate
  pasa (235 rutas cubiertas). ADMINs saltan el enforcement de member; el `requireAdminAuth` del
  handler es el gate real.
- **UI** `apps/admin/src/app/helpers/page.tsx` — página dedicada `/helpers` (opción 2 recomendada),
  doctor-céntrica: itera TODOS los doctores (`GET /api/doctors`, devuelve todos — verificado, sin
  filtro → ningún helper se esconde, G4) y hace left-join contra members/pending. Columna Asistente
  = member (email/foto) | "Invitado (pendiente): email" (ámbar) | "Sin asistente". Permisos =
  "N de 19" con tooltip de los labels ON (deriva de `PERMISSION_KEYS`/`PERMISSION_LABELS` del
  registry — mismo origen que la pestaña Equipo). Read-only (sin revocar desde admin — G5 diferido).
- **Navbar** — link "Asistentes" → `/helpers`.

**Gates (todos verdes):**
- `check-route-permission-coverage.ts`: 235 rutas, 0 sin mapear (68 reglas + allowlist).
- tsc limpio en `apps/api` (con `--max-old-space-size=6144`; OOM con el default, no es error de
  tipos) y `apps/admin`.
- Smoke read-only del shape exacto contra prod (`scratchpad/smoke-admin-helpers.cjs`): 1 member
  activo (dr-prueba ← andreabarbagal, 4 toggles ON), 0 pending, `invitedByEmail` resuelto a
  `sismo.sistema1@gmail.com` (el owner). Shape válido, datos esperados.

**Self-review (data-exposure admin):** solo metadatos (emails/nombres/foto/permisos/doctor), nada
clínico/financiero (G2); sin input de usuario en queries; nullables manejados (foto, nombre→email,
invitedByEmail); pending filtrado a no-expiradas. Supuesto documentado: `GET /api/doctors` devuelve
TODOS los doctores (verificado) — si algún día se filtrara, un helper cuyo doctor no esté en la lista
no se renderizaría (hoy imposible).

**¿Bug hunt?** No amerita el hunt multi-ronda de §16 (ese era para la familia "componente
compartido sin gate" en write-paths). Extensión B es un endpoint aislado read-only admin-only —
categoría "mecánico → inline pass" de la heurística. Pero sí valían 2 checks dirigidos, ambos
limpios: (1) blast radius del prefijo `admin` nuevo → `admin/doctor-members` es la ÚNICA ruta bajo
`/api/admin/*`, sin hermanos que mal-clasificar, y el match es segment-bounded; (2) sobre-exposición
de datos → `select` explícito (user id/email/name/image, doctor id/slug/name/specialty), permissions
= booleans, nada clínico/financiero.

**SHIPPED + VERIFICADO EN VIVO 2026-07-22** (`@healthcare/api` + `@healthcare/admin`):
- Commits: `4403c6d3` (endpoint + `/helpers` + Navbar + route-permissions) y `64677f6f`
  (link "Asistentes (helpers)" en el menú de `/dashboard` — el dashboard es un menú de cards que
  NO renderiza el Navbar, así que el link del Navbar no bastaba para llegar).
- **Verificación funcional confirmada por el usuario:** `/helpers` renderiza a Andrea
  (`andreabarbagal@gmail.com`) bajo Dr. Gerardo Lopez Fafutis (dr-prueba) con su resumen de
  permisos; el resto de doctores como "Sin asistente". Endpoint api desplegado OK (los datos
  cargaron). **Extensión B cerrada.**
