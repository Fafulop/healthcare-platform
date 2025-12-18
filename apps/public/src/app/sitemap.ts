import { MetadataRoute } from 'next'
import { getAllDoctorSlugs } from '@/lib/data'

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

  return [...staticPages, ...doctorPages]
}

// Revalidate sitemap every hour
export const revalidate = 3600
