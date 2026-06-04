# Sistema de Clasificacion y Deducibilidad de Gastos

## Contexto

El tab "Deducciones" en `/dashboard/sat-descarga` clasifica automaticamente los CFDIs recibidos (gastos) del doctor en categorias fiscales y evalua su deducibilidad. El sistema se adapta segun el regimen fiscal del usuario (leido de `/dashboard/facturacion` tab Configuracion → `doctorFiscalProfile.regimenFiscal`).

**Regimenes soportados:**
- **612** — Personas Fisicas con Actividades Empresariales y Profesionales
- **626** — RESICO (Regimen Simplificado de Confianza)

---

## Arquitectura del Sistema

### Pipeline de clasificacion (por CFDI recibido)

```
CFDI recibido
    |
    v
1. usoCfdi (campo del XML) ──────────────> Determina deducibilidad
    |                                        S01 = NO deducible
    |                                        G01/G03 = gasto operativo
    |                                        I0x = inversion (depreciable)
    |                                        D0x = deduccion personal
    v
2. claveProdServ (codigo UNSPSC) ────────> Clasifica en categoria
    |                                        42xxxxxx = insumos medicos
    |                                        43xxxxxx = computo
    |                                        90xxxxxx = alimentos/viajes
    |                                        etc.
    v
3. Keyword matching (descripcion) ───────> Fallback si clave no matchea
    |                                        "renta" → renta
    |                                        "gasolina" → vehiculo
    |                                        etc.
    v
4. Sin Clasificar ───────────────────────> Default si nada matchea
```

### Archivos clave

| Archivo | Funcion |
|---|---|
| `apps/api/src/lib/deduction-categories.ts` | Categorias, rangos claveProdServ, keywords, logica de deducibilidad |
| `apps/api/src/app/api/sat-descarga/deductions/route.ts` | API que agrega gastos por categoria y mes |
| `apps/api/src/app/api/sat-descarga/check-deducibility/route.ts` | Escaneo extendido de deducibilidad (flags detallados) |
| `apps/doctor/src/app/dashboard/sat-descarga/page.tsx` | UI del tab Deducciones (`DeduccionesTab` component) |

---

## Reglas por Regimen Fiscal

### Regimen 612 — Actividad Empresarial y Profesional

**Fuente:** Art. 25-35 LISR, Art. 27 LISR (requisitos de deducciones)

**Deducciones autorizadas para ISR:**
- Gastos estrictamente indispensables para la actividad (Art. 27 frac. I LISR)
- Deben estar amparados con CFDI valido
- Deben estar efectivamente pagados en el ejercicio
- Pagos > $2,000 MXN deben ser bancarizados (Art. 27 frac. III LISR)

**Gastos deducibles tipicos para medicos:**

| Categoria | Deducibilidad | Depreciacion | Referencia |
|---|---|---|---|
| Renta de consultorio | 100% | N/A | Art. 25 frac. III |
| Insumos y material medico | 100% | N/A | Art. 25 frac. II |
| Equipo medico | Depreciable | 25% anual | Art. 35 frac. XIV |
| Equipo de computo | Depreciable | 30% anual | Art. 35 frac. IX |
| Mobiliario | Depreciable | 10% anual | Art. 35 frac. IV |
| Servicios profesionales | 100% | N/A | Art. 25 frac. III |
| Seguros | 100% | N/A | Art. 25 frac. X |
| Servicios basicos | Proporcional | N/A | Solo % uso profesional |
| Capacitacion | 100% | N/A | Art. 25 frac. III |
| Vehiculo | Proporcional/dep. | 25% anual, tope $175k | Art. 36 frac. II |
| Nomina | 100% | N/A | Art. 25 frac. V |
| Alimentos | Parcial | N/A | 8.5% a 50% segun caso |

**Flags de deducibilidad que aplican:**
- `cash_over_2k` (error) — Efectivo > $2,000 = NO deducible
- `sin_efectos` (error) — Uso CFDI S01 = NO deducible
- `cancelled` (error) — CFDI cancelado
- `proportional` (warning) — Servicios basicos/vehiculo: solo parte profesional
- `sin_clasificar` (info) — No se pudo clasificar, requiere revision manual
- `no_xml` (info) — Sin detalles XML
- `generic_description` (warning) — Descripcion vaga, SAT puede rechazar
- `high_amount` (info) — Gasto > $50,000
- `foreign_currency` (info) — Moneda extranjera

**Calculo ISR mensual provisional:**
```
Base = Ingresos acumulados - Deducciones acumuladas
ISR = Tabla Art. 96 LISR (tasas 1.92% a 35%)
```

**Fuentes consultadas:**
- [Las deducciones de una persona fisica con actividad empresarial — QuickBooks](https://quickbooks.intuit.com/global/resources/es/contabilidad-y-registro-contable/las-deducciones-de-una-persona-fisica-con-actividad-empresarial/)
- [Gastos deducibles Actividad Empresarial — Heru](https://www.heru.app/blog/que-gastos-son-deducibles-para-el-regimen-de-actividades-empresariales-y-profesionales/)
- [Deducciones autorizadas personas fisicas y morales — Facturama](https://facturama.mx/blog/deducciones-autorizadas/)
- [Gastos deducibles 2026 lista completa SAT — Gigstack](https://blog.gigstack.pro/post/gastos-deducibles-2026-lista-completa-sat-mexico)

---

### Regimen 626 — RESICO (Regimen Simplificado de Confianza)

**Fuente:** Art. 113-E a 113-J LISR, Regla 3.13.20 RMF 2025/2026

**ISR: NO se deducen gastos**
- ISR se calcula sobre ingresos brutos cobrados a tasa fija (1% a 2.5% segun tabla)
- Los gastos del negocio NO reducen la base de ISR
- NO aplican deducciones personales (D01-D10) en declaracion anual

**IVA: SI se acredita**
- Per regla 3.13.20 de la Resolucion Miscelanea Fiscal (RMF), los contribuyentes en RESICO SI pueden acreditar IVA
- El IVA de gastos relacionados con la actividad se resta del IVA cobrado a clientes

**Requisitos para acreditar IVA en RESICO:**
1. El gasto debe ser estrictamente indispensable para la actividad economica
2. Debe tener CFDI con IVA correctamente desglosado
3. El pago debe realizarse con medios electronicos/bancarios
4. El gasto debe estar directamente relacionado con la actividad profesional

**Flags de deducibilidad que aplican en RESICO:**
- `sin_efectos` (error) — Uso CFDI S01 = sin IVA acreditable
- `cash_over_2k` (warning) — Efectivo > $2,000 = IVA no acreditable sin bancarizacion
- `deduccion_personal_resico` (warning) — Uso D01-D10: RESICO no puede aplicar deducciones personales
- `cancelled` (error) — CFDI cancelado
- `sin_clasificar` (info) — No se pudo clasificar
- `no_xml` (info) — Sin detalles XML

**NO aplican en RESICO:**
- `proportional` — No relevante ya que no hay deduccion ISR
- Tabla ISR progresiva — RESICO usa tasa fija

**Monitor de ingresos RESICO:**
- Limite anual: $3,500,000 MXN
- Si se excede, el SAT puede cambiar al contribuyente a regimen 612
- El sistema muestra barra de progreso con % del limite usado

**Fuentes consultadas:**
- [Como acreditar IVA en RESICO — Simmple](https://www.simmple.mx/post/c%C3%B3mo-acreditar-iva-en-resico-requisitos-y-paso-a-paso)
- [IVA en RESICO: Como Funciona 2025 — TaxDown](https://taxdown.com.mx/resico/iva-resico)
- [Deducciones para Personas Fisicas en RESICO — TaxDown](https://taxdown.com.mx/deducciones/deducciones-personales-resico)
- [Puntos basicos para entender el RESICO — Contadores Mexico](https://www.contadoresmexico.org.mx/Vida-colegiada/Puntos-basicos-para-entender-el-Resico)
- [Requisitos para acreditar IVA en RESICO — MisKuentas](https://www.miskuentas.com/noticias/uncategorized/requisitos-para-acreditar-el-iva-en-el-resico/)

---

## Clasificacion por usoCfdi

El campo `usoCfdi` del XML es la senal primaria de deducibilidad. El SAT exige que el uso del CFDI sea consistente con el regimen fiscal del receptor.

| Codigo | Nombre | Tipo | Deducible 612 | IVA acreditable 626 |
|---|---|---|---|---|
| G01 | Adquisicion de mercancias | Gasto operativo | Si | Si |
| G02 | Devoluciones, descuentos | Gasto operativo | Si | Si |
| G03 | Gastos en general | Gasto operativo | Si | Si |
| I01 | Construcciones | Inversion | Si (depreciable) | Si |
| I02 | Mobiliario y equipo | Inversion | Si (depreciable) | Si |
| I03 | Equipo de transporte | Inversion | Si (depreciable) | Si |
| I04 | Equipo de computo | Inversion | Si (depreciable) | Si |
| I05 | Dados, troqueles, moldes | Inversion | Si (depreciable) | Si |
| I06 | Comunicaciones telefonicas | Inversion | Si (depreciable) | Si |
| I07 | Comunicaciones satelitales | Inversion | Si (depreciable) | Si |
| I08 | Otra maquinaria y equipo | Inversion | Si (depreciable) | Si |
| D01 | Honorarios medicos/dentales | Deduccion personal | Solo anual | NO en RESICO |
| D02 | Gastos medicos por incapacidad | Deduccion personal | Solo anual | NO en RESICO |
| D03 | Gastos funerales | Deduccion personal | Solo anual | NO en RESICO |
| D04 | Donativos | Deduccion personal | Solo anual | NO en RESICO |
| D05 | Intereses hipotecarios | Deduccion personal | Solo anual | NO en RESICO |
| D06 | Aportaciones voluntarias SAR | Deduccion personal | Solo anual | NO en RESICO |
| D07 | Primas de seguros medicos | Deduccion personal | Solo anual | NO en RESICO |
| D08 | Gastos de transporte escolar | Deduccion personal | Solo anual | NO en RESICO |
| D09 | Depositos cuentas de ahorro | Deduccion personal | Solo anual | NO en RESICO |
| D10 | Pagos por servicios educativos | Deduccion personal | Solo anual | NO en RESICO |
| S01 | Sin efectos fiscales | Sin efectos | NO | NO |
| CP01 | Pagos | Complemento pago | N/A | N/A |

**Fuentes:**
- [Uso CFDI: que significa G01, G03, S01 — ChecaFactura](https://checafactura.com/blog/uso-cfdi-cual-elegir)
- [Catalogo de Usos de CFDI 4.0 — XPD](https://xpd.mx/blog/catalogo-de-claves-usos-de-cfdi-4-0-consulta-en-linea.html)
- [Uso de CFDI segun regimen fiscal 2026 — Fiscalify](https://www.fiscalify.com/blog/uso-cfdi-segun-regimen-fiscal)
- [Catalogo uso CFDI — Siigo Aspel](https://www.siigo.com/mx/blog/obligaciones-fiscales/catalogo-usos-claves-cfdi-sat/)

---

## Categorias de Clasificacion (claveProdServ)

El sistema usa el codigo UNSPSC (8 digitos) del campo `claveProdServ` de cada concepto para clasificar automaticamente. Si no matchea, usa keyword matching en la descripcion.

### Categorias implementadas

| ID | Nombre | Icono | claveProdServ (divisiones) | Keywords |
|---|---|---|---|---|
| renta | Renta de Consultorio | 🏢 | 8013, 8014 | renta, arrendamiento, consultorio |
| insumos | Insumos y Material Medico | 💊 | 4200-4212 | guantes, jeringas, gasas, sutura |
| equipo_medico | Equipo Medico | 🩺 | 4213-4229, 6010-6014 | ultrasonido, estetoscopio, autoclave |
| computo | Equipo de Computo y Software | 💻 | 4320-4323, 8111, 8116 | computadora, laptop, software, hosting |
| mobiliario | Mobiliario y Equipo de Oficina | 🪑 | 5610-5612 | escritorio, silla, archivero, camilla |
| servicios_profesionales | Servicios Profesionales | 👔 | 8010-8016, 8510-8514, 8410-8412 | honorarios, contabilidad, laboratorio |
| seguros | Seguros y Fianzas | 🛡️ | 8413 | seguro, poliza, fianza |
| servicios_basicos | Servicios Basicos | 💡 | 8310-8312 | luz, agua, telefono, internet, CFE |
| capacitacion | Capacitacion y Desarrollo | 🎓 | 8610-8613 | curso, congreso, diplomado, certificacion |
| vehiculo | Vehiculo y Transporte | 🚗 | 7810-7818, 2517, 1510-1512 | gasolina, caseta, estacionamiento |
| nomina | Sueldos y Nomina | 👥 | 8011 | nomina, salario, IMSS, INFONAVIT |
| alimentos | Alimentos y Viajes | 🍽️ | 9010-9015, 5000-5039 | restaurante, hotel, vuelo, uber |
| papeleria | Papeleria y Limpieza | 🧹 | 4410-4412, 1411, 7610-7612, 4713 | papeleria, limpieza, toner, uniforme |
| sin_clasificar | Sin Clasificar | ❓ | (ninguno — fallback) | (ninguno — fallback) |

### Taxonomia UNSPSC (referencia SAT)

La estructura de 8 digitos sigue el estandar UNSPSC adoptado por el SAT:
```
XX       Division (2 digitos)
  XX     Grupo
    XX   Clase
      XX Commodidad
```

**Divisiones principales para gastos de un consultorio medico:**

| Division | Descripcion | Categoria asignada |
|---|---|---|
| 14 | Productos de papel | papeleria |
| 15 | Combustibles y lubricantes | vehiculo |
| 25 | Vehiculos y componentes | vehiculo |
| 42 | Equipos y suministros medicos | insumos / equipo_medico |
| 43 | Equipos de TI y telecomunicaciones | computo |
| 44 | Equipos y suministros de oficina | papeleria |
| 47 | Equipos de limpieza | papeleria |
| 50 | Alimentos y bebidas | alimentos |
| 56 | Muebles y mobiliario | mobiliario |
| 60 | Equipos de laboratorio | equipo_medico |
| 72 | Construccion y mantenimiento | sin_clasificar |
| 76 | Servicios de limpieza | papeleria |
| 78 | Transporte y logistica | vehiculo |
| 80 | Servicios de gestion/profesionales | servicios_profesionales / renta |
| 81 | Servicios de ingenieria/IT | computo |
| 83 | Servicios publicos (utilities) | servicios_basicos |
| 84 | Servicios financieros/seguros | servicios_profesionales / seguros |
| 85 | Servicios de salud | servicios_profesionales |
| 86 | Servicios educativos | capacitacion |
| 90 | Viajes, alimentos, hospedaje | alimentos |

**Fuentes:**
- [Catalogo SAT Claves Productos Servicios 2026 — SAT Facil](https://www.satfacil.com.mx/blog/catalogo-sat-claves-productos-servicios-2026)
- [Catalogo productos y servicios SAT — Fiscalapi](https://fiscalapi.com/blog/catalogo-de-productos-y-servicios-sat)
- [Catalogo SAT Claves de Productos y Servicios CFDI 4.0 — ContadorMx](https://cfdi.contadormx.net/catalogo/productos-servicios)
- [SAT — Catalogo de Productos y Servicios oficial](https://www.sat.gob.mx/consultas/53693/catalogo-de-productos-y-servicios)

---

## Diferencias clave en el UI por regimen

| Elemento UI | 612 | 626 (RESICO) |
|---|---|---|
| Titulo del tab | "Deducciones Fiscales" | "Gastos del Ejercicio" |
| Banner | (ninguno) | "Tus gastos no reducen ISR, pero el IVA si es acreditable" |
| Card "No Deducible" | "No Deducible" (S01 + efectivo + cancelados) | "Sin IVA Acreditable" (S01 + efectivo) |
| Card IVA | "Para declaracion mensual" | "Aplica en RESICO (regla 3.13.20)" |
| Flag efectivo >$2k | Error: "no deducible" | Warning: "IVA no acreditable" |
| Flag proporcional | Si (servicios basicos, vehiculo) | No aplica |
| Flag D01-D10 | (no se muestra — aplica en anual) | Warning: "RESICO no puede aplicar" |
| Monitor de ingresos | No | Si — barra de progreso vs limite $3.5M |
| Titulo categorias | "Categorias de Deduccion" | "Desglose por Categoria" |

---

## Mejoras futuras

- [ ] Permitir al usuario reclasificar manualmente un CFDI "Sin Clasificar"
- [ ] Agregar reglas para Division 72 (construccion/remodelacion de consultorio)
- [ ] Integrar con la declaracion mensual para pre-calcular ISR provisional (612)
- [ ] Mostrar desglose de IVA acreditable vs IVA retenido en RESICO
- [ ] Agregar validacion cruzada: si el usoCfdi es I0x pero la claveProdServ no es equipo, alertar
- [ ] Considerar regimen 606 (Arrendamiento) para doctores que rentan consultorios propios
