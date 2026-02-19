# Mi Perfil (Perfil Público del Médico)

## Qué es

El módulo "Mi Perfil" permite al médico configurar su **perfil público** — la página visible para pacientes y visitantes en internet. Incluye información general, servicios, clínica, formación académica, multimedia, FAQs y redes sociales.

## Acceso

**Ruta:** Menú lateral > Mi Perfil
**URL:** `/dashboard/mi-perfil`

---

## Pestañas del Perfil

El perfil está organizado en 7 pestañas:

| Pestaña | Contenido |
|---------|-----------|
| Info General | Datos básicos del médico |
| Servicios | Servicios que ofrece y condiciones que atiende |
| Clínica | Dirección, teléfono, horarios de atención |
| Formación | Educación, certificaciones |
| Multimedia | Carrusel de imágenes/videos del consultorio |
| FAQs y Social | Preguntas frecuentes y redes sociales |
| Opiniones | Reseñas de pacientes (solo lectura) |

---

## Pestaña: Info General

Datos principales del perfil público.

**Campos de solo lectura (gestionados por el administrador):**

| Campo | Descripción |
|-------|-------------|
| Nombre completo | Nombre del médico que aparece en el perfil público |
| Apellidos | Apellidos |
| Ciudad | Ciudad donde ejerce |
| Slug (URL) | Identificador único para la URL (ej: `dr-garcia-lopez`) — mostrado como `/doctors/{slug}` |

**Campos editables por el médico:**

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Especialidad principal | Sí | Especialidad médica principal |
| Cédula profesional | No | Número de cédula (aparece en perfil para transparencia) |
| Imagen de perfil | No | Foto principal del médico (upload vía UploadThing) |
| Biografía corta | Sí | Resumen para listados — **máx 300 caracteres** (contador visible) |
| Biografía larga | No | Descripción completa del médico |
| Años de experiencia | Sí | Número 1–60 |
| Paleta de colores | No | Selector visual del tema del perfil público |

**Nota:** Las subespecialidades existen en el modelo de datos pero no son editables desde esta interfaz.

---

## Pestaña: Servicios

Lista de servicios que ofrece el médico. Cada servicio tiene:

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Nombre del Servicio | Sí | Ej: "Consulta General" |
| Descripción Corta | Sí | Resumen del servicio |
| Duración (min) | Sí | Número 1–480 minutos |
| Precio | No | Precio en número decimal |

Se pueden agregar y eliminar servicios. Un contador muestra el total de servicios registrados.

---

## Pestaña: Clínica

| Campo | Requerido | Descripción |
|-------|-----------|-------------|
| Dirección | Sí | Dirección física del consultorio |
| Teléfono | Sí | Número de contacto |
| WhatsApp | No | Número de WhatsApp para contacto |
| Horarios de atención | — | Por día (Lunes–Domingo) — formato: "9:00 AM - 6:00 PM" o "Cerrado" |
| Latitud / Longitud | No | Coordenadas para mostrar mapa |
| Condiciones que atiende | No | Una por línea — ej: "Hipertensión\nDiabetes" |
| Procedimientos realizados | No | Una por línea — ej: "Electrocardiograma\nEcocardiografía" |

**Horarios default:**
- Lunes a Viernes: 9:00 AM - 6:00 PM
- Sábado y Domingo: Cerrado

**Botón de ayuda:** "Buscar Dirección en Google Maps" — abre Google Maps con la dirección ingresada.

---

## Pestaña: Formación

| Sección | Descripción |
|---------|-------------|
| Educación | Lista de estudios — cada uno con: institución, programa, año y notas |
| Certificaciones | Imágenes de certificados con: foto, descripción (alt), institución emisora y año |

---

## Pestaña: Multimedia

Carrusel de imágenes o videos del consultorio que aparece en el perfil público.

Cada ítem del carrusel tiene:
- **Tipo:** image o video
- **Fuente (src):** URL de la imagen o video
- **Alt:** Texto alternativo descriptivo
- **Caption:** Descripción visible bajo la imagen/video

---

## Pestaña: FAQs y Social

| Sección | Descripción |
|---------|-------------|
| FAQs | Preguntas frecuentes con pregunta y respuesta — aparecen en el perfil público |
| Redes Sociales | LinkedIn y Twitter/X del médico |

---

## Pestaña: Opiniones

Vista de solo lectura de las reseñas de pacientes:
- Calificación promedio
- Número de reseñas
- Lista de reseñas con: nombre del paciente, calificación (estrellas), comentario y fecha

**El médico no puede eliminar ni modificar reseñas.**

---

## Guardar Cambios

Cada pestaña tiene su propio botón de guardado. Al guardar:
- Los cambios se publican inmediatamente en el perfil público
- Mensaje de confirmación: éxito o error

---

## Perfil Público

El perfil público del médico es accesible para cualquier visitante. Incluye:
- Información general y foto
- Servicios con precios
- Horarios de disponibilidad de citas
- Información de la clínica con mapa
- Blog del médico (artículos publicados)
- Reseñas de pacientes

La URL del perfil público depende del `slug` configurado.

---

## Restricciones del Sistema

| Acción | Estado |
|--------|--------|
| Tener múltiples perfiles | ❌ Un perfil por médico |
| Cambiar slug (URL) después de publicar | ⚠️ Posible — pero rompe links existentes |
| Eliminar reseñas de pacientes | ❌ No permitido |
| Ocultar el perfil público completamente | ❌ El perfil es siempre accesible |
| Importar datos de perfil de LinkedIn | ❌ Sin importación |

---

## Preguntas Frecuentes

**¿Dónde ven los pacientes mi perfil?**
En la URL pública que se forma con tu slug (consultar en el menú lateral el enlace "Perfil Público").

**¿Puedo tener varias especialidades?**
Sí. Tienes una especialidad principal y puedes agregar múltiples subespecialidades.

**¿Los cambios al perfil se publican de inmediato?**
Sí, al guardar cada sección los cambios se reflejan de inmediato en el perfil público.

**¿Qué es el slug?**
Es el identificador único en la URL de tu perfil. Ej: si tu slug es `dr-juan-garcia`, tu perfil está en `[dominio]/dr-juan-garcia`.

**¿Puedo agregar más redes sociales además de LinkedIn y Twitter?**
No, actualmente solo se soportan esas dos redes sociales.
