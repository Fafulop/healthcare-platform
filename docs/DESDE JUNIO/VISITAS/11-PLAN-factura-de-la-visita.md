# 11 — PLAN: «Facturar» desde la visita (la cita + sus ventas en UNA factura)

> Estado (2026-10-12): **tabla creada en prod** (§5b, §6.1) y **código escrito, sin commit** — falta code review y OK.
> Pedido: en la tarjeta de la cita de la VISITA, un botón verde «Facturar» que lleva a Facturación con todo
> prellenado — el cobro de la cita **y los artículos de las ventas de esa visita** — en una sola factura.

---

## 0. El problema de fondo (por qué no es sólo un botón)

Hoy **una factura (`cfdis_emitted`) se liga a UN solo ingreso** (`ledger_entry_id`). Ese enlace es el que
hace que algo cuente como «facturado»:

| Quién lee «¿está facturado?» | Cómo lo lee |
|---|---|
| Citas (agenda, visita, Cobros, filtro «Por facturar») | `resolveFacturaVerdict` → `ledgerEntry.cfdisEmitted` (+ subidas, + uuid del SAT) |
| Ventas (`ventas/[id]`) | `hasFactura` u otras señales en SU ingreso |
| Flujo de Dinero, agente (flujo/facturas), completeness | `ledger_entries.has_factura` |
| Cancelar una factura | resetea `has_factura` (y el uuid) **de su único ingreso** |
| Doble emisión | `POST /facturacion/cfdi` rechaza si el ingreso ya tiene `has_factura` |

Una factura «cita + ventas» timbrada con el modelo de hoy quedaría ligada sólo al ingreso de la cita:
**las ventas seguirían diciendo «Sin factura»** y se podrían facturar dos veces.

**Medido en prod (2026-10-12, sólo lectura):** cada venta tiene **exactamente 1 ingreso** por su total
(aunque no esté pagada; el ingreso lleva su `paymentStatus`) — igual que una cita. 7 ventas cuelgan de una
visita (3 pagadas, 1 a medias, 3 pendientes); ninguna facturada. Así que «una factura ↔ N ingresos» es una
lista fija y limpia: la cita (0 o 1) + cada venta (1 c/u).

## 1. El modelo: una factura puede cubrir VARIOS ingresos

- **Tabla nueva** `practice_management.cfdi_ingresos` (SQL manual + `prisma db execute`, nunca `db push`):
  `cfdi_emitted_id` (FK → `cfdis_emitted`, ON DELETE CASCADE) · `ledger_entry_id` (FK → `ledger_entries`,
  **ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED**: un ingreso cubierto no se puede borrar — ver §5b H1/H7)
  · `created_at` · PK (`cfdi_emitted_id`, `ledger_entry_id`) · índice por `ledger_entry_id`.
- **El ingreso PRINCIPAL sigue en `cfdis_emitted.ledger_entry_id`** (el de la cita; si no hay cita con
  cobro, el de la primera venta). Por eso **todo lo que hoy lee la cita no cambia**: el veredicto de la cita,
  abrir / mandar su factura desde la tarjeta, el uuid del SAT (`sat_cfdi_uuid` es ÚNICO: sólo el principal lo
  lleva, y con eso el sync del SAT ya no duplica el ingreso).
- **Los ingresos ADICIONALES** (las ventas) quedan en la tabla y con `has_factura = true` → las ventas, Flujo
  de Dinero y el agente ya los ven facturados sin tocar sus lecturas.
- La tabla guarda TODOS (principal incluido) **cuando la factura cubre más de uno**; una factura de un solo
  ingreso (Cobros, el agente, la visita sin ventas) no escribe filas — sigue como hoy.

## 2. Servidor (apps/api)

1. **`GET /api/facturacion/prefill/visita/[visitaId]`** (permiso `facturacion`; dueño de la visita). Decide
   todo del lado del servidor (regla 0) y contesta con la MISMA forma que un borrador (`DraftPrefill`) para que
   el formulario de Facturación lo use tal cual:
   - **receptor**: de los datos fiscales del paciente (`deriveReceiverFromPatient`, el mismo de los
     borradores; si faltan campos, `camposFaltantes` y el formulario lo dice como hoy);
   - **conceptos**:
     - la cita: si tiene ingreso con monto, NO facturado → 1 concepto «servicio» por el monto del ingreso
       (igual que «Facturar» de Cobros: sin IVA, clave 85121800);
     - cada venta de la visita NO cancelada y NO facturada → sus artículos (`sale_items`): descripción,
       cantidad, precio unitario con su descuento aplicado, `withIva` = su tasa > 0. Clave 85121800 / E48 (las
       de siempre del formulario; el doctor las cambia ahí si un producto lleva otra);
   - **ingresos**: `ledgerEntryId` (principal) + `ledgerEntryIdsExtra` (las ventas);
   - **forma y método de pago**: forma = la del ingreso de la cita (o de la primera venta); método **PUE** si
     TODOS los ingresos incluidos están pagados, **PPD** si alguno no (y una línea que lo dice);
   - **excluidos, con el porqué** (se pintan arriba del formulario): «ya facturada», «cancelada»,
     «$0 / cubierta por el paquete», «sin cobro registrado».
   - Verifica que la suma de cada venta cuadre con su ingreso (±1 centavo); si no, avisa.
2. **`POST /api/facturacion/cfdi`** acepta `ledgerEntryIdsExtra: number[]` (máx. 20):
   - antes de timbrar, por cada uno: es de este doctor, monto > 0, NO `has_factura`, distinto del principal,
     **del mismo paciente** que el principal → si no, 409 y no se timbra nada (mismo guardia anti-doble-emisión
     que ya tiene el principal);
   - después de timbrar (no fatal, como hoy): inserta las filas de `cfdi_ingresos` (principal + extras) y pone
     `has_factura = true` en los extras.
3. **Cancelar** (`cfdi/[id]/cancel`): al cancelar en definitivo, además del principal (ya existe), resetea
   `has_factura` de cada ingreso de `cfdi_ingresos` — con la MISMA regla: salvo que ese ingreso tenga otra
   señal de factura viva — y **borra los enlaces de esa factura** (si se quedaran, la FK impediría para siempre
   cancelar o borrar esas ventas). (Construido así el 2026-10-12.)
4. **`ventas/[id]`**: además de «facturada», devuelve QUÉ factura la cubre (folio, id) para abrirla.

## 3. Pantallas (apps/doctor)

1. **Tarjeta de la cita, SÓLO en la visita** — fila «Factura»: un botón **verde «Facturar»** (lo único
   nuevo) que lleva a `/dashboard/facturacion?from=visita&visitaId=…`. En la visita la fila «Factura» se ve
   siempre (no depende de la casilla). Con la cita ya facturada, el botón no sale (la fila enseña su factura,
   como hoy). En la agenda y en «Cobros» la tarjeta no cambia.
2. **Facturación**: `?from=visita&visitaId=` → pide el prellenado y llena el formulario igual que con un
   borrador (N conceptos, receptor, forma y método de pago) + la lista de excluidos con su porqué. Al timbrar
   manda `ledgerEntryId` + `ledgerEntryIdsExtra` (sin `draftId`: no hay borrador).
3. **Venta** (`ventas/[id]`): con su factura, «Facturada · Folio …» y el enlace para verla.
4. **Manual** (Facturar una cita · Visitas · Ventas) y la guía de facturar, en el MISMO commit.

## 4. Lo que NO cambia

- «Facturar» de **Cobros** (una cita sola) y los borradores del agente: igual que hoy (un ingreso).
- El veredicto de las citas (`resolveFacturaVerdict`): no se toca — la cita siempre es el ingreso principal.
- El agente: sus tools leen `has_factura` / el principal; no se toca su prompt. (Proyecto en standby: si
  algún día factura visitas, eso es otro plan.)

## 5. Riesgos y cómo se cubren

| Riesgo | Cobertura |
|---|---|
| Doble factura de una venta | guardia `has_factura` en CADA extra antes de timbrar (409) |
| Cancelar deja las ventas «facturadas» | reset de todos los ingresos de `cfdi_ingresos` en la cancelación definitiva |
| `sat_cfdi_uuid` único | sólo el principal lo lleva (como hoy) |
| `prisma db push` revierte cosas en prod | la tabla va por SQL manual + `prisma db execute` (database-architecture §6) |
| Query nueva rompe prod | smoke test SÓLO LECTURA de cada query nueva contra prod ANTES del push |
| Total de la venta ≠ suma de sus artículos | el prellenado avisa; el doctor ajusta en el formulario |

## 5b. Revisión del plan (2026-10-12, a pedido del usuario: «¿es seguro? busca huecos»)

Leído contra el código. Lo que el plan de arriba NO cubría y se agrega:

| # | Hueco | Qué pasaría | Arreglo (entra al plan) |
|---|---|---|---|
| H1 | **Cancelar una venta BORRA su ingreso** (`ventas/[id]` PATCH → `ledgerEntry.delete`) y **borrarla** también (DELETE → `deleteMany`). Hoy nada lo impide aunque la venta esté facturada. | Con la tabla en CASCADE, la factura perdía en silencio el renglón de esa venta; la factura legal seguiría incluyéndola. (Ya pasa hoy con una venta facturada sola: su factura queda sin ingreso.) | **409 en la app**: no se cancela, borra ni se le cambian artículos/precios a una venta cuyo ingreso tiene factura viva — «cancela primero la factura». **Respaldo en la BD**: la FK del ingreso es `NO ACTION DEFERRABLE` (no CASCADE): borrar un ingreso cubierto TRUENA. Probado con rollback. |
| H2 | **Fusionar ingresos** (`ledger/merge`) mueve las facturas del ingreso que se borra al que queda, pero no conocería la tabla nueva. | La fusión tronaría por la FK (H1) — o, sin ella, perdería el enlace. | `merge` re-apunta también las filas de `cfdi_ingresos` (sin duplicar la llave). |
| H3 | **Borradores del asistente** sobre la cita o una venta incluida. | Quedaban vivos y, al intentar emitirlos, 409 (ya facturado) — el mismo «dos caminos» que Cobros evita. | Al timbrar, los borradores vivos de TODOS los ingresos cubiertos se cierran (`emitted`, con el id de la factura). |
| H4 | Marcar los extras después de timbrar falla a medias. | Una venta quedaba facturable dos veces. | Enlaces + `has_factura` de los extras en UNA transacción; si falla, la respuesta lo dice (la factura ya salió) y queda en el log con los ids, para arreglarlo a mano. |
| H5 | **Formas de pago distintas** (cita en efectivo, venta por transferencia). Una factura PUE lleva UNA forma. | Factura con la forma equivocada. | El prellenado avisa «formas de pago distintas» y propone la del monto mayor; el doctor la confirma en el formulario. |
| H6 | La cita ya facturada pero sus ventas no. | El botón se escondía y las ventas no tenían por dónde. | El botón sale mientras haya ALGO por facturar en la visita (cita o ventas); el prellenado decide qué entra y si no queda nada lo dice. |
| H7 | Cuenta del doctor borrada (arrastra facturas e ingresos a la vez). | Con una FK que revisa al momento, el borrado podía tronar por el orden de los cascades (la lección de `medical_reports`). | Por eso la FK es `DEFERRABLE INITIALLY DEFERRED`. Va a la lista «sólo en la BD» de database-architecture.md (Prisma no la modela). |

**Ya cubierto (revisado):** el uuid del SAT sigue en el principal (único; el sync no duplica) · la
cancelación «pendiente» no resetea nada hasta ser definitiva (igual que hoy) · el agente choca con el guardia
`has_factura` si intenta facturar una venta cubierta · «Otras facturas del paciente» sólo lista facturas cuyo
principal no es de una cita (correcto: una factura de visita con cita no es «otra»).

**Huecos que YA existen hoy y este plan NO arregla** (anotados, fuera de alcance): editar el monto de un ingreso
facturado en Flujo de Dinero no se bloquea (`ledger/[id]` PUT) · dos timbrados simultáneos del mismo ingreso
pueden pasar los dos el guardia (ventana de segundos).

**SQL revisado y probado** (2026-10-12, transacciones revertidas contra prod): tabla, PK, FKs e índice exactos;
re-correrlo no truena; borrar la FACTURA borra sus enlaces; borrar un INGRESO cubierto truena
(`23503 … violates foreign key constraint "cfdi_ingresos_ledger_entry_id_fkey"`); después del rollback la tabla
no existe y la factura de prueba sigue intacta.

## 5c. Code review del código (2026-10-12) — lo que cambió del plan

| Hallazgo | Arreglo |
|---|---|
| PPD con la forma real (no «99») → el SAT rechaza; y PPD obliga a complementos que la plataforma no emite | **Lo no pagado NO entra** («sin pagar completo: factúrala cuando se pague»): la factura de la visita es siempre **PUE**. (Sustituye «PUE/PPD» de §2.1.) |
| El doctor quita conceptos en el formulario y emite → esa venta quedaba «facturada» sin estar en la factura | El servidor rechaza (409) si la factura (subtotal + IVA trasladado) no suma los cobros que marcaría (±$1) |
| `withIva` sólo dice sí/no; el formulario aplica 16% a todo | Venta con IVA ≠ 16% no entra («factúrala desde Facturación»); el aviso de descuadre calcula con el 16% que se va a timbrar |
| Botón «Facturar ventas» eterno / «Facturar» sin nada que facturar | La visita pregunta al servidor (el mismo prellenado) y sólo pinta el botón si hay algo incluido |
| Cancelar: el reset de los extras ignoraba su uuid del SAT / facturas subidas; `link-cfdi` DELETE ignoraba la factura de visita | Mismas señales que el principal; reset + borrar enlaces en UNA transacción; `link-cfdi` conserva `has_factura` si una factura de visita viva lo cubre |
| La venta «abre su factura» (no: lleva a la lista) | Texto y comentario corregidos: lleva a la lista de Facturación |
| (2ª pasada) Con la cita cancelada / «No asistió» el botón no salía, aunque la visita tuviera ventas pagadas | El botón ya no depende del estado de la cita: lo decide el prellenado (lo pagado y sin factura) |
| (2ª pasada) Precio unitario con descuento redondeado a centavos → se desviaba con la cantidad y la factura no cuadraba | 6 decimales (los que admite el SAT); el campo «Precio Unitario» del formulario acepta decimales (`step="any"`; con 0.01 el navegador no dejaba enviar) |
| (2ª pasada) Ingreso sin forma de pago → «01 Efectivo» | Se deja: es lo mismo que hace «Facturar» de Cobros (`formaDePago || 'efectivo'`) |

## 6. Orden de trabajo y puntos de OK

1. SQL de la tabla (probado con rollback, §5b) → **OK del usuario** → `prisma db execute` en prod (DDL; es
   una escritura) → verificar definiciones con `pg_get_constraintdef` → anotarla en database-architecture.md.
2. Prisma schema + generate. Servidor (prefill, cfdi, cancel, ventas/[id] con sus guardias H1, merge H2,
   borradores H3) → type-check + gates + smoke test de las queries (sólo lectura).
3. Pantallas + manual → type-check + gates.
4. **Code review completo** (lógica de dinero y de facturas) → arreglos → segunda pasada.
5. **OK del usuario** → commit + push (toca apps/api, así que despliegan los dos servicios; verificar
   `commitHash` de cada uno).
6. Prueba en prod: prellenado de una visita con cita + venta (sin timbrar). **Timbrar una factura real lo
   decides tú** (consume folio y cuenta en tu plan); si quieres, con «nigs ni», y luego cancelarla para
   probar que las ventas regresan a «sin factura».
