# SAT Descarga Masiva — SOAP Templates

**Fuente:** https://github.com/SAT-CFDI/python-satcfdi/tree/main/satcfdi/pacs/sat_templates

Estos son los XML SOAP templates exactos que se usan para comunicarse con el SAT. Extraidos del proyecto python-satcfdi (138 stars, 350 commits, 141 releases — la libreria open-source mas madura para SAT en Python).

---

## 1. Autenticacion (`autentica.xml`)

```xml
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"
    xmlns:o="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
    xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
    <s:Header>
        <o:Security s:mustUnderstand="1">
            <u:Timestamp u:Id="_0">
                <u:Created>{CREATED_UTC}</u:Created>
                <u:Expires>{EXPIRES_UTC}</u:Expires>
            </u:Timestamp>
            <o:BinarySecurityToken u:Id="BinarySecurityToken"
                ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
                EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">
                {CERTIFICATE_BASE64}
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
                        <DigestValue>{SHA1_OF_TIMESTAMP_BASE64}</DigestValue>
                    </Reference>
                </SignedInfo>
                <SignatureValue>{RSA_SHA1_OF_SIGNEDINFO_BASE64}</SignatureValue>
                <KeyInfo>
                    <o:SecurityTokenReference>
                        <o:Reference
                            ValueType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-x509-token-profile-1.0#X509v3"
                            URI="#BinarySecurityToken"/>
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

### Proceso de firma para autenticacion:

1. Crear `<u:Timestamp>` con `Created` = now UTC, `Expires` = now + 5 min UTC
2. **Canonicalizar** el nodo Timestamp usando Exclusive XML Canonicalization (exc-c14n)
3. Calcular **SHA-1** del Timestamp canonicalizado → base64 → `DigestValue`
4. Construir `<SignedInfo>` con el DigestValue
5. **Canonicalizar** SignedInfo
6. Firmar SignedInfo con **RSA-SHA1** usando la llave privada (.key) → base64 → `SignatureValue`
7. `BinarySecurityToken` = certificado .cer leido en DER, codificado en base64

### Respuesta exitosa:

```xml
<AutenticaResponse xmlns="http://DescargaMasivaTerceros.gob.mx">
  <AutenticaResult>{JWT_TOKEN}</AutenticaResult>
</AutenticaResponse>
```

Token es JWT. Expira en ~5 minutos. La libreria python-satcfdi lo renueva automaticamente si quedan menos de 30 segundos.

---

## 2. Solicitud de Descarga

### Emitidos (`solicitaEmitidos.xml`)

```xml
<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header/>
    <s:Body>
        <des:SolicitaDescargaEmitidos>
            <des:solicitud
                FechaFinal="{YYYY-MM-DDThh:mm:ss}"
                FechaInicial="{YYYY-MM-DDThh:mm:ss}"
                RfcSolicitante="{RFC}"
                TipoSolicitud="{CFDI|Metadata}"
                RfcReceptores="{RFC_FILTRO}"
                TipoComprobante="{I|E|P|N|T}"
                EstadoComprobante="{Vigente|Cancelado|Todos}">
                <!-- Firma XML embebida aqui (ver signature.xml) -->
            </des:solicitud>
        </des:SolicitaDescargaEmitidos>
    </s:Body>
</s:Envelope>
```

### Recibidos (`solicitaRecibidos.xml`)

```xml
<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header/>
    <s:Body>
        <des:SolicitaDescargaRecibidos>
            <des:solicitud
                FechaFinal="{YYYY-MM-DDThh:mm:ss}"
                FechaInicial="{YYYY-MM-DDThh:mm:ss}"
                RfcSolicitante="{RFC}"
                TipoSolicitud="{CFDI|Metadata}"
                RfcEmisor="{RFC_FILTRO}"
                TipoComprobante="{I|E|P|N|T}"
                EstadoComprobante="{Vigente|Cancelado|Todos}">
                <!-- Firma XML embebida -->
            </des:solicitud>
        </des:SolicitaDescargaRecibidos>
    </s:Body>
</s:Envelope>
```

### Por Folio/UUID (`solicitaFolio.xml`)

```xml
<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header/>
    <s:Body>
        <des:SolicitaDescargaFolio>
            <des:solicitud
                Folio="{UUID}"
                RfcSolicitante="{RFC}"
                TipoSolicitud="{CFDI|Metadata}">
                <!-- Firma XML embebida -->
            </des:solicitud>
        </des:SolicitaDescargaFolio>
    </s:Body>
</s:Envelope>
```

### Atributos de `<des:solicitud>`

| Atributo | Requerido | Valores | Notas |
|----------|-----------|---------|-------|
| `FechaInicial` | Si (Emitidos/Recibidos) | `YYYY-MM-DDThh:mm:ss` | ISO 8601 sin timezone |
| `FechaFinal` | Si (Emitidos/Recibidos) | `YYYY-MM-DDThh:mm:ss` | ISO 8601 sin timezone |
| `RfcSolicitante` | Si | RFC del doctor | Quien hace la solicitud |
| `TipoSolicitud` | Si | `CFDI` o `Metadata` | Tipo de descarga |
| `RfcReceptores` | No (Emitidos) | RFC | Filtrar por receptor (max 5) |
| `RfcEmisor` | No (Recibidos) | RFC | Filtrar por emisor |
| `TipoComprobante` | No | `I/E/P/N/T` o null | Ingreso/Egreso/Pago/Nomina/Traslado |
| `EstadoComprobante` | No | `Vigente/Cancelado/Todos` | Filtro de estado |
| `Folio` | Si (Folio) | UUID | CFDI especifico |

### Nota sobre atributos para Emitidos vs Recibidos

- **Emitidos:** usa `RfcReceptores` (plural, filtro de receptores)
- **Recibidos:** usa `RfcEmisor` (singular, filtro de emisor)

### IMPORTANTE: EstadoComprobante para XML Recibidos

Para descargar XMLs (`TipoSolicitud="CFDI"`) de recibidos, **DEBES** incluir `EstadoComprobante="Vigente"`. Sin este filtro, SAT rechaza la solicitud con error 301 si existen cancelados en el rango.

- Valores validos: `"Vigente"`, `"Cancelado"`, `"Todos"` (strings, NO numeros)
- Los valores numericos `"0"`/`"1"` son solo para el output del TXT de metadata, NO para requests SOAP
- Para emitidos XML no es necesario (SAT acepta todos los estados)
- Los atributos DEBEN ir en orden alfabetico para que el digest de la firma coincida

### Header de autorizacion (para solicitud, verificacion y descarga)

```
Authorization: WRAP access_token="{JWT_TOKEN}"
```

**Nota:** Diferente a la autenticacion que usa WS-Security en el header SOAP. Las demas operaciones usan un HTTP header simple con el token JWT.

---

## 3. Verificacion (`verifica.xml`)

```xml
<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header/>
    <s:Body>
        <des:VerificaSolicitudDescarga>
            <des:solicitud
                IdSolicitud="{UUID_SOLICITUD}"
                RfcSolicitante="{RFC}">
                <!-- Firma XML embebida -->
            </des:solicitud>
        </des:VerificaSolicitudDescarga>
    </s:Body>
</s:Envelope>
```

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

### EstadoSolicitud (de python-satcfdi)

| Valor | Enum | Significado |
|-------|------|-------------|
| `1` | ACEPTADA | Solicitud registrada |
| `2` | EN_PROCESO | SAT preparando paquete |
| `3` | TERMINADA | Listo para descarga |
| `4` | ERROR | Error en procesamiento |
| `5` | RECHAZADA | Solicitud rechazada |
| `6` | VENCIDA | Solicitud expirada |

### Polling strategy (de python-satcfdi)

La libreria espera **60 segundos** entre cada verificacion. Continua mientras estado sea ACEPTADA o EN_PROCESO. Para en TERMINADA o cualquier otro estado.

---

## 4. Descarga de Paquete (`descarga.xml`)

```xml
<s:Envelope xmlns:des="http://DescargaMasivaTerceros.sat.gob.mx"
    xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header/>
    <s:Body>
        <des:PeticionDescargaMasivaTercerosEntrada>
            <des:peticionDescarga
                IdPaquete="{PACKAGE_ID}"
                RfcSolicitante="{RFC}">
                <!-- Firma XML embebida -->
            </des:peticionDescarga>
        </des:PeticionDescargaMasivaTercerosEntrada>
    </s:Body>
</s:Envelope>
```

**Nota:** El nombre del elemento es `PeticionDescargaMasivaTercerosEntrada` con child `peticionDescarga`, no `Descargar` como podria esperarse.

### Respuesta

El ZIP se retorna como base64 dentro del SOAP response body. Contiene:
- **Si TipoSolicitud=Metadata:** archivo(s) TXT con columnas separadas por `~`
- **Si TipoSolicitud=CFDI:** archivo(s) XML individuales

---

## 5. Firma para Solicitud/Verificacion/Descarga (`signature.xml`)

A diferencia de la autenticacion (que firma el Timestamp), las solicitudes firman el nodo `<des:solicitud>` o `<des:peticionDescarga>`:

```xml
<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="">
            <Transforms>
                <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            </Transforms>
            <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
            <DigestValue>{SHA1_DEL_NODO_SOLICITUD}</DigestValue>
        </Reference>
    </SignedInfo>
    <SignatureValue>{RSA_SHA1_DE_SIGNEDINFO}</SignatureValue>
    <KeyInfo>
        <X509Data>
            <X509IssuerSerial>
                <X509IssuerName>{ISSUER_DN}</X509IssuerName>
                <X509SerialNumber>{SERIAL_NUMBER}</X509SerialNumber>
            </X509IssuerSerial>
            <X509Certificate>{CERTIFICATE_BASE64}</X509Certificate>
        </X509Data>
    </KeyInfo>
</Signature>
```

### Diferencias clave con la firma de autenticacion:

| Aspecto | Autenticacion | Solicitud/Verifica/Descarga |
|---------|--------------|----------------------------|
| **Que se firma** | `<u:Timestamp u:Id="_0">` | `<des:solicitud>` o `<des:peticionDescarga>` |
| **Reference URI** | `#_0` (por Id) | `""` (vacio — enveloped signature) |
| **Transform** | `exc-c14n` | `enveloped-signature` |
| **KeyInfo** | `SecurityTokenReference` → `BinarySecurityToken` | `X509Data` con IssuerName, SerialNumber, Certificate |
| **Donde va la firma** | En `<o:Security>` header | Dentro del nodo `<des:solicitud>` |
| **Auth header HTTP** | No (todo en SOAP) | `Authorization: WRAP access_token="{token}"` |

---

## Resumen del Flujo Completo

```
1. POST autenticacion.svc
   Body: autentica.xml (con WS-Security + firma del Timestamp)
   → Recibe JWT token

2. POST solicitudDescarga.svc
   Header: Authorization: WRAP access_token="{token}"
   Body: solicitaEmitidos/Recibidos/Folio.xml (con firma del nodo solicitud)
   → Recibe IdSolicitud (UUID)

3. POST verificaSolicitud.svc  (polling cada 60s)
   Header: Authorization: WRAP access_token="{token}"
   Body: verifica.xml (con firma del nodo solicitud)
   → Recibe EstadoSolicitud + IdsPaquetes cuando terminada

4. POST descargaMasiva.svc
   Header: Authorization: WRAP access_token="{token}"
   Body: descarga.xml (con firma del nodo peticionDescarga)
   → Recibe ZIP en base64 (metadata TXT o XMLs)
```
