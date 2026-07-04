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

## Bitácora de pruebas en vivo (fallos → fixes → evals futuros)

| # | Pregunta | Fallo observado | Causa raíz | Fix | Commit |
|---|---|---|---|---|---|
| 1 | "¿Tengo citas vencidas?" | Reportó **1 de 13** vencidas (solo la PENDING; ignoró las 12 CONFIRMED expiradas) | El modelo **reconstruyó** la definición de "vencida" filtrando `status=PENDING` por su cuenta | `get_bookings` ahora acepta **`vencidas: true`** — la definición completa (PENDING **o** CONFIRMED + hora pasada, TZ MX) vive **server-side**; prompt + descripción del tool obligan a usar el flag. Verificado contra prod: encuentra exactamente las 13 de la UI | `1be4ac90` |
| 2–7 | *(proactivo, sin fallo en vivo)* Caza sistemática de edge cases | 6 encontrados por análisis: disponibilidad sin servicio miente (E1), conteos >50 mal (E2), "próxima cita" ordenada por creación (E3), acentos en búsqueda (E4), precio ausente (E5), weekday mal calculado (E6) | Cada uno era lógica/definición dejada al modelo o dato faltante en el tool | Los 6 arreglados server-side + 2 reglas de honestidad en el prompt (contar con `totalEncontradas`; las citas no registran consultorio). Catálogo completo + límites L1–L5 en [`03-EDGE-CASES-lectura.md`](03-EDGE-CASES-lectura.md). ⚠️ **E6 en realidad NO quedó en ese commit** (el mensaje lo decía, el diff no) — ver fila 8 | `412f599e` |
| 11 | "¿a qué hora me desocupo el lunes?" (cita con bloque extendido) — el doctor comparó contra la UI | El agente dijo "ocupado hasta 15:32"; la UI (correcta) muestra 14:47 | El fix E7 v1 calculó `ocupadoHasta = fin + ext`, pero `extendedBlockMinutes` cuenta **desde el INICIO** (`availability-calculator`: `max(end, start + ext)`) — asumí la semántica en vez de leer la fórmula canónica | `ocupadoHasta = max(fin, inicio + ext)`, solo emitido si supera el fin nominal (una ext ≤ duración no extiende nada). Smoke-tested: 09:00–09:45 +347 → 14:47 = UI ✓. **Lección:** todo campo derivado de otro dominio se calcula con la MISMA fórmula del motor canónico, no con una interpretación | *(pendiente de commit)* |
| 10 | "¿cómo está el domingo?" (repetida tras crear bloqueos en la UI) | Respondió "ya lo revisamos, aquí va de nuevo" **sin llamar tools** (sin footnote "consultó:") — repitió su respuesta anterior aunque la BD ya había cambiado | El historial client-side re-inyecta las respuestas previas del modelo y éste las trata como vigentes; nada le decía que la agenda cambia entre turnos | Prompt regla 10: TODA pregunta de estado se re-consulta EN ESTE TURNO, aunque sea idéntica a una anterior — repetir sin re-consultar = información falsa. (El data path nunca cachea: cada tool es query fresca; el fallo era conductual.) Nota aparte: el "undo" del bloqueo 09:00–18:00 en la UI NO lo borró de la BD (posible bug de UI, en investigación — BLK-6). **Fix validado en vivo** tras el deploy: 3 preguntas de estado seguidas = 3 re-consultas frescas, cada una reflejando cambios de la UI de segundos antes (bloqueo nuevo + bloque extendido +347 min → ocupadoHasta 15:32 ✓ contra BD); BLK-6 pasó en segunda ronda (borrado sí persiste; el "undo" fallido no se reprodujo) | *(este commit)* |
| 8–9 | *(análisis de alineación vs `04-PERMUTACIONES`, 2026-07-04)* | **E6 fantasma:** el weekday nunca llegó al prompt aunque commit y docs lo daban por hecho. **E7 nuevo:** `extendedBlockMinutes` invisible al agente → "¿a qué hora me desocupo?" respondía con el fin nominal (prod tiene extensiones de 60–705 min) | Commit message ≠ diff (E6); campo faltante en `BOOKING_SELECT` (E7) | E6: `mxTodayWeekday()` en el prompt. E7: `bloqueExtendidoMinutos` + `ocupadoHasta` (fin real server-side) en toda cita con extensión + regla 9 del prompt. Smoke-tested contra prod (510 min → 18:30 ✓). **Lección:** verificar que el diff cumpla lo que el mensaje del commit promete | *(este commit)* |

**✅ Validación en vivo post-deploy `bc7e2610` (2026-07-04):** las 3 preguntas del plan de
lectura pasaron: (1) *vencidas* = **16 exactas**, verificadas 1:1 contra la BD — de paso se
detectó que la query #3 del TOOLING contaba 6 porque ignoraba las citas legacy por slot (fecha en
el slot, no en la fila) → query corregida en el TOOLING; (2) *"¿qué tengo el martes?"* resolvió
martes 7 de julio correcto (E6), y los 9 weekdays de la lista de vencidas salieron todos bien;
(3) *"¿a qué hora me desocupo?"* usó `ocupadoHasta` (E7) y razonó bien el día sin extensiones.

> **Lección de diseño (aplica a PR 2/3):** todo concepto con definición de negocio precisa
> (*vencida*, *disponible*, *completo*) debe ser un **parámetro del tool que el servidor resuelve**,
> nunca algo que el modelo infiera de una descripción. Cada fallo de esta bitácora se convierte en
> un caso del set de evals (gap G11) antes de dar capacidades de escritura.

## Próximos pasos

1. Seguir probando el agente en vivo (calidad de respuestas: vencidas, disponibilidad,
   find_patient) y anotar fallos aquí antes de dar más capacidades.
2. **Pre-PR 2 (2026-07-04):** catálogo exhaustivo de permutaciones creado en
   [`04-PERMUTACIONES-agenda.md`](04-PERMUTACIONES-agenda.md) (actor×acción, matriz de
   transiciones, orden, efectos secundarios, requisitos §7 para PR 2). Los checkboxes se validan
   en vivo con el método TOOLING; cada caso alimenta el set de evals (G11).
3. **PR 2** — propuestas internas (create_range / block_time / delete_range) con cards de
   confirmación. El patrón preview→confirm ya existe en `ranges/block` (`dryRun`). Requisitos
   derivados de las permutaciones: ver `04` §7.
4. **PR 3** — propuestas de citas (create/cancel/reschedule/complete). Requisitos previos del
   gap review: executor vía `completeBooking()` del hook (G1), re-validación al proponer (G3),
   orden cancelar→crear en reschedule (G4), evals (~15 prompts) antes de mergear (G11).
5. **PR 4** — voz + retirar el chat v1 + evaluar limpieza de `/v1` y `/v2`.

## Commits (en `main`)

- `4a100ab6` fix(appointments): locks + overlap cross-family + buffer (auditoría ronda 2) — **desplegado**
- `21aa4d59` fix: `$executeRaw` para el advisory lock (hotfix del outage) — **desplegado**
- `e8a02eb0` / `ec75f366` docs: research, auditoría, diseño, gap review
- `fef2a3d0` feat(agenda-agent): PR 1 read-only — **sin push**
- `b13a0049` fix(agenda-agent): 7 hallazgos del code-review — **sin push**

---

*Mantener este archivo actualizado al final de cada sesión.* Índice: [`README.md`](README.md).
