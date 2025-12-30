// TypeScript interfaces for Doctor Profile data structure
// Based on SEO_GUIDE.md blueprint

export interface Service {
  service_name: string;
  short_description: string;
  duration_minutes: number;
  price?: number;
  schema_procedure_code?: string;
}

export interface Education {
  institution: string;
  program: string;
  year: string;
  notes?: string;
}

export interface Credential {
  src: string;
  alt: string;
  issued_by: string;
  year: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface CarouselItem {
  type: 'image' | 'video_thumbnail';
  src: string;
  alt: string;
  caption?: string;
  thumbnail?: string; // for video
  // Video metadata for SEO
  name?: string; // video title
  description?: string; // video description
  uploadDate?: string; // ISO date format
  duration?: string; // ISO 8601 duration format (e.g., "PT1M30S" for 1 min 30 sec)
}

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface OfficeHours {
  [key: string]: string; // e.g., "monday": "9:00 AM - 5:00 PM"
}

export interface ClinicInfo {
  address: string;
  phone: string;
  whatsapp?: string;
  hours?: OfficeHours;
  geo: GeoCoordinates;
}

export interface Review {
  id: string;
  patientName: string | null;
  rating: number; // 1-5
  comment: string;
  createdAt: Date;
}

export interface ReviewStats {
  averageRating: number;
  reviewCount: number;
}

export interface DoctorProfile {
  // Basic Information
  slug: string;
  doctor_full_name: string;
  last_name: string;
  primary_specialty: string;
  subspecialties?: string[];
  cedula_profesional?: string;

  // Hero Section
  hero_image: string;
  location_summary: string; // e.g., "Guadalajara, Jalisco"
  city: string;

  // Services
  services_list: Service[];

  // Conditions & Procedures
  conditions: string[];
  procedures: string[];

  // Appointment
  next_available_date?: string; // ISO date format
  appointment_modes: ('in_person' | 'teleconsult')[];

  // Media Carousel
  carousel_items: CarouselItem[];

  // Biography
  short_bio: string;
  long_bio?: string;
  years_experience: number;

  // Education
  education_items: Education[];

  // Credentials
  certificate_images: Credential[];

  // Clinic Location
  clinic_info: ClinicInfo;

  // FAQ
  faqs: FAQ[];

  // Social/Professional Links (optional)
  social_links?: {
    linkedin?: string;
    researchgate?: string;
    twitter?: string;
  };

  // Color Palette (for personalized branding)
  color_palette?: string; // ID of the color palette (warm, blue, green, etc.)

  // Reviews
  reviews?: Review[];
  reviewStats?: ReviewStats;
}
