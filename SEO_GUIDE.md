# Doctor Profile SEO Frontend Blueprint

```json
{
  "blueprint_name": "doctor_profile_seo_frontend_v1",
  "description": "LLM-friendly JSON blueprint describing structure, SEO rules, tech-stack guidance, and generation constraints for a doctor profile page. Use this to generate HTML/React/Next.js templates, populate content, or validate produced pages.",
  "version": "1.0",
  "page_level": {
    "title_template": "{doctor_full_name} | {primary_specialty} | {city}",
    "meta_description_template": "Dr. {last_name}, {primary_specialty} in {city}. {short_bio_snippet} | Book appointments, view services, credentials, and clinic location.",
    "primary_h1_field": "doctor_full_name",
    "schema_types": ["Physician", "MedicalBusiness", "FAQPage"],
    "rendering_recommendation": "Server-side render all textual content (Next.js/SSR) and dynamically import heavy interactive widgets (carousel, calendar).",
    "performance_guidelines": {
      "image_format": ["webp", "avif"],
      "preload": "LCP image (hero photo)",
      "lazy_load": "all gallery and below-fold images except first visible image",
      "minimize_js": "dynamic import for calendar and carousel; avoid autoplay videos",
      "css": "use Tailwind or critical CSS extraction to keep CSS payload small"
    }
  },
  "section_order_optimal": [
    "hero",
    "services",
    "conditions_treated",
    "appointment_calendar",
    "carousel",
    "biography",
    "education",
    "credentials",
    "clinic_location",
    "faq",
    "articles_optional"
  ],
  "sections": [
    {
      "id": "hero",
      "title": "Hero / Top",
      "position": 1,
      "purpose": "Identity + primary SEO anchor. Introduce doctor and primary keywords.",
      "seo_rules": [
        "Only H1 on page: doctor_full_name",
        "Include city and primary specialty near H1 (H2/H3 allowed)",
        "Use descriptive alt text for hero image and preload it"
      ],
      "tech_notes": [
        "Use Next.js <Image> or native <img> with preload link for LCP",
        "Keep DOM light (no heavy widgets in hero)"
      ],
      "fields": {
        "doctor_full_name": {"type": "string", "required": true},
        "primary_specialty": {"type": "string", "required": true},
        "subspecialties": {"type": "array", "items": "string"},
        "cedula_profesional": {"type": "string", "required": false},
        "hero_image": {"type": "image", "alt_required": true},
        "location_summary": {"type": "string", "format": "city, neighborhood"},
        "ctas": {"type": "array", "items": ["book_appointment", "call", "whatsapp"]}
      },
      "example_output_snippet": "<h1>Dr. María López</h1><h2>Dermatologist — Guadalajara</h2>"
    },
    {
      "id": "services",
      "title": "Services & Pricing",
      "position": 2,
      "purpose": "Primary conversion & keyword section. Ranks for procedures and treatment keywords.",
      "seo_rules": [
        "Use H2: 'Services' and individual H3s for each service",
        "Prefer full clinical terms and local-language variants (e.g., 'Consulta general', 'Botox facial')",
        "Provide text descriptions (not only images) for each service"
      ],
      "tech_notes": [
        "Store services as structured JSON for easy indexing and linking",
        "Each service card should be crawlable and server-rendered"
      ],
      "fields": {
        "services_list": {
          "type": "array",
          "items": {
            "service_name": "string",
            "short_description": "string",
            "duration_minutes": "integer",
            "price": {"type": "number", "optional": true},
            "schema_procedure_code": {"type": "string", "optional": true}
          }
        }
      },
      "examples": [
        {"service_name": "Consulta general", "short_description": "Evaluación y plan inicial", "duration_minutes": 30, "price": 40}
      ]
    },
    {
      "id": "conditions_treated",
      "title": "Conditions Treated / Procedures Performed",
      "position": 3,
      "purpose": "High-value SEO keywords for patients searching conditions; supports topical authority.",
      "seo_rules": [
        "Use bulleted lists and keyword-rich phrases",
        "Avoid keyword stuffing — keep readable",
        "Include synonyms and common patient phrases"
      ],
      "tech_notes": [
        "Provide as server-rendered HTML lists; store in JSON for CMS edits",
        "Link each condition to internal anchor or article when available"
      ],
      "fields": {
        "conditions": {"type": "array", "items": "string"},
        "procedures": {"type": "array", "items": "string"}
      }
    },
    {
      "id": "appointment_calendar",
      "title": "Appointment Calendar / Availability",
      "position": 4,
      "purpose": "Conversion element — shows availability and enables booking.",
      "seo_rules": [
        "Not an SEO text provider; keep below keyword-rich sections",
        "Do not render bookable slots as heavy server-side content that blocks LCP"
      ],
      "tech_notes": [
        "Client-side dynamic import only (no SSR).",
        "Expose minimal accessible text: 'Next available date: YYYY-MM-DD' in HTML for crawlers.",
        "Avoid embedding heavy third-party widgets directly in DOM before interaction"
      ],
      "fields": {
        "next_available_date": {"type": "string", "format": "date", "required": false},
        "modes": {"type": "array", "items": ["in_person", "teleconsult"]}
      }
    },
    {
      "id": "carousel",
      "title": "Carousel (Photos & Short Videos)",
      "position": 5,
      "purpose": "Trust-building through visual evidence: clinic, diplomas, short intro videos, before/after where legal.",
      "seo_risks_and_mitigation": [
        "Risk: heavy media can hurt LCP and Core Web Vitals. Mitigation: lazy-load all except first visible image, use compressed formats, dynamically import the carousel component.",
        "Risk: if images/videos are not in DOM as <img> elements, search engines may not index them. Mitigation: ensure thumbnail <img> tags with alt text exist in DOM."
      ],
      "seo_rules": [
        "Provide descriptive alt text for every image",
        "Use video thumbnails as images with captions; do not autoplay",
        "Place carousel after Services/Conditions to preserve textual priority"
      ],
      "tech_notes": [
        "Use dynamic import: dynamic(() => import('./Carousel'), { ssr: false })",
        "Modal playback for videos; store video metadata (title, duration) in JSON-LD"
      ],
      "fields": {
        "items": {
          "type": "array",
          "items": {
            "type": {"enum": ["image", "video_thumbnail"]},
            "src": "string",
            "alt": "string",
            "caption": "string",
            "thumbnail": "string (for video)"
          }
        }
      }
    },
    {
      "id": "biography",
      "title": "Biography",
      "position": 6,
      "purpose": "Adds E-E-A-T context and supporting keywords; improves conversion.",
      "seo_rules": [
        "Include experience years, notable areas of focus, and a short narrative",
        "Avoid duplicate content across pages; make bio unique per profile"
      ],
      "tech_notes": [
        "Keep as text content server-rendered; can be authored as Markdown in CMS",
        "Limit length for preview; include 'read more' that expands client-side"
      ],
      "fields": {
        "short_bio": {"type": "string"},
        "long_bio": {"type": "string", "optional": true},
        "years_experience": {"type": "integer"}
      }
    },
    {
      "id": "education",
      "title": "Education",
      "position": 7,
      "purpose": "E-E-A-T proof: school, residency, fellowships.",
      "seo_rules": [
        "Render as text list (school, degree, year)",
        "Do not rely only on images for diplomas — provide textual equivalents"
      ],
      "tech_notes": [
        "Structured JSON preferred for each item: institution, degree, year, notes",
        "Allow linking to certification images in Credentials section"
      ],
      "fields": {
        "education_items": {
          "type": "array",
          "items": {
            "institution": "string",
            "program": "string",
            "year": "string",
            "notes": "string"
          }
        }
      }
    },
    {
      "id": "credentials",
      "title": "Certifications & Diplomas",
      "position": 8,
      "purpose": "Visual proof of qualifications; supports trust and conversions.",
      "seo_rules": [
        "Include text listing of certifications in addition to images",
        "All images must have descriptive alt text and captions"
      ],
      "tech_notes": [
        "Use a lightweight gallery or the carousel items for diplomas",
        "Compress images and lazy-load except the first visible credential if near top"
      ],
      "fields": {
        "certificate_images": {
          "type": "array",
          "items": {"src": "string", "alt": "string", "issued_by": "string", "year": "string"}
        }
      }
    },
    {
      "id": "clinic_location",
      "title": "Clinic Information & Map",
      "position": 9,
      "purpose": "Local SEO signal: address, phone, hours, map link.",
      "seo_rules": [
        "Render address and phone as plain text (click-to-call for mobile)",
        "Include structured data LocalBusiness with geo coordinates",
        "Use a deep link to Google Maps instead of heavy iframe when possible"
      ],
      "tech_notes": [
        "Provide both a static map image (optimized) and a 'View on Google Maps' link",
        "If embedding an iframe, load lazily and only after interaction"
      ],
      "fields": {
        "address": "string",
        "phone": {"type": "string", "tel_format": true},
        "whatsapp": {"type": "string", "optional": true},
        "hours": {"type": "object", "optional": true},
        "geo": {"lat": "number", "lng": "number"}
      }
    },
    {
      "id": "faq",
      "title": "FAQ",
      "position": 10,
      "purpose": "Opportunity for rich snippets and direct answers in SERPs.",
      "seo_rules": [
        "Implement FAQPage JSON-LD for eligible Q&A",
        "Keep Q&A concise and user-focused"
      ],
      "tech_notes": [
        "Store FAQs as JSON and inject JSON-LD server-side inside <Head>",
        "Limit to high-value user questions (booking, fees, first visit)"
      ],
      "fields": {
        "faqs": {
          "type": "array",
          "items": {"question": "string", "answer": "string"}
        }
      }
    },
    {
      "id": "articles_optional",
      "title": "Articles / Blog (Optional)",
      "position": 11,
      "purpose": "Build topical authority and internal linking.",
      "seo_rules": [
        "Each article should be its own page with canonical tags",
        "Link from services/conditions to relevant articles"
      ],
      "tech_notes": [
        "Use a CMS/Markdown for articles; prefer server-rendered pages for SEO",
        "Support AMP-like fast pages if blog drives significant traffic"
      ],
      "fields": {
        "articles": {
          "type": "array",
          "items": {"slug": "string", "title": "string", "excerpt": "string", "published_date": "string"}
        }
      }
    }
  ],
  "structured_data_templates": {
    "physician_jsonld": {
      "@context": "https://schema.org",
      "@type": "Physician",
      "name": "{doctor_full_name}",
      "description": "{meta_description}",
      "medicalSpecialty": "{primary_specialty}",
      "url": "{page_url}",
      "image": "{hero_image_url}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "{city}",
        "streetAddress": "{address}"
      },
      "telephone": "{phone}",
      "sameAs": ["{profile_linkedin}", "{profile_researchgate}", "{profile_twitter}"]
    },
    "faq_jsonld_example": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {"@type": "Question", "name": "{faq_q1}", "acceptedAnswer": {"@type": "Answer", "text": "{faq_a1}"}}
      ]
    }
  },
  "llm_generation_rules": {
    "headings": {
      "h1": "doctor_full_name (only one h1 allowed)",
      "h2": "major sections (Services, Conditions, Biography, Education, Credentials, Clinic Info, FAQ)",
      "h3": "subsections within services/education/credentials"
    },
    "content_quality": [
      "Prefer original unique text per profile",
      "Avoid copying entire third-party bios without modification",
      "Generate alt text for every image (descriptive, < 125 chars)"
    ],
    "seo_validation_checks": [
      "Ensure meta title and meta description present and follow templates",
      "Ensure at least 300 words of unique textual content across Biography + Services + Conditions combined",
      "Ensure schema.org JSON-LD for Physician is injected in <Head>"
    ],
    "performance_checks": [
      "Hero image preloaded and < 200KB when possible",
      "No autoplaying videos",
      "Carousel and calendar dynamically imported"
    ],
    "accessibility_checks": [
      "All interactive elements keyboard-accessible",
      "Images have alt, buttons have aria-labels when needed",
      "Color contrast meets WCAG AA for primary CTAs"
    ],
    "content_prioritization_policy": {
      "must_render_server_side": ["hero", "services", "conditions_treated", "biography", "education", "clinic_location", "schema_jsonld"],
      "client_side_only": ["appointment_calendar_widget", "carousel_interactive_js", "video_playback_modal"]
    }
  },
  "validation_example": {
    "checks": [
      {"check": "H1 present", "required": true},
      {"check": "Title follows template", "required": true},
      {"check": "Meta description present", "required": true},
      {"check": "Services list not empty", "required": true},
      {"check": "At least one contact method present", "required": true},
      {"check": "Physician JSON-LD present", "required": true}
    ],
    "sample_error_responses": {
      "missing_h1": "ERROR: Missing doctor_full_name as H1.",
      "no_services": "WARNING: Services list empty — reduces SEO effectiveness.",
      "no_schema": "ERROR: Missing Physician schema.org JSON-LD in <head>."
    }
  },
  "notes_for_engineers": {
    "preferred_stack": ["Next.js (13+)", "React 18+", "TailwindCSS", "Vercel or similar SSR host"],
    "data_sources": ["CMS (Sanity/Strapi/Contentful) or structured JSON from backend (Supabase/Postgres)"],
    "authorship": "Keep editable fields in CMS; keep presentation logic in components.",
    "privacy_and_regulations": "Ensure compliance with local advertising and medical regulations for testimonials, before/after images, and pricing."
  }
}
```
