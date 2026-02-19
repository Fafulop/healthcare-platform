-- Delete ALL sales (and their items via CASCADE)
-- Safe: the ventas feature never worked in production before this fix,
-- so all existing sales are orphaned test data.
DELETE FROM practice_management.sale_items;
DELETE FROM practice_management.sales;
