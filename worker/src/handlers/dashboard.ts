import { Env, DashboardResponse, UserSettings, SunWindow, WeatherSlot, Place, TaskWindow, YouTubeVideo, PlaceWithDistance, TaskWindowWithTask } from '../types';
import { haversineDistance } from '../lib/geo';

/**
 * GET /api/dashboard
 * 
 * Returns all dashboard data in a single response:
 * - Current location (from settings or CF geolocation)
 * - Sun windows for today/tomorrow
 * - Weather slots with photo day score
 * - Nearby places
 * - Recommended task windows
 * - Latest YouTube videos
 */
export async function handleDashboard(
  env: Env,
  cfLat?: number,
  cfLng?: number
): Promise<DashboardResponse> {
  const db = env.DB;
  
  // 1. Get current location from user_settings (or use CF/defaults)
  const settings = await db
    .prepare('SELECT * FROM user_settings WHERE id = 1')
    .first<UserSettings>();
  
  let lat: number;
  let lng: number;
  let source: string;
  
  if (settings && settings.base_lat && settings.base_lng) {
    lat = settings.base_lat;
    lng = settings.base_lng;
    source = settings.last_geo_source;
  } else if (cfLat && cfLng) {
    // Use Cloudflare's IP-based geolocation
    lat = cfLat;
    lng = cfLng;
    source = 'ip';
    
    // Update settings with CF location
    await db
      .prepare(`
        INSERT OR REPLACE INTO user_settings (id, base_lat, base_lng, last_geo_source, updated_at)
        VALUES (1, ?, ?, 'ip', datetime('now'))
      `)
      .bind(lat, lng)
      .run();
  } else {
    // Fall back to defaults from env
    lat = parseFloat(env.DEFAULT_LAT);
    lng = parseFloat(env.DEFAULT_LNG);
    source = 'default';
  }
  
  // 2. Get sun windows for today and tomorrow
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  const sunWindowToday = await db
    .prepare('SELECT * FROM sun_windows WHERE date = ? ORDER BY id DESC LIMIT 1')
    .bind(today)
    .first<SunWindow>();
    
  const sunWindowTomorrow = await db
    .prepare('SELECT * FROM sun_windows WHERE date = ? ORDER BY id DESC LIMIT 1')
    .bind(tomorrow)
    .first<SunWindow>();
  
  // 3. Get weather slots for next 48 hours
  const now = new Date().toISOString();
  const in48hours = new Date(Date.now() + 48 * 3600000).toISOString();
  
  const weatherSlots = await db
    .prepare(`
      SELECT * FROM weather_slots 
      WHERE date_time >= ? AND date_time <= ?
      ORDER BY date_time ASC
      LIMIT 48
    `)
    .bind(now, in48hours)
    .all<WeatherSlot>();
  
  // Find current weather (closest to now)
  const currentWeather = weatherSlots.results?.[0] || null;
  
  // Calculate average photo day score
  const photoDayScore = weatherSlots.results?.length
    ? Math.round(
        weatherSlots.results.reduce((sum, w) => sum + (w.photoday_score || 50), 0) /
          weatherSlots.results.length
      )
    : 50;
  
  // 4. Get places with distance from user location
  const places = await db
    .prepare('SELECT * FROM places ORDER BY last_seen_at DESC LIMIT 20')
    .all<Place>();
  
  const placesWithDistance: PlaceWithDistance[] = (places.results || []).map(place => ({
    ...place,
    distance_km: haversineDistance(lat, lng, place.lat, place.lng),
  })).sort((a, b) => a.distance_km - b.distance_km);
  
  // 5. Get upcoming task windows with task details
  const taskWindows = await db
    .prepare(`
      SELECT tw.*, t.title as task_title, t.notes as task_notes
      FROM task_windows tw
      JOIN tasks t ON tw.task_id = t.task_id
      WHERE tw.window_start >= ?
      ORDER BY tw.window_start ASC, tw.score DESC
      LIMIT 10
    `)
    .bind(now)
    .all<TaskWindowWithTask>();
  
  // 6. Get latest YouTube videos
  const videos = await db
    .prepare(`
      SELECT * FROM youtube_videos 
      ORDER BY published_at DESC 
      LIMIT 12
    `)
    .all<YouTubeVideo>();
  
  return {
    location: { lat, lng, source },
    sunWindows: {
      today: sunWindowToday || null,
      tomorrow: sunWindowTomorrow || null,
    },
    weather: {
      current: currentWeather,
      hourly: weatherSlots.results || [],
      photoDayScore,
    },
    places: placesWithDistance,
    taskWindows: taskWindows.results || [],
    videos: videos.results || [],
  };
}
