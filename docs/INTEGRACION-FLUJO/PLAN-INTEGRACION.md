# Plan de Integracion: Flujo Financiero Automatizado

## Objetivo
Que el doctor tenga un sistema lo mas automatizado posible para:
- Cobrar citas y servicios
- Registrar ingresos y egresos
- Facturar (CFDI) con minimo esfuerzo
- Tener reportes financieros y contables consolidados
- Reconciliar con SAT

---

## FASE 1: Conectar Pagos con el Sistema (Webhook → Acciones)

### F1.1 - Webhook Stripe/MP actualiza Booking
**Problema:** B1
**Cambio:** Cuando el webhook marca PaymentLink/MpPreference como PAID:
- Si tiene bookingId → marcar Booking como CONFIRMED (o COMPLETED segun config del doctor)
- Crear LedgerEntry automaticamente con los datos del pago
- Guardar formaDePago basado en paymentMethod del webhook (tarjeta, transferencia, oxxo, etc.)

### F1.2 - Booking COMPLETED crea LedgerEntry mejorado
**Cambio:** Enriquecer el LedgerEntry que ya se crea al completar:
- Asignar area/subarea automaticamente ("Consultas Medicas" / servicio especifico)
- Vincular a clientId si existe un Client asociado al paciente
- Incluir datos fiscales del paciente si los tiene (para facilitar facturacion)

---

## FASE 2: Puente Patient ↔ Client

### F2.1 - Vincular Patient con Client
**Problema:** B3
**Cambio en schema:**
```prisma
model Client {
  ...
  patientId  String?  @unique
  patient    Patient? @relation(fields: [patientId], references: [id])
}
```
- Al crear un Client, opcion de vincular a un Patient existente (busqueda por nombre/email)
- Al completar una cita, si el Patient no tiene Client vinculado, crear uno automaticamente con sus datos
- Agregar campos fiscales opcionales a Patient: RFC, regimenFiscal, usoCfdi, codigoPostal

### F2.2 - Vista financiera en expediente del paciente
**Cambio en UI:** En `/dashboard/medical-records/patients/[id]` agregar tab "Financiero":
- Historial de citas con montos cobrados
- Pagos recibidos (PaymentLinks/MpPreferences)
- Facturas emitidas (CfdiEmitted)
- Balance pendiente
- Boton rapido "Cobrar" y "Facturar"

---

## FASE 3: Cita → Venta (Flujo Completo)

### F3.1 - Cotizacion pre-cita
**Problema:** B6
**Nuevo flujo:**
1. Paciente solicita cita o informacion
2. Doctor genera Cotizacion desde el modulo de citas (nuevo boton "Enviar cotizacion")
3. Cotizacion se envia por email/WhatsApp al paciente
4. Paciente acepta → se puede convertir a Booking + Sale automaticamente
5. Se genera link de pago (Stripe/MP) automaticamente

### F3.2 - Booking COMPLETED genera Sale
**Problema:** B2
**Cambio:** Opcion configurable para que al completar cita:
1. Se cree Sale con items basados en el servicio de la cita
2. Sale vinculada al Client (creado automaticamente si no existe, ver F2.1)
3. LedgerEntry vinculado a la Sale (no independiente)
4. Esto permite tracking detallado por servicio/producto

### F3.3 - Schema: Sale → Booking link
```prisma
model Sale {
  ...
  bookingId  String?  @unique
  booking    Booking? @relation(fields: [bookingId], references: [id])
}
```

---

## FASE 4: Auto-Facturacion

### F4.1 - Facturacion desde Venta/Cita
**Problema:** B4
**Cambio:** Agregar boton "Facturar" en:
- Detalle de Venta (`/dashboard/practice/ventas/[id]`)
- Detalle de Booking (al completar cita)
- Pre-llenar TODO: receptor (RFC, nombre del Client/Patient), conceptos (items de la Sale), montos, impuestos

### F4.2 - Datos fiscales del paciente
**Cambio:** Cuando el paciente llena el formulario pre-cita (AppointmentFormLink):
- Agregar campos opcionales: "Requiere factura? Si/No"
- Si Si: RFC, Razon Social, Regimen Fiscal, Uso CFDI, Codigo Postal
- Estos datos se guardan en Patient y/o Client
- Al completar la cita, si el paciente requiere factura → emitir automaticamente

### F4.3 - Facturacion en lote
**Cambio:** En flujo de dinero, seleccionar multiples LedgerEntries → "Facturar seleccionados"
- Para el mismo receptor: genera un solo CFDI con multiples conceptos
- Para diferentes receptores: genera un CFDI por cada uno

### F4.4 - Schema: CfdiEmitted → Sale link
```prisma
model CfdiEmitted {
  ...
  saleId     Int?    @unique
  sale       Sale?   @relation(fields: [saleId], references: [id])
  bookingId  String? @unique
  booking    Booking? @relation(fields: [bookingId], references: [id])
}
```

---

## FASE 5: Reconciliacion SAT

### F5.1 - Cruce CfdiEmitted vs SAT Descarga
**Problema:** B5
**Cambio:** Comparar CfdiEmitted (facturas emitidas via Facturama) con SatCfdiMetadata (descargadas del SAT):
- Marcar cuales coinciden (UUID match)
- Alertar si hay facturas emitidas que no aparecen en SAT
- Alertar si hay facturas en SAT que no estan en CfdiEmitted (emitidas fuera del sistema)

### F5.2 - CFDIs recibidos → Egresos automaticos
**Cambio:** Los CFDIs recibidos (gastos) descargados del SAT:
- Opcion de crear LedgerEntry tipo "egreso" automaticamente
- Pre-llenar: monto, concepto (del CFDI), proveedor (RFC emisor)
- Crear Proveedor automaticamente si no existe
- Vincular LedgerEntry → SatCfdiMetadata UUID

### F5.3 - Tabla de reconciliacion
**Nueva vista** en SAT Descarga o en un nuevo tab de Flujo de Dinero:
- CFDIs emitidos: en sistema + en SAT (match/mismatch)
- CFDIs recibidos: en SAT + en ledger (match/mismatch)
- Diferencias de montos
- Facturas canceladas en SAT pero no en sistema

---

## FASE 6: Reportes Financieros Consolidados

### F6.1 - Dashboard financiero
**Problema:** B7
**Nueva pagina o tab:** Vista consolidada que muestra:
- Ingresos totales (citas + ventas + otros)
- Egresos totales (compras + gastos SAT + manuales)
- Utilidad bruta
- Desglose por mes/trimestre/anio
- Desglose por categoria (area/subarea)
- Desglose por servicio medico
- Top pacientes por ingreso generado

### F6.2 - Reporte para contador
**Export:** Generar reporte mensual/trimestral con:
- Lista de ingresos facturados vs no facturados
- Lista de egresos con/sin CFDI
- IVA trasladado vs IVA acreditable (de SAT Descarga)
- ISR retenido
- Base para declaracion provisional
- Formato CSV/PDF compatible con software contable

### F6.3 - Indicadores clave (KPIs)
- Tasa de facturacion (% de ingresos facturados)
- Tasa de cobranza (% de citas cobradas vs completadas)
- Ingreso promedio por cita
- Pacientes con saldo pendiente
- Gastos deducibles vs no deducibles

---

## FLUJO IDEAL END-TO-END (Post-Integracion)

```
1. PACIENTE AGENDA CITA
   - Selecciona servicio, horario, modalidad
   - Sistema genera cotizacion automatica (opcional)
   - Se envia link de pago (Stripe/MP)

2. PACIENTE PAGA
   - Webhook recibe notificacion
   - Booking se marca CONFIRMED automaticamente
   - LedgerEntry se crea como ingreso
   - Si paciente pidio factura → datos fiscales ya capturados

3. DOCTOR ATIENDE Y COMPLETA CITA
   - Marca COMPLETED
   - Se genera Sale con items del servicio
   - Client vinculado al Patient automaticamente
   - LedgerEntry actualizado con Sale

4. FACTURACION
   - Si paciente requiere factura → se emite CFDI automaticamente
   - Si no → queda como ingreso sin facturar (el doctor puede facturar despues)
   - CFDI vinculado a Sale + LedgerEntry + Booking

5. FIN DE MES
   - SAT Descarga sincroniza CFDIs emitidos y recibidos
   - Sistema reconcilia automaticamente
   - CFDIs recibidos generan egresos en ledger
   - Dashboard muestra reporte consolidado
   - Export para contador listo con un click
```

---

## PRIORIDADES SUGERIDAS

| Prioridad | Fase | Impacto | Esfuerzo |
|-----------|------|---------|----------|
| 1 | F1 (Webhooks → acciones) | Alto | Medio |
| 2 | F2 (Patient ↔ Client) | Alto | Medio |
| 3 | F4.1-F4.2 (Auto-facturacion basica) | Alto | Medio |
| 4 | F3 (Cita → Venta) | Medio | Alto |
| 5 | F5 (Reconciliacion SAT) | Medio | Medio |
| 6 | F6 (Reportes consolidados) | Alto | Alto |
| 7 | F3.1 (Cotizaciones pre-cita) | Bajo | Medio |

---

## CAMBIOS DE SCHEMA REQUERIDOS (Resumen)

```prisma
// Patient ↔ Client bridge
model Client {
  patientId  String?  @unique
  patient    Patient? @relation(...)
}

// Datos fiscales en Patient
model Patient {
  rfc            String?
  regimenFiscal  String?
  usoCfdi        String?
  codigoPostal   String?
  requiereFactura Boolean @default(false)
}

// Sale ↔ Booking
model Sale {
  bookingId  String? @unique
  booking    Booking? @relation(...)
}

// CfdiEmitted ↔ Sale y Booking
model CfdiEmitted {
  saleId     Int?    @unique
  sale       Sale?   @relation(...)
  bookingId  String? @unique
  booking    Booking? @relation(...)
}

// LedgerEntry ↔ SatCfdiMetadata (para reconciliacion)
model LedgerEntry {
  satCfdiUuid  String? @unique
}
```
