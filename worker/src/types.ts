// =============================================================================
// Environment & Bindings
// =============================================================================

export interface Env {
  // D1 Database
  DB: D1Database;

  // Secrets (set via wrangler secret put)
  GOOGLE_PLACES_API_KEY: string;
  YOUTUBE_API_KEY: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
  GOOGLE_SHEET_ID: string;

  // Environment variables (from wrangler.toml)
  DEFAULT_LAT: string;
  DEFAULT_LNG: string;
  DEFAULT_RADIUS_KM: string;
  PLACES_SEARCH_RADIUS_KM: string;
  YOUTUBE_CHANNELS: string;
}

// =============================================================================
// Database Row Types
// =============================================================================

export interface UserSettings {
  id: number;
  base_lat: number;
  base_lng: number;
  last_geo_source: 'ip' | 'browser' | 'manual';
  updated_at: string;
}

export interface Place {
  id: number;
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  types: string | null;  // JSON array string
  rating: number | null;
  photo_reference: string | null;
  photo_url: string | null;
  last_seen_at: string;
}

export interface WeatherSlot {
  id: number;
  date_time: string;
  lat: number;
  lng: number;
  clouds: number | null;
  precip: number | null;
  visibility: number | null;
  temp: number | null;
  photoday_score: number | null;
}

export interface SunWindow {
  id: number;
  date: string;
  lat: number;
  lng: number;
  sunrise: string | null;
  sunset: string | null;
  golden_morning_start: string | null;
  golden_morning_end: string | null;
  golden_evening_start: string | null;
  golden_evening_end: string | null;
  blue_morning_start: string | null;
  blue_morning_end: string | null;
  blue_evening_start: string | null;
  blue_evening_end: string | null;
}

export interface Task {
  task_id: string;
  title: string;
  location_raw: string | null;
  lat: number | null;
  lng: number | null;
  radius_km: number | null;
  condition: TaskCondition | null;
  time_window: TaskTimeWindow | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface TaskWindow {
  id: number;
  task_id: string;
  window_start: string;
  window_end: string;
  score: number;
  reason: string | null;
  created_at: string;
}

export interface YouTubeVideo {
  id: number;
  channel_id: string;
  video_id: string;
  title: string;
  description: string | null;
  published_at: string | null;
  thumbnail_url: string | null;
  url: string | null;
  topic_tags: string | null;
  last_seen_at: string;
}

export interface MyPlace {
  id?: number;
  sheet_row?: number;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  pinned_from?: string | null;
  active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DiscoveredPlace {
  id?: number;
  near_place_id?: number;
  google_place_id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  photo_url: string | null;
  types: string | null;
  distance_km: number | null;
  is_pinned: number;
  last_seen_at?: string;
}

export interface PlaceForecast {
  id?: number;
  place_id: number;
  date: string;
  sunrise: string | null;
  sunset: string | null;
  golden_morning_start: string | null;
  golden_morning_end: string | null;
  golden_evening_start: string | null;
  golden_evening_end: string | null;
  blue_morning_start: string | null;
  blue_morning_end: string | null;
  blue_evening_start: string | null;
  blue_evening_end: string | null;
  morning_clouds: number | null;
  evening_clouds: number | null;
  sky_open_morning: number;
  sky_open_evening: number;
  updated_at?: string;
}

// =============================================================================
// Task Conditions & Time Windows
// =============================================================================

export type TaskCondition =
  | 'golden-hour-morning'
  | 'golden-hour-evening'
  | 'blue-hour-morning'
  | 'blue-hour-evening'
  | 'golden-hour-any'    // Either morning or evening
  | 'fog'
  | 'overcast'
  | 'clear-noon'
  | 'clear-any'
  | 'cloudy'
  | 'any';

export type TaskTimeWindow =
  | 'any_day'
  | 'morning_only'
  | 'evening_only'
  | 'weekend_only'
  | 'weekday_only';

// =============================================================================
// API Response Types
// =============================================================================

export interface DashboardResponse {
  location: {
    lat: number;
    lng: number;
    source: string;
  };
  sunWindows: {
    today: SunWindow | null;
    tomorrow: SunWindow | null;
  };
  weather: {
    current: WeatherSlot | null;
    hourly: WeatherSlot[];
    photoDayScore: number;
  };
  places: PlaceWithDistance[];
  taskWindows: TaskWindowWithTask[];
  videos: YouTubeVideo[];
}

export interface PlaceWithDistance extends Place {
  distance_km: number;
}

export interface TaskWindowWithTask extends TaskWindow {
  task_title: string;
  task_notes: string | null;
}

export interface SetLocationRequest {
  lat: number;
  lng: number;
  source: 'browser' | 'manual';
}

// =============================================================================
// External API Types
// =============================================================================

// Google Places API (New) response types
export interface GooglePlacesResponse {
  places: GooglePlace[];
}

export interface GooglePlace {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  types: string[];
  rating?: number;
  photos?: { name: string }[];
}

// Open-Meteo Weather API response
export interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    cloud_cover: number[];
    precipitation: number[];
    visibility: number[];
  };
  daily: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

// YouTube Data API response
export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
}

export interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: {
    channelId: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}
