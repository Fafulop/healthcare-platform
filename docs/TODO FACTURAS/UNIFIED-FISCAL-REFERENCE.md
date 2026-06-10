 # Referencia Fiscal Unificada — TuSalud Platform

> Documento canonico que consolida todas las reglas fiscales, de facturacion, y de integracion SAT
> que aplican a la plataforma. Este archivo es la **fuente unica de verdad** — todos los demas
> documentos en esta carpeta deben ser consistentes con este.
>
> Basado en: RESICO-VS-ACTIVIDAD-EMPRESARIAL.md (investigacion junio 2026)
> con correcciones a DEDUCIBILITY-CLASSIFICATION-SYSTEM.md, GUIA-FACTURACION-DOCTORES.md,
> y PLAN-FACTURACION-CFDI.md.
>
> Fecha: Junio 2026

---

## Errata: Inconsistencias Corregidas

Antes de la referencia unificada, se documentan las correcciones aplicadas a los archivos existentes.

### E1. Articulos LISR incorrectos en DEDUCIBILITY-CLASSIFICATION-SYSTEM.md

**Problema:** El archivo citaba Arts. 25-35 y Art. 27 LISR para reglas de deducciones de PF. Estos son articulos del **Titulo II (Personas Morales)**. Para PF con Actividad Empresarial (regimen 612), los articulos correctos son del **Titulo IV, Capitulo II, Seccion I**.

| Referencia incorrecta | Referencia correcta | Contenido |
|---|---|---|
| Art. 25 frac. II | **Art. 103 frac. II** LISR | Adquisicion de mercancias |
| Art. 25 frac. III | **Art. 103 frac. III** LISR | Gastos operativos (renta, servicios, honorarios) |
| Art. 25 frac. V | **Art. 103** LISR | Nomina/sueldos |
| Art. 25 frac. X | **Art. 103** LISR | Seguros |
| Art. 27 frac. I | **Art. 105** LISR | Estrictamente indispensables |
| Art. 27 frac. III | **Art. 105** LISR | Bancarizacion >$2,000 |
| Art. 35 frac. IV | **Art. 34** LISR | Mobiliario 10% |
| Art. 35 frac. IX | **Art. 34** LISR | Equipo computo 30% |
| Art. 35 frac. XIV | **Art. 34** LISR | Equipo medico (tasa sector especifico) |
| Art. 36 frac. II | **Art. 34** LISR | Vehiculos 25%, tope ~$175K |

### E2. Plazo de aceptacion de cancelacion CFDI

Los archivos GUIA-FACTURACION-DOCTORES.md y PLAN-FACTURACION-CFDI.md dicen **"72 horas"** para aceptacion de cancelacion. Esto es **CORRECTO** — el CFF establece 72 horas para CFDIs estandar. No confundir con "3 dias habiles" que aplica en contextos especificos de la RMF.

### E3. Informacion faltante en GUIA-FACTURACION-DOCTORES.md

| Dato faltante | Valor correcto | Fuente |
|---|---|---|
| Plazo emision complemento de pago | **5 dias naturales** del mes siguiente al pago | Regla 2.7.1.32 RMF 2026 |
| Penalidad por cancelacion extemporanea | **5% a 10%** del monto del CFDI | CFF |
| Plazo maximo cancelacion PF | **30 de abril** del ano siguiente al ejercicio | RMF |
| Plazo maximo cancelacion PM | **31 de marzo** del ano siguiente al ejercicio | RMF |

### E4. Motivo 01 de cancelacion — orden de operaciones

PLAN-FACTURACION-CFDI.md no enfatiza que el CFDI de reemplazo debe **timbrarse PRIMERO** antes de cancelar el original con motivo 01.

### E5. Tasa de depreciacion equipo medico

DEDUCIBILITY-CLASSIFICATION-SYSTEM.md cita 25% para equipo medico. Art. 34 LISR establece "Maquinaria y equipo general = 10%". La tasa de 25% puede aplicar a equipo medico especifico bajo categorias sectoriales del Art. 34, pero debe documentarse como excepcion, no como regla general.

---

## Parte I — Regimenes Fiscales para Personas Fisicas

> **Nota:** El SAT no tiene un codigo separado para "Servicios Profesionales" o "Honorarios".
> Los doctores que ejercen de forma independiente cobrando honorarios usan el mismo **regimen 612**
> (Actividades Empresariales y Profesionales). "Regimen de Honorarios" es un nombre coloquial,
> no un regimen fiscal distinto. Los unicos regimenes aplicables a doctores independientes son
> **612** y **626 (RESICO)**.

### 1. RESICO (Regimen 626)

**Base legal:** LISR Titulo IV, Cap. II, Seccion IV — Arts. 113-E a 113-J

| Caracteristica | Detalle |
|---|---|
| Tasa ISR | 1% a 2.5% (fija por rango, sobre ingreso bruto) |
| Base de calculo | Ingresos **efectivamente cobrados** (sin deducciones) |
| Limite de ingresos | $3,500,000 MXN anuales |
| E.firma | Obligatoria desde 2026 |
| Pagos ISR | **Definitivos** (no provisionales) |
| Declaracion mensual | Dia 17 del mes siguiente |
| Declaracion anual | 30 de abril |
| Deducciones operativas | **NO** |
| Deducciones personales | **NO** |
| Perdidas fiscales | **NO** amortizables |
| DIOT | Relevado (Regla 3.13.17 RMF) |
| Contabilidad electronica | NO obligatoria para PF |
| Retencion ISR por PM | **1.25%** (Art. 113-J) |

#### Tabla ISR Mensual (Art. 113-E)

| Limite Inferior | Limite Superior | Tasa |
|---|---|---|
| $0.01 | $25,000.00 | 1.00% |
| $25,000.01 | $50,000.00 | 1.10% |
| $50,000.01 | $83,333.33 | 1.50% |
| $83,333.34 | $208,333.33 | 2.00% |
| $208,333.34 | $291,666.67 | 2.50% |

#### Tabla ISR Anual (Art. 113-F)

| Limite Inferior | Limite Superior | Tasa |
|---|---|---|
| $0.01 | $300,000.00 | 1.00% |
| $300,000.01 | $600,000.00 | 1.10% |
| $600,000.01 | $1,000,000.00 | 1.50% |
| $1,000,000.01 | $2,500,000.00 | 2.00% |
| $2,500,000.01 | $3,500,000.00 | 2.50% |

#### Causas de salida (Art. 113-I)

| Causa | Reingreso? |
|---|---|
| Exceder $3.5M en el ano | SI |
| Omitir 3+ pagos mensuales en un ejercicio (frac. IV) | **NO** (permanente) |
| No presentar declaracion anual (frac. II) | **NO** (permanente) |
| No emitir CFDI por 3+ meses consecutivos o en 12 meses (frac. III) | **NO** (permanente) |
| Emitir CFDI por operaciones inexistentes (frac. V) | **NO** (permanente) |
| Sin e.firma vigente (2026+) | Reclasificacion administrativa |

---

### 2. Actividad Empresarial y Profesional / Servicios Profesionales — Honorarios (Regimen 612)

**Base legal:** LISR Titulo IV, Cap. II, Seccion I — Arts. 100 a 110

| Caracteristica | Detalle |
|---|---|
| Tasa ISR | 1.92% a 35% (progresiva, sobre utilidad neta) |
| Base de calculo | Ingresos - Deducciones autorizadas |
| Limite de ingresos | Sin limite |
| Pagos ISR | **Provisionales** acumulativos (enero a mes actual) |
| Declaracion mensual | Dia 17 del mes siguiente |
| Declaracion anual | Abril del ano siguiente |
| Deducciones operativas | **SI** (Art. 103 LISR) |
| Deducciones personales | **SI** (Art. 151 LISR, solo en anual) |
| Perdidas fiscales | SI, amortizables hasta 10 anos |
| DIOT | Obligatoria (>$4M; excepcion Regla 2.8.1.17 RMF con Mi Contabilidad) |
| Contabilidad electronica | Obligatoria (>$4M; excepcion Regla 2.8.1.17 RMF) |
| Retencion ISR por PM | **10%** (Art. 106 LISR) |
| Retencion IVA por PM | **2/3 del IVA = 10.6667%** (Art. 1-A LIVA) |
| PTU | SI, si tiene empleados (10% de utilidad fiscal) |

#### Tarifa ISR Mensual 2026 (Art. 96, Anexo 8 RMF 2026)

| Limite Inferior | Limite Superior | Cuota Fija | % Excedente |
|---|---|---|---|
| $0.01 | $844.59 | $0.00 | 1.92% |
| $844.60 | $7,167.67 | $16.22 | 6.40% |
| $7,167.68 | $12,601.03 | $420.90 | 10.88% |
| $12,601.04 | $14,648.87 | $1,012.08 | 16.00% |
| $14,648.88 | $17,533.64 | $1,339.74 | 17.92% |
| $17,533.65 | $35,362.83 | $1,856.84 | 21.36% |
| $35,362.84 | $55,734.75 | $5,662.62 | 23.52% |
| $55,734.76 | $79,388.37 | $10,454.09 | 30.00% |
| $79,388.38 | $106,410.50 | $17,550.18 | 32.00% |
| $106,410.51 | $375,975.61 | $26,197.27 | 34.00% |
| $375,975.62 | En adelante | $117,829.97 | 35.00% |

#### Calculo pago provisional mensual (Art. 106)

```
  Ingresos acumulables (enero a mes actual, efectivamente cobrados)
- Deducciones autorizadas acumuladas (Art. 103, efectivamente pagadas)
- PTU pagada en el ejercicio
- Perdidas fiscales de ejercicios anteriores
= Base gravable acumulada

  Aplicar tarifa Art. 96 (acumulada por numero de meses)
= ISR causado acumulado

- Pagos provisionales anteriores del ejercicio
- Retenciones de ISR por terceros
= ISR a pagar del mes
```

#### Deducciones autorizadas (Art. 103 LISR)

1. Devoluciones, descuentos o bonificaciones
2. Adquisiciones de mercancias (materias primas, productos)
3. Gastos operativos (renta, servicios, sueldos, IMSS, publicidad, honorarios, seguros, vehiculo)
4. Intereses por prestamos del negocio
5. Impuesto local sobre ingresos

**Requisitos (Art. 105 LISR):**
- Estrictamente indispensables para generar ingresos
- Efectivamente pagadas en el ejercicio fiscal
- Soportadas por CFDI valido
- Pagos > **$2,000 MXN** por medios bancarios (transferencia, tarjeta, cheque nominativo)
- Registradas en contabilidad
- Valor de mercado, no duplicadas
- No estar en lista de no deducibles (Art. 28 LISR)

#### Depreciacion de activos fijos (Art. 34 LISR)

| Tipo de Activo | Tasa Anual |
|---|---|
| Construcciones (edificios) | 5% |
| Mobiliario y equipo de oficina | 10% |
| Maquinaria y equipo (general) | 10% |
| Equipo de comunicaciones | 10% |
| Automoviles | 25% (tope MOI ~$175,000 MXN) |
| Equipo de transporte | 25% |
| Equipo de computo | 30% |
| Dados, troqueles, moldes | 35% |

**Nota:** Existen tasas sectoriales especificas dentro del Art. 34 (ej. equipo medico puede tener tasas diferentes al 10% general). Consultar las fracciones aplicables al sector salud.

#### Deducciones personales en anual (Art. 151 LISR)

| Deduccion | Limite |
|---|---|
| Gastos medicos, dentales, hospitalarios | Sin limite especifico (pago bancario) |
| Gastos medicos por discapacidad | Sin limite especifico |
| Gastos funerarios | 1 UMA anual |
| Donativos | Hasta 7% de ingresos acumulables |
| Intereses hipotecarios | Intereses reales pagados |
| Aportaciones voluntarias SAR/retiro | 10% de ingresos o 5 UMAs |
| Primas de seguros medicos | Pago bancario |
| Transporte escolar obligatorio | Pago bancario |
| Colegiaturas | Por nivel: Preescolar $14,200 / Primaria $12,900 / Secundaria $19,900 / Prof. tecnico $17,100 / Bachillerato $24,500 |

**Tope global:** Menor entre 5 UMAs anuales (~$206,418.60 en 2026) o 15% del ingreso bruto. Colegiaturas NO cuentan hacia este tope.

---

## Parte II — IVA (Ambos Regimenes)

| Concepto | Detalle |
|---|---|
| Tasa general | **16%** |
| Tasa 0% | Alimentos no procesados, medicinas, exportaciones |
| Exentos | Servicios medicos a PF (Art. 15 frac. XIV LIVA), educacion, arrendamiento casa habitacion |
| Base temporal | Flujo de efectivo (cobrado/pagado) |
| Declaracion | Mensual, dia 17 del mes siguiente |
| Acreditamiento | SI en ambos regimenes (626 y 612) |

### Calculo mensual

```
IVA trasladado (efectivamente cobrado)
- IVA acreditable (efectivamente pagado a proveedores)
- IVA retenido acreditable
= IVA a pagar (o saldo a favor)
```

### IVA en servicios medicos (contexto TuSalud)

| Escenario | IVA |
|---|---|
| Servicios medicos por PF con titulo medico (o SC) | **Exento** (Art. 15 frac. XIV LIVA) |
| Servicios medicos por PM (sociedad mercantil) | **16% trasladado**, PM receptora retiene 2/3 (10.6667%) |
| Procedimientos esteticos/cosmeticos | **16%** siempre |

> **Nota:** La exencion de IVA del Art. 15-XIV depende del **tipo de prestador** (PF con titulo medico o sociedad civil), NO del tipo de cliente. Un doctor PF que presta servicios exentos a una PM sigue siendo exento. Solo aplica 16% cuando el prestador es una persona moral mercantil o el servicio no es medico.

### Diferencia clave entre regimenes para IVA

| Aspecto | RESICO (626) | Actividad Empresarial (612) |
|---|---|---|
| IVA acreditable | SI (principal herramienta de ahorro) | SI |
| DIOT | Relevado (Regla 3.13.17 RMF) | Obligatoria (>$4M) |
| Contabilidad IVA | Registro basico recomendado | Contabilidad formal |
| Retencion IVA por PM | Reglas generales Art. 1-A LIVA | 2/3 del IVA (10.67%) |

---

## Parte III — Facturacion CFDI 4.0

### Campos obligatorios

**Comprobante:**
- Version: "4.0"
- Fecha, SubTotal, Total, Moneda
- TipoDeComprobante: I (Ingreso), E (Egreso), T (Traslado), P (Pago), N (Nomina)
- Exportacion: "01" (operaciones nacionales)
- MetodoPago: PUE o PPD
- LugarExpedicion: Codigo postal

**Emisor (todos obligatorios):**
- RFC (13 chars PF)
- Nombre: exacto con Constancia de Situacion Fiscal, **MAYUSCULAS**
- RegimenFiscal: **626** o **612**

**Receptor (todos obligatorios — nuevo en 4.0):**
- RFC
- Nombre: exacto con registros SAT, **MAYUSCULAS**
- DomicilioFiscalReceptor: **Codigo postal** (causa #1 de rechazo en timbrado)
- RegimenFiscalReceptor: debe coincidir con SAT
- UsoCFDI: validacion cruzada con regimen del receptor

**Concepto:**
- ClaveProdServ, Cantidad, ClaveUnidad, Descripcion, ValorUnitario, Importe
- ObjetoImp: "01" (no gravado), "02" (gravado, desglosado), "03" (gravado, no desglosado)
- Si ObjetoImp = "01", **NO incluir nodo Taxes** (ni siquiera array vacio — Facturama rechaza)

### Claves SAT para servicios medicos (contexto TuSalud)

| Servicio | ClaveProdServ | ClaveUnidad |
|---|---|---|
| Consulta medica general | 85121502 | E48 |
| Servicios medicos especializados | 85121800 (default) | E48 |
| Psicologia | 85121608 | E48 |
| Nutricion | 85121609 | E48 |
| Analisis clinicos/laboratorio | 85141600 | E48 |

### Uso de CFDI por regimen del receptor

#### RESICO (626) — Codigos validos:

| Clave | Descripcion |
|---|---|
| G01 | Adquisicion de mercancias |
| G02 | Devoluciones, descuentos o bonificaciones |
| G03 | Gastos en general |
| I01-I08 | Inversiones (construcciones, mobiliario, transporte, computo, etc.) |
| S01 | Sin efectos fiscales |

> **D01-D10 son INVALIDOS para RESICO 626. El PAC rechaza el timbrado.**

#### Actividad Empresarial (612) — Codigos validos:

Todos los de RESICO (G01-G03, I01-I08, S01) **MAS:**

| Clave | Descripcion |
|---|---|
| D01 | Honorarios medicos, dentales y gastos hospitalarios |
| D02-D10 | Demas deducciones personales |

#### Factura Global (ambos regimenes):

| Campo | Valor |
|---|---|
| RFC receptor | XAXX010101000 |
| Nombre | PUBLICO EN GENERAL |
| RegimenFiscalReceptor | 616 |
| UsoCFDI | S01 |

### Metodo de pago: PUE vs PPD

| | PUE | PPD |
|---|---|---|
| Significado | Pago en Una sola Exhibicion | Pago en Parcialidades o Diferido |
| Cuando usar | Cobro ya recibido | Pago sera posterior |
| FormaPago | La forma real (01, 03, 04, 28) | **99** (Por definir) |
| Ingreso gravable | Mes de emision | Hasta emision del complemento de pago |
| Complemento de pago | NO | **SI** (obligatorio) |

> **Error critico en RESICO:** Usar PUE sin haber cobrado = pagar ISR e IVA sobre dinero no recibido.

### Complemento de Pagos 2.0

- Se emite solo cuando MetodoPago = PPD
- **Plazo: 5 dias naturales del mes siguiente al pago** (Regla 2.7.1.32 RMF 2026)
- Cada pago parcial requiere su propio complemento
- CFDI "sobre": SubTotal=0, Total=0, UsoCFDI=CP01, sin MetodoPago
- **Aplica identicamente para ambos regimenes (626 y 612)**
- A partir de 2025, **NO existe facilidad** para omitir el complemento (la excepcion anterior fue eliminada)

**Campos obligatorios:**
FechaPago, FormaDePagoP, MonedaP, Monto, IdDocumento (UUID original), NumParcialidad, ImpSaldoAnt, ImpPagado, ImpSaldoInsoluto, ObjetoImpDR

### PPD y momento de acumulacion de ingresos/deducciones

**Base legal:** Art. 102 LISR (PF acumulan ingresos cuando son **efectivamente cobrados**), Art. 105 LISR (deducciones cuando son **efectivamente pagadas**), Art. 27 frac. III LISR (deduccion requiere comprobante de pago).

Las personas fisicas (tanto 612 como 626 RESICO) operan en **base de flujo de efectivo**. Esto tiene implicaciones directas para facturas PPD:

#### Ingresos (facturas PPD emitidas)

| Escenario | Tratamiento ISR | Tratamiento IVA |
|---|---|---|
| PPD emitida, **con** complemento de pago | Ingreso acumulable en el **mes del pago** (fecha del complemento) | IVA trasladado en el mes del pago |
| PPD emitida, **sin** complemento (no cobrada) | **NO** se acumula — ingreso no comprobado como recibido | **NO** se considera IVA cobrado |
| PUE emitida | Ingreso acumulable en el mes de emision | IVA trasladado en el mes de emision |

#### Deducciones (facturas PPD recibidas)

| Escenario | Tratamiento ISR (612) | Tratamiento IVA (ambos) |
|---|---|---|
| PPD recibida, **con** complemento de pago | Deducible en el **mes del pago** | IVA acreditable en el mes del pago |
| PPD recibida, **sin** complemento (pagada pero sin REP) | **NO deducible** — Art. 27 frac. III LISR requiere comprobante de pago | **NO acreditable** — Art. 5 frac. II LIVA |
| PPD recibida, sin complemento (no pagada) | No deducible (gasto no efectuado) | No acreditable |
| PUE recibida | Deducible en el mes de emision | IVA acreditable en el mes de emision |

#### Problema: pago realizado pero proveedor no emite complemento

El receptor de una factura PPD **no controla** la emision del complemento — depende del proveedor. Si el proveedor no lo emite:

1. **Exigir al proveedor:** Solicitar formalmente el complemento. El proveedor tiene obligacion legal de emitirlo (Art. 29-A frac. VII inciso b CFF).
2. **Denuncia ante SAT:** Presentar queja en [sat.gob.mx/quejas](https://www.sat.gob.mx/aplicacion/50409/presenta-tu-queja-o-denuncia) o al 55-88-52-22-22. El SAT puede sancionar al proveedor con multa de $450-$670 MXN por complemento no emitido (Art. 84 frac. IV inciso D CFF).
3. **Estado de cuenta bancario como prueba alternativa:** Art. 29-B frac. II del CFF permite usar estados de cuenta bancarios como comprobante fiscal alternativo para deducciones, siempre que:
   - El estado muestre el RFC de ambas partes
   - La transaccion este debidamente registrada en contabilidad
   - Se trate de actividades gravadas dentro de los montos maximos que establezca el SAT
4. **Limitacion:** La via del estado de cuenta bancario es un recurso de ultima instancia. Los auditores del SAT prefieren el complemento, y el acreditamiento de IVA puede no estar cubierto solo con el estado de cuenta.

> **Recomendacion para la app:** Las facturas PPD recibidas sin complemento deben mostrarse como **"Pendiente de complemento — no deducible aun"**, NO excluirse silenciosamente. El doctor necesita visibilidad para exigir el REP al proveedor.

### Notas de credito (CFDI Egreso)

- CFDI tipo "E"
- Debe incluir nodo CfdiRelacionados con UUID original
- **NO usar para cancelar facturas** (practica rechazada por SAT y AMEXIPAC)
- Uso CFDI del receptor: G02

### Cancelacion de CFDI

#### Motivos:

| Codigo | Cuando usar | Nota |
|---|---|---|
| 01 | Error; hay reemplazo | **Timbrar reemplazo PRIMERO**, luego cancelar ligando UUID nuevo |
| 02 | Error; sin sustitucion | No habra CFDI de reemplazo |
| 03 | Operacion no realizada | Transaccion nunca ocurrio |
| 04 | Factura global | Cliente pide factura individual |

#### Proceso:
1. Validar estado actual del CFDI
2. Para motivo 01: **timbrar reemplazo PRIMERO**
3. Enviar cancelacion via SAT/PAC
4. Receptor tiene **72 horas** para aceptar/rechazar (silencio = aceptacion tacita)

#### Plazos maximos de cancelacion:
- PM: **31 de marzo** del ano N+1
- PF: **30 de abril** del ano N+1

#### Penalidades:
- Cancelacion fuera de plazo: **5% a 10% del monto** de cada CFDI (CFF)

### Plazos de emision de CFDI

| Escenario | Plazo |
|---|---|
| Venta con pago inmediato (PUE) | Mismo dia |
| Complemento de Pagos (PPD) | 5 dias naturales del mes siguiente (Regla 2.7.1.32 RMF 2026) |
| Nomina | Dentro del periodo de pago |
| CFDI de Retenciones | Al momento del pago o 24 horas |
| Factura Global | 24 horas despues del cierre del periodo |

### Retenciones de ISR en CFDI

| Regimen emisor | Tasa retencion ISR por PM | Indicacion en CFDI |
|---|---|---|
| 612 (Act. Empresarial) | **10%** | ISR, Tasa, 0.10 |
| 626 (RESICO) | **1.25%** | ISR, Tasa, 0.0125 |
| PF a PF | Generalmente **NO** retienen | — |

### Errores comunes en facturacion

**Ambos regimenes:**
1. Codigo postal incorrecto (causa #1 de rechazo)
2. Nombre no coincide con Constancia (debe ser MAYUSCULAS exactas)
3. RFC inactivo del receptor
4. PPD con FormaPago diferente de "99"
5. PUE con FormaPago "99"
6. TaxObject "01" con nodo Taxes (Facturama rechaza)
7. Issuer.Name no coincide con CSD (usar TaxName de Facturama, no razonSocial)

**RESICO (626):**
8. Usar D01-D10 (rechazo en timbrado)
9. No emitir CFDI por todos los ingresos
10. Usar regimen 601 o 612 cuando esta registrado como 626

**Actividad Empresarial (612):**
11. No rastrear deducciones (requiere contabilidad formal)
12. Mezclar deducciones personales (D01-D10) con empresariales (G01-G03)
13. No emitir CFDI de retenciones al pagar honorarios a terceros

---

## Parte IV — Obligaciones Mensuales (Comparativa)

| Obligacion | RESICO (626) | Actividad Empresarial (612) |
|---|---|---|
| ISR mensual | Tasa fija sobre ingreso bruto | Tarifa progresiva sobre utilidad neta |
| Calculo ISR | `Ingreso cobrado x Tasa` | `(Ingresos - Deducciones) acumulados → Art. 96` |
| IVA mensual | SI, dia 17 | SI, dia 17 |
| DIOT | **Relevado** | Obligatoria (salvo <$4M con Mi Contabilidad) |
| Emitir CFDI ingresos | SI | SI |
| Obtener CFDI gastos | Solo para IVA acreditable | **Obligatorio** para deducciones |
| Retencion ISR por PM | 1.25% | 10% |
| Retencion IVA por PM | Reglas generales | 10.67% (2/3 IVA) |
| Contabilidad electronica | NO | SI (>$4M) |

---

## Parte V — Obligaciones Anuales (Comparativa)

| Obligacion | RESICO (626) | Actividad Empresarial (612) |
|---|---|---|
| Declaracion anual | SI, 30 abril (Art. 113-F) | SI, abril (Art. 152) |
| Deducciones personales | NO | SI (Art. 151) |
| Perdidas fiscales | NO | SI (10 anos) |
| PTU | N/A | SI (con empleados, 10%) |
| Estado financiero | NO | SI (al 31 dic) |
| Inventario fisico | NO | SI (al 31 dic) |
| Informativas | Minimas | SI |

---

## Parte VI — Sistema de Clasificacion de Deducibilidad (App)

### Pipeline de clasificacion por CFDI recibido

```
CFDI recibido
    |
    v
1. usoCfdi (campo del XML)
    S01 → NO deducible / sin IVA acreditable
    G01/G03 → gasto operativo
    I0x → inversion (depreciable)
    D0x → deduccion personal (solo 612, solo anual; INVALIDO en 626)
    |
    v
2. claveProdServ (UNSPSC 8 digitos)
    42xxxxxx → insumos medicos
    43xxxxxx → computo
    85xxxxxx → servicios profesionales/salud
    |
    v
3. Keyword matching (fallback)
    |
    v
4. Sin Clasificar (default)
```

### Reglas de deducibilidad por regimen

#### Regimen 612 — Deducciones para ISR

**Base legal:** Art. 103 LISR (deducciones autorizadas), Art. 105 LISR (requisitos)

| Flag | Severidad | Regla |
|---|---|---|
| cash_over_2k | Error | Efectivo > $2,000 = NO deducible (Art. 105 LISR) |
| sin_efectos | Error | Uso CFDI S01 = NO deducible |
| cancelled | Error | CFDI cancelado |
| proportional | Warning | Servicios basicos/vehiculo: solo parte profesional |
| generic_description | Warning | Descripcion vaga, SAT puede rechazar |
| high_amount | Info | Gasto > $50,000, verificar documentacion |
| foreign_currency | Info | Moneda extranjera, verificar tipo de cambio |
| sin_clasificar | Info | Requiere revision manual |
| no_xml | Info | Sin detalles XML |

#### Regimen 626 (RESICO) — Solo IVA acreditable

**Base legal:** Art. 113-E a 113-J LISR; IVA acreditable per Regla 3.13.20 RMF y Art. 5 LIVA

| Flag | Severidad | Regla |
|---|---|---|
| sin_efectos | Error | Uso CFDI S01 = sin IVA acreditable |
| cancelled | Error | CFDI cancelado |
| cash_over_2k | Warning | Efectivo > $2,000 = IVA no acreditable sin bancarizacion |
| deduccion_personal_resico | Warning | D01-D10: RESICO no puede aplicar |
| sin_clasificar | Info | Requiere revision manual |
| no_xml | Info | Sin detalles XML |

**NO aplican en RESICO:** `proportional`, tarifa ISR progresiva

### Categorias implementadas

| ID | Nombre | claveProdServ (divisiones) |
|---|---|---|
| renta | Renta de Consultorio | 8013, 8014 |
| insumos | Insumos y Material Medico | 4200-4212 |
| equipo_medico | Equipo Medico | 4213-4229, 6010-6014 |
| computo | Equipo de Computo y Software | 4320-4323, 8111, 8116 |
| mobiliario | Mobiliario y Equipo de Oficina | 5610-5612 |
| servicios_profesionales | Servicios Profesionales | 8010-8016, 8510-8514, 8410-8412 |
| seguros | Seguros y Fianzas | 8413 |
| servicios_basicos | Servicios Basicos | 8310-8312 |
| capacitacion | Capacitacion y Desarrollo | 8610-8613 |
| vehiculo | Vehiculo y Transporte | 7810-7818, 2517, 1510-1512 |
| nomina | Sueldos y Nomina | 8011 |
| alimentos | Alimentos y Viajes | 9010-9015, 5000-5039 |
| papeleria | Papeleria y Limpieza | 4410-4412, 1411, 7610-7612, 4713 |
| sin_clasificar | Sin Clasificar | (fallback) |

### Depreciacion por categoria (Art. 34 LISR — corregido)

| Categoria app | Tipo ISR | Tasa depreciacion | Referencia |
|---|---|---|---|
| renta | 100% gasto | N/A | Art. 103 frac. III |
| insumos | 100% gasto | N/A | Art. 103 frac. II |
| equipo_medico | Depreciable | 10% general (verificar sector) | Art. 34 |
| computo | Depreciable | 30% anual | Art. 34 |
| mobiliario | Depreciable | 10% anual | Art. 34 |
| servicios_profesionales | 100% gasto | N/A | Art. 103 frac. III |
| seguros | 100% gasto | N/A | Art. 103 |
| servicios_basicos | Proporcional | N/A (solo % uso profesional) | Art. 105 |
| vehiculo | Proporcional/dep. | 25% anual, tope MOI ~$175K | Art. 34 |
| nomina | 100% gasto | N/A | Art. 103 |
| alimentos | Parcial | N/A (8.5% a 50% segun caso) | Art. 28 LISR |

### Diferencias UI por regimen

| Elemento | 612 | 626 (RESICO) |
|---|---|---|
| Titulo tab | "Deducciones Fiscales" | "Gastos del Ejercicio" |
| Banner | (ninguno) | "Tus gastos no reducen ISR, pero el IVA si es acreditable" |
| Card no deducible | "No Deducible" | "Sin IVA Acreditable" |
| Flag efectivo >$2k | Error: "no deducible" | Warning: "IVA no acreditable" |
| Flag D01-D10 | No se muestra (aplica en anual) | Warning: "RESICO no puede aplicar" |
| Monitor ingresos | No | SI — barra de progreso vs $3.5M |

---

## Parte VII — Integracion SAT Descarga Masiva

### Arquitectura

| Componente | Detalle |
|---|---|
| Protocolo | SOAP (no REST), 4 endpoints |
| Auth | e.Firma (FIEL) — **NO sirve CSD** |
| Flujo | Asincrono: solicitar → polling → descargar (minutos a 72h) |
| Dependencias | Zero (Node.js built-in crypto, https, zlib) |
| Worker | Cron cada 15 min + state machine en DB |

### e.Firma vs CSD

| Aspecto | e.Firma (FIEL) | CSD |
|---|---|---|
| Proposito | Identificar contribuyente | Sellar CFDIs |
| Obtencion | Presencial en SAT | Online via Certifica |
| Descarga masiva | **SI** | NO |
| Emitir CFDIs (Facturama) | NO | **SI** |
| branchName en cert | Vacio | Con datos de sucursal |

Los doctores necesitan **ambos** conjuntos de credenciales subidos por separado.

### Flujo de 4 pasos

1. **Autenticacion** → JWT token (10 min expiracion)
2. **Solicitud** → IdSolicitud (emitidos/recibidos, metadata/XML)
3. **Verificacion** → Polling hasta status "Terminada"
4. **Descarga** → ZIP con TXT (metadata) o XMLs

### Metadata TXT — 12 columnas (confirmado por PoC)

Uuid ~ RfcEmisor ~ NombreEmisor ~ RfcReceptor ~ NombreReceptor ~ PacCertifico ~ FechaEmision ~ FechaCertificacionSat ~ Monto ~ EfectoComprobante ~ Estatus ~ FechaCancelacion

- Delimitador: `~`
- Estatus: `1` = Vigente, `0` = Cancelado (numerico)
- EfectoComprobante: `I`, `E`, `P`, `T` (letras)

### Gotchas criticos SAT

1. Subdominio diferente para Descarga vs otros 3 servicios
2. Namespace inconsistente en SOAPAction (.gob.mx vs .sat.gob.mx)
3. Atributos XML en orden alfabetico para firma
4. XML recibidos requiere `EstadoComprobante="Vigente"` (string, no numerico)
5. UUID case mismatch: metadata UPPERCASE, XML lowercase → usar `LOWER()` en JOINs

### Fases implementadas

| Fase | Status | Que incluye |
|---|---|---|
| 1. Metadata sync | COMPLETA | e.Firma upload, sync trigger, CFDI table, worker |
| 2. XML download | COMPLETA | XML parser zero-dep, detalles + conceptos, panel expandible |
| 3. Features avanzados | COMPLETA (9/9) | Export CSV, auto-sync, alertas, pagos tracking, backfill, declaraciones, deducibilidad, cashflow, calendario fiscal |

---

## Parte VIII — Facturama API Multiemisor

### Arquitectura

```
TuSalud Platform (cuenta Facturama)
    |-- Doctor A (RFC) -- CSD cargado -- emite CFDIs
    |-- Doctor B (RFC) -- CSD cargado -- emite CFDIs
```

- Auth: Basic Auth (user:password base64)
- Sandbox: `https://apisandbox.facturama.mx`
- Produccion: `https://api.facturama.mx`
- Type: `issuedLite` (NO `issued`)

### Endpoints principales

| Operacion | Endpoint |
|---|---|
| Registrar CSD | POST /api-lite/csds |
| Actualizar CSD | PUT /api-lite/csds/{rfc} |
| Emitir CFDI | POST /api-lite/3/cfdis |
| Detalle CFDI | GET /api-lite/cfdis/{id} |
| Descargar PDF/XML/HTML | GET /cfdi/{format}/issuedLite/{id} |
| Cancelar | DELETE /api-lite/cfdis/{id}?rfc=&motive= |
| Acuse cancelacion | GET /acuse/{format}/issuedLite/{id} |
| Enviar email | POST /cfdi?CfdiType=issuedLite&CfdiId=&Email= |
| Listar | GET /cfdi?type=issuedLite&rfcIssuer= |
| Validar RFC | POST /customers/validate (consume 1 folio) |
| Status CFDI SAT | GET /cfdi/status (consume 1 folio) |

### Lecciones de integracion (confirmadas en sandbox)

1. Issuer.Name debe coincidir con el CSD (usar TaxName de Facturama, NO razonSocial del SAT)
2. TaxObject "01" es incompatible con cualquier nodo Taxes (ni array vacio)
3. Facturama retorna CfdiType como palabra ("Ingreso") no letra ("I")
4. En sandbox, RFCs receptor deben coincidir con datos SAT de prueba
5. Catalogos pueden retornar cualquier shape → `Array.isArray()` + fallback offline
6. Folio es obligatorio en Multiemisor (auto-generar si no se proporciona)
7. Nombres siempre en UPPERCASE

---

## Parte IX — Cuando Conviene Cada Regimen

### Elige RESICO (626) cuando:
- Ingresos < $3,500,000 MXN/ano
- Pocos gastos deducibles (margen operativo alto)
- Buscas simplicidad maxima
- Freelancer, profesionista independiente, arrendador
- No necesitas amortizar perdidas fiscales
- No tienes empleados

### Elige Actividad Empresarial / Honorarios (612) cuando:
- Ingresos > $3,500,000 (obligatorio)
- Gastos operativos > 50% de ingresos
- Necesitas amortizar perdidas fiscales
- Tienes empleados (nomina + PTU deducible)
- Depreciacion significativa de activos
- Necesitas deducciones personales en anual
- Planeacion fiscal sofisticada
- Eres doctor independiente cobrando honorarios con gastos significativos

### Punto de equilibrio

Si gastos deducibles son < 60-70% de ingresos y ganas < $3.5M → RESICO casi siempre gana.

| Escenario | Ingreso | Gastos | RESICO ISR | 612 ISR (aprox.) |
|---|---|---|---|---|
| Bajo costo | $600K | $60K (10%) | $6,600 (1.1%) | ~$95K+ |
| Costos medios | $1.5M | $900K (60%) | $30K (2%) | ~$95K |
| Alto costo | $2M | $1.7M (85%) | $40K (2%) | ~$28K |

En el tercer escenario, el 612 genera MENOS ISR por las deducciones.

---

## Fuentes Principales

### Oficiales SAT
- [SAT - RESICO](https://www.sat.gob.mx/portal/public/personas-fisicas/pf-simplificado-de-confianza)
- [SAT - Actividad Empresarial](https://www.sat.gob.mx/consulta/04950/conoce-el-regimen-de-actividad-empresarial-y-profesional)
- [SAT - Obligaciones Actividades Empresariales](https://www.sat.gob.mx/consulta/30167/conoce-cuales-son-las-obligaciones-fiscales-del-regimen-de-actividades-empresariales)
- [SAT - Anexo 8 RMF 2026 (DOF 28/12/2025)](https://www.sat.gob.mx/minisitio/NormatividadRMFyRGCE/documentos2026/rmf/anexos/Anexo-8-RMF-2026_DOF-28122025.pdf)
- [SAT - Cancelacion CFDI](https://www.sat.gob.mx/minisitio/Factura/cancela_procesocancelacion.htm)
- [SAT - Descarga Masiva](https://www.sat.gob.mx/consultas/42968/consulta-y-recuperacion-de-comprobantes-(nuevo))

### Legislacion
- [LISR Arts. 113-E a 113-J (RESICO)](https://mexico.justia.com/federales/leyes/ley-del-impuesto-sobre-la-renta/titulo-iv/capitulo-ii/seccion-iv/)
- [LISR Arts. 100-110 (Actividades Empresariales)](https://mexico.justia.com/federales/leyes/ley-del-impuesto-sobre-la-renta/titulo-iv/capitulo-ii/seccion-i/)

### Facturama
- [Facturama API Multiemisor](https://facturama.elevio.help/es/articles/141)
- [Facturama Sandbox](https://apisandbox.facturama.mx)

### Especializadas
- [ContadorMx - Cancelacion CFDI 2026](https://contadormx.com/cancelacion-de-cfdi-en-2026/)
- [Siempre al Dia - Complemento de Pago](https://siemprealdia.co/mexico/fiscal/complemento-de-pago-cfdi/)
- [AMEXIPAC - Notas de credito NO cancelan facturas](https://amexipac.org/notas-de-credito-por-cfdi-por-que-no-es-recomendable/)
- [INDETEC - Tarifa ISR 2026](https://www.indetec.gob.mx/delivery?srv=0&sl=2&route=%2Fnoticias_interes%2FActualizacion-de-tarifa-ISR-para-personas-fisicas-aplicable-en-2026&ext=.pdf)
