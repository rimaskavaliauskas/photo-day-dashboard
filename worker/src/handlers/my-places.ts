import { Env, MyPlace, DiscoveredPlace, PlaceForecast, WeatherAPIResponse } from '../types';
import { syncPlacesFromSheet, appendPlaceToSheet, deletePlaceFromSheet } from '../lib/sheets-sync';
import { calculateSunWindows, toISOString } from '../lib/sun';
import { haversineDistance } from '../lib/geo';

// Supported types for photo-worthy spots (aligned with Google Places API "New")
const DISCOVERED_TYPES = [
    'tourist_attraction',
    'park',
    'art_gallery',
    'museum',
    'campground',
];

// Default search radius (km) if env.PLACES_SEARCH_RADIUS_KM is not set
const DEFAULT_SEARCH_RADIUS_KM = 10;

async function fetchAndStoreNearbyPlaces(env: Env, place: MyPlace): Promise<DiscoveredPlace[]> {
    const apiKey = env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.warn('GOOGLE_PLACES_API_KEY not set, skipping nearby photos fetch');
        return [];
    }

    const radiusKm = parseFloat(env.PLACES_SEARCH_RADIUS_KM || '') || DEFAULT_SEARCH_RADIUS_KM;

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
                        center: { latitude: place.lat, longitude: place.lng },
                        radius: radiusKm * 1000,
                    },
                },
                includedTypes: DISCOVERED_TYPES,
                maxResultCount: 12,
            }),
        }
    );

    if (!response.ok) {
        const error = await response.text();
        console.error('Google Places API error (nearby for my_place):', error);
        return [];
    }

    type NearbyPlace = {
        id: string;
        displayName: { text: string };
        location: { latitude: number; longitude: number };
        types?: string[];
        rating?: number;
        photos?: { name: string }[];
    };

    const data = await response.json() as { places?: NearbyPlace[] };
    if (!data.places || data.places.length === 0) {
        return [];
    }

    const results: DiscoveredPlace[] = [];

    for (const p of data.places) {
        const photoRef = p.photos?.[0]?.name || null;
        const photoUrl = photoRef
            ? `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=800&key=${apiKey}`
            : null;

        const distanceKm = haversineDistance(place.lat, place.lng, p.location.latitude, p.location.longitude);

        await env.DB
            .prepare(`
                INSERT INTO discovered_places (
                    near_place_id, google_place_id, name, lat, lng, rating, photo_url, types, distance_km, is_pinned, last_seen_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
                ON CONFLICT(google_place_id) DO UPDATE SET
                    name = excluded.name,
                    lat = excluded.lat,
                    lng = excluded.lng,
                    rating = excluded.rating,
                    photo_url = excluded.photo_url,
                    types = excluded.types,
                    distance_km = excluded.distance_km,
                    last_seen_at = datetime('now'),
                    -- preserve pinned flag if already pinned
                    is_pinned = CASE WHEN discovered_places.is_pinned = 1 THEN 1 ELSE excluded.is_pinned END
            `)
            .bind(
                place.id,
                p.id,
                p.displayName.text,
                p.location.latitude,
                p.location.longitude,
                p.rating || null,
                photoUrl,
                p.types ? JSON.stringify(p.types) : null,
                distanceKm,
            )
            .run();

        results.push({
            near_place_id: place.id,
            google_place_id: p.id,
            name: p.displayName.text,
            lat: p.location.latitude,
            lng: p.location.longitude,
            rating: p.rating || null,
            photo_url: photoUrl,
            types: p.types ? JSON.stringify(p.types) : null,
            distance_km: distanceKm,
            is_pinned: 0,
        });
    }

    return results;
}

async function getOrFetchNearby(env: Env, place: MyPlace): Promise<DiscoveredPlace[]> {
    const existing = await env.DB
        .prepare(`
            SELECT * FROM discovered_places 
            WHERE near_place_id = ?
            ORDER BY rating DESC, distance_km ASC
            LIMIT 12
        `)
        .bind(place.id)
        .all<DiscoveredPlace>();

    if (existing.results && existing.results.length > 0) {
        return existing.results;
    }

    // No cached photos yet; fetch from Google Places API.
    return fetchAndStoreNearbyPlaces(env, place);
}

/**
 * Handler: My Places API
 * 
 * Endpoints for managing user's photo locations
 */

interface ForecastResponse {
    place: MyPlace;
    forecasts: PlaceForecast[];
    nearby: DiscoveredPlace[];
}

/**
 * GET /api/my-places
 * List all user places with their 3-day forecasts
 */
export async function handleGetMyPlaces(env: Env): Promise<ForecastResponse[]> {
    // Get all active places
    const places = await env.DB
        .prepare('SELECT * FROM my_places WHERE active = 1 ORDER BY created_at DESC')
        .all<MyPlace>();

    if (!places.results || places.results.length === 0) {
        return [];
    }

    const response: ForecastResponse[] = [];

    for (const place of places.results) {
        // Ensure we have discovered places (with photos) for this location.
        // If none are cached, fetch from Google Places API on-demand.
        const nearby = await getOrFetchNearby(env, place);

        // Get 3-day forecast for this place
        const forecasts = await env.DB
            .prepare(`
        SELECT * FROM place_forecasts 
        WHERE place_id = ? AND date >= date('now')
        ORDER BY date ASC
        LIMIT 3
      `)
            .bind(place.id)
            .all<PlaceForecast>();

        response.push({
            place,
            forecasts: forecasts.results || [],
            nearby,
        });
    }

    return response;
}

/**
 * POST /api/my-places/sync
 * Sync places from Google Sheet
 */
export async function handleSyncFromSheet(env: Env): Promise<{ synced: number }> {
    const { synced, deleted } = await syncPlacesFromSheet(env);
    return { synced, deleted };
}

/**
 * POST /api/my-places/:id/check-now
 * Immediately fetch weather for a specific place
 */
export async function handleCheckNow(env: Env, placeId: number): Promise<PlaceForecast[]> {
    // Get the place
    const place = await env.DB
        .prepare('SELECT * FROM my_places WHERE id = ?')
        .bind(placeId)
        .first<MyPlace>();

    if (!place) {
        throw new Error('Place not found');
    }

    // Use WeatherAPI.com if API key is available, otherwise fall back to Open-Meteo
    if (env.WEATHER_API_KEY) {
        return await checkNowWithWeatherAPI(env, placeId, place);
    } else {
        return await checkNowWithOpenMeteo(env, placeId, place);
    }
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
 * Fetch weather using WeatherAPI.com (recommended - uses API key authentication)
 */
async function checkNowWithWeatherAPI(env: Env, placeId: number, place: MyPlace): Promise<PlaceForecast[]> {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${env.WEATHER_API_KEY}&q=${place.lat},${place.lng}&days=3&aqi=no&alerts=no`;

    let response: Response;
    try {
        response = await fetch(url);
    } catch (fetchErr) {
        console.error('WeatherAPI.com fetch network error:', fetchErr);
        throw new Error(`Failed to fetch weather from WeatherAPI: network error`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error('WeatherAPI.com error:', response.status, errorText);
        // Don't fall back to Open-Meteo anymore - it has rate limit issues
        // Instead, throw a more descriptive error
        throw new Error(`WeatherAPI.com error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as WeatherAPIResponse;
    const forecasts: PlaceForecast[] = [];

    // Process each day
    for (const day of data.forecast.forecastday) {
        const sunrise = parseWeatherAPITime(day.date, day.astro.sunrise);
        const sunset = parseWeatherAPITime(day.date, day.astro.sunset);
        const sunTimes = calculateSunWindows(sunrise, sunset);

        // Find cloud cover during golden hours
        const goldenMorningHour = sunrise.getHours();
        const goldenEveningHour = sunset.getHours();

        // Find cloud cover for morning and evening from hourly data
        const morningHourData = day.hour.find(h => new Date(h.time).getHours() === goldenMorningHour);
        const eveningHourData = day.hour.find(h => new Date(h.time).getHours() === goldenEveningHour);

        const morningClouds = morningHourData?.cloud || 50;
        const eveningClouds = eveningHourData?.cloud || 50;

        const forecast: PlaceForecast = {
            place_id: placeId,
            date: day.date,
            sunrise: toISOString(sunrise),
            sunset: toISOString(sunset),
            golden_morning_start: toISOString(sunTimes.goldenMorningStart),
            golden_morning_end: toISOString(sunTimes.goldenMorningEnd),
            golden_evening_start: toISOString(sunTimes.goldenEveningStart),
            golden_evening_end: toISOString(sunTimes.goldenEveningEnd),
            blue_morning_start: toISOString(sunTimes.blueMorningStart),
            blue_morning_end: toISOString(sunTimes.blueMorningEnd),
            blue_evening_start: toISOString(sunTimes.blueEveningStart),
            blue_evening_end: toISOString(sunTimes.blueEveningEnd),
            morning_clouds: morningClouds,
            evening_clouds: eveningClouds,
            sky_open_morning: morningClouds < 30 ? 1 : 0,
            sky_open_evening: eveningClouds < 30 ? 1 : 0,
        };

        // Upsert to database
        await env.DB
            .prepare(`
        INSERT INTO place_forecasts (
          place_id, date, sunrise, sunset,
          golden_morning_start, golden_morning_end,
          golden_evening_start, golden_evening_end,
          blue_morning_start, blue_morning_end,
          blue_evening_start, blue_evening_end,
          morning_clouds, evening_clouds,
          sky_open_morning, sky_open_evening,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(place_id, date) DO UPDATE SET
          sunrise = excluded.sunrise,
          sunset = excluded.sunset,
          golden_morning_start = excluded.golden_morning_start,
          golden_morning_end = excluded.golden_morning_end,
          golden_evening_start = excluded.golden_evening_start,
          golden_evening_end = excluded.golden_evening_end,
          blue_morning_start = excluded.blue_morning_start,
          blue_morning_end = excluded.blue_morning_end,
          blue_evening_start = excluded.blue_evening_start,
          blue_evening_end = excluded.blue_evening_end,
          morning_clouds = excluded.morning_clouds,
          evening_clouds = excluded.evening_clouds,
          sky_open_morning = excluded.sky_open_morning,
          sky_open_evening = excluded.sky_open_evening,
          updated_at = datetime('now')
      `)
            .bind(
                forecast.place_id, forecast.date,
                forecast.sunrise, forecast.sunset,
                forecast.golden_morning_start, forecast.golden_morning_end,
                forecast.golden_evening_start, forecast.golden_evening_end,
                forecast.blue_morning_start, forecast.blue_morning_end,
                forecast.blue_evening_start, forecast.blue_evening_end,
                forecast.morning_clouds, forecast.evening_clouds,
                forecast.sky_open_morning, forecast.sky_open_evening
            )
            .run();

        forecasts.push(forecast);
    }

    return forecasts;
}

/**
 * Fetch weather using Open-Meteo (fallback - uses IP-based rate limiting)
 */
async function checkNowWithOpenMeteo(env: Env, placeId: number, place: MyPlace): Promise<PlaceForecast[]> {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', place.lat.toString());
    url.searchParams.set('longitude', place.lng.toString());
    url.searchParams.set('hourly', 'cloud_cover');
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '3');

    let response: Response;
    try {
        response = await fetch(url.toString());
    } catch (fetchErr) {
        console.error('Weather fetch network error:', fetchErr);
        throw new Error(`Failed to fetch weather: network error`);
    }

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Weather API error:', response.status, errorText);
        throw new Error(`Failed to fetch weather: ${response.status}`);
    }

    interface OpenMeteoResponse {
        daily: {
            time: string[];
            sunrise: string[];
            sunset: string[];
        };
        hourly: {
            time: string[];
            cloud_cover: number[];
        };
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const forecasts: PlaceForecast[] = [];

    // Process each day
    for (let i = 0; i < data.daily.time.length; i++) {
        const date = data.daily.time[i];
        const sunrise = new Date(data.daily.sunrise[i]);
        const sunset = new Date(data.daily.sunset[i]);
        const sunTimes = calculateSunWindows(sunrise, sunset);

        // Find cloud cover during golden hours
        const goldenMorningHour = sunrise.getHours();
        const goldenEveningHour = sunset.getHours();

        // Find the hourly index for morning and evening
        const dayStart = i * 24;
        const morningClouds = data.hourly.cloud_cover[dayStart + goldenMorningHour] || 50;
        const eveningClouds = data.hourly.cloud_cover[dayStart + goldenEveningHour] || 50;

        const forecast: PlaceForecast = {
            place_id: placeId,
            date,
            sunrise: toISOString(sunrise),
            sunset: toISOString(sunset),
            golden_morning_start: toISOString(sunTimes.goldenMorningStart),
            golden_morning_end: toISOString(sunTimes.goldenMorningEnd),
            golden_evening_start: toISOString(sunTimes.goldenEveningStart),
            golden_evening_end: toISOString(sunTimes.goldenEveningEnd),
            blue_morning_start: toISOString(sunTimes.blueMorningStart),
            blue_morning_end: toISOString(sunTimes.blueMorningEnd),
            blue_evening_start: toISOString(sunTimes.blueEveningStart),
            blue_evening_end: toISOString(sunTimes.blueEveningEnd),
            morning_clouds: morningClouds,
            evening_clouds: eveningClouds,
            sky_open_morning: morningClouds < 30 ? 1 : 0,
            sky_open_evening: eveningClouds < 30 ? 1 : 0,
        };

        // Upsert to database
        await env.DB
            .prepare(`
        INSERT INTO place_forecasts (
          place_id, date, sunrise, sunset,
          golden_morning_start, golden_morning_end,
          golden_evening_start, golden_evening_end,
          blue_morning_start, blue_morning_end,
          blue_evening_start, blue_evening_end,
          morning_clouds, evening_clouds,
          sky_open_morning, sky_open_evening,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(place_id, date) DO UPDATE SET
          sunrise = excluded.sunrise,
          sunset = excluded.sunset,
          golden_morning_start = excluded.golden_morning_start,
          golden_morning_end = excluded.golden_morning_end,
          golden_evening_start = excluded.golden_evening_start,
          golden_evening_end = excluded.golden_evening_end,
          blue_morning_start = excluded.blue_morning_start,
          blue_morning_end = excluded.blue_morning_end,
          blue_evening_start = excluded.blue_evening_start,
          blue_evening_end = excluded.blue_evening_end,
          morning_clouds = excluded.morning_clouds,
          evening_clouds = excluded.evening_clouds,
          sky_open_morning = excluded.sky_open_morning,
          sky_open_evening = excluded.sky_open_evening,
          updated_at = datetime('now')
      `)
            .bind(
                forecast.place_id, forecast.date,
                forecast.sunrise, forecast.sunset,
                forecast.golden_morning_start, forecast.golden_morning_end,
                forecast.golden_evening_start, forecast.golden_evening_end,
                forecast.blue_morning_start, forecast.blue_morning_end,
                forecast.blue_evening_start, forecast.blue_evening_end,
                forecast.morning_clouds, forecast.evening_clouds,
                forecast.sky_open_morning, forecast.sky_open_evening
            )
            .run();

        forecasts.push(forecast);
    }

    return forecasts;
}

/**
 * DELETE /api/my-places/:id
 * Remove a place (sheet or pinned) entirely.
 */
export async function handleDeleteMyPlace(env: Env, placeId: number): Promise<{ success: boolean }> {
    const place = await env.DB
        .prepare('SELECT * FROM my_places WHERE id = ?')
        .bind(placeId)
        .first<MyPlace>();

    if (!place) {
        throw new Error('Place not found');
    }

    // If this place was sourced from the sheet, clear its row in the sheet.
    if (place.sheet_row) {
        await deletePlaceFromSheet(env, place.sheet_row);
    }

    // If this was a pinned place, clear the pinned flag on the discovered record.
    if (place.pinned_from) {
        await env.DB
            .prepare('UPDATE discovered_places SET is_pinned = 0 WHERE google_place_id = ?')
            .bind(place.pinned_from)
            .run();
    }

    await env.DB
        .prepare('DELETE FROM my_places WHERE id = ?')
        .bind(placeId)
        .run();

    return { success: true };
}

/**
 * GET /api/my-places/:id/nearby
 * Get discovered places near a user location
 */
export async function handleGetNearby(env: Env, placeId: number): Promise<DiscoveredPlace[]> {
    const place = await env.DB
        .prepare('SELECT * FROM my_places WHERE id = ?')
        .bind(placeId)
        .first<MyPlace>();

    if (!place) {
        return [];
    }

    return getOrFetchNearby(env, place);
}

/**
 * POST /api/discovered/:id/pin
 * Pin a discovered place (adds to Google Sheet)
 */
export async function handlePinPlace(env: Env, discoveredId: number): Promise<{ success: boolean; place?: MyPlace }> {
    // Get the discovered place
    const discovered = await env.DB
        .prepare('SELECT * FROM discovered_places WHERE id = ?')
        .bind(discoveredId)
        .first<DiscoveredPlace>();

    if (!discovered) {
        throw new Error('Discovered place not found');
    }

    // Check if already pinned
    if (discovered.is_pinned) {
        return { success: true };
    }

    // Create new place from discovered
    const newPlace: MyPlace = {
        name: discovered.name,
        lat: discovered.lat,
        lng: discovered.lng,
        notes: `Pinned from Google Places (rating: ${discovered.rating || 'N/A'})`,
        pinned_from: discovered.google_place_id,
    };

    // Add to Google Sheet
    const sheetSuccess = await appendPlaceToSheet(env, newPlace);

    // Insert into my_places
    const result = await env.DB
        .prepare(`
      INSERT INTO my_places (name, lat, lng, notes, pinned_from, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(lat, lng) DO UPDATE SET
        name = excluded.name,
        updated_at = datetime('now')
    `)
        .bind(newPlace.name, newPlace.lat, newPlace.lng, newPlace.notes, newPlace.pinned_from)
        .run();

    // Mark as pinned
    await env.DB
        .prepare('UPDATE discovered_places SET is_pinned = 1 WHERE id = ?')
        .bind(discoveredId)
        .run();

    // Get the inserted place
    const insertedPlace = await env.DB
        .prepare('SELECT * FROM my_places WHERE lat = ? AND lng = ?')
        .bind(newPlace.lat, newPlace.lng)
        .first<MyPlace>();

    return { success: true, place: insertedPlace || undefined };
}
