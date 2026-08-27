# 🗺️ Plan — migrar de UploadThing a Cloudflare R2

> **Qué es este doc.** El plan de ejecución. El porqué de elegir R2 y los números que lo
> sostienen viven en [`01-ANALISIS`](01-ANALISIS-uploadthing-vs-alternativas.md).
>
> **Estado: NO EMPEZADO** (escrito 2026-08-27). Nada de esto está en código todavía.
> Al terminar cada fase, actualiza el §7 y el `README` de esta carpeta.

---

## 0. 🆕 2026-08-27 (al cerrar la sesión) — hay una opción MÁS BARATA que migrar: no pagar

El plan de abajo sigue siendo correcto, pero **el disparador dejó de ser urgente**. UploadThing
tiene un **plan gratuito de 2 GB** y nosotros usamos **~0.2 GB**: se puede **bajar al plan
gratis y dejar de pagar los $10/mes SIN migrar nada**. Los 232 archivos siguen donde están,
todo sigue funcionando, y la migración se hace el día que de verdad convenga.

**Eso hace desaparecer el argumento del dinero.** Quedan dos, y conviene tenerlos separados:

1. **El costo de migrar escala con los datos.** Hoy son 232 archivos; a 100 GB es otro
   proyecto. Sigue siendo cierto — sólo que ya no urge, porque a este ritmo faltan años.
2. 🔴 **La exposición de las imágenes clínicas NO la arregla ningún plan.** Hoy se sirven en
   URLs públicas permanentes: inadivinables, pero sin autenticación y para siempre.

> ⚠️ **Y aquí está la trampa de bajarse al plan gratis:** según la página de precios de
> UploadThing (verificada 2026-08-27), *"Regions and private files"* aparece en los planes de
> **$10 y $25**, y **no** en el gratuito. O sea que **bajar a gratis puede CERRAR la puerta a
> los archivos privados** — justo la herramienta con la que se arreglaría la exposición de
> arriba. Hay que confirmarlo con ellos antes de bajar el plan: si es así, la decisión real no
> es "pagar o no pagar", sino **"pagar $10 por privacidad, o migrar a R2 y tenerla gratis"**.

**Lo primero que debe hacer la próxima sesión, antes que nada:** entrar al panel de UploadThing
y confirmar (a) cuánto ocupa el bucket DE VERDAD —el 232 sale de la BASE y no cuenta huérfanos,
así que podríamos estar más cerca de los 2 GB de lo que creemos— y (b) si el plan gratuito
permite archivos privados. Con esas dos respuestas la decisión se toma sola.

---

## 1. La idea en una frase

**Los archivos NUEVOS van a R2; los 232 viejos se quedan en UploadThing hasta que se muevan a
propósito.** No hay día de corte porque la BD guarda **URLs absolutas**: cada archivo dice
dónde vive, así que las dos épocas conviven sin capa de compatibilidad.

## 2. Lo que hay que tocar

### 2.1 Las file routes (el contrato de subida)

| App | Route | Límites de hoy |
|---|---|---|
| `admin` | `doctorHeroImage` | image 4 MB × 1 |
| `admin` | `doctorCertificates` | image 16 MB × 20 |
| `admin` | `clinicPhotos` | image |
| `api` · `doctor` | `ledgerAttachments` | image 8 MB × 10 · pdf 16 MB × 10 |
| `api` · `doctor` | `ledgerFacturasPdf` | pdf 16 MB × 5 |
| `api` · `doctor` | `ledgerFacturasXml` | xml 2 MB × 5 |
| `doctor` | `medicalImages` | image 16 MB × 10 |

⚠️ `ledgerAttachments` / `ledgerFacturasPdf` / `ledgerFacturasXml` están **duplicadas** en
`apps/api` y `apps/doctor`. Migrar una y no la otra deja la mitad del flujo escribiendo en el
proveedor viejo — y no truena, sólo queda inconsistente. Van juntas.

### 2.2 Las 13 columnas con URLs

Las de [`01-ANALISIS` §1](01-ANALISIS-uploadthing-vs-alternativas.md). **Doce son un URL por
celda; una NO:** `public.articles.content` trae las URLs **incrustadas en el HTML** del
artículo (6 casos). Esa columna se migra con reemplazo dentro del texto, no asignando un campo
— es el único caso donde un `UPDATE` ingenuo rompe contenido.

### 2.3 Dependencias

`uploadthing@^7.7.4` y `@uploadthing/react@^7.3.3` en `admin`, `api` y `doctor`. **No se quitan
hasta la Fase 3**, y cuando se quiten: `pnpm-lock.yaml` en el MISMO commit (Railway instala con
frozen lockfile).

## 3. Decisiones de diseño (tomadas antes de escribir código)

1. **Espejo, no reinvención.** El seam (`lib/storage`) expone algo con la MISMA forma que las
   file routes de hoy —nombre, tipos aceptados, tamaño máximo, cuántos archivos— para que los
   ~25 call sites cambien lo mínimo y **cada route se pueda voltear o revertir sola**.
2. **Dos buckets, no uno.**
   - **privado** → imágenes clínicas y documentos fiscales; se sirven con **GET prefirmado de
     vida corta**;
   - **público** → marketing (carousel, portadas del blog, hero, logos), con dominio propio.

   > 🔴 **Hoy TODO es público.** Los `utfs.io` son inadivinables pero **permanentes y sin
   > autenticación**: quien tenga el link ve la imagen clínica para siempre. Bajo LFPDPPP eso
   > es *dato personal sensible* servido sin control. Separar los buckets AHORA cuesta lo mismo
   > que no separarlos; hacerlo después es volver a migrar.
3. **Credenciales sólo en Railway** (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
   `R2_BUCKET_*`, `R2_PUBLIC_BASE_URL`). Nunca en el repo, nunca en un `NEXT_PUBLIC_*`.
4. **La subida la firma el SERVIDOR.** El cliente nunca ve la llave: pide un PUT prefirmado a
   una ruta autenticada, que valida MIME y tamaño ANTES de firmar. Es el mismo principio que ya
   rige al agente: el veredicto lo da el servidor.
5. **Nada se borra de UploadThing hasta que su reemplazo esté verificado.** El rollback de las
   fases 1 y 2 es apagar un flag; el de la 3 sólo existe mientras el original siga vivo.

## 4. Fases

### Fase 1 — el seam, sólo subidas nuevas
- `lib/storage` con cliente S3 apuntando a R2, emisión de PUT prefirmado y un uploader React.
- **Una route primero** (propuesta: `doctorCertificates` o `carousel` — marketing, público, sin
  dato clínico) para validar el camino completo con el menor riesgo posible.
- UploadThing sigue instalado y sirviendo los 232 archivos viejos.
- ✅ **Listo cuando:** un archivo nuevo sube, se guarda su URL de R2 y se ve en pantalla.

### Fase 2 — el resto de las routes
- Voltear las demás, **de a una**, dejando las clínicas (`medicalImages`) para el final.
- Verificar en las TRES apps que los límites de tamaño/MIME siguen aplicando (son parte del
  contrato, no adorno).
- ✅ **Listo cuando:** ninguna ruta escribe ya en UploadThing.

### Fase 3 — mover los 232 y dejar de pagar
1. Copiar archivo por archivo (script con `wrangler` o el SDK de S3).
2. Reescribir las 13 columnas — ojo con `articles.content` (§2.2).
3. **Verificar que TODA URL resuelve** antes de borrar nada.
4. Recién entonces: borrar en UploadThing, quitar las deps (+ lockfile) y cancelar el plan.
- ✅ **Listo cuando:** cero referencias a `utfs.io`/`ufs.sh` en la BD y todo abre.

## 5. Cómo se verifica (no es opcional)

- **Antes de cada push**: `pnpm type-check` + `pnpm gates` (los CINCO).
- **Smoke read-only contra prod** de cualquier query nuevo, con el método de
  [`../flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`](../flujo%20de%20dinero%20permutaciones/TOOLING-acceso-railway-db.md).
- 🔴 **Y una subida REAL en cada fase.** Esto es UI + red: `type-check` en verde no dice nada
  sobre si el archivo llegó. Esta misma semana un arreglo de UI compiló, pasó los cinco gates,
  se desplegó y **no hizo absolutamente nada** en pantalla
  (`67c3f106`, ver [`../CITAS/SESSION-REFRESCO.md`](../CITAS/SESSION-REFRESCO.md)).
- **Conteo antes/después** con el barrido del §1 del análisis: es el contador que dice si la
  Fase 3 terminó de verdad.

## 6. Riesgos conocidos

| Riesgo | Por qué muerde | Mitigación |
|---|---|---|
| Migrar una copia de `ledgerAttachments` y no la otra | No truena: sólo la mitad del flujo escribe en el proveedor viejo | Tratar `api` + `doctor` como una sola unidad |
| `articles.content` con URLs incrustadas | Un `UPDATE` ingenuo rompe el HTML del artículo | Reemplazo dentro del texto + revisar los 6 a mano |
| Archivos huérfanos en el bucket viejo | El conteo de 232 sale de la BD, no del bucket | Contrastar con el panel de UploadThing antes de la Fase 3 |
| Borrar antes de verificar | Irreversible | El borrado es el ÚLTIMO paso, después de que toda URL resuelva |
| Quitar las deps sin regenerar el lock | Railway instala con frozen lockfile: el build falla y el push no shipea | `pnpm-lock.yaml` en el mismo commit |
| Bucket público para imágenes clínicas | Repetiría el problema que venimos a arreglar | Dos buckets desde el día uno (§3.2) |

## 7. Bitácora

| Fecha | Fase | Qué pasó |
|---|---|---|
| 2026-08-27 | — | Análisis y decisión (R2). Plan escrito. **Sin código.** Falta: cuenta de Cloudflare con R2, bucket(s) y token S3 en Railway. |
| 2026-08-27 | — | **Se descubrió el plan GRATUITO de 2 GB de UploadThing** (usamos ~0.2 GB) ⇒ se puede dejar de pagar sin migrar. La migración deja de ser urgente; ver §0. 🔴 Pendiente confirmar en su panel: ocupación REAL del bucket y si el plan gratis permite archivos privados. |

---

*Índice: [`README.md`](README.md) · El análisis: [`01-ANALISIS`](01-ANALISIS-uploadthing-vs-alternativas.md).*
