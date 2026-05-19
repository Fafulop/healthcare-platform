# Implementacion: Cita a Factura (Flujo Completo)

**Estado:** Implementado
**Fecha:** 2026-05-19

## Resumen

Flujo end-to-end que conecta citas con facturacion: el paciente proporciona sus datos fiscales via formulario, y al completar la cita el doctor puede emitir la factura (CFDI) con un solo click.

```
Paciente recibe formulario fiscal → Llena RFC/datos → Doctor completa cita → Toggle "Emitir factura" → CFDI emitido automaticamente
```

---

## Que se construyo

### 1. Campos fiscales en Patient (Schema + Migration)

**Archivos:**
- `packages/database/prisma/schema.prisma` — 8 campos nuevos en modelo Patient
- `packages/database/prisma/migrations/add-patient-fiscal-fields.sql`

**Campos agregados:**
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `requiere_factura` | Boolean (default false) | Si el paciente necesita factura |
| `rfc` | VarChar(13) | RFC del paciente |
| `razon_social` | VarChar(300) | Nombre fiscal completo |
| `regimen_fiscal` | VarChar(10) | Codigo SAT (ej: "612") |
| `uso_cfdi` | VarChar(10) | Codigo SAT (ej: "D01") |
| `codigo_postal_fiscal` | VarChar(10) | CP del domicilio fiscal |
| `constancia_fiscal_url` | Text | URL del PDF de Constancia de Situacion Fiscal |
| `constancia_fiscal_name` | VarChar(255) | Nombre del archivo subido |

---

### 2. Formulario Fiscal Publico (Paciente)

**Pagina publica:** `/formulario-fiscal/[token]`
**Archivo:** `apps/public/src/app/formulario-fiscal/[token]/page.tsx`

El paciente ve un formulario con:
- **Campos manuales:** RFC, Razon Social, Regimen Fiscal (dropdown SAT), Uso CFDI (dropdown SAT), Codigo Postal Fiscal
- **Upload opcional:** Constancia de Situacion Fiscal (PDF, max 16MB)
- **Hint:** "Para consultas medicas, lo mas comun es D01 - Honorarios medicos"
- **Pre-fill:** Si el paciente ya tiene datos fiscales parciales, se pre-llenan
- **Aviso de privacidad:** Consentimiento obligatorio (LFPDPPP)

**Validaciones (cliente + servidor):**
- RFC: regex `/^[A-ZN&]{3,4}\d{6}[A-Z0-9]{3}$/`, auto-uppercase
- Codigo postal: 5 digitos exactos
- Todos los campos obligatorios (excepto constancia)
- Archivo max 16MB validado en servidor

---

### 3. API Routes

#### `POST /api/appointments/fiscal-form-link` (Doctor, autenticado)
**Archivo:** `apps/api/src/app/api/appointments/fiscal-form-link/route.ts`

- Crea un enlace de formulario fiscal para un paciente
- Reutiliza modelo `AppointmentFormLink` con `templateId="FISCAL"` y `bookingId=null`
- Si el paciente ya tiene datos fiscales → responde 409 con RFC existente
- Si ya hay un enlace PENDING → regenera el token
- Retorna `{ token, url }` donde url = `/formulario-fiscal/{token}`

#### `GET /api/fiscal-form?token=X` (Publico, sin auth)
**Archivo:** `apps/api/src/app/api/fiscal-form/route.ts`

- Valida token, verifica que sea templateId="FISCAL"
- Retorna: nombre paciente, nombre doctor, datos fiscales existentes (pre-fill), catalogos SAT
- No expone datos sensibles (email, telefono, historial medico)

#### `POST /api/fiscal-form` (Publico, sin auth)
**Mismo archivo**

- Acepta JSON o FormData (cuando incluye constancia PDF)
- Valida RFC format, campos obligatorios, tamanio de archivo (16MB)
- Sube constancia via UTApi (UploadThing server-side) si se proporciona
- **Transaccion:** actualiza Patient (campos fiscales) + marca AppointmentFormLink como SUBMITTED
- Si UTApi falla: continua sin archivo (degradacion graceful)

---

### 4. Boton "Facturacion" en Citas (Doctor)

**Archivo:** `apps/doctor/src/app/appointments/_components/FiscalFormButton.tsx`

Boton color teal que aparece en la fila de acciones de cada cita CONFIRMED que tiene paciente vinculado:

| Estado | UI |
|--------|-----|
| Sin paciente | No se muestra |
| Paciente sin datos fiscales | Boton teal "Facturacion" → click genera enlace |
| Enlace generado | Botones "Copiar" + "WhatsApp" |
| Paciente ya tiene datos fiscales | Badge verde "Datos fiscales" |

**WhatsApp:** Pre-llena mensaje con nombre del paciente y enlace al formulario fiscal.

**Archivo modificado:** `apps/doctor/src/app/appointments/_components/BookingsSection.tsx`
- Importa FiscalFormButton
- Lo renderiza junto al FormularioStatusButton (boton morado) para citas CONFIRMED

---

### 5. Auto-Facturacion al Completar Cita

**Archivo:** `apps/doctor/src/app/appointments/_components/CompleteBookingModal.tsx`

El modal "Completar cita" ahora incluye un toggle opcional:

```
[x] Emitir factura (CFDI)
    RFC: XAXX010101000
    Razon social: JUAN PEREZ GARCIA
    Uso CFDI: D01
```

**Condiciones para que aparezca:**
- El paciente tiene `requiereFactura=true`
- Todos los campos fiscales completos (rfc, razonSocial, regimenFiscal, usoCfdi, codigoPostalFiscal)
- El doctor tiene configurado el modulo de facturacion (onEmitCfdi disponible)

**Flujo al hacer click en "Completar + Facturar":**
1. `completeBooking()` → marca booking COMPLETED + crea LedgerEntry → retorna `ledgerEntryId`
2. `emitCfdi()` → llama `POST /api/facturacion/cfdi` con datos del paciente + `ledgerEntryId`
3. CFDI queda vinculado al LedgerEntry en la base de datos
4. Modal muestra resultado (exito o error con sugerencia de facturar manualmente)

**Datos del CFDI emitido:**
- Receptor: datos fiscales del paciente
- Concepto: nombre del servicio o "Consulta medica"
- Codigo producto SAT: 85121800 (Servicios de consultoria en salud)
- Unidad: E48 (Servicio)
- Monto: precio cobrado en la cita
- Forma de pago: efectivo→01, transferencia→03
- Metodo de pago: PUE (Pago en una sola exhibicion)
- Tipo: I (Ingreso)

**Si falla la emision:** El modal muestra el error y sugiere emitir manualmente desde /dashboard/facturacion. La cita ya queda completada y el LedgerEntry creado.

---

### 6. Cambios en Hook y API de Bookings

**Archivo:** `apps/doctor/src/app/appointments/_hooks/useBookings.ts`

- Tipo `Booking.patient` expandido con campos fiscales
- `completeBooking()` ahora retorna `{ ledgerEntryId?: number }` (antes era void)
- Nueva funcion `emitCfdi()` que llama `POST /api/facturacion/cfdi`

**Archivo:** `apps/api/src/app/api/appointments/bookings/route.ts`

- GET ahora incluye campos fiscales del paciente en el select: `requiereFactura, rfc, razonSocial, regimenFiscal, usoCfdi, codigoPostalFiscal`

---

## Archivos Creados

| Archivo | Proposito |
|---------|-----------|
| `packages/database/prisma/migrations/add-patient-fiscal-fields.sql` | Migration SQL |
| `apps/api/src/app/api/fiscal-form/route.ts` | API publica para formulario fiscal |
| `apps/api/src/app/api/appointments/fiscal-form-link/route.ts` | API doctor para crear enlace fiscal |
| `apps/public/src/app/formulario-fiscal/[token]/page.tsx` | Pagina publica del formulario |
| `apps/doctor/src/app/appointments/_components/FiscalFormButton.tsx` | Boton en citas |

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `packages/database/prisma/schema.prisma` | 8 campos fiscales en Patient |
| `apps/api/src/app/api/appointments/bookings/route.ts` | Select incluye campos fiscales del paciente |
| `apps/doctor/src/app/appointments/_hooks/useBookings.ts` | Tipo Booking expandido, completeBooking retorna ledgerEntryId, nueva funcion emitCfdi |
| `apps/doctor/src/app/appointments/_components/CompleteBookingModal.tsx` | Toggle factura + emision CFDI |
| `apps/doctor/src/app/appointments/_components/BookingsSection.tsx` | FiscalFormButton + onEmitCfdi prop threading |
| `apps/doctor/src/app/appointments/page.tsx` | Conecta emitCfdi al BookingsSection |

---

## Consideraciones

- **Pacientes recurrentes:** Los datos fiscales se guardan una vez. En futuras citas el toggle de factura aparece automaticamente sin necesidad de reenviar el formulario.
- **Retrocompatibilidad:** `onEmitCfdi` es opcional en todos los componentes. Las paginas v1/v2 siguen funcionando sin cambios.
- **Sin impuestos:** Los CFDI se emiten sin desglose de IVA (TaxObject=01). Esto es correcto para servicios medicos exentos. Si se necesita IVA, se debe facturar manualmente desde /dashboard/facturacion.
- **Constancia fiscal:** El PDF subido se almacena via UploadThing como referencia. No se parsea automaticamente.
