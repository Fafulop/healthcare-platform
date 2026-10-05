# Archivar un paciente

**Para qué:** sacar de tu lista activa a un paciente que ya no atiendes. Libera lugar si tu plan tiene tope.

**Pasos**
1. En el perfil del paciente → **«Archivar»** → **«Confirmar»**.

**Qué vas a ver:** vuelves a la lista. El paciente aparece en el filtro **«Archivados»**; su expediente no se borra.

**Para regresarlo:** abre su expediente (filtro «Archivados») → junto al nombre dice **«Archivado»** → **«Reactivar»** → **«Confirmar»**. Vuelve a tus activos y cuenta otra vez para el cupo de tu plan; si el plan ya está lleno, te avisa y no lo reactiva.

**Si algo sale mal:** sus citas futuras no se cancelan solas al archivarlo.

**Video:** (pendiente)


---

**QA (interno — se quita al publicar):** 2026-10-03 — E13 ✅ archivar (QA C4, `PATIENT_ARCHIVED`). H-041 «Reactivar» ✅ en prod 2026-10-05 (`e00727e4`, QA C4 reactivado y vuelto a archivar); ⚠️ H-042 (cita futura sigue sin aviso).
