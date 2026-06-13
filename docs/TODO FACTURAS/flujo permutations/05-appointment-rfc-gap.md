# Permutación / Gap — Identidad fiscal en el entry `cita`

> Sub-mapa del origen `cita` (ver [`01-ledger-entry-origins.md`](01-ledger-entry-origins.md)).
> Documenta **cuánta identidad fiscal lleva un entry de cita** según cómo se creó la cita, porque
> eso determina la fuerza del match CFDI ([motor 2](02-cfdi-matching.md)).

## De dónde sale la identidad (código real)

`completeBooking` (`apps/doctor/src/app/appointments/_hooks/useBookings.ts:249-251`) al completar
una cita arma el `LedgerEntry` así:

```js
patientId:        booking?.patientId || null,
counterpartyRfc:  booking?.patient?.rfc || null,           // SOLO del expediente vinculado
counterpartyName: booking?.patient?.razonSocial || patientName || null,  // razón social, o nombre libre
```

- **RFC** → solo existe si la cita está **vinculada a un expediente** *y* ese expediente tiene
  `rfc` capturado. El RFC es opcional en el paciente.
- **Nombre** → cae en cascada: razón social del expediente → nombre libre de la reserva → null.
- **patientId** → solo si la cita está vinculada a un paciente.

## Las dos formas de crear cita (lo que observa el usuario)

| Forma | ¿Expediente? | ¿RFC probable? |
|---|---|---|
| **Recurrente** | Vinculada a expediente existente | Alta — suele tener nombre y, si pidió factura, RFC. |
| **Nueva / walk-in** | A veces se confirma y cierra **sin crear expediente** | Sin expediente → **sin RFC**; solo el nombre tecleado. |

> Nota importante: **el movimiento (entry `cita`) SÍ se crea siempre**, tenga o no expediente.
> Lo que varía es cuánta identidad fiscal trae.

## Matriz de permutaciones del entry `cita`

| Caso | counterpartyRfc | counterpartyName | Señales disponibles para el match CFDI | Resultado típico |
|---|---|---|---|---|
| **A. Expediente con RFC** | ✓ RFC paciente | ✓ razón social | Monto + Fecha + **RFC** + Nombre | Auto-link fuerte (hasta 1.00). Desempata citas del mismo monto/día. |
| **B. Expediente sin RFC** | ✗ | ✓ razón social | Monto + Fecha + Nombre | Auto-link si nombre+monto+fecha cuadran (p.ej. 90 → 0.75). Sin desempate por RFC. |
| **C. Walk-in, nombre formal** | ✗ | ✓ nombre tecleado (= fiscal) | Monto + Fecha + Nombre | Igual que B si el nombre tecleado coincide con la razón social del CFDI. |
| **D. Walk-in, nombre informal/parcial** | ✗ | ~ apodo/parcial | Monto + Fecha (nombre falla < 4 chars o no coincide) | Match débil (~70 → 0.58, `needsReview`) o **falla** → requiere **vincular a mano** (popover CFDI). |

## Severidad

- **No es un gap de correctitud / pérdida de datos.** El entry siempre se crea, y aunque el
  auto-match falle existe la red de seguridad: el **popover CFDI** por entry permite vincular a
  mano (motor 2.4). No se fuerza un duplicado si el usuario vincula.
- **Es un gap de calidad / automatización.** Las citas walk-in sin RFC generan más confirmaciones
  manuales y menos auto-links silenciosos — justo la población más propensa a pedir factura ad-hoc.
- **Ventana de riesgo real:** walk-in con nombre informal/parcial **y** monto o fecha desviados →
  cae a vinculación manual.

## Opciones de diseño para cerrarlo (no implementadas)

1. **Capturar RFC al reservar cuando `requiereFactura`.** Si el paciente marca que quiere factura,
   pedir RFC/razón social/régimen/uso CFDI en la reserva (esos campos ya existen en el tipo
   `patient`). Llena la identidad antes de completar.
2. **Prompt de RFC al completar la cita.** En `completeBooking`, si no hay `counterpartyRfc` y la
   cita parece facturable, ofrecer capturar RFC en ese momento (rápido, no obliga a crear
   expediente completo).
3. **(Ya existe, dejar como red)** Vinculación manual vía popover CFDI para los casos que el
   auto-match no resuelva.

Recomendación: (1) es la de mayor impacto porque ataca la causa raíz (identidad ausente) sin
fricción extra para walk-ins que no facturan.

---
*Estado:* documentado como permutación/gap conocido el 2026-06-13. Sin cambios de código.
Relacionado: [`02-cfdi-matching.md`](02-cfdi-matching.md) §2.1 (peso del RFC), `01` (origen `cita`).
</content>
