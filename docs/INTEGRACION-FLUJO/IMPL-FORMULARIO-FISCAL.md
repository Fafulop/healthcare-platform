# Implementacion: Formulario Fiscal para Pacientes

## Concepto

Formulario dedicado para capturar datos fiscales del paciente, enviado via el mismo sistema de form links existente. Opcional, no obligatorio. Datos se guardan una sola vez y se reusan para futuras facturas.

## Dos Opciones para el Paciente

### Opcion A: Llenar manualmente
- RFC (13 caracteres persona fisica, 12 persona moral)
- Razon Social (nombre completo tal como aparece en SAT)
- Regimen Fiscal (dropdown con catalogo SAT)
- Uso CFDI (dropdown: G01 Gastos en general, G03 Gastos en general, D01 Honorarios medicos, etc.)
- Codigo Postal del domicilio fiscal

### Opcion B: Subir Constancia de Situacion Fiscal
- Upload del PDF de la Constancia de Situacion Fiscal (CSF)
- El doctor revisa el documento y extrae/confirma los datos
- Se guarda el archivo como referencia

## Pasos de Implementacion

### Paso 1: Schema - Campos fiscales en Patient
Agregar a modelo Patient:
- rfc: String?
- razonSocial: String?
- regimenFiscal: String?
- usoCfdi: String? (default "G03")
- codigoPostalFiscal: String?
- requiereFactura: Boolean (default false)
- constanciaFiscalUrl: String? (URL del PDF subido)
- constanciaFiscalName: String?

### Paso 2: Template "Datos de Facturacion"
Crear template de tipo pre-appointment con campos:
- requiereFactura (radio: Si/No)
- rfc (text, condicional: solo si requiereFactura=Si)
- razonSocial (text, condicional)
- regimenFiscal (dropdown con catalogo SAT, condicional)
- usoCfdi (dropdown con catalogo SAT, condicional)
- codigoPostalFiscal (text, condicional)
- constanciaFiscal (file upload, opcional)

### Paso 3: Habilitar upload de archivos en formulario publico
El sistema actual filtra campos tipo "file". Habilitar para este template:
- Upload a storage (S3/Supabase)
- Guardar URL en submissionData

### Paso 4: On form submission → guardar datos fiscales en Patient
Cuando el paciente envia el formulario fiscal:
- Buscar/crear Patient asociado al booking
- Guardar campos fiscales en Patient
- Si subio CSF, guardar URL en constanciaFiscalUrl
- Marcar requiereFactura = true

### Paso 5: Boton en appointments para enviar formulario fiscal
Nuevo boton (o dropdown) junto al boton morado existente:
- "Enviar formulario de facturacion"
- Usa el mismo flujo: genera token → URL → copia/WhatsApp
- Template fijo: "Datos de Facturacion"

### Paso 6: Auto-facturacion al completar cita
Cuando doctor marca COMPLETED:
- Si paciente tiene requiereFactura=true Y tiene datos fiscales completos:
  - Mostrar preview de factura
  - Boton "Emitir factura" (un click)
  - Pre-llena: receptor (RFC, razonSocial, regimenFiscal, usoCfdi, CP), conceptos (servicio de la cita), monto
- Si datos incompletos: mostrar aviso "Datos fiscales incompletos"
- Si requiereFactura=false: no mostrar nada (flujo normal)

## Estado: IMPLEMENTADO (2026-05-19, actualizado 2026-05-20)

Todo lo descrito arriba fue implementado. Cambios adicionales post-implementacion:

### Validacion SAT Regimen ↔ Uso CFDI (2026-05-20)
- El dropdown de Uso CFDI se filtra automaticamente segun el regimen fiscal seleccionado
- Ejemplo: RESICO (626) solo permite G03 y S01, no D01
- Validacion duplicada: cliente (dropdown filtrado) + servidor (rechaza con 400)
- Esto previene rechazos de Facturama por combinaciones invalidas

### Visualizacion en Expediente (2026-05-20)
- Card "Datos Fiscales" en perfil del paciente muestra RFC, razon social, regimen, uso CFDI, CP, constancia
- Vista detalle de formulario muestra titulo "Datos Fiscales" y renderiza todos los campos enviados
- Lista de formularios en expediente muestra "Datos Fiscales" en vez de "Formulario pre-cita"

## Notas
- Para pacientes recurrentes, los datos fiscales ya estan guardados. No se envia formulario de nuevo.
- El formulario fiscal es INDEPENDIENTE del formulario medico pre-cita. Son dos formularios separados.
- El doctor puede ver datos fiscales del paciente desde el expediente (card "Datos Fiscales").
- Uso CFDI mas comun para consultas medicas: D01 (Honorarios medicos) — solo disponible para regimenes 605, 606, 608, 612, 621, 625. Para RESICO (626) usar G03 o S01.
