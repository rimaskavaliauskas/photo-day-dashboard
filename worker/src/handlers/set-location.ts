import { Env, SetLocationRequest } from '../types';

/**
 * POST /api/set-location
 * 
 * Updates the user's base location in user_settings.
 * Called when user clicks "Use precise location" or enters a manual address.
 * 
 * Body: { lat: number, lng: number, source: "browser" | "manual" }
 */
export async function handleSetLocation(
  env: Env,
  body: unknown
): Promise<{ success: boolean; location: { lat: number; lng: number; source: string } }> {
  // Validate request body
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }
  
  const request = body as SetLocationRequest;
  
  if (typeof request.lat !== 'number' || typeof request.lng !== 'number') {
    throw new Error('lat and lng must be numbers');
  }
  
  if (request.lat < -90 || request.lat > 90) {
    throw new Error('lat must be between -90 and 90');
  }
  
  if (request.lng < -180 || request.lng > 180) {
    throw new Error('lng must be between -180 and 180');
  }
  
  const source = request.source === 'browser' || request.source === 'manual' 
    ? request.source 
    : 'manual';
  
  // Update user_settings
  await env.DB
    .prepare(`
      INSERT OR REPLACE INTO user_settings (id, base_lat, base_lng, last_geo_source, updated_at)
      VALUES (1, ?, ?, ?, datetime('now'))
    `)
    .bind(request.lat, request.lng, source)
    .run();
  
  return {
    success: true,
    location: {
      lat: request.lat,
      lng: request.lng,
      source,
    },
  };
}
