// Individual Article Page
import { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { getDoctorBySlug, getArticle } from '@/lib/data';
import { generateBlogPostingSchema } from '@/lib/structured-data';
import Link from 'next/link';
import { Calendar, Eye, ArrowLeft } from 'lucide-react';
import BlogLayoutClient from '@/components/blog/BlogLayoutClient';
import { ArticleContent } from '@/components/blog/ArticleContent';
import ColorPaletteProvider from '@/components/ui/ColorPaletteProvider';

interface ArticlePageProps {
  params: Promise<{ slug: string; articleSlug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string; articleSlug: string }> }): Promise<Metadata> {
  const { slug, articleSlug } = await params;
  const article = await getArticle(slug, articleSlug);

  if (!article) {
    return {
      title: 'Article Not Found',
      description: 'The requested article could not be found.',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const title = `${article.title} - ${article.doctor.doctorFullName}`;
  const description = article.metaDescription || article.excerpt;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    keywords: article.keywords,
    authors: [{ name: article.doctor.doctorFullName }],
    openGraph: {
      title,
      description,
      url: `${baseUrl}/doctores/${slug}/blog/${articleSlug}`,
      siteName: 'HealthCare Platform',
      images: article.thumbnail ? [
        {
          url: article.thumbnail,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ] : [
        {
          url: article.doctor.heroImage,
          width: 1200,
          height: 630,
          alt: article.doctor.doctorFullName,
        },
      ],
      locale: 'es_MX',
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.doctor.doctorFullName],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: article.thumbnail ? [article.thumbnail] : [article.doctor.heroImage],
    },
    alternates: {
      canonical: `${baseUrl}/doctores/${slug}/blog/${articleSlug}`,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug, articleSlug } = await params;
  const doctor = await getDoctorBySlug(slug);
  const article = await getArticle(slug, articleSlug);

  if (!doctor || !article) {
    notFound();
  }

  // Generate structured data for SEO
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://example.com';
  const blogPostingSchema = generateBlogPostingSchema(article, baseUrl);

  return (
    <ColorPaletteProvider paletteId={doctor.color_palette}>
      {/* Inject BlogPosting structured data */}
      <Script
        id="blog-posting-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
        strategy="beforeInteractive"
      />

      <BlogLayoutClient doctorSlug={doctor.slug} clinicInfo={doctor.clinic_info}>
      <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
              <Link href={`/doctores/${slug}`} className="hover:text-green-600">
                Perfil
              </Link>
              <span>/</span>
              <Link href={`/doctores/${slug}/blog`} className="hover:text-green-600">
                Blog
              </Link>
              <span>/</span>
              <span className="text-gray-900">{article.title}</span>
            </div>

            {/* Article Header */}
            <article>
              <header className="mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  {article.title}
                </h1>

                {/* Author Info */}
                <div className="flex items-center gap-4 py-4 border-y border-gray-200">
                  <img
                    src={article.doctor.heroImage}
                    alt={article.doctor.doctorFullName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-gray-900">
                      {article.doctor.doctorFullName}
                    </p>
                    <p className="text-sm text-gray-600">
                      {article.doctor.primarySpecialty}
                    </p>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(article.publishedAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {article.views} vistas
                  </span>
                </div>

                {/* Featured Image */}
                {article.thumbnail && (
                  <div className="mt-8 rounded-lg overflow-hidden">
                    <img
                      src={article.thumbnail}
                      alt={article.title}
                      className="w-full h-auto"
                    />
                  </div>
                )}
              </header>

              {/* Article Content */}
              <ArticleContent content={article.content} />

              {/* Back to Blog */}
              <div className="mt-12 pt-8 border-t border-gray-200">
                <Link
                  href={`/doctores/${slug}/blog`}
                  className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Ver más artículos
                </Link>
              </div>
            </article>
          </div>
      </BlogLayoutClient>
    </ColorPaletteProvider>
  );
}

// Enable static generation with revalidation
export const revalidate = 3600; // Revalidate every hour
