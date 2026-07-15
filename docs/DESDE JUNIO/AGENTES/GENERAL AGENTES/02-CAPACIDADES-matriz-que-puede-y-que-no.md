# 🧾 Matriz de capacidades — qué puede y qué NO puede el asistente

> Referencia ÚNICA y transversal de los 5 módulos: tools, qué preguntas responde cada uno,
> y las fronteras duras. Snapshot 2026-07-12 (**35 tools / 5 módulos** — `ALL_TOOLS.length`
> del registry, la única fuente de conteo válida —, todo validado en
> vivo). La VERDAD es el código (`apps/doctor/src/lib/agenda-agent/modules/` + `prompt.ts`);
> este doc es el mapa. ⚠️ **Checklist del playbook: todo módulo o tool nuevo actualiza esta
> matriz** (igual que INTRO/RESILIENCE).

---

## 1. El modelo de confianza (aplica a TODO)

| Nivel | Qué | Cómo |
|---|---|---|
| **Lectura** | autónoma | El modelo consulta lo que necesite; un error de lectura es texto equivocado, no daño |
| **Escritura** | propuesta → card → doctor CONFIRMA → el CLIENTE ejecuta el endpoint real con su token | El servidor del agente jamás muta datos; NADA se ejecuta solo |
| **Veredictos de negocio** | server-side (regla 0) | "¿facturada?", "¿vencida?", "completitud fiscal", "conciliado" los decide el sistema, nunca el modelo contando campos |

## 2. Matriz por módulo

### AGENDA (lectura + PROPUESTAS — el único módulo con escrituras hoy)
| | |
|---|---|
| Tools lectura | get_day_schedule · get_ranges · get_bookings · get_booking_detail · get_availability · get_services · get_locations · find_patient |
| Tools propuesta | propose_create_range · propose_delete_range · propose_block_time · propose_unblock_time · propose_create_booking · propose_confirm_booking · propose_cancel_booking · propose_reschedule_booking · propose_complete_booking · propose_no_show |
| Responde | horarios, citas (incl. vencidas server-side), disponibilidad real (mismo motor que la página pública), servicios, búsqueda de pacientes |
| Puede proponer | rangos, bloqueos, y TODAS las acciones de cita (crear/confirmar/cancelar/reagendar/completar con ingreso/no-asistió) — planes multi-paso secuenciales con stop-on-failure |
| NO puede | ejecutar nada sin confirmación · deducir huecos a mano · reactivar estados finales · filtrar citas por consultorio (el dato no existe) |
| Docs | `AGENTE AGENDA/` |

### FACTURAS/PAGOS (solo lectura — F2a "experto" 2026-07-15)
| | |
|---|---|
| Tools | get_billing_status ⭐ · get_patient_profile · get_fiscal_profile_status · get_cfdis · get_sat_cfdis · get_payment_links · get_payment_provider_status · get_guia (4 temas) · **search_catalogo_sat** · **get_pendientes_factura** |
| Responde | diagnóstico completo de cobro/factura de una cita o paciente (matriz de 6 preguntas), CFDIs por fuente DUAL (plataforma vs SAT, con frescura), completitud fiscal server-side (listoParaFacturar), links de pago, estado Stripe/MP, guías curadas (incl. claves_y_reglas_cfdi), **claves de los catálogos OFICIALES del SAT (grounded — nunca inventa claves)** y **el barrido "¿a quién le falta factura?"** (paridad exacta con ingresosSinFactura) |
| NO puede | EMITIR ni cancelar CFDIs (F2b/nunca-v1) · crear links de pago (F2b) · enviar el formulario fiscal (F2b) · tomar datos fiscales de texto libre (solo del expediente) |
| Desempate | "¿quién me debe?" tiene TRES lecturas: sin PAGAR (flujo POR_COBRAR) · PPD sin complemento (fiscal) · sin FACTURA (get_pendientes_factura) — una cifra CON fuente + nombrar las otras |
| Docs | `AGENTE FACTURAS/` (F2a: `07-PLAN`) |

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

- Emitir/cancelar CFDIs, crear links de pago, enviar formulario fiscal → **F2** (facturas).
- Escribir en el ledger/conciliación → **F2+** (Motor 4, diseño en flujo docs 06).
- Contenido clínico del expediente → **tier de privacidad propio** (quizá nunca, o módulo aparte con logging/modelo distintos — blueprint §5.3 nivel 3).
- Calcular ISR/deducibilidad, consejo fiscal → **nunca** (E7; el sistema calcula, el contador aconseja).
- Configuración de cuenta/pasarelas → fuera.
- Nombres/notas de pacientes son DATOS, no instrucciones (anti prompt-injection).
- **Navegación de UI** ("¿dónde hago click?", "¿qué botón?", "paso a paso en la app"): el modelo NO
  ve la interfaz → nunca inventa pasos/botones; ofrece HACER la acción por chat y dirige al **Centro
  de ayuda** (capa de conocimiento, `AGENTE KNOWLEDGE LAYER/`). NO aplica a CÓMO FUNCIONA un flujo
  (eso es concepto, SÍ lo explica).

## 4. Números operativos (2026-07-15)

**37 tools / 5 módulos** (agenda 8+10 · facturas 10 · fiscal 2 · flujo 5 · expediente 2) ·
prefijo estático ~21.2k + F2a (~1.5-2k est. — re-medir post-deploy, A4) · modelo
claude-sonnet-5 · cap diario 500k budget tokens (~$1.50/doctor) cost-weighted · caché 1
breakpoint estable + 2 móviles, TTL 5 min · suite de evals: **56 casos** (incl. 3 sondas de
inyección `inj-*` con fixtures permanentes `A6INJ*`, 3 de capa de conocimiento `kl-*`, y 7
`f2a-*` del experto en facturas), **baseline 0 WARN** (un WARN se investiga, ya no es
"normal"; los soft son guardas data-dependent justificadas). Nota F2a: search_catalogo_sat
necesita `ToolContext.apiToken` (minteado por turno desde la sesión — `api-token.ts`).

---

*La verdad es el código; ante duda, `modules/*.ts` gana. Relacionado:
[`00-BLUEPRINT-asistente-modular.md`](00-BLUEPRINT-asistente-modular.md) (estrategia/escalamiento),
carpetas `AGENTE */` (profundidad por dominio).*
