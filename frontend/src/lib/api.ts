// API client for communicating with the Cloudflare Worker backend

// Prefer explicit worker URL; fall back to local dev worker.
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787';
console.log("API Configured with WORKER_URL:", WORKER_URL);

// =============================================================================
// Types (mirrored from worker)
// =============================================================================

export interface DashboardData {
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

export interface PlaceWithDistance {
  id: number;
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  types: string | null;
  rating: number | null;
  photo_reference: string | null;
  photo_url: string | null;
  last_seen_at: string;
  distance_km: number;
}

export interface TaskWindowWithTask {
  id: number;
  task_id: string;
  window_start: string;
  window_end: string;
  score: number;
  reason: string | null;
  created_at: string;
  task_title: string;
  task_notes: string | null;
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

// Helper for fetch with timeout
async function fetchWithTimeout(resource: string, options: RequestInit = {}): Promise<Response> {
  const { timeout = 8000 } = options as any;
  console.log(`[API] Fetching: ${resource}`); // Log the URL
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// MOCK DATA FOR FALLBACK
const MOCK_DASHBOARD_DATA: DashboardData = {
  location: { lat: 54.6872, lng: 25.2797, source: 'mock' },
  sunWindows: {
    today: {
      id: 1, date: '2025-12-08', lat: 54.6872, lng: 25.2797,
      sunrise: '2025-12-08T08:30:00', sunset: '2025-12-08T16:00:00',
      golden_morning_start: '2025-12-08T08:00:00', golden_morning_end: '2025-12-08T09:00:00',
      golden_evening_start: '2025-12-08T15:00:00', golden_evening_end: '2025-12-08T16:30:00',
      blue_morning_start: null, blue_morning_end: null, blue_evening_start: null, blue_evening_end: null
    },
    tomorrow: null
  },
  weather: {
    current: { id: 0, date_time: new Date().toISOString(), lat: 54.68, lng: 25.27, clouds: 10, precip: 0, visibility: 10, temp: 15, photoday_score: 90 },
    hourly: Array.from({ length: 24 }, (_, i) => ({
      id: i,
      date_time: new Date(Date.now() + i * 3600000).toISOString(),
      lat: 54.68,
      lng: 25.27,
      clouds: i < 5 ? 10 : i < 12 ? 80 : 0,
      precip: 0, visibility: 10,
      temp: 20 - (i * 0.5),
      photoday_score: i > 15 ? 95 : 50
    })),
    photoDayScore: 85
  },
  places: [],
  taskWindows: [],
  videos: []
};

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch dashboard data from the worker
 */
export async function fetchDashboard(lat?: number, lng?: number): Promise<DashboardData> {
  // Use relative path if WORKER_URL is empty, otherwise absolute
  const baseUrl = WORKER_URL || '';
  const url = new URL(`${baseUrl}/api/dashboard`, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  if (lat !== undefined && lng !== undefined) {
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lng', lng.toString());
  }

  try {
    const response = await fetchWithTimeout(url.toString(), {
      cache: 'no-store', // Always fetch fresh data
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.warn("API Fetch Failed - Returning MOCK DATA for visualization");
    await new Promise(r => setTimeout(r, 500)); // Simulate delay
    return MOCK_DASHBOARD_DATA;
  }
}

/**
 * Update user location
 */
export async function setLocation(
  lat: number,
  lng: number,
  source: 'browser' | 'manual'
): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/set-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lat, lng, source }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format time for display (e.g., "6:45 AM")
 */
export function formatTime(isoString: string | null): string {
  if (!isoString) return '--:--';

  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format date for display (e.g., "Mon, Dec 15")
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time range (e.g., "6:45 - 7:30 AM")
 */
export function formatTimeRange(start: string | null, end: string | null): string {
  if (!start || !end) return '--';
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Format distance (e.g., "2.3 km")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Get score class for styling
 */
export function getScoreClass(score: number): string {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-fair';
  return 'score-poor';
}

/**
 * Get relative time (e.g., "in 2 hours", "tomorrow")
 */
export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 0) return 'past';
  if (diffHours < 1) return 'soon';
  if (diffHours < 24) return `in ${diffHours}h`;
  if (diffDays === 1) return 'tomorrow';
  return `in ${diffDays} days`;
}

// =============================================================================
// My Places Types (new)
// =============================================================================

export interface MyPlace {
  id: number;
  sheet_row?: number;
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  pinned_from?: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface PlaceForecast {
  id: number;
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
}

export interface DiscoveredPlace {
  id: number;
  near_place_id: number;
  google_place_id: string;
  name: string;
  lat: number;
  lng: number;
  rating: number | null;
  photo_url: string | null;
  types: string | null;
  distance_km: number | null;
  is_pinned: number;
}

export interface MyPlaceWithData {
  place: MyPlace;
  forecasts: PlaceForecast[];
  nearby: DiscoveredPlace[];
}

// =============================================================================
// My Places API Functions
// =============================================================================

/**
 * Fetch all my places with their forecasts and nearby discoveries
 */
export async function fetchMyPlaces(): Promise<MyPlaceWithData[]> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/my-places`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Sync places from Google Sheet
 */
export async function syncFromSheet(): Promise<{ synced: number; deleted?: number }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/my-places/sync`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a place (sheet or pinned)
 */
export async function deleteMyPlace(placeId: number): Promise<{ success: boolean }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/my-places/${placeId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Check weather now for a specific place
 */
export async function checkNow(placeId: number): Promise<{ forecasts: PlaceForecast[] }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/my-places/${placeId}/check-now`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get nearby discovered places
 */
export async function getNearby(placeId: number): Promise<{ nearby: DiscoveredPlace[] }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/my-places/${placeId}/nearby`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Pin a discovered place (adds to Google Sheet)
 */
export async function pinPlace(discoveredId: number): Promise<{ success: boolean; place?: MyPlace }> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/discovered/${discoveredId}/pin`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch YouTube videos
 */
export async function fetchVideos(): Promise<YouTubeVideo[]> {
  const response = await fetchWithTimeout(`${WORKER_URL}/api/videos`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();
  return data.videos || [];
}
