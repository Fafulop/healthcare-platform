# VISITAS — un agregador por visita, y series de visitas (tratamientos)

> **Estado (2026-09-25): DISEÑO CERRADO, nada construido — sigue el plan de la fase 1.** Nació del feedback de doctores: hoy todo lo
> que se crea en el expediente es suelto y nada responde "¿qué pasó en la visita del 12 sep?".

## En una frase

**«Nueva Consulta» pasa a ser «Nueva Visita»:** un registro nuevo que agrupa lo que pasó en una
visita (varias plantillas, fotos, nota, receta, su cita), mientras las páginas que ya existen se
quedan como libros mayores de todo el paciente. Encima, un **Tratamiento** opcional agrupa visitas
en serie (seguimientos y sesiones), con precio de paquete sin duplicar la verdad de la agenda.

## Documentos

| Doc | Tipo | Qué tiene |
|---|---|---|
| [`01-DISENO-visitas-y-tratamientos.md`](01-DISENO-visitas-y-tratamientos.md) | DISEÑO (vivo) | El modelo, las reglas de una sola fuente de verdad (fecha/hora = cita · precio del paquete ≠ cobro), la visita automática al concluir, los flujos, las fases, los riesgos y las preguntas abiertas. |
| [`02-PLAN-fase-1.md`](02-PLAN-fase-1.md) | PLAN | Cómo se construye la fase 1 contra una BD que sólo existe en prod: SQL aditivo, 6 comprobaciones con rollback, backfill reversible de las consultas, y los despliegues D1–D6 con sus puntos de parada. |

## Las tres reglas que no se re-litigan

1. **La visita va ARRIBA; lo existente no cambia de forma** — sólo gana un "¿de qué visita?".
2. **Nadie copia el dato de otro:** la sesión apunta a su cita; el saldo se calcula de los cobros.
3. **Concluir una cita crea su visita**, idempotente y fallando abierto — la cita se concluye aunque
   la visita truene.
