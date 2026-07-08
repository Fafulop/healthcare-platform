# 🔄 Refresco de sesión — AGENTE AGENDA — LÉEME PRIMERO

> Snapshot del estado, decisiones y próximos pasos del **agente de agenda**. Para una sesión/LLM en
> frío: lee este archivo, luego el [`README.md`](README.md) y de ahí los numerados.
> Última actualización: **2026-07-08**.

---

## En una frase

Agente de IA conversacional para la agenda (`/appointments`), construido **desde cero con
tool-calling nativo** (Claude, loop multi-paso server-side). **PR 1 (lecturas) y PR 2 (propuestas
de rangos/bloqueos) VIVEN en prod, validados en vivo** (bitácora filas 1–19; referencia del
sistema en [`05-REFERENCIA-TECNICA-AGENTE.md`](05-REFERENCIA-TECNICA-AGENTE.md)). **PR 3
(propuestas de citas) quedó CONSTRUIDO Y REVISADO el 2026-07-06** (diseño D1–D6 + GAP-1..5 en
[`06-PR3-DISENO-citas.md`](06-PR3-DISENO-citas.md); GAP-1 ya desplegado `b2b8d482`; code-review
con 7 fixes aplicados; evals G11 18/19 + smoke 5/5). **Siguiente: push de PR 3 + validación en
vivo** (TRX-6/ledger es LA crítica) — detalle en Próximos pasos.

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
- **Buffer: NO se activa (2026-07-05).** Agrega complejidad innecesaria; la feature está dormida
  en prod (11/11 doctores en 0, no existe UI ni endpoint que la escriba — solo se lee). CIT-5
  queda fuera de alcance; con buffer=0 ese código es inerte.
- **CIT-6 resuelto (2026-07-06): `create_booking` usa la RUTA NORMAL (`range-bookings`), nunca
  `instant`.** El agente no tiene capacidades que la UI no tiene; la ruta normal valida rango,
  buffer, bloqueos y lock. Fuera de horario → el agente lo admite y ofrece crear el rango primero
  (mismo plan). Diseño completo de PR 3 en [`06-PR3-DISENO-citas.md`](06-PR3-DISENO-citas.md).

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
| 19 | (2026-07-05) Propuesta de borrar 30 rangos, 2 con citas — el doctor cazó el consejo | El agente aconsejó "primero tendrías que resolver (cancelar/reagendar) esas citas" para poder borrar los rangos — **modelo mental equivocado**: las citas son independientes (RNG-11 lo probó); cancelar citas reales (¡notifica al paciente!) solo para quitar una ventana es daño real. Además mezclaba acciones (borrar rangos + resolver citas), contra el diseño | El consejo falso venía HARDCODEADO en la descripción del tool y en la advertencia de `proposals.ts` (regla 0 violada por el propio server-side); y el agente arranca sin NINGÚN modelo del sistema — solo prompt + descripciones de tools | (1) Tool description + advertencia corregidas (las citas nunca se afectan; sin prescripciones — la card solo informa); (2) nueva sección **"Cómo funciona la agenda (invariantes)"** en el prompt (independencia rango↔cita, bloqueos reversibles, estados finales, qué notifica, GCal); (3) el code-review de ESTE cambio cazó que "los rangos sincronizan con GCal" (copiado de `00-RESEARCH` §3) es **FALSO** — cero sync de rangos en el código (`googleEventId` de rangos es campo muerto); corregido en prompt y docs (00/04). Lección: los docs también alucinan — todo invariante del prompt se verifica contra el CÓDIGO, no contra los docs | *(este commit)* |
| 22 | **PR 3 VALIDADO EN VIVO ✅** (2026-07-06/07, sesión completa) | *(sin fallo — hito)* Los 6 tools en prod: (1) **TRX-6 LA CRÍTICA**: completar test123 vía card → BD verificada: booking COMPLETED + `ledger_entries` #1570 ($900 efectivo, area/concepto/RFC idénticos al flujo de la UI) — el puente a Flujo de Dinero funciona vía agente; (2) create feliz: cita de Gerardo Lopez con desambiguación de expediente (2 matches → preguntó cuál) y patientId verificado en BD; (3) reagendado con GAP-2 (self-move) tras el hotfix de fila 20-21; (4) probe negativa "límpiame el viernes" → 0 cards, expuso opciones con consecuencias y solo actuó tras orden explícita (TRX-8 de paso: cancel con email+GCal); (5) **la primera misión real: limpieza de 16 vencidas** — 17 detectadas, PENDIENTE excluida por instrucción, cap narrado ("quedarán 6"), 2 tandas (10+6), 16/16 ÉXITO, BD final: 1 sola vencida (la PENDING intacta), 16 NO_SHOW, CERO ingresos falsos | — | Bonus no scripted: el agente advirtió solo que test123 era cita a FUTURO antes de completarla. Costo de la sesión: ~$1.60 USD (ver `05` §8) | *(este commit)* |
| 20 | (2026-07-06, validación PR 3) "mueve test234 30 min más tarde" (el hueco lo ocupa ella misma) | El agente consultó availability, vio 08:30 ocupado y OFRECIÓ alternativas sin intentar la propuesta — y atribuyó mal el ocupante ("test123") | Conflicto de reglas del prompt: "el horario sale de get_availability" vs la capacidad GAP-2 (el server descuenta la cita que se mueve). El modelo obedeció la regla estricta y nunca llamó al tool; el fallback plan-aware NUNCA corrió | Excepción explícita en la regla del prompt: si el hueco lo ocupa la MISMA cita (o una que este plan cancela), proponer directo — el server valida. Al insistir el doctor, el tool corrió y el fallback funcionó perfecto ("solo se traslapa con la cita actual… se libera al moverla") | *(este commit)* |
| 21 | (2026-07-06) Ejecución del reagendado de test234 → **RSC-3 REAL**: original CANCELADA, create falló con 500 | "Error al crear la reserva" (500 genérico) al crear la nueva | `patientEmail`/`patientPhone` son columnas NO NULAS (schema 567-568); la UI siempre manda al menos `""`. El payload del agente solo incluía contactos truthy → test234 (sin contacto) produjo un create SIN esos campos → Prisma lanzó. El pre-check de requisitos pasó correcto (settings en false) — el bug era shape del payload, no validación | Payloads de create/reschedule siempre mandan `patientEmail`/`patientPhone` como string (`?? ''`). **Lo positivo:** el manejo RSC-3 funcionó EXACTO al diseño — mensaje explícito "la original quedó CANCELADA… hay que reagendar YA" + re-plan inmediato del agente pidiendo el contacto. test234 era dato de prueba | *(este commit)* |
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
- **Pendiente menor:** RNG-2/7/8/9 (camino individual, auditado en código, no observado en vivo).
- **✅ Campaña CIT (2026-07-05, sin buffer):** CIT-1/2/4/7/12/13 validados en vivo (4 y 7 con
  POSTs directos al endpoint público → 409/400, cero filas creadas — la capa que usará el agente
  en PR 3); CIT-12 cerró el loop con el agente ("te desocupas a las 11:45" ✓ contra BD). CIT-5
  skipped (decisión buffer). **Hallazgo CIT-6:** el override fuera-de-horario ya NO es alcanzable
  desde la UI (el picker solo ofrece availability) — existe solo a nivel endpoint → decisión
  explícita en PR 3 sobre si el agente lo usa. Detalle por caso en el Bloque C de `04`.
- **Backlog UI** (no bloquea): botón "Crear N rangos" habilitado con conflictos y sin feedback al
  fallar. ✅ El "undo" de bloqueo que no borró — RESUELTO 2026-07-05: el modal "Gestionar
  Bloqueos" era ciego a otros meses (lista month-scoped); fix `4ddab2ff`. Hallazgo del método
  INVERSO: el agente (correcto contra BD) contradijo a la UI — el agente cazó un bug de la UI.
- **Ideas de feature (backlog):** (a) crear cita desde el expediente del paciente, pre-vinculada
  (`patientId`) — hoy no existe ese flujo; la vinculación es post-hoc vía "Buscar paciente" en el
  card (validado que SÍ escribe `patient_id`). PR 3 da la versión conversacional gratis. (b) UI
  de settings para el buffer — solo si algún día se decide activarlo.
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

## ✅ Evals G11 + refactor run-turn (2026-07-05, `cb759082` + fix `d8bca1cd`)

- El loop del agente vive ahora en **`apps/doctor/src/lib/agenda-agent/run-turn.ts`** — la ruta
  (`app/api/agenda-agent/route.ts`) quedó como wrapper delgado (auth, validación, presupuesto,
  logging). La ruta y los evals corren EL MISMO código; extracción verificada por review (copia
  fiel, byte a byte) + 15 turnos en vivo.
- **`apps/doctor/scripts/agenda-agent-evals.ts`**: 12 golden cases (bitácora + invariantes),
  **12/12 PASS**. Corre el working tree contra prod read-only ANTES de cada push que toque
  prompt/tools — instrucciones en la cabecera del script; `EVALS_ONLY=id1,id2` para re-runs
  baratos (~10–20k tokens por caso). Casos data-dependent son `soft` (WARN, no bloquean deploy).
- ⚠️ **Incidente de deploy (resuelto):** declarar `tsx` en devDeps de apps/doctor SIN regenerar
  `pnpm-lock.yaml` tumbó el build (`cb759082` FAILED — frozen lockfile; sin outage, el deploy
  anterior siguió sirviendo). Fix: revert (`d8bca1cd`, SUCCESS) — tsx resuelve desde el ROOT del
  workspace. **Regla: ningún cambio de dependencia sin regenerar el lockfile en el mismo commit.**

## Próximos pasos

1. **PR 3 — DESPLEGADO Y VALIDADO EN VIVO ✅ (2026-07-06/07).** Diseño D1–D6 + GAP-1..5 en
   [`06-PR3-DISENO-citas.md`](06-PR3-DISENO-citas.md); evals 18/19 + smoke 5/5; validación en
   vivo completa en bitácora fila 22 (TRX-6/ledger ✓, create+expediente ✓, reschedule GAP-2 ✓
   tras hotfix filas 20-21, probe negativa ✓, 16 vencidas → NO_SHOW en 2 tandas ✓). Los datos
   de prueba de citas quedaron limpios (queda 1 PENDING vencida a propósito, espécimen del edge
   case GAP-4). Pendientes menores de PR 3: sembrar evals de las filas 20-21 (self-move,
   payload sin contacto) si se toca ese código de nuevo.
2. **Limpieza de datos de prueba** (cuando estorben): citas de prueba (`test 7`, `vvvvvv`,
   `cita1/2`, CIT1/CIT2/CIT13/cti13/cita13) — la primera misión real de PR 3 (cerrar vencidas
   como NO ASISTIÓ, nunca COMPLETADA: crearía ingresos falsos en Flujo de Dinero).
3. ✅ **Prompt caching — IMPLEMENTADO Y REVISADO (2026-07-07).** Prompt partido en bloque
   estable (con breakpoint, cubre tools) + contexto temporal al final; breakpoints móviles en
   los últimos DOS mensajes (el doble marcador vino del code-review: una iteración con 10
   propuestas excedería el lookback de 20 bloques) aplicados en un choke point único
   (`callModel()`). **Suite completa 18/19 (idéntica al baseline pre-caching) con 96–98% del
   input cacheado** → costo de input ~15% del original. Detalle en `05` §8. (Contexto: la
   validación de PR 3 había agotado el cap de 500k en 17 turnos ≈ $1.60; el cap volvió a 500k
   el 2026-07-07 y el panel ganó una barra "Uso de hoy" — GET del budget + campo `budget` en
   cada respuesta.) **Follow-up 2026-07-08: cap ponderado por costo.** El caching rompió la
   equivalencia volumen≈costo con la que se dimensionó el cap: una sesión real de 3 turnos
   marcó 16.2% de la barra costando ~5% en dólares (94–98% del input era cache read a ~0.1×).
   Ahora `budgetTokens` (run-turn) pondera por precio (uncached ×1 · read ×0.1 · write ×1.25 ·
   output ×5) y se guarda en la columna NUEVA `budget_tokens` que el cap agrega — `total_tokens`
   sigue crudo (el mini-review cazó que 3 endpoints de analytics lo agregan cross-endpoint y
   sobrecargarlo mezclaba unidades). El cap de 500k recupera su significado de ~$1.50/día.
   Detalle completo en `05` §8 (bullet ⚖️).
4. **PR 4** — voz + retirar el chat v1 + evaluar limpieza de `/v1` y `/v2`.
5. ✅ **Hardening diferido de los code-reviews — LOS 4 HECHOS (2026-07-07).** Detalle en
   `06-PR3-DISENO` §5: (a) **FK compuesta** `bookings(patient_id, doctor_id) →
   patients(id, doctor_id)` con `ON DELETE SET NULL (patient_id)` (PG 15+) — **APLICADA EN PROD**
   (pre-flight: 0 violaciones en 42 bookings vinculados; probada en local: cross-doctor rechaza
   P2003, delete de paciente solo nulea patient_id). ⚠️ Prisma NO puede expresarla → **`prisma
   db push` la REVIERTE en silencio**; documentado en la migración
   (`add-booking-patient-composite-fk.sql`) y en `database-architecture.md` §6 (re-aplicar tras
   todo db push). (b) **P2003→409** en los 5 write paths vía helper único
   `patientLinkGoneResponse()` en `patient-link.ts` — solo culpa al paciente si
   `meta.field_name` referencia el FK del paciente (un P2003 de service/slot/doctor NO se
   atribuye mal). (c) **form-links** migrado a `validatePatientLink` (cambio: wrong-doctor ahora
   403, antes 404). (d) **`excludeBookingIds`** en `range-availability` (>50 ids = 400, nunca
   truncado silencioso) — `checkSlot` hace 2ª llamada al MISMO motor con exclusiones; la tercera
   copia de la fórmula de ventana ocupada (~60 líneas) ELIMINADA. Verificación: code-review de
   8 ángulos (8 hallazgos, 3 aplicados) + evals 18/19 (= baseline; el 1 FAIL es regex de
   redacción, no conducta — regex corregido 2026-07-08: `no les pasa (absolutamente )?nada`
   en `invariante-rango-no-toca-citas`; el baseline vuelve a ser 19/19 esperado).
   **VALIDADO EN PROD post-deploy (2026-07-08, 5/5):** (1) probe
   read-only de `excludeBookingIds` (slot ocupado aparece solo al excluir; 51 ids → 400);
   (2) self-move EN VIVO por el doctor ("mueve test234 30 min antes" — la card salió con la
   nota de dependencia vía el motor canónico, BD verificada: original CANCELLED + nueva
   CONFIRMED a 565ms); (3) probe de FK con transacción-rollback: link cross-doctor RECHAZADO
   por `bookings_patient_id_doctor_id_fkey`, mismo-doctor pasa, nada escrito; (4) P2003→409
   estructural (carrera no reproducible a demanda); (5) form-links camino feliz en UI ✓.
   **Follow-ups que dejó el review (backlog, ninguno urgente):**
   (i) `excludeBookingIds` vive en endpoint público — oráculo de existencia de bookings,
   mitigado por cuids inadivinables; decidir si se gatea; (ii) bug PRE-EXISTENTE del motor:
   booking legacy con `endTime="00:00"` produce ventana invertida que `subtractBlocked` ignora —
   fix de 1 línea en `availability-calculator.ts` (`Math.max(startMin, endMin, extendedEnd)`),
   tocarlo = smoke-test (afecta widget público); (iii) `appointment_form_links` tiene el mismo
   par patient_id+doctor_id SIN FK compuesta (misma migración, otra tabla); (iv) form-links hace
   2 queries secuenciales al mismo paciente (helper + refetch de nombre/email) — menor.
6. ✅ **Auditoría de tenancy PR 2 (2026-07-08).** Code-read de TODOS los endpoints que toca el
   executor de PR 2 (ranges CRUD, bulk, block/unblock, PATCH de bookings en sus 4 ramas, DELETE,
   send-email): **todos verifican pertenencia contra la sesión** (403 en mismatch; unblock
   rechaza el lote completo si UN id es ajeno; self-cancel sin auth exige confirmationCode).
   Nota estructural: rangos/bloqueos llevan doctor_id en la propia fila — no existe el riesgo
   clase-patientId (link cross-tabla); la muralla es el WHERE por endpoint, y está en todos.
   **1 hallazgo (corregido):** el POST /bookings LEGACY (modelo slots) capturaba solo el role,
   sin doctorId — un token de doctor sobre el slot de OTRO doctor obtenía autoConfirm
   (CONFIRMED + salta el cutoff de 1h) en agenda ajena. El Fase 0 solo blindó range-bookings.
   Guard idéntico al del sibling agregado; público (sin token) sigue PENDING-para-cualquiera.
   Contexto: modelo slots dormido (última cita por slot 2026-04-23, 0 slots futuros) pero es el
   fallback DISEÑADO (`doctor.hasRanges ? RangeWidget : SlotWidget` en el perfil público +
   "existing slot mode" del BookPatientModal) — retirarlo completo va con la limpieza /v1 /v2
   de PR 4, no por pedazos.

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
- `94a3fe7d` fix: modelo rango↔cita + sección de invariantes en el prompt (bitácora 19 — los docs
  alucinaban un sync GCal de rangos que no existe; corregido en prompt y docs)
- `4ddab2ff` fix(appointments): modal "Gestionar Bloqueos" ciego a otros meses — explica el
  "undo fantasma" de BLK-6; encontrado comparando el agente vs la UI
- `c66c5bb7` docs: campaña CIT (6 validados, buffer skipped, CIT-6 solo-endpoint)
- `cb759082` **feat: evals G11** (12 golden cases) + loop extraído a `run-turn.ts` — ⚠️ build
  FAILED por `tsx` en devDeps sin regenerar el lockfile
- `d8bca1cd` fix: revert del tsx (frozen lockfile) — deploy SUCCESS; regla: dependencia nueva =
  lockfile regenerado en el mismo commit
- `b2b8d482` fix(api): GAP-1 — `validatePatientLink` en las 4 rutas de creación + PATCH (validado
  en vivo con 3 probes + camino feliz UI)
- `d6630def` **feat: PR 3** — 6 tools propose_* de citas + executor + prompt + panel + 7 evals
  (code-review: 7 fixes aplicados; evals 18/19 + smoke 5/5)
- `27f68607` **feat: hardening post-PR3** — los 4 diferidos (FK compuesta EN PROD, P2003→409,
  form-links al helper, excludeBookingIds) — validado en prod 5/5
- `b2242ca7` feat: cap diario ponderado por costo (columna `budget_tokens`; el caching rompió
  volumen≈costo — sesión real: 16.2% de barra a ~5% de costo)
- `52e8b7b6` docs(db): patrón de queries read-only a prod vía script tsx temporal
- `0c2da6ea` fix: guard cross-tenant en POST /bookings legacy (auditoría tenancy PR 2 — un
  hallazgo, el resto de endpoints ya verificaban pertenencia)

---

*Mantener este archivo actualizado al final de cada sesión.* Índice: [`README.md`](README.md).
