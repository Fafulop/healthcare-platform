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
el 2026-07-29 se apilaron cinco pasadas más: **nombre y apellidos separados** al agendar,
**aviso de correo duplicado** al crear expediente, **FACTURA como grupo propio** debajo de
Cobro, **Primera vez ya no ofrece buscar expediente**, y el arreglo de **dos fallas
silenciosas** (el enlace fiscal que se invalidaba solo y el WhatsApp sin destinatario).
**Falta la prueba a mano punta a punta.**

### Bitácora de la sesión 2026-07-29

| Commit | Qué |
|---|---|
| `57859a37` | Nombre y apellidos separados en la cita (+ migración aditiva) |
| `2aa4725a` | Aviso de correo duplicado también en `Expedientes → nuevo paciente` |
| `6b555447` | **FACTURA** como grupo propio bajo Cobro · separación visible entre citas · etiquetas |
| `4eb117da` | A una cita de **Primera vez** ya no se le ofrece BUSCAR expediente existente |
| `eed733c2` | El enlace fiscal dejaba de servir en silencio · WhatsApp sin destinatario |

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

**Correo duplicado también en el alta directa — SHIPPED (`2aa4725a`).** `Expedientes → nuevo
paciente` avisa igual, listando TODOS los expedientes que comparten el correo como links.
Solo al CREAR (`!isEditing`): editando, el propio paciente haría match consigo mismo. Param
`?email=` exacto, aparte de `?search=` para no cambiar lo que devuelven los buscadores por
nombre. **Aviso, no bloqueo** — ni UI, ni API, ni BD impiden repetir correo (no hay unique en
`patients.email`), y en prod hay CUATRO expedientes con el mismo a propósito: familias y
cuidadores.

**FACTURA como grupo propio — SHIPPED (`6b555447`).** Estaba metido en "Documentos", junto al
formulario CLÍNICO pre-consulta. Ahora vive **debajo de Cobro**, que es el paso anterior de la
MISMA cadena, y espeja sus estados uno a uno:

| | Cobro | Factura |
|---|---|---|
| Sin expediente | Requiere expediente | Requiere expediente |
| Acción inicial | Link de pago | Facturación |
| Enlace creado | Link enviado + compartir | Esperando datos + compartir |
| Listo | Pagado ✓ | Datos fiscales ✓ |

Al emparejarlos salieron dos huecos: marcar *¿Necesita factura?* en una cita **sin expediente**
no mostraba NADA (doble guard: el gate del padre exigía `patientId` y el botón devolvía `null`),
y con el enlace creado quedaban dos botones sueltos sin chip que dijera de qué eran.
Verificado sin regresión enumerando las **60** combinaciones de estado × formulario ×
expediente × casilla: cambian 12, todas son el grupo Factura apareciendo donde no había nada, y
todas con la casilla marcada. La columna del formulario clínico es idéntica en las 60.

En la misma pasada: **separación visible entre citas** (`divide-y divide-gray-50` era casi
invisible Y dibujaba la misma línea entre dos citas que entre una cita y su propia fila
desplegada — una cita abierta se leía como dos; ahora el borde cierra la CITA, con
`last:border-b-0`), y las etiquetas **Confirmación → Confirmación cita** y la casilla
**Factura → ¿Necesita factura?** (que es como el propio comentario del componente ya la
llamaba).

**Primera vez ya no ofrece BUSCAR expediente — SHIPPED (`4eb117da`).** Un paciente nuevo debe
nacer con su propio expediente: colgarle uno existente hace que el correo de la cita y el del
expediente puedan diferir desde el minuto uno, y **la copia de la cita gana en todos lados**.
La fila, sin expediente: `isFirstTime === true` → solo "+ Crear expediente"; `false` y `null`
(las 22 del agente) conservan las dos opciones. El modal de agendar no necesitó cambios — su
bloque ya estaba gateado a `isFirstTime === false || selectedPatientId`.
⚠️ La búsqueda **se repliega detrás de un enlace**, no desaparece: `isFirstTime` NO se puede
corregir después (el PATCH no lo acepta), así que esconderla a secas dejaría atrapado al doctor
que marcó mal la cita, y su única salida sería crear un DUPLICADO.
⚠️ **Es convención de UI, no invariante:** el PATCH acepta `patientId` para cualquier cita y
`propose_create_booking` del agente recibe `patientId` y `patientEmail` como entradas
independientes.

**Dos fallas SILENCIOSAS arregladas — SHIPPED (`eed733c2`).**

1. **El enlace de datos fiscales se invalidaba solo.** `POST /fiscal-form-link` rotaba el token
   en CADA llamada si ya había uno PENDIENTE, y el estado del botón vivía en un `useState`, así
   que al refrescar volvía a decir "Facturación". Secuencia real: crear enlace → mandarlo por
   WhatsApp → refrescar → clic otra vez → **el enlace que el paciente tiene deja de servir**,
   sin aviso por ningún lado. Arreglado en tres capas: el endpoint DEVUELVE el existente
   (rotar exige `regenerar: true`), el enlace pendiente viaja en el payload de la cita, y el
   botón deriva su estado del servidor.
   ⚠️ El enlace fiscal cuelga del **PACIENTE** (`templateId='FISCAL'`, `bookingId` NULL), por
   eso no llegaba en `formLink`, que se resuelve por `bookingId`. **El filtro por `templateId`
   es obligatorio** — comparte tabla con los formularios clínicos y se distingue solo por ese
   centinela; olvidarlo es el bug que hoy infla `formulariosPreConsulta` en el agente (§8.2).
2. **El formulario pre-consulta se "mandaba" a nadie.** Armaba `wa.me/?text=…` **sin
   destinatario**: abría WhatsApp con el mensaje listo y sin nadie a quién enviarlo. Si el
   doctor no notaba que faltaba elegir contacto, lo daba por enviado.

Y una inconsistencia que salió revisando eso: el teléfono se resolvía de **dos maneras** — la
fila con respaldo al expediente y los botones de compartir con `booking.patientPhone` a secas,
así que la fila MOSTRABA un número mientras el botón de WhatsApp se escondía diciendo que no
había. Se extrajo **`lib/booking-contact.ts`** (`resolverContacto` + `telefonoWhatsApp`), que
ahora usan la fila, el link de pago, el botón fiscal y el modal pre-consulta. **Es el único
archivo a tocar si se decide la bitácora #30.**

### Números medidos en prod (2026-07-29 — baseline)

| | |
|---|---|
| Citas totales | 366 (368 al re-medir más tarde el mismo día) |
| Sin expediente | 304 (de ellas 195 con correo, 256 con teléfono) |
| `patient_name` de UNA sola palabra | 124 (34%) — por eso **Apellidos es opcional** |
| Marcadas "Primera vez" | 255, de ellas **34 CON expediente** |
| Citas con `is_first_time` NULL (las crea el agente) | 22 |
| Citas vinculadas con nombre distinto al del expediente | 36 de 62 (58%) |
| Citas vinculadas con correos DISTINTOS cita↔expediente | **4 de 64 (1%)** |
| Citas vinculadas con el correo SOLO en el expediente | 21 de 64 |
| Acierto del split viejo (citas vinculadas con nombre idéntico) | **23 de 26** |
| Acierto de la alternativa "las 2 últimas palabras son apellidos" | **22 de 26** — peor, se descartó |
| Enlaces fiscales PENDING vs SUBMITTED | 4 / 5 (el resto de la tabla son formularios clínicos) |

> 📌 Los **34 "Primera vez" CON expediente** son la razón por la que la regla de `4eb117da`
> se limita a **no ofrecer la búsqueda** y NO prohíbe estar vinculada: crear el expediente
> desde la cita la vincula, y ése es el flujo bueno. Prohibirlo habría contradicho más de la
> mitad de las 64 citas vinculadas que ya existen.
>
> 📌 Y los **4 correos distintos (1%)** son la medida de lo que la regla puede evitar. La fuga
> grande no es vincular, es **editar el correo en el expediente DESPUÉS** — la cita conserva su
> copia vieja y ésa gana. Eso es la bitácora #30 y sigue abierto.

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
2. **Unificar los tres flujos de ENLACE** (formulario pre-consulta · datos fiscales · link de
   pago) — la reorganización quedó a medias. El diseño acordado: un modal compartido de
   **compartir** (Copiar · WhatsApp · **Correo**) y, al cerrarlo, chip de estado + menú
   (Reenviar / Regenerar / Cancelar). Lo que falta y sus trampas:
   - **Correo: no existe en ninguno de los tres.** Es la única pieza nueva de verdad. Reusaría
     `lib/gmail` (cuenta de Google del doctor). Login es siempre Google, pero eso NO garantiza
     el scope `gmail.send` ni un refresh token vivo — medido: de 104 citas CONFIRMED, 17 tenían
     correo y NO se envió. 🔒 **Bloqueado por la decisión #30**: el destinatario sale de fuentes
     distintas hoy (el fiscal guarda `patient.email`, el clínico `booking.patientEmail` **sin
     respaldo** — una cita sin correo genera un enlace con destinatario vacío).
   - **"Regenerar" no es hermano de "Cancelar" en el link de pago:** el guard bloquea crear otro
     mientras haya uno ACTIVO, así que Regenerar = cancelar y luego crear. Y si está **PAGADO**
     no hay ninguno de los dos.
   - **"Cancelar" el enlace fiscal no significa lo mismo:** es del PACIENTE, no de la cita, así
     que cancelarlo desde una cita lo cancela para TODAS las de esa persona. Y no existe
     endpoint. Diseñarlo aparte, no copiar el menú del link de pago.
   - **Cancelar el link de pago ya existe en el servidor** (`DELETE` en Stripe y en MP) y la UI
     **nunca lo llama** — ese punto del menú es cablear algo hecho.
   - **Regenerar el enlace fiscal quedó sin camino en la UI** tras `eed733c2`: el endpoint acepta
     `regenerar: true` y ningún botón lo manda. Nadie queda bloqueado (se puede copiar el que
     existe), pero rotarlo espera este menú.
   - El formulario clínico **caduca** con la fecha del slot (o 7 días en freeform); el fiscal
     **no caduca nunca**. Mismo flujo ≠ mismos estados.
3. **Los BLOQUEOS deben decirse, no esconderse.** Hoy un requisito no cumplido se comunica
   ocultando el botón o con un `title=`. Ya existe el patrón bueno —`faltaContacto()` en
   `BookingsSection` rinde *"Necesita correo"* como **link al expediente**— y hay que
   generalizarlo: todo requisito rinde algo que **nombra lo que falta y lleva a donde se
   arregla**. Falta en: el CSD/perfil fiscal del doctor (nada lo dice en la cita), los 6 campos
   fiscales para poder timbrar, y el expediente en el formulario clínico (hoy solo un `title`).
4. **Pulir los flujos restantes** — **recordatorios** (sin tocar aún) · el formulario pre-cita
   dice "Crear formulario" · orden/acomodo de la fila · el `prompt()` del navegador con el que
   se manda un CFDI por correo (`facturacion/page.tsx`, sin prellenar nada).
5. **Renombrar `Cobro` y `Facturación`** — se dejaron tal cual A PROPÓSITO: el prompt del agente
   los nombra ("botón Cobro" ×3, "botón Facturación" ×2 en `modules/facturas.ts`). Renombrarlos
   exige editar el prompt ⇒ cambian los bytes del prefijo y hay que correr los 81 casos. Va
   junto con la deuda de agente del punto 6. (`Confirmación` y la casilla NO los nombra:
   verificado antes de cambiarlas.)
6. **Deuda de AGENTE, agrupada a propósito** — 3 arreglos que comparten UNA corrida de la suite:
   ver [`../AGENTES/AGENTE FACTURAS/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20FACTURAS/SESSION-REFRESCO.md)
   próximos pasos §8 y la bitácora **#30** de
   [`../AGENTES/AGENTE AGENDA/SESSION-REFRESCO.md`](../AGENTES/AGENTE%20AGENDA/SESSION-REFRESCO.md).
7. **Código muerto**: el picker de slots ya no se usa (`SlotPickerStep`, las 2 ramas de submit
   que no son rangos, el árbol `/v1`). ⚠️ NO tocar `POST /api/appointments/bookings` — el
   widget público del sitio agenda por ahí.

Menores: vincular expediente sigue **sin ser obligatorio** pese a haber quitado el "(opcional)" ·
reagendar pierde `notes` · `calculateAge` off-by-one en ~7 archivos · `apps/doctor` sin ESLint ·
`errorMsg` de `FiscalFormButton` se setea en 3 sitios y no se rinde en ninguno.

## Rarezas que NO son bugs (para no "arreglarlas" dos veces)

- **"Esperando datos" aparece en TODAS las citas de ese paciente.** El enlace fiscal es del
  paciente, no de la cita: los datos fiscales se piden una vez, no una por consulta. Es correcto,
  y es justo por eso que "Cancelar" ahí no puede copiar el menú del link de pago.
- **`SKIPPED` en `@healthcare/api` al desplegar es normal** cuando el commit no toca `apps/api`.
  Lo peligroso es lo otro: un servicio que SÍ cambió y no tiene registro para ese commit.
- **Apellidos es opcional en la cita pero obligatorio en el expediente.** Deliberado: 34% de las
  citas traen un nombre de una sola palabra.

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
