# 🔄 SESSION-REFRESCO — PRUEBAS Y GUÍAS

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión. Cabecera primero.

## ⏭️ 2026-10-04 — H-010/H-054 en curso (dinero). Empieza aquí

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

**Parte 2 escrita (sin commit, 2026-10-04):** `apps/api/src/lib/desactivar-link.ts` + PATCH/DELETE de la cita
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
