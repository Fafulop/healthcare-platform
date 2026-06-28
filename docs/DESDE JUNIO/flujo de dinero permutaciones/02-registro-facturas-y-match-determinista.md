# Registro de facturas (auto vs manual) + plan de match determinista

> **Propósito.** Entender **antes de construir** cómo entran las facturas al Flujo de Dinero (los dos
> caminos de registro), cómo se relacionan con el **reset de pruebas** (`00` §9), y dejar **parqueado**
> el plan del *match determinista por UUID* con sus gaps y decisiones. **Nada de esto está construido
> aún** — es para cuando empecemos a probar y a implementar.
>
> Lee también: `00` (modelo), `01` (permutaciones de prueba), `03` (arquitectura de anclas).

---

## 1. Los dos caminos para registrar una factura en el ledger

Ambos toman una **factura descargada del SAT** y la convierten en (o la vinculan a) un `LedgerEntry`.
La diferencia es **quién dispara** y **qué tan agresivo** es:

> ⚠️ **Nombres de botón (verificado en código):** el botón **"Registrar pendientes"** dispara el
> camino **Auto** (`POST /backfill-ledger` → `autoRegisterCfdisToLedger`), **no** el manual. El camino
> **Manual** es el botón **"Registrar"** por fila (`POST /register-to-ledger`).

| | **Auto** (botón "Registrar pendientes" + cron) | **Manual** (botón "Registrar" por fila) |
|---|---|---|
| Quién dispara | El sistema — corre tras cada sync del SAT (cron) + botón **"Registrar pendientes"** (`backfill-ledger`) | El doctor — botón **"Registrar"** por fila en el panel SAT |
| Alcance | **Todas** las facturas Vigentes sin vincular, de una | **Solo las que el doctor elige** |
| Comportamiento | **Auto-vincula** si confía (≥0.67), vincula+marca revisión (0.50–0.66), o crea | **Nunca auto-vincula** — si hay candidato fuerte muestra **sugerencia** a confirmar; si no, crea |
| Código | `autoRegisterCfdisToLedger` (`sat-auto-register.ts`), `backfill-ledger` | `register-to-ledger` |

**Resumen:** auto = bulk sin manos; manual = selectivo, con humano en el loop.

### ¿Por qué existe el manual si ya hay auto?
Es **más viejo** — era la forma original antes de que existiera el auto-registro. Hoy se traslapan.
El manual sobrevive para: (a) **revisar antes de vincular** en vez de confiar en el score,
(b) **elegir** facturas específicas, (c) manejar a propósito los casos inciertos. Para el caso común,
el auto lo vuelve **mayormente redundante** → candidato a **simplificar** más adelante (no urgente).

### ⚠️ No confundir dos cosas distintas
- **"Registrar pendientes" / "Registrar" (panel SAT)** = registrar una **factura** del SAT al ledger
  (este doc; "Registrar pendientes"=Auto/bulk, "Registrar" por fila=Manual).
- **"Nuevo Movimiento" (manual)** = capturar un ingreso/egreso **a mano, sin factura**
  (`origin=manual`: efectivo, renta, etc.). **Esencial**, no redundante. Es otra cosa.

---

## 2. Relación con el reset de pruebas

El plan de prueba "como doctor nuevo" (`00` §9): borrar el ledger, **conservar facturas**, reconstruir.
Estos dos caminos de registro **son la superficie de prueba** para rehacer las entries de factura:

1. Wipe del ledger (UI o SQL) — las facturas (`CfdiEmitted`, `SatCfdiMetadata`) sobreviven.
2. Recrear citas/operación.
3. **Probar AUTO** → botón **"Registrar pendientes"** (o esperar el cron) → procesa todas las facturas.
4. **Probar MANUAL** → botón **"Registrar"** por fila sobre CFDIs seleccionados.
5. Verificar el estado final de cada entry (🧾/🏦, dedup, sin duplicados).

> Esto es justo lo que se quiere validar: que ambos caminos reconstruyan correctamente y **sin
> duplicar** contra las citas recreadas.

---

## 3. ⚠️ Interacción crítica: el reset anula el back-link

Al borrar `LedgerEntry`, la relación `CfdiEmitted.ledgerEntryId` es **`onDelete: SetNull`** → tras un
wipe, **todos los `CfdiEmitted.ledgerEntryId` quedan en `null`**.

Consecuencias para la prueba:
- Las facturas **siguen** en "Mis Facturas" (`CfdiEmitted` intacto), pero **ya no saben** a qué entry
  pertenecían.
- Al rehacer (auto/backfill) con el ledger vacío, las facturas **público-en-general** (sin paciente)
  se vuelven `sat_emitido` standalone — **correcto** (son ingresos standalone).
- El **match determinista por back-link NO puede dispararse** justo después de un reset (el back-link
  es null). Eso es esperable.

**Cómo probar entonces el match determinista de verdad:** hacer un **ciclo fresco**, no depender de
facturas viejas:
1. Recrear la cita → crea entry.
2. **Emitir** una factura **desde esa cita** (set `CfdiEmitted.ledgerEntryId` al entry nuevo).
3. Descargar del SAT esa misma factura → debe **vincularse determinísticamente** a la cita.

> Es decir: el match determinista es para el **flujo hacia adelante** (emites hoy → descargas en días),
> **no** para re-materializar facturas viejas tras un wipe. Tenerlo claro evita conclusiones falsas
> ("no concilió") cuando en realidad el back-link fue anulado por el reset.

---

## 4. Match determinista por UUID — **DIFERIDO** (referencia futura)

> 🟦 **DECISIÓN (jun 2026): el determinista se difiere.** No se puede **probar** hoy: las 6 facturas
> emitidas por el sistema **no aparecen** aún en `sat_cfdi_metadata` (0 overlap, §6), así que no hay
> round-trip real que validar. **El enfoque elegido AHORA es el PROBABILÍSTICO** (Motor 2 existente,
> `scoreCfdiMatch`), que para el 99% (paciente real + PUE) ya da **altísima certeza**. Cuando exista
> overlap real y se valide, se puede migrar al determinista. **Esta sección queda como blueprint.**

Objetivo (futuro): que cuando el SAT descargue una factura que **nosotros emitimos**, se vincule a su
entry de forma **determinista (por UUID)**, no por el scoring difuso — y **sin duplicar**.

### Decisión de ubicación (seguridad)
**NO tocar el endpoint de emisión** (`facturacion/cfdi`). Es la ruta de facturación (dinero/legal),
va directo a producción sin pruebas, y `satCfdiUuid` es `@unique` (un fallo ahí rompe la emisión tras
timbrar en el SAT). En su lugar, hacer el match en el **camino tolerante** de auto-registro
(`sat-auto-register.ts`), que es re-ejecutable y donde un bug degrada a "duplicado recuperable", no a
"factura rota".

### Diseño con fallback (peor caso = comportamiento actual)
En `processOneCfdi`, **antes** del match difuso, un fast-path **opcional**:

```
si cfdi.direction == 'emitted':
  try:
     emitted = buscar CfdiEmitted por uuid (case-insensitive), status 'active'
     si emitted?.ledgerEntryId:
        target = LedgerEntry id=ledgerEntryId AND doctorId=esteDoctor   # guard de doctor
        si target Y (target.satCfdiUuid es null O == cfdi.uuid):        # guard anti-clobber
           update target: satCfdiUuid=cfdi.uuid (case SAT), hasFactura=true, confidence=1.0
           return auto_linked   # match determinista
  except: log + continuar   # nunca rompe el batch
# si no se vinculó determinísticamente:
... match difuso ACTUAL, sin cambios ...
```

### Gaps encontrados al re-analizar (y cómo se manejan)
1. **Case del UUID — ✅ VERIFICADO en producción (jun 2026):** los dos lados usan **case distinto**,
   así que un match por igualdad exacta **fallaría siempre**:
   - `cfdis_emitted.uuid` (emisión, vía Facturama): **minúsculas** — ej. `56d79d87-3fbb-4fc8-951e-7dcc4196a227`.
   - `sat_cfdi_metadata.uuid` (descarga SAT, `direction=emitted`): **MAYÚSCULAS** — ej. `DBAE1105-DCC4-57AB-BC52-DA28CDDA2185`.
   → El match por UUID **DEBE** ser case-insensitive (normalizar ambos lados al mismo case). Sin esto
   el match determinista **nunca dispara**. (`parseMetadataTxt` guarda el UUID tal cual del archivo
   SAT — que resulta MAYÚSCULAS; la emisión guarda lo de Facturama — minúsculas.)
2. **Back-link null tras reset:** (`SetNull`) → tratar null como "fallback", no error (ver §3).
3. **Clobber:** solo vincular si `target.satCfdiUuid` es null o ya igual → no sobrescribir un link
   distinto.
4. **Dirección:** `CfdiEmitted` solo existe para *emitidas* → gate `direction === 'emitted'`.
5. **Canceladas:** exigir `status='active'` (además del filtro `Vigente` existente).
6. **Transacción:** prevenir errores con guards (no try/catch-después-de-throw, que envenena el tx).
   El filtro `alreadyLinked` ya garantiza que el UUID no está en otro entry → no hay P2002.
7. **Cross-doctor:** `CfdiEmitted` no tiene `doctorId` (solo `fiscalProfileId`) → acotar el target
   por `doctorId`.

### Propiedades de seguridad
- **Peor caso = comportamiento actual.** Sin CfdiEmitted, back-link null, case miss, clobber, doctor
  distinto, o cualquier excepción → cae al match difuso de hoy. Nada regresa.
- Emisión **intacta**; sin nueva superficie de fallo por `@unique`; solo lecturas + un update acotado;
  idempotente (una vez estampado, el filtro de arriba lo salta).

---

## 4.1 Enfoque probabilístico actual (ELEGIDO)

**Buena noticia: ya existe y no hay que construir nada.** Es el Motor 2 (`scoreCfdiMatch`,
`sat-auto-register.ts`): cuando el SAT descarga una factura, busca el entry que la representa por
**monto (40) + fecha (30) + RFC (+30) + nombre (+20)** = máx 120 (conf = raw/120).

### Por qué es "extremadamente certero" para el 99%
El caso típico: **paciente real + PUE**. Al completar la cita, el entry se crea con el **RFC del
paciente denormalizado** (`counterpartyRfc`, `useBookings.ts:250`). El CFDI emitido lleva ese mismo
RFC como receptor. Días después, al descargarlo:
- Monto exacto → **40**
- Mismo día / ±1 → **30**
- **RFC coincide → +30** (la señal que desempata)
- Nombre coincide → **+20**
- **Total 120 → conf 1.00 → auto-link silencioso.**

Es decir, el round-trip "emito hoy → descargo en días → se pega a la cita" **ya funciona** con altísima
certeza, sin código nuevo.

### Casos más débiles (y su red de seguridad)
- **Público en general (XAXX):** el RFC coincide pero **no desempata** (lo comparten todos). Se apoya
  en monto+fecha. Como suelen ser ingresos standalone (sin cita), nacer como `sat_emitido` propio es
  correcto.
- **Monto editado / dos citas idénticas el mismo día / sin RFC:** posible match débil
  (`needsReview`) o duplicado. Red de seguridad: revisión + **popover CFDI** manual + **merge**.

### "Lo mejor que podemos hacer ahora" = usar esto, con tunings opcionales
- **No requiere construir nada** para el flujo del 99%.
- Tunings opcionales (solo si las pruebas muestran fallos): asegurar que las entries **manuales** que
  vayan a facturar lleven `counterpartyRfc`; revisar tolerancias (±1% monto, ±7 días) si hace falta.
- Cuando exista overlap real (round-trip observable) y se valide, **migrar al determinista** (§4) para
  pasar de "altísima certeza" a "100% sin duplicados".

---

## 5. Decisiones (tomadas / pendientes)

| Tema | Decisión | Estado |
|---|---|---|
| **Enfoque de match (AHORA)** | **PROBABILÍSTICO** (Motor 2 existente, `scoreCfdiMatch`). El **determinista se DIFIERE** hasta que haya round-trip real que probar (§4.1). | ✅ Decidido (jun 2026) |
| Dónde haría el match determinista (futuro) | En auto-registro (`sat-auto-register.ts`), **no** en emisión | ✅ Decidido (para cuando aplique) |
| Orden de implementación (futuro) | **Auto primero**; replicar al manual (`register-to-ledger`) después de validarlo | ✅ Decidido (para cuando aplique) |
| Tocar el endpoint de emisión | **No** (riesgo prod) | ✅ Decidido |
| Reparar el back-link | **Sí, recomendado**: al crear/vincular un entry desde una factura propia, set
  `CfdiEmitted.ledgerEntryId`. Es barato, da integridad bidireccional y **restaura el back-link tras
  cada reset** (útil para el ciclo de pruebas). Opcional, en tiempo de build. | 🟡 Recomendado, por confirmar |
| Simplificar el camino manual | Posible (redundante con auto), evaluar después | 🟡 Pendiente |
| Crear entry al emitir standalone (born-linked) | Cambio mayor; fuera de alcance por ahora | 🟡 Pendiente |

---

## 6. Checklist a VERIFICAR durante la prueba (antes de construir encima)

- [x] ✅ **Verificado (jun 2026):** el botón **"Registrar pendientes"** = `backfill-ledger` →
      `autoRegisterCfdisToLedger` (auto/bulk); el botón **"Registrar"** por fila = `register-to-ledger`
      (manual). (El nombre "Registrar pendientes" **no** es el camino manual.)
- [ ] Tras wipe, confirmar que `CfdiEmitted` sobrevive y que su `ledgerEntryId` quedó **null**.
- [ ] Auto sobre ledger vacío: ¿las 6 facturas se vuelven `sat_emitido` standalone? (esperado).
- [ ] Ciclo fresco (cita → emitir → descargar): ¿el back-link queda seteado al emitir? ¿el match
      determinista (cuando se construya) dispararía?
- [ ] Manual (botón **"Registrar"** por fila): ¿sugiere en vez de auto-vincular? ¿respeta `skipMatchUuids`?
- [x] ✅ **Confirmado (prod, jun 2026):** `cfdis_emitted.uuid` = **minúsculas**; `sat_cfdi_metadata.uuid`
      = **MAYÚSCULAS** → match **case-insensitive obligatorio**. (6 emitidas vs 734 en metadata.)
- [ ] ⚠️ **Observación (prod):** las 6 facturas emitidas por el sistema **NO** aparecen aún en
      `sat_cfdi_metadata` (0 overlap). El round-trip emit→descarga no se puede observar con ellas
      todavía — confirmar si fue timbrado en modo prueba o sync pendiente **antes** de probar el match.
- [ ] ¿El camino manual también necesita el match determinista, o basta el auto?

---

*Estado:* notas y plan, junio 2026. **Nada construido.** Decisiones por confirmar al iniciar el build.
Relacionado: `00` §9 (reset), `01` (permutaciones), `03` (anclas y reglas).
</content>
