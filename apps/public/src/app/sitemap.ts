import { MetadataRoute } from 'next'
import { getAllDoctorSlugsWithDates, getArticlesByDoctorSlug } from '@/lib/data'

// Known test/junk slugs to exclude from the sitemap
const EXCLUDED_SLUGS = new Set([
  'dr-prueba',
  'fffffffff',
  'gerardo',
  'dr-quebradita',
])

/** Returns true if a slug looks like a real doctor profile (not test data). */
function isValidDoctorSlug(slug: string): boolean {
  if (EXCLUDED_SLUGS.has(slug)) return false
  // Filter out slugs that are too short or look like gibberish (no hyphens, all same char, etc.)
  if (slug.length < 4) return false
  if (/^(.)\1+$/.test(slug)) return false // e.g., "fffffffff"
  return true
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tusalud.pro'

  // Fetch all doctor slugs from API, filtering out test profiles
  const allDoctors = await getAllDoctorSlugsWithDates()
  const validDoctors = allDoctors.filter((d) => isValidDoctorSlug(d.slug))
  const doctorSlugs = validDoctors.map((d) => d.slug)

  // Create sitemap entries for all doctor pages (use real updatedAt)
  const doctorPages: MetadataRoute.Sitemap = validDoctors.map((d) => ({
    url: `${baseUrl}/doctores/${d.slug}`,
    lastModified: d.updatedAt ? new Date(d.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Fetch all blog articles for all doctors
  // Blog listing page is only included when the doctor has at least one article
  const blogListingPages: MetadataRoute.Sitemap = []
  const articlePages: MetadataRoute.Sitemap = []
  for (const slug of doctorSlugs) {
    try {
      const articles = await getArticlesByDoctorSlug(slug)
      if (articles.length === 0) continue

      // Filter out junk article slugs
      const validArticles = articles.filter(
        (a) => a.slug && a.slug.length >= 4 && !/^(.)\1+$/.test(a.slug)
      )
      if (validArticles.length === 0) continue

      // Doctor has articles — include their blog listing page
      const latestArticleDate = validArticles
        .filter((a) => a.publishedAt)
        .map((a) => new Date(a.publishedAt).getTime())
        .sort((a, b) => b - a)[0]

      blogListingPages.push({
        url: `${baseUrl}/doctores/${slug}/blog`,
        lastModified: latestArticleDate ? new Date(latestArticleDate) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      })

      validArticles.forEach((article) => {
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
