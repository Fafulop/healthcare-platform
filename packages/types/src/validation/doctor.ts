import { z } from 'zod';

/**
 * Validation schema for creating a doctor profile
 * Ensures all required fields are present and valid
 */
export const createDoctorSchema = z.object({
  // Basic Information
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  doctor_full_name: z.string().min(3).max(100),
  last_name: z.string().min(2).max(50),
  primary_specialty: z.string().min(2).max(100),
  subspecialties: z.array(z.string()).optional().default([]),
  cedula_profesional: z.string().optional(),
  hero_image: z.string().url('Hero image must be a valid URL'),
  location_summary: z.string().min(3).max(200),
  city: z.string().min(2).max(100),

  // Biography
  short_bio: z.string().min(50).max(500),
  long_bio: z.string().min(100).max(5000).optional().default(''),
  years_experience: z.number().int().min(0).max(60),

  // Lists
  conditions: z.array(z.string()).optional().default([]),
  procedures: z.array(z.string()).optional().default([]),

  // Appointment Info
  next_available_date: z.string().datetime().optional(),
  appointment_modes: z.array(z.string()).optional().default([]),

  // Clinic Information
  clinic_info: z.object({
    address: z.string().min(5).max(300),
    phone: z.string().min(8).max(20),
    whatsapp: z.string().min(8).max(20).optional(),
    hours: z.record(z.any()).optional().default({}),
    geo: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }).optional(),
  }),

  // Social Links
  social_links: z.object({
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
  }).optional(),

  // Related Data
  services_list: z.array(z.object({
    service_name: z.string().min(3).max(200),
    short_description: z.string().min(10).max(500),
    duration_minutes: z.number().int().min(5).max(480),
    price: z.number().min(0).optional(),
  })).optional().default([]),

  education_items: z.array(z.object({
    institution: z.string().min(3).max(200),
    program: z.string().min(3).max(200),
    year: z.string().regex(/^\d{4}$/, 'Year must be 4 digits'),
    notes: z.string().max(500).optional(),
  })).optional().default([]),

  certificate_images: z.array(z.object({
    src: z.string().url('Certificate image must be a valid URL'),
    alt: z.string().min(5).max(200),
    issued_by: z.string().min(3).max(200),
    year: z.string().regex(/^\d{4}$/, 'Year must be 4 digits'),
  })).optional().default([]),

  carousel_items: z.array(z.object({
    type: z.enum(['image', 'video_thumbnail']),
    src: z.string().url('Carousel item must be a valid URL'),
    thumbnail: z.string().url().optional(),
    alt: z.string().min(5).max(200),
    caption: z.string().max(200).optional(),
    name: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
    uploadDate: z.string().optional(),
    duration: z.string().optional(),
  })).optional().default([]),

  faqs: z.array(z.object({
    question: z.string().min(10).max(300),
    answer: z.string().min(20).max(2000),
  })).optional().default([]),
});

/**
 * Type inference from schema
 */
export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;

/**
 * Validation schema for updating a doctor profile
 * All fields are optional since we might update only specific fields
 */
export const updateDoctorSchema = createDoctorSchema.partial();

export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
