# NUEVOS USUARIOS — Plan: máximo 1 helper (member) activo por doctor

> **Estado:** PLANEADO 2026-07-22 (decisión del usuario: enforce exactamente 1). **Sin código.**
> Base v1: `00-REQUISITOS`, `01-DISENO`. Vista admin de helpers = doc hermano
> `04-PLAN-vista-admin-helpers.md` (independiente de este). Todo lo citado verificado 2026-07-22.

---

## 1. Estado actual (verificado)

Hoy **NO hay límite** de members por doctor. Constraints existentes en `doctor_members`
(`packages/database/prisma/migrations/add-doctor-members.sql`):
- `doctor_members_one_owner_per_doctor` — 1 OWNER activo por doctor.
- `doctor_members_one_active_per_user` — 1 gmail = 1 portal (un user no activo en 2 lados).

No hay nada que impida N members activos en un mismo doctor. **Decisión (2026-07-22): limitar a
exactamente 1 helper activo por doctor** ("solo una Andrea para dr-prueba").

**Gate de datos (read-only prod 2026-07-22):** solo dr-prueba tiene members (1 activo), 0
invitaciones pendientes en toda la BD → ningún dato viola el nuevo constraint. **Re-verificar
justo antes de aplicar** (`scratchpad/check-member-count.cjs`), por si se crean members entre tanto.

---

## 2. Constraint de BD (el backstop atómico)

Migración SQL standalone idempotente (aplicar a Railway ANTES del código; NO `prisma db push`):

```sql
-- Migration: add-one-active-member-per-doctor.sql
-- Purpose: v2 rule — a doctor may have at most ONE active MEMBER (helper).
-- OWNER excluded (role='MEMBER'); REVOKED doesn't count (status='ACTIVE') → revoke→re-invite
-- keeps working unchanged. Analogous to one_active_per_user but keyed by doctor_id.
CREATE UNIQUE INDEX IF NOT EXISTS doctor_members_one_active_member_per_doctor
    ON public.doctor_members(doctor_id)
    WHERE role = 'MEMBER' AND status = 'ACTIVE';
```

- No expresable en Prisma (índice parcial) → solo SQL. Documentar en `database-architecture.md §6`
  junto a los otros índices que `prisma db push` revierte.
- Convivencia OK: OWNER (excluido) + 1 MEMBER activo + N REVOKED.
- **Rollback a multi-helper** = `DROP INDEX doctor_members_one_active_member_per_doctor;` (cero
  migración de datos, igual que el plan multi-portal).

---

## 3. Checks de aplicación (mensajes amables; el índice es el backstop)

Semántica **"1 slot"**: el cupo único lo ocupa (a) un member activo **o** (b) una invitación
PENDING. Revocar el member o cancelar la invitación pendiente (endpoints ya existen) libera el slot.

### 3.1 Crear invitación — `POST /api/team/invites` (`invites/route.ts`)

Antes de crear la invitación:
1. **Lazy-expire primero** (⚠️ ver gap G2): `updateMany` que marca EXPIRED las PENDING vencidas
   de ESTE doctor — mismo sweep que ya hacen los GET (`invites/route.ts:25-28`). Sin esto una
   invitación vencida-pero-aún-PENDING ocuparía el slot falsamente.
2. Si el doctor ya tiene un **member ACTIVE** → 409 "Ya tienes un asistente vinculado; revócalo
   antes de invitar a otro."
3. Si el doctor ya tiene una **invitación PENDING** (tras el sweep) → 409 "Ya tienes una
   invitación pendiente; cancélala antes de invitar a otro."

### 3.2 Aceptar invitación — `accept/route.ts` (dentro de la transacción)

Además del check actual "el user no está activo en otro portal" (`accept/route.ts:52-57`), añadir:
- El **doctor destino no tiene ya un member ACTIVE** → 409 "Este consultorio ya tiene un asistente."
- El índice `one_active_member_per_doctor` es el **backstop atómico** contra la carrera (dos
  accepts para el mismo doctor). ⚠️ ver gap G1 sobre el mensaje del P2002.

### 3.3 UI pestaña Equipo (owner) — `TeamSection.tsx`

Cuando el slot está ocupado (member activo o invite pendiente): **deshabilitar "Invitar"** con
hint ("Solo se permite un asistente; revoca/cancela el actual para cambiarlo"). Cortesía — el
server ya lo bloquea (§3.1). Editar permisos del member existente (PATCH) NO se afecta.

---

## 4. Gaps encontrados en el re-análisis (2026-07-22)

Cada uno con su fix propuesto. G1 y G2 son **bugs reales** si no se atienden; G3 es una decisión;
G4-G5 son notas menores.

### G1 — El P2002 del nuevo índice cae en un catch con mensaje EQUIVOCADO *(real)*

`accept/route.ts:88-93` ya tiene un catch de `P2002` que devuelve **"Tu cuenta ya fue vinculada a
un consultorio"** — pensado para el índice `one_active_per_user` (el USER ya está activo en otro
lado). El nuevo índice `one_active_member_per_doctor` dispara **el mismo P2002**, pero su causa es
distinta ("este DOCTOR ya tiene asistente") → el usuario vería un mensaje que no aplica.
**Fix:** en el catch, inspeccionar `error.meta?.target` para distinguir qué índice violó y
devolver el mensaje correcto por caso (dos strings, un `switch`/`if`). Sin esto el enforcement
funciona pero miente sobre el porqué.

### G2 — El check "ya hay invite pendiente" debe lazy-expirar ANTES *(real)*

Si se cuenta la invitación PENDING hacia el slot (§3.1 paso 2) sin barrer primero las vencidas,
una invitación de hace 8 días (PENDING en BD pero expirada por fecha) bloquearía crear una nueva
para siempre. **Fix:** correr el `updateMany` de expiración (mismo patrón que
`invites/route.ts:25-28` y `accept/route.ts:27-30`) ANTES de evaluar el slot. Ya está en §3.1
paso 1 — se resalta aquí porque es fácil de omitir.

### G3 — Carrera TOCTOU al crear invitaciones a DISTINTOS emails *(decisión)*

El check de "no hay pendiente" en §3.1 es a nivel app (lee, luego escribe) — no atómico. Dos POST
casi simultáneos con emails distintos podrían pasar ambos el check y crear **2 invitaciones
pendientes**. El índice `one_active_member_per_doctor` NO lo evita (solo cuenta ACTIVE, no
PENDING) — pero al aceptar, solo la primera podría materializar el member (la segunda choca con el
índice de member → P2002/G1). Impacto: cosmético (2 pendientes, solo 1 aceptable), no un hueco de
seguridad. **Opciones:** (a) aceptarlo — el índice de member sostiene la invariante real; (b)
endurecer con un índice parcial `member_invites_one_pending_per_doctor ON (doctor_id) WHERE
status='PENDING'` para garantía dura en BD. **Recomendado (b)** — es barato y cierra la carrera
limpiamente; ojo que entonces el catch de creación debe mapear ESE P2002 a "ya hay pendiente"
(mismo patrón G1 en el endpoint de invites). Requiere el mismo gate de datos (0 pendientes hoy → OK).

### G4 — Lock de la migración *(menor)*

`CREATE UNIQUE INDEX` (sin CONCURRENTLY) toma ACCESS EXCLUSIVE sobre `doctor_members`. La tabla es
diminuta (≈10 filas) → instantáneo, sin problema. Nota sólo por si la tabla crece: `CONCURRENTLY`
no admite `IF NOT EXISTS` dentro de transacción — para hoy, el create simple es correcto.

### G5 — Interacción con re-invite tras revoke *(verificado, sin fix)*

Confirmado que el flujo revoke→re-invite (validado en vivo, `01-DISENO §18`) SIGUE funcionando: al
revocar, el member pasa a REVOKED → 0 activos → slot libre → re-invite permitido → accept crea el
nuevo ACTIVE (el índice solo cuenta ACTIVE, ignora la fila REVOKED vieja). Sin cambios necesarios;
se anota para que el implementador lo pruebe explícitamente (regresión).

---

## 5. Gates de entrega

- Re-verificar prod read-only (`active members` por doctor ≤ 1; y si se hace G3(b), `pending` por
  doctor ≤ 1) INMEDIATAMENTE antes de crear los índices.
- SQL a Railway → confirmar índice(s) creados (`\d doctor_members` / query a `pg_indexes`) → luego
  pushear el código con los checks §3 + los fixes G1/G2.
- Smoke con cuidado en dr-prueba: (i) con member activo, crear invite → 409; (ii) revoke →
  re-invite → accept sigue OK (G5).
- tsc limpio en `apps/doctor` (los endpoints de team viven ahí).
- Explicación + OK del usuario antes del push (regla del repo; main deploya a prod).

---

*Creado 2026-07-22. Decisión del usuario: máximo 1 helper activo por doctor — ENFORCE. Re-análisis
del plan encontró G1 (mensaje P2002 equivocado) y G2 (lazy-expire antes del check) como bugs
reales a atender, G3 como decisión (hardening opcional del pending), G4/G5 como notas.*
