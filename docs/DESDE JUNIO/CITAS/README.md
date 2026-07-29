# 📅 CITAS — los flujos de `/dashboard/appointments`

> **Qué vive aquí.** Todo lo de la tabla "Todas las Citas" y sus modales: agendar, reagendar,
> completar, cobrar, confirmar, y la relación cita ↔ expediente. Tipo **ESTADO / BITÁCORA**:
> este README se actualiza al cerrar cada sesión.
>
> **Qué NO vive aquí.** Lo del **agente** (aunque lo haya disparado un cambio de citas) va a
> `../AGENTES/AGENTE AGENDA/` o `../AGENTES/AGENTE FACTURAS/` — la bitácora de fallos del
> agente es la de `AGENTE AGENDA/SESSION-REFRESCO.md`. Aquí solo se resume y se cross-linkea.
> Convención completa: [`../AGENTES/GENERAL AGENTES/07-CONVENCIONES-docs.md`](../AGENTES/GENERAL%20AGENTES/07-CONVENCIONES-docs.md).

## Índice

| Doc | Tipo | Qué es |
|---|---|---|
| [`00-METODO-prueba-manual-punta-a-punta.md`](00-METODO-prueba-manual-punta-a-punta.md) | REFERENCIA | El guion de la prueba a mano de cada flujo de una cita |

## En una frase

El rediseño de la tabla (2026-07-28/29) está **shipped y verificado en prod**; encima de eso,
el **nombre y los apellidos ya se capturan por separado** al agendar (`57859a37`,
2026-07-29), así que crear el expediente desde una cita dejó de adivinar dónde parte el
nombre. **Falta la prueba a mano punta a punta.**

## Estado

**Rediseño de la tabla — SHIPPED (2026-07-28/29).** Filas colapsables · filtros "Todas las
fechas" + Activas/Completada · bloqueo de horario bajo FECHA Y HORA · Cobro y Documentos
sobreviven a COMPLETADA · casilla **Factura** por cita (`bookings.factura_solicitada`) ·
grupo **Confirmación** con estados honestos por canal · contacto resuelto `cita → expediente`
en la fila, los 2 endpoints de envío y el link de pago · reagendar conserva `patientId` y
manda `isRescheduled`.

**Nombre y apellidos separados — SHIPPED (2026-07-29, `57859a37`).** Dos campos en el modal
de agendar; `bookings.patient_first_name` / `patient_last_name` (migración aditiva, nullable).
`patient_name` **sigue siendo la concatenación** — es lo que leen los correos, el agente, el
widget público, la fila y el link de pago; los campos separados van ADEMÁS.
Lo viejo NO cambia de comportamiento: las 366 citas previas, las del widget público y las que
crea el agente quedan en NULL y siguen usando el split de `partirNombreDeCita`.
De paso, el modal de crear expediente avisa de dónde vienen los datos y **flagea el correo
duplicado** ofreciendo vincular el expediente que ya existe (aviso, NO bloqueo).

### Números medidos en prod (2026-07-29 — baseline)

| | |
|---|---|
| Citas totales | 366 |
| Sin expediente | 304 (de ellas 195 con correo, 256 con teléfono) |
| `patient_name` de UNA sola palabra | 124 (34%) — por eso **Apellidos es opcional** |
| Citas vinculadas con nombre distinto al del expediente | 36 de 62 (58%) |
| Acierto del split viejo (citas vinculadas con nombre idéntico) | **23 de 26** |
| Acierto de la alternativa "las 2 últimas palabras son apellidos" | **22 de 26** — peor, se descartó |

> 📌 Esa última fila es la lección: la forma agregada de los expedientes (**117 de 160** tienen
> 2 palabras en `last_name`) *sugería* que el split debía cambiar. La prueba directa dijo que no.
> **Se midió antes de cambiar una heurística viva, y la medición ganó.**
>
> ⚠️ El mensaje del commit `57859a37` dice "118 de 160" — está mal por uno (117). No se
> reescribe la historia por eso; el número bueno es éste. Es, de paso, el segundo tropiezo de
> la misma clase en esta pasada: **el agregado que "se ve" convincente es justo el que hay que
> recontar.**

## Pendiente

1. **Prueba a mano punta a punta** — el guion está en
   [`00-METODO`](00-METODO-prueba-manual-punta-a-punta.md). Casi todos los bugs de este trabajo
   salieron de probar en vivo o de consultar la BD; **el `type-check` estuvo verde todas las
   veces que estuvo mal**.
2. **Duplicado por correo en `Expedientes → nuevo paciente`** — el modal desde la cita ya avisa,
   pero el alta directa (`PatientForm.tsx`) no. Es donde más fácil nace un duplicado.
3. **Pulir los flujos restantes** — correo y WhatsApp como fuente única (⚠️ `Patient` NO tiene
   columna de WhatsApp: ese número solo vive en la cita) · **recordatorios** (sin tocar) ·
   formularios (el pre-cita dice "Crear formulario" y su `wa.me` va sin número) · orden de la fila.
4. **Envío de formularios por CORREO** — no existe para ninguno de los dos. Reusaría `lib/gmail`
   (solo sirve con Google conectado).
5. **Deuda de AGENTE, agrupada a propósito** — 3 arreglos que comparten UNA corrida de la suite:
   ver [`../AGENTES/AGENTE FACTURAS/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20FACTURAS/SESSION-REFRESCO.md)
   próximos pasos §8 y la bitácora **#30** de
   [`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md).
6. **Código muerto**: el picker de slots ya no se usa (`SlotPickerStep`, las 2 ramas de submit
   que no son rangos, el árbol `/v1`). ⚠️ NO tocar `POST /api/appointments/bookings` — el
   widget público del sitio agenda por ahí.

Menores: vincular expediente sigue **sin ser obligatorio** pese a haber quitado el "(opcional)" ·
reagendar pierde `notes` · `calculateAge` off-by-one en ~7 archivos · `apps/doctor` sin ESLint.

## Cómo se trabaja aquí

- **La verdad es el CÓDIGO y la BD**, no los docs ni un `grep` acotado a una carpeta (ya pasó:
  se afirmó una "inversión de CIT-6" que no existía).
- Toda forma de query nueva **se smoke-testea read-only contra prod ANTES del push** —
  método en los `TOOLING-*`, nunca improvisado.
- Migraciones = **SQL manual + `prisma db execute`**, nunca `prisma db push` (revierte el FK
  compuesto de `bookings`). ⚠️ Contra prod va con `--url` y la **URL pública**
  (`LLM_DATABASE_URL`): `--schema prisma/schema.prisma` resuelve `DATABASE_URL`, que en la
  máquina de desarrollo apunta a **localhost**.
- **La BD va ANTES que el código**: el GET de citas usa `include`, así que una columna del
  schema ausente en la BD tumba la página.
- Tras desplegar: **verificar el `commitHash` por servicio** (`railway deployment list --service
  "<nombre>" --limit 1 --json`) y **hard refresh**, o se prueba el bundle viejo.
