# 01 — DISEÑO: Visitas y Tratamientos

> **Tipo: DISEÑO (borrador vivo).** Se escribió el 2026-09-25 a partir de una conversación con el
> usuario; **nada de esto está construido**. Lo que dice "decidido" lo decidió el usuario; lo que
> dice "propuesta" es recomendación sin confirmar. Cuando una pregunta abierta (§10) se conteste,
> se mueve a §2 con su fecha.

---

## 1. El problema

Hoy, desde el expediente de un paciente, el doctor crea muchas cosas **sueltas**: consultas (con
una plantilla), recetas, fotos y documentos, notas, informes médicos, y en la agenda, citas con su
cobro. Cada una vive en su propia página y nada responde a la pregunta que los doctores hacen:
**"¿qué pasó en la visita del 12 de septiembre?"**

El pedido (feedback de doctores): un **agregador por visita** — abrir "Nueva Visita" y, dentro,
subir las fotos, escribir la nota, llenar una o varias plantillas, hacer la receta y ligarla a su
cita. Las páginas que ya existen se quedan como **libros mayores**: dentro de una visita ves sólo
lo suyo; en «Docs y Galería» ves todo, de todas las visitas.

Y encima de eso, **series de visitas**: seguimientos y tratamientos por sesiones (el caso que lo
disparó es un injerto capilar, pero **el diseño es para cualquier especialidad**: 2, 6 o 15
sesiones, con o sin paquete).

---

## 2. Decisiones tomadas

| Fecha | Decisión |
|---|---|
| 2026-09-25 | **Opción A:** la Visita es un registro NUEVO que queda **arriba** de todo; lo que ya existe no cambia de forma, sólo gana un "¿de qué visita?". (Se descartó estirar la consulta para que sea la visita: todo lo que supone "una consulta = una plantilla" — PDFs, timeline, versiones, prefill del informe, lecturas del agente — se complicaría.) |
| 2026-09-25 | **«Nueva Consulta» se renombra «Nueva Visita»** y es el botón principal del expediente; de ahí se dispara el flujo. |
| 2026-09-25 | **Flexibilidad total en tratamientos:** número de sesiones libre, no pensado para una especialidad. |
| 2026-09-25 | **Precio en el tratamiento: sí**, pero sin crear una segunda fuente de verdad (§5). |
| 2026-09-25 | **Al CONCLUIR una cita en la agenda se crea su visita automáticamente**, vacía y lista para llenar. |
| 2026-09-25 | **Lo que va dentro de una visita se sigue llamando «plantillas»** (cada plantilla llenada). No se inventa otro nombre. |
| 2026-09-25 | **La consulta SOAP estándar se llama «plantilla SOAP»** dentro de la visita: se lista junto a las demás y se elige igual. |
| 2026-09-25 | **Un paciente puede tener VARIOS tratamientos a la vez** (p. ej. capilar + dermatología). |
| 2026-09-25 | **Citas concluidas ANTES del lanzamiento: sin visita retroactiva.** Sólo las 293 consultas existentes se envuelven en su visita. |
| 2026-09-25 | **El asistente (LLM) NO entra en la fase 1.** Pero no se le rompe lo que ya lee (§9). |
| 2026-09-25 | **La visita muestra el estado de pago/factura de su cita** — ya en fase 1, leído de la cita (no copiado). |
| 2026-09-25 | **Los formularios previos a la cita caen en la visita de esa cita.** |
| 2026-09-25 | **Cita concluida sin expediente** → no se crea visita al concluir; se crea **cuando el expediente se liga** a la cita (§6). |
| 2026-09-25 | **Visitas automáticas vacías** → se quedan, **atenuadas como «Vacía»**; nunca se borran solas; el doctor puede borrarla a mano sólo mientras siga vacía (§6). |

---

## 3. El modelo

```
Paciente
 ├─ Tratamiento (opcional)  — nombre · sesiones planeadas (libre) · intervalo · precio del paquete
 │    └─ Sesión N  ──► Cita   (la AGENDA es dueña de fecha, hora y cobro)
 │                 ──► Visita (el EXPEDIENTE es dueño de lo que pasó)
 └─ Visita suelta   ──► Cita (opcional)
        ├─ Registros (0..n)  = consultas llenadas con plantilla (hoy ClinicalEncounter)
        ├─ Fotos y documentos (PatientMedia)
        ├─ Notas (PatientNote)
        ├─ Recetas (Prescription)
        └─ Informes médicos (MedicalReport)   ← fase 2
```

**Cada pieza tiene UN dueño:** la agenda es dueña de *cuándo* y *cuánto se cobró*; la visita, de
*qué pasó*; el tratamiento, del *plan y lo acordado*. Nadie copia el dato de otro: lo **apunta**.

### Lo que YA existe y se aprovecha (verificado en código y en prod, 2026-09-25)

- `PatientMedia`, `Prescription` y `MedicalReport` **ya tienen `encounterId` opcional**. En prod:
  150 de 181 fotos/documentos, 12 de 65 recetas y 29 de 29 informes están ligados a una consulta.
- Una consulta (`ClinicalEncounter`) tiene **una sola** plantilla (`templateId` + `customData`).
- **No existe** liga consulta ↔ cita, ni nota ↔ consulta.
- **Concluir una cita** = pasar la `Booking` a `COMPLETED` en
  `apps/api/src/app/api/appointments/bookings/[id]/route.ts`. `COMPLETED` es terminal, y ahí mismo
  ya se crea el cobro de la cita en flujo de dinero (`createCitaLedgerEntry`).
- Hay **cuatro** rutas que crean citas (`bookings`, `bookings/instant`, `range-bookings`,
  `range-bookings/instant`, todas en `apps/api`).

### Tablas nuevas y columnas nuevas (propuesta)

- **`visitas`** — `id`, `patientId`, `doctorId`, `fecha`, `comentario`, `bookingId` (**único**:
  una cita tiene a lo sumo una visita), `tratamientoId?`, `sesionNumero?`, timestamps.
- **`tratamientos`** — `id`, `patientId`, `doctorId`, `nombre`, `sesionesPlaneadas?` (null =
  abierto), `intervaloDias?`, `precioPaquete?`, `estado` (activo · terminado · cancelado),
  `plantillaSugeridaId?`, timestamps.
- **`visitaId` opcional** en `ClinicalEncounter`, `PatientMedia`, `Prescription`, `PatientNote`,
  `MedicalReport`.
- **`tratamientoId` opcional** en `LedgerEntry` (sólo para el pago de un paquete por adelantado;
  el cobro de cada sesión sigue colgando de su cita, como hoy).

> ⚠️ **Migración = SQL manual + `prisma db execute`, NUNCA `prisma db push`** (revierte el FK
> compuesto de `bookings` y los índices parciales de `doctor_members` que viven en prod —
> `docs/NEW.MD-GUIDES/database-architecture.md` §6).

---

## 4. Fecha y hora: la CITA es la fuente de verdad

Una sesión de tratamiento **no guarda su fecha**: guarda la liga a su cita.

- **Editar desde el expediente** = editar *la cita misma* (el mismo registro que ve la agenda).
- **Reagendar o cancelar desde la agenda** → el tratamiento la lee, así que se refleja solo.
  **No hay nada que sincronizar.**

Lo único que se sincroniza es el **estado**:

| Pasa en la agenda | Efecto en el expediente |
|---|---|
| Cita **cancelada** | La sesión vuelve a «por agendar»; **no desaparece** (el plan la sigue esperando). |
| Cita **concluida** (`COMPLETED`) | Se crea su visita automáticamente (§6) y la sesión queda hecha. |
| Cita **no-show** | Sin visita. La sesión vuelve a «por agendar» (propuesta). |

| Pasa en el expediente | Efecto en la agenda |
|---|---|
| Se **borra** una sesión con cita | **Pregunta** «¿Cancelar también la cita del 3 oct?» — nunca en silencio. |

### Agendar las N sesiones de una vez

Útil ("cada 3 semanas, martes 10:00"), con dos condiciones duras:

1. **Cada cita se crea por la MISMA ruta del servidor que usa la agenda** (con sus revisiones de
   disponibilidad y choques). **No un quinto camino.** Lección de CONSULTORIOS (2026-08-11): dos
   de los cuatro caminos que crean citas no guardaban el consultorio.
2. **Las sesiones pueden quedarse «por agendar».** Flexible = un doctor planea 15 y agenda sólo las
   2 siguientes.

---

## 5. Precio: dos montos distintos, no dos copias del mismo

| Monto | Dónde vive | Qué significa |
|---|---|---|
| **Precio del paquete** (opcional) | Tratamiento | Lo *acordado* por el tratamiento completo |
| **Cobro de cada cita** | Cita / flujo de dinero (como hoy) | Lo que *de verdad* se cobró por sesión |
| **Pagado / saldo** | **Se calcula, nunca se guarda** | Suma de los cobros de las citas del tratamiento (+ el pago del paquete, si lo hubo) contra el precio del paquete |

Son hechos distintos, así que ninguno sobrescribe al otro, y el saldo no puede desviarse porque
sale de los cobros reales. **Sin precio de paquete**, el tratamiento sólo muestra lo que sus citas
han cobrado: el doctor que cobra por sesión no hace nada distinto.

---

## 6. Al concluir una cita → visita automática

**Decidido.** Se engancha donde la cita pasa a `COMPLETED` (el mismo punto donde hoy nace su
cobro). Reglas propuestas:

- **Idempotente:** `bookingId` es único en `visitas`. Si el doctor ya había abierto la visita a
  mano para esa cita, se **liga**, no se duplica.
- **Falla ABIERTO:** si crear la visita truena, **la cita se concluye igual** y se avisa (como ya
  hace `ledgerWarning` con el cobro). Concluir una cita nunca debe depender del expediente.
- **Si la cita pertenece a una sesión de tratamiento**, la visita nace con `tratamientoId` y
  `sesionNumero`, y con la plantilla sugerida del tratamiento ya elegida.
- **La cita sin expediente** (`Booking.patientId` es opcional): al concluir **no** se crea la
  visita — no hay paciente del cual colgarla. Se crea **cuando el expediente se liga** a la cita
  («+ Crear expediente» desde el modal, o ligar a un paciente existente): ese momento corre el MISMO
  paso "cita concluida → visita", idempotente. Mientras tanto la tarjeta de la cita dice
  «Sin expediente — créalo para abrir su visita», para que no se pierda en silencio. *(Decidido.)*
- **Visitas automáticas que nadie llenó:** se quedan, **atenuadas como «Vacía»** — siguen
  afirmando hechos ciertos (vino ese día, a ese servicio, pagó o no). **Nunca se borran solas**
  (borrar registros clínicos en silencio va contra la integridad del expediente, NOM-024); el
  doctor puede borrarla a mano **sólo mientras siga vacía**. *(Decidido.)*
- **Formularios previos a la cita:** `AppointmentFormLink` ya tiene `bookingId` único, así que el
  formulario que llenó el paciente llega a la visita **a través de su cita** — sin columna nueva.
  *(Decidido que caen en la visita; el mecanismo es propuesta.)*
- **Pago/factura en la visita:** la visita **lee** el cobro de su cita (el `LedgerEntry` ligado a
  la `Booking`) y su factura; no guarda copia.

---

## 7. Los flujos

| Lo que hace el doctor | Qué es |
|---|---|
| Visita única | **Nueva Visita**, sin tratamiento. |
| Llegan los laboratorios 3 días después | **Agregar a una visita pasada:** abrirla y añadir. **No** es visita nueva. |
| El paciente regresa a revisión | **Nueva Visita** → «Es seguimiento de…» → elige la anterior. Crea un tratamiento chico si no había, o se une al existente. |
| Tratamiento por sesiones | Se crea a propósito (nombre, sesiones, intervalo, precio). Cada sesión es una visita. |

"Seguimiento" y "tratamiento" son **lo mismo en el modelo** —una serie de visitas—; uno es
planeado y el otro no. Un solo concepto en vez de dos mecanismos.

### ¿Se puede crear algo FUERA de una visita? (propuesta)

**Sí, pero como camino secundario.** Hay cosas que no pasan en una visita: laboratorios que llegan
después, lo que el paciente manda antes de su cita (formularios previos), el historial de
pacientes importados, una receta renovada por teléfono o redactada por el asistente.

- Las páginas-libro (Docs y Galería, Recetas, Notas) conservan su "+", pero preguntan
  **«¿A qué visita pertenece?»** — sugiere la más reciente y ofrece «Ninguna».
- Lo suelto se ve como **«Sin visita»**: nada se esconde y nada se fuerza.
- Si con el uso nadie crea cosas sueltas, se quita el camino. Al revés (prohibir y luego permitir)
  cuesta más.

### Los libros mayores

Cada página que ya existe muestra **todo** el paciente, con una etiqueta **«Visita del 12 sep»** en
cada elemento y un **filtro por visita** (y por tratamiento, en fase 2).

---

## 8. Fases (propuesta)

| Fase | Qué incluye |
|---|---|
| **1 — Visita** | Tabla `visitas` + `visitaId` en consultas, fotos, notas y recetas. Backfill: cada una de las 293 consultas se envuelve en su propia visita (1:1) y lo que ya colgaba de la consulta hereda su visita. «Nueva Visita» con **varias plantillas**, fotos, nota y receta; liga a la cita; visita automática al concluir; etiqueta + filtro en los libros. |
| **2 — Tratamiento** | Tabla `tratamientos`; sesiones con cita; agendar N de una vez por la ruta existente; precio del paquete y saldo calculado; informes médicos dentro de la visita. |
| **3 — Progreso** | Comparación entre sesiones: fotos lado a lado, números de una plantilla (p. ej. Total UF) graficados en el tiempo. |

La fase 1 sirve sola, pero el nivel Tratamiento se diseña **ya** para que la fase 1 no se
construya de una forma que lo estorbe (por eso `tratamientoId` y `sesionNumero` están en el
esquema de `visitas` desde el principio).

---

## 9. Riesgos y lo que toca fuera de esta carpeta

- **Migración en prod sin staging:** SQL manual, backfill de las 293 consultas, smoke test
  read-only contra prod **antes** del push (método: `flujo de dinero permutaciones/TOOLING-acceso-railway-db.md`).
- **Dos apps, un evento:** la cita se concluye en `apps/api` y las visitas son del expediente
  (`apps/doctor`). Misma base de datos, pero el enganche vive en `apps/api`, y un commit sólo de
  `packages/**` **no despliega nada** (ningún watchPattern lo incluye).
- **El vocabulario "consulta"** está en el manual del widget de Ayuda, los PDFs, el timeline y el
  prompt del agente. El manual cambia en el MISMO commit que la UI que describe.
- **El asistente del doctor:** lee consultas; si la visita no le llega, contestará "qué pasó el
  12 sep" con la vista vieja. Cualquier cambio al agente sigue sus reglas y sus docs en
  `docs/DESDE JUNIO/AGENTES/` (leer primero `GENERAL AGENTES/08-EMPIEZA-AQUI.md`).
- **Permisos de miembros (19 toggles) y tiers:** una sección nueva puede necesitar su permiso y su
  lugar en el reparto por plan; sin eso, un asistente o un plan FREE podría ver o no ver cosas por
  accidente.
- **NOM-024 / integridad del expediente:** mover un elemento de una visita a otra cambia el
  registro clínico; debería quedar en la auditoría.

---

## 10. Preguntas abiertas

Ninguna. Todas las del primer borrador se contestaron el 2026-09-25 (§2). La siguiente pieza es el **plan de la fase 1** (migración SQL exacta, backfill de las 293 consultas, pantallas).
