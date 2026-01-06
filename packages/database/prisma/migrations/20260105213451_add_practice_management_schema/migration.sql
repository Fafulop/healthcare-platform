-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "practice_management";

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "color_palette" TEXT NOT NULL DEFAULT 'warm';

-- CreateTable
CREATE TABLE "appointment_slots" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "base_price" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2),
    "discount_type" TEXT,
    "final_price" DECIMAL(10,2) NOT NULL,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "max_bookings" INTEGER NOT NULL DEFAULT 1,
    "current_bookings" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointment_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_name" TEXT NOT NULL,
    "patient_email" TEXT NOT NULL,
    "patient_phone" TEXT NOT NULL,
    "patient_whatsapp" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "final_price" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "confirmation_code" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "review_token" TEXT,
    "review_token_used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "booking_id" TEXT,
    "patient_name" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."areas" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."subareas" (
    "id" SERIAL NOT NULL,
    "area_id" INTEGER NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."clients" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "rfc" VARCHAR(13),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "street" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL DEFAULT 'México',
    "industry" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "logo_url" TEXT,
    "logo_file_name" VARCHAR(255),
    "logo_file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."proveedores" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "business_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255),
    "rfc" VARCHAR(13),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "street" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "country" VARCHAR(100) NOT NULL DEFAULT 'México',
    "industry" VARCHAR(100),
    "notes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "logo_url" TEXT,
    "logo_file_name" VARCHAR(255),
    "logo_file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."product_attributes" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."product_attribute_values" (
    "id" SERIAL NOT NULL,
    "attribute_id" INTEGER NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "cost" DECIMAL(10,2),
    "unit" VARCHAR(50),
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."products" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(100),
    "category" VARCHAR(100),
    "description" TEXT,
    "price" DECIMAL(10,2),
    "cost" DECIMAL(10,2),
    "stockQuantity" INTEGER DEFAULT 0,
    "unit" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "image_url" TEXT,
    "image_file_name" VARCHAR(255),
    "image_file_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."product_components" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "attribute_value_id" INTEGER NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "calculatedCost" DECIMAL(12,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."ledger_entries" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "concept" VARCHAR(500) NOT NULL,
    "bank_account" VARCHAR(255),
    "forma_de_pago" VARCHAR(50) DEFAULT 'efectivo',
    "internal_id" VARCHAR(100) NOT NULL,
    "bank_movement_id" VARCHAR(255),
    "entry_type" VARCHAR(20) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "area" VARCHAR(255) NOT NULL,
    "subarea" VARCHAR(255) NOT NULL,
    "por_realizar" BOOLEAN NOT NULL DEFAULT false,
    "file_url" TEXT,
    "file_name" VARCHAR(255),
    "file_size" INTEGER,
    "file_type" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."ledger_attachments" (
    "id" SERIAL NOT NULL,
    "ledger_entry_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "file_type" VARCHAR(100),
    "attachment_type" VARCHAR(20) NOT NULL DEFAULT 'file',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."ledger_facturas" (
    "id" SERIAL NOT NULL,
    "ledger_entry_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "file_type" VARCHAR(100),
    "folio" VARCHAR(100),
    "uuid" VARCHAR(100),
    "rfc_emisor" VARCHAR(20),
    "rfc_receptor" VARCHAR(20),
    "total" DECIMAL(12,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."ledger_facturas_xml" (
    "id" SERIAL NOT NULL,
    "ledger_entry_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "xml_content" TEXT,
    "folio" VARCHAR(100),
    "uuid" VARCHAR(100),
    "rfc_emisor" VARCHAR(20),
    "rfc_receptor" VARCHAR(20),
    "total" DECIMAL(12,2),
    "subtotal" DECIMAL(12,2),
    "iva" DECIMAL(12,2),
    "fecha" TIMESTAMP(6),
    "metodo_pago" VARCHAR(50),
    "forma_pago" VARCHAR(50),
    "moneda" VARCHAR(10),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_facturas_xml_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointment_slots_doctor_id_date_status_idx" ON "appointment_slots"("doctor_id", "date", "status");

-- CreateIndex
CREATE INDEX "appointment_slots_date_idx" ON "appointment_slots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_slots_doctor_id_date_start_time_key" ON "appointment_slots"("doctor_id", "date", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_confirmation_code_key" ON "bookings"("confirmation_code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_review_token_key" ON "bookings"("review_token");

-- CreateIndex
CREATE INDEX "bookings_doctor_id_status_idx" ON "bookings"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "bookings_slot_id_idx" ON "bookings"("slot_id");

-- CreateIndex
CREATE INDEX "bookings_patient_email_idx" ON "bookings"("patient_email");

-- CreateIndex
CREATE INDEX "bookings_review_token_idx" ON "bookings"("review_token");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_doctor_id_approved_idx" ON "reviews"("doctor_id", "approved");

-- CreateIndex
CREATE INDEX "reviews_booking_id_idx" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "areas_doctor_id_idx" ON "practice_management"."areas"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "areas_doctor_id_name_key" ON "practice_management"."areas"("doctor_id", "name");

-- CreateIndex
CREATE INDEX "subareas_area_id_idx" ON "practice_management"."subareas"("area_id");

-- CreateIndex
CREATE UNIQUE INDEX "subareas_area_id_name_key" ON "practice_management"."subareas"("area_id", "name");

-- CreateIndex
CREATE INDEX "clients_doctor_id_status_idx" ON "practice_management"."clients"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "clients_doctor_id_business_name_idx" ON "practice_management"."clients"("doctor_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "clients_doctor_id_business_name_key" ON "practice_management"."clients"("doctor_id", "business_name");

-- CreateIndex
CREATE INDEX "proveedores_doctor_id_status_idx" ON "practice_management"."proveedores"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "proveedores_doctor_id_business_name_idx" ON "practice_management"."proveedores"("doctor_id", "business_name");

-- CreateIndex
CREATE UNIQUE INDEX "proveedores_doctor_id_business_name_key" ON "practice_management"."proveedores"("doctor_id", "business_name");

-- CreateIndex
CREATE INDEX "product_attributes_doctor_id_is_active_idx" ON "practice_management"."product_attributes"("doctor_id", "is_active");

-- CreateIndex
CREATE INDEX "product_attributes_doctor_id_order_idx" ON "practice_management"."product_attributes"("doctor_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_doctor_id_name_key" ON "practice_management"."product_attributes"("doctor_id", "name");

-- CreateIndex
CREATE INDEX "product_attribute_values_attribute_id_is_active_idx" ON "practice_management"."product_attribute_values"("attribute_id", "is_active");

-- CreateIndex
CREATE INDEX "product_attribute_values_attribute_id_order_idx" ON "practice_management"."product_attribute_values"("attribute_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_attribute_id_value_key" ON "practice_management"."product_attribute_values"("attribute_id", "value");

-- CreateIndex
CREATE INDEX "products_doctor_id_status_idx" ON "practice_management"."products"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "products_doctor_id_category_idx" ON "practice_management"."products"("doctor_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "products_doctor_id_name_key" ON "practice_management"."products"("doctor_id", "name");

-- CreateIndex
CREATE INDEX "product_components_product_id_idx" ON "practice_management"."product_components"("product_id");

-- CreateIndex
CREATE INDEX "product_components_attribute_value_id_idx" ON "practice_management"."product_components"("attribute_value_id");

-- CreateIndex
CREATE INDEX "ledger_entries_doctor_id_idx" ON "practice_management"."ledger_entries"("doctor_id");

-- CreateIndex
CREATE INDEX "ledger_entries_doctor_id_entry_type_idx" ON "practice_management"."ledger_entries"("doctor_id", "entry_type");

-- CreateIndex
CREATE INDEX "ledger_entries_doctor_id_transaction_date_idx" ON "practice_management"."ledger_entries"("doctor_id", "transaction_date");

-- CreateIndex
CREATE INDEX "ledger_entries_doctor_id_area_subarea_idx" ON "practice_management"."ledger_entries"("doctor_id", "area", "subarea");

-- CreateIndex
CREATE INDEX "ledger_entries_doctor_id_por_realizar_idx" ON "practice_management"."ledger_entries"("doctor_id", "por_realizar");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_doctor_id_internal_id_key" ON "practice_management"."ledger_entries"("doctor_id", "internal_id");

-- CreateIndex
CREATE INDEX "ledger_attachments_ledger_entry_id_idx" ON "practice_management"."ledger_attachments"("ledger_entry_id");

-- CreateIndex
CREATE INDEX "ledger_facturas_ledger_entry_id_idx" ON "practice_management"."ledger_facturas"("ledger_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_facturas_xml_uuid_key" ON "practice_management"."ledger_facturas_xml"("uuid");

-- CreateIndex
CREATE INDEX "ledger_facturas_xml_ledger_entry_id_idx" ON "practice_management"."ledger_facturas_xml"("ledger_entry_id");

-- CreateIndex
CREATE INDEX "ledger_facturas_xml_uuid_idx" ON "practice_management"."ledger_facturas_xml"("uuid");

-- AddForeignKey
ALTER TABLE "appointment_slots" ADD CONSTRAINT "appointment_slots_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "appointment_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."areas" ADD CONSTRAINT "areas_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."subareas" ADD CONSTRAINT "subareas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "practice_management"."areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."clients" ADD CONSTRAINT "clients_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."proveedores" ADD CONSTRAINT "proveedores_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."product_attributes" ADD CONSTRAINT "product_attributes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."product_attribute_values" ADD CONSTRAINT "product_attribute_values_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "practice_management"."product_attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."products" ADD CONSTRAINT "products_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."product_components" ADD CONSTRAINT "product_components_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "practice_management"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."product_components" ADD CONSTRAINT "product_components_attribute_value_id_fkey" FOREIGN KEY ("attribute_value_id") REFERENCES "practice_management"."product_attribute_values"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."ledger_entries" ADD CONSTRAINT "ledger_entries_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."ledger_attachments" ADD CONSTRAINT "ledger_attachments_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "practice_management"."ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."ledger_facturas" ADD CONSTRAINT "ledger_facturas_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "practice_management"."ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."ledger_facturas_xml" ADD CONSTRAINT "ledger_facturas_xml_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "practice_management"."ledger_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
