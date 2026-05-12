# Guia de Facturacion para Doctores

> Esta guia es una referencia rapida para emitir facturas electronicas (CFDI) desde TuSalud. Consulta con tu contador para casos especificos.

---

## 1. CFDI 4.0 — Lo que necesitas saber

El **CFDI 4.0** es el formato obligatorio del SAT para facturas electronicas en Mexico. Como doctor, cada factura que emitas debe cumplir con estos requisitos:

### Datos obligatorios del receptor (paciente)

Para emitir un CFDI valido necesitas estos datos de tu paciente:

| Dato | Ejemplo | Donde obtenerlo |
|------|---------|-----------------|
| Nombre completo | Juan Perez Lopez | Tal como aparece en su Constancia de Situacion Fiscal |
| RFC | PELJ850101ABC | 13 caracteres (persona fisica) |
| Regimen fiscal | 612 | Constancia de Situacion Fiscal del paciente |
| Codigo postal fiscal | 06600 | Domicilio fiscal del paciente (NO el de consulta) |

**Importante:** Los datos deben coincidir exactamente con los registrados ante el SAT. Si el nombre o RFC no coinciden, el timbrado sera rechazado. Los nombres deben estar en **MAYUSCULAS** tal como aparecen en la Cedula de Identificacion Fiscal (TuSalud los convierte automaticamente).

---

## 2. Claves SAT para Servicios Medicos

Usa la clave de producto/servicio correcta segun el tipo de atencion:

| Servicio | Clave SAT | Unidad de medida |
|----------|-----------|------------------|
| Consulta medica general | 85121502 | E48 — Unidad de servicio |
| Servicios medicos especializados | 85121800 | E48 — Unidad de servicio |
| Servicios de psicologia | 85121608 | E48 — Unidad de servicio |
| Servicios de nutricion | 85121609 | E48 — Unidad de servicio |
| Analisis clinicos y laboratorio | 85141600 | E48 — Unidad de servicio |
| Medicamentos | 51101500 a 51251002 | Segun presentacion |
| Material quirurgico | 42311500 | Segun presentacion |

> En TuSalud, la clave por defecto es **85121800** (Servicios medicos especializados) y la unidad **E48**. Puedes cambiarlas al crear cada factura.

---

## 3. Uso del CFDI — Codigos comunes

El "Uso del CFDI" indica al SAT como utilizara el receptor la factura:

| Clave | Descripcion | Cuando usarla |
|-------|-------------|---------------|
| **D01** | Honorarios medicos, dentales y gastos hospitalarios | Pacientes que deducen gastos medicos (el mas comun) |
| D02 | Gastos medicos por incapacidad o discapacidad | Pacientes con condicion de discapacidad |
| G03 | Gastos en general | Empresas que pagan servicios medicos |
| S01 | Sin efectos fiscales | Cuando el receptor no deducira la factura |
| CP01 | Pagos | Para Recibos Electronicos de Pago (REP) |

---

## 4. Requisitos para que una factura sea deducible (D01)

Para que tu paciente pueda deducir la factura en su declaracion anual:

1. **Uso de CFDI** debe ser **D01** o **D02**
2. **RFC del paciente** escrito correctamente (13 caracteres, sin espacios)
3. **Clave de producto/servicio** debe ser una clave medica valida (ver tabla arriba)
4. **Forma de pago** debe estar registrada correctamente
5. **Pagos en efectivo mayores a $2,000 MXN no son deducibles** — el paciente debe pagar con tarjeta o transferencia

### Limite de deduccion para el paciente

El paciente puede deducir el **menor** de estos dos montos:
- 5 veces la UMA anual
- 15% de sus ingresos anuales

---

## 5. Regimenes Fiscales comunes para doctores

| Clave | Regimen | Notas |
|-------|---------|-------|
| **612** | Personas Fisicas con Actividades Empresariales y Profesionales | El mas comun para doctores |
| **626** | Regimen Simplificado de Confianza (RESICO) | Para ingresos anuales hasta $3.5M MXN |
| 601 | General de Ley Personas Morales | Si operas como persona moral (clinica/SC) |
| 603 | Personas Morales con Fines no Lucrativos | Asociaciones civiles medicas |

---

## 6. Formas y metodos de pago

### Forma de pago (como pago el paciente)

| Clave | Descripcion |
|-------|-------------|
| 01 | Efectivo |
| 02 | Cheque nominativo |
| 03 | Transferencia electronica de fondos |
| 04 | Tarjeta de credito |
| 28 | Tarjeta de debito |
| 99 | Por definir (usar con metodo PPD) |

### Metodo de pago

| Clave | Descripcion | Cuando usarlo |
|-------|-------------|---------------|
| **PUE** | Pago en una sola exhibicion | El paciente paga en el momento de la consulta |
| **PPD** | Pago en parcialidades o diferido | El paciente pagara despues o en partes |

### Campos opcionales adicionales

Al crear una factura puedes agregar datos que aparecen solo en el PDF (no afectan la validez fiscal):

| Campo | Descripcion |
|-------|-------------|
| Observaciones | Notas o comentarios adicionales |
| Banco de pago | Nombre del banco que procesa el pago |
| Cuenta de pago | Numero de cuenta receptora |
| Numero de orden | Referencia interna de tu consultorio |

---

## 7. Facturacion a aseguradoras

Cuando un paciente usa seguro medico, se requieren **dos facturas separadas**:

1. **Factura a la aseguradora** — por el monto cubierto por el seguro
2. **Factura al paciente** — por el copago o deducible que paga directamente

Cada aseguradora tiene requisitos y tiempos de pago especificos. No se puede emitir una sola factura por el total a ambas partes.

---

## 8. Recibo Electronico de Pago (REP)

Cuando emites una factura con metodo de pago **PPD** (pago diferido o parcialidades), debes emitir un **REP** cada vez que recibas un pago:

- El REP es un CFDI tipo **"P" (Pago)**, diferente a la factura de ingreso
- Vincula cada pago con la factura original mediante el UUID
- Registra: fecha de pago, forma de pago, monto, numero de parcialidad, saldo anterior y pendiente
- Es **obligatorio por ley** desde septiembre 2018
- Usa el uso de CFDI **CP01** (Pagos)

**Ejemplo:** Emites factura por $10,000 con metodo PPD. El paciente paga $5,000 hoy y $5,000 en 30 dias. Debes emitir un REP por cada pago de $5,000, indicando parcialidad 1 y 2 respectivamente.

> Puedes emitir REPs directamente desde TuSalud en la pestaña **REP (Pago)** de la seccion de Facturacion. Selecciona la factura PPD original, ingresa los datos del pago (fecha, forma de pago, monto, parcialidad) y el sistema calcula automaticamente el saldo pendiente.

---

## 9. Cancelacion de CFDIs

Si necesitas cancelar una factura, debes indicar un motivo al SAT:

| Clave | Motivo | Cuando usarlo |
|-------|--------|---------------|
| 01 | Comprobante emitido con errores con relacion | Vas a emitir una factura corregida que sustituye esta |
| 02 | Comprobante emitido con errores sin relacion | Error en la factura, no habra sustitucion |
| 03 | No se llevo a cabo la operacion | La consulta o servicio no se realizo |
| 04 | Operacion nominativa relacionada en factura global | Casos de factura global |

**Nota:** El motivo **01** requiere el UUID de la factura que sustituye a la cancelada.

**Aceptacion del receptor:** Algunas cancelaciones requieren la aceptacion del receptor (paciente o empresa). En ese caso, el receptor tiene **72 horas** para aceptar o rechazar. Si no responde, la cancelacion se aprueba automaticamente. Puedes descargar el **acuse de cancelacion** (comprobante del SAT) en PDF desde TuSalud una vez procesada.

---

## 10. Nota de Credito (CFDI de Egreso)

Si necesitas aplicar un descuento, devolucion o bonificacion sobre una factura ya emitida, puedes emitir una **Nota de Credito** en lugar de cancelar la factura original:

- Es un CFDI tipo **"E" (Egreso)**
- Se vincula a la factura original mediante su UUID
- Uso de CFDI del receptor: **G02** (Devoluciones, descuentos o bonificaciones)

**Cuando usarla en lugar de cancelar:**
- El paciente ya dedujo la factura original
- Solo quieres ajustar una parte del monto (no el total)
- Ya paso el periodo para cancelar ante el SAT

> Puedes emitir Notas de Credito directamente desde TuSalud en la pestaña **Nota de Credito** de la seccion de Facturacion. Selecciona la factura original, ajusta los conceptos y montos a acreditar, y el sistema la vincula automaticamente con la factura de ingreso.

---

## 11. Retencion de ISR

Si tu paciente es **persona moral** (empresa), esta obligada a retenerte el **10% de ISR** sobre el monto del servicio. En este caso:

- La factura debe reflejar la retencion de ISR
- El paciente (persona moral) te pagara el monto menos la retencion
- La empresa entera el ISR retenido al SAT

---

## 12. IVA en servicios medicos

Los servicios medicos generalmente estan **exentos de IVA** o aplican **tasa 0%**, dependiendo del tipo de servicio:

- **Consultas medicas** — generalmente exentas
- **Procedimientos esteticos** — pueden causar IVA al 16%
- **Venta de medicamentos** — puede causar IVA segun el tipo

Consulta con tu contador el tratamiento de IVA especifico para tus servicios.

---

## Referencia rapida: Datos para tu perfil fiscal en TuSalud

Para configurar tu perfil de facturacion necesitas:

| Dato | Donde encontrarlo |
|------|-------------------|
| RFC | Constancia de Situacion Fiscal (SAT) |
| Razon social | Constancia de Situacion Fiscal (SAT) |
| Regimen fiscal | Constancia de Situacion Fiscal (SAT) |
| Codigo postal fiscal | Constancia de Situacion Fiscal (SAT) |
| Archivos CSD (.cer y .key) | Portal del SAT > Certifix > Certificados de Sello Digital |
| Password del .key | El que creaste al generar el CSD en el portal del SAT |

### Como obtener tus archivos CSD

1. Ingresa al portal del SAT con tu e.firma (FIEL)
2. Ve a **Certifix** > **Certificados de Sello Digital**
3. Genera un nuevo certificado (si no tienes uno vigente)
4. Descarga los archivos `.cer` y `.key`
5. Guarda el password que usaste al generar el `.key`
6. Sube estos archivos en TuSalud > Facturacion > Configuracion

### Renovacion de CSD

Los certificados CSD tienen vigencia de **4 anos**. Cuando tu CSD este proximo a vencer, TuSalud te notificara. Para renovar:
1. Genera un nuevo certificado en el portal del SAT
2. Ve a TuSalud > Facturacion > Configuracion
3. Actualiza tus archivos CSD (no necesitas borrar los anteriores)

> **Seguridad:** Tus archivos CSD se envian directamente al proveedor de timbrado (Facturama) y nunca se almacenan en nuestros servidores.

---

## 13. Validaciones automaticas

TuSalud valida automaticamente los datos fiscales de tus pacientes antes de emitir una factura:

- **Validacion de RFC** — Verifica que el RFC, nombre, codigo postal y regimen fiscal del paciente coincidan con los registrados ante el SAT. Si algun dato no coincide, te avisamos antes de emitir para evitar rechazos del timbrado.
- **Consulta de status de CFDI** — Puedes verificar si una factura emitida sigue vigente o fue cancelada ante el SAT, y si es cancelable (con o sin aceptacion del receptor).

> **Nota:** Cada validacion consume un folio de la cuenta de facturacion. Se usan solo cuando es necesario (al crear una factura o verificar un status).

---

## Preguntas frecuentes

**¿Que datos necesito de mi paciente para facturar?**
Nombre completo, RFC, regimen fiscal y codigo postal del domicilio fiscal. Estos datos los obtiene el paciente de su Constancia de Situacion Fiscal en el portal del SAT.

**¿Que uso de CFDI debo seleccionar para que sea deducible?**
D01 — Honorarios medicos, dentales y gastos hospitalarios. Con la clave de servicio medica correcta.

**¿Puedo facturar a la aseguradora y al paciente en una sola factura?**
No. Cada parte requiere su propia factura con su monto correspondiente.

**¿Que hago si el paciente paga despues de la consulta?**
Emite la factura con metodo de pago PPD y forma de pago 99 (por definir). Cuando recibas el pago, emite un Recibo Electronico de Pago (REP).

**¿Que pasa si me equivoco en una factura?**
Puedes cancelarla desde TuSalud indicando el motivo. Si vas a emitir una factura corregida, usa el motivo 01 e indica el UUID de la nueva factura. Algunas cancelaciones requieren aceptacion del receptor (72 horas). Una vez procesada, puedes descargar el acuse de cancelacion del SAT.

**¿Cada cuando debo emitir mis facturas?**
No hay plazo obligatorio, pero se recomienda emitirlas el mismo dia de la consulta o dentro de las 24 horas siguientes para mantener un control fiscal ordenado.
