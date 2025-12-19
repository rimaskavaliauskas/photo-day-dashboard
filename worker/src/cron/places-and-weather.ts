import { Env, UserSettings, GooglePlacesResponse, OpenMeteoResponse, WeatherAPIResponse } from '../types';
import { calculateSunWindows, toISOString, toDateString } from '../lib/sun';
import { calculatePhotoDayScore } from '../lib/weather-score';

/**
 * Cron: places-and-weather
 * 
 * Runs every hour to:
 * 1. Fetch interesting photo locations from Google Places API
 * 2. Fetch weather forecast from Open-Meteo
 * 3. Calculate and store sun windows (golden/blue hour)
 */
export async function runPlacesAndWeatherSync(env: Env): Promise<void> {
  // Get base location from settings
  const settings = await env.DB
    .prepare('SELECT * FROM user_settings WHERE id = 1')
    .first<UserSettings>();
  
  const lat = settings?.base_lat || parseFloat(env.DEFAULT_LAT);
  const lng = settings?.base_lng || parseFloat(env.DEFAULT_LNG);
  const radiusKm = parseFloat(env.DEFAULT_RADIUS_KM) || 30;
  
  console.log(`Syncing places and weather for: ${lat}, ${lng} (radius: ${radiusKm}km)`);
  
  // Run syncs in parallel
  await Promise.all([
    syncPlaces(env, lat, lng, radiusKm),
    syncWeatherAndSun(env, lat, lng),
  ]);
}

/**
 * Sync places from Google Places API (New)
 */
async function syncPlaces(env: Env, lat: number, lng: number, radiusKm: number): Promise<void> {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_PLACES_API_KEY not set, skipping places sync');
    return;
  }
  
  // Place types interesting for photography
  // Use only supported primary types for Places API (New)
  const includedTypes = [
    'tourist_attraction',
    'park',
    'art_gallery',
    'museum',
    'campground',
  ];
  
  // Google Places API (New) - Nearby Search
  // https://developers.google.com/maps/documentation/places/web-service/nearby-search
  const response = await fetch(
    'https://places.googleapis.com/v1/places:searchNearby',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.types,places.rating,places.photos',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusKm * 1000, // Convert to meters
          },
        },
        includedTypes,
        maxResultCount: 20,
      }),
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Google Places API error:', error);
    return;
  }
  
  const data = (await response.json()) as GooglePlacesResponse;
  
  if (!data.places || data.places.length === 0) {
    console.log('No places found');
    return;
  }
  
  // Upsert places into database
  for (const place of data.places) {
    const photoReference = place.photos?.[0]?.name || null;
    
    // If we have a photo reference, construct the photo URL
    let photoUrl: string | null = null;
    if (photoReference) {
      // Photo URL via Places API (New)
      // Format: https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=400&key=API_KEY
      photoUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=800&key=${apiKey}`;
    }
    
    await env.DB
      .prepare(`
        INSERT INTO places (place_id, name, lat, lng, types, rating, photo_reference, photo_url, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(place_id) DO UPDATE SET
          name = excluded.name,
          types = excluded.types,
          rating = excluded.rating,
          photo_reference = excluded.photo_reference,
          photo_url = excluded.photo_url,
          last_seen_at = datetime('now')
      `)
      .bind(
        place.id,
        place.displayName.text,
        place.location.latitude,
        place.location.longitude,
        JSON.stringify(place.types),
        place.rating || null,
        photoReference,
        photoUrl
      )
      .run();
  }
  
  console.log(`Synced ${data.places.length} places`);
}

/**
 * Sync weather forecast and calculate sun windows
 * Using WeatherAPI.com (API key required) or Open-Meteo as fallback
 */
async function syncWeatherAndSun(env: Env, lat: number, lng: number): Promise<void> {
  // Prefer WeatherAPI.com if API key is available (uses API key auth, not IP-based rate limiting)
  if (env.WEATHER_API_KEY) {
    await syncWeatherFromWeatherAPI(env, lat, lng);
  } else {
    await syncWeatherFromOpenMeteo(env, lat, lng);
  }
}

/**
 * Fetch weather from WeatherAPI.com (recommended - uses API key authentication)
 */
async function syncWeatherFromWeatherAPI(env: Env, lat: number, lng: number): Promise<void> {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${env.WEATHER_API_KEY}&q=${lat},${lng}&days=3&aqi=no&alerts=no`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('WeatherAPI.com error:', response.status, errorText);
    // Fall back to Open-Meteo
    console.log('Falling back to Open-Meteo...');
    await syncWeatherFromOpenMeteo(env, lat, lng);
    return;
  }

  const data = (await response.json()) as WeatherAPIResponse;

  // Process each forecast day
  for (const day of data.forecast.forecastday) {
    // Store hourly weather slots
    for (const hour of day.hour) {
      const conditions = {
        clouds: hour.cloud,
        precip: hour.precip_mm,
        visibility: hour.vis_km,
        temp: hour.temp_c,
      };

      const score = calculatePhotoDayScore(conditions);

      await env.DB
        .prepare(`
          INSERT INTO weather_slots (date_time, lat, lng, clouds, precip, visibility, temp, photoday_score)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(date_time, lat, lng) DO UPDATE SET
            clouds = excluded.clouds,
            precip = excluded.precip,
            visibility = excluded.visibility,
            temp = excluded.temp,
            photoday_score = excluded.photoday_score
        `)
        .bind(
          new Date(hour.time).toISOString(),
          lat,
          lng,
          conditions.clouds,
          conditions.precip,
          conditions.visibility,
          conditions.temp,
          score
        )
        .run();
    }

    // Parse sunrise/sunset times (format: "06:45 AM")
    const sunrise = parseWeatherAPITime(day.date, day.astro.sunrise);
    const sunset = parseWeatherAPITime(day.date, day.astro.sunset);
    const sunTimes = calculateSunWindows(sunrise, sunset);

    await env.DB
      .prepare(`
        INSERT INTO sun_windows (
          date, lat, lng, sunrise, sunset,
          golden_morning_start, golden_morning_end,
          golden_evening_start, golden_evening_end,
          blue_morning_start, blue_morning_end,
          blue_evening_start, blue_evening_end
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, lat, lng) DO UPDATE SET
          sunrise = excluded.sunrise,
          sunset = excluded.sunset,
          golden_morning_start = excluded.golden_morning_start,
          golden_morning_end = excluded.golden_morning_end,
          golden_evening_start = excluded.golden_evening_start,
          golden_evening_end = excluded.golden_evening_end,
          blue_morning_start = excluded.blue_morning_start,
          blue_morning_end = excluded.blue_morning_end,
          blue_evening_start = excluded.blue_evening_start,
          blue_evening_end = excluded.blue_evening_end
      `)
      .bind(
        day.date,
        lat,
        lng,
        toISOString(sunrise),
        toISOString(sunset),
        toISOString(sunTimes.goldenMorningStart),
        toISOString(sunTimes.goldenMorningEnd),
        toISOString(sunTimes.goldenEveningStart),
        toISOString(sunTimes.goldenEveningEnd),
        toISOString(sunTimes.blueMorningStart),
        toISOString(sunTimes.blueMorningEnd),
        toISOString(sunTimes.blueEveningStart),
        toISOString(sunTimes.blueEveningEnd)
      )
      .run();
  }

  const totalHours = data.forecast.forecastday.reduce((sum, day) => sum + day.hour.length, 0);
  console.log(`Synced ${totalHours} weather slots and ${data.forecast.forecastday.length} sun windows from WeatherAPI.com`);
}

/**
 * Parse WeatherAPI.com time format ("06:45 AM") to Date
 */
function parseWeatherAPITime(dateStr: string, timeStr: string): Date {
  const [time, period] = timeStr.split(' ');
  const [hourStr, minuteStr] = time.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  if (period === 'PM' && hour !== 12) {
    hour += 12;
  } else if (period === 'AM' && hour === 12) {
    hour = 0;
  }

  return new Date(`${dateStr}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
}

/**
 * Fetch weather from Open-Meteo (fallback - uses IP-based rate limiting)
 */
async function syncWeatherFromOpenMeteo(env: Env, lat: number, lng: number): Promise<void> {
  // Open-Meteo API - free weather API
  // https://open-meteo.com/en/docs
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('hourly', 'temperature_2m,cloud_cover,precipitation,visibility');
  url.searchParams.set('daily', 'sunrise,sunset');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('forecast_days', '3');

  const response = await fetch(url.toString());

  if (!response.ok) {
    console.error('Open-Meteo API error:', await response.text());
    return;
  }

  const data = (await response.json()) as OpenMeteoResponse;

  // Store hourly weather slots
  const hourlyTimes = data.hourly.time;
  for (let i = 0; i < hourlyTimes.length; i++) {
    const conditions = {
      clouds: data.hourly.cloud_cover[i],
      precip: data.hourly.precipitation[i],
      visibility: data.hourly.visibility[i] / 1000, // Convert m to km
      temp: data.hourly.temperature_2m[i],
    };

    const score = calculatePhotoDayScore(conditions);

    await env.DB
      .prepare(`
        INSERT INTO weather_slots (date_time, lat, lng, clouds, precip, visibility, temp, photoday_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date_time, lat, lng) DO UPDATE SET
          clouds = excluded.clouds,
          precip = excluded.precip,
          visibility = excluded.visibility,
          temp = excluded.temp,
          photoday_score = excluded.photoday_score
      `)
      .bind(
        new Date(hourlyTimes[i]).toISOString(),
        lat,
        lng,
        conditions.clouds,
        conditions.precip,
        conditions.visibility,
        conditions.temp,
        score
      )
      .run();
  }

  console.log(`Synced ${hourlyTimes.length} weather slots from Open-Meteo`);

  // Store sun windows (sunrise/sunset + calculated golden/blue hours)
  const dailyTimes = data.daily.time;
  for (let i = 0; i < dailyTimes.length; i++) {
    const sunrise = new Date(data.daily.sunrise[i]);
    const sunset = new Date(data.daily.sunset[i]);
    const sunTimes = calculateSunWindows(sunrise, sunset);

    await env.DB
      .prepare(`
        INSERT INTO sun_windows (
          date, lat, lng, sunrise, sunset,
          golden_morning_start, golden_morning_end,
          golden_evening_start, golden_evening_end,
          blue_morning_start, blue_morning_end,
          blue_evening_start, blue_evening_end
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date, lat, lng) DO UPDATE SET
          sunrise = excluded.sunrise,
          sunset = excluded.sunset,
          golden_morning_start = excluded.golden_morning_start,
          golden_morning_end = excluded.golden_morning_end,
          golden_evening_start = excluded.golden_evening_start,
          golden_evening_end = excluded.golden_evening_end,
          blue_morning_start = excluded.blue_morning_start,
          blue_morning_end = excluded.blue_morning_end,
          blue_evening_start = excluded.blue_evening_start,
          blue_evening_end = excluded.blue_evening_end
      `)
      .bind(
        dailyTimes[i],
        lat,
        lng,
        toISOString(sunrise),
        toISOString(sunset),
        toISOString(sunTimes.goldenMorningStart),
        toISOString(sunTimes.goldenMorningEnd),
        toISOString(sunTimes.goldenEveningStart),
        toISOString(sunTimes.goldenEveningEnd),
        toISOString(sunTimes.blueMorningStart),
        toISOString(sunTimes.blueMorningEnd),
        toISOString(sunTimes.blueEveningStart),
        toISOString(sunTimes.blueEveningEnd)
      )
      .run();
  }

  console.log(`Synced ${dailyTimes.length} sun windows from Open-Meteo`);
}
