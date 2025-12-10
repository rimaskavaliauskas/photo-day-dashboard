import { Env, MyPlace, DiscoveredPlace, PlaceForecast } from '../types';
import { syncPlacesFromSheet, appendPlaceToSheet } from '../lib/sheets-sync';
import { calculateSunWindows, toISOString } from '../lib/sun';

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

        // Get nearby discovered places
        const nearby = await env.DB
            .prepare(`
        SELECT * FROM discovered_places 
        WHERE near_place_id = ?
        ORDER BY rating DESC, distance_km ASC
        LIMIT 10
      `)
            .bind(place.id)
            .all<DiscoveredPlace>();

        response.push({
            place,
            forecasts: forecasts.results || [],
            nearby: nearby.results || [],
        });
    }

    return response;
}

/**
 * POST /api/my-places/sync
 * Sync places from Google Sheet
 */
export async function handleSyncFromSheet(env: Env): Promise<{ synced: number }> {
    const synced = await syncPlacesFromSheet(env);
    return { synced };
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

    // Fetch 3-day weather from Open-Meteo
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', place.lat.toString());
    url.searchParams.set('longitude', place.lng.toString());
    url.searchParams.set('hourly', 'cloudcover');
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '3');

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error('Failed to fetch weather');
    }

    interface OpenMeteoResponse {
        daily: {
            time: string[];
            sunrise: string[];
            sunset: string[];
        };
        hourly: {
            time: string[];
            cloudcover: number[];
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
        const morningClouds = data.hourly.cloudcover[dayStart + goldenMorningHour] || 50;
        const eveningClouds = data.hourly.cloudcover[dayStart + goldenEveningHour] || 50;

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
 * GET /api/my-places/:id/nearby
 * Get discovered places near a user location
 */
export async function handleGetNearby(env: Env, placeId: number): Promise<DiscoveredPlace[]> {
    const nearby = await env.DB
        .prepare(`
      SELECT * FROM discovered_places 
      WHERE near_place_id = ?
      ORDER BY rating DESC, distance_km ASC
      LIMIT 20
    `)
        .bind(placeId)
        .all<DiscoveredPlace>();

    return nearby.results || [];
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
