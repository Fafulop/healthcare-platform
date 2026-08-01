# 🧾 Matriz de capacidades — qué puede y qué NO puede el asistente

> Referencia ÚNICA y transversal de los 5 módulos: tools, qué preguntas responde cada uno,
> y las fronteras duras. **Este es el ÚNICO doc que declara los conteos en presente**
> (tools, módulos, evals, prefijo) — todos los demás los citan con fecha; ver
> [`07-CONVENCIONES-docs.md`](07-CONVENCIONES-docs.md) §2. La VERDAD es el código
> (`apps/doctor/src/lib/agenda-agent/modules/` + `prompt.ts`); este doc es el mapa.
>
> **Verificado contra el código 2026-07-25 (evals re-contados 2026-07-31): 39 tools / 5 módulos ·
> suite de evals 85 casos.**
> ⚠️ **Checklist del playbook: todo módulo o tool nuevo actualiza esta matriz**
> (checklist completo en `07-CONVENCIONES` §5).

---

## 1. El modelo de confianza (aplica a TODO)

| Nivel | Qué | Cómo |
|---|---|---|
| **Lectura** | autónoma | El modelo consulta lo que necesite; un error de lectura es texto equivocado, no daño |
| **Escritura** | propuesta → card → doctor CONFIRMA → el CLIENTE ejecuta el endpoint real con su token | El servidor del agente jamás muta datos; NADA se ejecuta solo |
| **Veredictos de negocio** | server-side (regla 0) | "¿facturada?", "¿vencida?", "completitud fiscal", "conciliado" los decide el sistema, nunca el modelo contando campos |

## 1.5 Quién ve cada módulo (usuarios secundarios)

El set de módulos NO es el mismo para todos: un **member** (usuario secundario, feature NUEVOS
USUARIOS) recibe solo los módulos cuyos toggles de permiso tiene TODOS encendidos. El dueño
recibe siempre los 5. Fuente ÚNICA: `AGENT_MODULE_REQUIREMENTS` en `@healthcare/database`
(`packages/database/src/permissions.ts`) — la comparten el agente (`registry.ts` lo re-exporta)
y la pestaña Equipo de mi-perfil, que agrupa/colorea los toggles por módulo desde ese mismo
objeto (sin copiar la lista — G9).

| Módulo | Toggles requeridos (TODOS) |
|---|---|
| agenda | `citas` |
| expediente | `expedientes` |
| facturas | `facturacion` + `sat` |
| fiscal | `facturacion` + `sat` |
| flujo | `flujo` + `pagos` + `conciliacion` |

**Fail-closed:** un módulo que no esté en ese mapa queda BLOQUEADO para members — un módulo
futuro debe agregarse explícitamente para llegar a ellos. El recorte ocurre ANTES del turno, así
que las tools de un módulo bloqueado **no existen** para ese usuario: no puede invocarlas ni por
accidente ni a propósito. El prompt del dueño queda byte-idéntico (caché intacto). Detalle y
evals: `../../NUEVOS USUARIOS/01-DISENO-tecnico.md` §7 ·
`../AGENTE AGENDA/SESSION-REFRESCO.md` (Evals G11 2026-07-22).

### 1.5.1 El SEGUNDO techo: el TIER de la cuenta (TIERS T3, 2026-07-25)

Los toggles de member no son el único recorte. El **plan** de la cuenta (`Doctor.tier`) es un techo
que aplica **también al DUEÑO**, y corta más fino: **a nivel de TOOL**, no de módulo. En CORE el
módulo `flujo` SOBREVIVE pero sin `get_conciliacion_bancaria`, y del módulo `facturas` —que se
cae— se RESCATAN sus tools de `pagos`, porque CORE incluye Pagos.

| | Gating de MEMBER | Gating de TIER |
|---|---|---|
| Granularidad | módulo | **tool** |
| A quién aplica | solo members | **dueño Y member** |
| Regla | TODOS los toggles del módulo | key propia de la tool, o el requisito del módulo menos lo excluido |

> ⚠️ **La función que compone es `resolveAgentScope(access)`** (`modules/registry.ts`), NO
> `enabledModules` — esa quedó **sin exportar** a propósito: responde solo la mitad de la pregunta
> (toggles) y su nombre suena a la respuesta completa, así que un llamador externo se saltaría el
> plan de la cuenta en silencio.

**Y el recorte de tools NO basta**: la prosa, las DESCRIPCIONES de tools, los payloads y hasta los
FILTROS de entrada siguen hablando de la función que se fue. Por eso un módulo puede declarar
`prompt.partial` (sección alternativa) y `prompt.prosaDependsOn` (de qué capacidades depende su
texto), evaluado contra **lo que el toolset PROVEE** — no contra el toggle ni el tier. Detalle
completo y los bugs que lo motivaron: `../../TIERS/01-DISENO-tecnico.md` §11.5 y §11.5.1 ·
bitácora `../AGENTE AGENDA/SESSION-REFRESCO.md` #25–#27.

> 🔎 **Y el PAYLOAD es el cuarto eje — el que `gate:prosa` NO puede ver** (bitácora #28,
> 2026-07-27). Un CAMPO que sobrevive al recorte de tools invita al modelo a inventar con él: en
> CORE, los buckets `sat_emitido`/`sat_recibido` de `get_flujo_status` bastaron para que fabricara
> un diagnóstico de conciliación y narrara la historia de la cuenta — **4/4 corridas**, con la prosa
> diciéndole lo contrario. Se corrigen COLAPSANDO/renombrando el campo (nunca recalculando: regla 0),
> y cerrando su FILTRO gemelo. `gate:prosa` mira prosa y descripciones, así que esta clase **no
> tiene garantía de máquina** — solo evals. Residuo vivo (sustitución/redirect, 2/3) en #28.

✅ **Over-claim del member — CORREGIDO 2026-07-23** (era: un member a veces SOBRE-DECLARABA en
prosa capacidades de módulos que no tiene). Fix en `MEMBER_SCOPE_NOTE`, owner byte-idéntico,
3/3 member evals. Failure mode de LLM → el nudge lo reduce, no lo elimina (checks `soft`). Ver
bitácora #24 y `00-BLUEPRINT` §5.2 punto 6.

## 2. Matriz por módulo

### AGENDA (lectura + PROPUESTAS)
| | |
|---|---|
| Tools lectura | get_day_schedule · get_ranges · get_bookings · get_booking_detail · get_availability · get_services · get_locations · find_patient |
| Tools propuesta | propose_create_range · propose_delete_range · propose_block_time · propose_unblock_time · propose_create_booking · propose_confirm_booking · propose_cancel_booking · propose_reschedule_booking · propose_complete_booking · propose_no_show |
| Responde | horarios, citas (incl. vencidas server-side), disponibilidad real (mismo motor que la página pública), servicios, búsqueda de pacientes |
| Puede proponer | rangos, bloqueos, y TODAS las acciones de cita (crear/confirmar/cancelar/reagendar/completar con ingreso/no-asistió) — planes multi-paso secuenciales con stop-on-failure |
| NO puede | ejecutar nada sin confirmación · deducir huecos a mano · reactivar estados finales · filtrar citas por consultorio (el dato no existe) |
| Docs | `AGENTE AGENDA/` |

### FACTURAS/PAGOS (lectura F2a + EMISIÓN F2b — validado en vivo 2026-07-16)
| | |
|---|---|
| Tools lectura | get_billing_status ⭐ · get_patient_profile · get_fiscal_profile_status · get_cfdis · get_sat_cfdis · get_payment_links · get_payment_provider_status · get_guia (4 temas) · **search_catalogo_sat** · **get_pendientes_factura** |
| Tools propuesta | **propose_create_cfdi** (card 🧾 tier-MÁXIMO — timbra un documento fiscal legal): ingreso de cita/link (nunca manual), receptor SOLO del expediente completo, impuestos server-side (`cfdi-builder.ts`, E7), RFC genérico ⇒ Público en General (S01/616) con advertencia; doble emisión bloqueada en pre-check Y endpoint (409); **uso×régimen incompatible = hard stop** (post-F2c: matriz REGIMEN_USO_VALID); PPD solo explícito (forma 99 + advertencia REP); cita sin completar ⇒ DOS turnos · **propose_prepare_factura_borrador** (F2c, card LIGERA — reversible, nada se timbra): factura COMPUESTA pre-llenada como CfdiDraft que el doctor revisa/edita/emite en el form (`?draft=`); botón "Abrir borrador" en la card; anti-duplicado; discrepancia factura-vs-ingreso NORMAL aquí; los reads reportan borradorPendiente |
| Responde | diagnóstico completo de cobro/factura de una cita o paciente (matriz de 6 preguntas), CFDIs por fuente DUAL (plataforma vs SAT, con frescura), completitud fiscal server-side (listoParaFacturar), links de pago, estado Stripe/MP, guías curadas (incl. claves_y_reglas_cfdi), **claves de los catálogos OFICIALES del SAT (grounded — nunca inventa claves)** y **el barrido "¿a quién le falta factura?"** (paridad exacta con ingresosSinFactura) |
| NO puede | cancelar CFDIs (nunca-v1) ni complementos de pago · facturar ingresos manuales o PG "de dedo" (solo vía RFC genérico del expediente) · **facturas SIN cita (extras/venta suelta) — hoy UI-only vía patrón de separación (money-model #5); tool del agente decidido-sin-diseñar, radar en REFRESCO facturas #6** · crear links de pago (F2+) · enviar el formulario fiscal (F2+) · tomar datos fiscales de texto libre (solo del expediente) · subfacturar (guardrail emergente ENDOSADO: rehúsa montos ≠ ingreso sin contexto legítimo, incluso "de prueba") |
| Desempate | "¿quién me debe?" tiene TRES lecturas: sin PAGAR (flujo POR_COBRAR) · PPD sin complemento (fiscal) · sin FACTURA (get_pendientes_factura) — una cifra CON fuente + nombrar las otras |
| Docs | `AGENTE FACTURAS/` (F2a: `07-PLAN` · F2b: `08-PLAN`) |

### FISCAL (solo lectura)
| | |
|---|---|
| Tools | get_resumen_fiscal · get_ppd_cobranza |
| Responde | resumen mensual en BASE DE EFECTIVO desde XML del SAT (ingresos/deducciones/IVA/retenciones, PPD prorrateado por pago), acuses de declaración, cobranza PPD ("¿quién me debe facturas?") |
| NO puede | **calcular ISR** (frontera E7 — dirige a la pestaña Declaraciones) · clasificar deducibilidad · dar consejo fiscal (régimen óptimo = contador) |
| Desempate | "¿cuánto FACTURÉ?" = get_sat_cfdis (con IVA, por emisión) · "¿cuánto INGRESÉ?" para declarar = get_resumen_fiscal · dinero del día a día = flujo |
| Docs | `AGENTE FACTURAS/` (F1.5) |

### FLUJO DE DINERO (solo lectura)
| | |
|---|---|
| Tools | get_flujo_status · get_movimientos · get_balance · get_movimiento_detail · get_conciliacion_bancaria |
| Responde | diagnóstico de conciliación/evidencia (réplica de la pestaña), movimientos con filtros (incl. estatusPago POR_COBRAR), balance real/proyectado, detalle con evidencia fiscal+bancaria+pago online, estados de cuenta y sin-conciliar |
| NO puede | crear/editar/conciliar/vincular/fusionar/ignorar movimientos ni subir estados de cuenta (F2+ = Motor 4) |
| Desempate | "¿quién me debe?" tiene DOS lecturas (PPD = fiscal · ledger POR_COBRAR = flujo); "¿cuánto gasté?" ambiguo → una cifra CON fuente + nombrar la otra |
| Gotcha | los agregados de get_flujo_status (réplica de la pestaña) NO cuentan settlements "Varios" como conciliados; el veredicto por-fila sí — la nota del tool lo explica |
| Docs | `AGENTE FLUJOS/` |

### EXPEDIENTE (solo lectura, SOLO METADATOS)
| | |
|---|---|
| Tools | get_expediente_resumen · get_pacientes_overview |
| Responde | ficha administrativa (edad/estatus/tags/última consulta), conteos y fechas de consultas·recetas·documentos·notas·formularios, borradores sin cerrar, seguimientos próximos Y vencidos, cartera (activos/nuevos/reactivación) |
| NO puede | **contenido clínico, jamás**: notas SOAP, diagnósticos, medicamentos de recetas, vitales, textos del baseline (solo flags "registrado sí/no") — frontera ESTRUCTURAL en los selects + tripwire en el smoke |
| Gotcha | "última consulta" = encounter clínico, NO citas de agenda (un expediente sin consultas puede tener citas); fechas médicas en día UTC (paridad con la UI) |
| Docs | `AGENTE EXPEDIENTE/` |

## 3. Fuera de alcance GLOBAL (RESILIENCE — el modelo lo declina y nombra lo que sí hace)

- ~~Emitir CFDIs~~ → **EN ALCANCE desde F2b** (propose_create_cfdi, card 🧾). Siguen fuera:
  cancelar CFDIs/complementos, facturar manuales/PG-de-dedo, crear links de pago y enviar
  formulario fiscal → **F2+/F3** (facturas).
- Escribir en el ledger/conciliación → **F2+** (Motor 4, diseño en flujo docs 06).
- Contenido clínico del expediente → **tier de privacidad propio** (quizá nunca, o módulo aparte con logging/modelo distintos — blueprint §5.3 nivel 3).
- Calcular ISR/deducibilidad, consejo fiscal → **nunca** (E7; el sistema calcula, el contador aconseja).
- Configuración de cuenta/pasarelas → fuera.
- Nombres/notas de pacientes son DATOS, no instrucciones (anti prompt-injection).
- **Navegación de UI** ("¿dónde hago click?", "¿qué botón?", "paso a paso en la app"): el modelo NO
  ve la interfaz → nunca inventa pasos/botones; ofrece HACER la acción por chat y dirige al **Centro
  de ayuda** (capa de conocimiento, `AGENTE KNOWLEDGE LAYER/`). NO aplica a CÓMO FUNCIONA un flujo
  (eso es concepto, SÍ lo explica).

## 4. Números operativos (verificados contra el código 2026-07-23)

<!-- Marcadores verificados por scripts/check-docs-numbers.ts contra el CÓDIGO.
     Si el gate falla: NO edites el marcador a mano sin entender por qué cambió el código.
     Actualiza el número Y el texto de esta sección juntos. -->
<!-- gate:tools=39 -->
<!-- gate:modules=5 -->
<!-- gate:evals=85 -->
<!-- gate:module-list=agenda,facturas,fiscal,flujo,expediente -->

**39 tools / 5 módulos** — desglose real (conteo de `input_schema` por archivo): agenda 8 de
lectura (`tools.ts`) + 10 de propuesta (`proposals.ts`) · facturas 12 (10 lectura + 2
propuestas) · fiscal 2 · flujo 5 · expediente 2. El conteo válido es `ALL_TOOLS.length` del
registry — nunca sumar a mano.

**Suite de evals: 85 casos** (contados en `scripts/agenda-agent-evals.ts`). Por familia:
6 `f2a-*` · 6 `f2b-*` · 2 `f2c-*` · 5 `flujo-*` · 5 `xdom-*` cross-dominio · 3 `exped-*` ·
3 `kl-*` de capa de conocimiento · 3 `inj-*` sondas de inyección (fixtures permanentes
`A6INJ*`) · 6 `member-*` del path de usuario secundario (3 de un módulo + 2 con la forma REAL de 4 módulos del member en prod + 1 del caso espejo flujo-sin-fiscal) · **13 `tier-core-*` del techo de plan
CORE (TIERS T3, 2026-07-25; +1 de la bitácora #28, 2026-07-27)** · 4 `f1-*` · 6 `f15-*` · **3 `disponibilidad-*` de los tres sabores de "este día no sirve" (bitácora #32, 2026-07-31: día bloqueado entero / rango exactamente lleno / día sin rango)** · **1 `weekday-salida-*` del eje CONTRARIO a `weekday-correcto` (bitácora #33: fecha → nombre del día)** · el resto, casos core de agenda.
**Baseline 0 WARN** (un WARN se investiga, ya no es "normal"; los soft son guardas
data-dependent justificadas).

Los `tier-core-*` corren con `tier: 'CORE'` en el caso: sin `permissions` corren como **dueño**
de una cuenta CORE (el techo del plan aplica al dueño, a diferencia de los toggles de member).
⚠️ **La última corrida completa (2026-07-22) dio `62/65 PASS · 3 WARN · 0 FAIL`. Ese 62 es el
RESULTADO de una corrida, NO el tamaño de la suite** — confundirlos fue un error real que se
propagó por varios docs (ver [`07-CONVENCIONES-docs.md`](07-CONVENCIONES-docs.md) §2.3).
Si no tienes claro qué cuenta cada número de este doc (tools vs evals vs toggles), la
desambiguación está en [`08-EMPIEZA-AQUI.md`](08-EMPIEZA-AQUI.md) §1.5.

**Modelo y costos:** claude-sonnet-5 (`AGENDA_AGENT_MODEL`) · cap **SEMANAL** 2M budget tokens
(~$6/sem ≈ $26/mes peor caso) ponderado por costo, corte lunes 00:00 MX — movido de diario 500k
el 2026-07-23 (cost review [`OPTIMIZACION COSTOS`](../OPTIMIZACION%20COSTOS/README.md): la ventana
de 7 días promedia los días sin uso) · caché 1 breakpoint estable + 2 móviles, TTL 5 min.
*El modelo declarado arriba es el que corre HOY en prod y no ha cambiado.* 📌 **Candidato 2026-07-23:
Haiku 4.5 + thinking, a ~la mitad del costo — pero el experimento NO está cerrado**: tres corridas
de la misma config dieron 64, 63 y 58 de 65 (ningún fallo reproducible), así que la calidad no está
establecida. Vive en la rama `agent/haiku-viability`, sin desplegar. Cuando (y si) se mergee, este
renglón es el que se actualiza. Estado real y plan:
[`OPTIMIZACION COSTOS`](../OPTIMIZACION%20COSTOS/README.md) (caja 🛑).

**Prefijo estático: 22,821 tokens — MEDIDO EXACTO con `count_tokens` (2026-07-30, Haiku 4.5).**
Split: **system 9,600 (42%) · tools 13,220 (58%)** con los 39 tools.
Reproducible (no toca la BD, no consume generación), desde `apps/doctor`:
`npx tsx scripts/measure-agent-prefix.ts` — **ya no hace falta pinnear el modelo**, el script
importa `MODEL` de `run-turn.ts`. Para medir otro: `AGENDA_AGENT_MODEL=<id> npx tsx …`.

> ⚠️ **El número que de verdad importa hoy es MENOR: ~11.0k.** Desde `0daeed21` (tool search,
> 2026-07-24) solo 4 tools "calientes" + el tool de búsqueda entran al contexto; los otros 35
> viajan en el request pero **no cargan hasta descubrirse**. Medido 2026-07-30: system + 4 hot =
> **10,957 tok**. Los 22,821 son el techo "si se cargara todo", útil para comparar contra el
> histórico y para priorizar poda — no lo que se paga en una pregunta fría típica.
>
> ⚠️ **Ese ~11.0k es un PISO, no el número exacto**, por dos razones: (1) `count_tokens` **rechaza
> los server tools** (*"Server tools are not supported in the count_tokens endpoint"*), así que el
> `tool_search_tool_regex` no está contado — el real es un poco mayor; (2) se midió con fetch
> directo, sin restar el overhead del envoltorio (~8 tok) que sí resta el script. Para el techo
> (22,821) y la comparación histórica, usa **siempre** el script — mezclar métodos es justo el
> error que este bloque documenta.

> ⚠️ **Comparar con el 27,151 de 2026-07-23 SIN corregir el tokenizador da una conclusión falsa.**
> Ese día el modelo default era `claude-sonnet-5`; desde `a5d95fad` (2026-07-24) es
> `claude-haiku-4-5`, y **son tokenizadores distintos**. Medido el mismo día contra los dos:
> `claude-sonnet-5` → **28,045** · `claude-haiku-4-5` → **22,821** (ambos con el MISMO script que
> produjo el 27,151, para que la resta sea legítima). O sea que contra su propio
> tokenizador el prefijo **CRECIÓ +894 tok** (system 12,126→12,772 · tools 15,025→15,273) por el
> trabajo de julio; la "bajada" de 4.3k es puro cambio de modelo. **Un número de tokens sin el
> modelo al lado no es comparable.**
>
> ✅ **Deuda del script CORREGIDA (2026-07-30).** Tenía su propio default (`claude-sonnet-5`) que
> se quedó atrás cuando `a5d95fad` movió el agente a Haiku 4.5, y su línea de costo cotizaba
> $2/$3 por millón (tarifas Sonnet) midiera lo que midiera — contra Haiku ($1/M) sobreestimaba
> 2–3×. Ahora **importa `MODEL` de `run-turn.ts`** (drift imposible por construcción, §6 de
> `08-EMPIEZA-AQUI`) y busca la tarifa POR MODELO; si no conoce el modelo, **omite el dólar** en
> vez de inventarlo. `AGENDA_AGENT_MODEL` sigue funcionando como override (verificado: fuerza la
> medición a Sonnet 5).
>
> 🔑 **Lo que este episodio enseña, y aplica a cualquier número de tokens de estos docs:** el
> 27,151 **no estaba mal medido** — era correcto el 2026-07-23, cuando script y runtime coincidían
> en Sonnet 5. Se volvió incomparable **un día después**, sin que nadie tocara nada, porque cambió
> el modelo. **Un número de tokens es una función del prompt Y del tokenizador**: sin el modelo al
> lado no es un dato, es una trampa.

> ⚠️ **Corrige la estimación anterior de "~24.7k" (2026-07-23).** Ese número salía del PISO de
> `prompt_tokens` en `llm_token_usage` y el doc asumía que el real sería *un poco menor*: era
> **+10% MAYOR**. Lección que sigue vigente: el prefijo gobierna ~82% del costo de una pregunta
> fría, así que se mide, no se infiere.

**Presupuesto por módulo (~2-3k) — 2 de 5 lo exceden** (medido 2026-07-30 con `claude-haiku-4-5`;
señal de nivel 1 de `00-BLUEPRINT` §5.3, "si un módulo pide más, sus veredictos no están
suficientemente server-side"):

| Módulo | Total | tools | prompt | vs presupuesto |
|---|---|---|---|---|
| facturas | 7,399 | 5,237 (12) | 2,162 | ⚠️ ~2.5× |
| agenda | 5,950 | 4,547 (18) | 1,403 | ⚠️ ~2× |
| flujo | 2,480 | 1,621 (5) | 859 | ✅ (antes ⚠️) |
| fiscal | 1,364 | 660 (2) | 704 | ✅ |
| expediente | 1,261 | 659 (2) | 602 | ✅ |

Suma de módulos 18,454; el resto (4,367) es prompt COMPARTIDO (intro/resilience/reglas globales)
+ overhead del bloque de tools (496). Tool más pesada: `propose_create_cfdi` (1,116), seguida de
`propose_prepare_factura_borrador` (796) y `get_movimientos` (618). Detalle y consecuencias de
costo: [`../OPTIMIZACION COSTOS/02-BITACORA`](../OPTIMIZACION%20COSTOS/02-BITACORA-experimentos.md).

> ⚠️ **La tabla bajó de 3 módulos sobre presupuesto a 2, pero NO por una poda:** la medición
> anterior era con el tokenizador de Sonnet 5. `flujo` cruzó el umbral por cambio de modelo, no
> porque encogiera. Comparar filas de 2026-07-23 con éstas es el mismo error que arriba.

**Ninguna señal de escalamiento §5.3 disparada — nivel 0 se mantiene** (medición 2026-07-23,
read-only vs prod, n=80 turnos con budget, TODOS dr-prueba — sin señal de doctores reales aún):
- (b) p50 budget/turno **10,256 → 10,826 = +5.6%** (umbral +20%) ✅
- prefijo **27.2k medido** (umbral nivel 2 = 35-40k) ✅ — más cerca del umbral de lo que se creía
- (c) peor día real **61.2% del cap** (2026-07-17, 16 turnos) ✅
- ⚠️ **Lo que SÍ subió:** los turnos CAROS. p95 budget **28,658 → 39,877 (+39%)** y promedio
  +30% — es F2a/b/c (búsqueda de catálogo + emisión corren más iteraciones/turno). El turno
  mediano no cambió; los pesados sí. Y el headroom bajó de ~2.5× a ~1.6× (el peor día pasó de
  40.7% a 61.2% del cap). Pregunta fría ≈ 33k budget ⇒ **~15 preguntas frías/día** caben en el
  cap. Palanca si muerde con doctores reales: TTL de caché 1h (nivel 1), no poda. Detalle del
  método en [`03-PLAN-auditoria-integral.md`](03-PLAN-auditoria-integral.md) A4.

Nota F2a:
search_catalogo_sat necesita `ToolContext.apiToken` (minteado por turno desde la sesión —
`api-token.ts`).
Nota F2b: Facturama apunta a SANDBOX en prod (intencional) y el agente NO lo sabe —
deliberado: trata toda emisión como legalmente real ("es de prueba" no es palanca).
Nota F2c: los caminos FELICES de emisión/borrador están data-blocked en evals desde el
timbre en vivo (folio 8 consumió el único ingreso listo) — re-sembrar completando una cita
de prueba.

---

*La verdad es el código; ante duda, `modules/*.ts` gana. Relacionado:
[`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) (estrategia/escalamiento),
carpetas `AGENTE */` (profundidad por dominio).*
