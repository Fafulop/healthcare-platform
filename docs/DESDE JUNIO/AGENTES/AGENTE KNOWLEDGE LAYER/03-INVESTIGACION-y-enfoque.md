# 🔬 Investigación de industria + el enfoque propuesto

> **Qué es este doc.** Qué hacen los líderes (Salesforce Agentforce, Microsoft Copilot, Intercom
> Fin, GitHub Copilot) para sistemas del mismo tipo, cómo respalda o corrige nuestro diseño, y el
> enfoque que se recomienda — incluida la única bifurcación de arquitectura que falta decidir.
> Investigado con búsquedas web 2026-07-14 (fuentes al final).

---

## 1. El patrón al que TODOS convergieron

Para asistentes in-product que a la vez CONOCEN el producto y ACTÚAN sobre tus datos, la forma
compartida es:

1. **UN orquestador, muchas tools/skills — no un enjambre de bots.** Copilot y Agentforce son un
   LLM planificador único que elige de un registro de acciones. = nuestra decisión "un AGENTE, un
   chat, punto de contacto único".

2. **Acciones y Conocimiento son subsistemas separados.** Agentforce es el espejo más limpio: un
   agente se arma de **Topics** (dominios, "departamentos especializados con fronteras definidas")
   que agrupan **Actions** (tools tipadas, con permisos: cualquier Read/Create/Update/Delete) y
   **grounding** (conocimiento). = nuestro registro de módulos (tools + modelo de dominio por
   dominio), casi uno-a-uno.

3. **Las acciones tienen permisos y las escrituras se confirman / se validan server-side.** = tier
   propose→confirm + regla 0.

4. **El conocimiento se ancla en contenido autorizado, se responde SOLO desde él, y "no sé" es una
   salida de primera clase.** Intercom Fin es el ejemplo canónico anti-alucinación: recupera de
   contenido aprobado, cita la fuente, declina cuando no está cubierto. = nuestra disciplina de
   contenido curado + declinar honesto (`02` §3-4).

5. **El contexto se acota a lo que el usuario está haciendo, no se vuelca el producto entero.**
   GitHub Copilot inyecta el archivo/repo actual; 365 Copilot ancla la porción relevante del Graph
   por consulta. Nadie mete el producto entero al prompt. = "nunca prompt-inyectar el corpus" +
   la dirección screen-aware (contexto de pantalla al modelo).

### La doctrina que vale robar de Agentforce: "control vs comportamiento"

Agentforce separa explícitamente:
- **Control** (secuencias obligatorias, cálculos, reglas de negocio sensibles) → código
  determinista (Flows / Agentforce Script).
- **Comportamiento** (tono, persona, patrones de conversación) → Instructions (prompt).

Es nuestra **regla 0** enunciada como principio de diseño: los veredictos y la matemática de dinero
son server-side; el prompt solo moldea CÓMO habla. Llegamos ahí solos; ellos lo hicieron doctrina.

## 2. Dónde divergimos (y por qué está bien): RAG

Lo único que los líderes hacen y nosotros descartamos es **retrieval (RAG) sobre la base de
conocimiento.** Fin, Notion, Copilot recuperan. Pero es porque sus corpus son **masivos y
heterogéneos** (centros de ayuda enteros, workspaces completos) donde curar es imposible —
retrieval es la única opción, y pagan su modo de fallo (chunk equivocado con confianza) con
citas + declinar.

Los hallazgos de grounding 2026 matizan esto de forma que nos favorece:
- RAG reduce alucinación **71–90% para corpus grandes** — por eso los grandes lo usan.
- PERO "retrieval grounding reduce la fabricación, no la elimina: el modelo aún puede malleer,
  mezclar o exagerar una fuente recuperada; **los números, saldos, tasas y elegibilidad deben venir
  de llamadas a la API, no del texto que el modelo escribió**". → exactamente nuestra frontera
  estado→tools (`02`).
- El beneficio real del grounding es **restringir la respuesta a fuentes curadas autoritativas** —
  no el retrieval en sí.

**Conclusión:** el grounding (anclar en contenido curado y verificado) es esencial y NO negociable.
El *retrieval* es UNA implementación de grounding, apropiada a corpus grande. Nuestro corpus es
~12 temas: el patrón **tool-fetch por-tema** (`get_guia(tema)`) da la MISMA propiedad de grounding
(el modelo responde desde contenido vetado, no desde recall) SIN la maquinaria de retrieval. No es
ser contrarios — es del tamaño del corpus. Si el corpus algún día crece grande/heterogéneo, ahí se
invierte el cálculo y vuelve retrieval.

## 3. Cómo respalda esto nuestras dos preocupaciones

- **Costo:** los líderes lo controlan igual que planeamos — conocimiento recuperado/fetch on-demand,
  nunca residente en el prompt. Convergente. "Experto en todo el sistema" ≠ "el sistema entero en
  cada prompt": es "una tool que trae el conocimiento de cualquier sección on-demand". El costo
  escala con cuántas preguntas de cómo-funciona se hacen, no con cuántas secciones tiene el sistema.
- **Alucinación:** es también la queja #1 de la industria, y la respuesta aceptada son nuestros
  guardarraíles — anclar en contenido autorizado, apuntar a la fuente real, declinar cuando no está
  cubierto. Nadie la "resolvió"; la ACOTARON. El otro dolor compartido honesto es la **obsolescencia
  del contenido** (conocimiento pudriéndose al cambiar la UI) — por eso importa la fuente-única /
  co-locación.

## 4. La bifurcación de arquitectura que falta decidir

Dado todo lo anterior, la decisión real no es "este plan sí o no" — es **cuánto conocimiento HABLA
el agente vs cuánto RUTEA a una guía determinista:**

- **El agente RUTEA (más barato, casi cero alucinación):** el "¿qué hace este botón / cómo navego?"
  puro vive en **UI determinista** (`/dashboard/ayuda`, tooltips). El agente responde una línea y te
  LINKEA ahí. Se queda como experto de **datos + acciones** y **router**, no autor de conocimiento.
  Las secciones de solo-conocimiento (mi-perfil) cuestan casi nada: un one-liner "esto es X, ve
  aquí".
- **El agente POSEE (más conversacional, más superficie):** el agente HABLA el cómo-funciona
  completo desde contenido autorizado por-tema. Se siente más rico, pero cada tema es autorado +
  revisado + mantenido al cambiar la UI, y más superficie de alucinación.
- **Screen-aware (compone con cualquiera):** el agente sabe en qué página estás y solo necesita ser
  experto en ESA pantalla ahora — acota cuánto conocimiento maneja a la vez, bajando la alucinación.
  El doc del panel ya lo marcó como PR aparte.

Nota: los líderes se dividen aquí — **Fin habla; Copilot rutea fuerte a docs.**

## 5. Recomendación: híbrido dividido por TIPO de conocimiento (no un dial global)

La decisión NO es un dial global "habla vs rutea". Es un corte por el **tipo** de conocimiento:

- **HABLA la capa de concepto/flujo/reglas** — qué significan las cosas, qué es posible, qué EXIGE
  un flujo, el "por qué". "Reagendar exige una cita existente y es una acción atómica." "PUE se
  paga al emitir; PPD es diferido y necesita REP." Es la capa que hace que el agente SE SIENTA
  experto.
- **RUTEA a la guía determinista los pasos de UI** — qué botón, qué pestaña, en qué orden. El
  agente da un one-liner y linkea a `/dashboard/ayuda`.

**Por qué este corte (ataca las 2 preocupaciones directo):**
1. **El agente YA medio-habla la capa de concepto — gratis.** El `AGENDA_DOMAIN_MODEL` del prompt
   ya enseña flujos e invariantes. Hablarlo es costo marginal ~cero (es residente) y es la parte
   de alto valor. No autoras mucho nuevo; extiendes lo que hay.
2. **Los pasos pixel-level son la parte VOLÁTIL, de alta alucinación y bajo valor de hablar.** Los
   click-paths son justo lo que se rompe al cambiar la UI — y /appointments se refactorizó este mes
   (`85a652ca` fusionó columnas, `8ee295df` colapsó el sidebar). Un agente HABLANDO un click-path
   viejo es el peor caso: confiado Y equivocado. Rutear a la guía determinista (que se actualiza con
   la UI y muestra capturas que la prosa no) descarga el contenido más riesgoso a la fuente más
   probable de seguir correcta.
3. **Mapea sobre lo que YA existe, barato de realizar.** El modelo de dominio del prompt = la capa
   "habla" (mantener/extender). `/dashboard/ayuda` = el destino "rutea". `get_guia` ya es el puente
   híbrido (resumen curado + puntero a la pestaña). No construyes arquitectura nueva; nombras qué
   mitad posee cada pieza existente.

**Secciones de solo-conocimiento** (mi-perfil) salen route-heavy por naturaleza: un one-liner
"aquí editas X" + link. Correcto — sin tools, contenido mínimo, casi cero superficie de alucinación.

Se mantiene **on-demand** (nunca toca el prefijo) y después se agrega **screen-context** para
acotar el alcance a donde estás.

**Caveat honesto:** la línea "concepto vs paso-de-UI" es en sí un juicio en el medio ("¿cómo conecto
Stripe?" es mitad concepto, mitad click-path). Eso es exactamente lo que el diagnóstico de
appointments calibra: muestra dónde el agente YA habla bien (concepto/flujo → seguir hablando) vs
dónde improvisa pasos de UI que no debería (→ rutear). La recomendación es TESTEABLE — el
diagnóstico fija la línea divisoria por-tema en vez de adivinarla.

## 6. Siguiente paso concreto: el diagnóstico de appointments

Antes de autorar contenido a ciegas: **sondear al agente vivo con preguntas de cómo-funciona /
navegación de appointments** (read-only, dr-prueba) y catalogar en 3 cubetas con la rúbrica afilada
por la investigación:
1. **Ya experto** (flujos de dominio que responde bien desde el prompt) — no reconstruir.
2. **Alucinado o mal** (inventa pasos/botones) — peligroso, urge conocimiento autorado.
3. **"No puedo con eso"** — hueco honesto, necesita conocimiento.

Rúbrica extra (de la investigación): ¿mantiene las preguntas de ESTADO en tools y el cómo-funciona
separado? ¿dónde improvisa pasos de UI que no debería? Ese mapa define el tamaño y forma reales de
la capa de conocimiento de appointments, confirma el modelo de 2 dimensiones contra la realidad, y
es la plantilla para las demás secciones.

## 7. Fuentes

- [Agentic Architecture 101: Topics, Actions, Best Practices — Lane Four](https://lanefour.com/agentforce/agentic-architecture-101-custom-topics-actions-and-best-practices/)
- [Customize Your Agents with Topics and Actions — Salesforce Help](https://help.salesforce.com/s/articleView?id=sf.copilot_topics_actions.htm&language=en_US&type=5)
- [Agentic Patterns and Implementation with Agentforce — Salesforce Architects](https://architect.salesforce.com/fundamentals/agentic-patterns)
- [How AI Support Agents Prevent Hallucinations in Regulated Industries (2026) — Lorikeet](https://www.lorikeetcx.ai/articles/how-ai-support-prevents-hallucinations-regulated-2026)
- [AI Hallucination and Grounding: How Citation Actually Works — ClarityArc](https://www.clarityarc.com/insights/ai-hallucination-grounding-citation)
- [8 Ways to Ground AI Responses (2026 Guide) — Elephas](https://elephas.app/blog/best-ai-grounding-techniques)

---

*Relacionado: [`02-FRONTERA-conocimiento-vs-tools.md`](02-FRONTERA-conocimiento-vs-tools.md) (la
frontera que la investigación valida) · [`00-OVERVIEW-donde-estamos.md`](00-OVERVIEW-donde-estamos.md)
· `../GENERAL AGENTES/00-BLUEPRINT` §5 (escalamiento). Creado 2026-07-14.*
