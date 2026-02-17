import { google } from 'googleapis';
import type { DateRange, DailyDataPoint, EventCounts, TrafficSource, AnalyticsOverview, DoctorRankingEntry } from '@healthcare/types';
import { getGoogleAuth, getGA4PropertyId } from './google-auth';

function getAnalyticsData() {
  const auth = getGoogleAuth();
  return google.analyticsdata({ version: 'v1beta', auth });
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

const TRACKED_EVENTS = [
  'profile_view',
  'contact_click',
  'booking_complete',
  'appointment_click',
  'blog_view',
  'map_click',
];

export async function getDoctorEvents(
  slug: string,
  range: DateRange
): Promise<EventCounts> {
  const analyticsData = getAnalyticsData();
  const days = dateRangeToDays(range);

  const res = await analyticsData.properties.runReport({
    property: `properties/${getGA4PropertyId()}`,
    requestBody: {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [
        { name: 'customEvent:doctor_slug' },
        { name: 'eventName' },
      ],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: 'customEvent:doctor_slug',
                stringFilter: { matchType: 'EXACT', value: slug },
              },
            },
            {
              filter: {
                fieldName: 'eventName',
                inListFilter: { values: TRACKED_EVENTS },
              },
            },
          ],
        },
      },
    },
  });

  const events: EventCounts = {
    profile_view: 0,
    contact_click: 0,
    booking_complete: 0,
    appointment_click: 0,
    blog_view: 0,
    map_click: 0,
  };

  for (const row of res.data.rows || []) {
    const eventName = row.dimensionValues?.[1]?.value || '';
    const count = parseInt(row.metricValues?.[0]?.value || '0', 10);
    if (eventName in events) {
      events[eventName] = count;
    }
  }

  return events;
}

export async function getDailyPageViews(
  slug: string | null,
  range: DateRange
): Promise<DailyDataPoint[]> {
  const analyticsData = getAnalyticsData();
  const days = dateRangeToDays(range);

  const requestBody: Record<string, unknown> = {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ dimension: { dimensionName: 'date' } }],
  };

  if (slug) {
    requestBody.dimensionFilter = {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: `/doctores/${slug}` },
      },
    };
  }

  const res = await analyticsData.properties.runReport({
    property: `properties/${getGA4PropertyId()}`,
    requestBody,
  });

  return (res.data.rows || []).map((row) => {
    const dateStr = row.dimensionValues?.[0]?.value || '';
    return {
      date: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`,
      pageViews: parseInt(row.metricValues?.[0]?.value || '0', 10),
      sessions: parseInt(row.metricValues?.[1]?.value || '0', 10),
      users: parseInt(row.metricValues?.[2]?.value || '0', 10),
    };
  });
}

export async function getTrafficSources(
  slug: string | null,
  range: DateRange
): Promise<TrafficSource[]> {
  const analyticsData = getAnalyticsData();
  const days = dateRangeToDays(range);

  const requestBody: Record<string, unknown> = {
    dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  };

  if (slug) {
    requestBody.dimensionFilter = {
      filter: {
        fieldName: 'pagePath',
        stringFilter: { matchType: 'BEGINS_WITH', value: `/doctores/${slug}` },
      },
    };
  }

  const res = await analyticsData.properties.runReport({
    property: `properties/${getGA4PropertyId()}`,
    requestBody,
  });

  return (res.data.rows || []).map((row) => ({
    channel: row.dimensionValues?.[0]?.value || 'Unknown',
    sessions: parseInt(row.metricValues?.[0]?.value || '0', 10),
    users: parseInt(row.metricValues?.[1]?.value || '0', 10),
  }));
}

export async function getPlatformOverview(range: DateRange): Promise<AnalyticsOverview> {
  const analyticsData = getAnalyticsData();
  const days = dateRangeToDays(range);

  const res = await analyticsData.properties.runReport({
    property: `properties/${getGA4PropertyId()}`,
    requestBody: {
      dateRanges: [
        { startDate: `${days}daysAgo`, endDate: 'today', name: 'current' },
        { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: 'previous' },
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
    },
  });

  const rows = res.data.rows || [];
  // GA4 returns one row per date range when no dimensions are used
  const current = rows[0]?.metricValues || [];
  const previous = rows[1]?.metricValues || [];

  function val(arr: typeof current, i: number): number {
    return parseFloat(arr[i]?.value || '0');
  }

  function pctChange(curr: number, prev: number): number {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const totalUsers = val(current, 0);
  const sessions = val(current, 1);
  const pageViews = val(current, 2);
  const avgDuration = val(current, 3);

  return {
    totalUsers,
    sessions,
    pageViews,
    avgSessionDuration: Math.round(avgDuration),
    totalUsersChange: pctChange(totalUsers, val(previous, 0)),
    sessionsChange: pctChange(sessions, val(previous, 1)),
    pageViewsChange: pctChange(pageViews, val(previous, 2)),
    avgSessionDurationChange: pctChange(avgDuration, val(previous, 3)),
  };
}

export async function getDoctorsRanking(
  range: DateRange,
  metric: string = 'profile_view',
  limit: number = 20
): Promise<DoctorRankingEntry[]> {
  const analyticsData = getAnalyticsData();
  const days = dateRangeToDays(range);

  const res = await analyticsData.properties.runReport({
    property: `properties/${getGA4PropertyId()}`,
    requestBody: {
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'customEvent:doctor_slug' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: metric },
        },
      },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: String(limit),
    },
  });

  return (res.data.rows || []).map((row) => ({
    doctorSlug: row.dimensionValues?.[0]?.value || '',
    eventCount: parseInt(row.metricValues?.[0]?.value || '0', 10),
  }));
}
