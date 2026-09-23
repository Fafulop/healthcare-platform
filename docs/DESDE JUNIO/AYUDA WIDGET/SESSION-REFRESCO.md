# 🔄 SESSION-REFRESCO — AYUDA WIDGET

> **Tipo: ESTADO.** Se lee primero y se escribe al final de cada sesión.

## En una frase

**2026-09-20 — sesión de DISEÑO. No hay código.** Quedó escrito qué se va a construir, por qué
no lleva RAG, por qué es un asistente aparte del Agente, y el plan por fases.

**2026-09-22 — Fase 0 HECHA** ([`03-AUDITORIA-guias`](03-AUDITORIA-guias.md)): la guía de Citas
está mayormente obsoleta (escrita en abril, nunca actualizada); Expedientes y Pagos, con parches.
Sigue la Fase 1 — y con esto confirmado, el manual de Agenda **se escribe desde el código, no
desde la guía**.

---

## 2026-09-20 — de dónde salió esto

Venía de una conversación sobre cómo dar soporte con planes baratos. La cadena fue:

1. **El problema real:** sin dinero para soporte humano, la ayuda tiene que escalar sola.
2. **Primer instinto: videos por funcionalidad, con narración TTS.** Se frenó al notar que el
   menú del doctor cambió **cuatro veces ese mismo día**: un video no se puede grepear ni
   diffear, y uno viejo enseña un camino falso justo cuando el doctor ya está perdido.
3. **Se propuso un asistente de docs** sobre la infraestructura RAG que ya existe
   (`llm_docs_chunks`).
4. **El usuario empujó de vuelta** — «estás asumiendo que el enfoque que ya tenemos es el
   correcto». Tenía razón: era inercia, no análisis.
5. **Se midió el corpus y la respuesta cambió.** ~1,630 palabras en las guías actuales ⇒
   ~15,000 tokens para todo el menú. Cabe entero en un prompt. **RAG es maquinaria para un
   corpus 10× más grande del que hay.**

> 📌 **La lección de esa cadena, que vale más que la decisión:** el corpus se midió ANTES de
> elegir arquitectura. Si no se mide, se elige por costumbre.

---

## Decisiones tomadas (detalle en `00-POR-QUE` §7)

- **Manual entero en el prompt**, no RAG. `llm_docs_chunks` se queda donde está, para el
  corpus de DESARROLLO, que sí es grande.
- **Asistente separado del Agente.** Cero tools, cero BD, cero escrituras.
- **Texto y widget primero; el video se pospone** hasta poder grabarlo guionado.
- **Modelo intercambiable por variable de entorno**, con dos implementaciones desde el día uno
  para poder comparar.

---

## Pendiente de decidir (bloquea la fase 2)

1. ¿Qué modelo primero? (recomendado: el barato, y medir si alcanza)
2. ¿El widget en todas las pantallas, o sólo en las documentadas?
3. ¿Una cuenta **congelada** puede usarlo? Hay que meterlo a `RUTAS_DE_CUENTA_CONGELADA`
   a propósito; el default es que quede bloqueada.
4. **¿Quién escribe el manual?** La grande. Días de código contra semanas de escritura.

---

## Bitácora

### 2026-09-22 — Fase 0 hecha: la auditoría de las guías

Detalle completo en [`03-AUDITORIA-guias`](03-AUDITORIA-guias.md). Lo esencial:

- **`CitasGuide` está mayormente obsoleta** — no por las mudanzas del 09-20, sino porque se
  escribió el **2026-04-08** y cinco meses de agenda (calendario nuevo, agendar sin rango,
  Cobro/Factura, botones de confirmación) pasaron sin tocarla. Botones que cita y **no existen**:
  «Correo», «Enviar Meet», «Reenviar Meet», «Todas», «Aplicar», «Nuevo horario».
- **`ExpedientesGuide` está casi al día** — parches: el botón «Formularios» ya no existe en la
  lista, y **Chat IA / Voz están bloqueados en FREE/BASICO** sin que la guía lo diga.
- **`PagosGuide` es correcta pero no vive en `/ayuda`** (es la pestaña «Guía» de Pagos) y no
  enseña el camino más común: el link de pago desde la cita.

> ⚠️ **Corrección a `02-PLAN` §Fase 0:** decía que la lista «puede ser corta» porque el `grep`
> no encontró «Editar Perfil» ni «Integraciones». **Salió larga, y ese grep era la prueba
> equivocada**: buscaba los nombres que uno sospechaba, no los rótulos que la guía cita. La
> prueba que sí habría servido: que cada rótulo citado exista como texto en algún `.tsx`.

**Dos cosas nuevas que decidir** (se suman a las 4 de arriba):

5. **¿El widget sabe el plan del doctor?** `01-ARQUITECTURA` §6 dice que la ruta es la ÚNICA
   señal de contexto. Pero si no sabe el plan, contesta con seguridad cómo usar Chat IA a quien
   lo tiene bloqueado.
6. **¿Se arreglan las guías JSX ahora, o se congelan y el esfuerzo va al manual?** Arreglar
   `CitasGuide` es reescribirla; hacerlo dos veces (JSX y manual) es exactamente la divergencia
   que `02-PLAN` §Fase 5 quiere evitar.
