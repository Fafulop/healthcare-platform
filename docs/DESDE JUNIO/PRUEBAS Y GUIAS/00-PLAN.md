# 00 — PLAN: probar Agenda + Expediente (y su dinero) de punta a punta, y escribir las guías

> **Tipo: PLAN.** 2026-10-02. Lo pidió el usuario con permiso completo para probar en producción
> (navegador, base de datos y logs). Estado vivo en `SESSION-REFRESCO.md`.

## 1. La meta, en tres preguntas

Para cada cosa que un doctor hace en **Agenda** y **Expediente**:

1. **¿Funciona?** — lo que el doctor ve y lo que de verdad queda guardado coinciden, sin errores.
2. **¿Hace lo que creemos?** — coincide con el manual y con los documentos de diseño. Si no, se
   corrige el que esté mal (el código o el doc), diciendo cuál y por qué.
3. **¿Lo puede hacer un doctor solo?** — cuántos pasos son, dónde se puede perder, qué etiqueta
   confunde. De aquí sale la guía paso a paso y, después, el video.

**Flujo de Dinero entra sólo en lo que toca a estas dos áreas:** que cada cobro que nace en la agenda
o en el expediente (completar una cita, link de pago, venta de una visita, cuenta de un tratamiento)
**aparezca en Flujo de Dinero una sola vez, con el monto, la forma de pago, el paciente y el concepto
correctos**. Las permutaciones propias de Flujo (egresos, conciliación, facturas recibidas…) NO entran
en esta pasada (`../flujo de dinero permutaciones/` es su lugar).

## 2. Alcance

| Bloque | Qué | Catálogo |
|---|---|---|
| **A — Agenda** | agendar (con rango, sin rango, calendario, el paciente desde el sitio), confirmar, completar, cobrar (efectivo / link), cancelar, no asistió, eliminar, reagendar, bloquear, rangos, vincular expediente, pre-consulta, nota de la cita, facturar (sin emitir) | `01` §A |
| **E — Expediente** | crear / importar / archivar paciente, perfil, visitas (de cita, sin cita), plantillas (fecha propia), recetas, documentos, notas, informe de aseguradora, ventas en la visita + nota de venta, facturar (sin emitir) | `01` §E |
| **T — Tratamientos** | crear con sesiones, agendar / después / reagendar, abrir visita, agregar sesión, completar una sesión (precio pre-llenado), cancelar sesión, la cuenta | `01` §T |
| **F — Dinero** | transversal: cada flujo que cobra verifica su movimiento en Flujo de Dinero (pantalla + BD), sin duplicados | `01` §F |
| **R — Roles** | el ayudante (usuario secundario) sin permiso de Flujo completa una cita: el ingreso SÍ se registra; lo que no debe ver, no lo ve | `01` §R |

**Fuera de esta pasada:** emitir CFDI reales al SAT, cobrar dinero real por link de pago, el asistente
de IA (tiene sus evals propios), Facturación / Compras / Conciliación como áreas.

## 3. Método — cada flujo se cierra con TRES evidencias

1. **Pantalla** (Chrome, sesión de dr-prueba en `doctor.tusalud.pro`): lo que el doctor ve, paso a paso.
   Se anota cada clic con la etiqueta exacta («…») — eso ES el borrador de la guía.
2. **Base de datos** (sólo lectura, `railway run --service pgvector node scripts/qa/verificar-flujo.cjs …`):
   lo que de verdad quedó — la cita, la visita, el movimiento de Flujo, la venta, la bitácora de auditoría.
   **La pantalla no es evidencia por sí sola**: un toast verde dice lo que el cliente CREE que pasó.
3. **Logs** (Railway, `@healthcare/api` y `@healthcare/doctor`, la ventana del flujo): errores o avisos
   que la pantalla no muestra (un correo que falló, un cobro que se saltó «falla abierto»).

Resultado por flujo: ✅ pasa · 🐞 bug (va a `03-HALLAZGOS`) · 📝 el doc miente (va a `03-HALLAZGOS`
y se corrige el doc) · 🤔 funciona pero confunde (UX, va a `03-HALLAZGOS` y a la guía).

Antes de la pantalla va una **pasada de escritorio** (fase 1): para cada flujo, leer el código y
escribir en el catálogo lo que DEBE pasar en la BD y en Flujo. Así la prueba compara contra algo, no
contra «se ve bien».

## 4. Reglas (heredadas de `../VISITAS/04-PRUEBAS` §1, más las de esta pasada)

- **Cuenta:** dr-prueba («Diego», Medicina Interna, doctorId `cmni1bov90000mk0lyeztr3ad`). Nada en
  cuentas de otros doctores.
- **Pacientes de prueba PROPIOS:** se crean con nombre `QA <flujo> …` (p. ej. «QA A6 Completar»), con
  **correo del usuario** (`quebradita.a@gmail.com`) y teléfono/WhatsApp **`0000000000`**. Nunca se usa un
  paciente real ni los 8 de cardiología sembrados para los clips (`scripts/demo-seed/`).
- **NO TOCAR:** el tratamiento «f» de pepit perez; citas reales de otros pacientes.
- **Dinero:** se completan citas con montos chicos y redondos ($100, $250) y forma de pago
  «Efectivo» o «Transferencia». **Nunca se paga un link de pago** (sólo se crea y se ve). **Nunca se
  emite un CFDI** (se llega hasta la pantalla de facturar y se verifica que el ingreso sea facturable).
- **Correos:** los que salgan van al correo del usuario. El recordatorio automático (1 h antes) está
  encendido en dr-prueba: citas de prueba a ≥ 2 h o en días futuros.
- **Limpieza:** al terminar un bloque, las citas de prueba quedan CANCELADAS (no borradas: la bitácora
  las cita) y los pacientes QA archivados. Los movimientos de Flujo de prueba se quedan y se listan en
  la bitácora (son de dr-prueba).
- **Código:** un bug se arregla con el método de siempre — plan → OK del usuario → código → review →
  OK de commit → push → `commitHash` por servicio → se re-corre el flujo. El permiso de esta pasada es
  para PROBAR; no cubre commits.
- **Navegador:** Claude Code y la extensión de Chrome en la MISMA cuenta de claude.ai (la del Chrome
  donde está dr-prueba). Campos de React: clic + teclear. Antes de un clic por coordenadas en una
  tabla, volver a medir (se reordena sola).

## 5. Fases

| Fase | Qué | Necesita Chrome | Entregable |
|---|---|---|---|
| **P0** | Preparar: carpeta, catálogo, verificador de BD, datos de prueba | no | esta carpeta + `scripts/qa/verificar-flujo.cjs` |
| **P1** | Pasada de escritorio: código vs manual, flujo por flujo; lo esperado en BD y en Flujo | no | catálogo con «debe quedar» + primeros hallazgos 📝 |
| **P2** | Correr en Chrome: A (agenda núcleo) → E (expediente núcleo) → T (tratamientos) → F/R | **sí** | bitácora + catálogo con ✅/🐞/📝/🤔 |
| **P3** | Arreglar: bugs (con OK) y docs (manual, diseño) | según | commits + catálogo re-corrido |
| **P4** | Guías: una por flujo en `GUIAS/`, revisadas por el usuario; se montan en la página «Flujos» (H3) | no | `GUIAS/*.md` → H3 |
| **P5** | Guiones de video cortos (H4), cuando todo esté pulido | no | guiones |

## 6. Formato de una guía (`GUIAS/`)

Español, para un doctor que nunca vio la app. Etiquetas «…» EXACTAS (se verifican con grep contra los
`.tsx`, método de deriva). Secciones: **Para qué** (1 línea) · **Antes de empezar** (lo que debe estar
configurado) · **Pasos** (numerados, un clic por paso) · **Qué vas a ver** · **Tu dinero** (qué entra a
Flujo de Dinero y cuándo) · **Si algo sale mal** · **Video** (pendiente). Cada guía sale de una corrida
✅ del catálogo — nunca de memoria.
