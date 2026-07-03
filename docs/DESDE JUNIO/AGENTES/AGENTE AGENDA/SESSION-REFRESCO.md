# 🔄 Refresco de sesión — AGENTE AGENDA — LÉEME PRIMERO

> Snapshot del estado, decisiones y próximos pasos del **agente de agenda**. Para una sesión/LLM en
> frío: lee este archivo, luego el [`README.md`](README.md) y de ahí los numerados.
> Última actualización: **2026-07-03**.

---

## En una frase

Agente de IA conversacional para la agenda (`/appointments`), construido **desde cero con
tool-calling nativo** (Claude, loop multi-paso server-side). **PR 1 (solo lectura) está CONSTRUIDO
y COMMITEADO** — falta la `ANTHROPIC_API_KEY` en Railway y el push para que viva.

## Estado: qué está hecho

**✅ Fase 0 — Research + auditoría + endurecimiento del sustrato (commiteado y DESPLEGADO):**
- Research (`00`): el `/appointments` vivo usa el **modelo de rangos**; el chat IA viejo quedó
  huérfano en la página legacy v1 (slots) — por eso se construye desde cero.
- Auditoría (`01`) + 2 rondas de fixes **ya en prod**: cross-tenant 403 en range-bookings,
  advisory lock anti doble-booking en los 4 caminos de creación (⚠️ lección: `$executeRaw`, NO
  `$queryRaw` — el `$queryRaw` con funciones void **tumbó la creación de citas en prod** hasta el
  hotfix `21aa4d59`), buffer aplicado al crear, validación de `extendedBlockMinutes`, P2028→503.
  Lib compartida: `apps/api/src/lib/booking-overlap.ts`.
- Diseño (`02`) + revisión con 11 gaps (G1: el LedgerEntry al completar cita se crea desde el
  FRONTEND — el executor de PR 3 debe usar el hook, no el PATCH crudo).

**✅ PR 1 — agente read-only (commits `fef2a3d0` + fixes de review `b13a0049`, SIN push aún):**
- `apps/doctor/src/lib/agenda-agent/` — cliente Anthropic raw-fetch (tool use, timeout 60s,
  `tool_choice`), helpers de fecha MX, y **7 tools de lectura**: `get_day_schedule`,
  `get_bookings` (con flag *vencida*), `get_availability` (vía el endpoint real con
  `skipCutoff=1` — mismo motor que la página pública, sin el filtro de 1h de pacientes),
  `get_services`, `get_locations`, `get_booking_detail`, `find_patient`.
- `POST /api/agenda-agent` — loop de tools (máx 8 iteraciones + **síntesis final** con
  `tool_choice: none` si se agota), `doctorId` de la sesión inyectado server-side en cada tool,
  **cap diario de tokens por doctor** (medianoche MX), resultados de tool capados a 8KB,
  manejo de `max_tokens` (mensaje honesto de truncado), 503 amable sin API key.
- UI: botón verde **"Asistente"** en `/appointments` → `AgendaAgentPanel` (chat lateral,
  sugerencias, footnote "consultó: …"). Hook `useAgendaAgent` (historial client-side por sesión).
- Verificación hecha: las 9 formas de query Prisma **smoke-tested contra prod** (read-only),
  type-check limpio en ambas apps, code-review de 3 ángulos con 7/8 hallazgos aplicados
  (diferido: paquete compartido de fechas).

## ✅ EN VIVO (2026-07-03)

1. ✅ `ANTHROPIC_API_KEY` agregada al servicio `@healthcare/doctor` (opcionales disponibles:
   `AGENDA_AGENT_MODEL` default `claude-sonnet-5`, `AGENDA_AGENT_DAILY_TOKEN_CAP` default 500k).
2. ✅ Push + deploy (`21aa4d59..ca1c30dc`).
3. ✅ **Validado en prod:** 3 conversaciones del agente registradas en `llm_token_usage`
   (`endpoint='agenda-agent'`, dr-prueba, claude-sonnet-5, ~2.7–5k tokens por pregunta — perfil
   normal del loop multi-tool). El botón "Asistente" vive en `/appointments`.

## Decisiones (no re-litigar)

- Construir **desde cero** con tool-calling; el chat v1 y el RAG son antecedente, no base.
- **v1 escribe NADA**: lecturas autónomas; las escrituras llegan como propuestas→confirmación
  (PR 2 interno, PR 3 citas). Todo lo que notifica a un paciente = confirmación SIEMPRE.
- `get_availability` usa el **endpoint real** (nunca deducir huecos de la lista de citas).
- El modelo NUNCA aporta `doctorId` ni IDs sin validar contra la sesión.
- Regla dura post-outage: **todo SQL crudo / query shape nuevo se smoke-testea contra prod
  (read-only, `railway run`) ANTES de push** — no hay staging.

## Próximos pasos

1. Seguir probando el agente en vivo (calidad de respuestas: vencidas, disponibilidad,
   find_patient) y anotar fallos aquí antes de dar más capacidades.
2. **PR 2** — propuestas internas (create_range / block_time / delete_range) con cards de
   confirmación. El patrón preview→confirm ya existe en `ranges/block` (`dryRun`).
3. **PR 3** — propuestas de citas (create/cancel/reschedule/complete). Requisitos previos del
   gap review: executor vía `completeBooking()` del hook (G1), re-validación al proponer (G3),
   orden cancelar→crear en reschedule (G4), evals (~15 prompts) antes de mergear (G11).
4. **PR 4** — voz + retirar el chat v1 + evaluar limpieza de `/v1` y `/v2`.

## Commits (en `main`)

- `4a100ab6` fix(appointments): locks + overlap cross-family + buffer (auditoría ronda 2) — **desplegado**
- `21aa4d59` fix: `$executeRaw` para el advisory lock (hotfix del outage) — **desplegado**
- `e8a02eb0` / `ec75f366` docs: research, auditoría, diseño, gap review
- `fef2a3d0` feat(agenda-agent): PR 1 read-only — **sin push**
- `b13a0049` fix(agenda-agent): 7 hallazgos del code-review — **sin push**

---

*Mantener este archivo actualizado al final de cada sesión.* Índice: [`README.md`](README.md).
