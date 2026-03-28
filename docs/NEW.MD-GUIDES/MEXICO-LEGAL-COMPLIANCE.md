# Cumplimiento Legal México — Plataforma Healthcare

Investigación de requisitos legales y regulatorios aplicables a una plataforma SaaS de salud
que opera en México, conecta pacientes con médicos, gestiona citas y almacena datos personales y clínicos.

---

## 1. Aviso de Privacidad

### Marco legal
**Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) — 2025**
La nueva ley fue publicada el **20 de marzo de 2025** y **abroga la ley de 2010**.
Autoridad reguladora: **Secretaría Anticorrupción y Buen Gobierno** — reemplaza al INAI, que fue disuelto.

> ⚠️ El INAI ya no existe. Toda referencia anterior a "INAI" debe entenderse como "Secretaría Anticorrupción y Buen Gobierno".

### Cambios clave de la nueva ley (2025)
- **Ampliación de responsables**: Ahora aplica a cualquier persona física o moral que realice tratamiento de datos, incluyendo los **encargados del tratamiento** (antes solo el responsable).
- **Aviso de privacidad integral reformado**: Ya **no es obligatorio informar sobre transferencias** de datos; en cambio, se debe:
  - Identificar explícitamente los **datos sensibles** dentro del listado de datos tratados
  - Distinguir entre **finalidades que requieren consentimiento** y las que no
- **Notificación de vulneraciones**: Obligatorio notificar a los titulares ante cualquier brecha que afecte significativamente sus derechos.
- **Designación de responsable interno**: Debe nombrarse un encargado o departamento de datos personales.
- **Capacitación del personal**: Obligatorio capacitar al personal y llevar registros de cumplimiento.

### Por qué es crítico para esta plataforma
La plataforma recopila **datos personales sensibles** (categoría de mayor protección):
- Historial médico y diagnósticos
- Información de citas y padecimientos
- Datos de recetas médicas
- Fotografías de perfil de médicos
- Información de pago/contacto de pacientes

Los datos sensibles requieren **consentimiento expreso y por escrito** — el titular debe otorgarlo libremente, sin coacción.

### Contenido obligatorio del Aviso (ley 2025)
El Aviso de Privacidad debe incluir:

1. **Identidad del responsable** — Razón social, domicilio fiscal completo
2. **Datos recopilados** — Lista específica de qué datos se recaban, **identificando cuáles son sensibles**
3. **Finalidades del tratamiento** — Distinguiendo:
   - Finalidades **que requieren consentimiento**: datos de salud, diagnósticos, recetas
   - Finalidades **que no requieren consentimiento**: obligaciones legales, seguridad de la plataforma
4. **Mecanismo para ejercer Derechos ARCO** — Email o formulario de contacto
5. **Uso de cookies y tecnologías de rastreo** — Google Analytics, Google Ads, etc.
6. **Cómo se notificarán cambios al Aviso**

> Nota: La nueva ley elimina la obligación de informar sobre transferencias a terceros en el aviso integral.

### Cuándo y dónde debe mostrarse
- **Antes o en el momento** en que se recopilan datos — no después
- En el registro de pacientes (antes de crear cuenta)
- En el registro/onboarding de médicos
- En el formulario de reserva de citas
- En el formulario de contacto
- Link permanente en el footer de todas las páginas públicas

### Permanencia y actualizaciones
- El Aviso es **permanente** — debe estar siempre accesible en una URL fija (ej. `/aviso-de-privacidad`)
- Debe **actualizarse** cada vez que cambie:
  - Qué datos se recopilan
  - Con quién se comparten
  - Para qué se usan
  - Nuevos proveedores tecnológicos integrados
- Al actualizarlo se debe notificar a los usuarios existentes (email o banner en la plataforma)

### Penalidades por incumplimiento (LFPDPPP 2025)
- **Violaciones al aviso de privacidad**: multa de **100 a 160,000 veces el salario mínimo diario**
- **Tratamiento de datos sensibles sin consentimiento expreso**: multa de **200 a 320,000 veces el salario mínimo diario**
- **Violaciones reiteradas**: posible **suspensión temporal o permanente** de las actividades de tratamiento de datos

### Acción requerida en el app
- [x] Página de privacidad existe en `/privacidad` — `apps/public/src/app/privacidad/page.tsx`
- [x] Consentimiento explícito en el booking widget (reserva de citas)
- [x] Consentimiento explícito en formulario pre-cita (`/formulario-cita/[token]`)
- [x] Consentimiento explícito en formulario de reseña (`/review/[token]`)
- [x] Consentimiento explícito en onboarding de médicos (`/consent` — una sola vez, timestamp en DB)
- [x] Enlace al Aviso en el footer de todas las páginas públicas (`apps/public/src/app/layout.tsx`)
- [x] Política de cookies — banner informativo (`CookieBanner.tsx`, clave `cookie-notice-v1`)
- [x] Actualizar `/privacidad` para cumplir con LFPDPPP 2025 (datos sensibles marcados, finalidades divididas, ARCO corregido)

---

## 2. Derechos ARCO

### Qué son
Derechos que la LFPDPPP otorga a toda persona cuyos datos personales son tratados:

| Derecho | Descripción |
|---|---|
| **A**cceso | Solicitar qué datos personales se tienen y cómo se usan |
| **R**ectificación | Corregir datos inexactos o incompletos |
| **C**ancelación | Solicitar la eliminación de sus datos |
| **O**posición | Oponerse al uso de sus datos para finalidades específicas |

### Plazos legales obligatorios
- El responsable debe **responder en 20 días hábiles** a partir de recibir la solicitud
- Si se aprueba la solicitud, debe ejecutarse en **15 días hábiles** adicionales
- El plazo de respuesta puede extenderse **una sola vez** por 20 días hábiles más, notificando al solicitante
- Las solicitudes deben **registrarse y conservarse** como evidencia de cumplimiento

### Requisitos del mecanismo ARCO
Los medios que se pongan a disposición del titular deben ser **sencillos y gratuitos**:
- Email dedicado (ej. `privacidad@dominio.com`) o formulario en la plataforma
- El solicitante debe poder identificarse y especificar su solicitud
- No se puede cobrar por ejercer estos derechos (salvo costos de reproducción justificados)
- Los canales deben ser accesibles y no imponer barreras innecesarias

### Consideraciones especiales para esta plataforma
- **Cancelación de médicos**: Los expedientes clínicos tienen obligación de conservación legal (NOM-004-SSA3-2012 requiere conservarlos **5 años** o más). Un médico no puede solicitar eliminar el historial clínico de pacientes que atendió.
- **Cancelación de pacientes**: Un paciente puede pedir eliminar su cuenta, pero el historial de citas pasadas puede necesitar conservarse por obligaciones fiscales y clínicas.
- **Rectificación**: El app debe permitir a usuarios actualizar sus datos directamente (perfil editable) para facilitar este derecho sin proceso formal.

### Acción requerida en el app
- [x] Email ARCO disponible: `privacidad@tusalud.pro` (documentado en `/privacidad` y `/eliminacion-de-datos`)
- [x] Página `/eliminacion-de-datos` con proceso detallado de solicitud (derecho de Cancelación)
- [x] Retención de datos documentada en `/privacidad`: 2 años post última interacción (pacientes)
- [x] Retención de datos clínicos corregida en `/privacidad`: 5 años (NOM-004-SSA3-2012), datos de contacto 2 años, fiscal según SAT
- [ ] Asignar un responsable interno de datos (Oficial de Privacidad) con nombre y cargo formal
- [ ] Registrar y conservar evidencia de solicitudes ARCO recibidas y respondidas

---

## 3. Certificación SIRES / DGIS (Secretaría de Salud)

### Cómo se relacionan estos conceptos

Todo forma parte de **un solo marco regulatorio**, ante **una sola institución** (la DGIS). No son trámites en lugares distintos.

| Término | Qué es | Analogía |
|---|---|---|
| **NOM-024** | La ley que obliga a cumplir todo | El reglamento de construcción |
| **DGIS** | La institución que certifica y vigila | El inspector de obra |
| **GIIS** | Las especificaciones técnicas de cómo debe funcionar tu software | Los planos arquitectónicos |
| **SIRES** | Tu software ya terminado y certificado | La casa construida y aprobada |

**El flujo es uno solo:**
```
Tu software → Cumples las GIIS aplicables → Te certifica la DGIS bajo NOM-024 → Queda registrado como SIRES certificado
```

### Qué es DGIS
La **Dirección General de Información en Salud** — unidad de la Secretaría de Salud federal. Es la única autoridad que certifica software de salud bajo NOM-024. Todo el trámite SIRES pasa por aquí.

### Qué es SIRES
Tu software, una vez certificado. **SIRES = tu sistema aprobado y listado públicamente** en el sitio de la DGIS.

### NOM-024-SSA3-2012 — La norma clave para software de salud
**"Sistemas de información de registro electrónico para la salud. Intercambio de información en salud"**

Esta norma aplica directamente a sistemas de software que manejan:
- Expedientes clínicos electrónicos
- Recetas médicas digitales
- Resultados de laboratorio
- Información clínica de pacientes

**Certificación por versión de software**: La NOM-024 requiere que cada **versión del sistema** que maneje expedientes clínicos sea certificada. Esto implica:
- Auditoría técnica de seguridad de la información
- Cumplimiento de estándares de interoperabilidad (HL7)
- Integridad y trazabilidad de registros
- Respaldo y recuperación de información

### Cuándo aplica a esta plataforma
| Funcionalidad | ¿Aplica NOM-024? |
|---|---|
| Reserva de citas (scheduling) | No |
| Perfil público del médico | No |
| Recetas en PDF (módulo actual) | **Sí — probablemente** |
| Notas clínicas / expediente | **Sí** |
| Historial de consultas con diagnósticos | **Sí** |
| Subida de estudios/resultados | **Sí** |

### NOM-004-SSA3-2012 — Expediente clínico
Complementaria a NOM-024, regula el contenido mínimo del expediente clínico electrónico. Establece:
- **5 años de conservación mínima** del expediente (o hasta 3 años después de la mayoría de edad si es menor)
- Quién puede acceder al expediente
- Requisitos de firma electrónica del médico

### Qué son las GIIS (concepto clave para el desarrollador)

**GIIS = Guías de Intercambio de Información en Salud**

Son las **especificaciones técnicas detalladas** que le dicen a tu software exactamente cómo estructurar, formatear e intercambiar información clínica con otros sistemas del sector salud en México. Logran interoperabilidad técnica y semántica.

Cada guía incluye:
- Alcance: tipos de sistemas y prestadores a los que aplica
- Diccionario de variables (identificando cuáles son confidenciales)
- Catálogos y reglas de validación
- Conformación del documento electrónico, mensaje de datos o servicio

**GIIS obligatorias para todos sin excepción:**

| Guía | Aplica a |
|---|---|
| **GIIS-A004** | Todos — Sistema de Gestión de Seguridad de la Información en Salud (confidencialidad, integridad, disponibilidad) |
| **GIIS-A003** | Todos los que usen identificadores OID (HL7, CDA R2, DICOM, etc.) |

**GIIS por módulo del sistema:**

| Módulo | Guía aplicable |
|---|---|
| Consulta Externa | **GIIS-B015** |
| Salud Bucal | **GIIS-B016** |
| Salud Mental | **GIIS-B017** |
| Planificación Familiar | **GIIS-B018** |
| Detecciones | Guía específica según tipo |

> Si ninguna GIIS aplica a tu sistema, la NOM-024 no te aplica. Pero la DGIS publica nuevas guías continuamente — hay que revisarlo periódicamente.

**Dónde consultar las GIIS vigentes:** `dgis.salud.gob.mx` → sección "Guías de Intercambio de Información en Salud"

---

### Proceso de Certificación SIRES — 5 pasos

**Paso 1 — Solicitar el Paquete Informativo**
Contactar a la DGIS para obtener el paquete que contiene: formato de Solicitud de Certificación, listado de temas a verificar, proceso de auditoría y documentación relevante.
> ⚠️ No deben pasar más de **3 meses** entre la recepción del paquete y la entrega de la solicitud.

**Paso 2 — Identificar las Guías GIIS aplicables**
Consultar el sitio de la DGIS para identificar las Guías de Intercambio de Información en Salud (GIIS) que aplican al sistema. El sistema de gestión de seguridad de la información debe tener **mínimo 6 meses de madurez** antes de solicitar la verificación.

**Paso 3 — Presentar la Solicitud de Certificación**
Presentar ante la DGIS la solicitud firmada con documentación en original y copia. Solo enviar cuando se haya implementado la totalidad de interfaces, reglas de negocio, catálogos, datos mínimos y sistema de gestión de seguridad requeridos por NOM-024 y las GIIS aplicables.

**Paso 4 — Esperar respuesta y verificación**
Plazo máximo de **60 días hábiles** para recibir respuesta. La DGIS notificará por escrito la fecha de verificación.

**Paso 5 — Pre-revisión opcional (muy recomendable)**
Una vez asignada la fecha, se puede solicitar una revisión preliminar no exhaustiva para identificar y corregir deficiencias antes de la verificación formal.

**Si no se pasa la primera verificación:**
- 60 días hábiles para realizar correcciones
- Después de 30 días desde el informe, se puede notificar a la DGIS para nueva verificación
- La segunda verificación evalúa solo los hallazgos del primer informe

**Mantenimiento del certificado:**
Si no hay nuevas versiones de las GIIS verificadas ni del SIRES, se puede conservar la certificación mediante manifestación bajo protesta de decir verdad a la DGIS (sin cambios significativos en funcionamiento, diseño o proceso).

### URLs y contacto oficial DGIS

| Recurso | URL |
|---|---|
| Portal principal | `www.dgis.salud.gob.mx` |
| Página de certificación NOM-024 | `dgis.salud.gob.mx/contenidos/intercambio/certificacion-nom-024-ssa3-2012.html` |
| Procedimiento y tiempos | `dgis.salud.gob.mx/contenidos/intercambio/iis_procedimiento_certificacion_gobmx.html` |
| Guía rápida PDF (2025) | `dgis.salud.gob.mx/contenidos/intercambio/guias/guia_rapida_proceso_de_certificacion.pdf` |
| Lista de GIIS vigentes | `dgis.salud.gob.mx/contenidos/intercambio/iis_guias_gobmx.html` |
| SIRES certificados (ejemplos) | `dgis.salud.gob.mx/contenidos/intercambio/sires_certificacion_gobmx.html` |
| Catálogos obligatorios | `dgis.salud.gob.mx/contenidos/intercambio/iis_catalogos_gobmx.html` |
| Preguntas frecuentes | `dgis.salud.gob.mx/contenidos/intercambio/iis_preguntas_gobmx.html` |
| Texto completo NOM-024 | `dgis.salud.gob.mx/contenidos/normatividad/normas_gobmx.html` |

**Contacto directo para solicitar el Paquete Informativo (Paso 1):**
- Dirigir al: **Dr. Christian Arturo Zaragoza Jiménez**, Director General de Información en Salud
- Entregar en: Oficialía de Partes — Homero No. 213, Planta Baja, Col. Chapultepec Morales, Alcaldía Miguel Hidalgo, C.P. 11570, CDMX
- La solicitud debe incluir: nombre completo, correo electrónico, teléfono y domicilio en México (no hay formato predefinido)
- Email: `dgis@salud.gob.mx`
- Teléfono: 55 6392

### Acción requerida en el app
- [ ] Revisar módulos actuales contra la lista de GIIS vigentes en `dgis.salud.gob.mx`
- [ ] Determinar si el módulo de recetas constituye "expediente clínico electrónico" bajo NOM-024
- [ ] Si aplica: escribir a `dgis@salud.gob.mx` para solicitar el Paquete Informativo (Paso 1)
- [ ] Implementar sistema de gestión de seguridad (mínimo 6 meses antes de solicitar verificación)
- [ ] Implementar sistema de versioning documentado del software
- [ ] Asegurar trazabilidad de cambios en registros clínicos (audit log)
- [ ] Implementar política de retención de datos clínicos (mínimo 5 años)

---

## 4. Secretaría Anticorrupción y Buen Gobierno

### Qué es
A nivel federal: **Secretaría de la Función Pública (SFP)**. En algunos estados (ej. CDMX) se llama **Secretaría de la Contraloría General** o **Secretaría Anticorrupción y Buen Gobierno**. Es la autoridad de fiscalización, transparencia y combate a la corrupción en contrataciones gubernamentales.

### Cuándo aplica a esta plataforma

**Escenario 1 — Plataforma privada (B2C/B2B con médicos particulares)**:
- Relevancia **baja directa**
- Aplican principios generales de ética empresarial del **Sistema Nacional Anticorrupción (SNA)**
- No hay registro obligatorio

**Escenario 2 — Si la plataforma contratos con gobierno** (IMSS, ISSSTE, Secretaría de Salud, hospitales públicos):
- Registro obligatorio como proveedor en **Compranet** (sistema federal de compras)
- Cumplimiento del **Código de Ética** para proveedores del gobierno
- Posible auditoría de prácticas anticorrupción
- Contratos sujetos a la **Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público**

### Software como bien o servicio gubernamental
Si el software se licencia a entidades públicas:
- Debe tener **precio único publicado** (no discriminación de precios)
- La documentación técnica debe estar disponible para auditoría
- Puede requerirse registro en el **Registro de Proveedores Acreditados**

### Permanencia
La inscripción en registros de proveedores gubernamentales es **permanente mientras se mantengan contratos activos**, con renovaciones anuales típicamente.

### Acción requerida en el app
- [ ] Evaluar si se buscará operar con entidades gubernamentales
- [ ] Si sí: registrarse en Compranet y cumplir requisitos SFP
- [ ] Documentar estructura corporativa y accionaria (requerido para gobierno)

---

## 5. Estado de Implementación en el App

### Páginas legales existentes

| Ruta | Archivo | Última actualización | Contenido |
|---|---|---|---|
| `/privacidad` | `apps/public/src/app/privacidad/page.tsx` | 19 mar 2026 | Política de Privacidad completa |
| `/eliminacion-de-datos` | `apps/public/src/app/eliminacion-de-datos/page.tsx` | 19 mar 2026 | Proceso de solicitud de eliminación (derecho ARCO Cancelación) |
| `/terminos` | `apps/public/src/app/terminos/page.tsx` | 19 mar 2026 | Términos de Servicio |

#### `/privacidad` — contenido actual
- Secciones: Quiénes somos, Qué datos recopilamos (pacientes / médicos / automáticos), Para qué usamos los datos, Terceros con acceso, Retención, Derechos ARCO, Eliminación, Cookies, Seguridad, Cambios, Contacto
- Responsable: `tusalud.pro` — correo: `privacidad@tusalud.pro`
- Terceros documentados: Google OAuth, GA4, Google Ads, Google Calendar, Railway, UploadThing, WhatsApp/Meta
- Retención declarada: **2 años** datos de contacto / **5 años** datos clínicos (NOM-004) / fiscal según SAT — actualizado mar 2026
- Datos sensibles identificados explícitamente con etiqueta visual en sección 2
- Finalidades divididas en sección 3:
  - **Requieren consentimiento**: datos de salud del formulario pre-cita, reseñas, Google Calendar
  - **No requieren consentimiento**: agendar cita con datos de contacto (ejecución del contrato), autenticación médicos, confirmaciones, GA4, Google Ads, obligaciones legales
- Referencia a RGPD eliminada — solo aplica LFPDPPP 2025
- Derechos corregidos en sección 6: solo los 4 derechos ARCO de la ley mexicana — eliminado "Portabilidad" que es derecho del RGPD, no de la LFPDPPP
- Última actualización: 27 de marzo de 2026

#### `/eliminacion-de-datos` — contenido actual
- Canal principal: correo a `privacidad@tusalud.pro` con asunto "Solicitud de eliminación de datos"
- Confirmación: 3 días hábiles
- Ejecución: máximo 30 días hábiles desde verificación de identidad
- Menciona excepciones: obligaciones fiscales (SAT), NOM-024-SSA3, disputas activas
- Médicos con cuenta pueden eliminar expedientes directamente desde el panel

#### `/terminos` — contenido actual
- Aceptación implícita por uso de la plataforma
- Deja explícito que tusalud.pro es plataforma de intermediación (no proveedor médico)
- Ley aplicable: leyes de México, foro: tribunales de CDMX
- Limitación de responsabilidad: MX$500 o importe pagado (lo que sea mayor)

---

### Consentimientos de privacidad implementados en formularios

| Formulario | Archivo | Tipo de datos | Texto del consentimiento | Bloquea submit |
|---|---|---|---|---|
| **Booking Widget** | `apps/public/src/components/doctor/BookingWidget.tsx` | Personales (nombre, email, teléfono) | "He leído y acepto el Aviso de Privacidad y consiento el tratamiento de mis datos personales para gestionar mi cita médica." | Sí — botón disabled + validación en handleSubmit |
| **Formulario pre-cita** | `apps/public/src/app/formulario-cita/[token]/page.tsx` | Sensibles de salud (síntomas, medicamentos, antecedentes) | "He leído y acepto el Aviso de Privacidad. Consiento expresamente el tratamiento de mis datos personales de salud (incluyendo información médica, síntomas y antecedentes) para ser compartidos con el médico que me atenderá." | Sí — botón disabled + validación en handleSubmit |
| **Formulario reseña** | `apps/public/src/app/review/[token]/page.tsx` | Opinión + nombre opcional | "Acepto el Aviso de Privacidad y consiento que mi opinión y nombre (si lo proporcioné) sean publicados en el perfil del médico." | Sí — botón disabled + validación en handleSubmit |

**Detalles de implementación:**
- Todos los checkboxes enlazan a `/privacidad` con `target="_blank"`
- `privacyConsent` se resetea a `false` al iniciar una nueva reserva en el BookingWidget (`resetBooking`)
- El checkbox de reseña no llama `setError('')` en su `onChange` — no interfiere con errores de rating/comentario
- El formulario pre-cita usa texto reforzado de "consentimiento expreso" para datos sensibles — alineado con LFPDPPP 2025

**Footer — `apps/public/src/app/layout.tsx`:**
- Añadido al root layout — aparece en todas las páginas automáticamente (incluyendo `/formulario-cita/[token]`, `/review/[token]`, `/cancel-booking`)
- Links usan `Link` de Next.js (no `<a>` nativo) para client-side navigation
- Contenido: © año · Aviso de Privacidad · Términos de Servicio · Eliminación de Datos

**Cookie Banner — `apps/public/src/components/CookieBanner.tsx`:**
- ⏸ **Componente construido pero deshabilitado** — comentado en `apps/public/src/app/layout.tsx`
- Para re-habilitar: descomentar `<CookieBanner />` y añadir `import CookieBanner from "@/components/CookieBanner"` en `layout.tsx`
- Banner fijo en la parte inferior, aparece en primera visita
- Texto: "Este sitio utiliza cookies de Google Analytics para análisis de tráfico agregado." + link a `/privacidad#cookies`
- Dismissable con botón "Entendido" — guarda `cookie-notice-v1` en localStorage
- Solo muestra en el cliente (useEffect) — sin riesgo de hydration mismatch
- Bump a `cookie-notice-v2` si la política cambia y se necesita re-mostrar a usuarios existentes
- `paddingBottom: '3rem'` en `<body>` ya está activo — no genera problema con el banner desactivado

---

### Consentimiento onboarding médicos — implementado (27 mar 2026)

Flujo: pantalla de consentimiento post-login con timestamp en DB. Se ejecuta una sola vez por médico.

| Archivo | Cambio |
|---|---|
| `packages/database/prisma/schema.prisma` | Campo `privacyConsentAt DateTime? @map("privacy_consent_at")` añadido al modelo `User` |
| `packages/database/prisma/migrations/add-privacy-consent.sql` | `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMP(3)` |
| `apps/api/src/app/api/auth/user/route.ts` | Retorna `privacyConsentAt` en ambos selects (findUnique y create) |
| `apps/api/src/app/api/auth/consent/route.ts` | Endpoint interno `POST /api/auth/consent` en el API app — solo para uso del JWT callback, no del browser |
| `apps/doctor/src/app/api/auth/consent/route.ts` | **Ruta segura del doctor app** — lee el email de `auth()` (sesión server-side, no del body), escribe timestamp via Prisma directo. Llamado por el browser. |
| `packages/auth/src/nextauth-config.ts` | JWT callback: guarda `token.privacyConsentAt`; acepta `session.privacyConsentAt` en `trigger==="update"` para evitar race condition con re-fetch; session callback expone `session.user.privacyConsentAt` |
| `apps/doctor/src/app/consent/page.tsx` | Página nueva — resumen del aviso + checkbox de consentimiento expreso. Al aceptar: `POST /api/auth/consent` → `update({ privacyConsentAt })` (pasa el timestamp directamente al JWT, sin re-fetch) → `router.replace('/dashboard')` |
| `apps/doctor/src/middleware.ts` | `/consent` ya NO está en whitelist pública — requiere sesión activa. Bloque nuevo: `!session.user.privacyConsentAt && !isConsentPage` → redirect a `/consent` |
| `apps/doctor/src/types/next-auth.d.ts` | `privacyConsentAt: string \| null` añadido a `Session` interface y `JWT` interface |

**Comportamiento del flujo:**
1. Médico inicia sesión con Google OAuth → intenta acceder a `/dashboard`
2. Middleware verifica: sesión ✓ → rol ✓ → `privacyConsentAt === null` → redirect a `/consent`
3. Doctor lee resumen del aviso y marca checkbox → "Aceptar y continuar"
4. `POST /api/auth/consent` (doctor app, autenticado vía `auth()`) registra timestamp en DB
5. `update({ privacyConsentAt: timestamp })` — JWT callback recibe el valor directamente y lo escribe en el token sin volver a consultar la DB (evita race condition)
6. `router.replace('/dashboard')` → middleware ve `privacyConsentAt` en sesión → acceso completo
7. Próximas visitas: JWT ya trae `privacyConsentAt` → middleware permite sin redirigir

**Decisiones de seguridad:**
- El email del médico viene de `auth()` server-side, nunca del request body — previene que cualquier llamador actualice el consentimiento de otro usuario
- `/consent` requiere sesión válida (no está en whitelist) — un usuario no autenticado es redirigido a `/login` antes de llegar a la pantalla de consentimiento
- Race condition resuelta: el timestamp se pasa directamente a `update()` en lugar de forzar un re-fetch que podría llegar antes de que el commit de DB esté visible

---

### Gaps de implementación pendientes

| Gap | Impacto legal | Prioridad |
|---|---|---|
| Sin nombre de Oficial de Privacidad asignado formalmente | LFPDPPP 2025 — designación obligatoria | 🟡 Medio |

---

## Resumen de Prioridades

| Requisito | Estado | Urgencia | Notas |
|---|---|---|---|
| Página Aviso de Privacidad | ✅ Hecho | — | `/privacidad` existe |
| Consentimiento en reserva de citas | ✅ Hecho | — | `BookingWidget.tsx` |
| Consentimiento en formulario pre-cita | ✅ Hecho | — | `/formulario-cita/[token]` |
| Consentimiento en formulario reseña | ✅ Hecho | — | `/review/[token]` |
| Email ARCO operativo | ✅ Hecho | — | `privacidad@tusalud.pro` |
| Página eliminación de datos | ✅ Hecho | — | `/eliminacion-de-datos` |
| Consentimiento onboarding médicos | ✅ Hecho | — | Pantalla `/consent` post-login con timestamp en DB (`privacy_consent_at`) |
| Link `/privacidad` en footer (todas las páginas) | ✅ Hecho | — | Footer en root `layout.tsx` — usa `Link` de Next.js |
| Corregir retención: 2 años → 5 años (datos clínicos) | ✅ Hecho | — | `/privacidad` sección 5 — 3 categorías diferenciadas, contradicción con eliminación resuelta |
| Actualizar `/privacidad` para LFPDPPP 2025 | ✅ Hecho | — | Datos sensibles marcados, finalidades divididas, RGPD removido, derechos ARCO corregidos (portabilidad no es LFPDPPP) |
| Política de cookies explícita (GA4 activo) | ⏸ Deshabilitado | 🟠 **Medio** | Componente `CookieBanner.tsx` construido pero desactivado — re-habilitar en `layout.tsx` cuando se decida |
| Designar Oficial de Privacidad formalmente | ⬜ Pendiente | 🟡 **Medio** | LFPDPPP 2025 — obligatorio |
| Revisar GIIS vigentes en dgis.salud.gob.mx | ⬜ Pendiente | 🟡 **Medio** | Determina si NOM-024 aplica |
| Revisión NOM-024 para módulo recetas | ⬜ Pendiente | 🟡 **Medio** | Si alguna GIIS aplica |
| GIIS-A004 (seguridad) si aplica NOM-024 | ⬜ Pendiente | 🟡 **Medio** | Obligatoria para todos los SIRES |
| Certificación SIRES/DGIS | ⬜ Pendiente | 🟡 **Medio** | Solo si aplica NOM-024 |
| Versioning documentado del software | ⬜ Pendiente | 🟡 **Medio** | Solo si aplica NOM-024 |
| Registro Compranet / SFP | ⬜ Pendiente | 🔵 **Bajo** | Solo si se busca gobierno |

---

## Referencias Legales

| Documento | Descripción |
|---|---|
| LFPDPPP 2025 | Ley Federal de Protección de Datos Personales en Posesión de los Particulares — publicada DOF 20/03/2025, abroga ley de 2010 |
| Autoridad actual | Secretaría Anticorrupción y Buen Gobierno (reemplaza al INAI disuelto) |
| NOM-024-SSA3-2012 | Sistemas de información de registro electrónico para la salud |
| NOM-004-SSA3-2012 | Del expediente clínico |
| Lineamientos INAI | Lineamientos del Aviso de Privacidad (DOF 17/01/2013) |
| Ley SNA | Ley General del Sistema Nacional Anticorrupción |

---

*Nota: Este documento es una guía de referencia interna. Se recomienda consultar con un abogado especializado en derecho digital y salud en México antes de tomar decisiones de implementación definitivas.*
