# 🔄 Refresco de sesión — AGENTE AGENDA — LÉEME PRIMERO

> Snapshot del estado, decisiones y próximos pasos del **agente de agenda**. Para una sesión/LLM en
> frío: lee este archivo, luego el [`README.md`](README.md) y de ahí los numerados.
> Última actualización: **2026-07-04**.

---

## En una frase

Agente de IA conversacional para la agenda (`/appointments`), construido **desde cero con
tool-calling nativo** (Claude, loop multi-paso server-side). **PR 1 (lecturas) y PR 2 (propuestas
de rangos/bloqueos con cards de confirmación) VIVEN en prod, ambos validados en vivo**
(2026-07-04, bitácora filas 1–18; referencia del sistema en
[`05-REFERENCIA-TECNICA-AGENTE.md`](05-REFERENCIA-TECNICA-AGENTE.md)). **Siguiente: PR 3**
(propuestas de citas) — prerequisitos: buffer>0 en dr-prueba + bloque CIT de `04` + evals G11.

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

**✅ PR 1 — agente read-only (desplegado 2026-07-03, validado en vivo 2026-07-04):**
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
- **El endpoint del agente NUNCA escribe**: lecturas autónomas; escrituras = propuesta→card→el
  CLIENTE ejecuta el endpoint real tras confirmación del doctor (PR 2 ya vivo para
  rangos/bloqueos; PR 3 citas). Todo lo que notifica a un paciente = confirmación SIEMPRE.
- `delete_range` del agente usa SOLO el camino individual protegido, nunca el bulk (RNG-11/12).
- `get_availability` usa el **endpoint real** (nunca deducir huecos de la lista de citas).
- El modelo NUNCA aporta `doctorId` ni IDs sin validar contra la sesión.
- Regla dura post-outage: **todo SQL crudo / query shape nuevo se smoke-testea contra prod
  (read-only, `railway run`) ANTES de push** — no hay staging.

## Bitácora de pruebas en vivo (fallos → fixes → evals futuros)

| # | Pregunta | Fallo observado | Causa raíz | Fix | Commit |
|---|---|---|---|---|---|
| 1 | "¿Tengo citas vencidas?" | Reportó **1 de 13** vencidas (solo la PENDING; ignoró las 12 CONFIRMED expiradas) | El modelo **reconstruyó** la definición de "vencida" filtrando `status=PENDING` por su cuenta | `get_bookings` ahora acepta **`vencidas: true`** — la definición completa (PENDING **o** CONFIRMED + hora pasada, TZ MX) vive **server-side**; prompt + descripción del tool obligan a usar el flag. Verificado contra prod: encuentra exactamente las 13 de la UI | `1be4ac90` |
| 2–7 | *(proactivo, sin fallo en vivo)* Caza sistemática de edge cases | 6 encontrados por análisis: disponibilidad sin servicio miente (E1), conteos >50 mal (E2), "próxima cita" ordenada por creación (E3), acentos en búsqueda (E4), precio ausente (E5), weekday mal calculado (E6) | Cada uno era lógica/definición dejada al modelo o dato faltante en el tool | Los 6 arreglados server-side + 2 reglas de honestidad en el prompt (contar con `totalEncontradas`; las citas no registran consultorio). Catálogo completo + límites L1–L5 en [`03-EDGE-CASES-lectura.md`](03-EDGE-CASES-lectura.md). ⚠️ **E6 en realidad NO quedó en ese commit** (el mensaje lo decía, el diff no) — ver fila 8 | `412f599e` |
| 12 | *(PR 2, code-review pre-push)* | 5 hallazgos ANTES de desplegar | Los pre-checks de los tools **asumían** la semántica de los endpoints en vez de leerla (misma clase que E7 v2) | (1) `daysOfWeek` del endpoint es lunes=0 (el tool usaba JS domingo=0 → rangos recurrentes UN día corridos) — conversión en el executor; (2) bloqueos exigen fronteras de **30 min** (la descripción decía 23:45 → todo bloqueo de día completo daba 400) — descripción 00:00–23:30 + pre-check; (3) `POST ranges` es TODO-O-NADA ante conflictos (el preview prometía parcial) — propuesta con conflicto ya no se registra, el modelo re-planea; (4) executor leía `data.blocked` (es `datesBlocked`); (5) cards de turnos viejos ejecutables para siempre — solo el último mensaje mantiene el botón | `1b90b3fd` |
| 13 | **Primera escritura del agente en prod** ✅ (2026-07-04): "bloquea todo el día" lun 20 jul | *(sin fallo — hito)* Loop completo: propuesta → card → confirmar → executor → fila en `blocked_times` verificada en BD → turno de verificación automático ("[Resultado de la ejecución del plan] … ÉXITO") | — | Gotcha operativo: tras un deploy, el navegador corre el bundle VIEJO (el tool corría server-side pero la card no aparecía) → hard refresh. El agente además clarificó el motivo antes de proponer (protocolo §3.2 en vivo) | `1b90b3fd` |
| 14 | "créame un rango el sáb 25 de 9 a 13 y bloquéame de 10 a 11" (había rango 07:00–14:00) | (a) El plan delete→create en UN plan era imposible: `propose_create_range` validaba contra la BD actual, no contra propuestas pendientes del mismo plan — **el propio agente lo diagnosticó** ("valida contra el estado actual, no contra propuestas pendientes") y ofreció workaround de 2 turnos; (b) las cards salieron en orden INVERTIDO al narrado (#1 bloquear, #2 eliminar) | (a) pre-checks no plan-aware, contradiciendo el propio prompt ("eliminar ANTES de crear"); (b) `Promise.all` sobre los tool_use de una misma respuesta → el orden de registro dependía de qué query terminara primero, no del orden del modelo | (a) el collector expone los rangos que pasos previos del plan eliminan y `create_range` los excluye del overlap + advertencia de dependencia en la card; (b) ejecución de tools **secuencial** (orden de registro = orden de llamada = orden del plan). Lo positivo: el fix (3) del review funcionó en vivo — no hubo card condenada al 409, hubo re-planeación inteligente con 2 opciones | *(pendiente de commit)* |
| 15 | **Plan de 3 pasos con dependencias ✅** (2026-07-04, post-`b6acbbf5`): reemplazo de rango + bloqueo (sáb 25 jul) | *(sin fallo — hito)* Clarificación multi-turno ("¿solo bloqueo o reemplazar horario?") → opción 2 → UN plan: #1 eliminar 07:00–14:00, #2 crear 09:00–13:00 **con advertencia de dependencia**, #3 bloquear 10:00–11:00 (recordado de 3 turnos atrás) → ejecución secuencial ÉXITO×3 → BD verificada exacta (timestamps a 400ms, en orden) | — | Los dos fixes de la fila 14 validados en vivo: orden de cards correcto + patrón eliminar→crear en un solo plan. La ejecución más compleja del agente hasta ahora | `b6acbbf5` |
| 18 | "desbloquea el lun 20, elimina los rangos de oct-nov y restaura jul 7–15" (limpieza multi-mes) | Respuesta truncada ("demasiado larga") — el loop se agotó sin proponer nada | Para proponer deletes el modelo necesita **ids**, y su única fuente era `get_day_schedule` (UN día por llamada) → oct-nov ≈ 40+ días reventó el cap de 8 iteraciones. *Los tools deben escalar con el tamaño natural de la petición del doctor* | Nuevo tool de lectura **`get_ranges {startDate, endDate}`**: rangos Y bloqueos con ids de hasta ~120 días en UNA llamada; descripciones y prompt dirigen al modelo a usarlo para multi-día. Review fix: totales PRIMERO en el JSON para que sobrevivan al truncado de 8KB (patrón E2). **Validado en vivo post-deploy con la MISMA petición que falló**: 1 llamada a get_ranges → plan de 3 pasos (desbloquear + eliminar 23 + crear 9) → ÉXITO×3 → BD verificada exacta. El agente limpió su propia campaña de pruebas | `43625b07` |
| 16 | **Test #7 — bloqueo sobre cita ✅** (lun 3 ago, cita "test 7") | *(sin fallo)* El agente detectó la cita ANTES de proponer, explicó el overlay (bloquear ≠ cancelar), admitió su límite ("aún no puedo cancelar citas") y pidió decisión; tras "procede", la card llevó la ⚠️ con la cita nombrada; post-ejecución BD verificada: bloqueo existe Y la cita sigue CONFIRMED | — | La advertencia viajó por TODAS las capas: pre-check → prosa → card → resumen de ejecución → recordatorio final | `b6acbbf5` |
| 17 | **4 probes de resiliencia ✅** (fuera de alcance / imposible / enredada / ambigua) | *(sin fallo)* (1) factura → declinó y nombró sus capacidades; (2) "reactiva la cancelada de vvvvvv" → **verificó el dato primero** (no existe cancelada), explicó estados terminales y el camino real; (3) petición enredada → CERO propuestas, paráfrasis numerada con 3 preguntas concretas ancladas al contexto de la sesión; (4) "¿el miércoles?" → preguntó cuál con 2 opciones y manejó "ambos" consultando los dos días | — | La sección de resiliencia del prompt (`b6acbbf5`) validada completa; estas 4 respuestas van al set de evals (G11) como golden cases | `b6acbbf5` |
| 11 | "¿a qué hora me desocupo el lunes?" (cita con bloque extendido) — el doctor comparó contra la UI | El agente dijo "ocupado hasta 15:32"; la UI (correcta) muestra 14:47 | El fix E7 v1 calculó `ocupadoHasta = fin + ext`, pero `extendedBlockMinutes` cuenta **desde el INICIO** (`availability-calculator`: `max(end, start + ext)`) — asumí la semántica en vez de leer la fórmula canónica | `ocupadoHasta = max(fin, inicio + ext)`, solo emitido si supera el fin nominal (una ext ≤ duración no extiende nada). Smoke-tested: 09:00–09:45 +347 → 14:47 = UI ✓ y **validado en vivo post-deploy** (el agente respondió "te desocupas a las 14:47" distinguiendo bien el bloqueo de día completo como cosa aparte). **Lección:** todo campo derivado de otro dominio se calcula con la MISMA fórmula del motor canónico, no con una interpretación | `3406c940` |
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

## ✅ Campaña de validación de permutaciones (2026-07-04) — RESUMEN

Catálogo exhaustivo en [`04-PERMUTACIONES-agenda.md`](04-PERMUTACIONES-agenda.md) (actor×acción,
matriz completa de transiciones, orden, efectos secundarios) + validación en vivo con el método
TOOLING (usuario actúa en la UI de prod → LLM verifica read-only en BD):

- **Validado ✅:** fase lectura (vencidas=16 exactas, E6 weekday, E7 ocupadoHasta), BLK-1..7
  completo, RNG-1/3/5/11/12, EDT-1/2. **Regla 10** (re-consultar cada turno) validada.
- **Fixes del agente que salieron de la campaña** (todos en prod): E6 fantasma (weekday nunca
  llegó al prompt en `412f599e`), E7 v1 (campo invisible) y **E7 v2** (semántica: la extensión
  cuenta desde el INICIO — el doctor lo cazó comparando contra la UI, 15:32 vs 14:47), regla 10
  anti-respuestas-viejas, formato de respuestas (viñetas •, plantilla de día, horas HH:MM–HH:MM).
- **Descubrimiento clave (RNG-11/12):** hay DOS políticas de borrado de rangos — individual
  rechaza si hay citas activas; **bulk procede** (citas quedan huérfanas pero vivas) y **borra en
  cascada los bloqueos** de los días que quedan sin rangos. La card de `delete_range` de PR 2
  debe avisar ambas cosas.
- **Pendiente menor:** RNG-2/7/8/9 (camino individual, auditado en código, no observado en vivo);
  CIT-* requiere `buffer > 0` en settings de dr-prueba (hoy 0) — es territorio PR 3.
- **Backlog UI** (no bloquea): botón "Crear N rangos" habilitado con conflictos y sin feedback al
  fallar; el "undo" de bloqueo que no borró (1 vez, no reproducido).
- **Estado de datos de prueba:** jul 4–15 sin rangos con 3 citas huérfanas CONFIRMED (vvvvvv,
  cita1, cita2); rangos de prueba oct–nov 2026 vivos (decidir limpieza).

## ✅ PR 2 — CONSTRUIDO Y DESPLEGADO (2026-07-04, `1b90b3fd`)

Propuestas internas con cards de confirmación: `propose_create_range` / `propose_block_time` /
`propose_unblock_time` / `propose_delete_range` (camino individual protegido, NUNCA bulk).
Planes ORDENADOS multi-paso con executor secuencial client-side y corte en fallo; resultados
re-inyectados a la conversación (turno de verificación). Referencia completa del sistema:
[`05-REFERENCIA-TECNICA-AGENTE.md`](05-REFERENCIA-TECNICA-AGENTE.md).

**✅ VALIDACIÓN EN VIVO COMPLETA (2026-07-04):** #1 bloqueo simple end-to-end · #2/#4 clarificación
+ plan de 3 pasos con dependencias (eliminar→crear→bloquear, BD verificada, timestamps en orden) ·
#5 weekday integrity (5 lunes de agosto = Monday en BD) · #7 advertencia de citas vivas (todas las
capas) · 4 probes de resiliencia (filas 15–17 de la bitácora). PR 2 queda validado en producción.

## Próximos pasos

1. **Prerequisitos de PR 3** (en orden): (a) poner `appointmentBufferMinutes > 0` en dr-prueba y
   correr el bloque CIT de [`04`](04-PERMUTACIONES-agenda.md); (b) construir el **set de evals
   (G11)** seedeado con los golden cases de la bitácora (filas 1, 10, 15–17: vencidas, re-consulta,
   plan 3 pasos, probes de resiliencia); (c) decidir limpieza de datos de prueba restantes (citas
   `test 7`/`vvvvvv`/`cita1`/`cita2` — solo UI; jul 25 / lunes de agosto / bloqueo ago 3 — el
   agente puede).
2. **PR 3** — propuestas de citas (create/cancel/reschedule/complete). Requisitos previos del
   gap review: executor vía `completeBooking()` del hook (G1), re-validación al proponer (G3),
   orden cancelar→crear en reschedule (G4), evals G11 antes de mergear. Recordatorio: tier 🔴
   (SMS/email/GCal al paciente) = confirmación SIEMPRE; dependencias reales entre pasos del plan
   (hoy advisorias) convendría resolverlas aquí.
3. **PR 4** — voz + retirar el chat v1 + evaluar limpieza de `/v1` y `/v2`.

## Commits (en `main`, todos desplegados)

- `4a100ab6` fix(appointments): locks + overlap cross-family + buffer (auditoría ronda 2)
- `21aa4d59` fix: `$executeRaw` para el advisory lock (hotfix del outage)
- `e8a02eb0` / `ec75f366` docs: research, auditoría, diseño, gap review
- `fef2a3d0` + `b13a0049` feat(agenda-agent): PR 1 read-only + fixes del code-review
- `1be4ac90` fix: vencidas server-side · `412f599e` fix: edge cases E1–E6
- `bc7e2610` fix: E6 real (weekday) + E7 (ocupadoHasta) + doc `04-PERMUTACIONES`
- `2eb6cc72` fix: regla 10 (re-consultar cada turno)
- `3406c940` fix: E7 v2 (extensión cuenta desde el INICIO — max(fin, inicio+ext))
- `35ec0532` feat: formato de respuestas (viñetas •, plantilla de día) + bullets reales en el panel
- `1b90b3fd` **feat: PR 2** — propuestas internas con cards (4 tools propose_*, executor secuencial, 5 fixes del review)
- `b6acbbf5` fix: orden secuencial de tools + pre-checks plan-aware + resiliencia a input no estructurado
- `43625b07` feat: `get_ranges` (ids multi-día en 1 llamada — el loop se moría de hambre) + totales primero
- `a850ac66` / `c5d9e4af` docs: resultados de campaña, bitácora 12–18

---

*Mantener este archivo actualizado al final de cada sesión.* Índice: [`README.md`](README.md).
