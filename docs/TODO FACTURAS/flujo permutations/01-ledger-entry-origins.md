# Motor 1 — Nacimiento de un `LedgerEntry` (orígenes)

Todo en Flujo de Dinero converge en `LedgerEntry`. Un entry nace por **uno** de estos
orígenes (`origin`). El origen determina qué evidencia trae de fábrica (fiscal / bancaria)
y, por tanto, qué le falta conciliar después.

Leyenda evidencia inicial: 🧾 = `hasFactura` (CFDI) · 🏦 = `hasComprobante` (banco).

| `origin` | Quién lo crea | entryType | paymentStatus inicial | 🧾 | 🏦 | counterpartyRfc/Name | Notas |
|---|---|---|---|:--:|:--:|---|---|
| **`cita`** | `completeBooking` (app doctor) al completar una cita | `ingreso` | según cobro | ✗ | ✗ | **Depende** del expediente vinculado — ver [`05`](05-appointment-rfc-gap.md) | **La fuente principal de ingresos.** El RFC denormalizado es lo que hace que el matcher CFDI funcione (Gap 1), **pero solo llega si la cita está vinculada a un expediente con RFC**. |
| **`sat_emitido`** | Motor 2, al registrar un CFDI **emitido** sin match | `ingreso` | `PAID` | ✓ | ✗ | Sí (receptor del CFDI) | Factura emitida que no encontró entry previo → se vuelve su propio entry. |
| **`sat_recibido`** | Motor 2, al registrar un CFDI **recibido** sin match | `egreso` | `PENDING` | ✓ | ✗ | Sí (emisor del CFDI) | Crea/asocia `Proveedor` por RFC. |
| **`banco`** | Motor 3, acción `create_entry` desde una línea bancaria | según depósito/retiro | `PAID` | ✗ | ✓ | ✗ | Nace ya conciliado con banco; le falta la factura. |
| **`comision`** | Motor 3, comisión implícita de una liquidación | `egreso` | `PAID` | ✗ | ✓ | ✗ | **Excluido de todos los pools de match bancario** para que no se empareje con un retiro futuro. |
| **`venta`** | Módulo Ventas | `ingreso` | según venta | ✗ | ✗ | depende | Venta directa / desde cotización. |
| **`compra`** | Módulo Compras | `egreso` | según compra | ✗ | ✗ | depende | |
| **`webhook_pago`** | Webhook de pasarela (MercadoPago, etc.) | `ingreso` | `PAID` | ✗ | ✗ | depende | Pago en línea confirmado por la pasarela. |
| **manual** | Alta manual en la tabla Flujo de Dinero | cualquiera | manual | ✗ | ✗ | opcional | El usuario captura todo. |

---

## Permutaciones de "qué le falta a un entry"

Estado de un entry = combinación de las **dos evidencias** independientes:

| 🧾 hasFactura | 🏦 hasComprobante | Significado | Acción típica |
|:--:|:--:|---|---|
| ✗ | ✗ | Solo registrado (p.ej. `cita` recién creada) | Buscar CFDI (motor 2) **y** conciliar banco (motor 3). |
| ✓ | ✗ | Tiene factura, falta el dinero en banco | Conciliar contra el estado de cuenta. |
| ✗ | ✓ | Tiene el dinero, falta la factura | Buscar/vincular CFDI. |
| ✓ | ✓ | **Completo** | Nada — meta alcanzada. |

> **Regla clave de duplicados.** El error que estos motores evitan: que la *misma* operación
> económica genere **dos** entries (uno por `cita` y otro por `sat_emitido`, o uno por `cita`
> y otro por `banco`). Por eso ambos motores hacen **match-before-create**: antes de crear,
> buscan un entry existente que represente la misma operación y se vinculan a él.

## Orden recomendado para que el match funcione
1. **Primero** nacen los entries "de operación": `cita`, `venta`, `compra`, `webhook_pago`,
   manual. Estos traen la identidad de la contraparte (RFC/nombre) pero **sin** factura ni banco.
2. **Después** llega el CFDI (motor 2) y se **vincula** a ese entry en vez de duplicarlo.
3. **Al final** llega la línea bancaria (motor 3) y aporta la evidencia 🏦.

Si se invierte el orden (registrar CFDIs primero, con el ledger vacío), cada CFDI nace como
`sat_emitido`/`sat_recibido` por su cuenta — válido para un doctor nuevo sin historial, pero
**no** ejercita el match `cita → CFDI`.

→ Continúa en [`02-cfdi-matching.md`](02-cfdi-matching.md).
</content>
