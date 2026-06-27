# Flujo de Dinero — Permutaciones (DESDE JUNIO)

> **Punto de entrada en frío.** Si eres una sesión/LLM sin contexto, lee este README primero, luego
> [`00-modelo-consolidado.md`](00-modelo-consolidado.md), luego
> [`01-permutaciones-de-prueba.md`](01-permutaciones-de-prueba.md). Con eso entiendes el sistema y
> cómo se está validando.

---

## Objetivo actual (qué estamos haciendo)

Estamos **re-entendiendo y validando** el núcleo de *Flujo de Dinero*: lograr **una sola fuente de
verdad** para todos los ingresos y egresos del doctor, agregando automáticamente las tres "puertas"
por las que entra el dinero (operación/cita, factura del SAT, banco) **sin duplicar** el mismo hecho
económico.

Plan de trabajo concreto a esta fecha:
1. Documentar el modelo real **verificado contra el código** (no aspiracional). → `00`.
2. Listar **todas las permutaciones** de ingreso/egreso como checklist para probarlas una por una en
   la UI. → `01`.
3. **Probar como doctor nuevo** en producción (Railway): borrar el ledger, **conservar las
   facturas**, y reconstruir (citas → backfill SAT → estado de cuenta) para confirmar correctitud y
   exponer gaps. → procedimiento de reset en `00` §9.
4. **Prioridad #1 detectada:** el sistema hoy confunde "existe factura" con "el dinero se movió"
   (caso PPD). Ver `00` §3 y §8.

## Contexto de producto (stack)

- **Qué es:** plataforma SaaS de salud para **doctores en México**. Maneja citas, expediente,
  facturación CFDI (SAT) y finanzas del consultorio.
- **Monorepo Next.js** con apps separadas:
  - `apps/doctor` — frontend del doctor (UI de Flujo de Dinero, Conciliación Bancaria).
  - `apps/api` — backend/API (motores de match, endpoints SAT y ledger).
  - `packages/database` — Prisma schema (`prisma/schema.prisma`), esquemas `public` y
    `practice_management`.
- **Despliegue:** solo **Railway** (producción). **No hay base de datos ni código local**; los
  cambios y pruebas se hacen contra lo desplegado. El SQL de reset se corre contra el Postgres de
  Railway.
- **Conceptos fiscales MX:** CFDI = factura electrónica del SAT. **PUE** = pago en una exhibición
  (ya pagado, ~90%). **PPD** = pago diferido/parcialidades (se paga después, vía complemento de pago
  tipo P). RFC = identificador fiscal de la contraparte.

## Las piezas (modelo en una frase)

Una sola tabla `LedgerEntry` es la verdad. Cada entry persigue **dos evidencias** independientes:
🧾 **fiscal** (CFDI vinculado) y 🏦 **bancaria** (línea de banco conciliada). El dinero entra por
**tres puertas** (`origin`) y tres mecanismos de **dedup** evitan duplicarlo. Detalle completo en
`00`.

---

## Orden de lectura

| # | Archivo | Qué es |
|---|---|---|
| 1 | **`README.md`** (este) | Objetivo, contexto, índice. |
| 2 | [`00-modelo-consolidado.md`](00-modelo-consolidado.md) | **Fuente de verdad actual.** Modelo, motores (con rutas+líneas de código), gaps, y procedimiento de reset/pruebas. |
| 3 | [`01-permutaciones-de-prueba.md`](01-permutaciones-de-prueba.md) | Checklist exhaustivo de permutaciones de ingreso/egreso para probar en la UI. |
| 4 | [`02-registro-facturas-y-match-determinista.md`](02-registro-facturas-y-match-determinista.md) | Registro de facturas (auto vs manual), su relación con el reset de pruebas, y el **plan parqueado** del match determinista por UUID (con gaps y decisiones). **Nada construido.** |
| 5 | [`03-arquitectura-anclas-y-reglas.md`](03-arquitectura-anclas-y-reglas.md) | **Diseño/blueprint** (sin código): modelo de anclas, reglas de UI/UX para que todo nazca enlazado, captura fiscal temprana, vista expediente, tabla actual vs. propuesto. |
| — | [`TOOLING-acceso-railway-db.md`](TOOLING-acceso-railway-db.md) | **Referencia de herramienta:** cómo conectarse a la BD de producción (Railway) en solo lectura para verificar datos reales (URL interna vs. pública, `railway run --service pgvector`). |

## Relación con otras carpetas (canonicidad)

Hay tres carpetas sobre este mismo tema. **Esta (`DESDE JUNIO/`) es la canónica y más reciente**,
verificada contra el código. Las otras dos son **antecedente/background**:

- `docs/TODO FACTURAS/flujo permutations/` — mapa por motor (español, detallado). Origen de gran
  parte de `00`.
- `docs/PERMUTATIONS/` — lifecycle y arquitectura (inglés), incluye el **plan** de rediseño PPD.

Si hay conflicto, **gana `DESDE JUNIO/00`**.

## Caveat importante para una sesión en frío

`00` cita **rutas de archivo y números de línea** del código (p.ej. `sat-auto-register.ts:388`).
Los números **se desfasan** cuando el código cambia. Trátalos como punto de partida y **verifica
contra el código actual** antes de afirmar o modificar. Todo fue verificado a **junio 2026**.

---

*Estado:* índice creado junio 2026.
</content>
