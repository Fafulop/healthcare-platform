-- Restore production doctors (3 doctors from original Railway Postgres)
-- This will add them alongside the existing local doctor

-- First, let's see what we have
SELECT 'Current doctors before restore:' as status;
SELECT id, doctor_full_name FROM public.doctors;

-- Insert the 3 production doctors (using ON CONFLICT DO UPDATE to handle duplicates)
INSERT INTO public.doctors (id, slug, doctor_full_name, last_name, primary_specialty, subspecialties, cedula_profesional, hero_image, location_summary, city, short_bio, long_bio, years_experience, conditions, procedures, next_available_date, appointment_modes, clinic_address, clinic_phone, clinic_whatsapp, clinic_hours, clinic_geo_lat, clinic_geo_lng, social_linkedin, social_twitter, created_at, updated_at, color_palette) VALUES
('cmja88yws0000nv0ml0rgut7a', 'fffffffff', 'fffffffff', 'ff', 'fff', '{}', '', '/images/doctors/sample/doctor-placeholder.svg', 'fffff, México', 'fffff', 'dkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl ', 'dkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kd', 1, '{fff}', '{ff}', '2025-12-17 00:00:00', '{in_person,teleconsult}', 'ssssss', '33333332', '', '{"friday": "9:00 AM - 5:00 PM", "monday": "9:00 AM - 6:00 PM", "sunday": "Closed", "tuesday": "9:00 AM - 6:00 PM", "saturday": "Closed", "thursday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM"}', 0, 0, NULL, NULL, '2025-12-17 16:29:51.676', '2025-12-17 16:29:51.676', 'warm'),
('cmjabyfdm00bcmg0mp7uaq1nh', 'gerardo', 'gerardo lop', 'lopez', 'x', '{}', '222222', 'https://utfs.io/f/63e9Mv5a2tPSIYlFRByATNxjv3g2Pl6nuBsbJk5rG1YdOLEa', 'guadalajara, México', 'guadalajara', '', '', 1, '{fff}', '{f}', '2025-12-17 00:00:00', '{in_person,teleconsult}', '', '', '', '{"friday": "9:00 AM - 5:00 PM", "monday": "9:00 AM - 6:00 PM", "sunday": "Closed", "tuesday": "9:00 AM - 6:00 PM", "saturday": "Closed", "thursday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM"}', 0, 0, NULL, NULL, '2025-12-17 18:13:38.266', '2025-12-17 23:46:15.233', 'warm'),
('cmjad41j600blmg0m1ziudezw', 'dr-jose', 'Dr. José Cruz Ruizz', '', 'Cirujano Oftalmologo', '{}', '11228457', 'https://utfs.io/f/63e9Mv5a2tPSaIDAwxGKwlUskK6V9oyH12AC5tTrgbImujEW', 'Guadalajara, México', 'Guadalajara', 'Soy el Dr. José Cruz Ruiz, especialista en oftalmología.
Mi objetivo es brindar una atención oportuna y de calidad, accesible para todos.
Creo firmemente que la medicina debe ejercerse con honestidad, empatía y compromiso.

Cada paciente merece una valoración clara, un trato humano y soluciones real', '', 6, '{Catarata,Pterigión,Miopía,Hipermetropía,Astigmatismo,Presbicia,Queratocono,"Ojo seco","Retinopatía diabética",Glaucoma,Uveítis}', '{"Tratamiento de ojo seco","Adaptación de lentes de contacto blandos​","Cirugía de "carnosidad" (pterigión)​","Tratamiento del Orzuelo y Chalazión​","Valoración integral de Glaucoma"}', '2025-12-17 00:00:00', '{in_person,teleconsult}', 'Av. Ignacio L Vallarta 2527, Arcos Vallarta, 44130 Guadalajara, Jal.', '3315875992', '3315875992', '{"friday": "9:00 AM - 7:00 PM", "monday": "9:00 AM - 7:00 PM", "sunday": "Cerrado", "tuesday": "9:00 AM - 7:00 PM", "saturday": "Cerrado", "thursday": "9:00 AM - 7:00 PM", "wednesday": "9:00 AM - 7:00 PM"}', 20.67432, -103.38344, NULL, NULL, '2025-12-17 18:45:59.873', '2026-01-02 19:08:55.502', 'professional')
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    doctor_full_name = EXCLUDED.doctor_full_name,
    last_name = EXCLUDED.last_name,
    primary_specialty = EXCLUDED.primary_specialty,
    updated_at = EXCLUDED.updated_at;

SELECT 'Doctors after restore:' as status;
SELECT id, doctor_full_name, slug FROM public.doctors ORDER BY created_at;
