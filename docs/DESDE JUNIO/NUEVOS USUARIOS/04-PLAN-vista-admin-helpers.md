# NUEVOS USUARIOS — Plan: vista admin de helpers ligados a cada doctor

> **Estado:** PLANEADO 2026-07-22 (decisión del usuario: planear ahora, construir después).
> **Sin código.** Base v1: `00-REQUISITOS`, `01-DISENO`. Límite de 1 helper = doc hermano
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
