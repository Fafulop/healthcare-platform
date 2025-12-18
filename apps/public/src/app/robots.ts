import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',           // Don't crawl API endpoints
        '/_next/',         // Don't crawl Next.js internals
        '/admin/',         // Don't crawl admin (if we add it later)
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
