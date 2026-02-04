-- Link admin user to doctor profile
UPDATE "public"."User"
SET "doctorId" = 'cmjad41j600blmg0m1ziudezw'
WHERE email = 'lopez.fafutis@gmail.com';

-- Verify the update
SELECT id, email, role, "doctorId" FROM "public"."User" WHERE email = 'lopez.fafutis@gmail.com';
