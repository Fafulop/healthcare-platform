-- Delete orphaned sales (created during failed POST attempts before the ledger_entries fix)
-- Safe: only deletes sales with no corresponding ledger entry
DELETE FROM practice_management.sales
WHERE id IN (
  SELECT s.id
  FROM practice_management.sales s
  LEFT JOIN practice_management.ledger_entries le ON le.sale_id = s.id
  WHERE le.id IS NULL
);
