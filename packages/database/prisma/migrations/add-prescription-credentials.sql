-- Identidad del médico en recetas: credenciales [{titulo, cedula}] guardadas
-- una vez en el perfil (doctors.prescription_credentials, editables en la
-- pestaña Receta de /dashboard/mi-perfil) y SNAPSHOT por receta al crearla
-- (prescriptions.doctor_credentials — mismo principio de integridad legal que
-- doctor_full_name/doctor_license).
-- Aplicar a prod ANTES de desplegar el código (cambios ADITIVOS). Patrón del
-- repo: SQL manual, nunca `prisma db push`.

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS prescription_credentials JSONB;

ALTER TABLE medical_records.prescriptions
  ADD COLUMN IF NOT EXISTS doctor_credentials JSONB;
