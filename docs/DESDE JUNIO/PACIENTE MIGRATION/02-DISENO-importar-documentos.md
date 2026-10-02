# 02 — DISEÑO: importar los DOCUMENTOS de los pacientes (sólo guardar, sin IA)

> **Estado (2026-10-01): DISEÑO APROBADO en lo grande («Word se vuelve nota» — decisión del usuario);
> las decisiones menores de §5 van con la recomendación salvo que el usuario diga otra cosa. Plan de
> construcción en §7. No hay código.**
> La importación `.xlsx` de pacientes y consultas ya está en prod (ver `README.md` y `SESSION-REFRESCO.md`
> de esta carpeta); esto es la otra mitad: los **archivos** que el doctor ya tiene por paciente.

## 1. Qué es, en una línea

El doctor que llega de papel, Word o de otro sistema tiene **carpetas de archivos por paciente** (PDFs,
Word, fotos de hojas, escaneos). Esta herramienta los trae **en bloque**, sin capturarlos uno por uno:

- **Word (.docx) → una NOTA** del paciente con el texto del documento. El texto se saca en el
  navegador con una librería (`mammoth`) — **sin IA, sin terceros, sin costo por documento** — y el
  archivo Word **no se sube ni se guarda** (decisión del usuario 2026-10-01: un Word guardado sólo se
  podría descargar, no ver; como nota se lee y se busca dentro del expediente).
- **PDF e imágenes → ARCHIVOS** en el **Docs y Galería** del paciente, tal cual (se ven en el app). Un
  Word cuyas imágenes o formato importan se exporta a PDF y entra por aquí.

## 2. Qué NO es (por ahora)

- **No usa IA.** Los PDF y las imágenes se guardan tal cual (no se leen); el Word sólo se convierte a
  TEXTO de forma mecánica (lo que dice el documento, sin resumir ni interpretar). Leer PDFs/escaneos y
  proponer notas o plantillas es la fase de IA, después — ver §8.
- **No crea pacientes.** Los pacientes se traen antes con la importación `.xlsx` (ya en prod) o a mano.
  Un archivo sin paciente no se guarda (§5, D4).
- **No crea visitas.** Los documentos quedan **«Sin visita»** (el camino de fase 1 para lo que no pasó en
  una visita — `VISITAS/01-DISENO` §7).

## 3. Lo que ya existe y se reusa

| Pieza | Dónde | Lo que importa aquí |
|---|---|---|
| Importación `.xlsx` de pacientes y consultas | `dashboard/medical-records/importar` (doctor) · `packages/database/src/patient-import*.ts` | Es **del TITULAR** (no de ayudantes). Este importador vive junto a ella. |
| Docs y Galería | `patients/[id]/media` · tabla `PatientMedia` | `mediaType: 'document' \| 'image' …`, `captureDate` **obligatoria**, `category`, `description`, `visitaId` opcional (null = «Sin visita»). |
| Subida de archivos | `apps/doctor/src/app/api/uploadthing/core.ts` | `medicalDocuments` acepta **sólo PDF** (32 MB, 10 por vez); `medicalImages` imágenes (16 MB, 10). Como el Word NO se sube (se vuelve nota), **no hace falta un tipo nuevo**. |
| Notas | `patients/[id]/notes` · tabla `PatientNote` | Texto plano; la **primera línea es el título** en la lista. Sólo `createdAt`/`updatedAt` como fecha. Hoy crear una nota **no** escribe en la bitácora. |
| Cupo de almacenamiento por plan | `packages/database/src/permissions.ts` (`TIER_LIMITS`, `assertStorageQuota`) | FREE **500 MB** · BÁSICO 15 GB · PRO 50 GB. Se cobra ANTES de transferir (middleware de uploadthing). |
| Bitácora | `logAudit` | `upload_media` por archivo; aquí además un `batchId` por importación (como la `.xlsx`). |

## 4. El flujo propuesto

**Entrada:** Expedientes Médicos → **«Importar»** (la misma pantalla de la `.xlsx`), nueva opción
**«Documentos de pacientes»**. Sólo el titular.

1. **Soltar los archivos.** El doctor arrastra muchos archivos a la vez — o una **carpeta** (en Chrome se
   puede soltar una carpeta entera; sus subcarpetas llegan con su ruta, p. ej.
   `Pepito Pérez/laboratorio 2023.pdf`). Todavía **no se sube nada**: sólo se leen nombre, tamaño, tipo
   y fecha de modificación del archivo, en el navegador.
2. **A quién va cada archivo (sin IA).** El sistema propone el paciente comparando el **nombre de la
   carpeta y del archivo** contra los pacientes del doctor (sin acentos, sin mayúsculas, nombre y
   apellidos en cualquier orden). Cada archivo queda en uno de tres estados:
   - ✅ **Un paciente** — propuesto; el doctor puede cambiarlo.
   - ⚠️ **Varios posibles** (dos «Pepito Pérez», o «Pérez» a secas) — el doctor elige.
   - ❓ **Ninguno** — el doctor lo busca y lo asigna, o lo quita del lote.
   Nunca se junta en silencio a dos homónimos: si hay duda, decide el doctor.
   Alternativa en la misma pantalla: **por paciente** — buscar a «Pepito Pérez» y soltarle sus archivos.
3. **Fecha de cada documento** (la pide `PatientMedia`, y la nota la usa como su fecha): una fecha que venga en el nombre
   (`2023-05-14`, `14-05-2023`, `14 may 2023`); si no hay, la fecha de modificación del archivo; el
   doctor la puede cambiar. **Nunca** la fecha de hoy por default: el expediente diría que el
   laboratorio de 2019 es de hoy.
4. **Revisar y confirmar.** Un resumen: «47 archivos · 12 pacientes · 380 MB · te quedan 14.2 GB». Si no
   cabe en el cupo del plan, se dice **antes** de subir (no a la mitad).
5. **Subir y guardar.** Recién aquí:
   - cada **PDF/imagen** se sube y se guarda en el Docs y Galería de su paciente: «Sin visita», categoría
     **«Historial importado»**, descripción «Importado de *ruta/del/archivo*»;
   - cada **Word** se convierte a texto en el navegador (ya se hizo en el paso 1 para avisar de los que no
     se pueden) y se guarda como **nota**: primera línea «Importado de *archivo.docx* · 14 may 2023», luego
     el texto; la fecha de la nota es la del documento. «Sin visita».
   Con barra de avance; un archivo que falla no detiene a los demás y al final se puede **reintentar**.
6. **Resultado.** «45 guardados · 2 fallaron (reintentar)», y un enlace a cada paciente.

## 5. Decisiones para el usuario (recomendación primero)

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| **D1** ✅ | ¿Qué tipos de archivo? | **PDF e imágenes → archivos; Word `.docx` → NOTA** (decidido por el usuario 2026-10-01). | Un Word guardado sólo se descargaría; como nota se lee y se busca. |
| **D1b** | ¿Límites del Word? | **5 MB por archivo y ~100 000 caracteres de texto** (≈ 30–40 páginas). Más grande → «guárdalo como PDF». | Una nota así ya es enorme para el editor; el resto entra como PDF. |
| **D1c** | ¿Y el `.doc` viejo (Word 97–2003)? | **Se rechaza** con «guárdalo como .docx o PDF». | No se puede leer igual que el `.docx`; abrirlo exigiría otra herramienta. |
| **D1d** | ¿Imágenes dentro del Word? | **Se pierden** en la nota, y la pantalla lo avisa por archivo. | El texto es lo que se vuelve nota; si las imágenes importan, se exporta a PDF. |
| **D7** | ¿Fecha de la nota? | **La del documento** como fecha de la nota **y** en su primera línea. | Si no, cinco notas importadas dirían que se escribieron hoy. |
| **D2** | ¿Dónde vive? | En **Importar**, junto a la `.xlsx`, **sólo el titular**. | Es una carga masiva de toda la base, como la `.xlsx`. |
| **D3** | ¿Fecha por default? | **La del nombre → si no, la de modificación del archivo**; editable. | La de hoy falsearía la historia (lección del hueco #7 de la `.xlsx`). |
| **D4** | ¿Archivo sin paciente? | **No se guarda**; se asigna a mano o se quita. No se crean pacientes aquí. | Crear pacientes desde un nombre de archivo daría pacientes a medias (sin folio, sin datos). Para eso está la `.xlsx`. |
| **D5** | ¿Límites por lote? | **Hasta 300 archivos por importación**; tamaño por archivo el de hoy (PDF 32 MB, imagen 16 MB); cupo revisado antes. | Un lote más grande se parte en varios; así una falla no tumba horas de subida. |
| **D6** | ¿Cómo se distinguen después? | Categoría **«Historial importado»** + el `batchId` en la bitácora. | Se pueden filtrar, y si algo salió mal, **deshacer el lote** con precisión (como la `.xlsx`). |

## 6. Riesgos y cómo se cubren

- **Archivos huérfanos** (se subió el archivo pero no se guardó en el expediente): sólo se sube al
  CONFIRMAR, y el guardado en el expediente va inmediatamente después; un fallo se reporta y se
  reintenta. Lo que quede subido sin guardar se ve en el libro de archivos (`registrarArchivo`) y se
  puede limpiar.
- **URL de confianza:** hoy `POST …/media` guarda la `fileUrl` que manda el navegador. El guardado en
  bloque debe **comprobar que cada URL es un archivo que ESTE doctor subió** (está en su libro de
  archivos) — si no, cualquiera podría colgar en un expediente un enlace ajeno.
- **Cupo:** FREE tiene 500 MB; un expediente escaneado lo llena rápido. Se avisa antes de subir y se dice
  cuánto falta. (Q4 de TIERS ya rechaza en el servidor antes de transferir.)
- **Homónimos:** nunca se asigna en silencio cuando hay más de un candidato (§4.2).
- **Privacidad (LFPDPPP):** sin IA no sale nada a terceros; el Word se lee EN el navegador del doctor;
  los PDF/imágenes van al mismo almacenamiento que ya usa Docs y Galería.
- **Costo:** el Word → nota cuesta **$0** (navegador; la nota pesa KB). Los archivos ocupan el
  almacenamiento: con el plan actual de UploadThing de **100 GB** (confirmado por el usuario 2026-10-01)
  caben ~200 doctores FREE con su cupo de 500 MB LLENO antes de tener que subir de plan; en R2 serían
  ~$0.0075 al mes por doctor FREE lleno (precios de `IMAGE MIGRATION/01-ANALISIS`, 2026-08-27 —
  re-verificar si se decide algo con dinero). El usuario dijo que el almacenamiento no es preocupación hoy.
- **Una nota con texto mal convertido** (tablas raras, columnas): la nota queda como «Sin visita» y se
  puede editar o borrar como cualquier nota; la pantalla muestra un vistazo del texto antes de guardar.

## 6b. Huecos encontrados al revisar el diseño contra el código (2026-10-01) — y su arreglo

| # | Hueco | Arreglo |
|---|---|---|
| G1 | **Duplicados al re-correr** (se cerró la pestaña a la mitad y se vuelve a importar) | El servidor revisa si ese paciente ya tiene un archivo importado con el mismo nombre y tamaño (o una nota importada con la misma primera línea) → «ya importado», se salta. |
| G2 | **El día se corre**: `captureDate` es TIMESTAMP, no `@db.Date`; «14 may» a medianoche UTC se ve **13 may** en México | Las fechas de documento se guardan a **mediodía de México**; se prueba con una hora tardía (memoria `feedback_dbdate_vs_timestamp_utc`). |
| G3 | **Fechas ambiguas** en el nombre («05-04-2023») | Las numéricas se leen **día-mes** (formato mexicano); quedan editables y se ven antes de guardar. |
| G4 | **HEIC** (iPhone): se guardaría pero Chrome no lo muestra | Sólo **JPG, PNG y WebP**; HEIC se rechaza con «conviértela a JPG». |
| G5 | **Word sin texto** (un escaneo pegado en Word), con contraseña o dañado | Se rechaza ESE archivo con su motivo («no tiene texto; expórtalo a PDF», «está protegido»…); los demás siguen. |
| G6 | **Pacientes archivados** no salen en la lista ⇒ «ningún paciente» | Se emparejan también los archivados, marcados «archivado». |
| G7 | **Archivos huérfanos** si se abandona a la mitad (subidos, sin guardar, gastando cupo) | Cada tanda de 10 se guarda en cuanto se sube ⇒ como mucho una tanda queda suelta; se encuentran por `StoredFile` sin `PatientMedia` (documentado, sin botón). |
| G8 | **Por folio**: archivos nombrados con el folio (`P1787…`, `MIG-…`) no emparejarían | Se empareja por **folio** además de por nombre. |

Revisado y bien: cuenta **congelada** (la bloquean la subida y `requireDoctorAuth`); **planes** (importar no
está en las exclusiones de FREE; el cupo de almacenamiento sigue mandando); **cupo restante** (ya existe
`GET /api/account/summary` → `almacenamiento`). Por diseño, no huecos: soltar una CARPETA funciona en
Chrome/Edge (en otros, el botón de elegir archivos); el Word conserva el texto, no el formato.

## 7. Cómo se construye (propuesta)

| Paso | Qué | Riesgo |
|---|---|---|
| **I1** | **El servidor.** Ruta `POST /api/medical-records/importar-documentos` (sólo titular), por TANDAS de hasta 25 elementos: cada uno es un **archivo** (`fileUrl` ya subida por las rutas que existen, `medicalDocuments`/`medicalImages`) o una **nota** (texto ya extraído). Valida: paciente del doctor; la `fileUrl` está en el libro de archivos de ESTE doctor; fecha válida y no futura; texto ≤ 100 000 caracteres; tipos permitidos. Crea `PatientMedia` («Historial importado», «Sin visita») y `PatientNote` (fecha del documento en `createdAt`/`updatedAt`). Bitácora por elemento con `batchId` y la ruta del archivo. Respuesta por elemento (ok / error con motivo) para reintentar sólo lo que falló. Probe contra prod en tx revertida (incluye que Prisma acepte `updatedAt` explícito). | Bajo: tablas que ya existen, sin cambio de esquema |
| **I2** | **La pantalla** en Importar: soltar archivos o carpeta · emparejar por nombre (función pura, con casos de prueba: acentos, orden de nombres, homónimos) · fecha por archivo · Word → texto con `mammoth` en el navegador (vistazo + avisos de imágenes perdidas, `.doc`, tamaño) · resumen con cupo · subir PDF/imágenes de 10 en 10 con las rutas que ya existen · guardar por tandas · avance y reintento. Dependencia nueva `mammoth` ⇒ `pnpm-lock.yaml` en el MISMO commit. | Medio: es la parte grande |
| **I3** | Manual + guía + capabilities en el mismo commit que la pantalla; prueba a mano en dr-prueba con archivos falsos (Word, PDF, imagen, un homónimo, un `.doc`, uno sin paciente) — pantalla Y BD. | — |

**✅ I1 escrito (2026-10-01):** `POST /api/patient-import/documentos` (apps/doctor; el prefijo
`patient-import` ya es OWNER_ONLY en el mapa de rutas y la ruta revisa `isOwner` otra vez) → la lógica
vive en `apps/doctor/src/lib/importar-documentos.ts` (`guardarTanda`), con la bitácora INYECTADA para que
el probe corra el código real sin escribir en prod. Hallazgo del review: el cotejo por llave aceptaba
`https://otro-sitio/f/<llave-real>` ⇒ ahora se guarda la URL **del libro de archivos** (`StoredFile.url`),
nunca la del navegador, y el tamaño también sale del libro. Probe
`scripts/patient-import/importar-documentos-probe.ts` **23/23** contra prod (tx revertida). Segunda pasada de
review: el TIPO lo manda el libro (`StoredFile.kind` = `medicalDocuments`/`medicalImages`), no el MIME del
navegador — un PDF no se guarda como imagen y una factura o la foto del perfil no se cuelgan en un
expediente; y el duplicado de una nota es el CONTENIDO idéntico (dos `consulta.docx` con la misma fecha y
otro texto son dos notas). Casos: guardado,
G1 duplicados (archivo y nota), URL fuera del libro, archivo de otro doctor, host ajeno, G4 HEIC, G5 Word
sin texto, > 100 000 caracteres, fecha futura y 31-feb, paciente ajeno, categoría/«Sin visita», G2 el día
en México (`14 may` = `T18:00Z`) en `captureDate` y en `createdAt`/`updatedAt` de la nota (Prisma acepta
`updatedAt` explícito), bitácora con `batchId`. Nadie la llama todavía: la pantalla es I2.

Deshacer un lote: por `batchId` en la bitácora (un script, como el de la `.xlsx`; no hay botón).

Tamaño estimado: parecido a F4 de la `.xlsx` (la UI del doctor). Sin migración de base de datos.

## 8. Después (NO en esta etapa)

**Leer los documentos con IA** y proponer notas (o campos de plantilla) para que el doctor las revise.
Antes de construirlo hay que decidir: privacidad (mandar documentos de salud a un proveedor de IA), costo
por documento, si cuenta como «IA» para los planes, y la regla dura de no inventar datos clínicos (el
texto original se conserva; lo resumido se marca). Detalle de la idea en la conversación del 2026-10-01.
