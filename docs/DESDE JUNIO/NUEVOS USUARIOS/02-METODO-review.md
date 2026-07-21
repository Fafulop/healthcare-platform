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

## 4. Reglas que no cambian

- Modo B inline es el default en sesión larga; multi-agente local NUNCA al final del día.
- Explicar hallazgos → OK del usuario → commit (nunca push sin explicar).
- SQL a prod ANTES del código; smoke read-only de todo query shape nuevo.
- Cada review deja rastro: sección "§ review" en el doc del PR correspondiente.
- **Validación adversarial post-deploy** (01-DISENO §9): curl real a endpoints bloqueados
  con el token del member — el review revisa el código, la sonda revisa prod.
