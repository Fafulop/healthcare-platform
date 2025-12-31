import { MetadataRoute } from 'next'
import { getAllDoctorSlugs, getArticlesByDoctorSlug } from '@/lib/data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  // Fetch all doctor slugs from API
  const doctorSlugs = await getAllDoctorSlugs()

  // Create sitemap entries for all doctor pages
  const doctorPages: MetadataRoute.Sitemap = doctorSlugs.map((slug) => ({
    url: `${baseUrl}/doctores/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Create sitemap entries for all blog listing pages
  const blogListingPages: MetadataRoute.Sitemap = doctorSlugs.map((slug) => ({
    url: `${baseUrl}/doctores/${slug}/blog`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  // Fetch all blog articles for all doctors
  const articlePages: MetadataRoute.Sitemap = []
  for (const slug of doctorSlugs) {
    try {
      const articles = await getArticlesByDoctorSlug(slug)
      articles.forEach((article) => {
        articlePages.push({
          url: `${baseUrl}/doctores/${slug}/blog/${article.slug}`,
          lastModified: article.publishedAt ? new Date(article.publishedAt) : new Date(),
          changeFrequency: 'monthly',
          priority: 0.7,
        })
      })
    } catch (error) {
      console.error(`Error fetching articles for ${slug}:`, error)
    }
  }

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${baseUrl}/doctores`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ]

  return [...staticPages, ...doctorPages, ...blogListingPages, ...articlePages]
}

// Revalidate sitemap every hour
export const revalidate = 3600
