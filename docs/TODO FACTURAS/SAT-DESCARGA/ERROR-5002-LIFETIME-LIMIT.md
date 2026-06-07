# SAT Error 5002 — Limite de Solicitudes de Por Vida

**Fecha de descubrimiento:** 2026-06-06
**Estado:** Resuelto

---

## Problema

Todos los jobs de descarga XML (TipoSolicitud="CFDI") del backfill historico fallaban con:

```
EstadoSolicitud=5 (Rechazada)
CodEstatus=5000
CodigoEstadoSolicitud=5002
Mensaje="Solicitud Aceptada"
NumeroCFDIs=0
```

- 69 jobs XML fallidos (todos los meses de 2025-01 a 2026-04)
- Los jobs de metadata para los mismos rangos funcionaban perfectamente
- El auto-sync diario (mes actual) tambien funcionaba para XML

## Causa Raiz

**Error 5002: "Se han agotado las solicitudes de por vida"**

El SAT tiene un **limite de 2 solicitudes de por vida** para requests con los mismos parametros exactos:
- FechaInicial
- FechaFinal
- RfcSolicitante
- TipoSolicitud (solo aplica para "CFDI", NO para "Metadata")

Cada vez que el backfill fallaba y se reintentaba, creaba una nueva solicitud con las **mismas fechas exactas** (ej: `2025-01-01T00:00:00` a `2025-01-31T23:59:59`). Despues de 2 intentos para el mismo rango, el SAT bloquea permanentemente esa combinacion exacta.

### Por que metadata no se afecta

El limite de 2 solicitudes **solo aplica a TipoSolicitud="CFDI"** (XML). Las solicitudes de tipo "Metadata" no tienen este limite.

### Por que el auto-sync diario funcionaba

El cron diario crea jobs con un `dateTo` diferente cada dia (ej: `2026-06-05`, `2026-06-06`), por lo que siempre es un rango "nuevo" para el SAT.

### Por que el backfill fallaba

El backfill usaba rangos fijos por mes (ej: `2025-01-01T00:00:00` a `2025-01-31T23:59:59`). Al fallar y reintentar, enviaba la misma solicitud exacta, quemando el limite de 2 intentos.

## Diagnostico

El campo clave que no estabamos capturando era `CodigoEstadoSolicitud` de la respuesta de verificacion del SAT. Este es diferente de `CodEstatus`:

| Campo | Valor | Significado |
|-------|-------|-------------|
| `CodEstatus` | 5000 | La llamada al API fue exitosa |
| `CodigoEstadoSolicitud` | 5002 | La solicitud fue rechazada por limite |
| `EstadoSolicitud` | 5 | Rechazada |
| `Mensaje` | "Solicitud Aceptada" | Se refiere al API call, no al resultado |

La confision era que `CodEstatus=5000` y `Mensaje="Solicitud Aceptada"` parecian indicar exito, pero el estado real estaba en `EstadoSolicitud=5` y `CodigoEstadoSolicitud=5002`.

## Solucion

**Cambiar `FechaInicial` de `00:00:00` a `00:00:01` para solicitudes XML.**

El SAT considera cualquier diferencia de al menos 1 segundo como un rango diferente. Al usar `00:00:01` en vez de `00:00:00`:

1. Se evita colision con las solicitudes de metadata (que usan `00:00:00`)
2. Se "resetea" el limite de 2 intentos ya que es un rango nuevo
3. No se pierde ningun CFDI porque ninguna factura tiene hora de emision a las 00:00:00

### Cambios en codigo

**1. Offset de FechaInicial** — `apps/api/src/lib/sat-descarga.ts` funcion `requestXml()`

```typescript
// ANTES (colisionaba con metadata y quemaba el limite)
const fechaInicial = formatSatDate(dateFrom, '00:00:00');

// DESPUES (rango diferente, evita error 5002)
const fechaInicial = formatSatDate(dateFrom, '00:00:01');
```

**2. Captura de CodigoEstadoSolicitud** — `apps/api/src/lib/sat-descarga.ts` funcion `verifyRequest()`

Se agrego parsing de `CodigoEstadoSolicitud` y `Mensaje` en la respuesta de verificacion, y logging del body completo para estados no exitosos.

**3. Fix del throttle de XML** — `apps/api/src/app/api/cron/sat-sync-worker/route.ts`

El conteo de XML activos incluia jobs `pending`, lo que bloqueaba el procesamiento despues de un reset masivo. Se corrigio para solo contar jobs en progreso (`authenticating`, `requesting`, `polling`, `downloading`).

```typescript
// ANTES (bloqueaba cuando habia muchos pending)
status: { in: ['pending', 'authenticating', 'requesting', 'polling', 'downloading'] }

// DESPUES (solo cuenta jobs activamente procesandose)
status: { in: ['authenticating', 'requesting', 'polling', 'downloading'] }
```

## Verificacion

Fix verificado en produccion el 2026-06-06. Despues de aplicar el offset de 1 segundo y resetear los 69 jobs fallidos:

```
Job 29 (emitted  Apr 2026): polling → downloading → completed: 12 XML CFDIs parsed
Job 30 (emitted  May 2026): polling → downloading → completed: 5 XML CFDIs parsed
Job 31 (received Apr 2026): polling → downloading → completed: 18 XML CFDIs parsed
```

SAT acepto las solicitudes sin error 5002. Los 66 jobs restantes se procesan via cron automatico.

## Codigos de Error SAT Relevantes

| Codigo | Significado | Aplica a |
|--------|-------------|----------|
| 5000 | Solicitud recibida correctamente | API call |
| 5002 | Limite de solicitudes de por vida excedido | CFDI only |
| 5004 | Informacion de solicitud no encontrada (expirada 72h) | Verificacion |
| 5005 | Ya existe solicitud activa duplicada | Solicitud |

## Lecciones Aprendidas

1. **Siempre capturar `CodigoEstadoSolicitud`** ademas de `CodEstatus` — son campos diferentes con significados diferentes
2. **Las solicitudes XML y Metadata deben usar rangos de fecha distintos** para evitar colisiones con el limite de 2 solicitudes
3. **No reintentar con los mismos parametros exactos** — cada reintento quema uno de los 2 intentos permitidos
4. **El limite de metadata es mucho mas permisivo** que el de CFDI — se puede probar libremente con metadata
5. **El throttle de XML no debe contar jobs `pending`** — solo jobs activamente procesandose, de lo contrario un reset masivo bloquea todo el procesamiento

## Referencias

- [SAT Documentacion Verificacion](https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175779527&ssbinary=true)
- [SAT Documentacion Solicitud](https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175195160&ssbinary=true)
- [AMITI — Uso adecuado del Web Service](https://amiti.org.mx/en/13627/uso-adecuado-del-web-service-de-descarga-masiva-de-cfdi-y-cfdi-de-retenciones/)
- [phpcfdi/sat-ws-descarga-masiva](https://github.com/phpcfdi/sat-ws-descarga-masiva)
