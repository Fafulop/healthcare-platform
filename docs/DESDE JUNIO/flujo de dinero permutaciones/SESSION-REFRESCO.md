# 🔄 Refresco de sesión — LÉEME PRIMERO cada sesión

> Snapshot del estado, decisiones y próximos pasos del trabajo en **Flujo de Dinero**. Para una
> sesión/LLM en frío: lee **este** archivo, luego el [`README.md`](README.md) (índice) y de ahí los
> numerados. Última actualización: **2026-06-27**.

---

## En una frase

Estamos **re-entendiendo y endureciendo** el núcleo de *Flujo de Dinero*: una **sola fuente de verdad**
(`LedgerEntry`) para todos los ingresos/egresos del doctor, que agrega automáticamente las 3 puertas
por las que entra el dinero (**cita/operación, factura del SAT, banco**) **sin duplicar** el mismo
hecho económico, y lo proyecta al expediente del paciente.

## Modelo mental (5 puntos)

1. **Una tabla = la verdad:** `LedgerEntry` (`practice_management.ledger_entries`). Todo lo demás se
   *adjunta*.
2. **Dos evidencias por entry:** 🧾 fiscal (`hasFactura`/`satCfdiUuid`) y 🏦 bancaria
   (relación `bankMovement`/`settlementItem`; `hasComprobante` es un flag más débil). Meta = ambas.
3. **Tres puertas (`origin`):** operación (`cita`/`venta`/`compra`/`webhook_pago`/`manual`),
   factura SAT (`sat_emitido`/`sat_recibido`), banco (`banco`). Interno: `comision`.
4. **Dedup = match-before-create** en 2 motores: Motor 2 (CFDI↔entry, `scoreCfdiMatch`) y Motor 3
   (banco↔entry, `matchMovements`). + un guard preventivo en el POST manual.
5. **PUE = pagado; PPD = se paga después** (vía complemento tipo P). Hoy el sistema **no** respeta
   esto (gap #1).

---

## Estado: qué está hecho vs. qué falta

**Construido y verificado contra el código:**
- Tabla única + 2 ejes de evidencia; dedup Motor 2 (CFDI) y Motor 3 (banco); SAT descarga como fuente
  de facturas; liquidación N:1; auditoría de matches.
- **El match probabilístico CFDI YA EXISTE y funciona** (Motor 2). Para el 99% (paciente real + PUE)
  el round-trip emitir→descargar auto-vincula con confianza ~1.0 (RFC denormalizado en la cita).

**Gaps conocidos (prioridad):**
1. **PPD/PUE no respetado (ALTA):** CFDIs emitidos se marcan `PAID` sin condición; complementos
   (`SatPago`) no actualizan el `paymentStatus`. "Factura ≠ dinero movido" está roto para PPD.
2. Matcher bancario (Motor 3) **ignora** `counterpartyName/Rfc` → mismo monto + mismo nombre, días
   distintos = "Sin match".
3. Sin reverse matching; agregación de payouts de pasarela; sin agente Motor 4.
4. Emisión de factura: `ledgerEntryId` **opcional** → CFDIs huérfanos (standalone).

---

## DECISIONES de esta sesión (no re-litigar)

- ✅ **Enfoque de match = PROBABILÍSTICO (ahora).** El **determinista por UUID se DIFIERE**: no se puede
  probar hoy (0 overlap, ver abajo). El probabilístico ya existe y es altamente certero → **no hay que
  construir nada** para el flujo del 99%. Detalle en `02` §4.1.
- ✅ **NO tocar el endpoint de emisión** (`facturacion/cfdi`). Es ruta de facturación (dinero/legal),
  va directo a prod sin pruebas, y `satCfdiUuid` es `@unique` → un fallo rompe la emisión tras timbrar.
  (Por esto se **rechazó** un edit a emisión antes.)
- ✅ Si algún día se hace el determinista: en el camino **tolerante** (`sat-auto-register.ts`), con
  **fallback** al match difuso, y comparación **case-insensitive** (obligatorio, ver dato verificado).
- ✅ **Modelo de anclas** (`03`) es el blueprint de diseño a futuro (sin construir). Captura fiscal
  temprana (RFC + Constancia) **no requiere esquema nuevo** — los campos ya existen en `Patient`.

---

## Datos verificados en PRODUCCIÓN (Railway, solo lectura, 2026-06-27)

- `cfdis_emitted.uuid` = **minúsculas**; `sat_cfdi_metadata.uuid` = **MAYÚSCULAS** → cualquier match
  por UUID **debe** ser case-insensitive (si no, nunca empata).
- Conteos: `cfdis_emitted` = **6** (montos de prueba, p.ej. $0.90, $650); `sat_cfdi_metadata` = **734**
  (casi todas emitidas fuera de este sistema).
- **0 overlap:** las 6 facturas del sistema **no** están en `sat_cfdi_metadata` aún → el round-trip
  emit→descarga **no se puede observar todavía** (¿modo prueba del PAC? ¿sync pendiente?). **Confirmar
  esto antes de probar cualquier match de round-trip.**

> Cómo se accedió a prod: ver [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md)
> (`railway run --service pgvector node script.cjs`, usando `DATABASE_PUBLIC_URL`, solo `SELECT`).
> ⚠️ El `DATABASE_URL` del repo apunta a una BD local **vacía** — no es prod.

---

## Cómo probar (cuando se retome) — "como doctor nuevo"

1. Wipe del ledger (UI bulk-delete por página, o SQL en Railway). **Las facturas sobreviven** (tablas
   independientes). SQL y blast-radius en `00` §9.
2. ⚠️ El wipe **anula** `CfdiEmitted.ledgerEntryId` (SetNull) → el match por back-link no aplica justo
   tras el reset (esperado).
3. Recrear citas → **luego** Backfill SAT (auto) o "Registrar pendientes" (manual). **Orden importa:**
   citas ANTES del backfill o salen duplicados (no hay reverse matching).
4. Recorrer el checklist de `01` (todas las permutaciones de ingreso/egreso).

---

## Qué NO hacer

- ❌ No editar el endpoint de emisión a ciegas (riesgo prod/legal).
- ❌ No construir el determinista todavía (no hay cómo probarlo).
- ❌ No confiar en los números de línea citados sin verificar contra el código actual (se desfasan).
- ❌ No confundir "Registrar pendientes" (registrar una **factura**) con "Nuevo Movimiento" (captura
  manual sin factura) — son features distintas (`02` §1).

---

## Próximo paso sugerido

Cuando el usuario vuelva: **probar las permutaciones de `01` contra prod** (tras el reset de `00` §9),
empezando por confirmar el punto de **0 overlap** (¿por qué las 6 emitidas no están en el SAT?). Si se
prioriza correctitud, el **gap #1 (PPD/PUE)** es el de mayor impacto.

---

*Mantener este archivo actualizado al final de cada sesión.* Índice completo: [`README.md`](README.md).
</content>
