# 🔄 SESSION-REFRESCO — PRUEBAS Y GUÍAS

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión. Cabecera primero.

## ⏭️ 2026-10-04 (cierre) — 5 commits en prod, todos verificados. Empieza aquí

**Qué se arregló hoy (todo en prod y probado en prod con datos QA; detalle por día en `02-BITACORA.md`):**

| Commit | Hallazgos | Qué hace |
|---|---|---|
| `d65c9614` | H-010 parte 1 | Los webhooks de MP/Stripe NUNCA tiran un pago: si la cita ya tenía ingreso, el link estaba apagado o es un 2º pago del link ⇒ ingreso aparte con concepto «⚠️ Revisar…» + Telegram. Idempotencia por `ledger_entries.provider_payment_id` (columna nueva, migrada en prod con `add-ledger-provider-payment-id.sql`). |
| `b7eea955` | H-010 parte 2 | Completar (con cobro, o $0), cancelar, «No asistió» o eliminar APAGA el link vivo en Stripe (`active:false`) y en MP (se «expira» la preferencia — verificado que el checkout de MP la rechaza). «Completar cita» avisa antes. `lib/desactivar-link.ts`. |
| `7323a896` | H-054 | Reagendar MUEVE «¿Necesita factura?» a la cita nueva (mismo expediente, sin ingreso en la vieja). El link NO se mueve (se apaga al cancelar la vieja): el asistente cancela ANTES de crear. |
| `923b1014` | H-029, H-038 | Completar en **$0 = cortesía** (sin ingreso, link apagado; cita sin precio arranca vacía). Reserva pública dice «¡Solicitud enviada!» (nace PENDING). |
| `4c6dce72` | H-018, H-026, H-030, H-033, H-051 | Copy en español: toasts/errores de la cita, «Plantillas personalizadas» (+ acentos del constructor, sin cambiar las CLAVES de campo), galería y visor, casilla «Sí/No», sin «Dr. Dr.» (formularios públicos, SMS, PDF de receta). |

**Sin verificar en prod:** (1) un PAGO real a un link ya apagado / de una cita ya cobrada (MP no dejó
pagar el $10 de prueba — reintentar con el link `cmuu52bmh…`, cita QA E1 20-oct COMPLETADA: debe salir un
2º ingreso «⚠️ Revisar posible doble cobro…»); (2) el toast de cancelar en español (H-030; no había cita QA
cancelable sin tocar un tratamiento).

**Hallazgos nuevos de hoy (abiertos):** H-058 (el folio ING/EGR se atora en 1000 — orden de texto) ·
H-059 (una devolución/contracargo no toca Flujo) · H-060 (dos pagos simultáneos sin cita no se marcan) ·
H-061 (asistente/chat/reagendar no muestran el toast de «link apagado»; regla «link vivo» repetida) ·
**H-062** (reagendar una cita YA PAGADA ⇒ la nueva no se puede concluir sin 2º ingreso — **decidir**) ·
**H-063** (el asistente no completa en $0; la cortesía no queda marcada — **decidir**).

**2026-10-05:** H-024 en prod `2466a2b2` y verificado (una visita sólo puede ser seguimiento de una del mismo día o anterior). Datos QA nuevos: tratamiento «Seguimiento del 21 oct» `cmuvf7q9h…` (sesiones 21-oct y 22-oct; visita nueva `cmuvf7q82…`).
**Decisiones 2026-10-05:** H-062 → por ahora sólo doc (completar la nueva en $0; manual + A10), arreglo de fondo después · H-063 → ESTACIONADO (el asistente de IA no se usará en un buen tiempo).
**2026-10-05 también:** `e2c19214` — H-058 (folios pasan de 999: máximo NUMÉRICO del sufijo) y H-001/H-036 («Forma de pago» en ventas), verificados en prod (venta QA VTA-2026-012, ING-2026-400 efectivo).
**2026-10-05, BLOQUE DE IDENTIDAD en PDFs clínicos (pedido del usuario; sin commit al escribir esto):** todo PDF clínico lleva SIEMPRE nombre del médico · cédula(s) profesional(es) · fecha del documento — en la banda del encabezado (fecha abajo a la izquierda) o, sin encabezado, en un renglón al inicio (con el pie puesto, ese renglón lleva sólo la fecha). El PDF de la consulta/plantilla pasó a la hoja compartida (diseño de la receta) con SUS ajustes, se abre en vista previa, pagina textos largos (antes la banda del pie los tapaba). Arregla H-048; H-022 («Fecha de Consulta» en plantillas personalizadas). Nuevo H-064 (receta en hoja angosta: título y nombre largo se enciman — existía antes). Queda: el PDF «Historial clínico» de la Línea de Tiempo con su diseño viejo.
**Siguiente sugerido:** H-050 (fechas crudas en la Línea de Tiempo) · H-064 · H-041 (desarchivar) · resto en `03-HALLAZGOS.md`.

**Reglas de esta pasada que cambiaron hoy:** los links de pago SÍ se pueden pagar con montos mínimos
(mínimo de la app $10; `00-PLAN` §4). Cada arreglo: plan → OK → código → type-check → code review (y otra
pasada sobre los arreglos del review) → OK de commit → push → `commitHash` por servicio → prueba en prod.

**Datos QA de hoy (dr-prueba, paciente QA E1 Recurrente):** citas 20-oct y 21-oct COMPLETADAS ($10 c/u:
ING-2026-398/399) · 22-oct CANCELADA (reagendada) → 23-oct COMPLETADA en $0 (cortesía, factura Sí) ·
14-oct sigue CONFIRMADA (sesión 2 de «QA T Rehabilitacion») con un enlace pre-cita PENDING `8412b930…` ·
links MP $10 `cmuu52bmh…` (PENDING, vivo — para la prueba de pago) y `cmuu6drk1…` (CANCELLED) · el link QA
`cmusqlk6n…` ($900) está expirado en MP pero en NUESTRA BD sigue PENDING · reserva pública «QA H038
Publico» 13-oct CANCELADA.

**Chrome:** la sesión de dr-prueba está en el Chrome conectado; los clics por `ref` a veces no llegan —
usar coordenadas tras esperar a que cargue la página.

---

## 2026-10-04 — H-010/H-054 (historial de la sesión, ya resumido arriba)

**Plan aprobado (3 commits, en orden):** **1** red de seguridad en los webhooks (un pago NUNCA se tira:
si la cita ya tenía ingreso / el link estaba desactivado / es 2º pago del link ⇒ se registra aparte con
«⚠️ Revisar…» + Telegram) · **2** apagar el link al completar/cancelar/no-asistió (Stripe API + MP
expirar la preferencia; probar el expirar en el link QA MP `cmusqlk6n…`, autorizado) · **3** reagendar
MUEVE el link PENDING y «¿Necesita factura?» a la cita nueva (decisión del usuario).

**Estado parte 1:** código escrito (`practice-utils.ts` `createPaymentLedgerEntry`, webhooks MP y Stripe),
**columna `ledger_entries.provider_payment_id` YA MIGRADA EN PROD** (`add-ledger-provider-payment-id.sql`,
validada antes en transacción que revienta), type-check ✅, 3 code reviews atendidos (lo no arreglado →
H-058/H-059/H-060). **EN PROD `d65c9614`** (api SUCCESS 2026-10-04). **Prueba REAL pendiente:** el
caso está montado — cita QA E1 20-oct 11:00 `cmuu51cmc0001lb0tu8fyf9ff` COMPLETADA en efectivo $10
(ING-2026-398) + link MP $10 `cmuu52bmh0005lb0t4xwfahit` PENDING activo — pero el usuario **no pudo
pagarlo por un problema del lado de Mercado Pago** (no nuestro). Cuando se pueda pagar: debe salir un 2º
ingreso de $10 «⚠️ Revisar posible doble cobro…» con `provider_payment_id = mp:<id>`, link PAID, logs
`REVISAR: cita_ya_cobrada`. (Mínimo de la app: $10; el usuario autorizó pagar montos mínimos; sólo MP.)

**Parte 3 ACOTADA (decisión del usuario tras el review, 2026-10-04):** reagendar sólo MUEVE «¿Necesita
factura?» (mismo expediente, la vieja sin ingreso; `facturaAlReagendar` en `lib/reagendar-sesion.ts`); el
link pendiente NO se mueve (el asistente cancela ANTES de crear; moverlo podía dejarlo en otro paciente) —
se apaga al cancelar la vieja. Un «reagendar» de servidor en una sola petición queda como tarea aparte
si se quiere. Nuevo hallazgo H-062 (reagendar una cita ya pagada ⇒ la nueva no se puede concluir sin 2º
ingreso). Prueba pendiente tras el deploy: cita QA con «¿Necesita factura?» = Sí → Reagendar → la nueva
trae Sí y la vieja queda vacía.

**Parte 2 EN PROD `b7eea955` y verificada (ver H-010). Antes era:** **Parte 2 escrita (sin commit, 2026-10-04):** `apps/api/src/lib/desactivar-link.ts` + PATCH/DELETE de la cita
+ «Desactivar» de «Pagos» (Stripe y MP) + aviso en «Completar cita» + toasts + manual + guías A8/A10. El
«expirar» de MP se probó en el link QA `cmusqlk6n…` (MP ya lo rechaza; en NUESTRA BD sigue PENDING — se
limpia con la parte 2 en prod). 3 code reviews; lo aceptado → H-061. Falta OK de commit → push → api +
doctor (`commitHash` de los dos) → probar en prod: completar en efectivo una cita con link ⇒ link
CANCELLED en BD y MP lo rechaza.

**Sin commitear además:** trabajo BBVA de informe médico (otra sesión — NO va en estos commits).

---

## 2026-10-03 — P2 HECHA CASI ENTERA (Citas + Expediente). Empieza aquí

**Qué pasó:** Chrome conectado (cuenta quebradita.a). Se corrieron ~60 permutaciones de Citas y
Expediente, cada una con pantalla + BD (+ logs cuando aplicó). Estado por permutación en
**`04-MATRIZ-permutaciones.md`**; hallazgos **H-012…H-054** en `03-HALLAZGOS.md`.

**Lo más grave (para decidir/arreglar primero):**
1. **H-027** 🔴 el PDF de la receta imprime el DÍA ANTERIOR (`lib/receta-pdf.ts:54`, medianoche UTC).
2. **H-025** 🔴 campo «Archivo» de plantilla personalizada: el archivo se pierde (`{}`).
3. **H-010 / H-054** 💰 completar o reagendar deja el link de pago ACTIVO en la cita vieja.
4. **H-024** la visita «seguimiento» crea tratamiento y absorbe la visita de la cita.
5. **H-041** no hay forma de desarchivar · **H-029** no se puede completar en $0 · **H-038** la
   reserva pública dice «Confirmada» y nace PENDING.
6. Mucho copy en inglés (H-018, H-030, H-051) y vocabulario cruzado plantilla/consulta (H-021, H-046).

**Hecho después (misma fecha):** C15 ✅, bloque **T completo** (T1 T6 T7 T8 T9 + reactivar/ligar), comparación con el manual (notas «**Manual:**» en 03-HALLAZGOS), **27 guías borrador en `GUIAS/`** (pasos con etiquetas exactas + bloque QA interno con ⚠️). R ⏭️ saltado (requiere entrar como el ayudante real).

**Arreglos en prod (2026-10-03):** **H-027** `969f9ead` (fecha del PDF de receta) y **H-025** `a4248843` (campo «Archivo» retirado; `lib/campo-archivo.ts`) — ambos verificados en prod. H-025 dejó 1 archivo real perdido (dr-david-salazar-vela, 30-abr) — el usuario decide si avisarle.

**Siguiente:** plan de **H-010 / H-054** (link de pago sigue activo al completar / reagendar; reagendar pierde «¿Necesita factura?») → OK del usuario → código → review → OK de commit. Es dinero: plan cuidadoso. Sin commitear: la actualización de H-025 en `03-HALLAZGOS.md` y este archivo (van en el siguiente commit).

**Chrome:** la extensión conecta con la cuenta lopez.fafutis; si hay 2 navegadores, usar `switch_browser` y el usuario da «Connect» en el abierto («lopez asistente»).

**Pendiente:**
- Limpieza de datos QA (ver abajo) — preguntar al usuario si se quedan para las guías.
- Guías paso a paso (`GUIAS/`) desde lo ✅ de la matriz.
- **Nada está commiteado**: `scripts/qa/verificar-citas.cjs`, `scripts/qa/verificar-plantillas.cjs`,
  `04-MATRIZ-permutaciones.md` y las ediciones de `03-HALLAZGOS.md`. Pedir OK antes.

**Datos QA vivos en dr-prueba:** pacientes «QA E1 Recurrente» (activo), «QA C4 Calendario»
(ARCHIVADO); citas «QA …» (A2 borrada, C4, C11 borrada, C12 cancelada, C15, C26→reagendada como
QA E1 14-oct); plantillas «QA Plantilla 1/2»; rango 13-oct Satélite; links sin pagar MP
`cmusqlk6n000lmh0tywrr8ly2` y Stripe `cmussw4ld0029mh0tov7ntnrj` (ya se pueden pagar con montos mínimos — decisión 2026-10-04, `00-PLAN` §4); ingresos
#1822–#1826; venta VTA-2026-010; receta cancelada. «Campos de Cita» y bloqueos quedaron como estaban.

**Verificadores (sólo lectura):** `railway run --service pgvector node scripts/qa/verificar-citas.cjs "<nombre>" [min]`
(ve citas sin expediente) · `verificar-flujo.cjs` (por expediente) · `verificar-plantillas.cjs "<nombre>"`.
Clics: en esta app los clics por `ref` a veces no llegan — usar coordenadas y verificar en BD.

---

## En una frase

**2026-10-02 — P0 HECHA, P1 empezada, P2 BLOQUEADA por el navegador.** Carpeta, plan, catálogo (A1–A17,
E1–E13, T1–T9, R1–R2, reglas F de dinero leídas del código), hallazgos (H-001…H-009) y el verificador
de BD `scripts/qa/verificar-flujo.cjs` (probado en prod). Falta que Chrome se conecte para correr P2.
P1 ya dio el primer hallazgo serio: **H-010** (completar en efectivo no apaga el link de pago; si el
paciente lo paga después, Flujo no lo registra) — PLAUSIBLE, se confirma en P2 sin pagar nada.

## ⏭️ Siguiente — empieza aquí

1. **Desbloquear Chrome** (lo hace el usuario): la extensión exige que Claude Code y Chrome estén en la
   MISMA cuenta de claude.ai. El Chrome con la sesión de dr-prueba es el de **quebradita.a**; si Claude
   Code está en otra cuenta, `/login` con quebradita.a (o loguear la extensión en la cuenta de Claude
   Code — pero ese Chrome no tiene dr-prueba). Luego reiniciar Chrome si hace falta.
2. **P1 — pasada de escritorio** (no necesita Chrome): llenar los ⟨P1⟩ del catálogo desde el código
   (A1 correos/GCal, A4, A5, A8 link al completar, A9 eliminar, A12, A14, A15, A17, E5, E7, E8, E10–E12)
   y comparar cada uno con su sección del manual → 📝 en hallazgos.
3. **P2 — orden de corrida:** A1 → A6 → A7 → A9 → A10 → A13 (núcleo de agenda, con un paciente
   «QA A…» nuevo) · E1 → E3 → E4 → E5 → E9 (expediente núcleo) · T1 → T6 → T8 → T9 · R1. Cada flujo:
   pantalla (etiquetas exactas) + `verificar-flujo.cjs` + logs → bitácora → estado en el catálogo.
4. Por cada ✅: borrador de guía en `GUIAS/` (plantilla en `GUIAS/README.md`).

## Cómo verificar en la BD

```bash
railway run --service pgvector node scripts/qa/verificar-flujo.cjs <patientId | "QA A6"> [minutos]
```

Imprime citas (con su ingreso, visita y sesión), visitas (con conteos), ventas (con su ingreso),
movimientos de Flujo del paciente (avisa DUPLICADOS), tratamientos y la bitácora de los últimos N
minutos (★ = nuevo en la ventana).

## Decisiones del usuario (2026-10-02)

- Permiso COMPLETO para probar en prod (navegador, BD, logs) en Agenda, Expediente y su efecto en Flujo
  de Dinero. Flujo de Dinero sólo en lo que toca a esas áreas (que los ingresos se detecten), no sus
  permutaciones propias.
- Meta: saber si hay bugs, si hace lo que creemos, si los docs están al día (y corregirlos), y escribir
  las guías paso a paso — el soporte será guías + widget + videos, sin humanos. «Make it or break it».
- V5 (PDF resumen del tratamiento) espera hasta después de esta pasada.
