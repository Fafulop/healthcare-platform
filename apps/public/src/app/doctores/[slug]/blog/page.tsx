// Blog Listing Page for Doctor
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDoctorBySlug, getArticlesByDoctorSlug } from '@/lib/data';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import BlogLayoutClient from '@/components/blog/BlogLayoutClient';
import { ArticleCard } from '@/components/blog/ArticleCard';

interface BlogListingPageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);

  if (!doctor) {
    return {
      title: 'Blog Not Found',
      description: 'The requested blog could not be found.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const title = `Blog de ${doctor.doctor_full_name} - ${doctor.primary_specialty}`;
  const description = `Artículos y consejos de salud por ${doctor.doctor_full_name}, ${doctor.primary_specialty} en ${doctor.city}. Información médica confiable y actualizada.`;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    openGraph: {
      title,
      description,
      url: `${baseUrl}/doctores/${slug}/blog`,
      siteName: 'HealthCare Platform',
      images: [
        {
          url: doctor.hero_image,
          width: 1200,
          height: 630,
          alt: `${doctor.doctor_full_name} - ${doctor.primary_specialty}`,
        },
      ],
      locale: 'es_MX',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [doctor.hero_image],
    },
    alternates: {
      canonical: `${baseUrl}/doctores/${slug}/blog`,
    },
  };
}

export default async function BlogListingPage({ params }: BlogListingPageProps) {
  const { slug } = await params;
  const doctor = await getDoctorBySlug(slug);
  const articles = await getArticlesByDoctorSlug(slug);

  if (!doctor) {
    notFound();
  }

  return (
    <BlogLayoutClient doctorSlug={doctor.slug} clinicInfo={doctor.clinic_info}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Back to Profile */}
        <Link
          href={`/doctores/${slug}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Perfil
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Blog de {doctor.doctor_full_name}
          </h1>
          <p className="text-lg text-gray-600">
            Artículos y consejos de salud por {doctor.doctor_full_name}, {doctor.primary_specialty}
          </p>
        </div>

        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-600 text-lg">Próximamente artículos de salud</p>
            <p className="text-gray-500 mt-2">
              Estamos trabajando en contenido educativo para ti
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                slug={article.slug}
                title={article.title}
                excerpt={article.excerpt}
                thumbnail={article.thumbnail}
                publishedAt={article.publishedAt}
                views={article.views}
                doctorSlug={slug}
              />
            ))}
          </div>
        )}
      </div>
    </BlogLayoutClient>
  );
}

// Enable static generation with revalidation
export const revalidate = 3600; // Revalidate every hour
