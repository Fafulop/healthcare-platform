-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create analytics_cache table
CREATE TABLE analytics.analytics_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  cache_type VARCHAR(50) NOT NULL,
  doctor_slug VARCHAR(100),
  date_range VARCHAR(20) NOT NULL,
  response TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_analytics_cache_type_slug_range ON analytics.analytics_cache (cache_type, doctor_slug, date_range);
CREATE INDEX idx_analytics_cache_expires ON analytics.analytics_cache (expires_at);
