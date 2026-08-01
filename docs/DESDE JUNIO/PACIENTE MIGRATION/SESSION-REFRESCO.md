# 🔄 SESSION-REFRESCO — migración de pacientes

> **Léeme primero.** Estado vivo al cerrar la sesión del **2026-08-01**. El plan y las
> decisiones están en [`README.md`](README.md); el inventario de columnas en
> [`01-CONTRATO-de-importacion.md`](01-CONTRATO-de-importacion.md).

## Dónde estamos en una frase

**La importación de pacientes está EN PRODUCCIÓN y funcionando**: un doctor descarga una
plantilla `.xlsx`, la llena, la sube, ve qué va a entrar y qué renglones fallan, y confirma.
Probada de punta a punta contra `dr-prueba`.

## Qué se hizo (5 commits + merge, todo en `main` y desplegado)

| Commit | Qué |
|---|---|
| `66485db8` | **F1** plantilla `.xlsx` + contrato de columnas |
| `4ae71b91` | **F2** validador puro |
| `d039dbe1` | **F3** escritura transaccional + auditoría + UI de admin |
| `b7cf7df7` | fix: `__patientRef` tumbaba la transacción (lo halló el smoke test) |
| `d6390607` | **F4** UI de autoservicio del doctor |
| `ca151db6` | fix: los 3 hallazgos del code review |
| `b58c554a` | merge a `main` |

Desplegado y verificado por `commitHash` en `@healthcare/api`, `@healthcare/doctor` y
`@healthcare/admin` (los tres en `b58c554a`).

## ✅ Lo que está PROBADO de verdad

Importación real en prod desde el app del doctor: 9 pacientes + 7 consultas con 4 renglones
rotos a propósito → **6 / 6 / 4 / 0**, y leyendo la BD después quedó verificado que las fechas
históricas se conservan (2022→2024), que `firstVisitDate`/`lastVisitDate` se calculan solas,
que el folio se genera cuando falta, y que la auditoría escribe 12 renglones con un solo
`batchId`. Detalle completo en el README.

## ⬜ LO SIGUIENTE, en orden

### 1. Probar la UI de ADMIN (lo único del flujo sin ejercitar)

`apps/admin/src/app/patient-import/page.tsx`. Comparte el núcleo, pero tiene **su propio
`authFetch`** —al que se le aplicó el mismo arreglo de `FormData`, sin verificar en vivo— y dos
caminos que el app del doctor no tiene:

- El **selector de doctor**: `resolveTargetDoctorId` exige que el admin diga a quién le escribe.
- El audit log debe quedar con **`userRole: 'admin'`** y el id del admin real, **nunca**
  suplantando al doctor. En la prueba del doctor salió `doctor`, que es lo correcto para ese
  camino; falta ver el otro.

Hay un archivo de prueba listo en `C:\Users\52331\Downloads\PRUEBA-pacientes-falsos.xlsx`
(9 pacientes, 7 consultas, 4 errores a propósito). Al subirlo debe dar **6 / 6 / 4 / 0** — pero
**ojo: esos folios ya existen en `dr-prueba`**, así que si se reimporta ahí saldrán como
`YA_EXISTE`. Para probar admin conviene otro doctor de prueba, o editar los folios.

### 2. Exportar pacientes a Excel (pedido del usuario)

La otra mitad: bajar el expediente a `.xlsx`. Notas de arranque:

- **Reusar `PATIENT_COLUMNS` / `ENCOUNTER_COLUMNS`** de `packages/database/src/patient-import.ts`.
  Si exportas con las MISMAS columnas, lo exportado se vuelve a importar sin tocar nada — y eso
  es lo que hace útil un export (respaldo, mudanza, corregir en masa y volver a subir).
- Vive en `apps/api`, que ya tiene `exceljs`. Mismo patrón que
  `sat-descarga/export/accountant-report`.
- **Es una lectura masiva de PHI**: tiene que escribir `PatientAuditLog` igual que la
  importación, y ser `OWNER_ONLY`. El prefijo `patient-import` ya está mapeado; si la ruta se
  llama distinto, **hay que mapearla o `gate:routes` truena** (ya pasó una vez).

### 3. Decidir el diseño del folio (`internalId`)

Ver la sección dedicada del README. **Resumen: la colisión entre doctores NO existe** —el
unique es compuesto `(doctorId, internalId)`—. Lo único expuesto es el alta manual con un folio
repetido, que hoy devuelve un 409 en inglés. Recomendación: arreglar el mensaje (opción A) y no
tocar más hasta que haya una razón.

### 4. Escribir el FAQ de migración en la home pública

Es la razón por la que empezó todo esto: pendiente #3 en
[`../NEW STYLE/README.md`](../NEW%20STYLE/README.md). El FAQ **no contesta** *«¿puedo traerme
mis pacientes?»* porque hasta hoy no había respuesta honesta. Ahora sí la hay, y es buena:
*descargas una plantilla, la subes, y revisas antes de que se guarde nada*. Va en
`apps/public/src/lib/product-content.ts`, alrededor de la posición 3 del arreglo `FAQ`.

## 🧹 Basura que dejamos

- **6 pacientes y 6 consultas de prueba en `dr-prueba`**, lote
  `718315b8-5fb6-4445-bf5e-ecd4c27fbd15`. Borrables con precisión por ese `batchId`.
- El botón **Importar** ya es visible para **todas** las cuentas titulares en prod, no solo
  para `dr-prueba`.

## ⚠️ Lecciones de esta sesión que NO hay que volver a aprender

1. **Un mock comprueba la forma de la escritura, no que el motor la acepte.** El smoke test
   contra prod encontró que `__patientRef` se colaba al `createMany` y **tumbaba la transacción
   entera**. El mock lo aceptaba feliz.
2. **type-check + gates + smoke test de BD ≠ «probado».** El code review encontró que
   `authFetch` fijaba `Content-Type: application/json` antes de los headers del llamador, así
   que **cualquier** subida con `FormData` moría — la función estaba rota al 100 % en los dos
   apps. Faltaba el clic.
3. **La trampa de `authFetch` era de todo el repo.** No había explotado porque las demás
   subidas del app del doctor van con `fetch` pelón contra rutas del mismo origen. Por eso el
   arreglo fue en `authFetch` y no en la pantalla.
4. **Un endpoint autenticado no se enlaza con `<a href>`.** La navegación del navegador no
   manda `Authorization` ni cookies cross-origin: había que pedirlo autenticado y disparar la
   descarga desde el blob.
5. **El método canónico para tocar prod no se improvisa**: `railway run --service pgvector`
   (el `DATABASE_URL` del servicio de app es interno y no se alcanza desde afuera). Y para
   probar una escritura sin ensuciar: **transacción revertida a propósito**.
