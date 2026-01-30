-- CreateTable
CREATE TABLE "medical_records"."tasks" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "due_time" VARCHAR(5),
    "priority" VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "category" VARCHAR(20) NOT NULL DEFAULT 'OTRO',
    "patient_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_doctor_id_status_idx" ON "medical_records"."tasks"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "tasks_doctor_id_due_date_idx" ON "medical_records"."tasks"("doctor_id", "due_date");

-- CreateIndex
CREATE INDEX "tasks_doctor_id_priority_idx" ON "medical_records"."tasks"("doctor_id", "priority");

-- CreateIndex
CREATE INDEX "tasks_patient_id_idx" ON "medical_records"."tasks"("patient_id");

-- AddForeignKey
ALTER TABLE "medical_records"."tasks" ADD CONSTRAINT "tasks_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_records"."tasks" ADD CONSTRAINT "tasks_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "medical_records"."patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
