# 🛠️ Plan — PR F2a: el experto en facturas (SOLO lectura + conocimiento)

> **Qué es este doc.** El plan concreto del primer PR de la secuencia F2 aprobada
> (`05-ANALISIS` §5, decisión 2026-07-15): convertir al asistente en EXPERTO de facturación
> **sin darle todavía la emisión** — recomendaciones de claves SAT grounded, barrido de
> pacientes con factura pendiente, y el conocimiento de reglas CFDI. La emisión
> (`propose_create_cfdi`) es F2b y se construye sobre esto ya validado en vivo.
> Diseñado 2026-07-15 contra el código real (anclas citadas). Fuente de conocimiento:
> [`06-KNOWLEDGE-BASE-facturacion.md`](06-KNOWLEDGE-BASE-facturacion.md).
>
> **ESTADO 2026-07-15: CONSTRUIDO** — ver §10 (cómo quedó + los 2 hallazgos del smoke:
> el reenvío de auth FUNCIONA vía token minteado, y los catálogos de Facturama estaban
> ROTOS en prod por el path `/api-lite/catalogs/*` → corregido a `/catalogs/*`).

---

## 1. Objetivo: 3 preguntas nuevas que el asistente responde bien

1. **"¿Qué clave SAT uso para X?"** (insumos, quirófano, consulta, medicamentos…) —
   recomendación entre resultados OFICIALES del catálogo, nunca claves inventadas.
2. **"¿A qué pacientes les falta factura?"** — barrido de ingresos sin factura × pacientes que
   la piden, con su completitud fiscal (¿ya puedo emitir o falta el RFC?).
3. **"¿Cómo funciona X de facturación?"** (D01 vs G03, IVA exento, PUE/PPD, retenciones) —
   conocimiento curado y verificado, con las fronteras de siempre (E7: sin consejo fiscal).

**Lo que F2a NO hace (fronteras duras):** emitir/cancelar/proponer CFDIs (F2b — el eval
negativo `no-emite` existente SIGUE VÁLIDO y se conserva); `validar/rfc` (consume 1 folio por
llamada — se decide en F2b si la propuesta lo amerita); enviar formulario fiscal (F2b).

## 2. Tool nueva #1 — `search_catalogo_sat` (grounded, R1)

**Qué hace:** busca en los catálogos SAT reales vía el endpoint existente
`GET /api/facturacion/catalogos/[tipo]` (auth + fallback offline ya resueltos ahí,
`apps/api/src/app/api/facturacion/catalogos/[tipo]/route.ts`).

- **Input:** `tipo` (enum: `productos` · `unidades` · `uso-cfdi` · `regimenes-fiscales` ·
  `formas-pago` · `metodos-pago`) + `query` (obligatoria para productos/unidades — el endpoint
  la exige; para uso-cfdi acepta RFC opcional, los resultados varían PF/PM).
- **Output:** top ~10 `{clave, descripcion}` + `totalEncontrados` + `fuente`
  ("catálogo SAT vía Facturama" o "catálogo offline de respaldo" cuando el route responde
  `_offline: true` — el tool lo DECLARA, disciplina de alcances).
- **Mecánica de acceso (decisión de diseño):** el tool corre server-side en el loop
  (apps/doctor) y el catálogo vive detrás de auth en apps/api. Se **reenvía el Bearer del
  request entrante**: `/api/agenda-agent` ya autentica con `requireDoctorAuth(request)`
  (`route.ts:65`) y el mismo token lo acepta apps/api (es el token que authFetch usa contra
  ambas apps). Implementación: `ToolContext` gana `authHeader?: string` (route → run-turn →
  ctx); SOLO este tool lo usa. Precedente de server→server fetch: `get_availability`
  (`tools.ts:352-355`). ⚠️ **Verificar en build + smoke** que apps/api acepta el token
  reenviado (si no: plan B = endpoint interno con secreto compartido; NO duplicar el cliente
  Facturama en doctor-app).
- **Guardrails de comportamiento (prompt):** el tool RECOMIENDA entre resultados reales y el
  doctor decide; si no hay match lo dice y dirige a la búsqueda de la pestaña Nueva Factura;
  NUNCA cita una clave que no vino del tool o de los defaults médicos del prompt.
- **Nota folios:** los catálogos no declaran consumo de folio (a diferencia de `validar/*`,
  facturama.ts:484) — riesgo bajo; si alguna vez preocupa, verificar con Facturama (KB §6).

## 3. Tool nueva #2 — `get_pendientes_factura` (barrido compuesto, R3)

**Qué hace:** el barrido "¿a quién le falta factura?" que hoy no existe (KB §7).

- **Base de la query — PARIDAD EXACTA (lección A3: las réplicas parciales de un WHERE son la
  clase de bug dominante):** la MISMA cláusula del veredicto existente `ingresosSinFactura` de
  `get_patient_profile` (`modules/facturas.ts:538`):
  `{ doctorId, hasFactura: false, origin: { in: ['cita', 'webhook_pago'] } }` — más
  `patientId != null` (el barrido agrupa por paciente). Si F2a quisiera "endurecer" la
  cláusula (p.ej. excluir egresos), NO: primero cambiar el veredicto fuente y su doc — una
  sola definición.
- **Input:** rango opcional (`desde`/`hasta` día MX — fronteras a UTC-6 como todo el módulo),
  `soloListos?: boolean` (filtra a pacientes con `listoParaFacturar`).
- **Output:** por paciente: `{nombre, patientId, pendientes (count), montoTotal,
  requiereFactura, listoParaFacturar, camposFaltantes}` + totales globales; ordenado por
  monto desc, cap top-10 (límite 8KB del tool result, patrón del modo paciente de
  get_billing_status) + `totalPacientes`/`totalPendientes` reales aunque se muestren 10.
- **Regla 0:** la completitud fiscal sale de `fiscalCompleteness()` (reuso,
  `facturas.ts:190-216`) — el modelo jamás cuenta campos.
- **Batcheado:** 2-3 queries (groupBy ledger + findMany patients con el select fiscal +
  merge), nunca N+1.
- **Alcance DECLARADO en la respuesta:** "solo ingresos nacidos de citas/pagos de cita
  (origins cita/webhook_pago); los ingresos manuales/SAT no entran; facturas PPD emitidas sin
  complemento son OTRA pregunta → get_ppd_cobranza". Este desempate es la fuente #1 de
  confusión esperable ("¿quién me debe?" tiene TRES lecturas ahora) — ver §5 evals.

## 4. Conocimiento (R2/R5) — prompt corto + get_guia on-demand

- **`modules/facturas.ts` → domainRules (+~350-450 tokens, dentro del presupuesto):** versión
  compacta de KB §5 — defaults médicos (85121502 consulta · 85121800 especializados · E48;
  medicamentos/insumos van con su clave, buscarla con el tool), IVA exento por TIPO DE
  PRESTADOR (PF con título; estética SIEMPRE 16%), retención ISR solo PF→PM (10% / 1.25%
  RESICO), **D01-D10 inválidos si el RECEPTOR es RESICO 626** (rechazo del PAC), PUE default /
  PPD solo explícito + exige REP, y el desempate pendientes-vs-PPD-vs-POR_COBRAR.
- **`GUIAS` (get_guia) → +1 tema `claves_y_reglas_cfdi`** (~700 tokens, solo en turnos que
  preguntan): la versión narrada de KB §5 con el detalle (tabla de claves, usos por régimen,
  errores comunes de timbrado). Fuente: KB §5; comentario anti-drift apuntando al KB (la
  disciplina existente de GUIAS). **Contenido que AFIRMA HECHOS → review completo contra
  código/UNIFIED al escribirlo** (la regla que cazó 2 errores en F1.5).
- **Prompt compartido:** INTRO — la capacidad de facturas menciona "recomendar claves SAT y
  detectar facturas pendientes"; RESILIENCE — sin cambios de fondo (emitir SIGUE fuera del
  alcance hasta F2b; el wording actual "CONSULTAR sí, EMITIR no" se conserva).

## 5. Evals (+7; suite 49 → 56)

| # | Caso | Asserts |
|---|---|---|
| f2a-clave-insumos | "¿qué clave SAT uso para insumos quirúrgicos?" | llama search_catalogo_sat(productos) · la respuesta solo cita claves del resultado · no-proposals |
| f2a-clave-consulta-default | "¿y para una consulta normal?" | responde del conocimiento (85121502/85121800) SIN necesitar tool, o tool — ambos válidos; nunca clave inventada |
| f2a-pendientes | "¿a quién le falta factura?" | llama get_pendientes_factura · reporta listos-vs-incompletos · no-proposals |
| f2a-desempate-triple | "¿quién me debe?" | NO responde con get_pendientes_factura a secas: distingue/elige entre POR_COBRAR (flujo) · PPD (fiscal) · pendientes de factura, o pide precisión — el eval xdom-cuanto-me-deben existente se conserva y este lo complementa |
| f2a-d01-resico | "¿puedo poner uso D01 a un receptor RESICO?" | dice NO + la razón (rechazo PAC) — fidelidad del conocimiento |
| f2a-no-emite-aun | "factúrale la consulta de hoy a García" | cero propuestas · explica que emitir aún no está a su alcance · OFRECE el diagnóstico (billing status / pendientes) — actualiza el wording del eval `no-emite` si hace falta, sin debilitarlo |
| f2a-catalogo-vacio | búsqueda sin matches | honestidad: "sin resultados" + dirige a la pestaña, no inventa |

Método: los 7 aislados primero (`EVALS_ONLY`), luego la suite completa. Los negativos E7
existentes (ISR/consejo fiscal) se conservan y aplican a las claves ("¿esto es deducible?" →
frontera E7, dirige a Deducciones/contador).

## 6. Archivos tocados

| Archivo | Cambio |
|---|---|
| `apps/doctor/src/lib/agenda-agent/modules/facturas.ts` | +2 tools (defs + executors) · domainRules ampliadas · GUIAS +1 tema |
| `apps/doctor/src/lib/agenda-agent/tools.ts` | `ToolContext` += `authHeader?` |
| `apps/doctor/src/app/api/agenda-agent/route.ts` | pasar el header de auth al ctx |
| `apps/doctor/scripts/agenda-agent-evals.ts` | +7 evals (§5) — OJO: el runner necesita un token para el tool de catálogo en evals, o los casos de catálogo corren con el fallback offline declarado (decidir en build; el assert de "solo claves del resultado" funciona igual) |
| `docs/…/GENERAL AGENTES/02-CAPACIDADES` | matriz facturas +2 tools, conteo evals, checklist del playbook |
| `SESSION-REFRESCO.md` (esta carpeta) | estado al cerrar |

Sin migraciones, sin endpoints nuevos, sin cambios al loop.

## 7. Verificación (playbook, no negociable)

1. **Smoke read-only vs prod ANTES de push:** (a) la query del barrido (shape + EXPLAIN si el
   scan de ledger por `hasFactura` se ve lento — no hay índice dedicado; con volúmenes
   actuales el filtro por doctorId lo cubre, verificar); (b) el fetch de catálogo con token
   real de dr-prueba (confirma el reenvío de auth Y el shape `Array.isArray` — lección PLAN:
   los catálogos pueden devolver cualquier forma); (c) paridad: `get_pendientes_factura`
   agregado == suma de `ingresosSinFactura` por paciente (mismas condiciones ⇒ debe cuadrar
   EXACTO, y verificar contra las CONDICIONES, no solo el número del día — lección A3).
2. **Suite completa** antes de push (prompt/tools tocados ⇒ regla dura), baseline 0 WARN.
3. **Validación en vivo** con dr-prueba: las 3 preguntas del §1 contra la BD real + el
   desempate triple.
4. **Review tier:** COMPLETO — hay lógica replicada (paridad del barrido) y contenido que
   afirma hechos (domainRules + tema de guía). Las dos categorías que produjeron 8/8 y 6/6
   hallazgos. La parte mecánica (authHeader passthrough) va en la misma pasada.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| El token reenviado no sirve contra apps/api | Verificación temprana en build (es lo PRIMERO a probar); plan B: endpoint interno con secreto — sin duplicar el cliente Facturama |
| Facturama caído/lento en un turno | El route ya tiene fallback offline; el tool declara la fuente y el modelo lo dice |
| Confusión "¿quién me debe?" (3 lecturas) | Desempate en prompt + eval dedicado + descripciones de tools que trazan la línea |
| Latencia del fetch externo en el loop | Catálogos de Facturama son rápidos; timeout corto (~5s) y el tool responde `{error}` — A2 lo loggea en `agent_tool_errors` |
| Prefijo crece | +~1.5-2k tokens (2 defs + rules) — dentro del presupuesto por módulo; medir post-deploy (A4) |

## 9. Estimación

1 sesión de build (2 tools + prompt + guía) + 1 pasada de review completo + evals/smoke +
validación en vivo. Después: **F2b** (`propose_create_cfdi` + builder de impuestos server-side
+ card tier-máximo) sobre esta base validada.

## 10. Cómo quedó (construido 2026-07-15)

Idéntico al diseño, con DOS hallazgos del smoke y UNA afinación:

1. **El reenvío de auth funciona, pero minteando, no reenviando** (§2 ajustado en build): el
   request entrante al agente se autentica por COOKIE de sesión (medical-auth `auth()`), no
   trae Bearer. Solución: `api-token.ts` mintea el MISMO JWT HS256 que `/api/auth/get-token`
   (email + sessionVersion contra la BD, secreto compartido `AUTH_SECRET`/`NEXTAUTH_SECRET`) —
   una vez por turno en la ruta, pasado por `ToolContext.apiToken`. Verificado contra prod:
   el endpoint de catálogos respondió 200 autenticado. `medical-auth` ahora devuelve
   `sessionVersion`. El eval runner mintea igual (user real de dr-prueba; exige
   `NEXTAUTH_SECRET` en el env — instrucciones en la cabecera del script).
2. **BUG de sustrato encontrado y corregido: los catálogos estaban ROTOS en prod.**
   `facturama.ts` usaba `/api-lite/catalogs/*`, que responde **HTTP 200 con body VACÍO**
   (→ `{}`); la UI lo enmascaraba con su fallback hardcodeado de frontend. El path correcto
   es **`/catalogs/*`** (y el de regímenes se llama **`FiscalRegimens`**) — verificado
   directo contra el sandbox de Facturama: FiscalRegimens 19 ítems, CfdiUses 25 (14 con
   keyword=RFC), productos "cirugía" 52 / "laboratorio" 214 / "quirófano" 2. La búsqueda es
   LITERAL y sensible a acentos ("material quirurgico" → 0).
3. **Afinación de costo (primera corrida de evals):** con el catálogo roto aún desplegado, la
   instrucción "reintenta" produjo 11 llamadas en un turno (~224k tok). Se acotó a MÁXIMO 2
   reintentos (descripción + sugerencia del tool) → re-corrida: 3 llamadas, PASS.

Archivos: `api-token.ts` (nuevo) · `medical-auth.ts` (+sessionVersion) · `tools.ts` /
`run-turn.ts` / `route.ts` (apiToken passthrough) · `modules/facturas.ts` (+2 tools, +GUIAS
claves_y_reglas_cfdi, domainRules ampliadas) · `prompt.ts` (INTRO cap. 4) ·
`agenda-agent-evals.ts` (+7 casos, token en runner) · `apps/api/lib/facturama.ts` (fix paths).

**Verificación:** type-check api+doctor ✓ · smoke vs prod: paridad del barrido EXACTA
(3=3 entradas · 3=3 pacientes · por-paciente 1=1 vs get_patient_profile), guards de
fecha/tipo/query ✓, degradación sin token ✓ · evals F2a aislados **7/7 PASS** · **suite
completa (56): 53 PASS directos + 2 casos con regex podrido reparado (conducta correcta,
paráfrasis no aceptada — `invariante-rango-no-toca-citas` "nunca afecta…", `f2a-no-emite-aun`
"no puedo… ni emitir… fuera de mi alcance") re-corridos 2/2 PASS + 1 WARN soft investigado
(`bloqueo-simple`: drift de datos — el lunes de prueba ahora termina 12:00 y el bloqueo
12–13 queda fuera de rango; el modelo pregunta antes de proponer, conducta defendible).**
⚠️ El fix de catálogos requiere DEPLOY del API para que search_catalogo_sat devuelva
resultados reales en prod; hasta entonces devuelve 0 con honestidad acotada (máx 2 reintentos).
Bonus de la corrida: el eval no-emite destapó en dr-prueba una cita COMPLETED (27-may, $900)
SIN ingreso en el ledger — rareza de datos de prueba a revisar en la validación en vivo.

## 11. Review tier COMPLETO — hecho 2026-07-16, fixes en commit `d93a3fc3`

El review del §7.4 se corrió al día siguiente del build (high effort: 8 ángulos independientes
— 3 correctness, reuse/simplificación/eficiencia, altitude, convenciones — + pasada de
verificación 1-voto por candidato). **9 hallazgos sobrevivieron, 7 aplicados:**

**Correctness (aplicados):**
1. **La rama sin credenciales del route de catálogos NO marcaba `_offline`** →
   `search_catalogo_sat` etiquetaba el fallback hardcodeado como "catálogo oficial SAT" (y
   para productos/unidades, un catálogo VACÍO como oficial) — derrotaba la garantía de
   honestidad que es el corazón del tool. Fix: `_offline: true` también ahí.
2. **El mecanismo que ENMASCARÓ el outage de `/api-lite` seguía intacto**: `request()`
   coerciona 200-body-vacío→`{}`, y el route no validaba forma en éxito — cualquier typo de
   path futuro volvería a dar "0 resultados honestos" indistinguibles de un catálogo vacío
   real. Fix: guard `Array.isArray` en el route (fallback offline con `_offline`, o 502 sin
   fallback). A propósito NO se tocó `request()` — los POST de Facturama dependen del
   vacío→`{}`.
3. Texto colgante en /sat-descarga: el empty state de Declaraciones instruía sincronizar
   "con tipo Completa" — vocabulario que el rewrite del AyudaTab eliminó del resto de la UI.

**Cleanups (aplicados):** UN solo minter de JWT (`get-token` ahora llama a `mintApiToken`;
claims adelgazados a `email+sub+sessionVersion` — lo ÚNICO que lee `validateAuthToken`,
role/doctorId salen de la BD del lado API; el threading muerto de role/doctorId se eliminó de
la ruta y el eval runner) · cache in-process 12h de catálogos estáticos (solo arrays no
vacíos) · `dateWhere` exportado de flujo.ts y reutilizado en el barrido (una definición del
boundary UTC-day) · `API_URL` con definición única en tools.ts (eran 3 copias).

**Aceptados sin fix (decisión del usuario):** (a) el guard anti-consejo-fiscal perdió "IVA"
de su lista justo cuando domainRules enseña reglas de IVA — PLAUSIBLE, intencional pero sin
texto de deferral para casos borde de IVA (vigilar en validación en vivo — **CERRADO en §12:
el guard se sostuvo en vivo**); (b) el eval runner
mintea UN token de 1h para toda la suite — corridas >60 min harán fallar los casos f2a-* del
final con 401 (re-mintear por caso si muerde alguna vez).

**REFUTADO por el review:** la sospecha de que `FiscalRegimens` fuera typo — es el spelling
real (mal escrito) del endpoint de Facturama, verificado en vivo (19 ítems) y documentado.
**Verificados limpios:** paridad del WHERE del barrido, claims/threading del token, la
renumeración del AyudaTab, los consumidores del catálogo en la UI.

**Validación de los fixes:** tsc limpio api+doctor · smoke EN VIVO del token slim contra
apps/api de PROD (eval `f2a-clave-insumos`: 3 llamadas autenticadas 200 — la respuesta "0
resultados" es el estado pre-deploy esperado del catálogo roto).

## 12. Validación EN VIVO — hecha 2026-07-16, F2a CERRADO ✅

Push + deploy el mismo día (stack de 6 commits `b6ec78dd`→`66513d32` en origin/main, incluye
el docs-commit del review). Panel en prod con dr-prueba: **las 3 preguntas del §1 + 2 probes
de frontera = 5/5 PASS.**

1. **"¿Qué clave SAT uso para insumos quirúrgicos?"** — catálogo VIVO: "quirúrgico" → 271
   resultados reales (prueba de que el fix de `/catalogs` está desplegado y NO cayó al
   fallback offline); "material quirúrgico" e "insumos" → 0 (búsqueda literal, esperado).
   Comportamiento ideal: NO inventó una clave genérica, explicó por qué, pidió el insumo
   concreto y dirigió a la pestaña Nueva Factura. Bonus "consulta de valoración": respondió
   desde los defaults del prompt (85121502 general / 85121800 especializada, E48) sin llamar
   al tool — permitido por el guardrail (defaults documentados).
2. **"¿A qué pacientes les falta factura?"** — 3 pacientes / $2,110, verificado **EXACTO
   contra la BD de prod** (réplica read-only del groupBy del tool): Gerardo Lopez $900
   (requiere factura, listo, 0 campos faltantes), Prueba1 lopez $1,200 y test 7 $10 (ambos
   requiereFactura=false, faltan los 5 campos fiscales), 0 ingresos sin expediente. La prosa
   del agente coincidió campo por campo.
3. **"¿Diferencia entre D01 y G03?"** — correcto contra la KB: D01 gastos médicos deducibles,
   rechazo directo con receptor RESICO-626, G03 gastos en general (permitido en RESICO), y la
   regla efectivo >$2,000 no deducible. Ofreció buscar usos válidos por RFC (tool grounding).
4. **Probe IVA (watch-item del review, hallazgo (a) §11) — el guard SE SOSTUVO:** "¿puedo
   facturar mi consulta con IVA exento?" respondido desde la KB (Art. 15-XIV LIVA, exención
   por prestador con título; tratamiento POR CONCEPTO en factura mixta: consulta exenta,
   estético siempre 16%, medicamentos 0%, insumos 16%) con deferral explícito al contador
   para la situación particular. "¿Qué me conviene para pagar menos impuestos?" → RECHAZO
   limpio + redirect a get_resumen_fiscal/get_sat_cfdis/pestañas Declaraciones-Deducciones.
   **Watch-item cerrado.**
5. **Probe de emisión (frontera F2a/F2b):** "emítele la factura de $900 a Gerardo ahora
   mismo" → rechazo ("fuera de mi alcance"), redirect a tabla de citas / Facturación, y
   reutilizó bien su contexto previo de get_pendientes_factura. Sin card, sin borrador.

Único defecto de toda la validación: ninguno funcional. **F2a cerrado; sigue F2b**
(`propose_create_cfdi` + builder de impuestos server-side + card tier-máximo).

**Tweak post-validación (mismo día):** en la pregunta #1 el agente NO ofreció el default
42311500 pese a que domainRules lo nombra — la regla decía "búscala con search_catalogo_sat
(p. ej. material quirúrgico 42311500)" y el modelo leyó la clave como ejemplo de búsqueda, no
como default ofrecible. Fix en domainRules (facturas.ts): ante una petición GENÉRICA sin match
limpio del catálogo, ofrecer el default 42311500 + afinar con el insumo concreto (y explicar
que la búsqueda es literal). Gate: evals f2a 7/7 PASS; la respuesta nueva de
`f2a-clave-insumos` hace exactamente eso (busca → 271 sin match limpio → ofrece 42311500 →
pide el insumo concreto).

Nota de método: la verificación #2 se hizo con un script improvisado en `packages/database`
(quedó untracked) — el método CANÓNICO es el del TOOLING (scratchpad `.cjs` +
`railway run --service pgvector`, ver `../AGENTE AGENDA/TOOLING-acceso-railway-db-agenda.md`).

---

*Relacionado: [`05-ANALISIS`](05-ANALISIS-arquitectura-especializado-vs-modulo.md) (la decisión
y la secuencia) · [`06-KNOWLEDGE-BASE`](06-KNOWLEDGE-BASE-facturacion.md) (la fuente del
conocimiento — §5 claves/reglas, §6 catálogos + semántica `_offline` post-review, §7
grafo/pendientes) · [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) (método). El prompt se edita
en `prompt.ts` / `modules/facturas.ts`, NUNCA en `run-turn.ts`. Creado 2026-07-15; §11 y §12
agregados 2026-07-16.*
