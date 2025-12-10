var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-V5gIrh/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-V5gIrh/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/lib/geo.ts
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
__name(haversineDistance, "haversineDistance");
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
__name(toRadians, "toRadians");

// src/handlers/dashboard.ts
async function handleDashboard(env, cfLat, cfLng) {
  const db = env.DB;
  const settings = await db.prepare("SELECT * FROM user_settings WHERE id = 1").first();
  let lat;
  let lng;
  let source;
  if (settings && settings.base_lat && settings.base_lng) {
    lat = settings.base_lat;
    lng = settings.base_lng;
    source = settings.last_geo_source;
  } else if (cfLat && cfLng) {
    lat = cfLat;
    lng = cfLng;
    source = "ip";
    await db.prepare(`
        INSERT OR REPLACE INTO user_settings (id, base_lat, base_lng, last_geo_source, updated_at)
        VALUES (1, ?, ?, 'ip', datetime('now'))
      `).bind(lat, lng).run();
  } else {
    lat = parseFloat(env.DEFAULT_LAT);
    lng = parseFloat(env.DEFAULT_LNG);
    source = "default";
  }
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 864e5).toISOString().split("T")[0];
  const sunWindowToday = await db.prepare("SELECT * FROM sun_windows WHERE date = ? ORDER BY id DESC LIMIT 1").bind(today).first();
  const sunWindowTomorrow = await db.prepare("SELECT * FROM sun_windows WHERE date = ? ORDER BY id DESC LIMIT 1").bind(tomorrow).first();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const in48hours = new Date(Date.now() + 48 * 36e5).toISOString();
  const weatherSlots = await db.prepare(`
      SELECT * FROM weather_slots 
      WHERE date_time >= ? AND date_time <= ?
      ORDER BY date_time ASC
      LIMIT 48
    `).bind(now, in48hours).all();
  const currentWeather = weatherSlots.results?.[0] || null;
  const photoDayScore = weatherSlots.results?.length ? Math.round(
    weatherSlots.results.reduce((sum, w) => sum + (w.photoday_score || 50), 0) / weatherSlots.results.length
  ) : 50;
  const places = await db.prepare("SELECT * FROM places ORDER BY last_seen_at DESC LIMIT 20").all();
  const placesWithDistance = (places.results || []).map((place) => ({
    ...place,
    distance_km: haversineDistance(lat, lng, place.lat, place.lng)
  })).sort((a, b) => a.distance_km - b.distance_km);
  const taskWindows = await db.prepare(`
      SELECT tw.*, t.title as task_title, t.notes as task_notes
      FROM task_windows tw
      JOIN tasks t ON tw.task_id = t.task_id
      WHERE tw.window_start >= ?
      ORDER BY tw.window_start ASC, tw.score DESC
      LIMIT 10
    `).bind(now).all();
  const videos = await db.prepare(`
      SELECT * FROM youtube_videos 
      ORDER BY published_at DESC 
      LIMIT 12
    `).all();
  return {
    location: { lat, lng, source },
    sunWindows: {
      today: sunWindowToday || null,
      tomorrow: sunWindowTomorrow || null
    },
    weather: {
      current: currentWeather,
      hourly: weatherSlots.results || [],
      photoDayScore
    },
    places: placesWithDistance,
    taskWindows: taskWindows.results || [],
    videos: videos.results || []
  };
}
__name(handleDashboard, "handleDashboard");

// src/handlers/set-location.ts
async function handleSetLocation(env, body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid request body");
  }
  const request = body;
  if (typeof request.lat !== "number" || typeof request.lng !== "number") {
    throw new Error("lat and lng must be numbers");
  }
  if (request.lat < -90 || request.lat > 90) {
    throw new Error("lat must be between -90 and 90");
  }
  if (request.lng < -180 || request.lng > 180) {
    throw new Error("lng must be between -180 and 180");
  }
  const source = request.source === "browser" || request.source === "manual" ? request.source : "manual";
  await env.DB.prepare(`
      INSERT OR REPLACE INTO user_settings (id, base_lat, base_lng, last_geo_source, updated_at)
      VALUES (1, ?, ?, ?, datetime('now'))
    `).bind(request.lat, request.lng, source).run();
  return {
    success: true,
    location: {
      lat: request.lat,
      lng: request.lng,
      source
    }
  };
}
__name(handleSetLocation, "handleSetLocation");

// src/lib/sheets-sync.ts
var JWT_HEADER = {
  alg: "RS256",
  typ: "JWT"
};
async function createJWT(env) {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) {
    throw new Error("Google Service Account credentials not configured");
  }
  const now = Math.floor(Date.now() / 1e3);
  const expiry = now + 3600;
  const payload = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: expiry
  };
  const encodedHeader = btoa(JSON.stringify(JWT_HEADER)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const pemContents = privateKey.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${signatureInput}.${encodedSignature}`;
}
__name(createJWT, "createJWT");
async function getAccessToken(env) {
  const jwt = await createJWT(env);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  const data = await response.json();
  return data.access_token;
}
__name(getAccessToken, "getAccessToken");
async function readPlacesFromSheet(env) {
  const sheetId = env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn("GOOGLE_SHEET_ID not configured, skipping sheet sync");
    return [];
  }
  try {
    const accessToken = await getAccessToken(env);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:D`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to read sheet: ${error}`);
    }
    const data = await response.json();
    if (!data.values || data.values.length < 2) {
      console.log("No data in sheet (or only header row)");
      return [];
    }
    const places = [];
    for (let i = 1; i < data.values.length; i++) {
      const row = data.values[i];
      if (row.length >= 3 && row[0] && row[1] && row[2]) {
        const lat = parseFloat(row[1]);
        const lng = parseFloat(row[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          places.push({
            sheet_row: i + 1,
            // 1-indexed row number
            name: row[0].trim(),
            lat,
            lng,
            notes: row[3]?.trim() || null
          });
        }
      }
    }
    console.log(`Read ${places.length} places from sheet`);
    return places;
  } catch (error) {
    console.error("Error reading from sheet:", error);
    return [];
  }
}
__name(readPlacesFromSheet, "readPlacesFromSheet");
async function appendPlaceToSheet(env, place) {
  const sheetId = env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    console.warn("GOOGLE_SHEET_ID not configured, cannot write to sheet");
    return false;
  }
  try {
    const accessToken = await getAccessToken(env);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:D:append?valueInputOption=USER_ENTERED`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        values: [[place.name, place.lat, place.lng, place.notes || ""]]
      })
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to append to sheet: ${error}`);
    }
    console.log(`Appended place "${place.name}" to sheet`);
    return true;
  } catch (error) {
    console.error("Error appending to sheet:", error);
    return false;
  }
}
__name(appendPlaceToSheet, "appendPlaceToSheet");
async function syncPlacesFromSheet(env) {
  const places = await readPlacesFromSheet(env);
  let synced = 0;
  for (const place of places) {
    try {
      await env.DB.prepare(`
          INSERT INTO my_places (sheet_row, name, lat, lng, notes, updated_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
          ON CONFLICT(lat, lng) DO UPDATE SET
            sheet_row = excluded.sheet_row,
            name = excluded.name,
            notes = excluded.notes,
            updated_at = datetime('now')
        `).bind(place.sheet_row, place.name, place.lat, place.lng, place.notes).run();
      synced++;
    } catch (error) {
      console.error(`Error syncing place "${place.name}":`, error);
    }
  }
  console.log(`Synced ${synced} places from sheet to database`);
  return synced;
}
__name(syncPlacesFromSheet, "syncPlacesFromSheet");

// src/lib/sun.ts
function calculateSunWindows(sunrise, sunset) {
  const GOLDEN_BEFORE_SUNRISE = 20;
  const GOLDEN_AFTER_SUNRISE = 50;
  const GOLDEN_BEFORE_SUNSET = 60;
  const GOLDEN_AFTER_SUNSET = 20;
  const BLUE_DURATION = 30;
  const goldenMorningStart = addMinutes(sunrise, -GOLDEN_BEFORE_SUNRISE);
  const goldenMorningEnd = addMinutes(sunrise, GOLDEN_AFTER_SUNRISE);
  const goldenEveningStart = addMinutes(sunset, -GOLDEN_BEFORE_SUNSET);
  const goldenEveningEnd = addMinutes(sunset, GOLDEN_AFTER_SUNSET);
  const blueMorningStart = addMinutes(goldenMorningStart, -BLUE_DURATION);
  const blueMorningEnd = goldenMorningStart;
  const blueEveningStart = goldenEveningEnd;
  const blueEveningEnd = addMinutes(goldenEveningEnd, BLUE_DURATION);
  return {
    sunrise,
    sunset,
    goldenMorningStart,
    goldenMorningEnd,
    goldenEveningStart,
    goldenEveningEnd,
    blueMorningStart,
    blueMorningEnd,
    blueEveningStart,
    blueEveningEnd
  };
}
__name(calculateSunWindows, "calculateSunWindows");
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1e3);
}
__name(addMinutes, "addMinutes");
function toISOString(date) {
  return date.toISOString();
}
__name(toISOString, "toISOString");

// src/handlers/my-places.ts
async function handleGetMyPlaces(env) {
  const places = await env.DB.prepare("SELECT * FROM my_places WHERE active = 1 ORDER BY created_at DESC").all();
  if (!places.results || places.results.length === 0) {
    return [];
  }
  const response = [];
  for (const place of places.results) {
    const forecasts = await env.DB.prepare(`
        SELECT * FROM place_forecasts 
        WHERE place_id = ? AND date >= date('now')
        ORDER BY date ASC
        LIMIT 3
      `).bind(place.id).all();
    const nearby = await env.DB.prepare(`
        SELECT * FROM discovered_places 
        WHERE near_place_id = ?
        ORDER BY rating DESC, distance_km ASC
        LIMIT 10
      `).bind(place.id).all();
    response.push({
      place,
      forecasts: forecasts.results || [],
      nearby: nearby.results || []
    });
  }
  return response;
}
__name(handleGetMyPlaces, "handleGetMyPlaces");
async function handleSyncFromSheet(env) {
  const synced = await syncPlacesFromSheet(env);
  return { synced };
}
__name(handleSyncFromSheet, "handleSyncFromSheet");
async function handleCheckNow(env, placeId) {
  const place = await env.DB.prepare("SELECT * FROM my_places WHERE id = ?").bind(placeId).first();
  if (!place) {
    throw new Error("Place not found");
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", place.lat.toString());
  url.searchParams.set("longitude", place.lng.toString());
  url.searchParams.set("hourly", "cloudcover");
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch weather");
  }
  const data = await response.json();
  const forecasts = [];
  for (let i = 0; i < data.daily.time.length; i++) {
    const date = data.daily.time[i];
    const sunrise = new Date(data.daily.sunrise[i]);
    const sunset = new Date(data.daily.sunset[i]);
    const sunTimes = calculateSunWindows(sunrise, sunset);
    const goldenMorningHour = sunrise.getHours();
    const goldenEveningHour = sunset.getHours();
    const dayStart = i * 24;
    const morningClouds = data.hourly.cloudcover[dayStart + goldenMorningHour] || 50;
    const eveningClouds = data.hourly.cloudcover[dayStart + goldenEveningHour] || 50;
    const forecast = {
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
      sky_open_evening: eveningClouds < 30 ? 1 : 0
    };
    await env.DB.prepare(`
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
      `).bind(
      forecast.place_id,
      forecast.date,
      forecast.sunrise,
      forecast.sunset,
      forecast.golden_morning_start,
      forecast.golden_morning_end,
      forecast.golden_evening_start,
      forecast.golden_evening_end,
      forecast.blue_morning_start,
      forecast.blue_morning_end,
      forecast.blue_evening_start,
      forecast.blue_evening_end,
      forecast.morning_clouds,
      forecast.evening_clouds,
      forecast.sky_open_morning,
      forecast.sky_open_evening
    ).run();
    forecasts.push(forecast);
  }
  return forecasts;
}
__name(handleCheckNow, "handleCheckNow");
async function handleGetNearby(env, placeId) {
  const nearby = await env.DB.prepare(`
      SELECT * FROM discovered_places 
      WHERE near_place_id = ?
      ORDER BY rating DESC, distance_km ASC
      LIMIT 20
    `).bind(placeId).all();
  return nearby.results || [];
}
__name(handleGetNearby, "handleGetNearby");
async function handlePinPlace(env, discoveredId) {
  const discovered = await env.DB.prepare("SELECT * FROM discovered_places WHERE id = ?").bind(discoveredId).first();
  if (!discovered) {
    throw new Error("Discovered place not found");
  }
  if (discovered.is_pinned) {
    return { success: true };
  }
  const newPlace = {
    name: discovered.name,
    lat: discovered.lat,
    lng: discovered.lng,
    notes: `Pinned from Google Places (rating: ${discovered.rating || "N/A"})`,
    pinned_from: discovered.google_place_id
  };
  const sheetSuccess = await appendPlaceToSheet(env, newPlace);
  const result = await env.DB.prepare(`
      INSERT INTO my_places (name, lat, lng, notes, pinned_from, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(lat, lng) DO UPDATE SET
        name = excluded.name,
        updated_at = datetime('now')
    `).bind(newPlace.name, newPlace.lat, newPlace.lng, newPlace.notes, newPlace.pinned_from).run();
  await env.DB.prepare("UPDATE discovered_places SET is_pinned = 1 WHERE id = ?").bind(discoveredId).run();
  const insertedPlace = await env.DB.prepare("SELECT * FROM my_places WHERE lat = ? AND lng = ?").bind(newPlace.lat, newPlace.lng).first();
  return { success: true, place: insertedPlace || void 0 };
}
__name(handlePinPlace, "handlePinPlace");

// src/lib/weather-score.ts
function calculatePhotoDayScore(conditions) {
  let score = 100;
  if (conditions.clouds <= 20) {
    score -= 0;
  } else if (conditions.clouds <= 40) {
    score -= 5;
  } else if (conditions.clouds <= 60) {
    score -= 15;
  } else if (conditions.clouds <= 80) {
    score -= 30;
  } else {
    score -= 45;
  }
  if (conditions.precip > 0 && conditions.precip <= 0.5) {
    score -= 20;
  } else if (conditions.precip > 0.5 && conditions.precip <= 2) {
    score -= 35;
  } else if (conditions.precip > 2) {
    score -= 50;
  }
  if (conditions.visibility >= 20) {
    score -= 0;
  } else if (conditions.visibility >= 10) {
    score -= 5;
  } else if (conditions.visibility >= 5) {
    score -= 10;
  } else if (conditions.visibility >= 1) {
    score -= 15;
  } else {
    score -= 25;
  }
  if (conditions.temp >= 10 && conditions.temp <= 25) {
    score -= 0;
  } else if (conditions.temp >= 0 && conditions.temp < 10) {
    score -= 3;
  } else if (conditions.temp > 25 && conditions.temp <= 35) {
    score -= 3;
  } else {
    score -= 8;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}
__name(calculatePhotoDayScore, "calculatePhotoDayScore");

// src/cron/places-and-weather.ts
async function runPlacesAndWeatherSync(env) {
  const settings = await env.DB.prepare("SELECT * FROM user_settings WHERE id = 1").first();
  const lat = settings?.base_lat || parseFloat(env.DEFAULT_LAT);
  const lng = settings?.base_lng || parseFloat(env.DEFAULT_LNG);
  const radiusKm = parseFloat(env.DEFAULT_RADIUS_KM) || 30;
  console.log(`Syncing places and weather for: ${lat}, ${lng} (radius: ${radiusKm}km)`);
  await Promise.all([
    syncPlaces(env, lat, lng, radiusKm),
    syncWeatherAndSun(env, lat, lng)
  ]);
}
__name(runPlacesAndWeatherSync, "runPlacesAndWeatherSync");
async function syncPlaces(env, lat, lng, radiusKm) {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn("GOOGLE_PLACES_API_KEY not set, skipping places sync");
    return;
  }
  const includedTypes = [
    "park",
    "natural_feature",
    "tourist_attraction",
    "point_of_interest",
    "establishment"
  ];
  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.rating,places.photos"
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radiusKm * 1e3
            // Convert to meters
          }
        },
        includedTypes,
        maxResultCount: 20
      })
    }
  );
  if (!response.ok) {
    const error = await response.text();
    console.error("Google Places API error:", error);
    return;
  }
  const data = await response.json();
  if (!data.places || data.places.length === 0) {
    console.log("No places found");
    return;
  }
  for (const place of data.places) {
    const photoReference = place.photos?.[0]?.name || null;
    let photoUrl = null;
    if (photoReference) {
      photoUrl = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=800&key=${apiKey}`;
    }
    await env.DB.prepare(`
        INSERT INTO places (place_id, name, lat, lng, types, rating, photo_reference, photo_url, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(place_id) DO UPDATE SET
          name = excluded.name,
          types = excluded.types,
          rating = excluded.rating,
          photo_reference = excluded.photo_reference,
          photo_url = excluded.photo_url,
          last_seen_at = datetime('now')
      `).bind(
      place.id,
      place.displayName.text,
      place.location.latitude,
      place.location.longitude,
      JSON.stringify(place.types),
      place.rating || null,
      photoReference,
      photoUrl
    ).run();
  }
  console.log(`Synced ${data.places.length} places`);
}
__name(syncPlaces, "syncPlaces");
async function syncWeatherAndSun(env, lat, lng) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat.toString());
  url.searchParams.set("longitude", lng.toString());
  url.searchParams.set("hourly", "temperature_2m,cloudcover,precipitation,visibility");
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error("Open-Meteo API error:", await response.text());
    return;
  }
  const data = await response.json();
  const hourlyTimes = data.hourly.time;
  for (let i = 0; i < hourlyTimes.length; i++) {
    const conditions = {
      clouds: data.hourly.cloudcover[i],
      precip: data.hourly.precipitation[i],
      visibility: data.hourly.visibility[i] / 1e3,
      // Convert m to km
      temp: data.hourly.temperature_2m[i]
    };
    const score = calculatePhotoDayScore(conditions);
    await env.DB.prepare(`
        INSERT INTO weather_slots (date_time, lat, lng, clouds, precip, visibility, temp, photoday_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(date_time, lat, lng) DO UPDATE SET
          clouds = excluded.clouds,
          precip = excluded.precip,
          visibility = excluded.visibility,
          temp = excluded.temp,
          photoday_score = excluded.photoday_score
      `).bind(
      new Date(hourlyTimes[i]).toISOString(),
      lat,
      lng,
      conditions.clouds,
      conditions.precip,
      conditions.visibility,
      conditions.temp,
      score
    ).run();
  }
  console.log(`Synced ${hourlyTimes.length} weather slots`);
  const dailyTimes = data.daily.time;
  for (let i = 0; i < dailyTimes.length; i++) {
    const sunrise = new Date(data.daily.sunrise[i]);
    const sunset = new Date(data.daily.sunset[i]);
    const sunTimes = calculateSunWindows(sunrise, sunset);
    await env.DB.prepare(`
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
      `).bind(
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
    ).run();
  }
  console.log(`Synced ${dailyTimes.length} sun windows`);
}
__name(syncWeatherAndSun, "syncWeatherAndSun");

// src/cron/youtube-sync.ts
async function runYouTubeSync(env) {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("YOUTUBE_API_KEY not set, skipping YouTube sync");
    return;
  }
  const channelIds = env.YOUTUBE_CHANNELS?.split(",").map((id) => id.trim()).filter(Boolean) || [];
  if (channelIds.length === 0) {
    console.log("No YouTube channels configured");
    return;
  }
  console.log(`Syncing videos from ${channelIds.length} channels...`);
  let totalSynced = 0;
  for (const channelId of channelIds) {
    try {
      const count = await syncChannelVideos(env, apiKey, channelId);
      totalSynced += count;
    } catch (error) {
      console.error(`Error syncing channel ${channelId}:`, error);
    }
  }
  console.log(`Synced ${totalSynced} videos total`);
}
__name(runYouTubeSync, "runYouTubeSync");
async function syncChannelVideos(env, apiKey, channelId) {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "10");
  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YouTube API error: ${error}`);
  }
  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    return 0;
  }
  for (const item of data.items) {
    const videoId = item.id.videoId;
    const snippet = item.snippet;
    await env.DB.prepare(`
        INSERT INTO youtube_videos (
          channel_id, video_id, title, description, published_at,
          thumbnail_url, url, last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(video_id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          thumbnail_url = excluded.thumbnail_url,
          last_seen_at = datetime('now')
      `).bind(
      snippet.channelId,
      videoId,
      snippet.title,
      snippet.description?.substring(0, 500) || null,
      // Truncate long descriptions
      snippet.publishedAt,
      snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
      `https://www.youtube.com/watch?v=${videoId}`
    ).run();
  }
  return data.items.length;
}
__name(syncChannelVideos, "syncChannelVideos");

// src/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function handleCors(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
__name(handleCors, "handleCors");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 500) {
  return jsonResponse({ error: message }, status);
}
__name(errorResponse, "errorResponse");
var src_default = {
  /**
   * HTTP Request Handler
   * Routes incoming requests to appropriate handlers
   */
  async fetch(request, env, ctx) {
    const corsResponse = handleCors(request);
    if (corsResponse)
      return corsResponse;
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/dashboard" && request.method === "GET") {
        const lat = url.searchParams.get("lat") ? parseFloat(url.searchParams.get("lat")) : request.cf?.latitude;
        const lng = url.searchParams.get("lng") ? parseFloat(url.searchParams.get("lng")) : request.cf?.longitude;
        const data = await handleDashboard(env, lat, lng);
        return jsonResponse(data);
      }
      if (path === "/api/set-location" && request.method === "POST") {
        const body = await request.json();
        const result = await handleSetLocation(env, body);
        return jsonResponse(result);
      }
      if (path === "/api/my-places" && request.method === "GET") {
        const data = await handleGetMyPlaces(env);
        return jsonResponse(data);
      }
      if (path === "/api/my-places/sync" && request.method === "POST") {
        const result = await handleSyncFromSheet(env);
        return jsonResponse(result);
      }
      const checkNowMatch = path.match(/^\/api\/my-places\/(\d+)\/check-now$/);
      if (checkNowMatch && request.method === "POST") {
        const placeId = parseInt(checkNowMatch[1], 10);
        const forecasts = await handleCheckNow(env, placeId);
        return jsonResponse({ forecasts });
      }
      const nearbyMatch = path.match(/^\/api\/my-places\/(\d+)\/nearby$/);
      if (nearbyMatch && request.method === "GET") {
        const placeId = parseInt(nearbyMatch[1], 10);
        const nearby = await handleGetNearby(env, placeId);
        return jsonResponse({ nearby });
      }
      const pinMatch = path.match(/^\/api\/discovered\/(\d+)\/pin$/);
      if (pinMatch && request.method === "POST") {
        const discoveredId = parseInt(pinMatch[1], 10);
        const result = await handlePinPlace(env, discoveredId);
        return jsonResponse(result);
      }
      if (path === "/api/videos" && request.method === "GET") {
        const videos = await env.DB.prepare("SELECT * FROM youtube_videos ORDER BY published_at DESC LIMIT 20").all();
        return jsonResponse({ videos: videos.results || [] });
      }
      if (path === "/api/health") {
        return jsonResponse({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      }
      return errorResponse("Not found", 404);
    } catch (error) {
      console.error("Request error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return errorResponse(message, 500);
    }
  },
  /**
   * Scheduled (Cron) Handler
   * Runs every 6 hours to sync data
   */
  async scheduled(event, env, ctx) {
    const cronTime = event.cron;
    console.log(`Cron triggered: ${cronTime} at ${(/* @__PURE__ */ new Date()).toISOString()}`);
    try {
      if (cronTime === "0 */6 * * *") {
        console.log("Running: sheets-sync");
        await syncPlacesFromSheet(env);
        console.log("Running: places-and-weather");
        await runPlacesAndWeatherSync(env);
        console.log("Running: youtube-sync");
        await runYouTubeSync(env);
      }
      console.log("Cron jobs completed successfully");
    } catch (error) {
      console.error("Cron error:", error);
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-V5gIrh/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-V5gIrh/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
