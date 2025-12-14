-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "doctor_full_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "primary_specialty" TEXT NOT NULL,
    "subspecialties" TEXT[],
    "cedula_profesional" TEXT,
    "hero_image" TEXT NOT NULL,
    "location_summary" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "short_bio" TEXT NOT NULL,
    "long_bio" TEXT NOT NULL,
    "years_experience" INTEGER NOT NULL,
    "conditions" TEXT[],
    "procedures" TEXT[],
    "next_available_date" TIMESTAMP(3),
    "appointment_modes" TEXT[],
    "clinic_address" TEXT NOT NULL,
    "clinic_phone" TEXT NOT NULL,
    "clinic_whatsapp" TEXT,
    "clinic_hours" JSONB NOT NULL,
    "clinic_geo_lat" DOUBLE PRECISION,
    "clinic_geo_lng" DOUBLE PRECISION,
    "social_linkedin" TEXT,
    "social_twitter" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "price" DOUBLE PRECISION,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "issued_by" TEXT NOT NULL,
    "year" TEXT NOT NULL,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carousel_items" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "src" TEXT NOT NULL,
    "thumbnail" TEXT,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "name" TEXT,
    "description" TEXT,
    "upload_date" TEXT,
    "duration" TEXT,

    CONSTRAINT "carousel_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "doctors_slug_key" ON "doctors"("slug");

-- CreateIndex
CREATE INDEX "services_doctor_id_idx" ON "services"("doctor_id");

-- CreateIndex
CREATE INDEX "education_doctor_id_idx" ON "education"("doctor_id");

-- CreateIndex
CREATE INDEX "certificates_doctor_id_idx" ON "certificates"("doctor_id");

-- CreateIndex
CREATE INDEX "carousel_items_doctor_id_idx" ON "carousel_items"("doctor_id");

-- CreateIndex
CREATE INDEX "faqs_doctor_id_idx" ON "faqs"("doctor_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education" ADD CONSTRAINT "education_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carousel_items" ADD CONSTRAINT "carousel_items_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
