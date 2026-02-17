import type { DateRange, DoctorAnalytics, PlatformAnalytics, DoctorRankingEntry } from '@healthcare/types';
import { buildCacheKey, getCached, setCache, TTL_HOURS } from './cache';
import { getDoctorEvents, getDailyPageViews, getTrafficSources, getPlatformOverview, getDoctorsRanking } from './ga4-service';
import { getSearchQueries, getPagePerformance } from './search-console-service';

export async function getDoctorAnalytics(
  slug: string,
  range: DateRange
): Promise<DoctorAnalytics> {
  const cacheKey = buildCacheKey('doctor', slug, 'all', range);
  const cached = await getCached<DoctorAnalytics>(cacheKey);
  if (cached) return cached;

  const [events, dailyPageViews, trafficSources, queries, pages] = await Promise.all([
    getDoctorEvents(slug, range),
    getDailyPageViews(slug, range),
    getTrafficSources(slug, range),
    getSearchQueries(slug, range),
    getPagePerformance(slug, range),
  ]);

  const result: DoctorAnalytics = {
    events,
    dailyPageViews,
    trafficSources,
    searchConsole: { queries, pages },
  };

  await setCache(cacheKey, 'ga4', slug, range, result, TTL_HOURS.ga4);
  return result;
}

export async function getPlatformAnalytics(
  range: DateRange
): Promise<PlatformAnalytics> {
  const cacheKey = buildCacheKey('platform', null, 'all', range);
  const cached = await getCached<PlatformAnalytics>(cacheKey);
  if (cached) return cached;

  const [overview, dailyPageViews, trafficSources, topDoctors, queries, pages] = await Promise.all([
    getPlatformOverview(range),
    getDailyPageViews(null, range),
    getTrafficSources(null, range),
    getDoctorsRanking(range, 'profile_view', 20),
    getSearchQueries(null, range),
    getPagePerformance(null, range),
  ]);

  const result: PlatformAnalytics = {
    overview,
    dailyPageViews,
    trafficSources,
    topDoctors,
    searchConsole: { queries, pages },
  };

  await setCache(cacheKey, 'ga4', null, range, result, TTL_HOURS.platform);
  return result;
}

export async function getDoctorsRankingCached(
  range: DateRange,
  metric: string,
  limit: number
): Promise<DoctorRankingEntry[]> {
  const cacheKey = buildCacheKey('ranking', null, metric, range);
  const cached = await getCached<DoctorRankingEntry[]>(cacheKey);
  if (cached) return cached;

  const result = await getDoctorsRanking(range, metric, limit);
  await setCache(cacheKey, 'ga4', null, range, result, TTL_HOURS.platform);
  return result;
}
