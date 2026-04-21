import { MetadataRoute } from 'next'
import { getAllDoctorSlugs, getArticlesByDoctorSlug } from '@/lib/data'

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
  const allSlugs = await getAllDoctorSlugs()
  const doctorSlugs = allSlugs.filter(isValidDoctorSlug)

  // Create sitemap entries for all doctor pages
  const doctorPages: MetadataRoute.Sitemap = doctorSlugs.map((slug) => ({
    url: `${baseUrl}/doctores/${slug}`,
    lastModified: new Date(),
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
      blogListingPages.push({
        url: `${baseUrl}/doctores/${slug}/blog`,
        lastModified: new Date(),
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
