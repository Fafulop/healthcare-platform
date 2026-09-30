# VISITAS — SESSION-REFRESCO (handoff para la próxima sesión)

> **Actualizado: 2026-09-29 (D4 y D5 probados a mano ✅; D5b construido; backfill DESCARTADO).** Léelo PRIMERO. Dice dónde estamos, qué
> ya está en prod, qué sigue y qué trampas ya se pisaron. El diseño vive en `01-DISENO`, el plan paso a
> paso en `02-PLAN-fase-1.md` (§4 backfill, §5.1 D1, §5.2 D2, §5.3 D3, §5.4 D4). Este doc NO repite eso:
> lo señala.

## 1. Dónde estamos, en una línea

**Fase 1 (Visita): backend completo (A, C, D1, D1b, D2, D3) y la UI de D4 en prod DETRÁS DE UNA LISTA
(sólo dr-prueba la ve, `lib/visitas-ui.ts`). Los demás doctores no ven nada. D4 PROBADO A MANO por el
usuario (2026-09-29, "everything looks good"). D5 (`dd95ffd9`, elegir la visita al crear fuera de
ella) probado ("works"). D5b (mover lo que ya existe) construido; falta su prueba a mano, exportar
cuenta, barrido y el lanzamiento.** El backfill ya NO va.


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
| (commit de D4, 2026-09-26 — ver `git log -- apps/doctor/src/lib/visitas-ui.ts`) | **D4** — «Nueva Visita» + tarjeta «Visitas» + pantalla de la visita + `?visitaId=` en plantillas/fotos/recetas/notas, **sólo dr-prueba**; y `lastVisitDate` = la consulta más reciente (para TODOS). Detalle en 02-PLAN §5.4 | doctor |

| `65c35499` | Tarjetas del perfil: 3 más nuevas + «Ver N más» (`ListaColapsable`), Historial → 3 + «Ver todas» (la ruta del paciente trae `take: 5`), orden de Citas e Ingresos arreglado, notas de la cita en la visita — **para TODOS** | doctor |
| `dd95ffd9` | **D5** — «¿A qué visita pertenece?» al crear foto/receta/nota FUERA de una visita (sugiere la de los últimos 7 días), **sólo dr-prueba**. Detalle en 02-PLAN §5.5 | doctor |

**En prod hay 0 visitas reales** al cierre del 2026-09-25 (ninguna cita concluida desde D1). La primera
aparecerá sola cuando un doctor concluya una cita con expediente ligado.

## 3. Qué sigue (en este orden)

1. **Prueba a mano de D5b en dr-prueba** (02-PLAN §5.5): mover una foto (visor → Editar), una nota
   (selector «Visita:» del editor, pide confirmación) y una receta BORRADOR sin plantilla (su
   «Editar»); el detalle de la receta dice su visita.
2. Pendientes chicos de D4: el selector de
   plantillas aún no dice «Plantilla SOAP»; la pantalla de la visita recarga listas completas (costo).
3. **D6 — Manual de Ayuda + guías** (`manual-del-doctor.md`, `ExpedientesGuide.tsx`) **en el MISMO
   commit** que la UI que describe.
4. ⚠️ **Exportar cuenta** (`apps/api/src/lib/exportar-cuenta.ts`) debe incluir visitas (LFPDPPP,
   DISEÑO §9). **No está en ningún paso D** — antes del lanzamiento.
5. **Lanzamiento**, justo antes de mostrarlo, en este orden:
   - **escribir y correr el barrido de reparación** (aún NO existe): citas COMPLETED con paciente y
     sin visita · visitas cuyo paciente ≠ el de su cita · hijos cuya visita ≠ la de su consulta —
     todo con `syncVisitaForBooking` / la regla de `resolverVisitaDeHijo`;
   - ~~backfill~~ **DESCARTADO (2026-09-29, ver §4)**: lo viejo se queda «Sin visita»;
   - **commit de lanzamiento:** BORRA la lista de `lib/visitas-ui.ts` y, en el MISMO commit, cambia
     todo lo que aún dice «Nueva Consulta» / «Historial de Consultas»: `manual-del-doctor.md` (§366–396,
     §480), `ExpedientesGuide.tsx` (5 lugares), el botón de `timeline/page.tsx` y
     `lib/llm-assistant/capabilities.ts:192` (le dice al asistente `Botón "Nueva Consulta"`). El
     manual también tiene que describir el «¿A qué visita pertenece?» de D5 y el mover de D5b.
6. (D5b se prueba en el punto 1.)

Después de la fase 1: fase 2 (Tratamiento) y fase 3 (Progreso) — DISEÑO §8, nada construido.

## 4. Decisiones del usuario (no re-litigar)

- **Backfill DESCARTADO (2026-09-29):** "no me importan los que ya se crearon" — pocos doctores. Lo
  creado antes de las visitas se queda «Sin visita» (las plantillas viejas aparecen en «Consultas sin
  visita» y se pueden traer a una visita del MISMO día). Con eso cae la razón de la lista de dr-prueba
  (el backfill tenía que correr antes que los doctores); la lista se queda sólo hasta que D5b, exportar
  y el manual estén listos. `scripts/visitas/backfill-visitas.cjs` queda en el repo, sin correr.
- **D5 recortado + D5b (2026-09-29):** SIN etiquetas ni filtros en los libros mayores (redundantes con
  la pantalla de la visita). Sí: elegir la visita al CREAR fuera de ella (D5) y MOVER lo ya creado
  (D5b). Fotos/notas/recetas son agnósticas de fecha (el laboratorio del 15 entra en la visita del
  12); sólo las plantillas llevan la regla del mismo día.
- **Sugerencia = la visita más reciente de los ÚLTIMOS 7 DÍAS**, si no «Ninguna» (2026-09-29): meter
  en silencio algo en una visita de hace meses es peor que dejarlo suelto.
- **Una receta EMITIDA no cambia de visita** (2026-09-29): la ruta sólo edita borradores; no se toca.

- **D4 va detrás de una lista (sólo dr-prueba) hasta el lanzamiento** (2026-09-26). *(La razón
  original —el backfill antes que los doctores— cayó con el backfill, ver arriba.)* Crear la visita pasa por un MODAL (no al
  clic), y los «+» reusan las páginas que ya existen con `?visitaId=`.
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
- **D4 — «la fecha de una plantilla ES la de su visita» se cuida SÓLO en la UI** (02-PLAN §5.4): mover
  y traer ofrecen sólo el mismo día; con plantillas, la visita no cambia de fecha ni liga citas de otro
  día. Mover NO reescribe `encounterDate`. ⚠️ Esta regla de "mismo día" la propuso Claude y el usuario
  aún no la confirma: si la cambia, la alternativa es mover entre días reescribiendo la fecha auditada.
- **`lastVisitDate` ya no se estampa con la consulta nueva:** se recalcula como la consulta más
  reciente (estamparla la movía hacia ATRÁS al agregar a una visita pasada; "sólo hacia adelante"
  dejaba pegada para siempre una fecha futura mal tecleada). Smoke read-only 2026-09-26: 8/8 iguales.
- **Varios archivos del expediente tienen fin de línea CRLF:** un reemplazo con `\n` en un script no
  encuentra nada y NO falla ruidoso. Usar la herramienta Edit o normalizar antes.
- Smoke tests contra prod: patrón en el scratchpad de la sesión (transacción que SIEMPRE revienta);
  `railway run --service pgvector …` con `DATABASE_PUBLIC_URL`; imports dinámicos en Windows con
  `file:///C:/…`. El clasificador a veces bloquea scripts que escriben en prod: el usuario los corre
  en SU PowerShell (sin `!`).

## 6. Proceso que el usuario espera

Plan antes de código → OK → código → type-check + `pnpm gates` + smoke contra prod → code review (y
review de los arreglos del review) → OK explícito para commit/push → verificar `commitHash` por
servicio en Railway. Hablarle en inglés; docs de esta carpeta en español.
