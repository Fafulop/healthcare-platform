-- CreateTable: Patient Master Record
CREATE TABLE "medical_records"."patients" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "internal_id" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "sex" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "emergency_contact_name" VARCHAR(200),
    "emergency_contact_phone" VARCHAR(50),
    "emergency_contact_relation" VARCHAR(100),
    "first_visit_date" DATE,
    "last_visit_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "tags" TEXT[],
    "current_allergies" TEXT,
    "current_chronic_conditions" TEXT,
    "current_medications" TEXT,
    "blood_type" VARCHAR(10),
    "general_notes" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Patient Medical History (versioning)
CREATE TABLE "medical_records"."patient_medical_history" (
    "id" SERIAL NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "field_name" VARCHAR(100) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT NOT NULL,
    "change_reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Clinical Encounters
CREATE TABLE "medical_records"."clinical_encounters" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "encounter_date" TIMESTAMP(3) NOT NULL,
    "encounter_type" VARCHAR(50) NOT NULL,
    "chief_complaint" TEXT NOT NULL,
    "location" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "clinical_notes" TEXT,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "vitals_blood_pressure" VARCHAR(20),
    "vitals_heart_rate" INTEGER,
    "vitals_temperature" DECIMAL(4,1),
    "vitals_weight" DECIMAL(5,2),
    "vitals_height" DECIMAL(5,2),
    "vitals_oxygen_sat" INTEGER,
    "vitals_other" TEXT,
    "follow_up_date" DATE,
    "follow_up_notes" TEXT,
    "created_by" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "amended_at" TIMESTAMP(3),
    "amendment_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Patient Audit Log
CREATE TABLE "medical_records"."patient_audit_logs" (
    "id" SERIAL NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" TEXT,
    "changes" JSONB,
    "user_id" TEXT NOT NULL,
    "user_role" VARCHAR(50) NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "patients_doctor_id_internal_id_key" ON "medical_records"."patients"("doctor_id", "internal_id");

-- CreateIndex
CREATE INDEX "patients_doctor_id_status_idx" ON "medical_records"."patients"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "patients_doctor_id_first_name_last_name_idx" ON "medical_records"."patients"("doctor_id", "first_name", "last_name");

-- CreateIndex
CREATE INDEX "patients_doctor_id_last_visit_date_idx" ON "medical_records"."patients"("doctor_id", "last_visit_date");

-- CreateIndex
CREATE INDEX "patient_medical_history_patient_id_changed_at_idx" ON "medical_records"."patient_medical_history"("patient_id", "changed_at");

-- CreateIndex
CREATE INDEX "patient_medical_history_doctor_id_changed_at_idx" ON "medical_records"."patient_medical_history"("doctor_id", "changed_at");

-- CreateIndex
CREATE INDEX "clinical_encounters_patient_id_encounter_date_idx" ON "medical_records"."clinical_encounters"("patient_id", "encounter_date");

-- CreateIndex
CREATE INDEX "clinical_encounters_doctor_id_encounter_date_idx" ON "medical_records"."clinical_encounters"("doctor_id", "encounter_date");

-- CreateIndex
CREATE INDEX "clinical_encounters_doctor_id_status_idx" ON "medical_records"."clinical_encounters"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "patient_audit_logs_patient_id_timestamp_idx" ON "medical_records"."patient_audit_logs"("patient_id", "timestamp");

-- CreateIndex
CREATE INDEX "patient_audit_logs_doctor_id_timestamp_idx" ON "medical_records"."patient_audit_logs"("doctor_id", "timestamp");

-- CreateIndex
CREATE INDEX "patient_audit_logs_user_id_timestamp_idx" ON "medical_records"."patient_audit_logs"("user_id", "timestamp");

-- AddForeignKey
ALTER TABLE "medical_records"."patients" ADD CONSTRAINT "patients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records"."patient_medical_history" ADD CONSTRAINT "patient_medical_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "medical_records"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records"."clinical_encounters" ADD CONSTRAINT "clinical_encounters_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "medical_records"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records"."patient_audit_logs" ADD CONSTRAINT "patient_audit_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "medical_records"."patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
