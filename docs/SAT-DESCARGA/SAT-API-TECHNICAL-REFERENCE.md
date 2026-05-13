# SAT Descarga Masiva — Referencia Tecnica Completa

**Fecha:** 2026-05-12
**Fuentes:** Documentacion oficial SAT, SW SmartWeb, BoxFactura community docs, nodecfdi library

---

## Descubrimiento Clave: Ya existe libreria Node.js

**`@nodecfdi/sat-ws-descarga-masiva`** — Libreria TypeScript/Node.js que implementa TODO el flujo de descarga masiva del SAT.

- **npm:** `npm i @nodecfdi/sat-ws-descarga-masiva`
- **GitHub:** https://github.com/nodecfdi/sat-ws-descarga-masiva
- **ESM only** (no CommonJS)
- **TypeScript** nativo
- **224 commits, 29 stars, 0 issues abiertos** — proyecto maduro y mantenido

Esto cambia completamente la estrategia: NO necesitamos construir la capa SOAP/XML desde cero.

---

## SOAP Endpoints del SAT

### Servicios CFDI

| Servicio | URL |
|----------|-----|
| **Autenticacion** | `https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc` |
| **Solicitud** | `https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc` |
| **Verificacion** | `https://cfdidescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc` |
| **Descarga** | `https://cfdidescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc` |

### Servicios Retenciones

| Servicio | URL |
|----------|-----|
| **Autenticacion** | `https://retendescargamasivasolicitud.clouda.sat.gob.mx/Autenticacion/Autenticacion.svc` |
| **Solicitud** | `https://retendescargamasivasolicitud.clouda.sat.gob.mx/SolicitaDescargaService.svc` |
| **Verificacion** | `https://retendescargamasivasolicitud.clouda.sat.gob.mx/VerificaSolicitudDescargaService.svc` |
| **Descarga** | `https://retendescargamasiva.clouda.sat.gob.mx/DescargaMasivaService.svc` |

**Gotcha importante:** El endpoint de Descarga usa un subdominio DIFERENTE (`cfdidescargamasiva` sin "solicitud") que los otros tres (`cfdidescargamasivasolicitud`).

**Nota:** No hay WSDL publicado. Los endpoints son SOAP puro. Version actual: v1.5 (produccion desde mayo 2025).

### SOAPAction Headers

| Operacion | SOAPAction |
|-----------|------------|
| Autenticar | `http://DescargaMasivaTerceros.gob.mx/IAutenticacion/Autentica` |
| Solicitud Emitidos | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos` |
| Solicitud Recibidos | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos` |
| Solicitud por Folio | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaFolio` |
| Verificacion | `http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga` |
| Descarga | `http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaTercerosService/Descargar` |

**Gotcha:** Autenticar usa namespace `.gob.mx` mientras los demas usan `.sat.gob.mx`. Inconsistencia conocida del SAT.

---

## Paso 1: Autenticacion

### SOAP Envelope

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <s:Header>
    <o:Security s:mustUnderstand="1"
      xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">

      <u:Timestamp u:Id="_0">
        <u:Created>2022-02-15T19:06:32.002Z</u:Created>
        <u:Expires>2022-02-15T19:11:32.002Z</u:Expires>
      </u:Timestamp>

      <o:BinarySecurityToken u:Id="uuid-XXXX-4"
        ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
        EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">
        [CERTIFICADO .cer EN BASE64]
      </o:BinarySecurityToken>

      <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
        <SignedInfo>
          <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
          <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
          <Reference URI="#_0">
            <Transforms>
              <Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
            </Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
            <DigestValue>[SHA1 del nodo Timestamp, base64]</DigestValue>
          </Reference>
        </SignedInfo>
        <SignatureValue>[RSA-SHA1 de SignedInfo con llave privada, base64]</SignatureValue>
        <KeyInfo>
          <o:SecurityTokenReference>
            <o:Reference ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
              URI="#uuid-XXXX-4"/>
          </o:SecurityTokenReference>
        </KeyInfo>
      </Signature>
    </o:Security>
  </s:Header>
  <s:Body>
    <Autentica xmlns="http://DescargaMasivaTerceros.gob.mx"/>
  </s:Body>
</s:Envelope>
```

### Proceso de Firma

1. Construir nodo `<Timestamp>` con Created (now) y Expires (now + 5 min)
2. Canonicalizar el Timestamp (Exclusive XML Canonicalization)
3. Calcular SHA1 del Timestamp canonicalizado → `DigestValue` (base64)
4. Construir `<SignedInfo>` con el DigestValue
5. Canonicalizar SignedInfo
6. Firmar SignedInfo con la llave privada (.key) usando RSA-SHA1 → `SignatureValue` (base64)
7. BinarySecurityToken = certificado .cer en base64

### Respuesta Exitosa

```xml
<AutenticaResponse xmlns="http://DescargaMasivaTerceros.gob.mx">
  <AutenticaResult>
    eyJhbGciOiJodHRw...  <!-- JWT token -->
  </AutenticaResult>
</AutenticaResponse>
```

**Token:** JWT con expiracion (campo `exp`). Ventana real: **10 minutos** (no 5 como dice la documentacion de SW SmartWeb).

### Resultado PoC (2026-05-12) — EXITOSO

```
HTTP Status: 200
Token length: 395 chars
JWT payload:
  Issued at: 2026-05-13T02:23:27.000Z
  Expires:   2026-05-13T02:33:27.000Z  (10 min window)
  Issuer:    LoadSolicitudDecargaMasivaTerceros
```

Implementado en `scripts/sat-auth-test.mjs` — zero dependencies, solo Node.js built-in crypto.

Lecciones de la implementacion:
1. **Canonicalizacion manual funciona:** No se necesita libreria de exc-c14n. Basta con construir el XML canonico como string, asegurandose de incluir `xmlns:u` en el Timestamp aislado y `xmlns` en el SignedInfo aislado (exc-c14n los agrega porque los prefijos son visiblemente usados)
2. **Self-closing vs explicit close tags:** SAT acepta `<Tag></Tag>` — no requiere `<Tag/>`
3. **BinarySecurityToken Id:** Acepta cualquier valor consistente (e.g. `"BinarySecurityToken"`) — no requiere UUID
4. **Respuesta rapida:** ~2 segundos para autenticacion

### Respuesta Error

```xml
<s:Fault>
  <faultcode>a:InvalidSecurity</faultcode>
  <faultstring>An error occurred when verifying security for the message.</faultstring>
</s:Fault>
```

---

## Paso 2: Solicitud de Descarga

### Tres Operaciones Disponibles

| Operacion | SOAP Action | Uso |
|-----------|-------------|-----|
| `SolicitaDescargaEmitidos` | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaEmitidos` | CFDIs que el doctor emitio |
| `SolicitaDescargaRecibidos` | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaRecibidos` | CFDIs que el doctor recibio |
| `SolicitaDescargaFolio` | `http://DescargaMasivaTerceros.sat.gob.mx/ISolicitaDescargaService/SolicitaDescargaFolio` | CFDI especifico por UUID |

### Parametros de Solicitud

| Campo | Formato | Requerido | Notas |
|-------|---------|-----------|-------|
| `FechaInicial` | `AAAA-MM-DDThh:mm:ss` | Si | Inicio del rango |
| `FechaFinal` | `AAAA-MM-DDThh:mm:ss` | Si | Fin del rango |
| `RfcSolicitante` | RFC (13 chars) | Si | RFC del solicitante (siempre el doctor) |
| `RfcEmisor` | RFC (13 chars) | Si (Emitidos) | RFC del doctor (obligatorio para emitidos, confirmado) |
| `RfcReceptor` | RFC (13 chars) | Si (Recibidos) | RFC del doctor (obligatorio para recibidos, confirmado) |
| `TipoSolicitud` | `CFDI` o `Metadata` | Si | Tipo de descarga |
| `TipoComprobante` | `I/E/T/N/P` o null | No | Filtro por tipo |
| `EstadoComprobante` | `Vigente/Cancelado/Todos` | No | Filtro por status |
| `Folio` | UUID | Si (solo Folio) | UUID especifico |

### Header de Autorizacion

```
Authorization: WRAP access_token="{JWT_TOKEN}"
```

**Nota (confirmado por PoC):** No se necesita `&wrap_subject={RFC_ENCODED}` como indicaban algunas fuentes. Solo el token es suficiente.

### Respuesta Exitosa

```xml
<SolicitaDescargaEmitidosResult
  IdSolicitud="05e4038d-1f0d-4617-87d1-232fdd93bcc5"
  RfcSolicitante="XAXX010101000"
  CodEstatus="5000"
  Mensaje="Solicitud Aceptada"/>
```

### Firma de la Solicitud

Cada solicitud tambien debe ir firmada:
- `DigestValue`: SHA1 del nodo solicitud
- `SignatureValue`: RSA-SHA1 de SignedInfo con llave privada
- `X509IssuerName`: DN del certificado
- `X509SerialNumber`: Numero serial del certificado
- `X509Certificate`: Certificado en base64

---

## Paso 3: Verificacion

### SOAP Action

```
http://DescargaMasivaTerceros.sat.gob.mx/IVerificaSolicitudDescargaService/VerificaSolicitudDescarga
```

### Parametros

- `IdSolicitud`: UUID de la solicitud
- `RfcSolicitante`: RFC del doctor

### Respuesta

```xml
<VerificaSolicitudDescargaResult
  CodEstatus="5000"
  EstadoSolicitud="3"
  CodigoEstadoSolicitud="5000"
  NumeroCFDIs="150"
  Mensaje="Solicitud Aceptada">
  <IdsPaquetes>4e80345d-917f-40bb-a98f4a73939343c5_01</IdsPaquetes>
  <IdsPaquetes>4e80345d-917f-40bb-a98f4a73939343c5_02</IdsPaquetes>
</VerificaSolicitudDescargaResult>
```

### EstadoSolicitud

| Valor | Significado |
|-------|-------------|
| `1` | Aceptada |
| `2` | En proceso |
| `3` | Terminada (lista para descarga) |
| `4` | Error |
| `5` | Rechazada |
| `6` | Vencida |

### Codigos de Status (CodEstatus)

| Codigo | Significado |
|--------|-------------|
| `300` | Usuario no valido / permisos insuficientes |
| `301` | XML mal formado |
| `302` | Sello digital mal formado |
| `303` | Sello no corresponde al RFC |
| `304` | Certificado revocado o vencido |
| `305` | Certificado invalido |
| `5000` | Solicitud recibida correctamente |
| `5002` | Limite de solicitudes de por vida excedido |
| `5003` | Consulta excede limite de elementos |
| `5004` | Informacion de solicitud no encontrada |
| `5005` | Ya existe solicitud activa duplicada |
| `5011` | Limite diario de descargas por folio excedido |

---

## Paso 4: Descarga de Paquetes

### SOAP Action

```
http://DescargaMasivaTerceros.sat.gob.mx/IDescargaMasivaVigenteService/Descargar
```

### Parametros

- `IdPaquete`: ID del paquete (de la verificacion)
- `RfcSolicitante`: RFC del doctor

### Respuesta

El paquete se retorna como contenido base64 dentro del SOAP response. El contenido es un archivo **ZIP**.

---

## Formato del Metadata TXT

### Columnas (12 campos confirmados por PoC 2026-05-12)

La documentacion de terceros mencionaba 14 columnas, pero el SAT actualmente retorna **12 columnas**. Las columnas 13-14 (RfcACuentaTerceros, NombreACuentaTerceros) no aparecen en el header ni en los datos descargados.

| # | Nombre Original | Nombre camelCase | Descripcion | Confirmado |
|---|----------------|------------------|-------------|------------|
| 1 | Uuid | uuid | Folio fiscal del CFDI | SI |
| 2 | RfcEmisor | rfcEmisor | RFC del emisor | SI |
| 3 | NombreEmisor | nombreEmisor | Razon social del emisor | SI |
| 4 | RfcReceptor | rfcReceptor | RFC del receptor | SI |
| 5 | NombreReceptor | nombreReceptor | Razon social del receptor | SI |
| 6 | PacCertifico | pacCertifico | RFC del PAC que certifico | SI |
| 7 | FechaEmision | fechaEmision | Fecha de emision (`YYYY-MM-DD HH:mm:ss`) | SI |
| 8 | FechaCertificacionSat | fechaCertificacionSat | Fecha de certificacion SAT | SI |
| 9 | Monto | monto | Monto total del CFDI (decimal) | SI |
| 10 | EfectoComprobante | efectoComprobante | Codigo: `I`=Ingreso, `E`=Egreso, `P`=Pago, `T`=Traslado | SI |
| 11 | Estatus | estatus | `1`=Vigente, `0`=Cancelado (numerico, no texto) | SI |
| 12 | FechaCancelacion | fechaCancelacion | Fecha de cancelacion (vacio si vigente) | SI |

**Nota:** El header real del SAT usa `PacCertifico` (no `RfcPac`), `EfectoComprobante` usa codigos cortos (`I`,`P`,`E`,`T`) no palabras completas, y `Estatus` es numerico (`0`/`1`) no texto.

### Formato del Archivo

- **Delimitador:** Tilde `~` (entre campos)
- **Texto:** Pipe `|` (delimitador de texto)
- **Encoding:** UTF-8
- **Line endings:** CRLF (`\r\n`)
- **Primera linea:** Headers (nombres de columnas)
- **Contenedor:** ZIP con un archivo TXT dentro

### Problemas Conocidos de Parsing

1. **Caracteres especiales en nombres:** `NombreEmisor` y `NombreReceptor` pueden contener cualquier caracter excepto `|`, entre 1 y 254 caracteres
2. **Line breaks embebidos:** Algunos nombres contienen `\n` dentro del campo, lo que rompe el line-by-line parsing
3. **XML entities convertidas:** SAT convierte `&#xD;` a literal `\n` durante export
4. **Campos extra:** A veces SAT agrega columnas nuevas sin documentar; nuestro parser ignora columnas extra si las hay

---

## Uso de la Libreria @nodecfdi/sat-ws-descarga-masiva

### Instalacion

```bash
pnpm add @nodecfdi/sat-ws-descarga-masiva
```

### Flujo Completo

```typescript
import { readFileSync } from 'fs';
import {
  Fiel,
  HttpsWebClient,
  FielRequestBuilder,
  Service,
  ServiceEndpoints,
  QueryParameters,
  DateTimePeriod,
  DownloadType,
  RequestType,
  DocumentType,
  DocumentStatus,
} from '@nodecfdi/sat-ws-descarga-masiva';
import { MetadataPackageReader } from '@nodecfdi/sat-ws-descarga-masiva';

// 1. Crear FIEL desde archivos CSD
const fiel = Fiel.create(
  readFileSync('certificado.cer', 'binary'),
  readFileSync('llave-privada.key', 'binary'),
  'password123',
);

if (!fiel.isValid()) {
  throw new Error('FIEL invalida');
}

// 2. Inicializar servicio
const webClient = new HttpsWebClient();
const requestBuilder = new FielRequestBuilder(fiel);
const service = new Service(requestBuilder, webClient);
// Para retenciones: new Service(requestBuilder, webClient, undefined, ServiceEndpoints.retenciones())

// 3. Crear query de metadata
const query = QueryParameters.create(
  DateTimePeriod.createFromValues('2026-01-01 00:00:00', '2026-01-31 23:59:59'),
)
  .withDownloadType(DownloadType.issued())      // o .received()
  .withRequestType(RequestType.metadata())       // o .xml()
  .withDocumentType(DocumentType.ingreso())      // opcional: ingreso|egreso|traslado|nomina|pago
  .withDocumentStatus(DocumentStatus.active());  // opcional: active|cancelled

// 4. Enviar solicitud
const result = await service.query(query);
if (!result.getStatus().isAccepted()) {
  throw new Error(`Solicitud rechazada: ${result.getStatus().getMessage()}`);
}
const requestId = result.getRequestId();

// 5. Polling de verificacion
let verifyResult;
do {
  await new Promise(resolve => setTimeout(resolve, 30000)); // esperar 30s
  verifyResult = await service.verify(requestId);
} while (!verifyResult.getStatus().isCompleted());

// 6. Descargar paquetes
for (let i = 0; i < verifyResult.getPackageCount(); i++) {
  const packageId = verifyResult.getPackageId(i);
  const packageContent = await service.download(packageId);

  // 7. Parsear metadata
  const reader = MetadataPackageReader.createFromContents(packageContent);
  for await (const item of reader.metadata()) {
    console.log({
      uuid: item.get('uuid'),
      rfcEmisor: item.get('rfcEmisor'),
      nombreEmisor: item.get('nombreEmisor'),
      rfcReceptor: item.get('rfcReceptor'),
      monto: item.get('monto'),
      efectoComprobante: item.get('efectoComprobante'),
      estatus: item.get('estatus'),
      fechaEmision: item.get('fechaEmision'),
    });
  }
}
```

### Opciones de Query

```typescript
// Filtrar por RFC contraparte (max 5 para emitidos)
.withRfcMatch(RfcMatch.create('AAA010101AAA'))

// Buscar CFDI especifico por UUID (ignora todos los demas filtros)
.withUuid(Uuid.create('96623061-61fe-49de-b298-c7156476aa8b'))

// Descargar en nombre de tercero (requiere autorizacion)
.withRfcOnBehalf(RfcOnBehalf.create('RFC_AUTORIZADO'))
```

### Parsear XMLs (Phase 2)

```typescript
import { CfdiPackageReader } from '@nodecfdi/sat-ws-descarga-masiva';

const cfdiReader = CfdiPackageReader.createFromContents(packageContent);
for await (const cfdiFile of cfdiReader.fileContents()) {
  const [filename, xmlContent] = cfdiFile;
  // Guardar o parsear XML
}
```

---

## Credenciales: e.Firma (FIEL) es OBLIGATORIA — CSD NO sirve

### Hallazgo de la documentacion oficial del SAT

La pagina oficial del SAT "Consulta y recuperacion de comprobantes" establece claramente:

- **Portal web:** acepta e.firma O password (CIEC)
- **Web Service (descarga masiva):** acepta **SOLO e.firma** — genera token de autenticacion

**Conclusion: Los CSD que ya tenemos NO sirven para descarga masiva.**

### Diferencia tecnica entre e.Firma y CSD

| Aspecto | e.Firma (FIEL) | CSD |
|---------|---------------|-----|
| **Proposito** | Identificar al contribuyente (como firma manuscrita) | Sellar CFDIs (solo facturacion) |
| **Obtencion** | Presencial en oficinas SAT | Online via app Certifica (requiere FIEL vigente) |
| **Key Usage (hex)** | 4 valores: Firma digital, Sin repudio, Cifrado de datos, Acuerdo de clave | 2 valores: Firma digital, Sin repudio |
| **branchName** | Vacio | Contiene datos de sucursal |
| **Archivos** | `Clave_privada_FIEL_{rfc}.key` + `{rfc}.cer` | `CSD_{nombre}_{rfc}.key` + `CSD_{nombre}_{rfc}_{serial}.cer` |
| **Valido para descarga masiva** | SI | NO |
| **Vigencia** | 4 anios | 4 anios |

### Como diferenciar programaticamente

La libreria `phpcfdi/credentials` usa `branchName()`:
- **Vacio** → es FIEL
- **Con datos** → es CSD

**IMPORTANTE (descubierto en PoC):** Node.js `X509Certificate.keyUsage` retorna el campo `extendedKeyUsage` (OIDs), NO el campo basico `keyUsage`. La e.Firma de prueba mostro solo 2 OIDs (`1.3.6.1.5.5.7.3.4`, `1.3.6.1.5.5.7.3.2`) pero fue aceptada por el SAT. No usar `keyUsage.length` para distinguir FIEL/CSD en Node.js — usar `branchName` o el nombre del archivo.

### Implicacion para nuestra app

Los doctores actualmente suben CSD (.cer + .key + password) para Facturama. Para descarga masiva necesitaran **adicionalmente** subir su e.Firma:

- Archivos: `.cer` + `.key` de e.Firma (DIFERENTES a los del CSD)
- Password: el de la llave privada de la e.Firma
- Son archivos distintos con nombres distintos

**Recomendacion:** Agregar un segundo upload de credenciales en la configuracion fiscal del doctor, separado del CSD de facturacion.

### Limites oficiales del SAT (documentacion oficial)

| Via | XMLs | Metadata | Restriccion |
|-----|------|----------|-------------|
| **Portal web** | 500 mostrados, 2,000/dia | 1,000,000 por consulta | e.firma o password |
| **Web Service** | 200,000 por solicitud | 1,000,000 por solicitud | Solo e.firma |

- Procesamiento: maximo 48 horas
- Disponibilidad: 72 horas despues de procesado (3 dias para descargar)
- No se puede descargar el mismo XML mas de 2 veces
- Historico: hasta 5 anios fiscales + anio actual

---

## Limites y Restricciones del SAT

| Restriccion | Detalle |
|-------------|---------|
| Tiempo de procesamiento | Minutos a ~72 horas |
| Solicitudes duplicadas | Error 5005 si ya existe solicitud activa |
| Limite de por vida | Error 5002 (raro, pero existe) |
| Limite diario por folio | Error 5011 |
| Tamano de rango | Rangos grandes pueden dar error 5003 |
| Rango maximo | Hasta 5 anios fiscales + anio actual |
| Metadata max por request | ~1,000,000 registros |
| Token expiracion | ~5 minutos |
| Paquetes multiples | Un request puede generar multiples ZIPs |
| RFC receptores por solicitud emitidos | Max 5 |
| Solicitud recibidos metadata | Incluye activos Y cancelados |
| Solicitud recibidos XML | Solo activos |

---

## Gotchas Criticos

1. **Subdominio diferente para Descarga:** `cfdidescargamasiva` (sin "solicitud") vs `cfdidescargamasivasolicitud` para los otros 3 servicios
2. **Namespace inconsistente en SOAPAction:** Autenticar usa `.gob.mx`, los demas usan `.sat.gob.mx`
3. **Orden alfabetico de atributos XML:** Los atributos dentro del nodo de firma deben estar ordenados alfabeticamente para validacion correcta
4. **SOAP extremadamente estricto:** Cualquier error de formato causa rechazo inmediato
5. **Terceros separados:** Desde septiembre 2022, SAT incluye un archivo `<UUID>_tercero.txt` separado con info de terceros vinculada por UUID
6. **Metadata incluye activos + cancelados** (para recibidos), pero XML solo incluye activos

---

## Recursos

- **Libreria Node.js:** https://github.com/nodecfdi/sat-ws-descarga-masiva
- **Libreria PHP (referencia):** https://github.com/phpcfdi/sat-ws-descarga-masiva
- **Community docs SAT:** https://github.com/BoxFactura/sat-community-docs
- **SW SmartWeb guia:** https://developers.sw.com.mx/knowledge-base/consumo-webservice-descarga-masiva-sat/
- **Organizacion nodecfdi:** https://github.com/nodecfdi
- **Python satcfdi (referencia):** https://github.com/SAT-CFDI/python-satcfdi
- **Python cfdiclient (simple):** https://github.com/luisiturrios1/python-cfdiclient
- **SW v1.5 Autenticacion:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-autenticacion/
- **SW v1.5 Solicitud:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-solicitud/
- **SW v1.5 Verificacion:** https://developers.sw.com.mx/knowledge-base/descarga-masiva-sat-verificacion/
- **SW v1.5 Release notes (mayo 2025):** https://developers.sw.com.mx/knowledge-base/29-mayo-2025-nueva-version-del-web-service-de-descarga-masiva-sat-para-cfdi-y-cfdi-de-retenciones/
