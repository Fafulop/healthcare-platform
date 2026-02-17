import { prisma } from '@healthcare/database';

export const TTL_HOURS = {
  ga4: 4,
  search_console: 6,
  platform: 2,
} as const;

export function buildCacheKey(
  type: string,
  slug: string | null,
  metric: string,
  range: string
): string {
  return [type, slug || '_platform', metric, range].join(':');
}

export async function getCached<T>(key: string): Promise<T | null> {
  const entry = await prisma.analyticsCache.findUnique({
    where: { cacheKey: key },
  });

  if (!entry) return null;

  if (new Date() > entry.expiresAt) {
    // Expired — delete and return null
    await prisma.analyticsCache.delete({ where: { cacheKey: key } }).catch(() => {});
    return null;
  }

  // Increment hit count
  await prisma.analyticsCache
    .update({ where: { cacheKey: key }, data: { hitCount: { increment: 1 } } })
    .catch(() => {});

  return JSON.parse(entry.response) as T;
}

export async function setCache(
  key: string,
  type: string,
  slug: string | null,
  range: string,
  data: unknown,
  ttlHours: number
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await prisma.analyticsCache.upsert({
    where: { cacheKey: key },
    update: {
      response: JSON.stringify(data),
      expiresAt,
      hitCount: 0,
    },
    create: {
      cacheKey: key,
      cacheType: type,
      doctorSlug: slug,
      dateRange: range,
      response: JSON.stringify(data),
      expiresAt,
    },
  });
}
