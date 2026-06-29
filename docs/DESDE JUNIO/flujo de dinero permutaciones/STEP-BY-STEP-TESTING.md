# Step-by-step testing — base del ciclo de pruebas (Flujo de Dinero ↔ SAT-descarga)

> **Qué es esto.** El procedimiento base, **verificado contra el código y validado en vivo**
> (2026-06-28), para probar el ciclo *borrar un movimiento → regenerarlo desde SAT-descarga*. Es el
> punto de partida del testing de todas las permutaciones de [`01`](01-permutaciones-de-prueba.md).
>
> Lee primero [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) y [`00-modelo-consolidado.md`](00-modelo-consolidado.md).

---

## 1. Hallazgo central (validado en vivo)

**La columna "Registro" de SAT-descarga NO es un flag guardado. Se calcula en vivo** según si existe
un `LedgerEntry` que apunte al CFDI. Por eso, borrar el movimiento en Flujo de Dinero **lo regresa a
"Registrar" (pendiente)** — no se queda "Registrado".

### La conexión es unidireccional (y eso es lo que nos salva)

```
LedgerEntry.satCfdiUuid  ──apunta a──►  SatCfdiMetadata.uuid
   (el movimiento)                        (la fila del SAT — 734 CFDIs)
```

- `SatCfdiMetadata` **no** tiene back-pointer ni booleano "registrado". Nada en la fila del SAT
  recuerda que se registró.
- El frontend llena "Registro" con una **consulta viva**:
  `GET /api/sat-descarga/register-to-ledger?uuids=...` devuelve qué UUIDs **tienen un LedgerEntry
  ahora mismo** (`register-to-ledger/route.ts:264`). "Registrado" = "existe una fila del ledger con
  este `satCfdiUuid` en este momento."
- Borrar esa fila del ledger → el puntero desaparece → la consulta deja de devolverla → la columna
  muestra **"Registrar"** otra vez.
- Borrar el movimiento **no toca el CFDI** (no hay FK de regreso): el XML/metadata **sobreviven**
  (misma propiedad del reset de [`00`](00-modelo-consolidado.md) §9).

> **Caveat de UI (no es bug de datos).** El `registeredMap` del frontend es **merge-only**
> (`page.tsx:691`): nunca elimina llaves. Si borras el movimiento en otra pestaña con la página SAT
> ya abierta, la fila **sigue viéndose "Registrado"** hasta que **recargues** la página SAT (al
> recargar, el mapa nace vacío y vuelve a consultar). La verdad en BD es correcta al instante; solo
> el estado en memoria queda stale.

---

## 2. Opciones para regenerar — cuál usar

| Botón | Qué llama | Efecto | ¿Usar para el test? |
|---|---|---|---|
| **Registrar pendientes** | `POST /backfill-ledger` → `autoRegisterCfdisToLedger` (TODOS los CFDIs sin vincular) | Re-crea **todos** los movimientos faltantes en bloque. Auto-vincula a una `cita` que coincida (>=0.67), si no crea `sat_emitido`/`sat_recibido`. | Sí — regenerar en bloque. |
| Por fila: **"Registrar"** | `POST /register-to-ledger` con ese UUID | Regenera solo ese. Si hay match abre **modal de sugerencia** (confirmas el vínculo) en vez de auto-crear. | Sí — mejor para probar una fila puntual. |
| **Auto-sync ON** | cron `sat-sync-worker` corre `autoRegisterCfdisToLedger(doctorId, **job.id**)` tras cada sync | ⚠️ **NO re-registra un movimiento borrado.** El cron está **acotado al `syncJobId`** de esa corrida (`sat-auto-register.ts:176-178`) → solo procesa CFDIs **nuevos** de ese sync. Un CFDI ya descargado en un sync viejo nunca vuelve a entrar en un `job.id` nuevo (no se re-descarga), así que el cron **no lo retoma**. Se queda "Registrar/pendiente" indefinidamente. | **No.** Solo auto-registra facturas **nuevas** que aparecen por primera vez en el SAT. |
| **Reiniciar** | `DELETE /backfill` | **Borra TODOS los datos SAT** — los 734 CFDIs + 729 XML + pagos + alertas + sync jobs — y re-descarga desde el SAT de cero (`backfill/route.ts:689-703`). **No** toca el ledger. | **No.** Opción nuclear y no relacionada. Nunca para un test de borrado del ledger. |

---

## 3. Loop de prueba — un solo movimiento (validado)

1. En **Flujo de Dinero**, borra un movimiento de origen SAT (`sat_emitido`/`sat_recibido`, o una
   `cita` con CFDI vinculado).
2. **Recarga** la página **SAT-descarga** → confirma que ese CFDI ahora muestra **"Registrar"**
   (prueba de que el estado es derivado, no pegado).
3. Click en **"Registrar"** de esa fila (o **"Registrar pendientes"** para bloque) → el movimiento
   se regenera.
4. **Recarga** otra vez → vuelve a **"Registrado"**.

> **Esperado:** el CFDI nunca se pierde; el movimiento se puede borrar y regenerar las veces que
> haga falta. Esto habilita probar permutaciones de [`01`](01-permutaciones-de-prueba.md) de forma
> repetible sin re-descargar del SAT.

---

## 4. Antes de testear: distinguir los 734 vs. los 6 emitidos

- **Los 734 CFDIs descargados del SAT** → el loop de arriba aplica tal cual.
- **Las 6 facturas emitidas por el sistema** (`CfdiEmitted`) tienen un back-link
  `CfdiEmitted.ledgerEntryId` que se pone **`SetNull`** al borrar, y tienen **0 overlap** con
  `sat_cfdi_metadata` (ver [`02`](02-registro-facturas-y-match-determinista.md) §3 y §6 / datos prod
  en [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md)). Para esas 6 el camino de regeneración es distinto
  — **no** las uses como caso base hasta resolver el punto de 0 overlap.

---

## 5. GAP detectado + FIX: registro de CFDI antes del XML (datos pobres)

> Detectado y validado en vivo 2026-06-28 con dos CFDIs de GANADEROS PRODUCTORES DE LECHE PURA.

### Síntoma
Un entry `sat_recibido` auto-registrado mostraba **concepto genérico** ("CFDI recibido de
GANADEROS…") y **forma de pago "transferencia"**. Al **borrarlo y re-registrarlo**, el nuevo entry
salía con el **concepto real** ("L SELECTA U.EDGE 1L CHEP, …") — es decir, el re-registro daba
**mejores** datos que el auto-registro original.

### Causa raíz (un solo bug, tres síntomas)
La forma de pago, el método de pago y el concepto-por-conceptos viven **solo en el XML**
(`SatCfdiDetail`), **no** en `SatCfdiMetadata` (los 734). El auto-registro corre en la etapa de
**metadata** (`sat-sync-worker:493`), **antes** de descargar el XML:

- sin `detail` → **concepto genérico** + **forma default** + sin `metodoPago`.
- cuando el XML llega y el auto-registro corre otra vez (`:674`), el UUID ya está vinculado →
  el filtro `alreadyLinked` (`sat-auto-register.ts`) lo **saltaba** → **nunca se enriquecía**.

Por eso el resultado era **no determinista**: dependía de *cuándo* se registró, no del CFDI. Mismo
origen que el bug de **forma de pago** (mapa incompleto: códigos fuera de `{01,02,03,04,06,28}` —
sobre todo **`99` Por definir** — caían a `'transferencia'`).

### Fix aplicado (en la ruta tolerante `sat-auto-register.ts` — zona segura)
1. **Enrich-on-XML:** el auto-registro ahora, además de crear/vincular, **re-enriquece** los entries
   `sat_emitido`/`sat_recibido` ya vinculados cuyo concepto sigue siendo el **placeholder genérico**:
   les pone el concepto real (por conceptos) y la forma de pago derivada del XML. Idempotente y
   acotado (no toca entries de `cita`/manual ni concept editados).
2. **Mapa de forma ampliado + fallback honesto:** `mapFormaPago()` cubre más códigos SAT y devuelve
   **`null`** (UI muestra "—") en vez de enmascarar `99`/desconocidos como `'transferencia'`.

> **Gap #1 (PUE/PPD) — CERRADO (jun 2026, A+B):**
> - **Parte A:** `resolvePaymentStatus()` deriva el estado de `metodoPago`; un CFDI **emitido PPD**
>   nace **PENDING** (antes PAID) y el back-enrich corrige los ya creados. Sin columna nueva (lee
>   `SatCfdiDetail.metodoPago`).
> - **Parte B:** `reconcilePpdToLedger()` propaga los complementos (`SatPago`) al ledger por
>   `satCfdiUuid == facturaUuid` (case-insensitive), **upgrade-only** (PENDING→PARTIAL→PAID). Corre
>   tras cada sync XML (acotado a las facturas pagadas en el job) y en el backfill (catch-up). Reusa
>   `computePpdStatus()`, la misma lógica del tab PPD/Pagos de SAT-descarga.
>
> **Cómo verificar Part B:** un PPD emitido (nace PENDING) cuyo complemento ya se descargó → corre
> **Registrar pendientes** → el entry pasa a **PARTIAL/PAID** según el `saldoInsoluto`. Ver
> [`00`](00-modelo-consolidado.md) §3 y §8.1.

### Cómo verificar el fix
1. Toma un `sat_recibido` con concepto genérico (creado pre-fix) → corre **"Registrar pendientes"**
   (backfill) → el concepto y la forma se **enriquecen in situ** (sin borrar/re-crear).
2. Borrar + re-registrar y auto-registrar deben dar **el mismo** resultado (determinismo).

### UI relacionada (tabla Flujo de Dinero)
Las columnas **Paciente** (solo `ingreso`) y **Proveedor** (solo `egreso`) muestran ahora
**nombre/razón social + RFC** de la contraparte: usan `client/supplier.businessName` o, en su defecto,
`counterpartyName` denormalizado, con `counterpartyRfc` debajo. Cambio solo de frontend
(`apps/doctor/.../flujo-de-dinero/_components/LedgerTable.tsx` + `ledger-types.ts`); el endpoint del
ledger ya devolvía estos campos.

---

## 6. Referencias de código (verificar líneas antes de afirmar — se desfasan)

- Estado "Registrado" (consulta viva): `apps/api/src/app/api/sat-descarga/register-to-ledger/route.ts:264` (GET).
- Frontend columna Registro + `checkRegistered`: `apps/doctor/src/app/dashboard/sat-descarga/page.tsx:685` y `:1281`.
- `registeredMap` merge-only: `page.tsx:691`.
- "Registrar pendientes": `page.tsx:417` → `POST /backfill-ledger` → `apps/api/src/lib/sat-auto-register.ts:166`.
- "Reiniciar" (DESTRUCTIVO): `page.tsx:437` → `DELETE /api/sat-descarga/backfill` → `backfill/route.ts:663` (borra detail/metadata/pago/alert/syncJob).

---

## 7. Estado de pruebas — baseline de EGRESOS (verificado en prod, 2026-06-28)

> **Método de verificación (lo que SÍ se puede automatizar).** El LLM **no** puede manejar la UI de
> prod ni escribir a prod. **Sí** puede verificar resultados con consultas **solo lectura** a la BD de
> Railway (ver [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md):
> `railway run --service pgvector node script.cjs`, `DATABASE_PUBLIC_URL`, solo `SELECT`).
> Flujo: el usuario hace la acción en la UI → el LLM consulta prod y **asevera** el estado del entry.

### Doctor de prueba
- **`dr-prueba`** = *Dr. Gerardo Lopez Fafutis* (las facturas son a *DIEGO PABLO LOPEZ FAFUTIS*,
  RFC `LOFD9406276F8`). **doctor_id = `cmni1bov90000mk0lyeztr3ad`**. Tiene **734 CFDIs** y
  **653 ledger entries** (es el único con datos SAT; los demás doctores tienen 0 CFDIs).

### Baseline de egresos (346 entries, todos reales)
- **Cobertura por origen:** **100% `sat_recibido`** (Bloque H). **`manual`=0, `banco`=0, `compra`=0,
  `comision`=0** → **Bloques I, J, K SIN cobertura**: hay que **crearlos** en la UI para probarlos.
- **Evidencia:** los 346 están **🧾✓ 🏦✗** (facturado, sin banco). **Ningún egreso tiene evidencia
  bancaria** → Bloque K (conciliación) nunca ejercitado; **ningún egreso llegó a Completo**.
- **Contraparte:** **346/346** con `counterpartyRfc`+`counterpartyName` ✅ (fix de hoy; la columna
  Proveedor muestra para todos).
- **Dedup:** **0 `satCfdiUuid` duplicados** ✅.

### EXP-H4 (PUE/PPD) — validado contra complementos reales ✅
Comparando el `paymentStatus` de cada factura PPD recibida vs lo que dicen sus complementos
(`computePpdStatus`, excluyendo cancelados):

| esperado (complementos) | real (ledger) | n | veredicto |
|---|---|---|---|
| PAID | PAID | 43 | ✅ |
| PENDING | PENDING | 6 | ✅ (sin complemento aún) |
| PARTIAL | PARTIAL | 1 | ✅ |
| PARTIAL | PAID | 1 | ✅ ok (marca manual; upgrade-only la respetó) |

**`UNDER-RECONCILED (bug) = 0`** — ningún PPD quedó atrás de sus complementos. Además **295 PUE → todas
PENDING** (estado de nacimiento correcto para recibidas). Parts A+B se comportan correctamente en prod.

### Resultados de pruebas de egresos (2026-06-28/29)
- **EXP-I1 ✅** — gasto manual efectivo (`EGR-2026-348`, $700): `origin=manual`, PAID, 🧾✗ 🏦✗, forma=efectivo.
  (Contraparte queda null si no se captura — esperado para manual.)
- **EXP-J4 ✅** — factura recibida (`EGR-2026-001`, GANADEROS $1,039.68) → subir CSV BBVA con el retiro
  → **confirmar** el auto-match (0.85) → entry pasa a **🧾✓ 🏦✓ PAID = Completo** (primer egreso en
  Completo). ⚠️ **Sutileza:** el upload deja el match en `matched_auto` (sugerencia); la enrichment
  (PAID/comprobante) **solo** ocurre al **Confirmar** (`confirm_match`/`link_existing`), no en el upload.
- **EXP-F13 ⚠️→✅ (reproducido y CORREGIDO)** — al **`unmatch`** un match confirmado, el movimiento
  volvía a `unmatched` pero el entry **conservaba** PAID + `hasComprobante` (la asimetría de §7). Se
  observó en vivo (confirmar mov 51 → enriquece 881 → unmatch → 881 sigue PAID sin línea bancaria).
  **Fix (snapshot-restore):** al enriquecer (`confirm_match`/`link_existing`/`link_settlement`) se
  guarda el estado previo del entry en `bankMovement.matchHistory`; al `unmatch`/`unlink_settlement`
  se **restaura** ese estado. Sin adivinar (no pisa marca manual, complemento PPD ni comprobante
  manual). Edge: un complemento PPD que llegó entre confirmar y deshacer se re-afirma en el siguiente
  reconcile (upgrade-only). *Verificar en vivo tras el redeploy de `apps/api`.*

### Próximos casos a probar (los de cobertura cero)
1. **EXP-I1** (manual efectivo sin factura) — el más simple, origen `manual`.
2. **EXP-J1 / J4** — egreso desde banco y, sobre todo, **llegar a Completo** (factura + retiro
   conciliado): hoy ningún egreso lo ha logrado. Requiere subir un estado de cuenta.
3. **EXP-K1–K4** — conciliación bancaria de egresos (match 1:1, tipo cruzado, liquidación N:1,
   exclusión de `comision`).

Scripts de verificación usados (scratchpad, solo lectura): `egreso-baseline.cjs`, `ppd-validate.cjs`
(consultan `ledger_entries`, `sat_cfdi_metadata`, `sat_cfdi_details`, `sat_pagos` por `doctor_id`).

---

*Estado:* base de pruebas + baseline de egresos, verificado en prod 2026-06-28. Siguiente paso:
ejercitar Bloques I/J/K de egresos (cobertura cero) — empezar por EXP-I1, y EXP-J4 para llegar a
Completo. Ver [`01-permutaciones-de-prueba.md`](01-permutaciones-de-prueba.md).
