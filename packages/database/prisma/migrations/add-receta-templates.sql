-- Recetas desde plantillas custom (FormBuilder): una plantilla marcada
-- is_receta reemplaza el formulario fijo de Nueva Receta; la receta guarda
-- template_id + custom_data (valores por FieldDefinition.name) en lugar de
-- renglones de medicamentos.
-- Aplicar a prod ANTES de desplegar el código que lo usa (cambios ADITIVOS,
-- nada existente se toca). Patrón del repo: SQL manual, nunca `prisma db push`
-- (revierte el composite FK que vive en prod).

ALTER TABLE medical_records.encounter_templates
  ADD COLUMN IF NOT EXISTS is_receta BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS encounter_templates_doctor_id_is_receta_idx
  ON medical_records.encounter_templates(doctor_id, is_receta);

ALTER TABLE medical_records.prescriptions
  ADD COLUMN IF NOT EXISTS template_id TEXT,
  ADD COLUMN IF NOT EXISTS custom_data JSONB;

-- FK aparte y nombrada (patrón database-architecture.md): re-ejecutable aunque
-- la columna ya exista sin constraint; nombre = convención de Prisma.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prescriptions_template_id_fkey'
  ) THEN
    ALTER TABLE medical_records.prescriptions
      ADD CONSTRAINT prescriptions_template_id_fkey
      FOREIGN KEY (template_id) REFERENCES medical_records.encounter_templates(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
