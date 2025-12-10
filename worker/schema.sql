-- Photo Day Dashboard - D1 Schema
-- Run migrations: wrangler d1 execute photo-day-db --file=./schema.sql

-- =============================================================================
-- 1. User Settings (single row for now, no multi-user auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  base_lat REAL NOT NULL DEFAULT 54.6872,      -- Default: Vilnius
  base_lng REAL NOT NULL DEFAULT 25.2797,
  last_geo_source TEXT DEFAULT 'ip',           -- 'ip', 'browser', 'manual'
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Initialize with default row
INSERT OR IGNORE INTO user_settings (id) VALUES (1);

-- =============================================================================
-- 2. Places (from Google Places API)
-- =============================================================================
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  types TEXT,                                  -- JSON array string, e.g. '["park","natural_feature"]'
  rating REAL,
  photo_reference TEXT,                        -- Google photo reference for fetching
  photo_url TEXT,                              -- Resolved photo URL (cached)
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_places_location ON places (lat, lng);

-- =============================================================================
-- 3. Weather Slots (hourly forecasts)
-- =============================================================================
CREATE TABLE IF NOT EXISTS weather_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date_time TEXT NOT NULL,                     -- ISO 8601 UTC, e.g. '2024-06-15T14:00:00Z'
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  clouds INTEGER,                              -- Cloud cover percentage 0-100
  precip REAL,                                 -- Precipitation mm/h
  visibility REAL,                             -- Visibility in km
  temp REAL,                                   -- Temperature in Celsius
  photoday_score INTEGER,                      -- Combined rating 0-100 (calculated)
  UNIQUE(date_time, lat, lng)
);

CREATE INDEX IF NOT EXISTS idx_weather_datetime ON weather_slots (date_time);

-- =============================================================================
-- 4. Sun Windows (golden hour, blue hour times per day)
-- =============================================================================
CREATE TABLE IF NOT EXISTS sun_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                          -- 'YYYY-MM-DD'
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  sunrise TEXT,                                -- ISO time
  sunset TEXT,
  golden_morning_start TEXT,
  golden_morning_end TEXT,
  golden_evening_start TEXT,
  golden_evening_end TEXT,
  blue_morning_start TEXT,
  blue_morning_end TEXT,
  blue_evening_start TEXT,
  blue_evening_end TEXT,
  UNIQUE(date, lat, lng)
);

CREATE INDEX IF NOT EXISTS idx_sun_date ON sun_windows (date);

-- =============================================================================
-- 5. Tasks (from Google Sheets)
-- =============================================================================
CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,                    -- Unique ID from sheet
  title TEXT NOT NULL,
  location_raw TEXT,                           -- Original location string from sheet
  lat REAL,                                    -- Parsed/geocoded latitude
  lng REAL,
  radius_km REAL DEFAULT 10,
  condition TEXT,                              -- e.g. 'golden-hour-evening', 'fog', 'overcast'
  time_window TEXT DEFAULT 'any_day',          -- 'any_day', 'morning_only', 'evening_only', 'weekend_only'
  notes TEXT,
  active INTEGER DEFAULT 1,                    -- 1 = active, 0 = inactive
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- =============================================================================
-- 6. Task Windows (recommended shooting windows for tasks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS task_windows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  window_start TEXT NOT NULL,                  -- ISO datetime
  window_end TEXT NOT NULL,
  score INTEGER DEFAULT 50,                    -- 0-100, higher = better conditions
  reason TEXT,                                 -- Human-readable explanation
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(task_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_windows_task ON task_windows (task_id);
CREATE INDEX IF NOT EXISTS idx_task_windows_start ON task_windows (window_start);

-- =============================================================================
-- 7. YouTube Videos (from photography channels)
-- =============================================================================
CREATE TABLE IF NOT EXISTS youtube_videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL,
  video_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  published_at TEXT,
  thumbnail_url TEXT,
  url TEXT,
  topic_tags TEXT,                             -- JSON array of tags
  last_seen_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_youtube_channel ON youtube_videos (channel_id);
CREATE INDEX IF NOT EXISTS idx_youtube_published ON youtube_videos (published_at DESC);

-- =============================================================================
-- 8. My Places (user's photo locations from Google Sheet)
-- =============================================================================
CREATE TABLE IF NOT EXISTS my_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sheet_row INTEGER,                           -- Row number in Google Sheet (for updates)
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  notes TEXT,
  pinned_from TEXT,                            -- NULL if from sheet, or Google Places ID if pinned
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(lat, lng)                             -- Prevent duplicate locations
);

CREATE INDEX IF NOT EXISTS idx_my_places_location ON my_places (lat, lng);

-- =============================================================================
-- 9. Discovered Places (from Google Places API, can be pinned)
-- =============================================================================
CREATE TABLE IF NOT EXISTS discovered_places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  near_place_id INTEGER,                       -- Which of my_places this is near
  google_place_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  rating REAL,
  photo_url TEXT,
  types TEXT,                                  -- JSON array string
  distance_km REAL,
  is_pinned INTEGER DEFAULT 0,                 -- 1 if user pinned this
  last_seen_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (near_place_id) REFERENCES my_places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_discovered_near ON discovered_places (near_place_id);
CREATE INDEX IF NOT EXISTS idx_discovered_pinned ON discovered_places (is_pinned);

-- =============================================================================
-- 10. Place Forecasts (3-day weather for my_places)
-- =============================================================================
CREATE TABLE IF NOT EXISTS place_forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id INTEGER NOT NULL,
  date TEXT NOT NULL,                          -- 'YYYY-MM-DD'
  sunrise TEXT,
  sunset TEXT,
  golden_morning_start TEXT,
  golden_morning_end TEXT,
  golden_evening_start TEXT,
  golden_evening_end TEXT,
  blue_morning_start TEXT,
  blue_morning_end TEXT,
  blue_evening_start TEXT,
  blue_evening_end TEXT,
  morning_clouds INTEGER,                      -- Cloud cover during golden morning
  evening_clouds INTEGER,                      -- Cloud cover during golden evening
  sky_open_morning INTEGER DEFAULT 0,          -- 1 if clouds < 30%
  sky_open_evening INTEGER DEFAULT 0,          -- 1 if clouds < 30%
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(place_id, date),
  FOREIGN KEY (place_id) REFERENCES my_places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_place_forecasts_date ON place_forecasts (date);
