# Contexto: SAT Descarga — qué es y estado actual (para el Agente Facturas)

> **Propósito de este doc.** Contexto de la funcionalidad SAT Descarga para cuando el Agente
> Facturas necesite razonar sobre CFDIs descargados del SAT (no solo los emitidos vía Facturama).
> Documentación técnica completa en [`docs/TODO FACTURAS/SAT-DESCARGA/`](../../../TODO%20FACTURAS/SAT-DESCARGA/OVERVIEW.md).
> Última actualización: 2026-07-08 (commit `45b67a4c`).

---

## Qué es SAT Descarga

Integración **directa con el SAT** (SOAP + WS-Security, zero dependencies) para **descargar** los
CFDIs de cada doctor — emitidos Y recibidos — usando su **e.Firma** (FIEL, no el CSD). Es el
complemento inverso de Facturama:

| | Facturama | SAT Descarga |
|---|---|---|
| Dirección | App → SAT (emitir) | SAT → App (descargar) |
| Credencial | CSD del doctor | e.Firma del doctor (cifrada AES-256-GCM) |
| Qué cubre | Solo lo emitido desde la plataforma | **Todo** lo que el SAT tiene del RFC |

**Dato clave para el agente:** hay doctores (p. ej. el doctor de prueba LOFD9406276F8) que emiten
**fuera** de la plataforma — `cfdis_emitted` (Facturama) está vacío para ellos. SAT Descarga es la
**única fuente de verdad** de sus emitidos.

## Cómo funciona (resumen)

El SAT es asíncrono (solicitud → polling → paquete ZIP, minutos a 72h). Un worker cron
(`/api/cron/sat-sync-worker`, cada 15 min) avanza jobs de `sat_sync_jobs` por una state machine:
`pending → authenticating → polling → downloading → completed/failed`. Hay dos tipos de job por
dirección:

- **metadata** → tabla `sat_cfdi_metadata` (12 campos: UUID, RFCs, monto, efecto I/E/P/T, estatus
  Vigente/Cancelado, fechas). Es lo que alimenta la lista del dashboard.
- **xml** → tablas `sat_cfdi_details` + `sat_cfdi_conceptos` (desglose fiscal completo: subtotal,
  IVA, ISR, método/forma de pago, uso CFDI, conceptos). Los complementos de pago (tipo P) además
  alimentan `sat_pagos`.

Encima de eso ya existe: auto-sync diario (~6 AM), backfill histórico desde 2025-01, alertas de
CFDIs nuevos/cancelados, export CSV, declaración helper (ISR/IVA), checker de deducibilidad,
proyección de cobranza PPD, y **auto-registro al ledger** (`autoRegisterCfdisToLedger`): cada CFDI
Vigente con efecto I/E se convierte en un `LedgerEntry` del flujo de dinero.

**Gotcha permanente:** `sat_cfdi_metadata` guarda UUIDs en MAYÚSCULAS, `sat_cfdi_details` en
minúsculas. Todo JOIN entre ambas usa `LOWER()`.

## Lo que pasó en julio 2026 y lo que arreglamos (2026-07-08)

### Síntoma

El dashboard mostraba **1 solo CFDI de julio** (una nota de crédito) y 36 jobs fallidos, cuando en
realidad **8 CFDIs de julio ya estaban descargados y parseados** como XML en `sat_cfdi_details`.

### Causa raíz (tres problemas encadenados)

1. **El SAT estuvo inestable toda la semana** (jul 1–8): respuestas `Rechazada codSol=5004 cfdis=0`
   (periodo vacío legítimo al inicio del mes), timeouts de 30s, y un estado no documentado
   `estado=0 cod=404`. Los jobs de metadata fallaron casi todos; los de XML lograron pasar el jul 8.
2. **El dashboard es metadata-driven**: si el job de metadata falla, los datos del XML quedan
   invisibles aunque estén en la BD.
3. **El botón "Reintentar" borraba los reintentos buenos**: clasificaba como "huérfano" cualquier
   job fallido que tuviera un hermano completado del mismo combo (mes+dirección+tipo), sin verificar
   que ese hermano **cubriera el periodo** — un job completado el jul 2 no cubre CFDIs del jul 3–8,
   pero igual causaba que se borraran los reintentos.

### Los 4 fixes (commit `45b67a4c`, revisado con code review de 8 hallazgos)

1. **Metadata fallback desde XML** — el worker, al parsear un XML cuyo UUID no tiene fila de
   metadata, la **crea desde el XML** (el XML es el CFDI autoritativo: trae UUID, RFCs, nombres,
   total, fecha, tipo, timbre). UUID normalizado a MAYÚSCULAS para que el sync real de metadata
   haga upsert sobre la misma fila (sin duplicados). Emite la alerta `new_cfdi` ahí mismo. El
   parser (`sat-xml-parser.ts`) ganó extracción de Fecha/TipoDeComprobante/Emisor/Receptor/Timbre.
   → **La flakiness del endpoint de metadata del SAT ya no es single point of failure.**
2. **5004-vacío benigno** — `estado=5 + codSol=5004 + 0 CFDIs` completa el job con 0 resultados en
   vez de fallarlo, **solo para el mes en curso** (un mes pasado reportado vacío podría ser error
   transitorio del SAT y quedaría marcado como sincronizado para siempre; esos siguen fallando →
   reintentables).
3. **Guard de cobertura en huérfanos** — helper `hasCoveringCompletedSibling()`: un hermano
   completado solo "cubre" si su `dateTo` llega al fin esperado del periodo. Aplicado en los 4
   sitios vivos del backfill (retryFailed, create path, progreso GET, countRealFailures).
4. **Botón "Sync mes actual"** — sync manual on-demand del mes en curso (metadata+XML, ambas
   direcciones) en el dashboard; antes la única vía era esperar al auto-sync de las 6 AM.

### Riesgo aceptado (futuro)

Las filas de fallback nacen con `satStatus='Vigente'`. Un CFDI **emitido** y luego cancelado (las
solicitudes XML de emitidos no filtran por estado) podría auto-registrarse al ledger como ingreso
hasta que un sync de metadata corrija el estatus. Es la misma clase de exposición que cualquier
cancelación posterior a un sync; el fix real es que el ledger reaccione a cambios de `satStatus`
(pendiente).

## Relevancia para el Agente Facturas

- **Fuente de datos dual**: para responder "¿cuánto facturé este mes?" el agente debe considerar
  `sat_cfdi_metadata`/`sat_cfdi_details` (todo el RFC) y no solo `cfdis_emitted` (Facturama).
- **Frescura**: los datos del mes en curso dependen de syncs que pueden fallar por flakiness del
  SAT. El agente puede detectar staleness (jobs fallidos recientes en `sat_sync_jobs`) y sugerir
  el botón "Sync mes actual" — o eventualmente disparar un sync vía `POST /api/sat-descarga/sync`.
- **Estatus de cancelación**: solo el sync de metadata lo actualiza. Una fila creada por fallback
  puede estar desactualizada respecto a cancelaciones hasta el siguiente sync de metadata exitoso.
- **Puente al ledger**: los CFDIs vigentes I/E ya se registran solos al flujo de dinero; el agente
  no debe duplicar ese registro, solo consultarlo (`ledger_entries` vía UUID/booking).
