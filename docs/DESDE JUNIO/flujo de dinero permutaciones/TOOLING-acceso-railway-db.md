# Cómo conectarse a la base de datos de producción (Railway) — referencia

> **Para qué.** Producción vive **solo en Railway** (no hay datos locales). Este doc explica cómo se
> consultó la BD de prod en **solo lectura** desde la máquina local, para verificar datos reales
> (p.ej. el case de los UUID en `cfdis_emitted` vs `sat_cfdi_metadata`).
>
> ⚠️ **Solo lectura.** Usar únicamente `SELECT`. No correr `UPDATE/DELETE/DDL` por aquí sin una razón
> y respaldo. Nunca imprimir el password de la conexión en logs/salida.

---

## El truco clave: URL interna vs. URL pública

Railway da **dos** URLs a la base de datos:

| Variable | Dónde vive | Host | ¿Reachable desde afuera? |
|---|---|---|---|
| `DATABASE_URL` | en el **servicio de app** (`@healthcare/api`) | `pgvector.railway.internal:5432` | ❌ **No** — solo dentro de la red de Railway |
| `DATABASE_PUBLIC_URL` | en el **servicio de Postgres** (`pgvector`) | `*.proxy.rlwy.net:<puerto>` (TCP proxy público) | ✅ **Sí** |

> Por eso `railway run node script` (que corre con el env del servicio *api*) falla con
> `Can't reach database server at pgvector.railway.internal`. Hay que correr el script con el env del
> **servicio de Postgres** para obtener `DATABASE_PUBLIC_URL`.

---

## Requisitos (una vez)

1. **Railway CLI** instalado y con sesión:
   ```bash
   railway whoami      # debe mostrar tu usuario
   railway status      # debe mostrar Project / Environment / Service linkeados
   ```
   (Si no está linkeado: `railway link` y elegir el proyecto/entorno — es interactivo.)

2. **Cliente Prisma generado** (para poder hacer queries con tipos del schema):
   ```bash
   cd packages/database && ./node_modules/.bin/prisma generate
   ```
   Genera el cliente en `node_modules` (artefacto, no se commitea).

> Alternativa sin Node: hay un **PostgreSQL 15 local** instalado
> (`C:\Program Files\PostgreSQL\15\bin\psql.exe`, no está en el PATH). Se puede usar ese `psql` con la
> `DATABASE_PUBLIC_URL` directamente. El método de abajo usa Node + Prisma porque no requiere PATH.

---

## El método (read-only, vía proxy público)

1. Escribir un script que **prefiera la URL pública** y haga solo `SELECT`:

   ```js
   // scratchpad/query.cjs
   const url = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;
   const { PrismaClient } = require('C:/Users/52331/docs-front/packages/database/node_modules/@prisma/client');
   const prisma = new PrismaClient({ datasources: { db: { url } } });
   (async () => {
     try {
       const rows = await prisma.$queryRawUnsafe(
         `SELECT count(*)::int n FROM practice_management.cfdis_emitted`
       );
       console.log(rows);
     } catch (e) { console.log('ERROR:', e.message); }
     finally { await prisma.$disconnect(); }
   })();
   ```

2. Correrlo con el env del **servicio de Postgres** (`pgvector`), que sí trae `DATABASE_PUBLIC_URL`:

   ```bash
   railway run --service pgvector node /ruta/al/scratchpad/query.cjs
   ```

`railway run --service pgvector` inyecta las variables de ese servicio (incluida la pública) **sin**
imprimirlas; el script las lee de `process.env`.

---

## Notas / gotchas

- **El `DATABASE_URL` del repo (`.env`) apunta a `localhost:5432/docs_mono`** — es una BD local/dev
  **vacía** (0 filas). No confundir con prod. Por eso siempre usar `railway run --service pgvector`.
- **`$queryRawUnsafe` con SQL fijo** (sin interpolar input externo) está bien para estas consultas de
  verificación; no pasar datos del usuario sin parametrizar.
- **Nombres de schema confirmados:** `public`, `practice_management`, `medical_records`,
  `llm_assistant`, `analytics`. Calificar siempre las tablas (`practice_management.cfdis_emitted`).
- El **host/puerto público puede rotar** si se recrea el proxy; no hardcodear — siempre leer
  `DATABASE_PUBLIC_URL` del env del servicio.
- **Seguridad:** este canal llega a **producción**. Mantenerlo en `SELECT`. Para cualquier escritura,
  preferir la consola SQL de Railway con respaldo y revisión.

---

## Descubrir variables de un servicio (sin exponer secretos)

Para ver qué endpoint usa un servicio sin volcar el password:

```js
// imprime solo host:port, nunca el password
const u = new URL(process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL);
console.log(u.hostname + ':' + u.port + u.pathname);
```
Correr con `railway run --service pgvector node ese-script.cjs`.

---

*Estado:* referencia creada junio 2026, verificada conectándose a prod (solo lectura) para confirmar
el case de los UUID (ver `02-registro-facturas-y-match-determinista.md` §4).
</content>
