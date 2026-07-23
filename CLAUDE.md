# CLAUDE.md — instrucciones del repo

Plataforma healthcare (México): monorepo pnpm + Turbo con `apps/doctor`, `apps/api`,
`apps/admin`, `apps/public` y `packages/*`.

## ⚠️ Lo que hay que saber ANTES de tocar nada

- **No hay staging. `main` despliega directo a PRODUCCIÓN** (Railway).
- **Nunca hagas commit/push sin explicar primero qué encontraste/cambiaste y recibir un OK
  explícito.** Una aprobación cubre ESE commit, no los siguientes.
- **Todo SQL crudo o query shape nuevo de Prisma se smoke-testea read-only contra prod ANTES
  del push.** Un `$queryRaw` sobre una función que devuelve `void` tumbó la creación de citas
  en prod una vez. Método canónico (no improvisar):
  `docs/DESDE JUNIO/flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`.
- **`prisma db push` REVIERTE** el composite FK de `bookings` y los índices parciales de
  `doctor_members` que viven en prod. Migraciones = SQL manual + `prisma db execute`
  (`docs/NEW.MD-GUIDES/database-architecture.md` §6).
- **Cambio de dependencia = regenerar `pnpm-lock.yaml` en el MISMO commit** (Railway instala
  con frozen lockfile; si no, el build falla y el push silenciosamente no ship­ea).
- **Un push a `main` no garantiza que TODOS los servicios se desplieguen.** Si algo debería
  estar vivo y no lo está, verifica el `commitHash` por servicio antes de debuggear la lógica.

## Gates antes de un push que toque el agente o sus docs

```bash
pnpm gates        # rutas↔permisos · identidad del prompt · números de los docs vs código
pnpm type-check
```

(`apps/api` necesita `NODE_OPTIONS=--max-old-space-size=6144` para su type-check.)

## El asistente de IA y su documentación

Todo lo relacionado con **el asistente del doctor** (el agente conversacional con módulos de
dominio: agenda · facturas · fiscal · flujo · expediente) está documentado en
`docs/DESDE JUNIO/AGENTES/`.

> 📌 **Si vas a leer, escribir o tocar cualquier cosa de esa carpeta — o del código del agente
> en `apps/doctor/src/lib/agenda-agent/` — lee PRIMERO:**
> **`docs/DESDE JUNIO/AGENTES/GENERAL AGENTES/08-EMPIEZA-AQUI.md`**
>
> Explica en 5 minutos la estructura, los 3 tipos de doc (cuáles se actualizan y cuáles están
> congelados), **dónde escribir al terminar**, y qué se verifica solo. Sin eso, lo más probable
> es que actualices el doc equivocado o dupliques información que ya vive en otro lado.

Reglas duras del agente que no se re-litigan: lecturas autónomas · escrituras siempre
propuesta → card → confirmación del doctor → ejecuta el CLIENTE · los veredictos de negocio se
resuelven server-side (regla 0). El prompt se edita en `prompt.ts` o `modules/<dominio>.ts`,
**nunca** en `run-turn.ts`.

## Idioma

Los docs de `docs/DESDE JUNIO/` están en español y se mantienen en español. El código, los
comentarios de código y los mensajes de commit siguen la convención del archivo que tocas.
