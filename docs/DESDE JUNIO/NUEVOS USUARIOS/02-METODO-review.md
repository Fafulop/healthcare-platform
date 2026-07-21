# NUEVOS USUARIOS — Método de review por PR

> Adaptación del playbook general (`GENERAL AGENTES/05-METODO-code-review.md`) al perfil de
> riesgo de ESTA feature: código de **autorización**. El modo de fallo no es "número
> equivocado en una respuesta" sino "un member ve datos que el dueño bloqueó" o "nadie puede
> loguearse". Creado 2026-07-20, antes de escribir código.

## 1. Extensión de la heurística

A las dos categorías "review completo sin preguntar" del playbook (lógica replicada,
contenido fáctico) se suma una tercera para esta feature: **código de frontera de
seguridad/authz**. Un hoyo aquí es invisible para tsc y evals igual que el parity drift:
todo compila, los owners funcionan, y el agujero solo existe para una clase de usuario que
aún no existe en prod.

## 2. Ángulos adicionales (7-9) para los PRs A, B y D

Se suman a los 6 del playbook (modo B inline):

7. **Caza de bypass en el matcher de rutas** — derrotar el prefix-matching en papel:
   `/api/medical-records-export` vs prefijo `medical-records`; trailing slashes; casing;
   query strings; orden específico-gana (`tasks` vs `medical-records`); rutas que existen en
   la app pero NO en el mapa (verificar que el fail-closed de verdad 403ea, no que caiga a
   permitido). **El inventario completo de rutas ES el review, no un muestreo.**
8. **Escalación de privilegios** — ¿un member con `perfil` ON alcanza `/api/team`?; ¿puede
   editar su propia fila de membresía vía algún CRUD genérico?; ¿la transacción de accept
   aguanta la carrera (doble accept, accept-vs-revoke)?; ¿el guard owner-only de recetas está
   en el ENDPOINT y no solo escondido en UI?
9. **Auditoría de dirección de fallo** — por cada condicional nuevo en la capa de
   resolución: "¿qué pasa si esto truena / regresa null / da timeout?". La regla es
   asimétrica: fallo de resolución para un OWNER falla ABIERTO hacia sus propios datos
   (fallback a `User.doctorId` — si no, deslogueamos a todos los doctores); ambigüedad para
   un MEMBER falla CERRADO. Etiquetar cada rama con su lado.

## 3. Plan por PR

| PR | Review | Gates de máquina |
|---|---|---|
| **A** resolución | Inline pre-commit **+ `/code-review ultra` sobre la rama ANTES del push** (blast radius = todo el login; ultra corre en nube, sin problema de session-limit, ojos frescos de verdad; lo dispara el usuario) | Smoke prod read-only: `effectiveDoctorId == users.doctor_id` para TODOS los users reales · tsc ambas apps |
| **B** enforcement | Inline con ángulos 7-9 como núcleo; ultra opcional | **Script de inventario de rutas** (recorre ambos `app/api`, asserta que todo dir está en el mapa o es NEUTRAL/público explícito — queda como guard permanente contra rutas futuras sin mapear) · evals 60/60 (owner intacto) |
| **C** agente | Playbook tal cual (composición = lógica replicada → ángulos completos inline) | sha256 byte-idéntico del prompt owner · unit tests de composición · evals 60/60 |
| **D** invitaciones | Inline con ángulo 8 + ángulo 4 del playbook (¿qué cambia entre crear la invitación y aceptarla?) | Smoke de constraints contra BD con shape de prod (P2002 en doble-accept) con el patrón write-probe-rollback de database-architecture.md |

Prioridad de ultra si el presupuesto es limitado: **A > B > D > C** (C y D tienen los gates
deterministas más fuertes).

## 3.1. Refinamiento aplicado en vivo (PRs B/C/D, 2026-07-20): ultra ≠ costo de sesión

`/code-review ultra` corre en la nube y **NO consume tokens de la sesión actual** — es
distinto del modo multi-agente LOCAL (que sí hereda todo el contexto y mató el límite el
2026-07-16, ver 05-METODO). Lo que SÍ es limitado es la **cuota de ultra** (ejecuciones
gratis por periodo). Con eso claro, la estrategia correcta cuando hay varios PRs seguidos:

- El review INLINE (el que corre en esta sesión, angulos 7-9/4/8) sigue siendo obligatorio
  PARA CADA PR — no se salta por costo, porque es donde salen los hallazgos reales (ver
  PR C: el error de diseño de INTRO/RESILIENCE; PR D: el bug de member revocado +
  re-invitado). Saltarlo ahorra tokens de sesión pero renuncia a la única capa que atrapa
  errores ANTES de construir la siguiente PR encima.
- Lo que SÍ conviene diferir es el NÚMERO de ejecuciones de ultra: construir varias PRs
  seguidas (cada una con su propio commit, para que los hallazgos se puedan atribuir por
  archivo) y correr **UN solo `/code-review ultra`** al final cubriendo todos los commits
  sin pushear — el comando sin argumentos bandea automáticamente todo lo que esté adelante
  de `origin/main`. Esto reparte la cuota entre menos ejecuciones sin perder cobertura (ultra
  revisa el diff completo igual).
- Aplicado en PR B+C+D: 3 PRs construidas y revisadas inline por separado, comiteadas por
  separado, UN ultra al final cubriendo las 3. Cuota gastada: 1 (no 3).

## 3.2. Bug hunt dirigido post-fix (validado en vivo, 2026-07-21): dos greps, no uno

Durante la validación en vivo de PR B-D, un usuario real (member) tropezó con un botón que
no hacía nada (el "Asistente" de la página de citas). El fix obvio (gatear ESE botón) llevó
a preguntar "¿vale la pena un bug hunt rápido?" — la respuesta fue sí, y se hizo en 3 rondas
que en total encontraron **9 bugs reales** de la misma familia (superficies owner-only
alcanzables por un member sin guard, todas "nit" — sin hueco de seguridad real, porque el
403 del backend siempre sostenía el límite, pero sí UX rota o confusa). El patrón que hizo
esto productivo, replicable para la próxima vez que aparezca un bug de "componente
compartido sin gate":

1. **Ronda 1 (grep por endpoint específico):** el primer bug (facturación) llevó a preguntar
   "¿qué MÁS comparte el mismo prefijo de ruta OWNER_ONLY?" — grep sobre las reglas del
   mapa de permisos mismas, encontrando 2 casos más del mismo molde (status-read agrupado
   con escritura-de-secreto).
2. **Ronda 2 (grep por NOMBRE de componente compartido):** el segundo bug (botón del agente
   en citas) llevó a enumerar TODOS los consumidores de `useAgentActions` — 0 más. Pero
   generalizando la pregunta a "¿qué otros componentes se montan globalmente sin gate?"
   encontró 3 widgets más (`ChatWidget`, `VoiceAssistantHubWidget`,
   `GoogleCalendarBanner`). Extendiendo el mismo grep a los 8 endpoints `*-chat` legacy
   (buscando el nombre de su panel compartido: `TaskChatPanel`, `SaleChatPanel`, etc.)
   encontró que los 8 compartían el mismo defecto en 2 puntos de disparo cada uno.
3. **Ronda 3 (grep por RUTA de API cruda, no por nombre de componente):** las rondas 1-2
   solo encuentran bugs donde hay un componente o regla NOMBRADA y reusada. La ronda 3
   buscó la variante inversa — features embebidas en páginas que SÍ son member-accessible,
   sin componente compartido reconocible (una llamada `fetch()` suelta). Grep de las
   RUTAS crudas (`/api/voice/`, `/api/task-chat`, etc.) en vez de nombres de componente
   encontró 2 más (dictado por voz en Notas, asistente IA en FormBuilder) que las rondas
   1-2 NUNCA iban a atrapar buscando por nombre.

**La regla generalizable:** un bug de "gate faltante" casi nunca es único. Antes de cerrar
el fix puntual, correr AL MENOS dos búsquedas con criterios distintos — por nombre de
componente/hook compartido, y por ruta de API cruda — porque cada una encuentra una familia
distinta de instancias del mismo bug. Parar cuando una ronda no encuentra nada nuevo (ronda
3 fue la última en este caso: no quedaban rutas OWNER_ONLY sin dueño de bug conocido).

## 4. Reglas que no cambian

- Modo B inline es el default en sesión larga; multi-agente local NUNCA al final del día.
- Explicar hallazgos → OK del usuario → commit (nunca push sin explicar).
- SQL a prod ANTES del código; smoke read-only de todo query shape nuevo.
- Cada review deja rastro: sección "§ review" en el doc del PR correspondiente.
- **Validación adversarial post-deploy** (01-DISENO §9): curl real a endpoints bloqueados
  con el token del member — el review revisa el código, la sonda revisa prod.
