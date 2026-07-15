# 🔬 Diagnóstico — ¿el agente YA es experto en appointments? (evidencia)

> **Qué es este doc.** El resultado de sondear al agente VIVO (read-only, dr-prueba) con 12
> preguntas de appointments para medir empíricamente dónde YA es experto vs dónde improvisa vs
> dónde declina — antes de autorar nada. Corrido 2026-07-14. Confirma el modelo de 2 dimensiones
> (`01`) y la recomendación de híbrido-por-tipo (`03` §5) contra la realidad.

---

## 1. Headline

De 12 sondas: **9 ya bien manejadas, la frontera estado→tools se sostuvo perfecta, y el hueco real
es angosto — navegación de UI, donde el comportamiento hoy es inconsistente** (a veces declina, una
vez improvisó). El diagnóstico VALIDA fuertemente la recomendación de dividir por tipo.

## 2. Las cubetas

| Cubeta | Conteo | Sondas |
|---|---|---|
| **Ya experto** | 9/12 | 3 concepto/flujo · 2 estado · 1 mixta · 2 edge-declina · 1 overview de sección |
| **Improvisó (sin anclar)** | 1/12 | `crear-horario paso a paso en la app` |
| **Declina honesto + ofrece actuar** | 2/12 | `dónde hago click para reagendar` · `qué botón para bloquear` |

## 3. Los 4 hallazgos que importan

1. **La capa concepto/flujo YA es experta — "hablar" validado.** Las 3 preguntas de concepto se
   respondieron perfecto desde el modelo de dominio del prompt, sin tools, sin alucinación:
   reagendar = una acción atómica que notifica dos veces y no toca estados finales; borrar rango
   no afecta citas; cancelada es final. **Cero reconstrucción aquí.**

2. **La frontera estado→tools (preocupación #1) YA se sostiene en appointments.** "¿Cuántas citas
   esta semana?" y "¿tengo vencidas?" ambas llamaron `get_bookings` y respondieron desde datos.
   Ninguna fabricó un número desde prosa. La frontera que más nos preocupaba ya se respeta en el
   dominio más desarrollado. Señal positiva grande.

3. **El hueco de navegación de UI es real y, revelador, INCONSISTENTE.** Dos preguntas de UI se
   declinaron honesto ("no tengo información sobre la interfaz visual… no puedo guiarte con
   precisión") — y hasta SABE por qué ("mis guías cubren facturación, pagos y SAT Descarga"). Pero
   una ("paso a paso **en la app**") lo tentó a **improvisar un click-path**: "Ve a la sección de
   Agenda/Disponibilidad → botón para agregar rango → guardar." Ese path es plausible pero SIN
   ANCLAR — el modelo adivina. La inconsistencia ES el hallazgo: sin guardarraíl y sin guía a la
   cual apuntar, el comportamiento es suerte-de-prompt. Justo el riesgo de alucinación que se temía.

4. **El destino "rutear" para appointments YA EXISTE — el agente solo no lo ve.** `CitasGuide.tsx`
   (1,141 líneas) está vivo en `/dashboard/ayuda`, y el prompt del agente nunca lo menciona
   (verificado: cero referencias a `/dashboard/ayuda` en `lib/agenda-agent/`). El fix del hueco es
   inusualmente barato: la guía determinista ya está construida; el agente necesita (a) saber que
   existe para rutear ahí, y (b) un guardarraíl para nunca improvisar pasos de UI.

## 4. Transcripción resumida (para trazabilidad)

| Sonda | Cat | Tools | Resultado |
|---|---|---|---|
| `concept-reagendar` | CONCEPT | — | ✅ flujo completo (una acción, notifica ×2, estados finales) |
| `concept-cita-cancelada` | CONCEPT | — | ✅ no, estado final; crear nueva |
| `concept-borrar-rango` | CONCEPT | — | ✅ nada, independientes; protección rechaza borrado |
| `ui-donde-reagendar` | UI-NAV | — | ✅ declina honesto + ofrece actuar |
| `ui-crear-horario-pasos` | UI-NAV | — | ⚠️ **improvisó** "Opción 2: en la app" con pasos sin anclar |
| `ui-boton-bloquear` | UI-NAV | — | ✅ declina honesto (cita su cobertura de guías) |
| `state-citas-semana` | STATE | get_bookings | ✅ tool, desde datos |
| `state-vencidas` | STATE | get_bookings | ✅ tool, desde datos |
| `mixed-cancelar-proxima` | MIXED | get_bookings ×2 | ✅ ubica + desambigua + explica finalidad |
| `edge-filtrar-consultorio` | EDGE | — | ✅ declina correcto (dato no existe) + alternativas |
| `edge-exportar-excel` | EDGE | — | ✅ honesto, no inventa función |
| `section-que-puedo` | SECTION | — | ✅ overview preciso de capacidades reales |

## 5. Qué implica para el build

El plan concreto vive en [`05-PLAN-appointments-PR.md`](05-PLAN-appointments-PR.md). En una línea:
la capa de conocimiento de appointments es **casi no-op del lado "hablar"** (concepto ya en el
prompt) y **una adición chica y de bajo riesgo del lado "rutear"** (guardarraíl anti-improvisar +
puntero a la guía que ya existe + 2-3 evals). Sin corpus nuevo.

---

*Relacionado: [`03-INVESTIGACION-y-enfoque.md`](03-INVESTIGACION-y-enfoque.md) (la recomendación que
esto valida) · [`05-PLAN-appointments-PR.md`](05-PLAN-appointments-PR.md) (el PR) ·
[`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) (la frontera que se
sostuvo). Creado 2026-07-14.*
