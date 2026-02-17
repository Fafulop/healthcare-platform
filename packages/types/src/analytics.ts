// Analytics Types — shared between API, Doctor App, and Admin App

export interface EventCounts {
  profile_view: number;
  contact_click: number;
  booking_complete: number;
  appointment_click: number;
  blog_view: number;
  map_click: number;
  [key: string]: number;
}

export interface DailyDataPoint {
  date: string; // YYYY-MM-DD
  pageViews: number;
  sessions: number;
  users: number;
}

export interface TrafficSource {
  channel: string;
  sessions: number;
  users: number;
}

export interface SearchQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PagePerformance {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface AnalyticsOverview {
  totalUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  totalUsersChange: number;
  sessionsChange: number;
  pageViewsChange: number;
  avgSessionDurationChange: number;
}

export interface DoctorRankingEntry {
  doctorSlug: string;
  eventCount: number;
}

export interface DoctorAnalytics {
  events: EventCounts;
  dailyPageViews: DailyDataPoint[];
  trafficSources: TrafficSource[];
  searchConsole: {
    queries: SearchQuery[];
    pages: PagePerformance[];
  };
}

export interface PlatformAnalytics {
  overview: AnalyticsOverview;
  dailyPageViews: DailyDataPoint[];
  trafficSources: TrafficSource[];
  topDoctors: DoctorRankingEntry[];
  searchConsole: {
    queries: SearchQuery[];
    pages: PagePerformance[];
  };
}

export type DateRange = '7d' | '28d' | '90d';
