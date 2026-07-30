# 🔧 PLAN — realinear el agente con los cambios de CITAS (2026-07-29)

> 🔒 **SNAPSHOT — 2026-07-30.** Los **6 puntos están implementados y verificados** (5 gates +
> type-check + DOS corridas de 81 casos con 0 FAIL estables). El estado vivo se mudó a
> [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md), bitácora **#31**. Este doc se congela: si algo de
> aquí resultó falso, se **anota**, no se borra.
>
> **Lo que el plan NO previó y salió al implementar** (detalle en #31):
> - El punto **A** tenía **CUATRO** sitios de texto, no tres: se le escapó el `from` de
>   `DESCRIPTION_OVERRIDES` (`registry.ts`), que debe seguir byte-idéntico a la descripción real.
> - **A no podía conservar el centinela.** La frase que `gate:prompt` exigía (*"se emite desde la
>   tabla de citas"*) es justo la que A borra ⇒ hubo que **mudar el centinela** a la CONDICIÓN
>   (`solo si el paciente ya tiene datos fiscales COMPLETOS`), no a un destino.
> - **Nombrar el EXPEDIENTE como destino acopla un permiso que `agenda` no exige** — 12 de 66
>   scopes alcanzables lo habrían recibido sin tener la sección (familia #26/#27). La prosa se
>   quedó en la frontera, sin destino. `gate:prosa` ahora reconoce "expediente" como sección.
> - **F/D no se pudo hacer como filtro.** Ver §1 F/D, anotado abajo.
>
> **Tipo original: PLAN.** Se convierte en **SNAPSHOT** (banner de `07-CONVENCIONES` §3) en cuanto
> shippee; su estado vivo se muda al `SESSION-REFRESCO` del dominio.
>
> **Por qué existe.** El 2026-07-28/29 se rediseñaron los flujos de `/dashboard/appointments`
> (seis commits, ver [`../../CITAS/README.md`](../../CITAS/README.md)). **Antes de esa pasada el
> agente estaba alineado con el código.** No es que el agente esté "mal": la UI se movió y él se
> quedó. Este plan es *restaurar la alineación*, y de paso paga dos deudas viejas que caben en la
> misma corrida.
>
> ⚠️ **Toca el prompt y las tools ⇒ una corrida COMPLETA de la suite.** Por eso todo va en UNA
> pasada: la corrida es el costo, no los arreglos.

---

## 0. ESTADO — dónde quedó la pasada (2026-07-29, fin de sesión)

> ✅ **CERRADO 2026-07-30 — los 6 puntos HECHOS, EN PROD.** `90490d54` (B) · `a8c86b84` (E) ·
> **`d1f9a4d3`** (F/D + C + A + G) · `61040679` (docs) · `ab6c21b5` (tooling).
> Deploy verificado: `@healthcare/doctor` SUCCESS en `ab6c21b5`.

| # | Qué | Estado | Commit |
|---|---|---|---|
| **B** | contacto por expediente en `get_booking_detail` | ✅ **HECHO** | `90490d54` — **pusheable SOLO** |
| **E** | el agente ve el formulario fiscal pendiente | ✅ **HECHO** | `a8c86b84` — ⛔ **NO pushear solo** |
| **F/D** | `factura_solicitada` invisible (DOS sitios) | ✅ **HECHO** — como **SEÑAL**, no como filtro (§1 F/D) | `d1f9a4d3` |
| **C** | `formulariosPreConsulta` cuenta los FISCALES | ✅ **HECHO** | `d1f9a4d3` |
| **A** | prosa del CFDI incompleta | ✅ **HECHO** — **CUATRO** sitios + 2 aserciones; centinela mudado | `d1f9a4d3` |
| **G** | prosa "vincular el expediente desde la cita" | ✅ **HECHO** — la rama se resuelve server-side | `d1f9a4d3` |

> **Verificación al cierre:** `pnpm gates` (los **5** — `gate:payload` se sumó desde que se
> escribió este plan) + `type-check` limpios · **2 corridas completas de 81 casos, 0 FAIL estables,
> conjuntos estables con intersección VACÍA** (bitácora #31b) · formas de query nuevas
> smoke-testeadas read-only contra prod. Prefijo `4a66a438…` → `32d19d6d…`, re-medido con
> `count_tokens`: **22,821 tok** (Haiku 4.5). **Todo en prod.**

**Por qué B se puede pushear solo y E no.** `gate:prompt` verificó que B deja el prefijo
**byte-idéntico** (`sha256 4a66a438…`): es cambio de PAYLOAD, no de prompt ⇒ no invalida el caché
del dueño y **no exige la corrida de evals**. E cambió una descripción de tool y la prosa ⇒ el
prefijo pasó a **`d03afced…`** y la corrida de **81 casos es obligatoria**. Por eso van en commits
separados.

### Lo que sigue, en orden
1. **F/D**, **C** (payload; no mueven el prefijo).
2. **A** y **G** (prosa).
3. `pnpm gates` + `pnpm type-check` + **suite completa 81 casos**, y **re-correr antes de
   concluir** — la misma configuración ha dado 64/63/58.
4. Pushear TODO junto (B ya está listo si se quiere adelantar).
5. Cierre: §6 de este plan + **re-medir el prefijo** (ver abajo).

### Tres cosas que salieron implementando, y que este plan no preveía

**1. `gate:prompt` EXIGE la frase que A quiere cambiar.**
`scripts/check-agent-prompt-identity.ts:290-294`:
```ts
'FULL prompt KEEPS the invoicing route (owner text untouched)',
STABLE_SYSTEM_PROMPT.includes('se emite desde la tabla de citas') &&
  ALL_TOOLS.some((t) => t.description?.includes('se emite desde la tabla de citas'))
```
⇒ **A no son dos sitios, son TRES + el gate:** `agenda.ts:62`, el `.replace()` de
`AGENDA_CITAS_RULES_SIN_FACTURACION`, **la descripción de un tool**, y esta aserción hay que
actualizarla o A falla los gates. Lo bueno: **A no se puede dejar a medias en silencio.**

**2. El número del prefijo quedó STALE.**
`../GENERAL AGENTES/02-CAPACIDADES-matriz-que-puede-y-que-no` §4 declara **"Prefijo estático:
27,151 tokens — MEDIDO EXACTO (2026-07-23)"**. E ya lo movió y A/G lo moverán más. **Re-medir con
`count_tokens` al cerrar; NO estimar** (`07-CONVENCIONES` §2 — un número no re-medido se marca
STALE-UNMEASURED). Importa: ese doc dice que el prefijo gobierna ~82% del costo de una pregunta
fría y 27.2k ya está cerca del umbral de 35-40k.

**3. Payload que crece.** El campo de E se expone vía `mapPatientFiscal`, así que aparece en
**tres** payloads. `get_pendientes_factura` barre MUCHOS pacientes ⇒ cada fila crece. Vigilarlo en
la medición del punto 2.

---

## 1. Lo que se rompió por nuestros cambios (REGRESIONES — no se dejan fuera)

### B · `get_booking_detail` devuelve el contacto de la CITA
**Dónde:** `tools.ts:485-487` — `email: b.patientEmail`, `telefono: b.patientPhone`.
**Qué pasó:** la divergencia nació con `97afcd14` (07-28: la UI empezó a resolver
cita→expediente). `1abd06c5` (07-29) **invirtió el orden** en los 6 sitios de la UI y el servidor
⇒ ahora el agente reporta la copia vieja de la cita mientras todo lo demás usa el expediente.
**Arreglo:**
```ts
email:    b.patient?.email?.trim()  || b.patientEmail?.trim()  || null,
telefono: b.patient?.phone?.trim() || b.patientPhone?.trim() || null,
whatsapp: b.patientWhatsapp ?? null,   // ← NO cambia
```
Requiere agregar `patient: { select: { email: true, phone: true } }` al select.

🚫 **NO implementar lo que dice la bitácora #30.** Esa fila especifica
`patientEmail ?? patient.email` — el orden VIEJO, el del servidor de entonces. Seguirla al pie de
la letra **reimplementa justo lo que `1abd06c5` quitó**. Las dos bitácoras ya están anotadas.
⚠️ **WhatsApp NO sigue la regla:** `Patient` no tiene esa columna, el número existe solo en la
cita. No es inconsistencia, es el esquema.

### E · El agente no ve el formulario fiscal PENDIENTE
**Dónde:** ningún tool lee `appointmentFormLink` con `templateId='FISCAL'`.
**Qué pasó — la regresión más nueva y la más clara nuestra:** antes de `eed733c2` la UI **tampoco**
lo veía (el estado vivía en un `useState` que el refresh borraba), así que agente y UI coincidían
por estar los dos ciegos. Ahora la UI muestra **"Esperando datos"** derivado del servidor y el
agente sigue ciego ⇒ preguntado *"¿qué falta para facturarle?"* le dice al doctor que mande el
formulario fiscal **que ya está mandado y esperando**.
**Arreglo:** exponer el pendiente en `get_billing_status` y/o `get_patient_profile`:
```ts
formularioFiscalPendiente: { where: { templateId: 'FISCAL', status: 'PENDING' }, take: 1 }
```
⚠️ **El filtro por `templateId` es OBLIGATORIO** — misma tabla que los formularios clínicos,
distinguidos solo por ese centinela. Olvidarlo es literalmente el bug **C**.
**Prosa:** donde hoy dice *"el camino es el formulario fiscal al paciente (desde la cita, botón
Facturación)"*, condicionarlo: si ya hay uno pendiente, **decir que existe** en vez de mandar a
crear otro.

### F/D · `factura_solicitada` es invisible para TODO el agente
**Dónde:** `grep facturaSolicitada apps/doctor/src/lib/agenda-agent/` → **cero resultados**.
**Qué pasó:** la columna nació con `71e4f390` (07-28). El agente estaba alineado por defecto
porque el campo no existía. Ahora el doctor marca **¿Necesita factura?** por cita y el agente no
puede leerlo ⇒ contradice una intención explícita.
**Arreglo:** dos sitios, no uno —
1. `get_pendientes_factura`: respetar la casilla (deuda §8.1 de FACTURAS).
2. `get_billing_status`: exponerla. Es EL tool de *"¿qué falta para facturar esta cita?"*; omitir
   la intención del doctor ahí es el hueco de fondo, no solo el del barrido.

> ⚠️ **ANOTACIÓN 2026-07-30 — "respetar la casilla" NO se implementó como filtro.** Medido
> read-only contra prod antes de tocar nada: de las **57** entradas del barrido, **las 57 tienen
> `factura_solicitada` en NULL** (la casilla nació el 07-28; 7 `true` / 3 `false` / 363 NULL en
> toda la tabla). Filtrar habría sido un **no-op exacto — 0 filas excluidas, 0 pacientes que
> cambian** — a cambio de forkear la cláusula que la **PARITY RULE** de `facturas.ts` mantiene
> byte-idéntica al veredicto `ingresosSinFactura` de `get_patient_profile` (el comentario dice
> *"To harden it, change the source verdict first, never just this sweep"*).
>
> Se implementó como **SEÑAL**: `citasMarcadasSinFactura` / `citasMarcadasParaFactura` por paciente,
> emitidas **solo si el doctor usó la casilla**, y el barrido sigue listando todo. Quitar filas que
> el doctor no pidió quitar es un **veredicto**; enseñarle lo que él marcó es un **hecho** — regla 0,
> precedente **C4** (omitir/relabelar, jamás recalcular). La intención por cita se expone además en
> `get_billing_status` (`necesitaFactura`), que es donde el plan la quería.
>
> ⚠️ **Y ahí es donde nació la única regresión de la pasada:** ese campo, rendido en las 10 citas
> del payload, movió el corte de 8KB. Ver bitácora **#31**.

### G · Prosa: "vincular el expediente desde la cita" (menor)
**Dónde:** `facturas.ts` ×3 (`:519`, `:1083`, `:1338`).
**Qué pasó:** `4eb117da` dejó la búsqueda de expediente **detrás de un enlace** en las citas de
*Primera vez*. La frase sigue siendo cierta (se puede crear, o abrir el enlace) pero es menos
directa de lo que suena.
**Arreglo:** matizar que en una cita de Primera vez el camino natural es **crear** el expediente
desde la cita.

---

## 2. Deudas VIEJAS que caben en la misma corrida (droppables)

Si la pasada se recorta, **esto es lo que sale** — no son regresiones, no las causamos.

### C · `formulariosPreConsulta` cuenta los formularios FISCALES
**Dónde:** `modules/expediente.ts:208-211` — el `groupBy` no filtra `templateId`.
**Arreglo:** una línea en el `where`: `templateId: { not: 'FISCAL' }`.
**Impacto medido:** 9 pacientes con el conteo inflado (medición de 07-29; en prod hay 4
FISCAL/PENDING + 5 FISCAL/SUBMITTED conviviendo con los clínicos en la misma tabla).

### A · La prosa del CFDI es INCOMPLETA (no falsa)
**Dónde:** `modules/agenda.ts:62`, dentro de `AGENDA_CITAS_RULES`.
> ⚠️ **CORRECCIÓN de este mismo plan (2026-07-29):** una versión anterior del análisis afirmó que
> esta prosa era **FALSA**. **No lo es.** `CompleteBookingModal` SÍ emite: casilla *"Emitir factura
> (CFDI)"* → *"Completar + Facturar"*, enchufado en `appointments/page.tsx:377` con
> `can("facturacion")` y `hasFiscalData`. Se anota en vez de borrarse porque es la MISMA trampa que
> ya documenta la bitácora #29 sobre este mismo código: **un análisis parcial miente igual que un
> doc viejo.**

Lo que sí falla: es cierta **solo** en el momento que describe (completar una cita cuyo paciente
ya tiene datos fiscales) y calla el camino principal. Si la cita **ya está completada**, o el
paciente **no tiene datos fiscales**, desde la tabla no se puede y el camino es el **expediente**.

**Texto propuesto:**
> *"la factura (CFDI) NO se emite aquí. Si la cita se completa desde la tabla y el paciente ya
> tiene datos fiscales, el doctor puede emitirla en ese mismo paso; si no, se emite desde el
> EXPEDIENTE del paciente, que es donde viven el estatus del CFDI y las descargas."*

⚠️ **Hay que cambiarlo en DOS lugares.** `AGENDA_CITAS_RULES_SIN_FACTURACION` se construye con un
`.replace()` de esa frase EXACTA (`agenda.ts:75-79`): si se edita el original y no el `replace`,
**el replace deja de encontrar nada y falla en silencio** — la variante sin facturación se queda
con el texto viejo. Verificarlo con un assert o comparando las dos cadenas.

---

## 3. Orden de ejecución

1. **B** — el que más contradice a la UI hoy (toda pregunta de contacto).
2. **E** — la regresión más nueva; evita que el agente pida reenviar un enlace vivo.
3. **F/D** — los dos sitios, no solo el barrido.
4. **C** — una línea.
5. **A + G** — solo prosa; al final para no mezclar cambios de datos con cambios de texto.

## 4. Lo que este plan NO hace

- **NO renombra `Cobro` ni `Facturación`.** Decisión explícita (2026-07-29): el prompt los nombra
  por su etiqueta actual y ambos botones siguen existiendo con ese nombre, así que **no hay
  regresión de prosa**. Se agrupa para una corrida futura.
- **NO enseña al agente los campos nuevos de nombre** (`patient_first_name/last_name`). El agente
  crea citas con `patientName` y el modal de expediente cae al split — sin contradicción, solo sin
  beneficio.
- **NO toca la UI.** Todo lo de este plan es del lado del agente.

## 5. Verificación

```bash
pnpm gates        # los 4 — gate:prosa incluido
pnpm type-check
# suite completa (81 casos)
```
- ⚠️ **Una corrida NO decide nada.** Misma configuración ha dado 64/63/58: hay que **re-correr
  antes de concluir**, incluidos los números buenos.
- `gate:prosa` **no cubre** ninguno de A ni G: razona por *scope* (¿existe la tool/sección para
  este usuario?), no por si un claim sobre DÓNDE vive un botón sigue siendo cierto. Ése es un eje
  nuevo, van cuatro sin cubrir por máquina (payload #28, estado #29, y éste).
- Fixture conocido: `f2b-receptor-incompleto` falla por **drift de fixture**, no por regresión.

## 6. Al cerrar

- Fila en la **bitácora** de [`SESSION-REFRESCO.md`](SESSION-REFRESCO.md) (fallo → causa → fix →
  commit) — y **cerrar la #30**, que queda pendiente solo por la línea de `mapBooking` (B).
- Tachar los §8.1/§8.2/§8.3 de
  [`../AGENTE FACTURAS/SESSION-REFRESCO.md`](../AGENTE%20FACTURAS/SESSION-REFRESCO.md), donde ya
  viven esas deudas — este plan las ejecuta, no las duplica.
- Banner de SNAPSHOT a este doc.
- Actualizar [`../../CITAS/README.md`](../../CITAS/README.md): el punto "🔻 Falta el AGENTE".
