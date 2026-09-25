# VISITAS — SESSION-REFRESCO (handoff para la próxima sesión)

> **Actualizado: 2026-09-25 (fin del día).** Léelo PRIMERO. Dice dónde estamos, qué ya está en prod,
> qué sigue y qué trampas ya se pisaron. El diseño vive en `01-DISENO`, el plan paso a paso en
> `02-PLAN-fase-1.md` (§4 backfill, §5.1 D1, §5.2 D2, §5.3 D3). Este doc NO repite eso: lo señala.

## 1. Dónde estamos, en una línea

**Fase 1 (Visita): el BACKEND está completo y en prod (A, C, D1, D1b, D2, D3). Los doctores no ven
nada todavía — falta toda la UI (D4 + D5 + D6) y los pasos de lanzamiento.** El usuario verificó a
mano al cierre (2026-09-25) que Mis Citas, Pendientes, «Citas e Ingresos» del expediente y editar
una consulta funcionan.

## 2. Qué está en prod (commits, en orden)

| Commit | Qué | Servicio |
|---|---|---|
| `90c1363a` | **A** — tabla `visitas` + `visita_id` en los 5 hijos (SQL manual, FKs compuestas) | (BD; `packages/**`) |
| `e14e27b4` | **C** — `scripts/visitas/backfill-visitas.cjs` (SÓLO ensayado: 293 / 150 / 12 / 29) | — |
| `059ec27c` | **D1 + D1b** — `syncVisitaForBooking` (`packages/database/src/visitas.ts`): visita automática al concluir la cita y al ligar el expediente | api |
| `6235902d` | **D2** — API `…/patients/[id]/visitas` y `…/visitas/[visitaId]` (`apps/doctor/src/lib/visitas.ts`) | doctor |
| `02b07a4a` | Fuga de permisos en «Citas e Ingresos» (`lib/booking-permisos.ts`) | doctor |
| `f4f213d4` + `ec700274` | 🔴 **SEGURIDAD** — `GET /appointments/slots` y `/bookings/[id]` eran PÚBLICOS (datos del paciente + código que cancela la cita); telegram sin dueño. Cerrado | doctor, api |
| `7f091166` | Rotación de los 201 `confirmationCode` activos | — |
| `e637fe84` | **D3** — cada consulta/foto/receta/nota/informe guarda su visita (`resolverVisitaDeHijo`, `moverConsultaDeVisita`) | doctor |

**En prod hay 0 visitas reales** al cierre del 2026-09-25 (ninguna cita concluida desde D1). La primera
aparecerá sola cuando un doctor concluya una cita con expediente ligado.

## 3. Qué sigue (en este orden)

1. **D4 — UI «Nueva Visita»** (página del paciente + pantalla de la visita): reemplaza «Nueva Consulta»;
   varias plantillas (incluida la «plantilla SOAP»), fotos, nota, receta, ligar cita, estado de pago
   leído de la cita. Usa la API de D2 y manda `visitaId` a las rutas de D3.
2. **D5 — UI libros mayores:** etiqueta «Visita del 12 sep», filtro por visita, «Sin visita», y el
   «¿A qué visita pertenece?» en Docs y Galería, Recetas, Notas, Historial.
3. **D6 — Manual de Ayuda + guías** (`manual-del-doctor.md`, `ExpedientesGuide.tsx`) **en el MISMO
   commit** que la UI que describe.
4. ⚠️ **Exportar cuenta** (`apps/api/src/lib/exportar-cuenta.ts`) debe incluir visitas (LFPDPPP,
   DISEÑO §9). **No está en ningún paso D** — hacerlo junto con D4/D5.
5. **Lanzamiento**, justo antes de mostrarlo, en este orden:
   - code review del script de backfill (replica la regla de D3);
   - **escribir y correr el barrido de reparación** (aún NO existe): citas COMPLETED con paciente y
     sin visita · visitas cuyo paciente ≠ el de su cita · hijos cuya visita ≠ la de su consulta —
     todo con `syncVisitaForBooking` / la regla de `resolverVisitaDeHijo`;
   - correr el backfill **UNA sola vez** y leer de vuelta.
6. **Prueba a mano** (02-PLAN §6) en dr-prueba.

Después de la fase 1: fase 2 (Tratamiento) y fase 3 (Progreso) — DISEÑO §8, nada construido.

## 4. Decisiones del usuario (no re-litigar)

- **Visitas NO tiene toggle propio**: hereda `expedientes`. Hora/servicio de la cita → `citas`; cobro
  → `flujo`; ligar una cita exige `citas`.
- **Ver DATOS no depende del plan**: `puedeVer` = dueño/admin todo, member = su toggle. El plan recorta
  FUNCIONES por ruta, no la lectura (con el techo, un dueño FREE dejaba de ver sus facturas).
- **Códigos de confirmación regenerados** (opción 1): los de correos viejos ya no cancelan en línea.
- **Las fugas de permisos que sólo afectan a AYUDANTES quedan aparcadas** ("estamos perdiendo mucho
  tiempo"): lista en `NUEVOS USUARIOS/05-COBERTURA-19-toggles.md` §"Fugas por CAMPO" (Mis Citas y el
  agente muestran montos con sólo `citas`; timeline muestra la hora de la cita; y una DECISIÓN pendiente:
  ¿los datos fiscales del paciente son de expediente o de facturación?). También pendiente: que
  Pendientes pinte los avisos `citasOcultas` / `citasIncompletas` que el servidor ya manda.

## 5. Trampas que ya se pisaron (no repetir)

- **`prisma db push` REVIERTE las FKs compuestas** de visitas y bookings. Migraciones = SQL manual.
- **El `_count` de Prisma sobre una relación arma `GROUP BY` sobre la tabla hija COMPLETA.** Usar
  `count()` / `groupBy` filtrado por paciente y visita.
- **El backfill corre UNA vez, ANTES de la UI, nunca después:** desde D3 «Sin visita» puede ser una
  decisión del doctor y re-correrlo la desharía sin auditoría.
- **`apps/api` NO tiene middleware de auth**: cada ruta se autentica sola; un GET que lo olvida es
  PÚBLICO. Toda ruta nueva de apps/api: `validateAuthToken` Y comparar dueño del recurso.
- **Un re-enganche "por paciente y día"** en D1 se probó y se QUITÓ: agarraba visitas de citas
  borradas o de otra cita del mismo día. Desligar el paciente deja la visita intacta.
- **Lo que no se puede ver correr** (reglas dentro de rutas que exigen sesión) se revisa en code
  review y se prueba a mano con la UI: en D4 probar mover SÓLO la visita de una consulta (no debe
  borrar `followUpDate`) y que mover una consulta arrastre sus fotos/recetas/informes.
- Smoke tests contra prod: patrón en el scratchpad de la sesión (transacción que SIEMPRE revienta);
  `railway run --service pgvector …` con `DATABASE_PUBLIC_URL`; imports dinámicos en Windows con
  `file:///C:/…`. El clasificador a veces bloquea scripts que escriben en prod: el usuario los corre
  en SU PowerShell (sin `!`).

## 6. Proceso que el usuario espera

Plan antes de código → OK → código → type-check + `pnpm gates` + smoke contra prod → code review (y
review de los arreglos del review) → OK explícito para commit/push → verificar `commitHash` por
servicio en Railway. Hablarle en inglés; docs de esta carpeta en español.
