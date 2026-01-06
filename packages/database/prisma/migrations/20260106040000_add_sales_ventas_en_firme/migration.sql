-- CreateEnum
CREATE TYPE "practice_management"."SaleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "practice_management"."PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "practice_management"."sales" (
    "id" SERIAL NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "client_id" INTEGER NOT NULL,
    "quotation_id" INTEGER,
    "sale_number" VARCHAR(50) NOT NULL,
    "sale_date" DATE NOT NULL,
    "delivery_date" DATE,
    "status" "practice_management"."SaleStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,4) DEFAULT 0.16,
    "tax" DECIMAL(12,2),
    "total" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) DEFAULT 0,
    "payment_status" "practice_management"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "terms_and_conditions" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "practice_management"."sale_items" (
    "id" SERIAL NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "item_type" VARCHAR(20) NOT NULL DEFAULT 'product',
    "description" VARCHAR(500) NOT NULL,
    "sku" VARCHAR(100),
    "quantity" DECIMAL(10,4) NOT NULL,
    "unit" VARCHAR(50),
    "unit_price" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discount_rate" DECIMAL(5,4) DEFAULT 0,
    "tax_rate" DECIMAL(5,4) DEFAULT 0.16,
    "tax_amount" DECIMAL(12,2) DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_sale_number_key" ON "practice_management"."sales"("sale_number");

-- CreateIndex
CREATE INDEX "sales_doctor_id_status_idx" ON "practice_management"."sales"("doctor_id", "status");

-- CreateIndex
CREATE INDEX "sales_doctor_id_client_id_idx" ON "practice_management"."sales"("doctor_id", "client_id");

-- CreateIndex
CREATE INDEX "sales_doctor_id_payment_status_idx" ON "practice_management"."sales"("doctor_id", "payment_status");

-- CreateIndex
CREATE INDEX "sales_sale_number_idx" ON "practice_management"."sales"("sale_number");

-- CreateIndex
CREATE INDEX "sales_sale_date_idx" ON "practice_management"."sales"("sale_date");

-- CreateIndex
CREATE INDEX "sales_quotation_id_idx" ON "practice_management"."sales"("quotation_id");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "practice_management"."sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "practice_management"."sale_items"("product_id");

-- AddForeignKey
ALTER TABLE "practice_management"."sales" ADD CONSTRAINT "sales_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "public"."doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."sales" ADD CONSTRAINT "sales_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "practice_management"."clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."sales" ADD CONSTRAINT "sales_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "practice_management"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "practice_management"."sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practice_management"."sale_items" ADD CONSTRAINT "sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "practice_management"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
