--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
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
ALTER TABLE IF EXISTS ONLY practice_management.subareas DROP CONSTRAINT IF EXISTS subareas_area_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.sales DROP CONSTRAINT IF EXISTS sales_quotation_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.sales DROP CONSTRAINT IF EXISTS sales_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.sales DROP CONSTRAINT IF EXISTS sales_client_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotations DROP CONSTRAINT IF EXISTS quotations_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotations DROP CONSTRAINT IF EXISTS quotations_client_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotation_items DROP CONSTRAINT IF EXISTS quotation_items_quotation_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotation_items DROP CONSTRAINT IF EXISTS quotation_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchases DROP CONSTRAINT IF EXISTS purchases_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchases DROP CONSTRAINT IF EXISTS purchases_quotation_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchases DROP CONSTRAINT IF EXISTS purchases_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_purchase_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.proveedores DROP CONSTRAINT IF EXISTS proveedores_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.products DROP CONSTRAINT IF EXISTS products_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_components DROP CONSTRAINT IF EXISTS product_components_product_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_components DROP CONSTRAINT IF EXISTS product_components_attribute_value_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_attributes DROP CONSTRAINT IF EXISTS product_attributes_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_attribute_values DROP CONSTRAINT IF EXISTS product_attribute_values_attribute_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_facturas_xml DROP CONSTRAINT IF EXISTS ledger_facturas_xml_ledger_entry_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_facturas DROP CONSTRAINT IF EXISTS ledger_facturas_ledger_entry_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_sale_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_purchase_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_client_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_attachments DROP CONSTRAINT IF EXISTS ledger_attachments_ledger_entry_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.clients DROP CONSTRAINT IF EXISTS clients_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY practice_management.areas DROP CONSTRAINT IF EXISTS areas_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_encounter_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.prescription_medications DROP CONSTRAINT IF EXISTS prescription_medications_prescription_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.patients DROP CONSTRAINT IF EXISTS patients_doctor_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_medical_history DROP CONSTRAINT IF EXISTS patient_medical_history_patient_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_media DROP CONSTRAINT IF EXISTS patient_media_patient_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_media DROP CONSTRAINT IF EXISTS patient_media_encounter_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_audit_logs DROP CONSTRAINT IF EXISTS patient_audit_logs_patient_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.encounter_versions DROP CONSTRAINT IF EXISTS encounter_versions_encounter_id_fkey;
ALTER TABLE IF EXISTS ONLY medical_records.clinical_encounters DROP CONSTRAINT IF EXISTS clinical_encounters_patient_id_fkey;
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
DROP INDEX IF EXISTS practice_management.subareas_area_id_name_key;
DROP INDEX IF EXISTS practice_management.subareas_area_id_idx;
DROP INDEX IF EXISTS practice_management.sales_sale_number_key;
DROP INDEX IF EXISTS practice_management.sales_sale_number_idx;
DROP INDEX IF EXISTS practice_management.sales_sale_date_idx;
DROP INDEX IF EXISTS practice_management.sales_quotation_id_idx;
DROP INDEX IF EXISTS practice_management.sales_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.sales_doctor_id_payment_status_idx;
DROP INDEX IF EXISTS practice_management.sales_doctor_id_client_id_idx;
DROP INDEX IF EXISTS practice_management.sale_items_sale_id_idx;
DROP INDEX IF EXISTS practice_management.sale_items_product_id_idx;
DROP INDEX IF EXISTS practice_management.quotations_quotation_number_key;
DROP INDEX IF EXISTS practice_management.quotations_quotation_number_idx;
DROP INDEX IF EXISTS practice_management.quotations_issue_date_idx;
DROP INDEX IF EXISTS practice_management.quotations_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.quotations_doctor_id_client_id_idx;
DROP INDEX IF EXISTS practice_management.quotation_items_quotation_id_idx;
DROP INDEX IF EXISTS practice_management.quotation_items_product_id_idx;
DROP INDEX IF EXISTS practice_management.purchases_quotation_id_idx;
DROP INDEX IF EXISTS practice_management.purchases_purchase_number_key;
DROP INDEX IF EXISTS practice_management.purchases_purchase_number_idx;
DROP INDEX IF EXISTS practice_management.purchases_purchase_date_idx;
DROP INDEX IF EXISTS practice_management.purchases_doctor_id_supplier_id_idx;
DROP INDEX IF EXISTS practice_management.purchases_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.purchases_doctor_id_payment_status_idx;
DROP INDEX IF EXISTS practice_management.purchase_items_purchase_id_idx;
DROP INDEX IF EXISTS practice_management.purchase_items_product_id_idx;
DROP INDEX IF EXISTS practice_management.proveedores_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.proveedores_doctor_id_business_name_key;
DROP INDEX IF EXISTS practice_management.proveedores_doctor_id_business_name_idx;
DROP INDEX IF EXISTS practice_management.products_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.products_doctor_id_name_key;
DROP INDEX IF EXISTS practice_management.products_doctor_id_category_idx;
DROP INDEX IF EXISTS practice_management.product_components_product_id_idx;
DROP INDEX IF EXISTS practice_management.product_components_attribute_value_id_idx;
DROP INDEX IF EXISTS practice_management.product_attributes_doctor_id_order_idx;
DROP INDEX IF EXISTS practice_management.product_attributes_doctor_id_name_key;
DROP INDEX IF EXISTS practice_management.product_attributes_doctor_id_is_active_idx;
DROP INDEX IF EXISTS practice_management.product_attribute_values_attribute_id_value_key;
DROP INDEX IF EXISTS practice_management.product_attribute_values_attribute_id_order_idx;
DROP INDEX IF EXISTS practice_management.product_attribute_values_attribute_id_is_active_idx;
DROP INDEX IF EXISTS practice_management.ledger_facturas_xml_uuid_key;
DROP INDEX IF EXISTS practice_management.ledger_facturas_xml_uuid_idx;
DROP INDEX IF EXISTS practice_management.ledger_facturas_xml_ledger_entry_id_idx;
DROP INDEX IF EXISTS practice_management.ledger_facturas_ledger_entry_id_idx;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_transaction_date_idx;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_por_realizar_idx;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_internal_id_key;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_idx;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_entry_type_idx;
DROP INDEX IF EXISTS practice_management.ledger_entries_doctor_id_area_subarea_idx;
DROP INDEX IF EXISTS practice_management.ledger_attachments_ledger_entry_id_idx;
DROP INDEX IF EXISTS practice_management.clients_doctor_id_status_idx;
DROP INDEX IF EXISTS practice_management.clients_doctor_id_business_name_key;
DROP INDEX IF EXISTS practice_management.clients_doctor_id_business_name_idx;
DROP INDEX IF EXISTS practice_management.areas_doctor_id_type_idx;
DROP INDEX IF EXISTS practice_management.areas_doctor_id_name_key;
DROP INDEX IF EXISTS practice_management.areas_doctor_id_idx;
DROP INDEX IF EXISTS medical_records.prescriptions_patient_id_prescription_date_idx;
DROP INDEX IF EXISTS medical_records.prescriptions_doctor_id_status_idx;
DROP INDEX IF EXISTS medical_records.prescriptions_doctor_id_prescription_date_idx;
DROP INDEX IF EXISTS medical_records.prescription_medications_prescription_id_order_idx;
DROP INDEX IF EXISTS medical_records.patients_doctor_id_status_idx;
DROP INDEX IF EXISTS medical_records.patients_doctor_id_last_visit_date_idx;
DROP INDEX IF EXISTS medical_records.patients_doctor_id_internal_id_key;
DROP INDEX IF EXISTS medical_records.patients_doctor_id_first_name_last_name_idx;
DROP INDEX IF EXISTS medical_records.patient_medical_history_patient_id_changed_at_idx;
DROP INDEX IF EXISTS medical_records.patient_medical_history_doctor_id_changed_at_idx;
DROP INDEX IF EXISTS medical_records.patient_media_patient_id_capture_date_idx;
DROP INDEX IF EXISTS medical_records.patient_media_encounter_id_idx;
DROP INDEX IF EXISTS medical_records.patient_media_doctor_id_media_type_idx;
DROP INDEX IF EXISTS medical_records.patient_audit_logs_user_id_timestamp_idx;
DROP INDEX IF EXISTS medical_records.patient_audit_logs_patient_id_timestamp_idx;
DROP INDEX IF EXISTS medical_records.patient_audit_logs_doctor_id_timestamp_idx;
DROP INDEX IF EXISTS medical_records.encounter_versions_encounter_id_version_number_key;
DROP INDEX IF EXISTS medical_records.encounter_versions_encounter_id_created_at_idx;
DROP INDEX IF EXISTS medical_records.clinical_encounters_patient_id_encounter_date_idx;
DROP INDEX IF EXISTS medical_records.clinical_encounters_doctor_id_status_idx;
DROP INDEX IF EXISTS medical_records.clinical_encounters_doctor_id_encounter_date_idx;
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
ALTER TABLE IF EXISTS ONLY practice_management.subareas DROP CONSTRAINT IF EXISTS subareas_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.sales DROP CONSTRAINT IF EXISTS sales_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.sale_items DROP CONSTRAINT IF EXISTS sale_items_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotations DROP CONSTRAINT IF EXISTS quotations_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.quotation_items DROP CONSTRAINT IF EXISTS quotation_items_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchases DROP CONSTRAINT IF EXISTS purchases_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.purchase_items DROP CONSTRAINT IF EXISTS purchase_items_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.proveedores DROP CONSTRAINT IF EXISTS proveedores_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_components DROP CONSTRAINT IF EXISTS product_components_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_attributes DROP CONSTRAINT IF EXISTS product_attributes_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.product_attribute_values DROP CONSTRAINT IF EXISTS product_attribute_values_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_facturas_xml DROP CONSTRAINT IF EXISTS ledger_facturas_xml_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_facturas DROP CONSTRAINT IF EXISTS ledger_facturas_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.ledger_attachments DROP CONSTRAINT IF EXISTS ledger_attachments_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.clients DROP CONSTRAINT IF EXISTS clients_pkey;
ALTER TABLE IF EXISTS ONLY practice_management.areas DROP CONSTRAINT IF EXISTS areas_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.prescription_medications DROP CONSTRAINT IF EXISTS prescription_medications_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.patients DROP CONSTRAINT IF EXISTS patients_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_medical_history DROP CONSTRAINT IF EXISTS patient_medical_history_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_media DROP CONSTRAINT IF EXISTS patient_media_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.patient_audit_logs DROP CONSTRAINT IF EXISTS patient_audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.encounter_versions DROP CONSTRAINT IF EXISTS encounter_versions_pkey;
ALTER TABLE IF EXISTS ONLY medical_records.clinical_encounters DROP CONSTRAINT IF EXISTS clinical_encounters_pkey;
ALTER TABLE IF EXISTS practice_management.subareas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.sales ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.sale_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.quotations ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.quotation_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.purchases ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.purchase_items ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.proveedores ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.products ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.product_components ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.product_attributes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.product_attribute_values ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.ledger_facturas_xml ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.ledger_facturas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.ledger_entries ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.ledger_attachments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.clients ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS practice_management.areas ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS medical_records.prescription_medications ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS medical_records.patient_medical_history ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS medical_records.patient_audit_logs ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS medical_records.encounter_versions ALTER COLUMN id DROP DEFAULT;
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
DROP SEQUENCE IF EXISTS practice_management.subareas_id_seq;
DROP TABLE IF EXISTS practice_management.subareas;
DROP SEQUENCE IF EXISTS practice_management.sales_id_seq;
DROP TABLE IF EXISTS practice_management.sales;
DROP SEQUENCE IF EXISTS practice_management.sale_items_id_seq;
DROP TABLE IF EXISTS practice_management.sale_items;
DROP SEQUENCE IF EXISTS practice_management.quotations_id_seq;
DROP TABLE IF EXISTS practice_management.quotations;
DROP SEQUENCE IF EXISTS practice_management.quotation_items_id_seq;
DROP TABLE IF EXISTS practice_management.quotation_items;
DROP SEQUENCE IF EXISTS practice_management.purchases_id_seq;
DROP TABLE IF EXISTS practice_management.purchases;
DROP SEQUENCE IF EXISTS practice_management.purchase_items_id_seq;
DROP TABLE IF EXISTS practice_management.purchase_items;
DROP SEQUENCE IF EXISTS practice_management.proveedores_id_seq;
DROP TABLE IF EXISTS practice_management.proveedores;
DROP SEQUENCE IF EXISTS practice_management.products_id_seq;
DROP TABLE IF EXISTS practice_management.products;
DROP SEQUENCE IF EXISTS practice_management.product_components_id_seq;
DROP TABLE IF EXISTS practice_management.product_components;
DROP SEQUENCE IF EXISTS practice_management.product_attributes_id_seq;
DROP TABLE IF EXISTS practice_management.product_attributes;
DROP SEQUENCE IF EXISTS practice_management.product_attribute_values_id_seq;
DROP TABLE IF EXISTS practice_management.product_attribute_values;
DROP SEQUENCE IF EXISTS practice_management.ledger_facturas_xml_id_seq;
DROP TABLE IF EXISTS practice_management.ledger_facturas_xml;
DROP SEQUENCE IF EXISTS practice_management.ledger_facturas_id_seq;
DROP TABLE IF EXISTS practice_management.ledger_facturas;
DROP SEQUENCE IF EXISTS practice_management.ledger_entries_id_seq;
DROP TABLE IF EXISTS practice_management.ledger_entries;
DROP SEQUENCE IF EXISTS practice_management.ledger_attachments_id_seq;
DROP TABLE IF EXISTS practice_management.ledger_attachments;
DROP SEQUENCE IF EXISTS practice_management.clients_id_seq;
DROP TABLE IF EXISTS practice_management.clients;
DROP SEQUENCE IF EXISTS practice_management.areas_id_seq;
DROP TABLE IF EXISTS practice_management.areas;
DROP TABLE IF EXISTS medical_records.prescriptions;
DROP SEQUENCE IF EXISTS medical_records.prescription_medications_id_seq;
DROP TABLE IF EXISTS medical_records.prescription_medications;
DROP TABLE IF EXISTS medical_records.patients;
DROP SEQUENCE IF EXISTS medical_records.patient_medical_history_id_seq;
DROP TABLE IF EXISTS medical_records.patient_medical_history;
DROP TABLE IF EXISTS medical_records.patient_media;
DROP SEQUENCE IF EXISTS medical_records.patient_audit_logs_id_seq;
DROP TABLE IF EXISTS medical_records.patient_audit_logs;
DROP SEQUENCE IF EXISTS medical_records.encounter_versions_id_seq;
DROP TABLE IF EXISTS medical_records.encounter_versions;
DROP TABLE IF EXISTS medical_records.clinical_encounters;
DROP TYPE IF EXISTS public."SlotStatus";
DROP TYPE IF EXISTS public."Role";
DROP TYPE IF EXISTS public."BookingStatus";
DROP TYPE IF EXISTS public."ArticleStatus";
DROP TYPE IF EXISTS practice_management."SaleStatus";
DROP TYPE IF EXISTS practice_management."QuotationStatus";
DROP TYPE IF EXISTS practice_management."PurchaseStatus";
DROP TYPE IF EXISTS practice_management."PaymentStatus";
-- *not* dropping schema, since initdb creates it
DROP SCHEMA IF EXISTS practice_management;
DROP SCHEMA IF EXISTS medical_records;
DROP SCHEMA IF EXISTS llm_assistant;
--
-- Name: llm_assistant; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA llm_assistant;


--
-- Name: medical_records; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA medical_records;


--
-- Name: practice_management; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA practice_management;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: PaymentStatus; Type: TYPE; Schema: practice_management; Owner: -
--

CREATE TYPE practice_management."PaymentStatus" AS ENUM (
    'PENDING',
    'PARTIAL',
    'PAID'
);


--
-- Name: PurchaseStatus; Type: TYPE; Schema: practice_management; Owner: -
--

CREATE TYPE practice_management."PurchaseStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'RECEIVED',
    'CANCELLED'
);


--
-- Name: QuotationStatus; Type: TYPE; Schema: practice_management; Owner: -
--

CREATE TYPE practice_management."QuotationStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
);


--
-- Name: SaleStatus; Type: TYPE; Schema: practice_management; Owner: -
--

CREATE TYPE practice_management."SaleStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED',
    'CANCELLED'
);


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
-- Name: clinical_encounters; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.clinical_encounters (
    id text NOT NULL,
    patient_id text NOT NULL,
    doctor_id text NOT NULL,
    encounter_date timestamp(3) without time zone NOT NULL,
    encounter_type character varying(50) NOT NULL,
    chief_complaint text NOT NULL,
    location character varying(100),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    clinical_notes text,
    subjective text,
    objective text,
    assessment text,
    plan text,
    vitals_blood_pressure character varying(20),
    vitals_heart_rate integer,
    vitals_temperature numeric(4,1),
    vitals_weight numeric(5,2),
    vitals_height numeric(5,2),
    vitals_oxygen_sat integer,
    vitals_other text,
    follow_up_date date,
    follow_up_notes text,
    created_by text NOT NULL,
    completed_at timestamp(3) without time zone,
    amended_at timestamp(3) without time zone,
    amendment_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: encounter_versions; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.encounter_versions (
    id integer NOT NULL,
    encounter_id text NOT NULL,
    version_number integer NOT NULL,
    encounter_data jsonb NOT NULL,
    created_by text NOT NULL,
    change_reason text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: encounter_versions_id_seq; Type: SEQUENCE; Schema: medical_records; Owner: -
--

CREATE SEQUENCE medical_records.encounter_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: encounter_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: medical_records; Owner: -
--

ALTER SEQUENCE medical_records.encounter_versions_id_seq OWNED BY medical_records.encounter_versions.id;


--
-- Name: patient_audit_logs; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.patient_audit_logs (
    id integer NOT NULL,
    patient_id text NOT NULL,
    doctor_id text NOT NULL,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id text,
    changes jsonb,
    user_id text NOT NULL,
    user_role character varying(50) NOT NULL,
    ip_address character varying(45),
    user_agent text,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_audit_logs_id_seq; Type: SEQUENCE; Schema: medical_records; Owner: -
--

CREATE SEQUENCE medical_records.patient_audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: medical_records; Owner: -
--

ALTER SEQUENCE medical_records.patient_audit_logs_id_seq OWNED BY medical_records.patient_audit_logs.id;


--
-- Name: patient_media; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.patient_media (
    id text NOT NULL,
    patient_id text NOT NULL,
    doctor_id text NOT NULL,
    encounter_id text,
    media_type character varying(20) NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    mime_type character varying(100),
    thumbnail_url text,
    category character varying(100),
    body_area character varying(100),
    capture_date timestamp(3) without time zone NOT NULL,
    description text,
    doctor_notes text,
    visibility character varying(20) DEFAULT 'internal'::character varying NOT NULL,
    uploaded_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_medical_history; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.patient_medical_history (
    id integer NOT NULL,
    patient_id text NOT NULL,
    doctor_id text NOT NULL,
    field_name character varying(100) NOT NULL,
    old_value text,
    new_value text,
    changed_by text NOT NULL,
    change_reason text,
    changed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: patient_medical_history_id_seq; Type: SEQUENCE; Schema: medical_records; Owner: -
--

CREATE SEQUENCE medical_records.patient_medical_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_medical_history_id_seq; Type: SEQUENCE OWNED BY; Schema: medical_records; Owner: -
--

ALTER SEQUENCE medical_records.patient_medical_history_id_seq OWNED BY medical_records.patient_medical_history.id;


--
-- Name: patients; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.patients (
    id text NOT NULL,
    doctor_id text NOT NULL,
    internal_id character varying(50) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date NOT NULL,
    sex character varying(20) NOT NULL,
    email character varying(255),
    phone character varying(50),
    address text,
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    emergency_contact_name character varying(200),
    emergency_contact_phone character varying(50),
    emergency_contact_relation character varying(100),
    first_visit_date date,
    last_visit_date date,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    tags text[],
    current_allergies text,
    current_chronic_conditions text,
    current_medications text,
    blood_type character varying(10),
    general_notes text,
    photo_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: prescription_medications; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.prescription_medications (
    id integer NOT NULL,
    prescription_id text NOT NULL,
    drug_name character varying(255) NOT NULL,
    presentation character varying(100),
    dosage character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    duration character varying(100),
    quantity character varying(50),
    instructions text NOT NULL,
    warnings text,
    "order" integer DEFAULT 0 NOT NULL
);


--
-- Name: prescription_medications_id_seq; Type: SEQUENCE; Schema: medical_records; Owner: -
--

CREATE SEQUENCE medical_records.prescription_medications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prescription_medications_id_seq; Type: SEQUENCE OWNED BY; Schema: medical_records; Owner: -
--

ALTER SEQUENCE medical_records.prescription_medications_id_seq OWNED BY medical_records.prescription_medications.id;


--
-- Name: prescriptions; Type: TABLE; Schema: medical_records; Owner: -
--

CREATE TABLE medical_records.prescriptions (
    id text NOT NULL,
    patient_id text NOT NULL,
    doctor_id text NOT NULL,
    encounter_id text,
    prescription_date timestamp(3) without time zone NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    doctor_full_name character varying(255) NOT NULL,
    doctor_license character varying(100) NOT NULL,
    doctor_signature text,
    diagnosis text,
    clinical_notes text,
    pdf_url text,
    pdf_generated_at timestamp(3) without time zone,
    version_number integer DEFAULT 1 NOT NULL,
    issued_by text,
    issued_at timestamp(3) without time zone,
    cancelled_at timestamp(3) without time zone,
    cancellation_reason text,
    expires_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: areas; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.areas (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    type character varying(10) DEFAULT 'INGRESO'::character varying NOT NULL
);


--
-- Name: areas_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.areas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: areas_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.areas_id_seq OWNED BY practice_management.areas.id;


--
-- Name: clients; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.clients (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    business_name character varying(255) NOT NULL,
    contact_name character varying(255),
    rfc character varying(13),
    email character varying(255),
    phone character varying(50),
    street character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100) DEFAULT 'México'::character varying NOT NULL,
    industry character varying(100),
    notes text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    logo_url text,
    logo_file_name character varying(255),
    logo_file_size integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.clients_id_seq OWNED BY practice_management.clients.id;


--
-- Name: ledger_attachments; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.ledger_attachments (
    id integer NOT NULL,
    ledger_entry_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    file_type character varying(100),
    attachment_type character varying(20) DEFAULT 'file'::character varying NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ledger_attachments_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.ledger_attachments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_attachments_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.ledger_attachments_id_seq OWNED BY practice_management.ledger_attachments.id;


--
-- Name: ledger_entries; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.ledger_entries (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    amount numeric(12,2) NOT NULL,
    concept character varying(500) NOT NULL,
    bank_account character varying(255),
    forma_de_pago character varying(50) DEFAULT 'efectivo'::character varying,
    internal_id character varying(100) NOT NULL,
    bank_movement_id character varying(255),
    entry_type character varying(20) NOT NULL,
    transaction_date date NOT NULL,
    area character varying(255),
    subarea character varying(255),
    por_realizar boolean DEFAULT false NOT NULL,
    file_url text,
    file_name character varying(255),
    file_size integer,
    file_type character varying(100),
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    client_id integer,
    payment_status character varying(20),
    purchase_id integer,
    sale_id integer,
    supplier_id integer,
    transaction_type character varying(20) DEFAULT 'N/A'::character varying,
    amount_paid numeric(12,2) DEFAULT 0
);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.ledger_entries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.ledger_entries_id_seq OWNED BY practice_management.ledger_entries.id;


--
-- Name: ledger_facturas; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.ledger_facturas (
    id integer NOT NULL,
    ledger_entry_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    file_type character varying(100),
    folio character varying(100),
    uuid character varying(100),
    rfc_emisor character varying(20),
    rfc_receptor character varying(20),
    total numeric(12,2),
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ledger_facturas_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.ledger_facturas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_facturas_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.ledger_facturas_id_seq OWNED BY practice_management.ledger_facturas.id;


--
-- Name: ledger_facturas_xml; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.ledger_facturas_xml (
    id integer NOT NULL,
    ledger_entry_id integer NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    xml_content text,
    folio character varying(100),
    uuid character varying(100),
    rfc_emisor character varying(20),
    rfc_receptor character varying(20),
    total numeric(12,2),
    subtotal numeric(12,2),
    iva numeric(12,2),
    fecha timestamp(6) without time zone,
    metodo_pago character varying(50),
    forma_pago character varying(50),
    moneda character varying(10),
    notes text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ledger_facturas_xml_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.ledger_facturas_xml_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ledger_facturas_xml_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.ledger_facturas_xml_id_seq OWNED BY practice_management.ledger_facturas_xml.id;


--
-- Name: product_attribute_values; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.product_attribute_values (
    id integer NOT NULL,
    attribute_id integer NOT NULL,
    value character varying(255) NOT NULL,
    description text,
    cost numeric(10,2),
    unit character varying(50),
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: product_attribute_values_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.product_attribute_values_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_attribute_values_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.product_attribute_values_id_seq OWNED BY practice_management.product_attribute_values.id;


--
-- Name: product_attributes; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.product_attributes (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    "order" integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: product_attributes_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.product_attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.product_attributes_id_seq OWNED BY practice_management.product_attributes.id;


--
-- Name: product_components; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.product_components (
    id integer NOT NULL,
    product_id integer NOT NULL,
    attribute_value_id integer NOT NULL,
    quantity numeric(10,4) NOT NULL,
    "calculatedCost" numeric(12,2) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: product_components_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.product_components_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_components_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.product_components_id_seq OWNED BY practice_management.product_components.id;


--
-- Name: products; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.products (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    name character varying(255) NOT NULL,
    sku character varying(100),
    category character varying(100),
    description text,
    price numeric(10,2),
    cost numeric(10,2),
    "stockQuantity" integer DEFAULT 0,
    unit character varying(50),
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    image_url text,
    image_file_name character varying(255),
    image_file_size integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: products_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.products_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.products_id_seq OWNED BY practice_management.products.id;


--
-- Name: proveedores; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.proveedores (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    business_name character varying(255) NOT NULL,
    contact_name character varying(255),
    rfc character varying(13),
    email character varying(255),
    phone character varying(50),
    street character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100) DEFAULT 'México'::character varying NOT NULL,
    industry character varying(100),
    notes text,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    logo_url text,
    logo_file_name character varying(255),
    logo_file_size integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: proveedores_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.proveedores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proveedores_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.proveedores_id_seq OWNED BY practice_management.proveedores.id;


--
-- Name: purchase_items; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.purchase_items (
    id integer NOT NULL,
    purchase_id integer NOT NULL,
    product_id integer,
    item_type character varying(20) DEFAULT 'product'::character varying NOT NULL,
    description character varying(500) NOT NULL,
    sku character varying(100),
    quantity numeric(10,4) NOT NULL,
    unit character varying(50),
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount_rate numeric(5,4) DEFAULT 0,
    tax_rate numeric(5,4) DEFAULT 0.16,
    tax_amount numeric(12,2) DEFAULT 0,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.purchase_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_items_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.purchase_items_id_seq OWNED BY practice_management.purchase_items.id;


--
-- Name: purchases; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.purchases (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    supplier_id integer NOT NULL,
    quotation_id integer,
    purchase_number character varying(50) NOT NULL,
    purchase_date date NOT NULL,
    delivery_date date,
    status practice_management."PurchaseStatus" DEFAULT 'PENDING'::practice_management."PurchaseStatus" NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0.16,
    tax numeric(12,2),
    total numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0,
    payment_status practice_management."PaymentStatus" DEFAULT 'PENDING'::practice_management."PaymentStatus" NOT NULL,
    notes text,
    terms_and_conditions text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: purchases_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.purchases_id_seq OWNED BY practice_management.purchases.id;


--
-- Name: quotation_items; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.quotation_items (
    id integer NOT NULL,
    quotation_id integer NOT NULL,
    product_id integer,
    item_type character varying(20) DEFAULT 'product'::character varying NOT NULL,
    description character varying(500) NOT NULL,
    sku character varying(100),
    quantity numeric(10,4) NOT NULL,
    unit character varying(50),
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0,
    tax_rate numeric(5,4) DEFAULT 0.16,
    discount_rate numeric(5,4) DEFAULT 0
);


--
-- Name: quotation_items_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.quotation_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotation_items_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.quotation_items_id_seq OWNED BY practice_management.quotation_items.id;


--
-- Name: quotations; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.quotations (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    client_id integer NOT NULL,
    quotation_number character varying(50) NOT NULL,
    issue_date date NOT NULL,
    valid_until date NOT NULL,
    status practice_management."QuotationStatus" DEFAULT 'DRAFT'::practice_management."QuotationStatus" NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0.16,
    tax numeric(12,2),
    total numeric(12,2) NOT NULL,
    notes text,
    terms_and_conditions text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: quotations_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.quotations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotations_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.quotations_id_seq OWNED BY practice_management.quotations.id;


--
-- Name: sale_items; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.sale_items (
    id integer NOT NULL,
    sale_id integer NOT NULL,
    product_id integer,
    item_type character varying(20) DEFAULT 'product'::character varying NOT NULL,
    description character varying(500) NOT NULL,
    sku character varying(100),
    quantity numeric(10,4) NOT NULL,
    unit character varying(50),
    unit_price numeric(10,2) NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    discount_rate numeric(5,4) DEFAULT 0,
    tax_rate numeric(5,4) DEFAULT 0.16,
    tax_amount numeric(12,2) DEFAULT 0,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: sale_items_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.sale_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_items_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.sale_items_id_seq OWNED BY practice_management.sale_items.id;


--
-- Name: sales; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.sales (
    id integer NOT NULL,
    doctor_id text NOT NULL,
    client_id integer NOT NULL,
    quotation_id integer,
    sale_number character varying(50) NOT NULL,
    sale_date date NOT NULL,
    delivery_date date,
    status practice_management."SaleStatus" DEFAULT 'PENDING'::practice_management."SaleStatus" NOT NULL,
    subtotal numeric(12,2) NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0.16,
    tax numeric(12,2),
    total numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0,
    payment_status practice_management."PaymentStatus" DEFAULT 'PENDING'::practice_management."PaymentStatus" NOT NULL,
    notes text,
    terms_and_conditions text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: sales_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sales_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.sales_id_seq OWNED BY practice_management.sales.id;


--
-- Name: subareas; Type: TABLE; Schema: practice_management; Owner: -
--

CREATE TABLE practice_management.subareas (
    id integer NOT NULL,
    area_id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: subareas_id_seq; Type: SEQUENCE; Schema: practice_management; Owner: -
--

CREATE SEQUENCE practice_management.subareas_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subareas_id_seq; Type: SEQUENCE OWNED BY; Schema: practice_management; Owner: -
--

ALTER SEQUENCE practice_management.subareas_id_seq OWNED BY practice_management.subareas.id;


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
    review_token text,
    review_token_used boolean DEFAULT false NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
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
-- Name: encounter_versions id; Type: DEFAULT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.encounter_versions ALTER COLUMN id SET DEFAULT nextval('medical_records.encounter_versions_id_seq'::regclass);


--
-- Name: patient_audit_logs id; Type: DEFAULT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_audit_logs ALTER COLUMN id SET DEFAULT nextval('medical_records.patient_audit_logs_id_seq'::regclass);


--
-- Name: patient_medical_history id; Type: DEFAULT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_medical_history ALTER COLUMN id SET DEFAULT nextval('medical_records.patient_medical_history_id_seq'::regclass);


--
-- Name: prescription_medications id; Type: DEFAULT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescription_medications ALTER COLUMN id SET DEFAULT nextval('medical_records.prescription_medications_id_seq'::regclass);


--
-- Name: areas id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.areas ALTER COLUMN id SET DEFAULT nextval('practice_management.areas_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.clients ALTER COLUMN id SET DEFAULT nextval('practice_management.clients_id_seq'::regclass);


--
-- Name: ledger_attachments id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_attachments ALTER COLUMN id SET DEFAULT nextval('practice_management.ledger_attachments_id_seq'::regclass);


--
-- Name: ledger_entries id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries ALTER COLUMN id SET DEFAULT nextval('practice_management.ledger_entries_id_seq'::regclass);


--
-- Name: ledger_facturas id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas ALTER COLUMN id SET DEFAULT nextval('practice_management.ledger_facturas_id_seq'::regclass);


--
-- Name: ledger_facturas_xml id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas_xml ALTER COLUMN id SET DEFAULT nextval('practice_management.ledger_facturas_xml_id_seq'::regclass);


--
-- Name: product_attribute_values id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attribute_values ALTER COLUMN id SET DEFAULT nextval('practice_management.product_attribute_values_id_seq'::regclass);


--
-- Name: product_attributes id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attributes ALTER COLUMN id SET DEFAULT nextval('practice_management.product_attributes_id_seq'::regclass);


--
-- Name: product_components id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_components ALTER COLUMN id SET DEFAULT nextval('practice_management.product_components_id_seq'::regclass);


--
-- Name: products id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.products ALTER COLUMN id SET DEFAULT nextval('practice_management.products_id_seq'::regclass);


--
-- Name: proveedores id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.proveedores ALTER COLUMN id SET DEFAULT nextval('practice_management.proveedores_id_seq'::regclass);


--
-- Name: purchase_items id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchase_items ALTER COLUMN id SET DEFAULT nextval('practice_management.purchase_items_id_seq'::regclass);


--
-- Name: purchases id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchases ALTER COLUMN id SET DEFAULT nextval('practice_management.purchases_id_seq'::regclass);


--
-- Name: quotation_items id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotation_items ALTER COLUMN id SET DEFAULT nextval('practice_management.quotation_items_id_seq'::regclass);


--
-- Name: quotations id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotations ALTER COLUMN id SET DEFAULT nextval('practice_management.quotations_id_seq'::regclass);


--
-- Name: sale_items id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sale_items ALTER COLUMN id SET DEFAULT nextval('practice_management.sale_items_id_seq'::regclass);


--
-- Name: sales id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sales ALTER COLUMN id SET DEFAULT nextval('practice_management.sales_id_seq'::regclass);


--
-- Name: subareas id; Type: DEFAULT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.subareas ALTER COLUMN id SET DEFAULT nextval('practice_management.subareas_id_seq'::regclass);


--
-- Data for Name: clinical_encounters; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.clinical_encounters (id, patient_id, doctor_id, encounter_date, encounter_type, chief_complaint, location, status, clinical_notes, subjective, objective, assessment, plan, vitals_blood_pressure, vitals_heart_rate, vitals_temperature, vitals_weight, vitals_height, vitals_oxygen_sat, vitals_other, follow_up_date, follow_up_notes, created_by, completed_at, amended_at, amendment_reason, created_at, updated_at) FROM stdin;
cmk66qgoy0001ufnch1a82dqf	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	2026-01-09 00:00:00	consultation	ssssssss		draft	ssss	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N		3987d6af-0c30-4e9c-a15e-059cfd11077a	\N	\N	\N	2026-01-09 01:16:06.274	2026-01-09 01:16:06.274
cmk67g2ah0001ufb09sic89lu	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	2026-01-09 00:00:00	consultation	sdfgvetecrt		draft		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N		3987d6af-0c30-4e9c-a15e-059cfd11077a	\N	\N	\N	2026-01-09 01:36:00.664	2026-01-09 01:36:00.664
cmk745v140003uf3gjg0n5t4z	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	2026-01-09 00:00:00	consultation	fsdfsdfsdfgvtfger		draft		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N		3987d6af-0c30-4e9c-a15e-059cfd11077a	\N	2026-01-09 16:52:04.065	\N	2026-01-09 16:51:52.024	2026-01-09 16:52:04.067
cmk74qnq70005uf3gms9ckkli	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	2026-01-09 00:00:00	consultation	asdfasdasdasd		draft							\N	\N	\N	\N	\N		\N		3987d6af-0c30-4e9c-a15e-059cfd11077a	\N	\N	\N	2026-01-09 17:08:02.335	2026-01-09 17:08:02.335
cmk74qxf40007uf3gpt6rfrrk	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	2026-01-09 00:00:00	consultation	wertfwertwetvgggggggggggggggggg		draft	evtvet						\N	\N	\N	\N	\N		\N		3987d6af-0c30-4e9c-a15e-059cfd11077a	\N	2026-01-09 18:19:09.79	\N	2026-01-09 17:08:14.897	2026-01-09 18:19:09.792
cmkbop08b0001ufto1aa3x608	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-12 00:00:00	consultation	fff		draft	ff						\N	\N	\N	\N	\N		\N		99621c8a-2a53-4302-ba5e-2d3bc8992a98	\N	\N	\N	2026-01-12 21:37:42.251	2026-01-12 21:37:42.251
cmkln32ks0001ufzgvt939tbr	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-19 00:00:00	consultation	kll		completed							\N	\N	\N	\N	\N		\N		48ac83f7-f775-4741-9419-4f0424d8d898	\N	2026-01-19 20:53:30.27	\N	2026-01-19 20:50:21.003	2026-01-19 20:53:30.272
cmkole2qk0001uf7w0ajyxjnv	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	2026-01-21 00:00:00	consultation	Crecimiento de la panza		draft			Ver por qué le creció la cabeza	Se le inflamó con mucha agua	Ver qué le pasa		\N	\N	200.00	\N	\N		\N		eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-21 22:26:13.687	2026-01-21 22:26:13.687
cmkop4lwi0003uflgq15j6o4y	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	consultation	sdfsdfsd		draft							\N	\N	\N	\N	\N		\N		eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-22 00:10:50.466	2026-01-22 00:10:50.466
cmkop36a20001uflgp6hb3yvz	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	consultation	Estreñimiento severo		completed			Curarlo	Algo le cayó mal, pero no sabemos qué	Un tapón in the anusdddddddddddd		\N	40.0	\N	\N	\N	Presión alta	\N		eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	2026-01-22 00:37:20.468	\N	2026-01-22 00:09:43.561	2026-01-22 00:37:20.467
cmkoqsk9o0005uflgkc9stjp4	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	consultation	asdfasd		draft							\N	\N	\N	\N	\N		\N		eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-22 00:57:27.707	2026-01-22 00:57:27.707
cmkorv0ml0007uflg0d9hk01j	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	consultation	Se siente mal	hospital	draft	Nota clínica: está muy muy enfermo, pero todo bien.		Hacer que se sienta mejor				\N	\N	100.00	\N	\N		2028-02-01	Fecha de seguimiento en un mes, nota, todo bien.	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-22 01:27:21.836	2026-01-22 01:27:21.836
cmkorwhny0009uflgu5hrdham	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	consultation	s		draft		Lo que refiere al paciente.	Vamos a ver qué le pasa.	Todo bien.			\N	\N	\N	\N	\N		\N		eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-22 01:28:30.574	2026-01-22 01:28:30.574
cmkpymj840005uftsw02pun71	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	2026-01-22 00:00:00	follow-up	Diarrea muy fuerte toda la noche		draft	El paciente presenta una inflamación en el popo guate. Probablemente es por lo que comió.	El parásite presenta molestias.	Objetivo es curarlo.		Le dan el tratamiento, se va a sacar unos estudios, le vamos a medicar y le vamos a dar seguimiento en una semana.	90	\N	35.0	95.00	\N	\N	Saturación de oxígeno bien	\N	Seguimiento en una semana.	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-22 21:24:29.498	2026-01-22 21:24:29.498
cmkrhc4ww0003ufusay0rwc8s	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	2026-01-23 00:00:00	consultation	El paciente se siente un poco mal		draft	El paciente le duele un poco el talón, pero está bien.				Objetivo es hacer que se sienta mejor.		\N	\N	\N	\N	\N	Signos vitales bien	2026-02-23	Fecha de seguimiento en un mes a partir de hoy.	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	\N	\N	\N	2026-01-23 22:56:03.18	2026-01-23 22:56:03.18
\.


--
-- Data for Name: encounter_versions; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.encounter_versions (id, encounter_id, version_number, encounter_data, created_by, change_reason, created_at) FROM stdin;
1	cmk74qxf40007uf3gpt6rfrrk	1	{"id": "cmk74qxf40007uf3gpt6rfrrk", "plan": "", "status": "draft", "doctorId": "cmk1peku70001uffc2simlmby", "location": "", "amendedAt": null, "createdAt": "2026-01-09T17:08:14.897Z", "createdBy": "3987d6af-0c30-4e9c-a15e-059cfd11077a", "objective": "", "patientId": "cmk67h25k0003ufb0dppexi42", "updatedAt": "2026-01-09T17:08:14.897Z", "assessment": "", "subjective": "", "completedAt": null, "vitalsOther": "", "followUpDate": null, "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "evtvet", "encounterDate": "2026-01-09T00:00:00.000Z", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "wertfwertwetv", "amendmentReason": null, "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": null, "vitalsBloodPressure": ""}	3987d6af-0c30-4e9c-a15e-059cfd11077a	Updated encounter	2026-01-09 18:19:09.765
2	cmkln32ks0001ufzgvt939tbr	1	{"id": "cmkln32ks0001ufzgvt939tbr", "plan": "", "status": "draft", "doctorId": "cmk1peku70001uffc2simlmby", "location": "", "amendedAt": null, "createdAt": "2026-01-19T20:50:21.003Z", "createdBy": "48ac83f7-f775-4741-9419-4f0424d8d898", "objective": "", "patientId": "cmk66jdi50003ufw4f3vmn1yj", "updatedAt": "2026-01-19T20:50:21.003Z", "assessment": "", "subjective": "", "completedAt": null, "vitalsOther": "", "followUpDate": null, "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "", "encounterDate": "2026-01-19T00:00:00.000Z", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "kll", "amendmentReason": null, "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": null, "vitalsBloodPressure": ""}	48ac83f7-f775-4741-9419-4f0424d8d898	Updated encounter	2026-01-19 20:53:30.265
3	cmkop36a20001uflgp6hb3yvz	1	{"id": "cmkop36a20001uflgp6hb3yvz", "plan": "Un tapón in the anus", "status": "draft", "doctorId": "cmk1peku70001uffc2simlmby", "location": "", "amendedAt": null, "createdAt": "2026-01-22T00:09:43.561Z", "createdBy": "eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf", "objective": "Curarlo", "patientId": "cmk66jdi50003ufw4f3vmn1yj", "updatedAt": "2026-01-22T00:09:43.561Z", "assessment": "Algo le cayó mal, pero no sabemos qué", "subjective": "", "completedAt": null, "vitalsOther": "Presión alta", "followUpDate": null, "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "", "encounterDate": "2026-01-22T00:00:00.000Z", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "Estreñimiento severo", "amendmentReason": null, "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": 40, "vitalsBloodPressure": ""}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	Updated encounter	2026-01-22 00:37:20.453
\.


--
-- Data for Name: patient_audit_logs; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.patient_audit_logs (id, patient_id, doctor_id, action, resource_type, resource_id, changes, user_id, user_role, ip_address, user_agent, "timestamp") FROM stdin;
1	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	create_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 00:50:59.298
2	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:10:35.558
3	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:14:58.223
4	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:14:58.313
5	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:15:45.365
6	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:15:49.813
7	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:15:49.874
8	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:15:53.094
9	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:15:53.223
10	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:06.399
11	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:10.761
12	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:10.841
13	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:14.907
14	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:14.964
15	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:24.179
16	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:24.235
17	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:29.463
18	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:29.525
19	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:32.924
20	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 01:16:32.982
21	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:34:32.481
22	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:34:32.843
23	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:34:38.401
24	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:34:38.505
25	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:35:45.998
26	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:35:46.553
27	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmk67g2ah0001ufb09sic89lu	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:00.742
28	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk67g2ah0001ufb09sic89lu	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:04.121
29	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk67g2ah0001ufb09sic89lu	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:04.208
30	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:08.57
31	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:08.638
32	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:20.364
33	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:20.443
34	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk67g2ah0001ufb09sic89lu	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:22.514
35	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk67g2ah0001ufb09sic89lu	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:22.567
36	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:24.446
37	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:24.506
38	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:26.098
39	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk66qgoy0001ufnch1a82dqf	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:26.18
40	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:28.033
41	cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	view_patient	patient	cmk65u5c30001ufw4dyvoy5bm	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:28.092
42	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:33.976
43	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:34.034
44	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:47.174
45	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:47.395
46	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:47.451
47	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:53.797
48	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:36:53.85
49	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:43:02.611
50	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 01:43:02.732
51	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	create_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:36.437
52	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:39.84
53	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:39.943
54	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:52.063
55	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:55.146
56	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:51:55.286
57	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:00.195
58	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:00.293
59	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	update_encounter	encounter	cmk745v140003uf3gjg0n5t4z	{"status": "draft", "location": "", "followUpDate": "", "clinicalNotes": "", "encounterDate": "2026-01-09", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "fsdfsdfsdfgvtfger"}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:04.08
60	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:04.282
61	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk745v140003uf3gjg0n5t4z	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:04.345
62	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:06.602
63	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:06.676
64	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:10.74
65	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:10.83
66	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	update_patient	patient	cmk745iy40001uf3gze4ztct3	{"sex": "male", "city": "", "tags": [], "email": "", "phone": "", "state": "", "address": "", "lastName": "fffffffffffffffffffffffff", "bloodType": "", "firstName": "f", "internalId": "P1767977496355", "postalCode": "", "dateOfBirth": "2026-01-07", "generalNotes": "", "currentAllergies": "", "currentMedications": "", "emergencyContactName": "", "emergencyContactPhone": "", "currentChronicConditions": "", "emergencyContactRelation": ""}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:14.845
67	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:15.042
68	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:52:15.108
69	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:59:37.555
70	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 16:59:37.639
71	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:00:24.001
72	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:00:24.058
73	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:36.222
74	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:36.302
75	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:41.022
76	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:41.122
77	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:43.644
78	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:43.697
79	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:49.601
80	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:49.787
81	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:07:56.184
82	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmk74qnq70005uf3gms9ckkli	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:02.357
83	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qnq70005uf3gms9ckkli	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:02.974
84	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qnq70005uf3gms9ckkli	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:03.04
85	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:07.055
86	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:07.112
87	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:14.906
88	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:15.164
89	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:15.223
90	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:17.233
91	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:17.294
92	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:22.454
93	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:22.503
94	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:34.298
95	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:42.531
96	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:08:42.598
97	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:15.561
98	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:15.656
99	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:21.518
100	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:21.595
101	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:23.445
102	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:23.504
103	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:25.291
104	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:25.345
105	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:27.814
106	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:27.897
107	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:38.267
108	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:16:38.331
109	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:04.685
110	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:04.896
111	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:06.67
112	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:06.792
113	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:09.026
114	cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	view_patient	patient	cmk745iy40001uf3gze4ztct3	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 17:47:09.167
115	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:06:28.374
116	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:06:28.819
117	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:06:35.185
118	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:06:35.415
119	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:07:27.633
120	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:07:31.901
121	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:07:32.315
122	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:10.264
123	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:10.361
124	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:12.547
125	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:12.656
204	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:21.77
126	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:14.232
127	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:14.323
128	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:16.323
129	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:16.442
130	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:19.857
131	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:08:19.932
132	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:03.277
133	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	update_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	{"plan": "", "status": "draft", "location": "", "objective": "", "assessment": "", "subjective": "", "vitalsOther": "", "followUpDate": "", "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "evtvet", "encounterDate": "2026-01-09", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "wertfwertwetvgggggggggggggggggg", "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": null, "vitalsBloodPressure": ""}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:09.8
134	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:11.595
135	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qxf40007uf3gpt6rfrrk	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:11.668
136	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:18.751
137	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:18.911
138	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:24.949
139	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:25.037
140	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	update_patient	patient	cmk67h25k0003ufb0dppexi42	{"sex": "male", "city": "", "tags": [], "email": "", "phone": "", "state": "", "address": "", "lastName": "sdfg", "bloodType": "", "firstName": "dfg dfgdrgsdvsdggggv", "internalId": "P1767922607148", "postalCode": "", "dateOfBirth": "2026-01-04", "generalNotes": "", "currentAllergies": "", "currentMedications": "", "emergencyContactName": "", "emergencyContactPhone": "", "currentChronicConditions": "", "emergencyContactRelation": ""}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:30.377
141	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:30.608
142	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:30.673
143	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:36.453
144	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 18:19:36.524
145	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:10.27
146	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:10.496
147	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:38.098
148	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:38.209
149	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:54.874
150	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:48:54.935
151	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:39.918
152	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:39.977
153	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:41.446
154	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:41.52
155	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:50.154
156	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:50:50.227
157	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:07.813
158	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:07.895
159	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:07.961
160	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:07.991
161	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:09.664
162	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:09.721
163	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:17.865
164	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:17.93
165	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:24.172
166	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:24.28
167	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:34.107
168	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:34.168
169	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:41.642
170	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:41.644
171	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:41.74
172	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:41.742
205	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:21.872
173	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:42.765
174	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:42.951
176	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:46.209
183	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:52.997
175	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:46.207
177	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:46.284
178	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:46.322
179	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:47.944
180	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:48.042
181	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:52.89
182	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:52.893
184	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:52.998
185	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:54.575
186	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:51:54.65
187	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:53:58.155
188	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:53:58.215
189	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:54:00.198
190	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:54:00.208
191	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:54:00.3
192	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:54:00.302
193	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:55:37.375
194	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:55:37.488
195	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:57:27.885
196	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:59:27.615
197	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:59:27.687
198	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:59:27.705
199	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 18:59:27.763
200	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:02.801
201	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:03.688
202	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:11.831
203	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:11.922
206	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:27.093
207	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 19:51:27.201
208	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:52:51.604
209	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:52:51.742
210	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:52:55.34
211	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:52:57.958
212	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:52:58.092
213	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:57:52.967
214	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:58:00.158
215	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:58:00.267
216	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:58:01.968
217	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 19:58:02.068
218	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:02:36.008
219	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:02:57.723
220	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmk7azly30001uf2sk1jzc9wj	{"drugName": "aa", "medicationId": 1}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:03:01.093
221	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	{"status": "issued", "issuedAt": "2026-01-09T20:03:03.313Z"}	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:03:03.316
222	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:03:08.642
223	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-09 20:03:08.761
224	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 20:05:55.757
225	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	generate_prescription_pdf	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 20:06:04.264
226	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 20:06:20.348
227	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-09 20:06:20.458
228	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:41.916
229	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:42.22
230	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:47.411
231	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:47.608
232	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:49.738
233	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:49.796
234	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:52.493
235	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:52.569
236	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:54.044
237	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:54.137
238	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:55.513
239	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:55.572
241	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:57.66
248	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:06.979
249	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:06.982
250	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:07.11
251	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:07.113
252	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:09.025
253	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:09.105
254	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:13.736
255	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:13.82
256	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:20.156
257	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:20.284
258	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:24.505
259	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:24.565
260	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:29.23
261	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:29.297
262	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:35.775
263	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:35.846
240	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:57.649
242	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:57.797
243	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:31:57.827
244	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:01.597
245	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:01.649
246	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:01.719
247	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:01.774
266	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:49.177
267	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:49.24
268	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:53.999
269	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:54.066
264	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:36.855
265	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-10 18:32:36.932
270	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:29.871
271	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:30.045
272	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:35.524
273	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:35.638
274	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:36.717
275	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:00:36.795
276	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:11:55.97
277	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:11:56.139
278	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:01.004
279	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:01.073
280	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:02.668
281	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:02.757
282	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:04.909
283	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:12:04.965
284	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:04.359
285	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:09.676
286	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:09.794
287	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:26.741
288	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:26.815
289	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:28.979
290	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:28.985
291	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:29.125
292	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:29.127
293	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:31.018
294	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:31.148
295	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:32.778
298	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:32.912
296	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:32.775
297	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:32.911
299	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:35.115
300	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:35.184
301	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:43.381
302	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:43.459
303	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:49.913
304	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:49.969
305	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:52.341
306	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:52.411
307	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:53.558
308	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:53.707
309	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:59.123
310	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:56:59.208
311	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:57:02.766
312	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 18:57:03.018
313	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 19:23:05.417
314	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 19:23:05.517
315	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 19:23:09.739
316	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-11 19:23:09.827
317	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:10.88
318	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:11.069
319	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:20.354
320	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:20.52
321	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:24.492
322	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:24.598
323	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:27.888
324	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:28.036
325	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:33.786
326	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:33.881
327	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:38.488
328	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:38.587
329	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:42.923
330	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:42.991
331	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:44.824
332	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:44.951
333	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:48.868
334	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:48.953
335	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:50.531
336	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:50.688
337	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:56.55
338	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:56.915
339	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:56.984
340	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:18:57.046
341	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:01.01
342	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:01.143
343	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:01.158
344	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:01.31
345	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:04.603
346	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:04.816
347	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:11.21
348	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	3987d6af-0c30-4e9c-a15e-059cfd11077a	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-12 16:19:11.642
664	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:47:39.059
349	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:18.184
350	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:18.425
351	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:29.299
352	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:29.373
353	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:42.291
354	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:45.984
355	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	99621c8a-2a53-4302-ba5e-2d3bc8992a98	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36	2026-01-12 21:37:46.136
356	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-15 02:58:04.22
357	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36	2026-01-15 02:58:04.782
389	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:43:45.441
390	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:43:45.661
391	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:43:58.751
392	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:43:58.889
393	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:05.175
394	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:05.309
395	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:08.274
396	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:08.33
397	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:13.013
398	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:13.151
399	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:15.217
400	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 14:44:15.301
401	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:06:35.917
402	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:06:36.129
403	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:07:38.204
404	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:07:38.382
405	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:10:46.398
406	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:10:46.491
407	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:11:43.889
408	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:11:44.077
409	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:11:46.043
410	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:11:46.129
411	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:17:04.806
412	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:17:05.555
413	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:17:05.874
414	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:17:05.958
415	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:30:23.498
416	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:30:24.351
418	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:30:25.702
417	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 16:30:25.7
419	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:50:51.649
420	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:50:52.009
421	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:15.21
422	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:15.373
423	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:20.562
424	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:20.691
425	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:27.17
426	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:27.259
427	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:31.669
428	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:31.725
429	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:40.152
430	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:40.226
431	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:45.927
432	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:46.059
433	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:47.552
434	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:47.645
435	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:55.641
436	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:55.883
437	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:56.032
438	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:51:56.245
439	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:14.814
440	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:14.998
441	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:15.181
442	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:15.265
443	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:17.545
444	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:58:17.654
445	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:06.253
446	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:06.326
447	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:24.166
448	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:24.285
449	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:40.656
450	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-16 23:59:40.747
451	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:08.324
452	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:08.418
453	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:37.006
454	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:37.254
455	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:38.985
456	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:39.059
457	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:40.281
458	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:40.416
459	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:41.684
460	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:41.769
461	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:43.467
462	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:00:43.581
463	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:04:36.742
464	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:04:36.84
465	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:04:56.302
466	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:04:56.383
467	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:05:00.112
468	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:05:00.447
469	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:05:03.522
470	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36	2026-01-17 00:05:03.652
471	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:46:22.239
472	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:46:22.54
473	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:47:00.4
474	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:47:00.529
475	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:48:01.925
476	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:48:01.983
477	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:16.701
478	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:16.803
479	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:23.05
480	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:23.172
481	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:29.708
482	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:49:29.82
483	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:21.039
484	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:21.326
485	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:21.397
486	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:24.525
487	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:24.615
488	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:31.086
489	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:31.19
490	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:36.303
491	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:36.379
492	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:42.124
493	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:42.204
494	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:45.801
495	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:50:45.871
496	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:51:49.932
497	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkln4z6g0003ufzgsw6blivp	{"drugName": "parecetamol", "medicationId": 2}	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:51:53.835
498	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	{"status": "issued", "issuedAt": "2026-01-19T20:51:55.800Z"}	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:51:55.803
499	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:00.856
500	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:00.929
501	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:04.937
502	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:04.997
665	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:47:39.121
503	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:07.437
504	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:07.5
505	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:09.167
506	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:09.247
507	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:15.223
508	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:15.347
509	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:16.871
510	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:16.943
511	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:19.559
512	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:19.642
513	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:21.514
514	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkbop08b0001ufto1aa3x608	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:21.572
515	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:23.394
516	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:23.526
517	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:24.997
518	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:25.072
519	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:28.62
520	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:28.674
521	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:32.782
522	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:32.835
523	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:34.264
524	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:34.345
525	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:36.62
526	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:36.685
527	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:38.392
528	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:38.471
529	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:45.638
530	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:45.7
531	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:47.321
532	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:47.43
533	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:48.893
534	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:48.981
535	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:55.036
536	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:55.11
537	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:56.201
538	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:52:56.289
539	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:05.016
540	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:05.079
541	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:10.237
542	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:10.314
543	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:12.048
544	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:12.109
545	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:16.499
546	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:16.562
547	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	update_encounter	encounter	cmkln32ks0001ufzgvt939tbr	{"plan": "", "status": "completed", "location": "", "objective": "", "assessment": "", "subjective": "", "vitalsOther": "", "followUpDate": "", "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "", "encounterDate": "2026-01-19", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "kll", "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": null, "vitalsBloodPressure": ""}	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:30.279
548	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:30.482
549	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:30.534
550	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:33.322
551	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:33.382
552	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:35.304
553	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:35.37
554	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:39.549
555	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:39.605
556	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:43.175
557	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:53:43.237
558	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:54:20.032
559	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:54:20.101
560	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:54:23.493
561	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 20:54:23.563
562	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:23.32
563	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:23.412
564	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:28.547
565	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:28.627
566	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:28.658
567	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:28.79
568	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:39.451
569	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:39.891
570	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:40.098
571	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	48ac83f7-f775-4741-9419-4f0424d8d898	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:19:40.395
572	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:06.271
573	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:06.559
574	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:08.364
575	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:08.512
576	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:08.536
577	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:08.609
578	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:10.255
579	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:10.371
580	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:10.516
581	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:26:10.663
582	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:04.746
583	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:04.979
584	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:08.851
585	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:09.205
586	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:10.635
587	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:10.762
588	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:10.806
589	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:10.904
590	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:12.445
591	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:12.775
592	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:12.975
593	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:29:13.098
594	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:30.892
595	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:31.207
596	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:34.05
597	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:34.162
598	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:34.164
599	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:34.223
600	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:36.032
601	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:36.216
602	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:36.342
603	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:30:36.521
604	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:32:49.792
605	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:32:50.016
606	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:05.64
607	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:05.835
608	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:05.941
609	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:06.834
610	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:07.737
611	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:08.508
612	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:08.681
613	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:33:09.249
614	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	upload_media	media	cmklop6fv0005ufzgv2j1f96c	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:32.197
615	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:32.711
616	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:32.835
617	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:32.896
618	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:32.992
619	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:35.862
620	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:36.007
621	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:37.907
622	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:38.014
623	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:38.037
624	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:38.116
625	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:39.968
626	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:40.124
627	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:43.171
628	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:43.393
629	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qnq70005uf3gms9ckkli	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:52.354
744	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:04.217
630	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmk74qnq70005uf3gms9ckkli	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:52.426
631	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:53.833
632	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:53.899
642	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:17.498
643	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:17.502
645	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:17.621
646	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:19.578
647	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:19.645
633	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:55.825
634	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:55.827
635	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:55.937
636	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:35:55.975
637	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:07.481
638	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:07.652
639	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:07.726
640	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:07.78
641	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	upload_media	media	cmkloq54v0007ufzgdc7a4j1i	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:17.028
644	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:17.611
648	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:23.782
649	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-19 21:36:23.848
650	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:20:21.991
651	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:20:22.169
652	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:43:59.165
653	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:43:59.254
654	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:44:05.024
655	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:44:05.088
656	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:44:58.44
657	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:44:58.495
658	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:45:36.362
659	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:45:36.421
660	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:45:56.18
661	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:45:56.29
662	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:46:02.597
663	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmk7azly30001uf2sk1jzc9wj	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:46:02.766
666	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:48:02.547
667	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	d100dcc2-0433-478c-9b6b-f3773d41bc57	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 02:48:02.611
668	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:47:48.51
669	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:47:48.701
670	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:02.643
671	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:02.734
672	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:08.81
673	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:08.901
674	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:23.518
675	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:23.641
676	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:30.334
677	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:48:30.44
678	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:50:57.299
679	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:50:57.476
680	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:53:17.112
681	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:53:17.246
682	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:55:51.818
683	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:55:51.925
684	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:59:45.853
685	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 03:59:45.995
686	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 04:02:19.319
687	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 04:02:19.397
688	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 15:40:58.037
689	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 15:40:58.269
690	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 16:46:00.215
691	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 16:46:00.496
692	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 16:46:05.475
693	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 16:46:05.607
694	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:11:32.217
695	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:11:32.358
696	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:13:02.577
697	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:13:02.669
698	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:20:40.812
699	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:20:40.961
700	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:24:24.367
701	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:24:24.447
702	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:30:31.817
703	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 18:30:31.956
704	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:14:49.011
705	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:14:49.165
706	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:15:02.742
707	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:15:02.802
708	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:15:05.246
709	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:15:05.329
710	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:29:45.329
711	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:29:45.548
712	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:29:52.596
713	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:29:52.667
714	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:30:04.412
715	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:30:04.48
716	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:30:56.052
717	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-20 19:30:56.124
718	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 21:40:35.383
719	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 21:40:35.775
720	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:03:03.009
721	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:03:03.119
722	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:03:56.197
723	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:03:56.282
724	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:22:56.625
725	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:22:56.801
726	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkole2qk0001uf7w0ajyxjnv	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:26:13.798
727	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkole2qk0001uf7w0ajyxjnv	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:26:31.673
728	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkole2qk0001uf7w0ajyxjnv	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 22:26:31.773
729	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkole2qk0001uf7w0ajyxjnv	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 23:47:13.507
730	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkole2qk0001uf7w0ajyxjnv	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 23:47:15.181
731	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 23:48:53.364
732	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-21 23:48:54.113
733	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:04:08.37
734	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:04:08.574
735	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:43.61
736	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:47.578
737	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:47.698
738	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:50.363
739	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:50.479
740	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:55.845
741	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:55.985
742	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:59.452
743	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:09:59.574
745	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:04.286
746	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:08.334
747	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkln4z6g0003ufzgsw6blivp	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:08.449
748	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:21.947
749	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:22.028
750	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:25.105
751	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:25.218
752	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:39.962
753	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:40.042
754	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkop4lwi0003uflgq15j6o4y	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:50.474
755	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop4lwi0003uflgq15j6o4y	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:50.975
756	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop4lwi0003uflgq15j6o4y	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:51.048
757	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:55.774
758	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	view_patient	patient	cmk67h25k0003ufb0dppexi42	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:10:55.858
759	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:01.424
760	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:01.49
761	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:03.89
762	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:04.031
763	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:08.956
764	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:09.031
765	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:16.086
766	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:16.155
767	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:17.754
768	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:17.864
769	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:18.964
770	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:19.147
771	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:19.86
772	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:11:19.933
773	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:04.443
774	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:04.631
775	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:11.017
776	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:11.102
777	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	update_encounter	encounter	cmkop36a20001uflgp6hb3yvz	{"plan": "Un tapón in the anusdddddddddddd", "status": "completed", "location": "", "objective": "Curarlo", "assessment": "Algo le cayó mal, pero no sabemos qué", "subjective": "", "vitalsOther": "Presión alta", "followUpDate": "", "vitalsHeight": null, "vitalsWeight": null, "clinicalNotes": "", "encounterDate": "2026-01-22", "encounterType": "consultation", "followUpNotes": "", "chiefComplaint": "Estreñimiento severo", "vitalsHeartRate": null, "vitalsOxygenSat": null, "vitalsTemperature": "40", "vitalsBloodPressure": ""}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:20.49
778	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:20.727
779	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:20.857
780	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:26.487
781	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:26.595
782	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:29.284
783	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:29.356
784	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:31.151
785	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:31.21
786	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:40.906
787	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:41.034
788	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:46.806
789	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:46.867
790	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:48.902
791	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:37:48.968
792	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:40:46.93
793	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:40:47.164
794	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:16.149
795	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:16.292
796	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:22.586
797	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:22.64
798	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:28.74
799	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:28.796
800	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:30.538
801	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:30.607
802	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:45.188
803	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkln32ks0001ufzgvt939tbr	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:45.248
804	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:47.227
805	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:48:47.327
806	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:17.042
807	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:17.136
808	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:23.239
809	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:23.323
810	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:46.368
811	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:49:46.444
812	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:25.734
813	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:25.846
814	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:31.926
815	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:32.007
816	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:39.022
817	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:39.149
818	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:41.169
819	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:41.374
820	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:47.266
821	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:53:47.32
822	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:56:15.087
823	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:56:15.164
824	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:17.954
825	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:18.035
826	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkoqsk9o0005uflgkc9stjp4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:27.73
827	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkoqsk9o0005uflgkc9stjp4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:27.998
828	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkoqsk9o0005uflgkc9stjp4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:28.067
829	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:31.284
830	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:57:31.348
831	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:59:53.275
832	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 00:59:53.339
833	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkoqsk9o0005uflgkc9stjp4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:30.609
834	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkoqsk9o0005uflgkc9stjp4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:30.669
835	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:33.99
836	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:34.056
837	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:35.126
838	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkop36a20001uflgp6hb3yvz	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:00:35.202
839	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:02:25.391
840	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:02:25.462
841	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:03:56.124
842	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:03:56.177
843	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:11.267
844	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:11.356
845	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:35.419
846	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:35.5
847	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:35.666
848	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:35.751
849	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:46.207
850	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:46.306
851	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:46.311
852	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:46.517
853	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:48.643
854	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:04:48.813
855	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:05:11.001
856	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:05:11.072
857	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:05:16.259
858	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:05:16.329
859	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:13:23.934
860	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:13:24.008
861	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:24:50.725
862	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:24:50.805
863	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:21.868
864	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:22.58
865	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:22.648
866	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:33.515
867	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:33.596
868	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:39.61
869	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorv0ml0007uflg0d9hk01j	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:39.668
870	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:41.082
871	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:27:41.151
872	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkorwhny0009uflgu5hrdham	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:30.595
873	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorwhny0009uflgu5hrdham	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:30.975
874	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkorwhny0009uflgu5hrdham	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:31.065
875	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:36.267
876	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:36.363
877	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:40.226
878	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_timeline	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:40.306
879	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:44.577
880	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:44.637
881	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:52.398
882	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:52.401
883	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:52.496
884	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:52.498
885	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:54.015
886	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:54.191
887	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:54.244
888	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:28:54.309
889	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:30.278
890	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:30.28
891	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:30.399
892	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:30.402
893	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:32.314
894	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:32.373
895	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:34.799
896	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:34.911
897	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:38.032
898	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:29:38.086
899	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:31:21.914
900	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:08.373
901	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:08.452
902	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:12.107
903	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:12.187
904	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:14.391
905	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:14.475
906	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:16.546
907	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:16.605
908	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:25.646
909	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:33:25.779
910	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:34:04.581
911	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:34:04.651
912	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:34:50.89
913	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:34:50.956
914	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:56:53.589
915	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 01:56:53.774
916	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:21.609
917	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:21.779
918	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:23.856
919	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:23.92
920	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:26.396
921	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:26.468
922	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:28.285
923	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:28.352
924	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:31.359
925	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:14:31.44
926	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:20:33.938
927	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:20:34.054
928	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:22:46.688
929	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:22:46.791
930	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:22:48.881
931	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:22:48.948
932	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:27:00.526
933	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:27:00.594
934	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:27:06.967
935	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:27:07.037
936	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkou1n7x000buflg352m6dhp	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:30.297
937	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkou1n7x000buflg352m6dhp	{"drugName": "Ribotril", "medicationId": 3}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:37.885
938	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkou1n7x000buflg352m6dhp	{"drugName": "Paracetamol", "medicationId": 4}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:37.981
939	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkou1n7x000buflg352m6dhp	{"status": "issued", "issuedAt": "2026-01-22T02:28:40.320Z"}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:40.322
940	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou1n7x000buflg352m6dhp	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:40.862
941	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou1n7x000buflg352m6dhp	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:28:40.934
942	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:29:11.011
943	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:29:11.079
944	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:29:12.612
945	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:29:12.696
946	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:31:10.074
947	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:31:10.194
948	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:31:11.674
949	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:31:11.788
950	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkou6ir3000duflgs7zicfqm	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:17.801
951	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkou6ir3000duflgs7zicfqm	{"drugName": "Paracetamol", "medicationId": 5}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:17.888
952	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkou6ir3000duflgs7zicfqm	{"drugName": "Ribotril", "medicationId": 6}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:17.972
953	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkou6ir3000duflgs7zicfqm	{"status": "issued", "issuedAt": "2026-01-22T02:32:18.113Z"}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:18.115
954	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou6ir3000duflgs7zicfqm	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:18.375
955	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou6ir3000duflgs7zicfqm	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:18.48
956	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:22.741
957	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:22.818
958	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou6ir3000duflgs7zicfqm	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:26.861
959	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkou6ir3000duflgs7zicfqm	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:26.928
960	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:30.915
961	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:32:30.988
962	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:33:51.989
963	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:33:52.06
964	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:35:04.618
965	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:35:04.684
966	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:35:05.923
967	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:35:06.05
968	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkouq3cl000fuflgf4metiqd	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:30.956
969	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkouq3cl000fuflgf4metiqd	{"drugName": "Paracetamol", "medicationId": 7}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:31.051
970	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkouq3cl000fuflgf4metiqd	{"status": "issued", "issuedAt": "2026-01-22T02:47:31.139Z"}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:31.141
971	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkouq3cl000fuflgf4metiqd	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:31.526
972	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkouq3cl000fuflgf4metiqd	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:31.682
973	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:36.996
974	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:37.076
975	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:57.369
976	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:47:57.437
977	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:48:01.104
978	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:48:01.165
979	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:48:58.055
980	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:48:58.173
981	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:05.913
982	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:06.02
983	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:12.315
984	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:12.543
985	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:18.986
986	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:19.065
987	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:20.894
988	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:20.985
989	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:33.038
990	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:33.114
991	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:58.538
992	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:49:58.604
993	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:51:55.465
994	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	view_patient	patient	cmk66jdi50003ufw4f3vmn1yj	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 02:51:55.557
995	cmkovfwsc000huflg26skea9b	cmk1peku70001uffc2simlmby	create_patient	patient	cmkovfwsc000huflg26skea9b	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 03:07:35.616
996	cmkovfwsc000huflg26skea9b	cmk1peku70001uffc2simlmby	view_patient	patient	cmkovfwsc000huflg26skea9b	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 03:07:36.198
997	cmkovfwsc000huflg26skea9b	cmk1peku70001uffc2simlmby	view_patient	patient	cmkovfwsc000huflg26skea9b	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 03:07:36.309
998	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	create_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:11:55.735
999	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:11:59.133
1000	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:11:59.241
1001	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:12:11.545
1002	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:12:11.64
1003	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:12:15.615
1004	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:12:15.686
1005	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:40.138
1006	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:40.211
1007	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:46.996
1008	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:47.081
1009	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:50.496
1010	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:50.58
1011	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:52.223
1012	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:52.337
1013	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:53.151
1014	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:13:53.235
1015	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:26.033
1016	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkpyeqqb0003uftsxamtk98q	{"drugName": "Ribotril", "medicationId": 8}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:27.594
1017	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkpyeqqb0003uftsxamtk98q	{"drugName": "Paracetamol", "medicationId": 9}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:27.68
1018	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkpyeqqb0003uftsxamtk98q	{"drugName": "Aspirina", "medicationId": 10}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:27.735
1019	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	{"status": "issued", "issuedAt": "2026-01-22T21:18:29.142Z"}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:29.144
1020	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:32.335
1021	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:32.411
1022	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:36.297
1023	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:36.378
1024	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:39.228
1025	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:39.284
1026	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:45.344
1027	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:18:45.411
1028	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:29.42
1029	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:29.507
1030	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_timeline	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:34.869
1031	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_timeline	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:34.966
1032	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:41.412
1033	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:41.509
1034	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:44.95
1035	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:45.032
1036	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:46.147
1037	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:46.277
1038	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:53.555
1039	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:53.616
1040	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:55.381
1041	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:19:55.547
1042	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:00.556
1043	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:00.632
1044	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:02.16
1045	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:02.274
1046	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:08.003
1047	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:08.068
1048	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:09.728
1049	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_media	media	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:09.813
1050	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:11.523
1051	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:20:11.585
1052	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:29.591
1053	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:35.119
1054	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:35.19
1055	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:44.5
1056	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:44.588
1057	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:49.186
1058	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:49.242
1059	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:50.009
1060	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:50.064
1061	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_timeline	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:56.134
1062	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_timeline	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:56.21
1063	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:58.352
1064	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkpymj840005uftsw02pun71	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:24:58.417
1065	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:00.909
1066	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:00.991
1067	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:04.387
1068	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:04.465
1069	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:05.424
1070	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkpyeqqb0003uftsxamtk98q	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:05.491
1071	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:08.706
1072	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:08.765
1073	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:09.773
1074	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:25:09.888
1075	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:26:27.553
1076	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:26:27.618
1077	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:26:42.508
1078	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:26:42.593
1079	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:27:02.566
1080	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	view_patient	patient	cmkpy6dhs0001ufts6huw1ddq	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-22 21:27:02.626
1081	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	create_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:54:18.294
1082	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:54:25.218
1083	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:54:25.282
1084	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	create_encounter	encounter	cmkrhc4ww0003ufusay0rwc8s	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:03.374
1085	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkrhc4ww0003ufusay0rwc8s	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:08.306
1086	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_encounter	encounter	cmkrhc4ww0003ufusay0rwc8s	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:08.385
1087	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:11.631
1088	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:11.685
1089	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:17.927
1090	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:18.011
1091	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:24.557
1092	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:56:24.619
1093	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	create_prescription	prescription	cmkrhe2zu0005ufusyc4clg3k	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:34.144
1094	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	add_prescription_medication	prescription	cmkrhe2zu0005ufusyc4clg3k	{"drugName": "Paracetamol", "medicationId": 11}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:36.472
1095	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	issue_prescription	prescription	cmkrhe2zu0005ufusyc4clg3k	{"status": "issued", "issuedAt": "2026-01-23T22:57:38.019Z"}	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:38.021
1096	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkrhe2zu0005ufusyc4clg3k	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:42.342
1097	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescription	prescription	cmkrhe2zu0005ufusyc4clg3k	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:42.42
1098	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:46.222
1099	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_prescriptions	prescription	\N	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:46.28
1100	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:48.024
1101	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 22:57:48.078
1102	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 23:06:00.508
1103	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	view_patient	patient	cmkrh9vr50001ufusopc9kas4	\N	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	DOCTOR	::1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36	2026-01-23 23:06:00.584
\.


--
-- Data for Name: patient_media; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.patient_media (id, patient_id, doctor_id, encounter_id, media_type, file_name, file_url, file_size, mime_type, thumbnail_url, category, body_area, capture_date, description, doctor_notes, visibility, uploaded_by, created_at) FROM stdin;
cmklop6fv0005ufzgv2j1f96c	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	\N	image	NOTA COMPRA EJEMPLO.png	https://utfs.io/f/IpII5o06O7n9QlG2dgUETu1GalR6XeDHOWpKbV83miAUcZs5	31579	image/png	\N	\N	\N	2026-01-19 21:35:31.628	\N	\N	internal	d100dcc2-0433-478c-9b6b-f3773d41bc57	2026-01-19 21:35:31.989
cmkloq54v0007ufzgdc7a4j1i	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	cmk74qxf40007uf3gpt6rfrrk	image	NOTA COMPRA EJEMPLO.png	https://utfs.io/f/IpII5o06O7n9gcX3eCZFpQPyaLkTlxzvANmZui3wC5os8SEM	31579	image/png	\N	\N	\N	2026-01-19 21:36:16.893	\N	\N	internal	d100dcc2-0433-478c-9b6b-f3773d41bc57	2026-01-19 21:36:17.023
\.


--
-- Data for Name: patient_medical_history; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.patient_medical_history (id, patient_id, doctor_id, field_name, old_value, new_value, changed_by, change_reason, changed_at) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.patients (id, doctor_id, internal_id, first_name, last_name, date_of_birth, sex, email, phone, address, city, state, postal_code, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, first_visit_date, last_visit_date, status, tags, current_allergies, current_chronic_conditions, current_medications, blood_type, general_notes, photo_url, created_at, updated_at) FROM stdin;
cmk65u5c30001ufw4dyvoy5bm	cmk1peku70001uffc2simlmby	P1767919858276	gerardo	lopez	2026-01-03	male	fafutis.lopez@gmail.com	3315875992	vallarta	guadalajara	Jalisco	44160				2026-01-09	2026-01-09	active	{}						\N	2026-01-09 00:50:58.56	2026-01-09 01:36:00.711
cmk745iy40001uf3gze4ztct3	cmk1peku70001uffc2simlmby	P1767977496355	f	fffffffffffffffffffffffff	2026-01-07	male										2026-01-09	2026-01-09	active	{}						\N	2026-01-09 16:51:36.359	2026-01-09 16:52:14.838
cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	P1767922607148	dfg dfgdrgsdvsdggggv	sdfg	2026-01-04	male										2026-01-09	2026-01-22	active	{}						\N	2026-01-09 01:36:47.144	2026-01-22 00:10:50.471
cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	P1767921035489	diergo	lopez	2026-01-10	male	fafutis.lopez@gmail.com	3315875992	vallarta	guadalajara	Jalisco	44160				2026-01-09	2026-01-22	active	{}						\N	2026-01-09 01:10:35.494	2026-01-22 01:28:30.587
cmkovfwsc000huflg26skea9b	cmk1peku70001uffc2simlmby	P1769051255364	Diego	López	1988-05-21	male		3315885922	Avenida Vallarta 2525	Guadalajara						2026-01-22	\N	active	{}	AINES		Regotril	O-		\N	2026-01-22 03:07:35.378	2026-01-22 03:07:35.378
cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	P1769116315518	Gerardo	López Fafutis	1991-05-21	male	lopez.fafutis@gmail.com	3315-875992	avenida Vallarta 2525, colonia Arcos, Vallarta			400-150	María Catherine López-Fafutis	33 18 23 69		2026-01-22	2026-01-22	active	{}	No	Rodilla muy lastimada con dolor constante	Ribotril	O		\N	2026-01-22 21:11:55.522	2026-01-22 21:24:29.572
cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	P1769208858075	Antonio	López Domínguez	1914-05-21	male		33 15 87 59 92	Avenida de las Gladiolas 25 25, Colonia Boganvillas	Guadalajara	Jalisco					2026-01-23	2026-01-23	active	{}	Ninguna		Paracetamol			\N	2026-01-23 22:54:18.079	2026-01-23 22:56:03.369
\.


--
-- Data for Name: prescription_medications; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.prescription_medications (id, prescription_id, drug_name, presentation, dosage, frequency, duration, quantity, instructions, warnings, "order") FROM stdin;
1	cmk7azly30001uf2sk1jzc9wj	aa	\N	aaa	aaa	\N	\N	aaa	\N	0
2	cmkln4z6g0003ufzgsw6blivp	parecetamol	\N	33	4	\N	\N	ddddd	\N	0
3	cmkou1n7x000buflg352m6dhp	Ribotril	\N	2	2	\N	\N	22	\N	0
4	cmkou1n7x000buflg352m6dhp	Paracetamol	Tableta	500 gramos	22	\N	\N	222	\N	1
5	cmkou6ir3000duflgs7zicfqm	Paracetamol	Tableta	500 gramos	8 horas	7 días	\N	Tomar con alimentos en la panza	\N	0
6	cmkou6ir3000duflgs7zicfqm	Ribotril	Jarabe	100 gramos	Cada hora	Un mes	\N	Tomar con aceite	\N	1
7	cmkouq3cl000fuflgf4metiqd	Paracetamol	\N	2	2	2	\N	22	\N	0
8	cmkpyeqqb0003uftsxamtk98q	Ribotril	Tarjeta	1000mg	Cada 12 horas	7 días	\N	En ayunas	Puede ser irritante	0
9	cmkpyeqqb0003uftsxamtk98q	Paracetamol	Jarabe	1g	Cada 24 horas	30 días	\N	Ninguna	No comer carne	1
10	cmkpyeqqb0003uftsxamtk98q	Aspirina	Sobrecito	Una aspirina	Cada 8 horas	2 meses	\N	Ninguna	\N	2
11	cmkrhe2zu0005ufusyc4clg3k	Paracetamol	Tableta	500mg	Cada 8 horas	\N	\N	ss	\N	0
\.


--
-- Data for Name: prescriptions; Type: TABLE DATA; Schema: medical_records; Owner: -
--

COPY medical_records.prescriptions (id, patient_id, doctor_id, encounter_id, prescription_date, status, doctor_full_name, doctor_license, doctor_signature, diagnosis, clinical_notes, pdf_url, pdf_generated_at, version_number, issued_by, issued_at, cancelled_at, cancellation_reason, expires_at, created_at, updated_at) FROM stdin;
cmk7azly30001uf2sk1jzc9wj	cmk67h25k0003ufb0dppexi42	cmk1peku70001uffc2simlmby	\N	2026-01-09 00:00:00	issued	a	aaa	\N	\N	\N	\N	\N	1	3987d6af-0c30-4e9c-a15e-059cfd11077a	2026-01-09 20:03:03.266	\N	\N	\N	2026-01-09 20:02:57.626	2026-01-09 20:03:03.27
cmkln4z6g0003ufzgsw6blivp	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	\N	2026-01-19 00:00:00	issued	gerado	3333	\N	\N	\N	\N	\N	1	48ac83f7-f775-4741-9419-4f0424d8d898	2026-01-19 20:51:55.792	\N	\N	\N	2026-01-19 20:51:49.913	2026-01-19 20:51:55.794
cmkou1n7x000buflg352m6dhp	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	\N	2026-01-22 00:00:00	issued	maria-lopez	222	\N	Hierro en medicamento 1	\N	\N	\N	1	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	2026-01-22 02:28:40.293	\N	\N	\N	2026-01-22 02:28:30.166	2026-01-22 02:28:40.307
cmkou6ir3000duflgs7zicfqm	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	\N	2026-01-22 00:00:00	issued	maria-lopez	3333	\N	Diarrea	\N	\N	\N	1	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	2026-01-22 02:32:18.104	\N	\N	\N	2026-01-22 02:32:17.774	2026-01-22 02:32:18.106
cmkouq3cl000fuflgf4metiqd	cmk66jdi50003ufw4f3vmn1yj	cmk1peku70001uffc2simlmby	\N	2026-01-22 00:00:00	issued	maria-lopez	22	\N	\N	\N	\N	\N	1	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	2026-01-22 02:47:31.13	\N	\N	\N	2026-01-22 02:47:30.933	2026-01-22 02:47:31.132
cmkpyeqqb0003uftsxamtk98q	cmkpy6dhs0001ufts6huw1ddq	cmk1peku70001uffc2simlmby	\N	2026-01-22 00:00:00	issued	maria-lopez	22	\N	diarrea	\N	\N	\N	1	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	2026-01-22 21:18:29.124	\N	\N	\N	2026-01-22 21:18:26.004	2026-01-22 21:18:29.126
cmkrhe2zu0005ufusyc4clg3k	cmkrh9vr50001ufusopc9kas4	cmk1peku70001uffc2simlmby	\N	2026-01-23 00:00:00	issued	maria-lopez	ff	\N	Duele la rodilla	\N	\N	\N	1	eaf17b1a-d3ee-4d23-93d5-2943c9d3dddf	2026-01-23 22:57:38.009	\N	\N	\N	2026-01-23 22:57:34.122	2026-01-23 22:57:38.013
\.


--
-- Data for Name: areas; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.areas (id, doctor_id, name, description, created_at, updated_at, type) FROM stdin;
1	cmk1peku70001uffc2simlmby	ventas	\N	2026-01-05 22:03:14.457	2026-01-05 22:03:14.457	INGRESO
2	cmk1peku70001uffc2simlmby	rrrr	\N	2026-01-08 20:12:20.991	2026-01-08 20:12:20.991	INGRESO
6	cmk1peku70001uffc2simlmby	sss	\N	2026-01-08 20:26:07.426	2026-01-08 20:26:07.426	INGRESO
7	cmk1peku70001uffc2simlmby	vvvvvvvv	\N	2026-01-08 20:26:15.94	2026-01-08 20:26:15.94	INGRESO
8	cmk1peku70001uffc2simlmby	dd	\N	2026-01-08 20:28:57.625	2026-01-08 20:28:57.625	EGRESO
9	cmk1peku70001uffc2simlmby	nigg	\N	2026-01-08 20:29:11.372	2026-01-15 00:16:43.642	INGRESO
11	cmk1peku70001uffc2simlmby	222	\N	2026-01-15 00:16:57.567	2026-01-15 00:16:57.567	INGRESO
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.clients (id, doctor_id, business_name, contact_name, rfc, email, phone, street, city, state, postal_code, country, industry, notes, status, logo_url, logo_file_name, logo_file_size, created_at, updated_at) FROM stdin;
1	cmk1peku70001uffc2simlmby	ssss	\N	\N	\N	\N	\N	\N	\N	\N	México	\N	\N	active	\N	\N	\N	2026-01-05 22:41:09.799	2026-01-05 22:41:09.799
2	cmk1peku70001uffc2simlmby	ss	\N	\N	\N	\N	\N	\N	\N	\N	México	\N	\N	active	\N	\N	\N	2026-01-06 02:45:50.754	2026-01-06 02:45:50.754
\.


--
-- Data for Name: ledger_attachments; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.ledger_attachments (id, ledger_entry_id, file_name, file_url, file_size, file_type, attachment_type, created_at) FROM stdin;
\.


--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.ledger_entries (id, doctor_id, amount, concept, bank_account, forma_de_pago, internal_id, bank_movement_id, entry_type, transaction_date, area, subarea, por_realizar, file_url, file_name, file_size, file_type, created_at, updated_at, client_id, payment_status, purchase_id, sale_id, supplier_id, transaction_type, amount_paid) FROM stdin;
32	cmk1peku70001uffc2simlmby	5000.00	Pago de leche	\N	efectivo	ING-2026-001	\N	ingreso	2024-01-22	\N	\N	f	\N	\N	\N	\N	2026-01-23 20:22:39.012	2026-01-23 20:22:39.012	\N	PENDING	\N	\N	\N	N/A	0.00
34	cmk1peku70001uffc2simlmby	6000.00	Operación de ojos	\N	efectivo	EGR-2026-001	\N	egreso	2026-01-23	\N	\N	f	\N	\N	\N	\N	2026-01-23 20:22:39.446	2026-01-23 20:22:39.446	\N	PENDING	\N	\N	\N	N/A	0.00
38	cmk1peku70001uffc2simlmby	18560.00	Venta VTA-2026-005 - Cliente: ss	\N	transferencia	ING-2026-002	\N	ingreso	2026-01-23	Ventas	Ventas Generales	f	\N	\N	\N	\N	2026-01-23 21:31:56.799	2026-01-23 21:31:56.799	2	PENDING	\N	47	\N	VENTA	0.00
39	cmk1peku70001uffc2simlmby	357.28	Compra CMP-2026-001 - Proveedor: dsdfasdas	\N	transferencia	EGR-2026-002	\N	egreso	2026-01-25	Compras	Compras Generales	f	\N	\N	\N	\N	2026-01-23 22:03:38.63	2026-01-23 22:03:38.63	\N	PENDING	36	\N	2	COMPRA	0.00
\.


--
-- Data for Name: ledger_facturas; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.ledger_facturas (id, ledger_entry_id, file_name, file_url, file_size, file_type, folio, uuid, rfc_emisor, rfc_receptor, total, notes, created_at) FROM stdin;
\.


--
-- Data for Name: ledger_facturas_xml; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.ledger_facturas_xml (id, ledger_entry_id, file_name, file_url, file_size, xml_content, folio, uuid, rfc_emisor, rfc_receptor, total, subtotal, iva, fecha, metodo_pago, forma_pago, moneda, notes, created_at) FROM stdin;
\.


--
-- Data for Name: product_attribute_values; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.product_attribute_values (id, attribute_id, value, description, cost, unit, "order", is_active, created_at, updated_at) FROM stdin;
1	1	cuchillo1	\N	1.00	\N	0	t	2026-01-06 01:11:13.428	2026-01-06 01:13:01.299
\.


--
-- Data for Name: product_attributes; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.product_attributes (id, doctor_id, name, description, "order", is_active, created_at, updated_at) FROM stdin;
1	cmk1peku70001uffc2simlmby	cuchillos	\N	0	t	2026-01-06 00:47:05.923	2026-01-06 00:47:05.923
2	cmk1peku70001uffc2simlmby	lentes	\N	0	t	2026-01-06 00:47:13.249	2026-01-06 00:47:13.249
\.


--
-- Data for Name: product_components; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.product_components (id, product_id, attribute_value_id, quantity, "calculatedCost", "order", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.products (id, doctor_id, name, sku, category, description, price, cost, "stockQuantity", unit, status, image_url, image_file_name, image_file_size, created_at, updated_at) FROM stdin;
2	cmk1peku70001uffc2simlmby	ssss	\N	\N	\N	\N	0.00	0	\N	active	\N	\N	\N	2026-01-06 01:53:29.693	2026-01-06 01:53:29.693
3	cmk1peku70001uffc2simlmby	lkm	\N	\N	\N	1000.00	100.01	0	\N	active	\N	\N	\N	2026-01-06 01:57:42.506	2026-01-06 01:57:42.506
4	cmk1peku70001uffc2simlmby	vyerybrvrtrtrtrtrtrtrtrtrtrtrtrtrtrtrt	\N	\N	\N	\N	0.00	0	\N	active	\N	\N	\N	2026-01-12 22:17:04.356	2026-01-12 22:17:04.356
5	cmk1peku70001uffc2simlmby	dddddd	\N	\N	\N	0.99	0.00	0	\N	active	\N	\N	\N	2026-01-13 00:36:48.597	2026-01-13 00:36:48.597
6	cmk1peku70001uffc2simlmby	rfgdfgdfgdf111111111	\N	\N	\N	\N	0.00	0	\N	active	\N	\N	\N	2026-01-14 23:47:11.973	2026-01-14 23:47:11.973
7	cmk1peku70001uffc2simlmby	gdfgdfghfghftgh	\N	\N	\N	\N	0.00	0	\N	active	\N	\N	\N	2026-01-23 22:06:50.445	2026-01-23 22:06:50.445
\.


--
-- Data for Name: proveedores; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.proveedores (id, doctor_id, business_name, contact_name, rfc, email, phone, street, city, state, postal_code, country, industry, notes, status, logo_url, logo_file_name, logo_file_size, created_at, updated_at) FROM stdin;
1	cmk1peku70001uffc2simlmby	sssssssssssss	\N	\N	\N	\N	\N	\N	\N	\N	México	\N	\N	active	\N	\N	\N	2026-01-06 20:58:12.168	2026-01-06 20:58:12.168
2	cmk1peku70001uffc2simlmby	dsdfasdas	\N	\N	\N	\N	\N	\N	\N	\N	México	\N	\N	active	\N	\N	\N	2026-01-06 21:10:27.98	2026-01-14 23:35:57.974
\.


--
-- Data for Name: purchase_items; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.purchase_items (id, purchase_id, product_id, item_type, description, sku, quantity, unit, unit_price, subtotal, discount_rate, tax_rate, tax_amount, "order", created_at, updated_at) FROM stdin;
38	36	\N	product	Guantes	\N	1.0000	pza	100.00	100.00	0.0000	0.1600	16.00	0	2026-01-23 22:03:38.454	2026-01-23 22:03:38.454
39	36	\N	product	Jeringas	\N	1.0000	pza	200.00	200.00	0.0000	0.1600	32.00	1	2026-01-23 22:03:38.454	2026-01-23 22:03:38.454
40	36	\N	product	Lentes	\N	1.0000	pza	8.00	8.00	0.0000	0.1600	1.28	2	2026-01-23 22:03:38.454	2026-01-23 22:03:38.454
\.


--
-- Data for Name: purchases; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.purchases (id, doctor_id, supplier_id, quotation_id, purchase_number, purchase_date, delivery_date, status, subtotal, tax_rate, tax, total, amount_paid, payment_status, notes, terms_and_conditions, created_at, updated_at) FROM stdin;
36	cmk1peku70001uffc2simlmby	2	\N	CMP-2026-001	2026-01-25	2026-01-30	CONFIRMED	308.00	0.1600	49.28	357.28	0.00	PENDING	\N	\N	2026-01-23 22:03:38.454	2026-01-23 22:03:38.454
\.


--
-- Data for Name: quotation_items; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.quotation_items (id, quotation_id, product_id, item_type, description, sku, quantity, unit, unit_price, subtotal, "order", created_at, updated_at, tax_amount, tax_rate, discount_rate) FROM stdin;
9	1	3	product	lkm	\N	1.0000	pza	1.00	1.00	1	2026-01-14 23:25:37.304	2026-01-14 23:25:37.304	0.16	0.1600	0.0000
11	3	5	product	dddddd	\N	1.0000	pza	333.00	333.00	0	2026-01-14 23:26:02.985	2026-01-14 23:26:02.985	53.28	0.1600	0.0000
8	1	\N	product	ddddd	\N	1.0000	pza	1.00	1.00	0	2026-01-14 23:25:37.304	2026-01-14 23:25:37.304	0.16	0.1600	0.0000
10	1	\N	product	ddddd	\N	1.0000	pza	1.00	1.00	2	2026-01-14 23:25:37.304	2026-01-14 23:25:37.304	0.16	0.1600	0.0000
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.quotations (id, doctor_id, client_id, quotation_number, issue_date, valid_until, status, subtotal, tax_rate, tax, total, notes, terms_and_conditions, created_at, updated_at) FROM stdin;
1	cmk1peku70001uffc2simlmby	1	COT-2026-001	2026-01-06	2026-02-05	SENT	3.00	0.1600	0.48	3.48	\N	\N	2026-01-06 02:58:12.999	2026-01-14 23:25:37.304
3	cmk1peku70001uffc2simlmby	2	COT-2026-002	2026-01-14	2026-02-13	SENT	333.00	0.1600	53.28	386.28	\N	\N	2026-01-14 23:26:02.985	2026-01-14 23:26:02.985
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.sale_items (id, sale_id, product_id, item_type, description, sku, quantity, unit, unit_price, subtotal, discount_rate, tax_rate, tax_amount, "order", created_at, updated_at) FROM stdin;
96	34	3	product	lkm	\N	1.0000	pza	1.00	0.90	0.1000	0.1600	0.14	0	2026-01-14 02:12:14.342	2026-01-14 02:12:14.342
44	35	\N	product	ddddd	\N	1.0000	pza	1111.00	1111.00	0.0000	0.1600	177.76	0	2026-01-06 19:56:12.933	2026-01-06 19:56:12.933
47	1	\N	product	ddddd	\N	1.0000	pza	1111.00	1111.00	0.0000	0.1600	177.76	0	2026-01-06 19:56:24.084	2026-01-06 19:56:24.084
48	1	\N	product	ddddd	\N	1.0000	pza	1111.00	1111.00	0.0000	0.1600	177.76	1	2026-01-06 19:56:24.084	2026-01-06 19:56:24.084
49	2	\N	product	ddddd	\N	1.0000	pza	1111.00	1111.00	0.0000	0.1600	177.76	0	2026-01-07 18:12:41.214	2026-01-07 18:12:41.214
99	47	\N	service	Operación de ojos	\N	1.0000	servicio	15000.00	15000.00	0.0000	0.1600	2400.00	0	2026-01-23 21:31:56.223	2026-01-23 21:31:56.223
100	47	\N	service	Operación de lengua	\N	1.0000	servicio	1000.00	1000.00	0.0000	0.1600	160.00	1	2026-01-23 21:31:56.223	2026-01-23 21:31:56.223
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.sales (id, doctor_id, client_id, quotation_id, sale_number, sale_date, delivery_date, status, subtotal, tax_rate, tax, total, amount_paid, payment_status, notes, terms_and_conditions, created_at, updated_at) FROM stdin;
35	cmk1peku70001uffc2simlmby	1	1	VTA-2026-004	2026-01-06	\N	CONFIRMED	1111.00	0.1600	177.76	1288.76	0.00	PENDING	\N	\N	2026-01-06 16:19:23.636	2026-01-06 19:56:12.933
1	cmk1peku70001uffc2simlmby	1	1	VTA-2026-001	2026-01-06	\N	SHIPPED	2222.00	0.1600	355.52	2577.52	0.00	PENDING	\N	\N	2026-01-06 04:20:52.847	2026-01-06 19:56:24.084
2	cmk1peku70001uffc2simlmby	1	1	VTA-2026-002	2026-01-06	\N	CONFIRMED	1111.00	0.1600	177.76	1288.76	0.00	PARTIAL	\N	\N	2026-01-06 04:22:50.177	2026-01-07 18:12:41.214
34	cmk1peku70001uffc2simlmby	2	\N	VTA-2026-003	2026-01-06	\N	CONFIRMED	0.90	0.1600	0.14	1.04	0.00	PENDING	\N	\N	2026-01-06 15:42:48.524	2026-01-14 02:12:14.342
47	cmk1peku70001uffc2simlmby	2	\N	VTA-2026-005	2026-01-23	2026-01-25	CONFIRMED	16000.00	0.1600	2560.00	18560.00	0.00	PENDING	\N	\N	2026-01-23 21:31:56.223	2026-01-23 21:31:56.223
\.


--
-- Data for Name: subareas; Type: TABLE DATA; Schema: practice_management; Owner: -
--

COPY practice_management.subareas (id, area_id, name, description, created_at, updated_at) FROM stdin;
1	1	sss	\N	2026-01-05 22:05:24.329	2026-01-05 22:05:24.329
2	1	sssssssss	\N	2026-01-05 22:05:28.296	2026-01-05 22:05:28.296
3	2	rszdsadf	\N	2026-01-08 20:12:27.38	2026-01-08 20:12:27.38
5	8	ddddd	\N	2026-01-08 20:29:06.191	2026-01-08 20:29:06.191
6	9	fffffffffffff	\N	2026-01-08 20:29:15.458	2026-01-08 20:29:15.458
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
d858ce94-44d7-4ca6-9585-16e6a71c91fa	36b1fdbb0d20efec9ed7c943ce4d8d19f8e29cfce7373abae7f4a352d9c7e5bb	2026-01-05 15:33:28.362364-06	20251214164928_init	\N	\N	2026-01-05 15:33:28.294938-06	1
cfaeaf3f-ffe3-4c0c-8cac-cc194bf96dac	f93bd999230195c26a909ea2f3e15e1c1c169885007ffef75cc93a045c0f425d	2026-01-05 15:33:28.38456-06	20251215175022_pnpm_db_generate	\N	\N	2026-01-05 15:33:28.363177-06	1
e398de8e-68dc-4bf0-98a2-6e127381b6ae	c04482c3cd564d6de912ed88cd8fc89878afd9bd8f17932d568ef863ee420c94	2026-01-08 18:23:31.19469-06	20260108000000_add_emr_phase1	\N	\N	2026-01-08 18:23:30.979739-06	1
a206729c-a1a3-4929-a424-8495c52e9e76	32737bb7e11d4cdbbb909f2cc9d26caf386e9a628ef5b8a3257b2d5258a26407	2026-01-05 15:33:28.415063-06	20251229002458_add_article_model_for_blog	\N	\N	2026-01-05 15:33:28.38549-06	1
1c8499b1-4c77-4018-ab95-040cfef3ed85	763ee8f7808ec38edfcd077968ff1186100475b29649f68e1375a4a956f96c6d	2026-01-05 15:34:51.599731-06	20260105213451_add_practice_management_schema	\N	\N	2026-01-05 15:34:51.367199-06	1
50a90a42-2ea9-44ad-b931-d1a4ed3259d8	457c31464c35c98c739686340afa98a79764487642371cd32d9c417cd8f24522	2026-01-05 20:43:08.126805-06	20260106024307_add_quotations	\N	\N	2026-01-05 20:43:08.012758-06	1
380fa182-d054-476b-b47b-6df900fb90b8	f7641a1c0e8b2b4ea55766d87bdfef60a2c9885db59342b2ed6d0e1a78a5cfff	2026-01-05 21:05:48.048781-06	20260106030548_add_per_item_tax	\N	\N	2026-01-05 21:05:48.041355-06	1
44c3cf49-2e22-4589-9e65-cb5609f049b4	d357745fe13b70b404d527e6a83d4f2269bb80038da283e6c180c67b62539165	2026-01-05 21:26:30.675168-06	20260105212158_add_per_item_discount_remove_quotation_discount	\N	\N	2026-01-05 21:26:30.633999-06	1
fe7f1f75-3b92-4ded-a456-de519e4279e5	c7afc31da4863368a8830eeff4233da109f1d6fff28264f47ca9099f0ddef65d	2026-01-05 21:52:28.582894-06	20260106040000_add_sales_ventas_en_firme	\N	\N	2026-01-05 21:52:28.265663-06	1
8b4f3ed1-0602-47d0-9b7d-94221b54d283	ab0c77ddb8294fe5f53773452b323f0e60ae01f6dec5e9f7482c5789e9e71596	\N	20260107000000_add_amount_paid_to_ledger_entries	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20260107000000_add_amount_paid_to_ledger_entries\n\nDatabase error code: 42701\n\nDatabase error:\nERROR: column "amount_paid" of relation "ledger_entries" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42701), message: "column \\"amount_paid\\" of relation \\"ledger_entries\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tablecmds.c"), line: Some(7481), routine: Some("check_for_column_name_collision") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20260107000000_add_amount_paid_to_ledger_entries"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20260107000000_add_amount_paid_to_ledger_entries"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:260	2026-01-08 18:19:26.859066-06	2026-01-08 18:17:59.296572-06	0
50fab2d2-d8d5-4c99-9fb1-7401c490ee08	ab0c77ddb8294fe5f53773452b323f0e60ae01f6dec5e9f7482c5789e9e71596	2026-01-08 18:19:26.861015-06	20260107000000_add_amount_paid_to_ledger_entries		\N	2026-01-08 18:19:26.861015-06	0
\.


--
-- Data for Name: appointment_slots; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointment_slots (id, doctor_id, date, start_time, end_time, duration, base_price, discount, discount_type, final_price, status, max_bookings, current_bookings, created_at, updated_at) FROM stdin;
cmkrgmnau0036uf20lo3dp3rf	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	10:30	11:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau0038uf20z3b4ksqh	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	11:30	12:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003auf20am5lu3lx	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	12:30	13:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003cuf200lzqcv81	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	13:30	14:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003euf20amj7e7sk	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	14:30	15:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003guf20tp9l5x5w	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	15:30	16:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003huf20x37haeia	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	16:00	16:30	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003iuf200gge2kpg	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	16:30	17:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003kuf20sjet1it7	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	10:30	11:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003muf20m72f4bic	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	11:30	12:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003ouf204agyeqjj	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	12:30	13:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003quf202ybmv9rp	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	13:30	14:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003suf20fbvnchdf	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	14:30	15:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003uuf20znvlmvvw	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	15:30	16:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003vuf20yrbkkvcw	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	16:00	16:30	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgmnau003wuf208ajb6u54	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	16:30	17:00	30	10.00	\N	\N	10.00	AVAILABLE	1	0	2026-01-23 22:36:14.07	2026-01-23 22:36:14.07
cmkrgl1z3001duf20bdw5izuk	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z3001euf20mmf3ttjv	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z3001fuf2056t8tg7d	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z3001guf204cmdes3v	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001huf20psf6ereb	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001iuf20iri08n0l	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001juf2021wonmg2	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001kuf20c0trmbau	cmk1peku70001uffc2simlmby	2026-01-22 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001muf20u3lc5nmf	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001luf20hb37nqe7	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	BLOCKED	1	0	2026-01-23 22:34:59.775	2026-01-23 22:39:05.171
cmkrgl1z4001nuf20ee0l9vgz	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001ouf204ob7f4i4	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001puf204vtcjz9k	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001quf20yxmuv5wb	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001ruf20cfg5bijs	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001suf20nipgiv57	cmk1peku70001uffc2simlmby	2026-01-23 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001tuf20p7xi013d	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001uuf20ktvfvlos	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001vuf20wfy8samu	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001wuf206lllcjqs	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001xuf209zkang0m	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001yuf20dbi1l8gz	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4001zuf201s1ulc4l	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40020uf20qplb4frh	cmk1peku70001uffc2simlmby	2026-01-24 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40021uf208b598oje	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40022uf20t17zeokh	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40023uf20veqhyns5	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40024uf20ywbjic00	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40025uf20zeo1u7a5	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40026uf20z1qyju9g	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40027uf20yav52xqy	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40028uf208ejc4sr2	cmk1peku70001uffc2simlmby	2026-01-25 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z40029uf20boby3gf5	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4002auf20ltcmvvb7	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4002buf20oig14ck9	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z4002cuf20wmlxtx08	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002duf20w39tsjas	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002euf205zv06cpa	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002fuf20khinax3i	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002guf200nnp1gwo	cmk1peku70001uffc2simlmby	2026-01-26 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002huf203tq6v96c	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002iuf20gl0n1643	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002juf206pxav08b	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002kuf20igiz2y8y	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002luf20jritfcc2	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002muf20bf45ooge	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002nuf20n4gcev60	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002ouf2025p1m9hc	cmk1peku70001uffc2simlmby	2026-01-27 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002puf207dbfnjqv	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002quf20q5u6633x	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002ruf201j53bint	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002suf206vu0fjbs	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002tuf206b6s2xar	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002uuf20643rgrmm	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002vuf20a19wvssj	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002wuf20mcjwi911	cmk1peku70001uffc2simlmby	2026-01-28 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002xuf20y7uwlq95	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	08:00	09:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002yuf20am08j3y1	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	09:00	10:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z5002zuf206p5o7csp	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	10:00	11:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z50030uf20otzbyyda	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	11:00	12:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z50031uf20faq0s8wa	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	12:00	13:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z50032uf20u2sauytc	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	13:00	14:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z50033uf20bsnq9huq	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	14:00	15:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
cmkrgl1z50034uf20j091kl2x	cmk1peku70001uffc2simlmby	2026-01-29 06:00:00	15:00	16:00	60	1000.00	\N	\N	1000.00	AVAILABLE	1	0	2026-01-23 22:34:59.775	2026-01-23 22:34:59.775
\.


--
-- Data for Name: articles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.articles (id, slug, title, excerpt, content, thumbnail, doctor_id, status, published_at, meta_description, keywords, views, created_at, updated_at) FROM stdin;
cmkbonx9g0009ufi4gtrl9f08	wwww	wwww	sssss	<p>ss</p>	\N	cmk1peku70001uffc2simlmby	PUBLISHED	2026-01-12 21:36:51.747	\N	{}	0	2026-01-12 21:36:51.748	2026-01-12 21:36:51.748
cmkbpnl4l0001ufpgarazryja	xcvd-v	xcvd v	esrtse	<p>dsf gdfg</p>	\N	cmk1peku70001uffc2simlmby	PUBLISHED	2026-01-12 22:04:35.634	\N	{}	0	2026-01-12 22:04:35.636	2026-01-12 22:04:35.636
cmkdbk5p60009ufc4voypwpvw	dfg-d-gf-d	dfg d gf d	dfgdgf	<p> dfgdfg</p>	\N	cmk1peku70001uffc2simlmby	PUBLISHED	2026-01-14 01:05:33.354	\N	{}	0	2026-01-14 01:05:33.379	2026-01-14 01:05:33.379
cmkdbrgs50001ufb4t034cm9w	sdffdsd	1	 sdf sdf	<p>sdfsdfsdfs sfsdf sd fsdfsdf</p>	fsdf	cmk1peku70001uffc2simlmby	PUBLISHED	2026-01-14 01:11:14.349	\N	{}	0	2026-01-14 01:11:14.354	2026-01-14 01:38:05.983
cmkdcqh2a0001uf746mqc5a00	sdfgsdf	sdfgsdf	sdfasf	<p>sdfsdafsdf</p>	\N	cmk1peku70001uffc2simlmby	PUBLISHED	2026-01-14 01:38:27.678	sdfsdafsadf	{}	0	2026-01-14 01:38:27.681	2026-01-14 01:38:27.681
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookings (id, slot_id, doctor_id, patient_name, patient_email, patient_phone, patient_whatsapp, status, final_price, notes, confirmation_code, confirmed_at, cancelled_at, review_token, review_token_used, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: carousel_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carousel_items (id, doctor_id, type, src, thumbnail, alt, caption, name, description, upload_date, duration) FROM stdin;
cmk1peku9000fuffc9id1juds	cmk1peku70001uffc2simlmby	video_thumbnail	/videos/doctors/sample/intro.mp4	/images/doctors/sample/video-thumb-1.jpg	Video de presentación de la Dra. María López	Conoce a la Dra. López y su enfoque en dermatología	Presentación - Dra. María López Hernández	La Dra. María López se presenta y explica su filosofía de atención dermatológica integral y personalizada.	2024-01-15	PT45S
cmk1peku9000guffckjf5f0x5	cmk1peku70001uffc2simlmby	video_thumbnail	/videos/doctors/sample/clinic-tour.mp4	/images/doctors/sample/video-thumb-2.jpg	Recorrido virtual por la clínica dermatológica	Recorre nuestras instalaciones modernas	Tour Virtual - Clínica de Dermatología	Conoce nuestras instalaciones equipadas con tecnología de última generación para tratamientos dermatológicos.	2024-01-15	PT1M
cmk1peku9000huffck3kl0k9l	cmk1peku70001uffc2simlmby	image	/images/doctors/sample/clinic-1.jpg	\N	Área de recepción moderna de la clínica dermatológica	Nuestra acogedora área de recepción	\N	\N	\N	\N
cmk1peku9000iuffcn9uyjnew	cmk1peku70001uffc2simlmby	image	/images/doctors/sample/clinic-2.jpg	\N	Sala de tratamiento láser avanzado	Salas de tratamiento de última generación	\N	\N	\N	\N
\.


--
-- Data for Name: certificates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.certificates (id, doctor_id, src, alt, issued_by, year) FROM stdin;
cmk1peku9000buffckbvi1byh	cmk1peku70001uffc2simlmby	/images/doctors/sample/certificate-1.jpg	Título de Medicina de la Universidad de Guadalajara	Universidad de Guadalajara	2008
cmk1peku9000cuffc75ynxejs	cmk1peku70001uffc2simlmby	/images/doctors/sample/certificate-2.jpg	Certificación de especialidad en Dermatología	Consejo Mexicano de Dermatología	2012
cmk1peku9000duffcvuo1lw6h	cmk1peku70001uffc2simlmby	/images/doctors/sample/certificate-3.jpg	Certificado de fellowship en dermatología cosmética	American Academy of Dermatology	2013
cmk1peku9000euffcat250imb	cmk1peku70001uffc2simlmby	/images/doctors/sample/certificate-4.jpg	Certificación en tratamientos láser	International Society of Dermatology	2020
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.doctors (id, slug, doctor_full_name, last_name, primary_specialty, subspecialties, cedula_profesional, hero_image, location_summary, city, short_bio, long_bio, years_experience, conditions, procedures, next_available_date, appointment_modes, clinic_address, clinic_phone, clinic_whatsapp, clinic_hours, clinic_geo_lat, clinic_geo_lng, social_linkedin, social_twitter, created_at, updated_at, color_palette) FROM stdin;
cmk1peku70001uffc2simlmby	maria-lopez	Dra. María López Hernández	López	Dermatóloga	{"Dermatología Cosmética","Tratamientos Láser",Anti-Envejecimiento}	987654321	/images/doctors/sample/doctor-placeholder.svg	Guadalajara, Jalisco	Guadalajara	La Dra. María López es una dermatóloga certificada con más de 12 años de experiencia especializada en dermatología médica y cosmética. Le apasiona ayudar a sus pacientes a lograr una piel saludable y hermosa mediante tratamientos basados en evidencia y atención personalizada. La Dra. López se mantiene a la vanguardia de los avances dermatológicos asistiendo regularmente a conferencias internacionales e incorporando las últimas tecnologías en su práctica.	Después de completar su licenciatura en medicina en la Universidad de Guadalajara, la Dra. López realizó su especialización en dermatología en el prestigioso Hospital Civil de Guadalajara. Perfeccionó sus habilidades en dermatología cosmética a través de programas de formación avanzada en Estados Unidos y Europa. La Dra. López está comprometida en brindar atención integral que aborde tanto las preocupaciones médicas como estéticas de sus pacientes. Ella cree en educar a los pacientes sobre sus condiciones dermatológicas y trabajar de manera colaborativa para desarrollar planes de tratamiento efectivos. Fuera de su consulta, la Dra. López hace trabajo voluntario en clínicas de salud comunitarias brindando atención dermatológica a poblaciones desatendidas.	12	{"Acné y Cicatrices de Acné","Eczema y Dermatitis Atópica",Psoriasis,Rosácea,"Melasma e Hiperpigmentación","Detección de Cáncer de Piel","Caída del Cabello (Alopecia)","Trastornos de las Uñas","Manchas de la Edad y Daño Solar","Verrugas y Lesiones Cutáneas"}	{"Botox y Rellenos Dérmicos","Peelings Químicos",Microdermoabrasión,"Resurfacing Láser","Fotofacial IPL",Crioterapia,"Eliminación de Lunares y Lesiones","Terapia con Plasma Rico en Plaquetas (PRP)","Microagujas (Microneedling)","Eliminación de Tatuajes"}	2025-12-15 00:00:00	{in_person,teleconsult}	Av. Américas 1500, Colonia Providencia, Guadalajara, Jalisco 44630, Mexico	+52 33 1234 5678	+52 33 1234 5678	{"friday": "9:00 AM - 5:00 PM", "monday": "9:00 AM - 6:00 PM", "sunday": "Closed", "tuesday": "9:00 AM - 6:00 PM", "saturday": "9:00 AM - 1:00 PM", "thursday": "9:00 AM - 6:00 PM", "wednesday": "9:00 AM - 6:00 PM"}	20.6736	-103.3954	https://www.linkedin.com/in/marialopezdermatologist	https://twitter.com/dramarialopez	2026-01-05 21:59:53.599	2026-01-05 21:59:53.599	warm
\.


--
-- Data for Name: education; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.education (id, doctor_id, institution, program, year, notes) FROM stdin;
cmk1peku90007uffch6dpd8vu	cmk1peku70001uffc2simlmby	Universidad de Guadalajara	Licenciatura en Medicina	2008	Graduada con honores
cmk1peku90008uffcump4vpij	cmk1peku70001uffc2simlmby	Hospital Civil de Guadalajara	Especialidad en Dermatología	2012	Jefe de Residentes 2011-2012
cmk1peku90009uffcev8ej3r6	cmk1peku70001uffc2simlmby	American Academy of Dermatology	Fellowship en Dermatología Cosmética	2013	Entrenamiento avanzado en láser y tratamientos inyectables
cmk1peku9000auffcavn2xlad	cmk1peku70001uffc2simlmby	International Society of Dermatology	Educación Médica Continua	2020	Certificada en Técnicas Láser Avanzadas
\.


--
-- Data for Name: faqs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.faqs (id, doctor_id, question, answer) FROM stdin;
cmk1peku9000juffcusfry857	cmk1peku70001uffc2simlmby	¿Aceptan seguros médicos?	Sí, aceptamos la mayoría de los planes de seguro principales. Por favor contacte a nuestro consultorio con su información de seguro para verificar cobertura antes de su cita.
cmk1peku9000kuffcs2u2sl5i	cmk1peku70001uffc2simlmby	¿Qué debo llevar a mi primera cita?	Por favor traiga una identificación válida, su tarjeta de seguro (si aplica), una lista de medicamentos actuales, y cualquier expediente médico relevante o resultados de estudios previos. Llegue 15 minutos antes para completar el papeleo.
cmk1peku9000luffcjegvo2t7	cmk1peku70001uffc2simlmby	¿Ofrecen consultas virtuales?	Sí, ofrecemos teleconsultas para evaluaciones iniciales y citas de seguimiento. Las visitas virtuales son convenientes y pueden atender muchas preocupaciones dermatológicas de manera remota.
cmk1pekua000muffcdeepk1q2	cmk1peku70001uffc2simlmby	¿Cuánto cuesta una consulta?	Una consulta general cuesta $40 USD. Esta tarifa puede aplicarse al tratamiento si procede con servicios el mismo día. También ofrecemos paquetes con precios especiales para múltiples tratamientos.
cmk1pekua000nuffc97cz60qg	cmk1peku70001uffc2simlmby	¿Cuál es su política de cancelación?	Requerimos al menos 24 horas de aviso para cancelaciones o reprogramaciones. Las cancelaciones tardías o inasistencias pueden incurrir en un cargo.
cmk1pekua000ouffclv11ao9g	cmk1peku70001uffc2simlmby	¿Son seguros los tratamientos cosméticos?	Todos nuestros tratamientos cosméticos se realizan usando productos y técnicas aprobadas por la FDA. La Dra. López discutirá los riesgos y beneficios potenciales durante su consulta y se asegurará de que sea un buen candidato para cualquier procedimiento.
cmk1pekua000puffc83szuy7b	cmk1peku70001uffc2simlmby	¿Cuánto duran los resultados del Botox?	Los resultados del Botox típicamente duran de 3 a 4 meses. Los resultados individuales pueden variar según factores como el metabolismo, la actividad muscular y el área tratada. Recomendamos tratamientos de mantenimiento para sostener resultados óptimos.
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, doctor_id, booking_id, patient_name, rating, comment, approved, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.services (id, doctor_id, service_name, short_description, duration_minutes, price) FROM stdin;
cmk1peku90002uffclce57t59	cmk1peku70001uffc2simlmby	Consulta General	Evaluación dermatológica completa y plan de tratamiento personalizado	30	40
cmk1peku90003uffc3hqchbtq	cmk1peku70001uffc2simlmby	Tratamiento con Botox	Reducción de arrugas faciales con inyecciones de toxina botulínica	45	120
cmk1peku90004uffcd5dbx5oa	cmk1peku70001uffc2simlmby	Tratamiento para el Acné	Manejo integral del acné incluyendo medicamentos y tratamientos procedimentales	30	50
cmk1peku90005uffcb018jz09	cmk1peku70001uffc2simlmby	Peeling Químico	Tratamiento de renovación cutánea para mejorar textura y tono de la piel	60	80
cmk1peku90006uffcxzkas2zn	cmk1peku70001uffc2simlmby	Depilación Láser	Reducción permanente del vello usando tecnología láser avanzada	45	60
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, image, role, doctor_id, created_at, updated_at) FROM stdin;
cmk1peknx0000uffcnirhme8r	admin@example.com	Platform Admin	\N	ADMIN	\N	2026-01-05 21:59:53.372	2026-01-05 21:59:53.372
cmk1pekut000ruffclcz10mx0	lopez.fafutis@gmail.com	Gerardo López	\N	DOCTOR	cmk1peku70001uffc2simlmby	2026-01-05 21:59:53.621	2026-01-05 21:59:53.621
\.


--
-- Name: encounter_versions_id_seq; Type: SEQUENCE SET; Schema: medical_records; Owner: -
--

SELECT pg_catalog.setval('medical_records.encounter_versions_id_seq', 3, true);


--
-- Name: patient_audit_logs_id_seq; Type: SEQUENCE SET; Schema: medical_records; Owner: -
--

SELECT pg_catalog.setval('medical_records.patient_audit_logs_id_seq', 1103, true);


--
-- Name: patient_medical_history_id_seq; Type: SEQUENCE SET; Schema: medical_records; Owner: -
--

SELECT pg_catalog.setval('medical_records.patient_medical_history_id_seq', 1, false);


--
-- Name: prescription_medications_id_seq; Type: SEQUENCE SET; Schema: medical_records; Owner: -
--

SELECT pg_catalog.setval('medical_records.prescription_medications_id_seq', 11, true);


--
-- Name: areas_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.areas_id_seq', 11, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.clients_id_seq', 3, true);


--
-- Name: ledger_attachments_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.ledger_attachments_id_seq', 1, false);


--
-- Name: ledger_entries_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.ledger_entries_id_seq', 39, true);


--
-- Name: ledger_facturas_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.ledger_facturas_id_seq', 1, false);


--
-- Name: ledger_facturas_xml_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.ledger_facturas_xml_id_seq', 1, false);


--
-- Name: product_attribute_values_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.product_attribute_values_id_seq', 1, true);


--
-- Name: product_attributes_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.product_attributes_id_seq', 2, true);


--
-- Name: product_components_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.product_components_id_seq', 1, false);


--
-- Name: products_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.products_id_seq', 7, true);


--
-- Name: proveedores_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.proveedores_id_seq', 3, true);


--
-- Name: purchase_items_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.purchase_items_id_seq', 40, true);


--
-- Name: purchases_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.purchases_id_seq', 36, true);


--
-- Name: quotation_items_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.quotation_items_id_seq', 11, true);


--
-- Name: quotations_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.quotations_id_seq', 3, true);


--
-- Name: sale_items_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.sale_items_id_seq', 100, true);


--
-- Name: sales_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.sales_id_seq', 47, true);


--
-- Name: subareas_id_seq; Type: SEQUENCE SET; Schema: practice_management; Owner: -
--

SELECT pg_catalog.setval('practice_management.subareas_id_seq', 6, true);


--
-- Name: clinical_encounters clinical_encounters_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.clinical_encounters
    ADD CONSTRAINT clinical_encounters_pkey PRIMARY KEY (id);


--
-- Name: encounter_versions encounter_versions_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.encounter_versions
    ADD CONSTRAINT encounter_versions_pkey PRIMARY KEY (id);


--
-- Name: patient_audit_logs patient_audit_logs_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_audit_logs
    ADD CONSTRAINT patient_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: patient_media patient_media_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_media
    ADD CONSTRAINT patient_media_pkey PRIMARY KEY (id);


--
-- Name: patient_medical_history patient_medical_history_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_medical_history
    ADD CONSTRAINT patient_medical_history_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: prescription_medications prescription_medications_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescription_medications
    ADD CONSTRAINT prescription_medications_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: ledger_attachments ledger_attachments_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_attachments
    ADD CONSTRAINT ledger_attachments_pkey PRIMARY KEY (id);


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: ledger_facturas ledger_facturas_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas
    ADD CONSTRAINT ledger_facturas_pkey PRIMARY KEY (id);


--
-- Name: ledger_facturas_xml ledger_facturas_xml_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas_xml
    ADD CONSTRAINT ledger_facturas_xml_pkey PRIMARY KEY (id);


--
-- Name: product_attribute_values product_attribute_values_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attribute_values
    ADD CONSTRAINT product_attribute_values_pkey PRIMARY KEY (id);


--
-- Name: product_attributes product_attributes_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attributes
    ADD CONSTRAINT product_attributes_pkey PRIMARY KEY (id);


--
-- Name: product_components product_components_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_components
    ADD CONSTRAINT product_components_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: proveedores proveedores_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.proveedores
    ADD CONSTRAINT proveedores_pkey PRIMARY KEY (id);


--
-- Name: purchase_items purchase_items_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchase_items
    ADD CONSTRAINT purchase_items_pkey PRIMARY KEY (id);


--
-- Name: purchases purchases_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchases
    ADD CONSTRAINT purchases_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: subareas subareas_pkey; Type: CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.subareas
    ADD CONSTRAINT subareas_pkey PRIMARY KEY (id);


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
-- Name: clinical_encounters_doctor_id_encounter_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX clinical_encounters_doctor_id_encounter_date_idx ON medical_records.clinical_encounters USING btree (doctor_id, encounter_date);


--
-- Name: clinical_encounters_doctor_id_status_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX clinical_encounters_doctor_id_status_idx ON medical_records.clinical_encounters USING btree (doctor_id, status);


--
-- Name: clinical_encounters_patient_id_encounter_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX clinical_encounters_patient_id_encounter_date_idx ON medical_records.clinical_encounters USING btree (patient_id, encounter_date);


--
-- Name: encounter_versions_encounter_id_created_at_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX encounter_versions_encounter_id_created_at_idx ON medical_records.encounter_versions USING btree (encounter_id, created_at);


--
-- Name: encounter_versions_encounter_id_version_number_key; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE UNIQUE INDEX encounter_versions_encounter_id_version_number_key ON medical_records.encounter_versions USING btree (encounter_id, version_number);


--
-- Name: patient_audit_logs_doctor_id_timestamp_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_audit_logs_doctor_id_timestamp_idx ON medical_records.patient_audit_logs USING btree (doctor_id, "timestamp");


--
-- Name: patient_audit_logs_patient_id_timestamp_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_audit_logs_patient_id_timestamp_idx ON medical_records.patient_audit_logs USING btree (patient_id, "timestamp");


--
-- Name: patient_audit_logs_user_id_timestamp_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_audit_logs_user_id_timestamp_idx ON medical_records.patient_audit_logs USING btree (user_id, "timestamp");


--
-- Name: patient_media_doctor_id_media_type_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_media_doctor_id_media_type_idx ON medical_records.patient_media USING btree (doctor_id, media_type);


--
-- Name: patient_media_encounter_id_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_media_encounter_id_idx ON medical_records.patient_media USING btree (encounter_id);


--
-- Name: patient_media_patient_id_capture_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_media_patient_id_capture_date_idx ON medical_records.patient_media USING btree (patient_id, capture_date);


--
-- Name: patient_medical_history_doctor_id_changed_at_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_medical_history_doctor_id_changed_at_idx ON medical_records.patient_medical_history USING btree (doctor_id, changed_at);


--
-- Name: patient_medical_history_patient_id_changed_at_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patient_medical_history_patient_id_changed_at_idx ON medical_records.patient_medical_history USING btree (patient_id, changed_at);


--
-- Name: patients_doctor_id_first_name_last_name_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patients_doctor_id_first_name_last_name_idx ON medical_records.patients USING btree (doctor_id, first_name, last_name);


--
-- Name: patients_doctor_id_internal_id_key; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE UNIQUE INDEX patients_doctor_id_internal_id_key ON medical_records.patients USING btree (doctor_id, internal_id);


--
-- Name: patients_doctor_id_last_visit_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patients_doctor_id_last_visit_date_idx ON medical_records.patients USING btree (doctor_id, last_visit_date);


--
-- Name: patients_doctor_id_status_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX patients_doctor_id_status_idx ON medical_records.patients USING btree (doctor_id, status);


--
-- Name: prescription_medications_prescription_id_order_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX prescription_medications_prescription_id_order_idx ON medical_records.prescription_medications USING btree (prescription_id, "order");


--
-- Name: prescriptions_doctor_id_prescription_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX prescriptions_doctor_id_prescription_date_idx ON medical_records.prescriptions USING btree (doctor_id, prescription_date);


--
-- Name: prescriptions_doctor_id_status_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX prescriptions_doctor_id_status_idx ON medical_records.prescriptions USING btree (doctor_id, status);


--
-- Name: prescriptions_patient_id_prescription_date_idx; Type: INDEX; Schema: medical_records; Owner: -
--

CREATE INDEX prescriptions_patient_id_prescription_date_idx ON medical_records.prescriptions USING btree (patient_id, prescription_date);


--
-- Name: areas_doctor_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX areas_doctor_id_idx ON practice_management.areas USING btree (doctor_id);


--
-- Name: areas_doctor_id_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX areas_doctor_id_name_key ON practice_management.areas USING btree (doctor_id, name);


--
-- Name: areas_doctor_id_type_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX areas_doctor_id_type_idx ON practice_management.areas USING btree (doctor_id, type);


--
-- Name: clients_doctor_id_business_name_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX clients_doctor_id_business_name_idx ON practice_management.clients USING btree (doctor_id, business_name);


--
-- Name: clients_doctor_id_business_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX clients_doctor_id_business_name_key ON practice_management.clients USING btree (doctor_id, business_name);


--
-- Name: clients_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX clients_doctor_id_status_idx ON practice_management.clients USING btree (doctor_id, status);


--
-- Name: ledger_attachments_ledger_entry_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_attachments_ledger_entry_id_idx ON practice_management.ledger_attachments USING btree (ledger_entry_id);


--
-- Name: ledger_entries_doctor_id_area_subarea_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_entries_doctor_id_area_subarea_idx ON practice_management.ledger_entries USING btree (doctor_id, area, subarea);


--
-- Name: ledger_entries_doctor_id_entry_type_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_entries_doctor_id_entry_type_idx ON practice_management.ledger_entries USING btree (doctor_id, entry_type);


--
-- Name: ledger_entries_doctor_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_entries_doctor_id_idx ON practice_management.ledger_entries USING btree (doctor_id);


--
-- Name: ledger_entries_doctor_id_internal_id_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX ledger_entries_doctor_id_internal_id_key ON practice_management.ledger_entries USING btree (doctor_id, internal_id);


--
-- Name: ledger_entries_doctor_id_por_realizar_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_entries_doctor_id_por_realizar_idx ON practice_management.ledger_entries USING btree (doctor_id, por_realizar);


--
-- Name: ledger_entries_doctor_id_transaction_date_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_entries_doctor_id_transaction_date_idx ON practice_management.ledger_entries USING btree (doctor_id, transaction_date);


--
-- Name: ledger_facturas_ledger_entry_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_facturas_ledger_entry_id_idx ON practice_management.ledger_facturas USING btree (ledger_entry_id);


--
-- Name: ledger_facturas_xml_ledger_entry_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_facturas_xml_ledger_entry_id_idx ON practice_management.ledger_facturas_xml USING btree (ledger_entry_id);


--
-- Name: ledger_facturas_xml_uuid_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX ledger_facturas_xml_uuid_idx ON practice_management.ledger_facturas_xml USING btree (uuid);


--
-- Name: ledger_facturas_xml_uuid_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX ledger_facturas_xml_uuid_key ON practice_management.ledger_facturas_xml USING btree (uuid);


--
-- Name: product_attribute_values_attribute_id_is_active_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_attribute_values_attribute_id_is_active_idx ON practice_management.product_attribute_values USING btree (attribute_id, is_active);


--
-- Name: product_attribute_values_attribute_id_order_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_attribute_values_attribute_id_order_idx ON practice_management.product_attribute_values USING btree (attribute_id, "order");


--
-- Name: product_attribute_values_attribute_id_value_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX product_attribute_values_attribute_id_value_key ON practice_management.product_attribute_values USING btree (attribute_id, value);


--
-- Name: product_attributes_doctor_id_is_active_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_attributes_doctor_id_is_active_idx ON practice_management.product_attributes USING btree (doctor_id, is_active);


--
-- Name: product_attributes_doctor_id_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX product_attributes_doctor_id_name_key ON practice_management.product_attributes USING btree (doctor_id, name);


--
-- Name: product_attributes_doctor_id_order_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_attributes_doctor_id_order_idx ON practice_management.product_attributes USING btree (doctor_id, "order");


--
-- Name: product_components_attribute_value_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_components_attribute_value_id_idx ON practice_management.product_components USING btree (attribute_value_id);


--
-- Name: product_components_product_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX product_components_product_id_idx ON practice_management.product_components USING btree (product_id);


--
-- Name: products_doctor_id_category_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX products_doctor_id_category_idx ON practice_management.products USING btree (doctor_id, category);


--
-- Name: products_doctor_id_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX products_doctor_id_name_key ON practice_management.products USING btree (doctor_id, name);


--
-- Name: products_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX products_doctor_id_status_idx ON practice_management.products USING btree (doctor_id, status);


--
-- Name: proveedores_doctor_id_business_name_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX proveedores_doctor_id_business_name_idx ON practice_management.proveedores USING btree (doctor_id, business_name);


--
-- Name: proveedores_doctor_id_business_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX proveedores_doctor_id_business_name_key ON practice_management.proveedores USING btree (doctor_id, business_name);


--
-- Name: proveedores_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX proveedores_doctor_id_status_idx ON practice_management.proveedores USING btree (doctor_id, status);


--
-- Name: purchase_items_product_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchase_items_product_id_idx ON practice_management.purchase_items USING btree (product_id);


--
-- Name: purchase_items_purchase_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchase_items_purchase_id_idx ON practice_management.purchase_items USING btree (purchase_id);


--
-- Name: purchases_doctor_id_payment_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_doctor_id_payment_status_idx ON practice_management.purchases USING btree (doctor_id, payment_status);


--
-- Name: purchases_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_doctor_id_status_idx ON practice_management.purchases USING btree (doctor_id, status);


--
-- Name: purchases_doctor_id_supplier_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_doctor_id_supplier_id_idx ON practice_management.purchases USING btree (doctor_id, supplier_id);


--
-- Name: purchases_purchase_date_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_purchase_date_idx ON practice_management.purchases USING btree (purchase_date);


--
-- Name: purchases_purchase_number_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_purchase_number_idx ON practice_management.purchases USING btree (purchase_number);


--
-- Name: purchases_purchase_number_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX purchases_purchase_number_key ON practice_management.purchases USING btree (purchase_number);


--
-- Name: purchases_quotation_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX purchases_quotation_id_idx ON practice_management.purchases USING btree (quotation_id);


--
-- Name: quotation_items_product_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotation_items_product_id_idx ON practice_management.quotation_items USING btree (product_id);


--
-- Name: quotation_items_quotation_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotation_items_quotation_id_idx ON practice_management.quotation_items USING btree (quotation_id);


--
-- Name: quotations_doctor_id_client_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotations_doctor_id_client_id_idx ON practice_management.quotations USING btree (doctor_id, client_id);


--
-- Name: quotations_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotations_doctor_id_status_idx ON practice_management.quotations USING btree (doctor_id, status);


--
-- Name: quotations_issue_date_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotations_issue_date_idx ON practice_management.quotations USING btree (issue_date);


--
-- Name: quotations_quotation_number_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX quotations_quotation_number_idx ON practice_management.quotations USING btree (quotation_number);


--
-- Name: quotations_quotation_number_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX quotations_quotation_number_key ON practice_management.quotations USING btree (quotation_number);


--
-- Name: sale_items_product_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sale_items_product_id_idx ON practice_management.sale_items USING btree (product_id);


--
-- Name: sale_items_sale_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sale_items_sale_id_idx ON practice_management.sale_items USING btree (sale_id);


--
-- Name: sales_doctor_id_client_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_doctor_id_client_id_idx ON practice_management.sales USING btree (doctor_id, client_id);


--
-- Name: sales_doctor_id_payment_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_doctor_id_payment_status_idx ON practice_management.sales USING btree (doctor_id, payment_status);


--
-- Name: sales_doctor_id_status_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_doctor_id_status_idx ON practice_management.sales USING btree (doctor_id, status);


--
-- Name: sales_quotation_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_quotation_id_idx ON practice_management.sales USING btree (quotation_id);


--
-- Name: sales_sale_date_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_sale_date_idx ON practice_management.sales USING btree (sale_date);


--
-- Name: sales_sale_number_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX sales_sale_number_idx ON practice_management.sales USING btree (sale_number);


--
-- Name: sales_sale_number_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX sales_sale_number_key ON practice_management.sales USING btree (sale_number);


--
-- Name: subareas_area_id_idx; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE INDEX subareas_area_id_idx ON practice_management.subareas USING btree (area_id);


--
-- Name: subareas_area_id_name_key; Type: INDEX; Schema: practice_management; Owner: -
--

CREATE UNIQUE INDEX subareas_area_id_name_key ON practice_management.subareas USING btree (area_id, name);


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
-- Name: clinical_encounters clinical_encounters_patient_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.clinical_encounters
    ADD CONSTRAINT clinical_encounters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: encounter_versions encounter_versions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.encounter_versions
    ADD CONSTRAINT encounter_versions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES medical_records.clinical_encounters(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_audit_logs patient_audit_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_audit_logs
    ADD CONSTRAINT patient_audit_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_media patient_media_encounter_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_media
    ADD CONSTRAINT patient_media_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES medical_records.clinical_encounters(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: patient_media patient_media_patient_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_media
    ADD CONSTRAINT patient_media_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patient_medical_history patient_medical_history_patient_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patient_medical_history
    ADD CONSTRAINT patient_medical_history_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: patients patients_doctor_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.patients
    ADD CONSTRAINT patients_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: prescription_medications prescription_medications_prescription_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescription_medications
    ADD CONSTRAINT prescription_medications_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES medical_records.prescriptions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: prescriptions prescriptions_encounter_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescriptions
    ADD CONSTRAINT prescriptions_encounter_id_fkey FOREIGN KEY (encounter_id) REFERENCES medical_records.clinical_encounters(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: prescriptions prescriptions_patient_id_fkey; Type: FK CONSTRAINT; Schema: medical_records; Owner: -
--

ALTER TABLE ONLY medical_records.prescriptions
    ADD CONSTRAINT prescriptions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES medical_records.patients(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: areas areas_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.areas
    ADD CONSTRAINT areas_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clients clients_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.clients
    ADD CONSTRAINT clients_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ledger_attachments ledger_attachments_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_attachments
    ADD CONSTRAINT ledger_attachments_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES practice_management.ledger_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_client_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_client_id_fkey FOREIGN KEY (client_id) REFERENCES practice_management.clients(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ledger_entries ledger_entries_purchase_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES practice_management.purchases(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_sale_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES practice_management.sales(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ledger_entries ledger_entries_supplier_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_entries
    ADD CONSTRAINT ledger_entries_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES practice_management.proveedores(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ledger_facturas ledger_facturas_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas
    ADD CONSTRAINT ledger_facturas_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES practice_management.ledger_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ledger_facturas_xml ledger_facturas_xml_ledger_entry_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.ledger_facturas_xml
    ADD CONSTRAINT ledger_facturas_xml_ledger_entry_id_fkey FOREIGN KEY (ledger_entry_id) REFERENCES practice_management.ledger_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_attribute_values product_attribute_values_attribute_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attribute_values
    ADD CONSTRAINT product_attribute_values_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES practice_management.product_attributes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_attributes product_attributes_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_attributes
    ADD CONSTRAINT product_attributes_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_components product_components_attribute_value_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_components
    ADD CONSTRAINT product_components_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES practice_management.product_attribute_values(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: product_components product_components_product_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.product_components
    ADD CONSTRAINT product_components_product_id_fkey FOREIGN KEY (product_id) REFERENCES practice_management.products(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: products products_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.products
    ADD CONSTRAINT products_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: proveedores proveedores_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.proveedores
    ADD CONSTRAINT proveedores_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchase_items purchase_items_product_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchase_items
    ADD CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES practice_management.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchase_items purchase_items_purchase_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchase_items
    ADD CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES practice_management.purchases(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchases purchases_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchases
    ADD CONSTRAINT purchases_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: purchases purchases_quotation_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchases
    ADD CONSTRAINT purchases_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES practice_management.quotations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: purchases purchases_supplier_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.purchases
    ADD CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES practice_management.proveedores(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotation_items quotation_items_product_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotation_items
    ADD CONSTRAINT quotation_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES practice_management.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES practice_management.quotations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotations quotations_client_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotations
    ADD CONSTRAINT quotations_client_id_fkey FOREIGN KEY (client_id) REFERENCES practice_management.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotations quotations_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.quotations
    ADD CONSTRAINT quotations_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES practice_management.products(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES practice_management.sales(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales sales_client_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sales
    ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES practice_management.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sales sales_doctor_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sales
    ADD CONSTRAINT sales_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sales sales_quotation_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.sales
    ADD CONSTRAINT sales_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES practice_management.quotations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: subareas subareas_area_id_fkey; Type: FK CONSTRAINT; Schema: practice_management; Owner: -
--

ALTER TABLE ONLY practice_management.subareas
    ADD CONSTRAINT subareas_area_id_fkey FOREIGN KEY (area_id) REFERENCES practice_management.areas(id) ON UPDATE CASCADE ON DELETE CASCADE;


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

