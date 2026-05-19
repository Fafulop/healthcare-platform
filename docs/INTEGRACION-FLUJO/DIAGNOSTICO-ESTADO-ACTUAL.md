# Diagnostico: Estado Actual de los Modulos

## Modulos Analizados

| Modulo | Ruta | Estado |
|--------|------|--------|
| Appointments | `/appointments` | Completo |
| Pagos (Stripe/MP) | `/dashboard/pagos` | Completo |
| Ventas | `/dashboard/practice/ventas` | Completo |
| Flujo de Dinero | `/dashboard/practice/flujo-de-dinero` | Completo |
| Facturacion CFDI | `/dashboard/facturacion` | Completo |
| SAT Descarga | `/dashboard/sat-descarga` | Completo |
| Expediente Paciente | `/dashboard/medical-records/patients/[id]` | Completo |

---

## 1. APPOINTMENTS (Citas)

**Modelo principal:** `Booking` + `AppointmentSlot` + `AvailabilityRange`

**Datos clave:**
- patientName, patientEmail, patientPhone
- serviceId/serviceName, finalPrice
- status: PENDING → CONFIRMED → COMPLETED / CANCELLED / NO_SHOW
- appointmentMode: PRESENCIAL | TELEMEDICINA
- patientId (link opcional a expediente medico)

**Conexiones actuales:**
- Booking COMPLETED → crea LedgerEntry automaticamente (ingreso, con concepto "Servicio - Paciente")
- Booking → PaymentLink (one-to-one opcional)
- Booking → MpPaymentPreference (one-to-one opcional)
- Booking → Patient (link opcional al expediente)
- Booking → Service (servicio seleccionado)

**Lo que pasa al completar una cita:**
1. Doctor marca COMPLETED
2. Selecciona formaDePago (efectivo/transferencia) y precio final
3. Se crea un LedgerEntry con entryType="ingreso"
4. NO se crea una Venta (Sale)
5. NO se emite CFDI automaticamente
6. NO se vincula al Client del modulo de ventas

---

## 2. PAGOS (Stripe / MercadoPago)

**Modelos:** `PaymentLink` (Stripe) + `MpPaymentPreference` (MercadoPago)

**Datos clave:**
- amount, currency (MXN), status: PENDING/PAID/EXPIRED/CANCELLED
- bookingId (opcional), serviceId (opcional)
- stripePaymentLinkUrl / mpInitPoint (URLs de pago)
- paidAt, paymentMethod

**Conexiones actuales:**
- PaymentLink/MpPreference → Booking (one-to-one opcional)
- PaymentLink/MpPreference → Service (many-to-one opcional)
- Webhooks actualizan status a PAID cuando el paciente paga

**PROBLEMA:** Cuando un webhook marca PAID:
- NO se crea LedgerEntry
- NO se actualiza el Booking a COMPLETED
- NO se crea Sale
- El pago queda registrado solo en la tabla de PaymentLink/MpPreference
- El doctor tiene que hacer todo manualmente despues

---

## 3. VENTAS (Sales)

**Modelo principal:** `Sale` + `SaleItem`

**Datos clave:**
- saleNumber (VTA-2026-001), saleDate
- clientId → Client (NO Patient)
- items[] con product/service, quantity, unitPrice, taxRate, discountRate
- subtotal, tax, total, amountPaid, paymentStatus (PENDING/PARTIAL/PAID)
- status: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED / CANCELLED

**Conexiones actuales:**
- Sale → LedgerEntry (se crea automaticamente al crear venta)
- Sale → Client (obligatorio)
- Sale → Quotation (opcional, conversion cotizacion→venta)
- SaleItem → Product (opcional)

**PROBLEMA:**
- No hay vinculo Sale → Booking (una cita completada no genera venta)
- No hay vinculo Sale → CfdiEmitted (una venta no se puede facturar directamente)
- Client y Patient son entidades separadas sin puente

---

## 4. FLUJO DE DINERO (LedgerEntry)

**Modelo principal:** `LedgerEntry` + `LedgerAttachment` + `LedgerFactura`

**Datos clave:**
- amount, concept, entryType (ingreso/egreso)
- formaDePago (efectivo/transferencia/tarjeta/cheque/deposito)
- areaId/subareaId (categorias)
- paymentStatus, amountPaid
- porRealizar (pendiente de realizar)
- saleId, clientId (links opcionales)

**Conexiones actuales:**
- LedgerEntry ← Booking COMPLETED (auto-creado)
- LedgerEntry ← Sale creada (auto-creado)
- LedgerEntry → CfdiEmitted (via boton "Facturar" manual)
- LedgerEntry → Area/Subarea (categorizacion)
- LedgerEntry → Client/Proveedor (opcional)

**Features:**
- Balance: ingresos - egresos (realizados y proyectados)
- Estado de Resultados
- Export PDF
- Facturas/XML como attachments

---

## 5. FACTURACION (CFDI)

**Modelo principal:** `CfdiEmitted` + `DoctorFiscalProfile`

**Datos clave:**
- Emision de CFDI via Facturama Multiemisor API
- Tipos: Ingreso, Egreso (nota de credito), Pago (REP 2.0)
- PDF, XML, HTML descargables
- Cancelacion con motivos SAT
- Envio por email
- Complemento de pago (REP) para facturas PPD

**Conexiones actuales:**
- CfdiEmitted → LedgerEntry (via ledgerEntryId, vinculado al usar boton "Facturar")
- CfdiEmitted → DoctorFiscalProfile

**PROBLEMA:**
- No hay vinculo CfdiEmitted → Sale
- No hay vinculo CfdiEmitted → Booking
- No hay auto-facturacion (todo es manual via boton "Facturar" en LedgerEntry)
- El doctor tiene que llenar datos del receptor manualmente cada vez

---

## 6. SAT DESCARGA

**Modelos:** `SatSyncJob` + `SatCfdiMetadata` + `SatCfdiDetail` + `SatCfdiConcepto` + `SatPago`

**Datos clave:**
- Descarga masiva de CFDIs emitidos y recibidos del SAT
- Metadata: UUID, RFC emisor/receptor, monto, estado (Vigente/Cancelado)
- Detalle: subtotal, IVA, ISR, conceptos, forma de pago
- Pagos PPD: parcialidades, montos, saldos
- Resumen mensual con desglose ingresos/gastos
- Export CSV (metadata, detalles, resumen)
- Alertas de nuevos CFDIs y cancelaciones

**Conexiones actuales:**
- NINGUNA directa con otros modulos
- Los CFDIs descargados no se reconcilian contra CfdiEmitted
- Los CFDIs recibidos (gastos) no se vinculan a LedgerEntry
- Los resumenes no alimentan el Estado de Resultados

---

## 7. EXPEDIENTE PACIENTE (Patient)

**Modelo:** `Patient` (schema medical_records)

**Datos clave:**
- Datos personales, contacto, historial medico
- Encounters, prescripciones, notas clinicas
- NO tiene datos financieros

**Conexiones actuales:**
- Patient → Booking (opcional, via patientId)
- Patient → AppointmentFormLink

**PROBLEMA:**
- Patient NO es Client. Son entidades completamente separadas.
- No hay forma de ver "cuanto ha generado este paciente" o "facturas de este paciente"
- No hay RFC/datos fiscales en Patient

---

## MAPA DE CONEXIONES ACTUALES

```
Appointment (Booking)
    |
    |--COMPLETED--> LedgerEntry (auto)
    |                    |
    |                    |--"Facturar" (manual)--> CfdiEmitted
    |
    |--opcional-------> PaymentLink / MpPreference
    |                    (webhook PAID = NO hace nada mas)
    |
    |--opcional-------> Patient (expediente medico, sin datos financieros)

Quotation --conversion--> Sale --auto--> LedgerEntry --"Facturar" (manual)--> CfdiEmitted
                            |
                            +--> Client (entidad separada de Patient)

SAT Descarga (isla separada, sin conexion a ningun modulo)
```

---

## BRECHAS CRITICAS IDENTIFICADAS

### B1: Payment Webhook → Nada
Cuando Stripe/MP notifica un pago, solo se marca PAID en PaymentLink/MpPreference. No se crea LedgerEntry, no se actualiza Booking, no se dispara nada.

### B2: Booking COMPLETED no crea Sale
Se crea LedgerEntry pero no Sale. Esto significa que no hay items detallados, no hay tracking de cliente, y no se puede generar cotizacion previa.

### B3: Patient != Client
El paciente del expediente medico y el cliente del modulo financiero son entidades separadas. El doctor no puede ver el historial financiero de un paciente.

### B4: Sin auto-facturacion
Toda emision de CFDI requiere que el doctor vaya a flujo de dinero, encuentre el LedgerEntry, haga click en "Facturar", y llene datos del receptor. Esto deberia ser semi-automatico.

### B5: SAT Descarga aislado
Los CFDIs descargados del SAT no se reconcilian con nada. Los gastos (CFDIs recibidos) no se registran como egresos en el ledger. Los ingresos no se cruzan con CfdiEmitted.

### B6: Sin cotizaciones pre-cita
No existe flujo de: paciente pide cita → doctor envia cotizacion → paciente acepta → se agenda cita → se cobra.

### B7: Sin reportes financieros consolidados
No hay vista que combine: ingresos por citas + ventas + datos SAT + egresos en un solo reporte contable/fiscal.
