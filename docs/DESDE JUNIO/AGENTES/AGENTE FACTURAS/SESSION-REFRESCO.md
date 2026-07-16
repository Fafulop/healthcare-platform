# 🔄 Refresco de sesión — AGENTE FACTURAS / ASISTENTE — LÉEME PRIMERO

> Snapshot del estado, decisiones y próximos pasos de la **expansión del asistente** (facturas +
> expediente + pagos + SAT, sobre el agente de agenda). Para una sesión/LLM en frío: lee este
> archivo, luego `00` → `02` → `03` → `04` según necesites profundidad.
> Última actualización: **2026-07-16 (noche)** — F2a cerrado en vivo (`07-PLAN` §12), **F2b
> SHIPPED `d05e3d71`** y **code review inline hecho: 4 hallazgos, 4 corregidos** (`08-PLAN`
> §11 — el gordo: guard 409 de doble emisión EN EL ENDPOINT; fixes UNCOMMITTED al escribir
> esto; suite 60 en verde). Siguiente: commit/push de los fixes → timbrar en vivo el caso
> Gerardo A (sandbox, como PÚBLICO EN GENERAL).
> El mapa de arriba de todos los agentes vive en
> [`../GENERAL AGENTES/00-BLUEPRINT-asistente-modular.md`](../GENERAL%20AGENTES/00-BLUEPRINT-asistente-modular.md).

---

## En una frase

El agente de agenda se expande a **UN asistente con módulos por dominio** (decisión de `00`,
RE-CONFIRMADA 2026-07-15 en `05-ANALISIS` frente a la alternativa de un agente especializado).
Sustrato cerrado, F1+F1.5 validados en vivo, **F2a SHIPPED + VALIDADO EN VIVO 2026-07-16**
(5/5 PASS — `07-PLAN` §12), y **F2b (emisión: propose_create_cfdi + builder server-side +
card 🧾 tier-máximo + Público en General vía RFC genérico del expediente) CONSTRUIDO el mismo
día con suite 59 en verde** (`08-PLAN` §10). **Siguiente: commit/push de F2b → validación en
vivo timbrando en SANDBOX (caso Gerardo A $900, sin prerequisito de datos).**

## Mapa de documentos

| Doc | Qué es |
|---|---|
| `00-FACTIBILIDAD-Y-ARQUITECTURA.md` | Veredicto (un asistente, módulos, no A2A), sustrato Facturama, tools propuestos, tiers/riesgos, secuencia F1→F3 |
| `01-CONTEXTO-SAT-DESCARGA.md` | La fuente DUAL de CFDIs (Facturama vs SAT descarga) y sus gotchas (UUID case, frescura, cancelaciones) |
| `02-FLUJO-SISTEMA-cita-paciente-factura-pago.md` | El grafo real (LedgerEntry = hub) + **la matriz de 6 preguntas = el spec de `get_billing_status`** |
| `03-PERMUTACIONES-paciente-dinero-factura.md` | Catálogo E×M×F×O + huecos H1–H10 con su estado — **cada permutación es un eval candidato de PR F1** |
| `04-FIXES-links-de-pago-ligados.md` | Registro completo de los fixes de sustrato (2 tandas, con commits y lecciones) |
| `05-ANALISIS-arquitectura-especializado-vs-modulo.md` | Re-examen 2026-07-15 (agente especializado vs módulo) → **decidido: UN asistente, módulo enriquecido**; secuencia F2a (lectura experta) → F2b (emisión) |
| `06-KNOWLEDGE-BASE-facturacion.md` | LA base de conocimiento de facturación: emisión paso a paso, fórmula de impuestos, reglas SAT, catálogos, grafo — verificada contra código 2026-07-15 |
| `07-PLAN-F2a-experto-lectura.md` | Plan del PR F2a: `search_catalogo_sat` + `get_pendientes_factura` + conocimiento (prompt/get_guia) + 7 evals — CONSTRUIDO (§10), REVIEW (§11), VALIDADO EN VIVO 5/5 (§12) |
| `08-PLAN-F2b-emision.md` | Plan + bitácora del PR F2b: `propose_create_cfdi` (pre-checks, card 🧾, PG, mapa forma de pago) + `cfdi-builder.ts` + decisiones del usuario (dos turnos, PG revertido) — CONSTRUIDO (§10) + REVIEW inline 4/4 fixes (§11), suite 60 en verde |

Playbook heredado: [`../AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTE%20AGENDA/SESSION-REFRESCO.md)
(método, bitácora, evals) y `05-REFERENCIA-TECNICA` (el sistema, incl. la estructura de módulos).

## Estado: qué está hecho (todo desplegado en prod)

**✅ Sustrato — sesión 2026-07-10/11, commits `7e7d031d`→`cf42c67b`:**
- **H10**: links de pago LIGADOS a citas (botón "Cobro" en /appointments y expediente; MP acepta
  bookingId; guard compartido `apps/api/src/lib/payment-link-guard.ts`). ⚠️ Lección clave:
  **`isActive` ≠ no-pagado** (el webhook MP pone isActive:false al PAGAR; Stripe lo deja true) —
  la definición de "cobrada" es `status`, cross-provider.
- Link de pago **requiere expediente vinculado** (server + UI "Requiere expediente").
- **H1**: webhooks denormalizan patientId/RFC al ledger. **H2**: completar una cita ya pagada
  por link = éxito sin duplicar (endpoint 409 `BOOKING_LEDGER_EXISTS` + UI + agente; formaDePago
  solo se exige si el ingreso no existe). **H7**: (re)vincular paciente = REESCRITURA de
  identidad en el entry (nunca merge). **H8**: cancelar CFDI resetea hasFactura salvo otra señal.
- Celda Paciente sin estado muerto (citas del agente con isFirstTime null → siempre ambas
  opciones buscar/crear). Tabla de citas compactada (2 columnas de acciones).

**✅ Refactor de módulos — commit `2fdbedd6`:**
`apps/doctor/src/lib/agenda-agent/modules/` (types/registry/agenda) + `prompt.ts`. run-turn.ts
= solo el loop. Byte-idéntico (sha256) + evals 19/19. **El prompt se edita en `prompt.ts`
(compartido) o `modules/agenda.ts` (agenda) — NUNCA en run-turn.ts.**

## Decisiones (no re-litigar)

- **UN asistente, módulos por dominio, NO A2A** (`00` §1).
- La cadena expediente↔factura es **transitiva vía LedgerEntry** (opción A, sin migración) —
  el agente SIEMPRE liga `ledgerEntryId` al emitir.
- **El modelo NUNCA arma impuestos** (regla clase-E7): builder server-side pendiente; hoy la
  fórmula vive en `useBookings.emitCfdi`.
- **v1 SIN `propose_cancel_cfdi`** (timbrado = documento legal); PPD solo a petición explícita;
  doble emisión bloqueada por `hasFactura`.
- *Facturada* es señal COMPUESTA: `hasFactura ∧ (cfdi activo ∨ satCfdiUuid vigente)` (por H8 y
  el limbo de `cancellation_pending` que nadie finaliza aún).
- "¿Cuánto facturé?" usa la fuente DUAL (`01`): sat_cfdi_metadata (todo el RFC) cuando existe,
  no solo cfdis_emitted; el tool declara fuente y frescura.
- El expediente es vista PARCIAL para dinero/facturas — los tools leen el GRAFO, no replican la
  query de la página (`03` §6).

## ✅ Validación en vivo (dr-prueba) — HECHA 2026-07-11 (secuencia test-7 + panel PR F1)

**Secuencia test-7 completada y verificada read-only contra prod:**
1. ✅ Link MP ligado a la cita "test 7" pagado ($10) → `status→PAID`, `isActive→false`, ledger
   `webhook_pago` con `bookingId`. (El entry nació SIN `patientId` porque el expediente se
   vinculó 14 min ANTES del deploy de H7 — artefacto de timing, no bug.)
2. ✅ Completar la cita → camino H2 EN VIVO: un solo ingreso, sin duplicar, sin 409 engañoso.
3. ✅ H7 EN VIVO: re-vincular el expediente a la cita → backfill reescribió el entry 1577
   (`patient_id` del expediente, `counterparty_rfc` null correcto — el expediente no tiene RFC,
   `counterparty_name` fallback al nombre de la cita).
4. ⬜ No probado aún: 2º link sobre la cita pagada ("ya fue pagada") — pendiente menor.
5. Checkboxes de `03` marcados (PERM-A4 variante E3, C3, ORD-1).

**Nota de diseño confirmada en esta validación:** `final_price` (precio de la cita) es
informativo — NUNCA genera movimiento; el ledger solo registra dinero real (monto del link o lo
que el doctor teclea al completar). Un pago PARCIAL por link deja el ingreso en ese monto y
completar no agrega el resto (sin reconciliación contra precio) — trade-off conocido, radar del
money model.

## Próximos pasos

1. **PR F1 — HECHO Y DESPLEGADO (2026-07-11).** (Nota posterior: la suite creció a **26 casos**
   con 2 evals cross-dominio — commit `290094c3` — y el primero de ellos encontró un bug latente:
   `mp_payment_preferences.status` era TEXT en prod vs enum del schema → el filtro por status de
   `get_payment_links` tronaba; migración aplicada a prod, el filtro ya funciona.)
   Suite del PR F1: 24 casos — 22 PASS + 2 WARN soft
   (data-dependent: datos de prueba que ESTA sesión cambió — vvvvvv limpiado, availability de
   agosto). El FAIL de `ambigua-pregunta-concreta` era el EVAL podrido, no el modelo: el mensaje
   "¿el miércoles?" perdió su ambigüedad con el calendario (un solo miércoles razonable →
   resolverlo directo es correcto); reemplazado por un referente ausente ("muévela media hora
   más tarde") que es ambiguo para siempre → PASS. Siguiente: PR F2.
   **✅ VALIDACIÓN EN VIVO HECHA (2026-07-11, panel en prod con dr-prueba): 10/10 correctas
   contra la BD** — los 6 tools ejercitados (fiscal profile, billing status test-7 con el flag
   del precio $1M vs $10 cobrado, total SAT $4,016,023.44/300 vigentes con frescura y "Sync mes
   actual", 6 CFDIs plataforma con cruce de fuentes, 15 links con huérfanos señalados,
   expedientes DUPLICADOS de Gerardo detectados con counts exactos 3/0 y 5/1, búsqueda por
   nombre vs expediente bien distinguida, negativos: rechazó contenido clínico y emitir CFDI).
   Side-validations: fix de timezone MX confirmado (las fechas del agente eran las correctas,
   el SQL crudo de verificación estaba corrido un día), H2 y H7 validados en vivo (ver sección
   de validación). Único defecto: cosmético — un conteo en prosa mal ("4 links"/corrijo:
   5, suma $47 vs $58 real) en la respuesta de links; datos correctos. Vigilar, no actuar.
   Módulo `modules/facturas.ts` (registrado en `AGENT_MODULES`) con los 6 tools de lectura:
   `get_billing_status` (la estrella — matriz de 6 preguntas de `02` §3; modo cita o paciente,
   10 citas máx, TODO batcheado), `get_patient_profile` (completitud fiscal server-side +
   `listoParaFacturar` = el gate exacto del botón del expediente), `get_fiscal_profile_status`,
   `get_cfdis` (plataforma), `get_sat_cfdis` (fuente dual + frescura por dirección; "received"
   = GASTOS del doctor), `get_payment_links` (counts reales + mostrados). Prompt: 2 secciones
   nuevas + INTRO capacidad 4 + "fuera de tu alcance" distingue CONSULTAR (en alcance) de
   EMITIR/crear (F2). 5 evals nuevos (billing-un-golpe, fuente-SAT, completitud-server,
   no-emite, sin-clínica).
   **Code-review (4 ángulos, ~19 candidatos) → 11 fixes aplicados en re-write**, los gordos:
   satCfdiUuid CANCELADO en metadata ya no cuenta como facturada; días calendario en
   America/Mexico_City (`mxDayOf` + fronteras de rango a UTC-6) — no el día UTC; modo paciente
   batcheado (3 queries, no ~60) y capado a 10 (límite de 8KB del tool result); counts reales
   en links; guards de formato en fechas del modelo; frescura SAT scoped a metadata+dirección;
   tenancy defense-in-depth en el verdict (fiscalProfile.doctorId).
   Verificado: type-check ✓, shapes smoke-tested contra prod ✓ (2 rondas), evals ✓ (ver
   arriba — los 5 nuevos PASS en ambas corridas, con el modelo eligiendo bien get_sat_cfdis
   vs get_cfdis y rechazando contenido clínico sin llamar tools).
2. **PR F1.5 — HECHO (2026-07-11, misma sesión): cobertura de lectura COMPLETA de
   /facturacion, /sat-descarga y /pagos** (análisis pestaña por pestaña: facturación ya estaba
   completa; sat-descarga tenía 3 pestañas analíticas sin cubrir; pagos le faltaba el estado
   de pasarelas):
   - **Módulo `fiscal` nuevo** (`modules/fiscal.ts`, 2 tools compuestos): `get_resumen_fiscal`
     (agregados mensuales en base de EFECTIVO — réplica columna-por-columna de las 3 queries
     del endpoint declaration; PUE por emisión, PPD por fecha de pago prorrateado, PPD sin
     complemento excluido y reportado; acuses mensuales + ANUAL mes-13; **frontera clase-E7:
     jamás calcula ISR ni clasifica deducibilidad — dirige a las pestañas**) y
     `get_ppd_cobranza` (réplica de `computePpdStatus`: el saldoInsoluto de la ÚLTIMA
     parcialidad decide, no la resta total−pagado; complementos sin ligar checados contra
     satPago global, no contra el año — el caso cross-year).
   - **facturas +2**: `get_payment_provider_status` (flags cacheados Stripe/MP con caveat) y
     `get_guia` (resúmenes CURADOS de las 3 pestañas Guía, ~700 tokens SOLO al preguntar —
     baked-in habría triplicado el prefijo; comentarios anti-drift en los 3 componentes guía).
   - Prompt: INTRO capacidad 5; RESILIENCE nombra ISR/consejo fiscal como fuera de alcance;
     **regla de DESEMPATE** get_sat_cfdis (¿cuánto FACTURÉ? con IVA por emisión) vs
     get_resumen_fiscal (¿cuánto INGRESÉ? base efectivo) — miden cosas distintas y el agente
     lo dice. Panel: copy des-stalizado ("Asistente", capacidades ampliadas, +2 chips).
   - **Code-review (2 finders profundos) → 8 hallazgos, 8 corregidos** — los gordos: linkage
     de complementos contra el año (prod: 15/15 ligados; la lógica pre-review habría reportado
     ~12 "sin ligar"), semántica saldoInsoluto, doble-steer facturé/ingresé, 2 errores de
     contenido en las guías curadas (G03 mal atribuido, umbral $2,000 efectivo).
   - Evals: +6 casos (routing canónico ×3, ISR-no-calcula, no-consejo-fiscal, guía) →
     **suite de 32: 30 PASS + 2 WARN soft + 0 FAIL**. Shapes smoke-tested contra prod ×2.
     Agente: 24 → **29 tools, 3 módulos**; prefijo +~2.1k tokens (dentro del presupuesto del
     blueprint). **✅ VALIDADO EN VIVO en prod (2026-07-11, panel con dr-prueba, 4/4):**
     (1) "¿cuánto ingresé en enero?" → $229,870.17 EXACTO + IVA $444.83 ✓; deducciones
     $66,695.39 (MÁS completo que el smoke-test preliminar: incluye PPD por fecha de pago —
     el tool superó a la verificación); aclaró facturado-vs-ingresado sin pedirlo (la regla
     de desempate del review funcionando) y reportó "enero sin declaración registrada" ✓.
     (2) "¿quién me debe PPD?" → 18 facturas / 3 pagadas / 15 pendientes / $226,815.00
     EXACTO, top-10 por saldo + "faltan 5", contrapartes correctas, 0 falsos "sin ligar" ✓.
     (3) "¿cuánto ISR pago?" → dio los HECHOS de julio (incl. deducciones NEGATIVAS −$32,172
     por nota de crédito recibida — el sign-flip de paridad funcionando, y lo flaggeó honesto)
     y DECLINÓ estimar ISR dirigiendo a Declaraciones — frontera E7 sostenida ✓.
     (4) "¿cómo funciona la descarga del SAT?" → get_guia fiel al resumen curado (incluido el
     umbral $2,000 CORREGIDO por el review) + pointer a la pestaña ✓.
3. **F2 RE-PENSADO (2026-07-15, sesión con el usuario):** objetivo = asistente EXPERTO en
   facturas (recomendar claves de catálogo SAT para conceptos mixtos consulta/insumos/quirófano,
   detectar pacientes con factura pendiente, emitir con aprobación, conocimiento legal). Se
   re-abrió la arquitectura (¿agente especializado con botón propio?) → **RE-DECIDIDO: UN
   asistente, módulo facturas enriquecido** (`05-ANALISIS`, aprobado por el usuario). Hallazgos
   clave: el catálogo SAT YA tiene API con auth (`catalogos/[tipo]` + `searchProductCodes`) →
   recomendaciones grounded; la fórmula de impuestos vive en el FORM de /facturacion (NO en
   useBookings.emitCfdi — la nota vieja era stale); Facturama apunta a SANDBOX en prod
   (intencional, confirmado). Secuencia aprobada:
   - **PR F2a — experto solo-lectura: ✅ CONSTRUIDO 2026-07-15** (`07-PLAN` §10):
     `search_catalogo_sat` (token de API minteado por turno — `api-token.ts`) +
     `get_pendientes_factura` (paridad EXACTA verificada vs prod) + conocimiento
     (domainRules + GUIAS.claves_y_reglas_cfdi). **Bug de sustrato cazado por el smoke:**
     los catálogos de Facturama estaban ROTOS en prod (`/api-lite/catalogs/*` → 200 vacío;
     fix a `/catalogs/*` + `FiscalRegimens` en apps/api — la UI lo enmascaraba con su
     fallback). Evals f2a 7/7 aislados; suite completa como gate del push. El fix del API
     debe DESPLEGARSE para que el catálogo devuelva resultados reales.
     **Review tier COMPLETO hecho 2026-07-16** (regla del §7.4: lógica replicada + contenido
     que afirma hechos): 8 ángulos + verificación → 9 hallazgos, **7 corregidos en
     `d93a3fc3`** — los gordos: la rama sin-credenciales no marcaba `_offline` (el fallback
     hardcodeado se etiquetaba como "catálogo oficial SAT"), y el route no validaba
     `Array.isArray` en éxito (el mecanismo exacto que enmascaró el outage de `/api-lite`
     seguía vivo). Cleanups: UN minter de JWT con claims slim (validado EN VIVO vs prod),
     cache 12h de catálogos estáticos, `dateWhere` compartido, `API_URL` único. Aceptados
     sin fix: guard de IVA (vigilar) y token único de 1h del eval runner. Detalle completo:
     `07-PLAN` §11.
     **✅ PUSHEADO + DESPLEGADO + VALIDADO EN VIVO 2026-07-16** (stack de 6 commits
     `b6ec78dd`→`66513d32` en origin/main, incl. el docs-commit del review). Panel en prod con
     dr-prueba, **5/5 PASS** (detalle: `07-PLAN` §12): las 3 preguntas del §1 — catálogo VIVO
     ("quirúrgico" 271 resultados = el fix de `/catalogs` desplegado y sin fallback offline;
     rehusó inventar clave genérica de insumos; claves de consulta desde los defaults del
     prompt), pendientes 3 pacientes/$2,110 **EXACTO contra la BD de prod** (réplica read-only
     del groupBy), D01 vs G03 correcto (RESICO-626 + regla efectivo >$2,000) — y los 2 probes
     de frontera: la pregunta IVA-exento respondida desde la KB (Art. 15-XIV LIVA, tratamiento
     por concepto) con deferral al contador, y "¿qué me conviene para pagar menos impuestos?"
     RECHAZADO limpio con redirect a tools/pestañas (**el watch-item del guard de IVA se
     sostiene — cerrado**); "emítele la factura" rechazado + redirect a la UI. F2a CERRADO.
   - **PR F2b — emisión: ✅ CONSTRUIDO 2026-07-16 (mismo día del cierre de F2a; plan y
     bitácora en `08-PLAN`, UNCOMMITTED al escribir esto):** `propose_create_cfdi` (primer
     proposal del módulo facturas; pre-checks: CSD activo, ingreso cita/webhook_pago sin
     hasFactura, receptor SOLO expediente completo, **guard PG** — el RFC genérico
     XAXX010101000 rechaza con camino correcto, hallado en la 1ª corrida vs datos reales) +
     `cfdi-builder.ts` (réplica exacta del form, paridad 5/5) + card 🧾 tier-máximo (rojo,
     paralelo del 📱) + executor branch + prompt (capacidad 8, RESILIENCE re-escrito, 6 reglas
     duras). Decisiones del usuario: DOS TURNOS para cita sin completar; manuales FUERA;
     **PG REVERTIDO el mismo día — expediente con RFC genérico emite a PÚBLICO EN GENERAL
     (receta de la UI: S01/616) con advertencia en card**; el guard original se volvió
     normalización. Suite 59: TODO EN VERDE (56 PASS en corrida completa + 3 cerrados en
     re-corrida: catálogo-honesto tras recargar CRÉDITOS de Anthropic — ⚠️ la key también
     sirve a PROD —, y `f2b-emision-pg-feliz` PASS con propuesta registrada; 1 soft-WARN por
     el flake de datos test123 documentado). **SHIPPED `d05e3d71` + code review inline el
     mismo día: 4 hallazgos, 4 corregidos (`08-PLAN` §11)** — guard 409 de doble emisión EN
     EL ENDPOINT (cerraba la carrera preview→submit de la UI también), PG salta el gate de
     completitud (solo exige el RFC genérico; CP del emisor), dedup (SAT labels + CAP_ERROR
     exportado), eval nuevo de dos-turnos (CIT2) — suite 60, afectados 5/5 PASS. ⚠️ Método:
     el review multi-agente mata el límite de sesión en sesiones largas — correr INLINE o en
     sesión fresca. Validación en vivo: DESBLOQUEADA — timbrar el caso Gerardo A tal cual en
     sandbox como PÚBLICO EN GENERAL (`08-PLAN` §10). Después:
     `propose_send_fiscal_form`, `propose_payment_link`, `propose_create_patient` (H3).
4. **PR F3** — entrega (`propose_email_cfdi`).
5. **Higiene 2026-07-15 (commit `b6ec78dd`):** AyudaTab de /sat-descarga corregida (pestaña
   fantasma "Resumen", "Cobranza"→"PPD / Pagos" con features reales — los buckets de
   antigüedad NO existen —, FAQ del sync viejo, + comentario anti-drift). GuiaTab verificada
   CORRECTA contra UNIFIED-FISCAL-REFERENCE (retenciones, PUE/PPD, uso CFDI, tablas ISR).
   Post-review (`d93a3fc3`): el empty state de Declaraciones ya no menciona el tipo
   "Completa" (control eliminado) — apunta al botón real "Iniciar descarga".

## Preguntas abiertas

1. **Profundidad clínica**: DECIDIDO en PR F1 (v1 = solo metadatos + demográficos/fiscales,
   nada de contenido clínico — implementado así en el módulo y el prompt; eval
   f1-sin-contenido-clinico lo cubre).
2. ✅ **dr-prueba SÍ puede timbrar** (verificado en prod 2026-07-11: csdUploaded=true,
   facturamaStatus='active', FIEL configurada) — la validación en vivo de PR F2 está
   desbloqueada.
3. ¿El panel del asistente se monta también en `/dashboard/facturacion`? (mismo componente).
4. Confirmar qué taxes arma la UI para honorarios médicos (fuente del builder server-side).

## Método de trabajo (heredado de agenda — no negociable)

- Sustrato antes que agente; pre-checks leyendo el ENDPOINT real, no asumiendo semántica.
- Todo SQL/query shape nuevo → smoke read-only contra prod ANTES de push (no hay staging).
- Prompt/tools tocados → correr la suite de evals ANTES de push
  (`railway run --service pgvector -- npx tsx scripts/agenda-agent-evals.ts`, instrucciones en
  su cabecera).
- Nunca commit/push sin explicar y recibir OK; una aprobación = un commit.
- Verificación en vivo: usuario actúa en prod → LLM verifica read-only
  (TOOLING de agenda; queries de este dominio en `02`/`03`).

---

*Mantener este archivo actualizado al final de cada sesión (patrón SESSION-REFRESCO de agenda).*
