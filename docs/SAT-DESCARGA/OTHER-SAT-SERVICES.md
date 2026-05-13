# Otros Servicios del SAT Disponibles Programaticamente

**Fecha:** 2026-05-13
**Status:** Investigacion inicial — ninguno implementado aun

---

## Resumen

Ademas de la Descarga Masiva de CFDIs (ya implementada como PoC), el SAT expone otros datos y documentos que se pueden obtener programaticamente. Sin embargo, **solo la Descarga Masiva tiene un web service SOAP oficial**. Todo lo demas requiere **web scraping del portal SAT** (HTTP requests simulando sesiones de navegador tras login con e.Firma).

**Fuente principal de referencia:** [python-satcfdi](https://github.com/SAT-CFDI/python-satcfdi) — la libreria open-source mas madura (138 stars, 141 releases), que implementa todos estos servicios.

---

## Servicios con Web Service Oficial (SOAP)

### 1. Descarga Masiva de CFDIs (YA IMPLEMENTADO)

- **Datos:** Metadata TXT (12 campos) o XMLs completos de CFDIs emitidos/recibidos
- **Auth:** e.Firma (SOAP + WS-Security)
- **Status:** PoC completo, 4 pasos funcionando
- **Documentacion:** Ver `OVERVIEW.md`, `ARCHITECTURE.md`, `SAT-API-TECHNICAL-REFERENCE.md`, `SOAP-TEMPLATES.md`

### 2. Descarga Masiva de Retenciones

- **Datos:** CFDIs de retenciones (ISR, IVA, dividendos, etc.)
- **Auth:** e.Firma (misma mecanica que CFDIs, endpoints diferentes)
- **Endpoints:** Mismos 4 pasos pero en subdominio `retendescargamasivasolicitud.clouda.sat.gob.mx`
- **Status:** No implementado, pero la misma logica del PoC de CFDIs aplica
- **Relevancia para doctores:** Media — retenciones de ISR cuando facturan a personas morales

---

## Servicios via Web Scraping del Portal SAT

Estos servicios NO tienen API oficial. Se acceden simulando el login al portal del SAT y navegando las paginas programaticamente.

### 3. Constancia de Situacion Fiscal (CSF)

- **Datos:** RFC, razon social, regimen fiscal, domicilio fiscal, fecha inicio actividades, regimenes fiscales activos con fechas
- **Como funciona:**
  - **Metodo 1 (sin auth):** HTTP GET al endpoint QR validator del SAT con parametros `rfc` + `id_cif` (el codigo del QR impreso en la constancia). Parsear HTML con selectores CSS. No requiere autenticacion.
  - **Metodo 2 (con auth):** Login al portal SAT con e.Firma → generar constancia como PDF
- **Relevancia para doctores:** ALTA
  - Validar datos fiscales de pacientes antes de facturar
  - Verificar regimen fiscal correcto del doctor
  - Obtener codigo postal fiscal (requerido para CFDI 4.0)
- **Implementacion referencia:** `python-satcfdi/satcfdi/csf/__init__.py` — usa `requests` + `BeautifulSoup`

### 4. Opinion de Cumplimiento (32-D)

- **Datos:** PDF que indica si un contribuyente esta "Positivo" (al corriente con obligaciones fiscales) o "Negativo"
- **Como funciona:** Login al portal SAT con e.Firma → navegar a seccion de opinion de cumplimiento → descargar PDF generado
- **Auth:** e.Firma (login via `loginda.siat.sat.gob.mx`)
- **Relevancia para doctores:** ALTA para modulo de prestamos
  - Verificar cumplimiento fiscal del solicitante antes de aprobar credito
  - Requerido por ley para contratos con gobierno
  - Indicador confiable de salud fiscal
- **Implementacion referencia:** `python-satcfdi/satcfdi/portal/__init__.py` clase `SATPortalOpinionCumplimiento`

### 5. Validacion de RFC / Razon Social

- **Datos:** Verificar si un RFC existe en el padron del SAT y obtener nombre/razon social
- **Como funciona:** Login al portal SAT Factura Electronica → consultar RFC
- **Auth:** e.Firma (portal login)
- **Funciones disponibles:**
  - `rfc_valid()` — verificar existencia de RFC
  - `legal_name_valid()` — obtener razon social registrada
- **Relevancia para doctores:** ALTA
  - Validar RFC del paciente antes de emitir factura (evitar errores y cancelaciones)
  - Auto-completar razon social del paciente
- **Implementacion referencia:** `python-satcfdi/satcfdi/portal/__init__.py` clase `SATFacturaElectronica`

### 6. Declaraciones Provisionales (Mensuales)

- **Datos:** Acceso a modulo de declaraciones provisionales/mensuales
- **Como funciona:** Login al portal SAT con e.Firma → redireccion al modulo de declaraciones
- **Auth:** e.Firma
- **Relevancia para doctores:** BAJA a MEDIA
  - Podria usarse para pre-llenar datos de declaraciones
  - Mas relevante para contadores que para la app directamente
- **Implementacion referencia:** `python-satcfdi/satcfdi/portal/__init__.py` metodo `declaraciones_provisionales_login()`

### 7. LCO (Lista de Contribuyentes Obligados)

- **Datos:** Detalles de contribuyentes en region fronteriza con tasas preferenciales de IVA/ISR
- **Como funciona:** Consulta en portal SAT Factura Electronica
- **Auth:** e.Firma
- **Relevancia para doctores:** BAJA (solo relevante para doctores en zona fronteriza)

### 8. DIOT (Declaracion Informativa de Operaciones con Terceros)

- **Datos:** Reporte de operaciones con terceros (proveedores)
- **Como funciona:** Modulo separado para generar el archivo de declaracion
- **Auth:** e.Firma
- **Relevancia para doctores:** BAJA (generalmente lo hace el contador)

### 9. PLD (Prevencion de Lavado de Dinero)

- **Datos:** Declaraciones de prevencion de lavado de dinero
- **Como funciona:** Modulo separado
- **Auth:** e.Firma
- **Relevancia para doctores:** MUY BAJA (aplica a actividades vulnerables, no consultas medicas tipicas)

---

## Comparativa: Web Service vs Web Scraping

| Aspecto | Web Service (Descarga Masiva) | Web Scraping (Portal SAT) |
|---------|-------------------------------|---------------------------|
| **Estabilidad** | Alta — endpoints documentados | Baja — SAT cambia el portal sin aviso |
| **Mantenimiento** | Bajo | Alto — cada cambio de UI rompe el scraping |
| **Velocidad** | Rapida (SOAP directo) | Lenta (multiples HTTP requests + redirects) |
| **Legalidad** | Uso previsto por SAT | Zona gris — no esta prohibido pero tampoco documentado |
| **Dependencias** | Zero (Node.js built-in) | Necesita HTTP client + HTML parser |
| **Auth** | e.Firma via XML signature | e.Firma via portal login (sesion web) |

---

## Prioridades para Nuestra App

### Prioridad Alta (implementar)

| Servicio | Motivo | Modulo que lo usa |
|----------|--------|-------------------|
| Descarga Masiva CFDIs | Dashboard financiero, analytics | SAT-DESCARGA (ya hecho PoC) |
| Validacion de RFC | Evitar errores en facturacion | TODO-FACTURAS |
| Opinion 32-D | Verificar cumplimiento fiscal para prestamos | LOANS |
| Constancia (CSF) | Validar datos fiscales de pacientes/doctores | TODO-FACTURAS |

### Prioridad Baja (no implementar por ahora)

| Servicio | Motivo |
|----------|--------|
| Retenciones | Pocos doctores facturan a personas morales |
| Declaraciones | Responsabilidad del contador |
| LCO | Solo zona fronteriza |
| DIOT | Responsabilidad del contador |
| PLD | No aplica a consultas medicas |

---

## Consideraciones Tecnicas para Web Scraping

Si decidimos implementar los servicios de web scraping:

1. **Login al portal SAT con e.Firma** es el paso critico — python-satcfdi usa `requests` con `SSLAdapter` y token generation via `loginda.siat.sat.gob.mx`
2. **Fragilidad:** El SAT redisena su portal periodicamente. Cada cambio puede romper el scraping.
3. **Rate limiting:** El portal tiene protecciones anti-bot. Hay que respetar tiempos entre requests.
4. **Alternativa para RFC validation:** Facturama (nuestro PAC actual) podria ofrecer validacion de RFC via su propia API, lo cual seria mas estable que scraping directo al SAT.

---

## Referencias

### Implementaciones de Referencia

- **python-satcfdi portal module:** https://github.com/SAT-CFDI/python-satcfdi/tree/main/satcfdi/portal
- **python-satcfdi CSF module:** https://github.com/SAT-CFDI/python-satcfdi/tree/main/satcfdi/csf
- **python-satcfdi certifica module:** https://github.com/SAT-CFDI/python-satcfdi/tree/main/satcfdi/certifica
- **python-satcfdi DIOT module:** https://github.com/SAT-CFDI/python-satcfdi/tree/main/satcfdi/diot

### Portal SAT

- **Login e.Firma:** https://loginda.siat.sat.gob.mx
- **Constancia de Situacion Fiscal:** https://www.sat.gob.mx/aplicacion/53027/genera-tu-constancia-de-situacion-fiscal
- **Opinion de Cumplimiento 32-D:** https://www.sat.gob.mx/aplicacion/operacion/66288/emite-la-opinion-del-cumplimiento-de-obligaciones-fiscales
- **Validacion RFC:** Disponible dentro del portal de Factura Electronica del SAT

### Community Docs

- **BoxFactura SAT community docs:** https://github.com/BoxFactura/sat-community-docs (solo documenta descarga masiva, no portal)
