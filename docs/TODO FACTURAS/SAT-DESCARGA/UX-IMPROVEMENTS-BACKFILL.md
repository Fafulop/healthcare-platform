# SAT Descarga Masiva — Mejoras UX Backfill

**Fecha:** 2026-06-06
**Estado:** Implementado

---

## Contexto

Despues de resolver el error 5002 (ver `ERROR-5002-LIFETIME-LIMIT.md`), se hizo una auditoria completa del flujo de descarga historica (backfill) y se identificaron varios problemas de UX que dejaban al doctor atascado sin forma de continuar.

## Problemas Identificados

### 1. Jobs fallidos sin forma de reintentar (CRITICO)

**Antes:** Si un job fallaba (por error del SAT, timeout, etc.), el doctor no tenia forma de reintentarlo. Solo un administrador podia resetear jobs via el endpoint de diagnostico `?reset=jobId`. El doctor veia la barra de progreso incompleta pero sin opcion para avanzar.

**Despues:** Se agrego boton "Reintentar fallidos" (rojo) que aparece cuando hay jobs fallidos. Llama al endpoint de backfill que ahora resetea jobs fallidos en lugar de crear duplicados.

### 2. Barra de progreso ignoraba jobs fallidos (CRITICO)

**Antes:** La barra solo contaba meses "completados" (4 de 4 jobs exitosos). Si 3 jobs de un mes completaban y 1 fallaba, ese mes se mostraba como pendiente sin indicar el error. El doctor veia "15 de 18 meses completados" sin saber que 3 meses tenian errores.

**Despues:** El endpoint GET de backfill ahora retorna `failedMonths` y `failedJobs`. La barra muestra un segmento rojo para meses fallidos, y el texto indica cuantos jobs fallaron.

### 3. Backfill creaba jobs duplicados al reintentar (BUG)

**Antes:** El endpoint POST de backfill solo verificaba jobs `completed` y activos (`pending/authenticating/requesting/polling/downloading`). Si un job estaba en `failed`, lo ignoraba y creaba uno NUEVO para el mismo mes y tipo. Esto acumulaba jobs duplicados en la base de datos.

**Despues:** El endpoint ahora busca jobs `failed` y los resetea (status=pending, attempts=0, etc.) en lugar de crear nuevos. Esto evita duplicacion y reutiliza el registro existente.

### 4. Sin verificacion de vigencia de e.Firma (BUG)

**Antes:** Los endpoints de sync y backfill solo verificaban `fielUploaded=true` pero NO revisaban `fielValidUntil`. Un doctor con e.Firma expirada podia crear jobs que fallaban despues de 10 intentos con un error poco claro.

**Despues:** Todos los puntos de creacion de jobs verifican la fecha de expiracion:
- `POST /api/sat-descarga/sync` — retorna error claro
- `POST /api/sat-descarga/backfill` — retorna error claro
- `POST /api/cron/sat-auto-sync` — excluye doctores con FIEL expirada del query

### 5. Sin auto-refresh despues de sincronizacion (UX)

**Antes:** Despues de que un job completaba, la lista de CFDIs y la barra de progreso no se actualizaban. El doctor tenia que refrescar la pagina manualmente (F5) para ver los datos nuevos.

**Despues:** La seccion de backfill hace polling cada 15 segundos mientras hay jobs activos. Al completarse o fallar los jobs, la barra de progreso se actualiza automaticamente.

## Cambios en Codigo

### API — `apps/api/src/app/api/sat-descarga/backfill/route.ts`

**POST (crear backfill):**
- Agregada verificacion de `fielValidUntil` antes de crear jobs
- Agregada busqueda de jobs `failed` — se resetean en lugar de crear duplicados
- El reset actualiza: status=pending, requestId=null, packageIds=[], attempts=0, lastError=null, dateTo (recalculado)

**GET (progreso):**
- Nuevo conteo de `failedMonths` y `failedJobs`
- Queries optimizados con `Promise.all` para conteos paralelos
- Respuesta incluye `failedMonths` y `failedJobs` (backward compatible, campos opcionales)

### API — `apps/api/src/app/api/sat-descarga/sync/route.ts`

- Agregada verificacion de `fielValidUntil` despues de validar `fielUploaded`
- Mensaje de error claro: "Tu e.Firma ha expirado. Sube una nueva para continuar."

### API — `apps/api/src/app/api/cron/sat-auto-sync/route.ts`

- Filtro de Prisma actualizado para excluir doctores con FIEL expirada:
```typescript
OR: [
  { fielValidUntil: null },        // Nunca se establecio (legacy)
  { fielValidUntil: { gt: new Date() } },  // Aun vigente
]
```

### UI — `apps/doctor/src/app/dashboard/sat-descarga/page.tsx`

**BackfillSection:**
- Tipo de estado actualizado con campos opcionales `failedMonths?` y `failedJobs?`
- Auto-refresh con `setInterval(fetchProgress, 15000)` mientras `activeJobs > 0`
- Cleanup correcto del interval en useEffect return
- Tres estados de boton:
  - **Rojo "Reintentar fallidos"** — cuando hay jobs fallidos (prioridad)
  - **Morado "Descargar historico"** — cuando hay meses pendientes sin errores
  - **Amber "Re-sincronizar XMLs"** — cuando todo esta completo (force mode)
- Barra de progreso con dos segmentos:
  - **Morado** — meses completados
  - **Rojo** — meses fallidos (capped para no exceder 100%)

## Flujos del Doctor

### Flujo 1: Primera vez (nuevo doctor)
1. Doctor sube e.Firma en configuracion fiscal
2. Visita `/dashboard/sat-descarga`
3. Ve "0 de 18 meses completados" con boton "Descargar historico"
4. Click → crea 72 jobs (18 meses x 2 direcciones x 2 tipos)
5. Barra de progreso se actualiza cada 15 segundos
6. Al completar → "Todos los meses sincronizados"

### Flujo 2: Algunos jobs fallan
1. Barra muestra "12 de 18 meses completados · 4 jobs fallidos"
2. Segmento rojo en la barra indica meses con errores
3. Boton rojo "Reintentar fallidos" aparece
4. Click → resetea los 4 jobs fallidos a pending
5. Worker los procesa en siguiente ciclo de cron
6. Auto-refresh muestra progreso actualizado

### Flujo 3: Re-sincronizar (todo completo)
1. "Todos los meses sincronizados" con boton amber "Re-sincronizar XMLs"
2. Click → resetea XMLs completados para re-descarga
3. Util para actualizar complementos de pago

### Flujo 4: e.Firma expirada
1. Doctor intenta sync o backfill
2. Error claro: "Tu e.Firma ha expirado. Sube una nueva para continuar."
3. Auto-sync cron NO crea jobs para este doctor (evita spam de errores)

### Flujo 5: Descarga manual mensual
1. Doctor selecciona mes con date picker
2. Click "Descarga Manual Mensual"
3. Crea 4 jobs (2 direcciones x metadata+xml) para ese mes
4. Si ya existen jobs activos, retorna 409 sin duplicar

### Flujo 6: Cron diario automatico
1. Corre a las 6 AM UTC (medianoche MX)
2. Solo para doctores con `autoSyncEnabled=true` y FIEL vigente
3. Crea 4 jobs para el mes actual si no hay jobs recientes (20h)
4. Ignora jobs atascados de mas de 6 horas

## Problemas Conocidos (No Resueltos)

1. **`autoSyncEnabled` no expuesto en UI** — No hay toggle para que el doctor active/desactive el auto-sync
2. **Sin estimado de tiempo** — No se muestra tiempo estimado de procesamiento durante backfill
3. **Intentos sobre-contados** — `attempts` se incrementa en cada transicion de estado, no solo por reintento real. Un job exitoso usa 2-3 de 10 intentos
