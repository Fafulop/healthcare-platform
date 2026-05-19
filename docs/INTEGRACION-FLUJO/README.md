# Integracion de Flujo Financiero

Integracion entre los modulos de citas, pagos, ventas, facturacion, SAT y flujo de dinero para automatizar el ciclo financiero completo del doctor.

## Documentos

| Archivo | Contenido | Estado |
|---------|-----------|--------|
| [DIAGNOSTICO-ESTADO-ACTUAL.md](DIAGNOSTICO-ESTADO-ACTUAL.md) | Analisis de cada modulo: que hace, como se conecta, que falta | Completo |
| [PLAN-INTEGRACION.md](PLAN-INTEGRACION.md) | Plan de 6 fases con cambios de schema, flujos y prioridades | Completo |
| [IMPL-FORMULARIO-FISCAL.md](IMPL-FORMULARIO-FISCAL.md) | Diseno del formulario fiscal para pacientes | Referencia |
| [IMPL-CITA-A-FACTURA.md](IMPL-CITA-A-FACTURA.md) | Implementacion completa: cita → datos fiscales → auto-facturacion | Implementado |

## Progreso

### Implementado
- [x] **Campos fiscales en Patient** — RFC, razon social, regimen fiscal, uso CFDI, CP, constancia fiscal
- [x] **Formulario fiscal publico** — `/formulario-fiscal/[token]` con campos manuales + upload de constancia
- [x] **API fiscal-form** — Crear enlace (doctor auth) + fetch/submit (publico)
- [x] **Boton "Facturacion" en citas** — Genera enlace, copia, WhatsApp
- [x] **Auto-facturacion al completar** — Toggle en modal de completar cita, emite CFDI vinculado a LedgerEntry

### Pendiente
- [ ] **Webhook Stripe/MP → acciones** — Que al pagar se actualice booking y se cree ledger entry
- [ ] **Puente Patient ↔ Client** — Vincular expediente medico con cliente financiero
- [ ] **Cita → Venta** — Que al completar se genere Sale con items detallados
- [ ] **Reconciliacion SAT** — Cruzar CFDIs emitidos vs descargados del SAT
- [ ] **Reportes financieros consolidados** — Vista unificada ingresos/egresos/facturacion
- [ ] **Cotizaciones pre-cita** — Flujo cotizacion → aceptacion → booking → cobro

## Flujo Actual (Post-Implementacion)

```
1. Doctor envia formulario fiscal al paciente (boton teal en citas)
2. Paciente llena RFC, razon social, regimen fiscal, uso CFDI, CP
   - Opcionalmente sube Constancia de Situacion Fiscal (PDF)
3. Datos se guardan en expediente del paciente (una sola vez)
4. Doctor atiende y completa la cita
5. Modal muestra toggle "Emitir factura (CFDI)" con preview de datos
6. Click en "Completar + Facturar":
   - Booking → COMPLETED
   - LedgerEntry creado (ingreso)
   - CFDI emitido via Facturama, vinculado al LedgerEntry
7. En futuras citas del mismo paciente, el toggle aparece automaticamente
```
