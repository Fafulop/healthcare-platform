-- TIERS Q4 — el libro mayor de archivos por cuenta (`StoredFile`).
-- docs/DESDE JUNIO/TIERS/02-PLAN-cuatro-tiers.md §8 (Q4)
--
-- UNA fila por archivo subido. El uso de almacenamiento de un doctor es
-- SUM(size_bytes) sobre esta tabla. No se rellena hacia atrás: se cuenta de hoy
-- en adelante (decisión del usuario 2026-09-13), y es lo correcto porque TODA
-- cuenta que algún día tope empieza vacía — una cuenta nueva nace FREE.
--
-- SEGURO: tabla nueva, nada la lee todavía. Idempotente (IF NOT EXISTS).
--
-- ⚠️ `prisma db push` la BORRA, igual que revierte el FK compuesto de bookings
-- y los índices parciales. Ver database-architecture.md §6.

CREATE TABLE IF NOT EXISTS public.stored_files (
    id          TEXT PRIMARY KEY,
    doctor_id   TEXT NOT NULL,
    -- Llave ESTABLE del archivo (uploadthing `file.key`). Es la de dedupe y la
    -- que empata al borrar. Ver el comentario del modelo en schema.prisma: por
    -- URL no empataría, porque el repo guarda dos formas distintas de URL.
    file_key    TEXT NOT NULL,
    url         TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    kind        VARCHAR(40) NOT NULL,
    created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT stored_files_doctor_id_fkey
        FOREIGN KEY (doctor_id)
        REFERENCES public.doctors(id)
        ON DELETE CASCADE
);

-- La llave del cupo: toda consulta filtra por doctor.
CREATE INDEX IF NOT EXISTS stored_files_doctor_id_idx
    ON public.stored_files(doctor_id);

-- 🔴 UNIQUE sobre file_key: las subidas se reintentan y `onUploadComplete`
-- puede dispararse dos veces para el MISMO archivo. Sin esto se contaría doble
-- y se le negaría espacio a un doctor que no lo ocupa.
CREATE UNIQUE INDEX IF NOT EXISTS stored_files_file_key_key
    ON public.stored_files(file_key);

-- Verificación (solo lectura):
--   SELECT count(*) FROM public.stored_files;                       -- 0 al crearla
--   SELECT indexname FROM pg_indexes WHERE tablename='stored_files';
--     -- stored_files_pkey · stored_files_doctor_id_idx · stored_files_file_key_key
