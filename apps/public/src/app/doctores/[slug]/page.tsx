// Doctor Profile Page - Main page with all sections
import { notFound } from 'next/navigation';
import { getDoctorBySlug, getAllDoctorSlugs } from '@/lib/data';
import DoctorProfileClient from '@/components/doctor/DoctorProfileClient';
import ColorPaletteProvider from '@/components/ui/ColorPaletteProvider';

interface DoctorProfilePageProps {
  params: Promise<{ slug: string }>;
}

export default async function DoctorProfilePage({ params }: DoctorProfilePageProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    notFound();
  }

  return (
    <ColorPaletteProvider paletteId={doctor.color_palette}>
      <DoctorProfileClient doctor={doctor} />
    </ColorPaletteProvider>
  );
}

// Generate static params for all doctor slugs
export async function generateStaticParams() {
  const slugs = await getAllDoctorSlugs();

  return slugs.map((slug) => ({
    slug,
  }));
}

// Enable static generation with revalidation
export const revalidate = 3600; // Revalidate every hour
