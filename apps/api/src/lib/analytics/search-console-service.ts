import { google } from 'googleapis';
import type { DateRange, SearchQuery, PagePerformance } from '@healthcare/types';
import { getGoogleAuth, getSearchConsoleSiteUrl } from './google-auth';

function getSearchConsole() {
  const auth = getGoogleAuth();
  return google.searchconsole({ version: 'v1', auth });
}

function dateRangeToDays(range: DateRange): number {
  const map = { '7d': 7, '28d': 28, '90d': 90 };
  return map[range];
}

function formatDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export async function getSearchQueries(
  slug: string | null,
  range: DateRange
): Promise<SearchQuery[]> {
  const sc = getSearchConsole();
  const days = dateRangeToDays(range);

  const requestBody: Record<string, unknown> = {
    startDate: formatDate(days),
    endDate: formatDate(0),
    dimensions: ['query'],
    rowLimit: 25,
  };

  if (slug) {
    requestBody.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'page',
            operator: 'contains',
            expression: `/doctores/${slug}`,
          },
        ],
      },
    ];
  }

  const res = await sc.searchanalytics.query({
    siteUrl: getSearchConsoleSiteUrl(),
    requestBody,
  });

  return (res.data.rows || []).map((row) => ({
    query: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100, // Convert to percentage with 2 decimals
    position: Math.round((row.position || 0) * 10) / 10,
  }));
}

export async function getPagePerformance(
  slug: string | null,
  range: DateRange
): Promise<PagePerformance[]> {
  const sc = getSearchConsole();
  const days = dateRangeToDays(range);

  const requestBody: Record<string, unknown> = {
    startDate: formatDate(days),
    endDate: formatDate(0),
    dimensions: ['page'],
    rowLimit: 25,
  };

  if (slug) {
    requestBody.dimensionFilterGroups = [
      {
        filters: [
          {
            dimension: 'page',
            operator: 'contains',
            expression: `/doctores/${slug}`,
          },
        ],
      },
    ];
  }

  const res = await sc.searchanalytics.query({
    siteUrl: getSearchConsoleSiteUrl(),
    requestBody,
  });

  return (res.data.rows || []).map((row) => ({
    page: row.keys?.[0] || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: Math.round((row.ctr || 0) * 10000) / 100,
    position: Math.round((row.position || 0) * 10) / 10,
  }));
}
