-- CreateEnum
CREATE TYPE "practice_management"."QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "practice_management"."quotations" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "quotation_number" VARCHAR(50) NOT NULL,
    "issue_date" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "status" "practice_management"."QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,4) DEFAULT 0.16,
    "tax" DECIMAL(12,2),
    "discount" DECIMAL(12,2) DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "terms_and_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."quotation_items" (
    "id" SERIAL NOT NULL,
    "quotation_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "item_type" VARCHAR(20) NOT NULL DEFAULT 'product',
    "description" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(100),
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" VARCHAR(50),
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotation_number_key" ON "practice_management"."quotations"("quotation_number");

-- CreateIndex
CREATE INDEX "quotations_doctor_id_status_idx" ON "practice_management"."quotations"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "quotations_doctor_id_client_id_idx" ON "practice_management"."quotations"("doctor_id", "client_id");

-- CreateIndex
CREATE INDEX "quotations_quotation_number_idx" ON "practice_management"."quotations"("quotation_number");

-- CreateIndex
CREATE INDEX "quotations_issue_date_idx" ON "practice_management"."quotations"("issue_date");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "practice_management"."quotation_items"("quotation_id");

-- CreateIndex
CREATE INDEX "quotation_items_product_id_idx" ON "practice_management"."quotation_items"("product_id");

-- AddForeignKey
ALTER TABLE "practice_management"."quotations" ADD CONSTRAINT "quotations_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."quotations" ADD CONSTRAINT "quotations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "practice_management"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "practice_management"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."quotation_items" ADD CONSTRAINT "quotation_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "practice_management"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
