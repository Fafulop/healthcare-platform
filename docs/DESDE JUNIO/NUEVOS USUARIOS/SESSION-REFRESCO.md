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

**Feature completa construida (PR A→D) + 3 rondas de bug hunt post-validación. 6 commits
locales sin pushear**, apilados sobre `345b2a09` (último commit real en `origin/main`):

```
27c04273  fix: status-read endpoints (csd/status, fiel GET, connect/status) mal marcados OWNER_ONLY
0824a18d  fix: botón "Asistente" en /appointments no gateado
216e1606  fix: 3 widgets globales (ChatWidget, VoiceAssistantHubWidget, GoogleCalendarBanner) sin isOwner
3c89cd07  fix: los 8 paneles de chat legacy (*-chat) + 6 quick-actions del dashboard home sin isOwner
d8217f44  fix: voice/transcribe en Notas + form-builder-chat en custom-templates sin isOwner
4a18f7e8  docs: header + método del bug hunt (02-METODO §3.2)
```

Todo el código tiene tsc limpio. **Nada de esto se ha pusheado a prod todavía** — quedó
pendiente terminar la validación en vivo antes de decidir push.

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

**Pendiente (pasos 4-6 de §9):**
4. Member con `flujo` OFF completa una cita (`citas` ON) → verificar que el LedgerEntry se
   crea igual (regla de "efectos internos siempre proceden", 00-REQUISITOS §3.6).
5. Owner revoca a Andrea → verificar pantalla "Acceso revocado"; re-invitar a Andrea (mismo
   portal u otro) → verificar que el slot se liberó y el flujo de re-invitación funciona
   (esto es justo lo que el fix de `dashboard/layout.tsx` en PR D corrigió — confirmarlo en
   vivo cierra ese hallazgo).
6. Revisar `member_audit_log` en prod — debe tener SOLO los writes de Andrea, con el
   `toggle_key` correcto en cada fila.

## Qué sigue (en orden)

1. **Terminar pasos 4-6 de la validación en vivo** (arriba). Usar el método read-only
   documentado en `reference_prod_db_tooling` (memoria) — scratchpad `.cjs` +
   `railway run --service pgvector`.
2. **Pedir el OK del usuario y pushear los 6 commits.** Regla del repo: nunca push sin
   explicar primero qué se va a pushear (feedback_no_push_without_explaining, memoria).
3. **Después de push:** correr la suite de evals del agente (60 casos, gasto real de API,
   nunca corrida todavía) — sobre todo para probar PR C (filtrado de módulos), que solo
   tiene la garantía de identidad de bytes para el owner, cero evals para el path de member.
4. **Fuera de alcance v1** (ver 00-REQUISITOS §7): multi-portal, caps de presupuesto IA por
   member, borradores de receta por members, transferencia de ownership.

## Gotchas para la próxima sesión

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
