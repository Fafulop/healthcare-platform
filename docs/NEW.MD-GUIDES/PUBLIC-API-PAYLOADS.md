# Payloads de API públicos — la regla y por qué existe

> **Regla:** una ruta que se pueda llamar **sin token** NO puede consultar con `include` y sin
> `select`/`omit`. Prisma devuelve TODOS los escalares del modelo, así que cada columna nueva se
> suma sola a la respuesta anónima — para siempre, y en silencio.
>
> Aplica a `apps/api` y a cualquier ruta de `apps/doctor` alcanzable sin auth.
> Garantía de máquina para el modelo `Doctor`: **`pnpm gate:payload`**.

## Lo que pasó (2026-07-26)

`GET /api/doctors` y `GET /api/doctors/[slug]` son públicos **a propósito** — el sitio público arma
los perfiles y el sitemap con ellos. Ambos hacían `findMany`/`findUnique` con `include` de las
relaciones y **sin `select`**. Nadie decidió publicar nada de lo de abajo: fue el default.

Verificado con `curl` sin token contra producción:

| Qué salía | De quién |
|---|---|
| `mpAccessToken` + `mpRefreshToken` (credenciales OAuth de MercadoPago), `stripeAccountId` | dr-prueba (cuenta de pruebas) |
| `prescriptionSignatureUrl` — la **firma manuscrita**; vive en storage público, así que publicar la URL publica la firma | 4 doctores, **3 reales** |
| `googleCalendarId` (8), `telegramChatId` (7) | doctores reales |
| `tier` (plan comercial de la cuenta) | los 11 |

La firma es la peor: va junto a `cedulaProfesional`, y ese par es justo lo que el sistema timbra en
una receta — emitir recetas es owner-only precisamente porque es un acto legal
(`DESDE JUNIO/NUEVOS USUARIOS/00-REQUISITOS §3.5`).

**Cómo se encontró:** revisando por qué el campo `tier` (TIERS T5) aparecía en una respuesta
pública. El bug no era "tier se filtra", era "este endpoint publica todo"; `tier` solo fue el
pasajero más reciente.

## El fix

`apps/api/src/lib/doctor-public-fields.ts` define `DOCTOR_PRIVATE_FIELDS`, aplicado con **`omit`**
en las dos rutas (Prisma 6 lo soporta junto a `include`).

Qué se quita: credenciales, identificadores de cuenta/canal/chat, la firma y el `tier`.
Qué se **conserva** a propósito: preferencias de notificación, ajustes de PDF y los booleanos de
estado de conexión (no son credenciales y tienen consumidores vivos), y
`cedulaProfesional`/`prescriptionCredentials` (dato profesional que el perfil público ya muestra).

⚠️ **El fix corta la exposición futura, no la pasada.** Lo ya servido pudo cachearse o indexarse:
las URLs de firma siguen resolviendo hasta que se re-suban, y una credencial expuesta se **rota
DESPUÉS de desplegar el fix** — rotarla antes solo publica la nueva.

## El gate (`pnpm gate:payload`)

`scripts/check-public-doctor-payload.ts`, dentro de `pnpm gates`. Existe porque arreglar los casos
no cierra la **categoría**: el default de estos endpoints es "todo es público", así que la próxima
columna sensible se filtraría igual y ningún test fallaría. Asserta:

1. todo campo escalar de `Doctor` cuyo NOMBRE parezca sensible está omitido **o** listado en
   `ALLOWED_PUBLIC` **con su razón escrita**;
2. las dos rutas siguen aplicando `omit: DOCTOR_PRIVATE_FIELDS` (borrar el omit se caza, no solo
   olvidar extender la lista);
3. no hay entradas muertas (un rename dejaría una protección que ya no protege nada);
4. **al revés:** no se omitió de más nada que el sitio público necesita — sobre-omitir rompe los
   perfiles en silencio.

Probado en NEGATIVO en los dos sentidos: inyectar una columna falsa `stripeSecretKey` lo hace
fallar; quitar un `omit:` lo hace fallar.

## Al agregar una ruta pública nueva

1. ¿De verdad debe ser pública? Si no, va por un choke point de auth
   (`validateAuthToken` / `requireDoctorAuth` / `requireAdminAuth`).
2. Si sí: **`select` explícito**, o `omit` de lo privado si la lista de campos públicos es larga.
3. Si expone un modelo con columnas sensibles y no es `Doctor`, considera extender el gate — hoy
   solo cubre `Doctor`, que es donde vivía el problema.
4. Revisa los consumidores ANTES de recortar. El sitio público mapea por
   `transformDoctorToProfile` (`apps/public/src/lib/data.ts`): si un campo no está ahí, no lo usa.

## Estado del modelo hoy

Al 2026-07-26 no queda otra fuga de esta familia: hay 14 rutas genuinamente sin auth, **cero**
`doctor: true` en toda la API, y cada sub-ruta pública (`services`, `locations`, `availability`,
`articles`, `booking-field-settings`, `reviews`, `appointment-form`) ya usa `select` explícito
sobre la relación `doctor`.
