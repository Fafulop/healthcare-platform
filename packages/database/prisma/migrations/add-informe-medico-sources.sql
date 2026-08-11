-- INFORME MÉDICO — las FUENTES elegidas por el doctor (07-PLAN §5).
--
-- El informe pasa a hacerse a nivel PACIENTE: sigue anclado a UNA consulta —la que
-- da el pre-llenado 🟩 verde— y el doctor ELIGE además otras consultas, notas y
-- recetas que se le inyectan al chat y caen en 🟧 ámbar.
--
-- 🔴 Por qué INSTANTÁNEA y no FKs (07-PLAN §5):
--   · El ANCLA conserva su FK con `NO ACTION DEFERRABLE`: es el sostén legal del
--     documento y no se borra la consulta de la que salió un informe emitido.
--   · Las demás fuentes NO llevan FK. Poner `RESTRICT` sobre notas y recetas
--     volvería imborrable medio expediente en cuanto se usaran en un informe, y
--     para auditar interesa QUÉ SE CONSULTÓ, no que siga existiendo. Una
--     referencia que sobrevive al borrado es MEJOR registro que una FK que
--     impide borrar.
--   · Va `actualizado_en` a propósito: si una nota se edita después, el id solo
--     no dice que el modelo vio otra cosa. Con la fecha de actualización la
--     deriva se detecta.
--
-- ⚠️ NO se copia el contenido clínico aquí dentro. Duplicar PHI para auditar es
-- crear un segundo expediente que nadie mantiene ni borra.
--
-- Forma: [{ "tipo": "consulta|nota|receta", "id": "...", "fecha": "ISO",
--           "actualizadoEn": "ISO" }]
--
-- Patrón del repo: SQL manual + `prisma db execute`, NUNCA `prisma db push`
-- (revertiría la FK compuesta y la DEFERRABLE de esta misma tabla).
-- `ADD COLUMN` con DEFAULT es instantáneo en PG ≥ 11: no reescribe la tabla.

ALTER TABLE medical_records.medical_reports
  ADD COLUMN IF NOT EXISTS sources JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- ROLLBACK:
--   ALTER TABLE medical_records.medical_reports DROP COLUMN sources;
-- ---------------------------------------------------------------------------
