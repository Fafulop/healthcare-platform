// Doctor Profile Layout with Dynamic Metadata and Structured Data
import { Metadata } from 'next';
import Script from 'next/script';
import { getDoctorBySlug } from '@/lib/data';
import { generateDoctorMetadata } from '@/lib/seo';
import { generateAllSchemas } from '@/lib/structured-data';
import { notFound } from 'next/navigation';

interface DoctorLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    return {
      title: 'Doctor Not Found',
      description: 'The requested doctor profile could not be found.',
    };
  }

  // Use the base URL from environment variable or default
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';

  return generateDoctorMetadata(doctor, baseUrl);
}

export default async function DoctorLayout({ children, params }: DoctorLayoutProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    notFound();
  }

  // Generate structured data schemas
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const schemas = generateAllSchemas(doctor, baseUrl);

  return (
    <>
      {/* Inject JSON-LD structured data */}
      {schemas.map((schema, index) => (
        <Script
          key={index}
          id={`schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
          strategy="beforeInteractive"
        />
      ))}

      {/* Preload hero image for LCP optimization */}
      <link
        rel="preload"
        as="image"
        href={doctor.hero_image}
        fetchPriority="high"
      />

      {/* Pass doctor data to children via context-like pattern */}
      <div className="doctor-layout-wrapper">
        {children}
      </div>
    </>
  );
}
