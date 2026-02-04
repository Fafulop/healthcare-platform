--
-- PostgreSQL database dump
--

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.services DROP CONSTRAINT IF EXISTS services_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_booking_id_fkey;
ALTER TABLE IF EXISTS ONLY public.faqs DROP CONSTRAINT IF EXISTS faqs_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.education DROP CONSTRAINT IF EXISTS education_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.certificates DROP CONSTRAINT IF EXISTS certificates_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.carousel_items DROP CONSTRAINT IF EXISTS carousel_items_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_slot_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.articles DROP CONSTRAINT IF EXISTS articles_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.appointment_slots DROP CONSTRAINT IF EXISTS appointment_slots_doctor_id_fkey;
DROP INDEX IF EXISTS public.users_email_key;
DROP INDEX IF EXISTS public.users_doctor_id_key;
DROP INDEX IF EXISTS public.services_doctor_id_idx;
DROP INDEX IF EXISTS public.reviews_doctor_id_approved_idx;
DROP INDEX IF EXISTS public.reviews_booking_id_key;
DROP INDEX IF EXISTS public.reviews_booking_id_idx;
DROP INDEX IF EXISTS public.faqs_doctor_id_idx;
DROP INDEX IF EXISTS public.education_doctor_id_idx;
DROP INDEX IF EXISTS public.doctors_slug_key;
DROP INDEX IF EXISTS public.certificates_doctor_id_idx;
DROP INDEX IF EXISTS public.carousel_items_doctor_id_idx;
DROP INDEX IF EXISTS public.bookings_slot_id_idx;
DROP INDEX IF EXISTS public.bookings_review_token_key;
DROP INDEX IF EXISTS public.bookings_review_token_idx;
DROP INDEX IF EXISTS public.bookings_patient_email_idx;
DROP INDEX IF EXISTS public.bookings_doctor_id_status_idx;
DROP INDEX IF EXISTS public.bookings_confirmation_code_key;
DROP INDEX IF EXISTS public.articles_slug_key;
DROP INDEX IF EXISTS public.articles_slug_idx;
DROP INDEX IF EXISTS public.articles_published_at_idx;
DROP INDEX IF EXISTS public.articles_doctor_id_status_idx;
DROP INDEX IF EXISTS public.appointment_slots_doctor_id_date_status_idx;
DROP INDEX IF EXISTS public.appointment_slots_doctor_id_date_start_time_key;
DROP INDEX IF EXISTS public.appointment_slots_date_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.services DROP CONSTRAINT IF EXISTS services_pkey;
ALTER TABLE IF EXISTS ONLY public.reviews DROP CONSTRAINT IF EXISTS reviews_pkey;
ALTER TABLE IF EXISTS ONLY public.faqs DROP CONSTRAINT IF EXISTS faqs_pkey;
ALTER TABLE IF EXISTS ONLY public.education DROP CONSTRAINT IF EXISTS education_pkey;
ALTER TABLE IF EXISTS ONLY public.doctors DROP CONSTRAINT IF EXISTS doctors_pkey;
ALTER TABLE IF EXISTS ONLY public.certificates DROP CONSTRAINT IF EXISTS certificates_pkey;
ALTER TABLE IF EXISTS ONLY public.carousel_items DROP CONSTRAINT IF EXISTS carousel_items_pkey;
ALTER TABLE IF EXISTS ONLY public.bookings DROP CONSTRAINT IF EXISTS bookings_pkey;
ALTER TABLE IF EXISTS ONLY public.articles DROP CONSTRAINT IF EXISTS articles_pkey;
ALTER TABLE IF EXISTS ONLY public.appointment_slots DROP CONSTRAINT IF EXISTS appointment_slots_pkey;
ALTER TABLE IF EXISTS ONLY public._prisma_migrations DROP CONSTRAINT IF EXISTS _prisma_migrations_pkey;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.services;
DROP TABLE IF EXISTS public.reviews;
DROP TABLE IF EXISTS public.faqs;
DROP TABLE IF EXISTS public.education;
DROP TABLE IF EXISTS public.doctors;
DROP TABLE IF EXISTS public.certificates;
DROP TABLE IF EXISTS public.carousel_items;
DROP TABLE IF EXISTS public.bookings;
DROP TABLE IF EXISTS public.articles;
DROP TABLE IF EXISTS public.appointment_slots;
DROP TABLE IF EXISTS public._prisma_migrations;
DROP TYPE IF EXISTS public."SlotStatus";
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."BookingStatus";
DROP TYPE IF EXISTS public."ArticleStatus";
--
-- Name: ArticleStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ArticleStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


--
-- Name: BookingStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BookingStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'NO_SHOW'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'ADMIN',
    'DOCTOR'
);


--
-- Name: SlotStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."SlotStatus" AS ENUM (
    'AVAILABLE',
    'BOOKED',
    'BLOCKED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: appointment_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_slots (
    id text NOT NULL,
    doctor_id text NOT NULL,
    date timestamp(3) without time zone NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    duration integer NOT NULL,
    base_price numeric(10,2) NOT NULL,
    discount numeric(10,2),
    discount_type text,
    final_price numeric(10,2) NOT NULL,
    status public."SlotStatus" DEFAULT 'AVAILABLE'::public."SlotStatus" NOT NULL,
    max_bookings integer DEFAULT 1 NOT NULL,
    current_bookings integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    excerpt character varying(200) NOT NULL,
    content text NOT NULL,
    thumbnail text,
    doctor_id text NOT NULL,
    status public."ArticleStatus" DEFAULT 'DRAFT'::public."ArticleStatus" NOT NULL,
    published_at timestamp(3) without time zone,
    meta_description character varying(160),
    keywords text[],
    views integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id text NOT NULL,
    slot_id text NOT NULL,
    doctor_id text NOT NULL,
    patient_name text NOT NULL,
    patient_email text NOT NULL,
    patient_phone text NOT NULL,
    patient_whatsapp text,
    status public."BookingStatus" DEFAULT 'PENDING'::public."BookingStatus" NOT NULL,
    final_price numeric(10,2) NOT NULL,
    notes text,
    confirmation_code text,
    confirmed_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    review_token text,
    review_token_used boolean DEFAULT false NOT NULL
);


--
-- Name: carousel_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carousel_items (
    id text NOT NULL,
    doctor_id text NOT NULL,
    type text NOT NULL,
    src text NOT NULL,
    thumbnail text,
    alt text NOT NULL,
    caption text,
    name text,
    description text,
    upload_date text,
    duration text
);


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id text NOT NULL,
    doctor_id text NOT NULL,
    src text NOT NULL,
    alt text NOT NULL,
    issued_by text NOT NULL,
    year text NOT NULL
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    id text NOT NULL,
    slug text NOT NULL,
    doctor_full_name text NOT NULL,
    last_name text NOT NULL,
    primary_specialty text NOT NULL,
    subspecialties text[],
    cedula_profesional text,
    hero_image text NOT NULL,
    location_summary text NOT NULL,
    city text NOT NULL,
    short_bio text NOT NULL,
    long_bio text NOT NULL,
    years_experience integer NOT NULL,
    conditions text[],
    procedures text[],
    next_available_date timestamp(3) without time zone,
    appointment_modes text[],
    clinic_address text NOT NULL,
    clinic_phone text NOT NULL,
    clinic_whatsapp text,
    clinic_hours jsonb NOT NULL,
    clinic_geo_lat double precision,
    clinic_geo_lng double precision,
    social_linkedin text,
    social_twitter text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    color_palette text DEFAULT 'warm'::text NOT NULL
);


--
-- Name: education; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.education (
    id text NOT NULL,
    doctor_id text NOT NULL,
    institution text NOT NULL,
    program text NOT NULL,
    year text NOT NULL,
    notes text
);


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id text NOT NULL,
    doctor_id text NOT NULL,
    question text NOT NULL,
    answer text NOT NULL
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id text NOT NULL,
    doctor_id text NOT NULL,
    booking_id text,
    patient_name text,
    rating integer NOT NULL,
    comment text NOT NULL,
    approved boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id text NOT NULL,
    doctor_id text NOT NULL,
    service_name text NOT NULL,
    short_description text NOT NULL,
    duration_minutes integer NOT NULL,
    price double precision
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    name text,
    image text,
    role public."Role" DEFAULT 'DOCTOR'::public."Role" NOT NULL,
    doctor_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
4660fa30-75db-448f-989c-fccd21995010	36b1fdbb0d20efec9ed7c943ce4d8d19f8e29cfce7373abae7f4a352d9c7e5bb	2025-12-29 02:06:12.267575+00	20251214164928_init		\N	2025-12-29 02:06:12.267575+00	0
ad9aaeeb-fca4-4042-9b58-892609ffd2be	f93bd999230195c26a909ea2f3e15e1c1c169885007ffef75cc93a045c0f425d	2025-12-29 02:06:36.241124+00	20251215175022_pnpm_db_generate		\N	2025-12-29 02:06:36.241124+00	0
21c3c3ec-5a78-4048-9bca-0f801e78bde7	2470a8703c5a1172477fd3330ff1267092cc38446bd793071124fafd18574a94	\N	20251229002458_add_article_model_for_blog	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20251229002458_add_article_model_for_blog\n\nDatabase error code: 42710\n\nDatabase error:\nERROR: type "SlotStatus" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42710), message: "type \\"SlotStatus\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("typecmds.c"), line: Some(1177), routine: Some("DefineEnum") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20251229002458_add_article_model_for_blog"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20251229002458_add_article_model_for_blog"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:260	2025-12-29 02:10:04.31928+00	2025-12-29 02:06:58.802455+00	0
b3461f04-9d0b-4516-845c-60aa3d1478f5	32737bb7e11d4cdbbb909f2cc9d26caf386e9a628ef5b8a3257b2d5258a26407	2025-12-29 02:10:30.495322+00	20251229002458_add_article_model_for_blog	\N	\N	2025-12-29 02:10:29.746451+00	1
\.


--
-- Data for Name: appointment_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_slots (id, doctor_id, date, start_time, end_time, duration, base_price, discount, discount_type, final_price, status, max_bookings, current_bookings, created_at, updated_at) FROM stdin;
cmjaamdqt0052mg0mhvy9kqo6	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0053mg0ml0y16i49	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0054mg0mrj0orc3l	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0055mg0mc9fk6svk	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0056mg0moatwyk5a	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0057mg0m1a7pkqy7	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0058mg0m4r5aprpk	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt0059mg0mhvrvhob2	cmja88yws0000nv0ml0rgut7a	2025-12-17 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005amg0mds5vtpu2	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005cmg0mtx0ocqet	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005dmg0mnewaddpi	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005emg0mcwgbn921	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005fmg0mhyee1dbk	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005gmg0mud2ex53d	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005hmg0mznz8wiud	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005img0m1cehul1s	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005jmg0mkjccm8pn	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005kmg0mk2fx8joc	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005lmg0mk94r5qxv	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005mmg0mekaz96pv	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005nmg0m2o5zx9hp	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005omg0md1q33gwz	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005pmg0me7bj2om8	cmja88yws0000nv0ml0rgut7a	2025-12-19 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005qmg0m4gkfqg5b	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005rmg0modrgeegq	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005smg0mcml60vxi	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqt005tmg0mbvre8dxy	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005umg0mo9iiqxih	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005vmg0measdp0z0	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005wmg0m1g7xd6ch	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005xmg0mqtfik1nb	cmja88yws0000nv0ml0rgut7a	2025-12-20 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005ymg0mb7a93859	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0060mg0m4rb38qsc	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0061mg0myukmexsu	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0062mg0m7twu3b9w	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0063mg0mkuaa9suv	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0064mg0mnbafqkcu	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0065mg0muzpgsxg2	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0066mg0m49v9f8ns	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaa9t8c0001mg0mzjcsm9fo	cmja88yws0000nv0ml0rgut7a	2025-12-18 00:00:00	10:00	11:00	60	100.00	\N	\N	100.00	BOOKED	1	1	2025-12-17 17:26:30.203	2025-12-17 17:33:09.643
cmjaamdqu0067mg0mwaiihkll	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0068mg0mfyj4tl2t	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0069mg0mfmfkn81s	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006amg0mdi9nwz7v	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006bmg0mm1ca94lw	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006cmg0mrqpx840u	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006dmg0m6picwbm8	cmja88yws0000nv0ml0rgut7a	2025-12-23 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006emg0m9pmdop9r	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006fmg0m42cf4o9a	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006gmg0mnlcx166d	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006hmg0mqmm8ydal	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006img0m5bagfky3	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006jmg0mw1dpitvj	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006kmg0mol540aw5	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006lmg0murp21vxi	cmja88yws0000nv0ml0rgut7a	2025-12-24 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006mmg0mg1h53kwm	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006nmg0m9jr5ryi7	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006omg0m33066ty6	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006pmg0m7a5vkalm	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006qmg0mfarczzwe	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006rmg0m7n3aqz47	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006smg0mi46qih00	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006tmg0mls5xzy1i	cmja88yws0000nv0ml0rgut7a	2025-12-25 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006umg0mdrl4v04n	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006vmg0m7o7d9ds0	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006wmg0m5r9980cy	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006xmg0mf5imv38d	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006ymg0m48ksj7q2	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu006zmg0m9hl32cu6	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu0070mg0mf8al3wlm	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0071mg0muz203uxg	cmja88yws0000nv0ml0rgut7a	2025-12-26 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0072mg0m9l8w1px0	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0073mg0med5ytbtv	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0074mg0mse6mleh4	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0075mg0mmsvepwbh	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0076mg0mkc1qk4xz	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0077mg0m00nff6t1	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0078mg0mnhgcjk53	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0079mg0mwuj4xuio	cmja88yws0000nv0ml0rgut7a	2025-12-27 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007amg0mhp85bq9h	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007bmg0mzojdw39s	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007cmg0mgb5c6qnd	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007dmg0mcekz36rv	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007emg0mhiskz499	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007fmg0m4gffe390	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007gmg0mu5ihq590	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007hmg0m0epbkxes	cmja88yws0000nv0ml0rgut7a	2025-12-28 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007img0mszppmwbc	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007jmg0mr5wovcoj	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007kmg0mvtwy6d3b	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007lmg0moyxcwu2g	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007mmg0me65ygkuo	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007nmg0macsb0u7g	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007omg0m1hi1ohp8	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007pmg0mx7o0azq8	cmja88yws0000nv0ml0rgut7a	2025-12-30 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007qmg0mgnpeiwnp	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007rmg0muh01n1hk	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007smg0m4i4vj7kg	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007tmg0m2gyjwzn8	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007umg0m72jw5xih	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007vmg0mqkh29uq9	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007wmg0mfqjshoo0	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007xmg0myi7jl43x	cmja88yws0000nv0ml0rgut7a	2025-12-31 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007ymg0m7ctb5z5f	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv007zmg0mlza246qe	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0080mg0m2qfzz4y7	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0081mg0m8cq95fx1	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0082mg0mg53nsj02	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0083mg0mt4lcsbfm	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0084mg0mc9so67ka	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0085mg0m1gr8taae	cmja88yws0000nv0ml0rgut7a	2026-01-01 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqv0086mg0m6bzjq8mx	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0087mg0mws8qsgre	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0088mg0mx1qdduac	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0089mg0mep3n06c8	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008amg0mloq5ht0d	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008bmg0mkn5a2zeb	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008cmg0mpw38q3ox	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008dmg0m0p538b3e	cmja88yws0000nv0ml0rgut7a	2026-01-02 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008emg0m0obobq4z	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008fmg0mg35tfnuh	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008gmg0mtobfeqn6	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008hmg0msrtmaagk	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008img0mlwxf3g0d	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008jmg0m8xudkmhi	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008kmg0m1tids7j6	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008lmg0mf2e6j593	cmja88yws0000nv0ml0rgut7a	2026-01-03 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008mmg0mwthf5ssn	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008nmg0mdb7jb485	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008omg0m4l5xdj08	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008pmg0mvqiti290	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008qmg0mk0y6iiig	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008rmg0m9tive2b3	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008smg0meth27o74	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008tmg0mscinkmcf	cmja88yws0000nv0ml0rgut7a	2026-01-04 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008umg0mbexkzhno	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008vmg0m5xrjh5eu	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008wmg0mkg5imqd2	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008xmg0mvjnsslj0	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008ymg0maorjdc1n	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw008zmg0memsrjzs2	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0090mg0mmc6qbm5g	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0091mg0mlov8snhn	cmja88yws0000nv0ml0rgut7a	2026-01-06 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0092mg0mh758nxd9	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0093mg0mwwkd5hlr	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0094mg0m70auguzj	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqw0095mg0mdb3lzjlu	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx0096mg0m941ms99y	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx0097mg0m8t5q3ixv	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx0098mg0mhmqhsfv5	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx0099mg0m9pqyqcae	cmja88yws0000nv0ml0rgut7a	2026-01-07 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009amg0m6pemzxru	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009bmg0m7csd9s3m	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009cmg0mcojbfn2c	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009dmg0mtmgtuh8s	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009emg0mc375k86v	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009fmg0mfzcp6awg	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009gmg0mb87rjhbh	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009hmg0mc0uzn807	cmja88yws0000nv0ml0rgut7a	2026-01-08 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009img0m8sj8uhbr	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009jmg0m6lpqx6fm	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009kmg0mpufx5nkc	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009lmg0meb2upzz4	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009mmg0m2ji92zhe	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009nmg0m2n7rq5t1	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009omg0m6vrzw3cl	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009pmg0mamj738e8	cmja88yws0000nv0ml0rgut7a	2026-01-09 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009qmg0mblkrmc0h	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009rmg0m849iz999	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009smg0mtrrrlhkh	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009tmg0mms6gkc5v	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009umg0m7pp1mlen	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009vmg0m8i2t6n1t	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009wmg0mwpcnxm1p	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009xmg0mqkvdnylz	cmja88yws0000nv0ml0rgut7a	2026-01-10 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009ymg0mz2j0mvhv	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx009zmg0m5aqio81c	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a0mg0mnuaarw02	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a1mg0m0e5mcj8t	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a2mg0mspuhk4fa	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a3mg0mz9natqnh	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a4mg0mr7e6ygo0	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a5mg0m831xznno	cmja88yws0000nv0ml0rgut7a	2026-01-11 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a6mg0mab700q2d	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a7mg0mbtz53wiz	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a8mg0mjhnyu970	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00a9mg0m81p9px8r	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00aamg0mciq07qmm	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00abmg0mf4cn5ysp	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00acmg0m7vrfcoys	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00admg0mkq1s51d4	cmja88yws0000nv0ml0rgut7a	2026-01-13 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00aemg0m2wacug2i	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqx00afmg0m18tpnotb	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00agmg0m0xftohf9	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00ahmg0mbyve7ytz	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00aimg0mqppz9b3n	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00ajmg0mltitc7ui	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00akmg0mlv0zjrn6	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00almg0mbba5uenf	cmja88yws0000nv0ml0rgut7a	2026-01-14 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00ammg0m9xpxixmn	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00anmg0meytk3hn2	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00aomg0me3pavvvq	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00apmg0moh92cyne	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00aqmg0mqst8xpz3	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00armg0mturw9ehk	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00asmg0mx1kg83x3	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00atmg0mcvkvg1fr	cmja88yws0000nv0ml0rgut7a	2026-01-15 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00aumg0mut47ddkb	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00avmg0ma8xw8yfs	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00awmg0mqjnqrnmg	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00axmg0mp7zqpnio	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00aymg0mf7tdcg90	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00azmg0muidrd2dz	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b0mg0m7th2xpsc	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b1mg0m0tkz3k29	cmja88yws0000nv0ml0rgut7a	2026-01-16 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b2mg0mro4okoxe	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	09:00	10:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b3mg0m7iuh3e0u	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b4mg0m2xu18mkr	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	11:00	12:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b5mg0m39wrtc70	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b6mg0mo0igsnrh	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	13:00	14:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b7mg0mm9kd4lpz	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	14:00	15:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b8mg0mt6sxbifo	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	15:00	16:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqy00b9mg0m84q5sa9r	cmja88yws0000nv0ml0rgut7a	2026-01-17 00:00:00	16:00	17:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2025-12-17 17:36:16.657	2025-12-17 17:36:16.657
cmjaamdqu005zmg0m02qaynnd	cmja88yws0000nv0ml0rgut7a	2025-12-21 00:00:00	10:00	11:00	60	1.00	\N	\N	1.00	BOOKED	1	1	2025-12-17 17:36:16.657	2025-12-17 17:38:44.001
cmjqd4awj0010ny0m1k2xw59f	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0011ny0mc6cuua1v	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0012ny0m6vgf8swr	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0013ny0m6nhkp58q	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0014ny0mcgejfr9l	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0015ny0mped9547e	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001bny0mcy7ex0cu	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001cny0mgfz04bsh	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001dny0mmaxar2k0	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001eny0mwgxl16qc	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001fny0m1b4yhqdm	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001gny0m0eppwqi1	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001hny0mgqcwpph3	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001iny0mwu48c4j0	cmjad41j600blmg0m1ziudezw	2026-01-01 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001kny0me647bg1x	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001lny0m9m88i6k2	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001mny0mwbpre933	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001nny0m5c6ll47a	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001ony0mgy5smphq	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001pny0mm07jtz6i	cmjad41j600blmg0m1ziudezw	2026-01-02 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001qny0m0wkvmypb	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001rny0mqpa0dt6h	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001sny0moqpxl7j6	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001tny0mv24lu49z	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001uny0mfv82voiv	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001vny0mxiqbpa21	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001wny0momq8j393	cmjad41j600blmg0m1ziudezw	2026-01-03 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj000yny0m2s9wa8qw	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 16:44:04.255
cmjqd4awj000zny0mlhkp8511	cmjad41j600blmg0m1ziudezw	2025-12-30 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 17:00:04.534
cmjqd4awj0017ny0m1eckjco5	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 17:03:28.162
cmjqd4awj0018ny0megrjxt2i	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 17:05:25.411
cmjqd4awj0019ny0mtgryevaz	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 17:24:02.299
cmjqd4awj001any0mqv3y40sg	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 17:26:18.962
cmjqd4awj001xny0m69zqa6dn	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001yny0mjc6rhy4l	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj001zny0mig1ol13x	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0020ny0m8wzum5rz	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0021ny0m2eh3syv5	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0022ny0maars1fr6	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0023ny0mwhfvfun0	cmjad41j600blmg0m1ziudezw	2026-01-05 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0024ny0mtc8ov62z	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0025ny0mww929l2w	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0026ny0meafgp8ap	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0027ny0mcj2ztk7f	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0028ny0mecvt1qyh	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj0029ny0mqrwl8uqe	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002any0mo347n5r1	cmjad41j600blmg0m1ziudezw	2026-01-06 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002bny0m7woa02sc	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002cny0mumvn5adt	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002dny0m6cpfmj9j	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002eny0mhyp2ednj	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002fny0mmy6gwrfj	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awj002gny0mg1qi423a	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002hny0mv3j6b36d	cmjad41j600blmg0m1ziudezw	2026-01-07 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002iny0mpr3bzahi	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002kny0mdvr1u94n	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002lny0muplp746d	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002mny0me5n07jh5	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002nny0my7w9xl17	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002ony0mha373rr3	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002pny0mnkwu2f2e	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002qny0mpskroebs	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002rny0mpwn65thb	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002sny0mdnr6b0h3	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002tny0m9jnkthec	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002uny0mll7bdc8j	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002vny0m8lgem2p0	cmjad41j600blmg0m1ziudezw	2026-01-09 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002wny0miz32ks6j	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002xny0ml9nsoh9w	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002yny0mnx2b6dhz	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk002zny0m94b7g3vc	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0030ny0me9qe6nvs	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0031ny0mu7y2jkgu	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0032ny0mb0e4rtnb	cmjad41j600blmg0m1ziudezw	2026-01-10 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0033ny0mstubkftg	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0034ny0mbeq90p7z	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0035ny0mz5hmthgz	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0036ny0m5ghke1ux	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0037ny0mig0ea0x3	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0038ny0my0t8cq5p	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk0039ny0mxwujr3l6	cmjad41j600blmg0m1ziudezw	2026-01-12 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003any0m9q0dvpsp	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003bny0mrn772u1c	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003cny0mr1wlg6d0	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003dny0meh69v87t	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003eny0mknz4g2k3	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003fny0mr5ahskxs	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003gny0mpcctiiz0	cmjad41j600blmg0m1ziudezw	2026-01-13 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003hny0my0qmeqgo	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003iny0mmw8y24hz	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003jny0mos18ri9a	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003kny0mwivrgton	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003lny0mvnhqbdrd	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003mny0mqvgql15i	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003nny0morvubsls	cmjad41j600blmg0m1ziudezw	2026-01-14 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003ony0myd8neyb3	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003pny0mv83d2jv3	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003qny0m9upvztn3	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003rny0md23hhdca	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003tny0ml20qcjal	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003uny0m4h93pvsz	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003vny0mtfbdltgg	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003wny0me203ndr0	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003xny0m5vp65uzb	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awk003yny0m1fhlcaim	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl003zny0mqiz7dzpu	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0040ny0ms36jbaey	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0041ny0m3oqt85h0	cmjad41j600blmg0m1ziudezw	2026-01-16 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0042ny0mhqpnuh67	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0043ny0mkryxddiu	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0044ny0mw4mr1gv0	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0045ny0mzzavj4uo	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0046ny0mwzcwxvb0	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0047ny0miw08bbov	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0048ny0mn0z3ue37	cmjad41j600blmg0m1ziudezw	2026-01-17 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0049ny0mwxkirccz	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004any0mwczp90by	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004bny0m8hsjtjya	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004cny0mx7qgudm4	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004dny0m3tp7qd1l	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004eny0mk1vu8uy0	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004fny0mk47ovuh4	cmjad41j600blmg0m1ziudezw	2026-01-19 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004gny0m5pcf8f7a	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004hny0m7d1h0k8z	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004iny0m0ggtffv5	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004kny0m3o1rt9we	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004lny0mv3si1xek	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004mny0m8zq92al4	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004nny0mmqyrm37z	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004ony0mfdm9g4gj	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004qny0m6hcvo4ni	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004rny0mjyg7al0n	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004sny0mzrq8b05x	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004jny0ma7ym0wrx	cmjad41j600blmg0m1ziudezw	2026-01-20 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2026-01-03 01:28:40.432
cmjqd4awl004pny0mxmwofc5n	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2026-01-04 05:05:44.259
cmjqd4awl004tny0mdtueqf7m	cmjad41j600blmg0m1ziudezw	2026-01-21 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004uny0mnc8m5aeo	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004vny0mbgsh7tr8	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004wny0mz3bk0rrr	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004xny0meppo7v5x	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl004zny0muaqtguvt	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0050ny0m826jz1a0	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0051ny0mmlext98g	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0052ny0m2u3nyqse	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0053ny0m9ykjurw5	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0054ny0mbn83srle	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0055ny0ml2pwbjqs	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0056ny0mv6231o1s	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0057ny0m8vbj9s34	cmjad41j600blmg0m1ziudezw	2026-01-23 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0058ny0mgqtpu73c	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl0059ny0mqpy2a2nj	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005any0mx12qtbb8	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005bny0muypg1c7h	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005cny0m4jvkdqi1	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005dny0mv6z78vnd	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005eny0mj5q9gmn8	cmjad41j600blmg0m1ziudezw	2026-01-24 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awl005fny0m6rvq2ifz	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005gny0ml0u1zr2i	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005hny0mapmgeow3	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005iny0mg2fywlfw	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005jny0mimmgw5f1	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005kny0mrnmclo5x	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005lny0m87psjvos	cmjad41j600blmg0m1ziudezw	2026-01-26 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005mny0m5yk0tscg	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005nny0mubw7ogu7	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005ony0mpttvlmav	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005pny0ma42i24rt	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005qny0m5tzlvnyn	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005rny0mnbn4ds0g	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005sny0mztipsdt3	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005tny0mktfzo828	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005uny0mywplqrbb	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005vny0mrh3t14ir	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005wny0m4gvfpzdf	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005xny0m48rt1oo3	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005yny0mi0ooxf1i	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm005zny0mrv4h7jlw	cmjad41j600blmg0m1ziudezw	2026-01-28 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0060ny0m5mjdjah7	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0062ny0mk2st6f3n	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0063ny0m2h1vxogk	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0064ny0mtfb0yb5i	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0065ny0mvc29e1ab	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0066ny0mkqbgrz6s	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0067ny0msu2e7hy0	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0068ny0mpuu5hj9w	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0061ny0m1rvprpjb	cmjad41j600blmg0m1ziudezw	2026-01-29 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2026-01-23 22:45:33.359
cmjqd4awm006any0m43ytbhih	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm006bny0mn8bdyt4i	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm006cny0m3cz05es8	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm006dny0mpcz1k6l9	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	16:00	17:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2025-12-28 23:30:30.831	2025-12-28 23:30:30.831
cmjqd4awm0069ny0mt61iwr10	cmjad41j600blmg0m1ziudezw	2026-01-30 00:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-28 23:31:35.833
cmjqd4awj0016ny0mlyfo6rdy	cmjad41j600blmg0m1ziudezw	2025-12-31 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 02:52:00.079
cmjqd4awk003sny0mw3pn4yin	cmjad41j600blmg0m1ziudezw	2026-01-15 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2025-12-30 22:20:41.164
cmjqd4awl004yny0ml454ex2w	cmjad41j600blmg0m1ziudezw	2026-01-22 00:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2026-01-01 19:56:50.706
cmjqd4awk002jny0md96j9m5w	cmjad41j600blmg0m1ziudezw	2026-01-08 00:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	BOOKED	1	1	2025-12-28 23:30:30.831	2026-01-04 05:09:21.257
cmkx2rs200003o50lcfveel1s	cmjad41j600blmg0m1ziudezw	2026-01-27 00:00:00	12:00	13:00	60	1.00	\N	\N	1.00	AVAILABLE	1	0	2026-01-27 20:54:55.945	2026-01-27 20:54:55.945
\.


--
-- Data for Name: articles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.articles (id, slug, title, excerpt, content, thumbnail, doctor_id, status, published_at, meta_description, keywords, views, created_at, updated_at) FROM stdin;
cmjqnndzl0003rz0lmyd2qj06	sssssss	sssssss	aaaaaaaa	<p>sssssssss</p>	\N	cmjad41j600blmg0m1ziudezw	PUBLISHED	2025-12-29 04:25:17.457	ss	{ss}	31	2025-12-29 04:25:17.458	2026-01-27 03:06:54.264
cmjqkrymb0001rz0lmvu8csk2	dddddds	ddddddsssertertesraaaaaaaaaaaa	ddsfffffffssssssssssssssssssssssssssssssssaaaaaaaaaaaaaa\nSDa\nS\nS\nSS\nS\nS\n	<p>ddddsrtuy etet etwertvevaaaaaaaaaaaaaaaaaaaaa</p>	\N	cmjad41j600blmg0m1ziudezw	PUBLISHED	2025-12-29 04:25:01.547	ddssdafsdfaaaa	{ddddsfsdfsaaaa}	38	2025-12-29 03:04:51.972	2026-01-27 03:06:50.956
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookings (id, slot_id, doctor_id, patient_name, patient_email, patient_phone, patient_whatsapp, status, final_price, notes, confirmation_code, confirmed_at, cancelled_at, created_at, updated_at, review_token, review_token_used) FROM stdin;
cmjaaidfx0015mg0m47e36fnk	cmjaa9t8c0001mg0mzjcsm9fo	cmja88yws0000nv0ml0rgut7a	sss	fafutis.lopez@gmail.com	22		PENDING	100.00		72WJOIBP	\N	\N	2025-12-17 17:33:09.643	2025-12-17 17:33:09.643	\N	f
cmjaapjfm00bbmg0mc8vmo2h0	cmjaamdqu005zmg0m02qaynnd	cmja88yws0000nv0ml0rgut7a	Feliz 	gerardo.lopez@cafeborbon.net	11		PENDING	1.00		O60EJL2G	\N	\N	2025-12-17 17:38:44.001	2025-12-17 17:38:44.001	\N	f
cmjqd5p22006fny0mlqgprbqv	cmjqd4awm0069ny0mt61iwr10	cmjad41j600blmg0m1ziudezw	dc	fafutis.lopez@gmail.com	3333333		PENDING	1000.00		R308FN47	\N	\N	2025-12-28 23:31:35.833	2025-12-28 23:31:35.833	\N	f
cmjrzr9oy000fp70lvkt8ujzh	cmjqd4awj0016ny0mlyfo6rdy	cmjad41j600blmg0m1ziudezw	jerry fafu	jerry@hotmail.com	3315875992	3315875992	PENDING	1000.00	holaaaaaaa como estas	O6YDIZRX	\N	\N	2025-12-30 02:52:00.079	2025-12-30 02:52:00.079	\N	f
cmjsthbfk0001rs0lkvydrd37	cmjqd4awj000yny0m2s9wa8qw	cmjad41j600blmg0m1ziudezw	s	fafutis.lopez@gmail.com	3315875992		PENDING	1000.00		M8BFF6U5	\N	\N	2025-12-30 16:44:04.255	2025-12-30 16:44:04.255	02f1f2596c5bf7125e5426f2e9e5a1846cae86e257db088d965151159b0f9096	f
cmjsu1we30001qg0lx8573853	cmjqd4awj000zny0mlhkp8511	cmjad41j600blmg0m1ziudezw	aa	fafutis.lopez@gmail.com	3315875992		PENDING	1000.00		VV8XK4G1	\N	\N	2025-12-30 17:00:04.534	2025-12-30 17:02:16.617	30bd0c31948f2cecc6f7911e317be529394f224de064ac971495585101e51b8d	t
cmjsu69ic0005qg0lv91dg70y	cmjqd4awj0017ny0m1eckjco5	cmjad41j600blmg0m1ziudezw	ff	fafutis.lopez@gmail.com	+523315875992		PENDING	1000.00		E7DLKJHV	\N	\N	2025-12-30 17:03:28.162	2025-12-30 17:04:19.394	472b3e50777e3343221bea9fa0468eab0d2ea54ca4a949749d6bc15674cc6c87	t
cmjsu8rz80009qg0lre8x27t7	cmjqd4awj0018ny0megrjxt2i	cmjad41j600blmg0m1ziudezw	ffff	fafutis.lopez@gmail.com	3315875992		PENDING	1000.00		DECB5GUN	\N	\N	2025-12-30 17:05:25.411	2025-12-30 17:10:13.676	d3ccd02ec7a61558c1336d9494b3576a71a8ccc3630550f14e89df2be082014a	t
cmjsuwprw000dqg0lvjygpfbq	cmjqd4awj0019ny0mtgryevaz	cmjad41j600blmg0m1ziudezw	sssss	fafutis.lopez@gmail.com	523315875992		PENDING	1000.00		66KP0ZJG	\N	\N	2025-12-30 17:24:02.299	2025-12-30 17:24:02.299	cda3bdce28942b9a3862f86a52810bae597b3d9f38a5b6763f37fb79a798f4c7	f
cmjsuzn82000fqg0lo2hred6a	cmjqd4awj001any0mqv3y40sg	cmjad41j600blmg0m1ziudezw	pp	fafutis.lopez@gmail.com	3315875992		PENDING	1000.00		TME1RXTT	\N	\N	2025-12-30 17:26:18.962	2025-12-30 17:27:22.296	3b215a09cc0253c070f66d1c1d815c19cb2e4ed7dd22413be970949539894d4c	t
cmjt5i7gs0001pi0lx4www5i1	cmjqd4awk003sny0mw3pn4yin	cmjad41j600blmg0m1ziudezw	Pepito	fa@f	3315875992		PENDING	1000.00		DYD3MEFA	\N	\N	2025-12-30 22:20:41.164	2025-12-30 22:20:41.164	7dbb6423e69506309f42a62a89d2dd0c302ef0b49505ecff2be8fb5d1a7baa3c	f
cmjvv8xhv0037pi0lw07766gs	cmjqd4awl004yny0ml454ex2w	cmjad41j600blmg0m1ziudezw	Lorenzo	loris@loro.io	3322474109	3322474109	PENDING	1000.00	Resequedad de ojos.	ZWZT96YQ	\N	\N	2026-01-01 19:56:50.706	2026-01-01 19:56:50.706	d9d4b9ae528b45399ee7c207096a42628d58814061078974fb27fd885c892ee2	f
cmjxmjilt006dpi0lnb6a51rh	cmjqd4awl004jny0ma7ym0wrx	cmjad41j600blmg0m1ziudezw	John	loris@candylaftis.com	3322474109	3322474109	PENDING	1000.00		9JLM2L8W	\N	\N	2026-01-03 01:28:40.432	2026-01-03 01:28:40.432	b2f54f11bee4a7d1aecb44868590103415fd566d54c91f3b77e9bddd59d17901	f
cmjz9qiit006fpi0l0j6o8hxz	cmjqd4awl004pny0mxmwofc5n	cmjad41j600blmg0m1ziudezw	K	ddd@k	3315875992		PENDING	1000.00		L5XN16FE	\N	\N	2026-01-04 05:05:44.259	2026-01-04 05:05:44.259	33af7ea873f68c1bdf7c142d5e694e11a4d2a5de5985a24fee72bf56f3c19913	f
cmjz9v5yi006hpi0lxqypu2vb	cmjqd4awk002jny0md96j9m5w	cmjad41j600blmg0m1ziudezw	Pepe Rodriguez	ueudep@mailto.plus	3322474109		PENDING	1000.00	Hola	ZVXKGK2O	\N	\N	2026-01-04 05:09:21.257	2026-01-04 05:10:13.702	d14daf20e21711c5172c317498a036c4baa10ccfe39aa6f0a77e62ef15c2a625	t
cmkrgymuo006lpi0lk5bcoiww	cmjqd4awm0061ny0m1rvprpjb	cmjad41j600blmg0m1ziudezw	gggg	fafutis.lopez@gmail.com	3315875992		PENDING	1000.00		BZ4CV9MF	\N	\N	2026-01-23 22:45:33.359	2026-01-23 22:45:33.359	bc7404d178574a8488caeed56c35b19ab34856733908bd7838f5a11afb448fca	f
\.


--
-- Data for Name: carousel_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carousel_items (id, doctor_id, type, src, thumbnail, alt, caption, name, description, upload_date, duration) FROM stdin;
cmjanu69t0002ny0mpve2wmd9	cmjabyfdm00bcmg0mp7uaq1nh	image	https://utfs.io/f/63e9Mv5a2tPSTqoimOVi2OazjZCJP4FuhGBQ7LgxV9YwtANp	\N	terminal 7 121625.png		\N	\N	\N	\N
cmjanu69t0003ny0mwbn7t7sw	cmjabyfdm00bcmg0mp7uaq1nh	image	https://utfs.io/f/63e9Mv5a2tPSdZLeGF4xdCtNmgRsObWFkJASQ61TvUy5qpBl	\N	terminal 5.png		\N	\N	\N	\N
cmjanu69t0004ny0mrrr4k0gs	cmjabyfdm00bcmg0mp7uaq1nh	image	https://utfs.io/f/63e9Mv5a2tPSXwqbjqPKbDVCke347wNL2PahSpWdsT9HznBA	\N	terminal 4.png		\N	\N	\N	\N
cmjanu69t0005ny0m9j02n42i	cmjabyfdm00bcmg0mp7uaq1nh	video	https://utfs.io/f/63e9Mv5a2tPSUH9JxCcwqlRpIX3AtLinSbQV1Wx7kwDvONFE	\N	WhatsApp Video 2023-07-16 at 15.40.57.mp4		\N	\N	\N	\N
cmjx8z5n20069pi0lg1sj6c4k	cmjad41j600blmg0m1ziudezw	image	https://utfs.io/f/63e9Mv5a2tPSqnTKhSdGshnD1yr7U49NJm6fTXvBVRiP3YFZ	\N	Dr Jose Cruz video foto.png	Presentacion doctor	\N	\N	\N	\N
\.


--
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.certificates (id, doctor_id, src, alt, issued_by, year) FROM stdin;
cmjanu69t0001ny0megcxmak9	cmjabyfdm00bcmg0mp7uaq1nh	https://utfs.io/f/63e9Mv5a2tPSrucm0OXNxKrCWDTF02MkXOn7t9hIBYRZS5m3	terminal 6 121625.png		
cmjx8z5n20067pi0lxclx8n85	cmjad41j600blmg0m1ziudezw	https://utfs.io/f/63e9Mv5a2tPS3CCp13IITQ5ZDdLBu4hzVMn9SCWROqbKPGfy	Certificado2.png	Tec Monterrey	2023
cmjx8z5n20068pi0ljpvgq0ir	cmjad41j600blmg0m1ziudezw	https://utfs.io/f/63e9Mv5a2tPSLtJZIvYpIV1lfQMiLcUrtGDu8ab60AngepdN	Certificado1.png	Universidad de Guadalajara	2017
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.doctors (id, slug, doctor_full_name, last_name, primary_specialty, subspecialties, cedula_profesional, hero_image, location_summary, city, short_bio, long_bio, years_experience, conditions, procedures, next_available_date, appointment_modes, clinic_address, clinic_phone, clinic_whatsapp, clinic_hours, clinic_geo_lat, clinic_geo_lng, social_linkedin, social_twitter, created_at, updated_at, color_palette) FROM stdin;
cmja88yws0000nv0ml0rgut7a	fffffffff	fffffffff	ff	fff	{}		/images/doctors/sample/doctor-placeholder.svg	fffff, México	fffff	dkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kddkkl 	dkkl dk dk dkd kd dk dk dkd kd kddkdk dk dkd kdkd kd dkd kd	1	{fff}	{ff}	2025-12-17 00:00:00	{in_person,teleconsult}	ssssss	33333332		{"friday": "9:00 AM - 5:00 PM", "monday": "9:00 AM - 6:00 PM", "sunday": "Closed", "tuesday": "9:00 AM - 6:00 PM", "saturday": "Closed", "thursday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM"}	0	0	\N	\N	2025-12-17 16:29:51.676	2025-12-17 16:29:51.676	warm
cmjabyfdm00bcmg0mp7uaq1nh	gerardo	gerardo lop	lopez	x	{}	222222	https://utfs.io/f/63e9Mv5a2tPSIYlFRByATNxjv3g2Pl6nuBsbJk5rG1YdOLEa	guadalajara, México	guadalajara			1	{fff}	{f}	2025-12-17 00:00:00	{in_person,teleconsult}				{"friday": "9:00 AM - 5:00 PM", "monday": "9:00 AM - 6:00 PM", "sunday": "Closed", "tuesday": "9:00 AM - 6:00 PM", "saturday": "Closed", "thursday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM"}	0	0	\N	\N	2025-12-17 18:13:38.266	2025-12-17 23:46:15.233	warm
cmjad41j600blmg0m1ziudezw	dr-jose	Dr. José Cruz Ruizz		Cirujano Oftalmologo	{}	11228457	https://utfs.io/f/63e9Mv5a2tPSaIDAwxGKwlUskK6V9oyH12AC5tTrgbImujEW	Guadalajara, México	Guadalajara	Soy el Dr. José Cruz Ruiz, especialista en oftalmología.\nMi objetivo es brindar una atención oportuna y de calidad, accesible para todos.\nCreo firmemente que la medicina debe ejercerse con honestidad, empatía y compromiso.\n\nCada paciente merece una valoración clara, un trato humano y soluciones real		6	{Catarata,Pterigión,Miopía,Hipermetropía,Astigmatismo,Presbicia,Queratocono,"Ojo seco","Retinopatía diabética",Glaucoma,Uveítis}	{"Tratamiento de ojo seco","Adaptación de lentes de contacto blandos​","Cirugía de “carnosidad” (pterigión)​","Tratamiento del Orzuelo y Chalazión​","Valoración integral de Glaucoma"}	2025-12-17 00:00:00	{in_person,teleconsult}	Av. Ignacio L Vallarta 2527, Arcos Vallarta, 44130 Guadalajara, Jal.	3315875992	3315875992	{"friday": "9:00 AM - 7:00 PM", "monday": "9:00 AM - 7:00 PM", "sunday": "Cerrado", "tuesday": "9:00 AM - 7:00 PM", "saturday": "Cerrado", "thursday": "9:00 AM - 7:00 PM", "wednesday": "9:00 AM - 7:00 PM"}	20.67432	-103.38344	\N	\N	2025-12-17 18:45:59.873	2026-01-02 19:08:55.502	professional
\.


--
-- Data for Name: education; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.education (id, doctor_id, institution, program, year, notes) FROM stdin;
cmjx8z5n20064pi0lyr3pkm9k	cmjad41j600blmg0m1ziudezw	Universidad de Guadalajara	Médico Cirujano y Partero	2017	
cmjx8z5n20065pi0ln7ex4j7o	cmjad41j600blmg0m1ziudezw	Universidad de Guadalajara	Especialista en Oftalmología	2021	
cmjx8z5n20066pi0lh8iuof3x	cmjad41j600blmg0m1ziudezw	Tec de Monterrey	Alta Especialidad en Cirugía Refractiva y de Catarata	2023	
\.


--
-- Data for Name: faqs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.faqs (id, doctor_id, question, answer) FROM stdin;
cmjx8z5n2006api0lpniz226y	cmjad41j600blmg0m1ziudezw	Costo de una consutla	Desde 1000 pesos
cmjx8z5n2006bpi0l2fc8o36i	cmjad41j600blmg0m1ziudezw	Que seguros acepta??	Todos
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, doctor_id, booking_id, patient_name, rating, comment, approved, created_at, updated_at) FROM stdin;
cmjsu4qaz0003qg0lvey56n0f	cmjad41j600blmg0m1ziudezw	cmjsu1we30001qg0lx8573853	aa	5	Muy atento el doctor, me explico muy bien todo, gran atención	t	2025-12-30 17:02:16.617	2025-12-30 17:02:16.617
cmjsu7d1e0007qg0ldymk3vjn	cmjad41j600blmg0m1ziudezw	cmjsu69ic0005qg0lv91dg70y	ff	4	El doctor muy buena gente, muy profesional y claro en su diagnóstico.	t	2025-12-30 17:04:19.394	2025-12-30 17:04:19.394
cmjsueyel000bqg0ljg8cnpph	cmjad41j600blmg0m1ziudezw	cmjsu8rz80009qg0lre8x27t7	ffff	5	Quedé muy bien de la operación y el doctor está bien guapo	t	2025-12-30 17:10:13.676	2025-12-30 17:10:13.676
cmjsv103e000hqg0lnzoazqss	cmjad41j600blmg0m1ziudezw	cmjsuzn82000fqg0lo2hred6a	pp	5	Súper bien todo, como nuevo el ojo	t	2025-12-30 17:27:22.296	2025-12-30 17:27:22.296
cmjz9wafa006jpi0lkb0ex0ic	cmjad41j600blmg0m1ziudezw	cmjz9v5yi006hpi0lxqypu2vb	Pepe Rodriguez	1	Me dejo ciego	t	2026-01-04 05:10:13.702	2026-01-04 05:10:13.702
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services (id, doctor_id, service_name, short_description, duration_minutes, price) FROM stdin;
cmjanu69t0000ny0mqsrbhgzz	cmjabyfdm00bcmg0mp7uaq1nh	sss	ff	30	50
cmjx8z5n2005ypi0l3wx0diqr	cmjad41j600blmg0m1ziudezw	Revisión Oftalmológica Integral	Incluye:\n- Toma de agudeza visual\n- Lensometría\n- Valoración del segmento anterior\n- Refracción visual objetiva y subjetiva\n- Valoración de fondo de ojo\n- Toma de presión intraocular	30	1500
cmjx8z5n2005zpi0lrst0q64j	cmjad41j600blmg0m1ziudezw	Cirugías para Tratamiento de Presbicia	- Presbilasik: Cirugía láser avanzada que corrige la presbicia y mejora la visión a todas las distancias al remodelar la córnea.\n\n- Implante de lente intraocular multifocal: Cirugía rápida y segura que corrige miopía, hipermetropía o astigmatismo con lentes intraoculares multifocales, mejorando la visión cercana, intermedia y lejana.	60	2500
cmjx8z5n20060pi0l5bddrvy7	cmjad41j600blmg0m1ziudezw	Cirugías para Tratamiento de Catarata	- Facoemulsificación con colocación de lente intraocular:  (Monofocal, Foco Extendido, Multifocal o Mix & Match) \n\n- Facoemulsificación asistida con láser de femtosegundo:  (Monofocal, Foco Extendido, Multifocal o Mix & Match)	60	2500
cmjx8z5n20061pi0ljufn6uvk	cmjad41j600blmg0m1ziudezw	Cirugía para dejar de usar lentes	Lasik\nFemtolasik\nPRK\nSMILE\nColocación de lente ICL	60	3000
cmjx8z5n20062pi0lpwtl4i8m	cmjad41j600blmg0m1ziudezw	Tratamiento refractivo y preventivo del Queratocono	Crosslinking\nProtocolo Atenas\nAnillos intraestromales	60	3000
cmjx8z5n20063pi0lbgju1ke3	cmjad41j600blmg0m1ziudezw	Tratamiento de Retinopatía Diabética	Aplicación de Láser\nCirugía de Retina\nAplicación de Antiangiogénico	60	3500
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, image, role, doctor_id, created_at, updated_at) FROM stdin;
cmj9g8n4j0001p80m79yy78fm	lopez.fafutis@gmail.com	Gerardo López	https://lh3.googleusercontent.com/a/ACg8ocLcpzC2xsZJ1XB7kP5Ka54GfvQfweafxdqH9or4CGZQXRHyWw=s96-c	ADMIN	\N	2025-12-17 03:25:47	2025-12-17 03:25:47
cmj9g6y6p0000p80miku18ma6	quebradita.a@gmail.com	gerardo lopez fafutis	https://lh3.googleusercontent.com/a/ACg8ocI84JnpckD0F_Oaeutn7IbLAETZVCsZnyiGJchmmonZxmpKxw=s96-c	DOCTOR	cmjad41j600blmg0m1ziudezw	2025-12-17 03:24:28.178	2025-12-28 23:27:50.169
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: appointment_slots appointment_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_slots
    ADD CONSTRAINT appointment_slots_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: carousel_items carousel_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carousel_items
    ADD CONSTRAINT carousel_items_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: education education_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education
    ADD CONSTRAINT education_pkey PRIMARY KEY (id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: appointment_slots_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointment_slots_date_idx ON public.appointment_slots USING btree (date);


--
-- Name: appointment_slots_doctor_id_date_start_time_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX appointment_slots_doctor_id_date_start_time_key ON public.appointment_slots USING btree (doctor_id, date, start_time);


--
-- Name: appointment_slots_doctor_id_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX appointment_slots_doctor_id_date_status_idx ON public.appointment_slots USING btree (doctor_id, date, status);


--
-- Name: articles_doctor_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_doctor_id_status_idx ON public.articles USING btree (doctor_id, status);


--
-- Name: articles_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_published_at_idx ON public.articles USING btree (published_at);


--
-- Name: articles_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX articles_slug_idx ON public.articles USING btree (slug);


--
-- Name: articles_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX articles_slug_key ON public.articles USING btree (slug);


--
-- Name: bookings_confirmation_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_confirmation_code_key ON public.bookings USING btree (confirmation_code);


--
-- Name: bookings_doctor_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_doctor_id_status_idx ON public.bookings USING btree (doctor_id, status);


--
-- Name: bookings_patient_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_patient_email_idx ON public.bookings USING btree (patient_email);


--
-- Name: bookings_review_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_review_token_idx ON public.bookings USING btree (review_token);


--
-- Name: bookings_review_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_review_token_key ON public.bookings USING btree (review_token);


--
-- Name: bookings_slot_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_slot_id_idx ON public.bookings USING btree (slot_id);


--
-- Name: carousel_items_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX carousel_items_doctor_id_idx ON public.carousel_items USING btree (doctor_id);


--
-- Name: certificates_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX certificates_doctor_id_idx ON public.certificates USING btree (doctor_id);


--
-- Name: doctors_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX doctors_slug_key ON public.doctors USING btree (slug);


--
-- Name: education_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX education_doctor_id_idx ON public.education USING btree (doctor_id);


--
-- Name: faqs_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faqs_doctor_id_idx ON public.faqs USING btree (doctor_id);


--
-- Name: reviews_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_booking_id_idx ON public.reviews USING btree (booking_id);


--
-- Name: reviews_booking_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX reviews_booking_id_key ON public.reviews USING btree (booking_id);


--
-- Name: reviews_doctor_id_approved_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reviews_doctor_id_approved_idx ON public.reviews USING btree (doctor_id, approved);


--
-- Name: services_doctor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_doctor_id_idx ON public.services USING btree (doctor_id);


--
-- Name: users_doctor_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_doctor_id_key ON public.users USING btree (doctor_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: appointment_slots appointment_slots_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_slots
    ADD CONSTRAINT appointment_slots_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: articles articles_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bookings bookings_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bookings bookings_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.appointment_slots(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: carousel_items carousel_items_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carousel_items
    ADD CONSTRAINT carousel_items_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: certificates certificates_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: education education_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.education
    ADD CONSTRAINT education_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: faqs faqs_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: reviews reviews_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: reviews reviews_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: services services_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: users users_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

