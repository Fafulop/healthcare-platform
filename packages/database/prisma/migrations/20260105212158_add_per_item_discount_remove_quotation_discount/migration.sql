-- AlterTable quotation_items - Add discount_rate column
ALTER TABLE "practice_management"."quotation_items" ADD COLUMN "discount_rate" DECIMAL(5,4) DEFAULT 0;

-- AlterTable quotations - Remove discount column
ALTER TABLE "practice_management"."quotations" DROP COLUMN "discount";
