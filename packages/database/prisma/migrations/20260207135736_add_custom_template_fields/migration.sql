-- Add custom template fields to EncounterTemplate
ALTER TABLE "medical_records"."encounter_templates"
ADD COLUMN "is_custom" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "custom_fields" JSONB;

-- Add template reference and custom data to ClinicalEncounter
ALTER TABLE "medical_records"."clinical_encounters"
ADD COLUMN "template_id" TEXT,
ADD COLUMN "custom_data" JSONB;

-- Create index on templateId for efficient lookups
CREATE INDEX "clinical_encounters_template_id_idx" ON "medical_records"."clinical_encounters"("template_id");

-- Create index on isCustom for filtering custom templates
CREATE INDEX "encounter_templates_doctor_id_is_custom_idx" ON "medical_records"."encounter_templates"("doctor_id", "is_custom");

-- Add foreign key constraint
ALTER TABLE "medical_records"."clinical_encounters"
ADD CONSTRAINT "clinical_encounters_template_id_fkey"
FOREIGN KEY ("template_id") REFERENCES "medical_records"."encounter_templates"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
