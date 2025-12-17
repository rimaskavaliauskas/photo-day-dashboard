import { Env, ChatRequest } from './types';
import { handleDashboard } from './handlers/dashboard';
import { handleSetLocation } from './handlers/set-location';
import {
  handleGetMyPlaces,
  handleSyncFromSheet,
  handleCheckNow,
  handleGetNearby,
  handlePinPlace,
  handleDeleteMyPlace,
} from './handlers/my-places';
import { handleAIChat } from './handlers/ai-chat';
import { runPlacesAndWeatherSync } from './cron/places-and-weather';
import { runYouTubeSync } from './cron/youtube-sync';
import { syncPlacesFromSheet } from './lib/sheets-sync';

// =============================================================================
// Config helpers
// =============================================================================
function getConfigStatus(env: Env) {
  const placesConfigured = Boolean(env.GOOGLE_PLACES_API_KEY);
  const youtubeConfigured = Boolean(env.YOUTUBE_API_KEY && env.YOUTUBE_CHANNELS);
  const sheetConfigured = Boolean(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
    env.GOOGLE_SHEET_ID
  );
  const tasksSheetConfigured = Boolean(env.TASKS_SHEET_URL);

  const warnings: string[] = [];
  if (!placesConfigured) warnings.push('GOOGLE_PLACES_API_KEY missing – skipping place discovery');
  if (!youtubeConfigured) warnings.push('YouTube sync disabled – YOUTUBE_API_KEY or channels missing');
  if (!sheetConfigured) warnings.push('Sheets credentials missing – place sync/pinning disabled');
  if (!tasksSheetConfigured) warnings.push('TASKS_SHEET_URL missing – tasks sync disabled');

  return {
    placesConfigured,
    youtubeConfigured,
    sheetConfigured,
    tasksSheetConfigured,
    defaultLat: env.DEFAULT_LAT,
    defaultLng: env.DEFAULT_LNG,
    radiusKm: env.DEFAULT_RADIUS_KM,
    warnings,
  };
}

// =============================================================================
// CORS Headers - Allow frontend to call our API
// =============================================================================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function handleCors(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

// Helper to extract ID from path like /api/my-places/123/check-now
function extractId(path: string, pattern: RegExp): number | null {
  const match = path.match(pattern);
  return match ? parseInt(match[1], 10) : null;
}

// =============================================================================
// Main Worker Export
// =============================================================================
export default {
  /**
   * HTTP Request Handler
   * Routes incoming requests to appropriate handlers
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // =======================================================================
      // Dashboard Routes (existing)
      // =======================================================================

      // Route: GET /api/dashboard
      if (path === '/api/dashboard' && request.method === 'GET') {
        const lat = url.searchParams.get('lat')
          ? parseFloat(url.searchParams.get('lat')!)
          : (request.cf?.latitude as number | undefined);
        const lng = url.searchParams.get('lng')
          ? parseFloat(url.searchParams.get('lng')!)
          : (request.cf?.longitude as number | undefined);

        const data = await handleDashboard(env, lat, lng);
        return jsonResponse(data);
      }

      // Route: POST /api/set-location
      if (path === '/api/set-location' && request.method === 'POST') {
        const body = await request.json();
        const result = await handleSetLocation(env, body);
        return jsonResponse(result);
      }

      // =======================================================================
      // My Places Routes (new)
      // =======================================================================

      // Route: GET /api/my-places - List all places with forecasts
      if (path === '/api/my-places' && request.method === 'GET') {
        const data = await handleGetMyPlaces(env);
        return jsonResponse(data);
      }

      // Route: POST /api/my-places/sync - Sync from Google Sheet
      if (path === '/api/my-places/sync' && request.method === 'POST') {
        const result = await handleSyncFromSheet(env);
        return jsonResponse(result);
      }

      // Route: DELETE /api/my-places/:id - Remove a place
      const deleteMatch = path.match(/^\/api\/my-places\/(\d+)$/);
      if (deleteMatch && request.method === 'DELETE') {
        const placeId = parseInt(deleteMatch[1], 10);
        await handleDeleteMyPlace(env, placeId);
        return jsonResponse({ success: true });
      }

      // Route: POST /api/my-places/:id/check-now - Immediate weather check
      const checkNowMatch = path.match(/^\/api\/my-places\/(\d+)\/check-now$/);
      if (checkNowMatch && request.method === 'POST') {
        const placeId = parseInt(checkNowMatch[1], 10);
        const forecasts = await handleCheckNow(env, placeId);
        return jsonResponse({ forecasts });
      }

      // Route: GET /api/my-places/:id/nearby - Get nearby discovered places
      const nearbyMatch = path.match(/^\/api\/my-places\/(\d+)\/nearby$/);
      if (nearbyMatch && request.method === 'GET') {
        const placeId = parseInt(nearbyMatch[1], 10);
        const nearby = await handleGetNearby(env, placeId);
        return jsonResponse({ nearby });
      }

      // Route: POST /api/discovered/:id/pin - Pin a discovered place
      const pinMatch = path.match(/^\/api\/discovered\/(\d+)\/pin$/);
      if (pinMatch && request.method === 'POST') {
        const discoveredId = parseInt(pinMatch[1], 10);
        const result = await handlePinPlace(env, discoveredId);
        return jsonResponse(result);
      }

      // =======================================================================
      // AI Chat Route
      // =======================================================================

      // Route: POST /api/ai/chat - AI photography assistant
      if (path === '/api/ai/chat' && request.method === 'POST') {
        const body = await request.json() as ChatRequest;
        const result = await handleAIChat(env, body);
        return jsonResponse(result);
      }

      // =======================================================================
      // Utility Routes
      // =======================================================================

      // Route: GET /api/videos - Get YouTube videos
      if (path === '/api/videos' && request.method === 'GET') {
        const videos = await env.DB
          .prepare('SELECT * FROM youtube_videos ORDER BY published_at DESC LIMIT 20')
          .all();
        return jsonResponse({ videos: videos.results || [] });
      }

      // =======================================================================
      // Admin sync routes (local/dev convenience)
      // =======================================================================
      if (path === '/api/admin/sync-places-weather' && request.method === 'POST') {
        const config = getConfigStatus(env);
        if (!config.placesConfigured) {
          return errorResponse('GOOGLE_PLACES_API_KEY missing', 400);
        }
        await runPlacesAndWeatherSync(env);
        return jsonResponse({ success: true, message: 'Places & weather sync completed' });
      }

      if (path === '/api/admin/sync-youtube' && request.method === 'POST') {
        const config = getConfigStatus(env);
        if (!config.youtubeConfigured) {
          return errorResponse('YouTube API key or channels missing', 400);
        }
        await runYouTubeSync(env);
        return jsonResponse({ success: true, message: 'YouTube sync completed' });
      }

      if (path === '/api/admin/sync-all' && request.method === 'POST') {
        const config = getConfigStatus(env);
        if (!config.placesConfigured) {
          return errorResponse('GOOGLE_PLACES_API_KEY missing', 400);
        }
        if (!config.youtubeConfigured) {
          return errorResponse('YouTube API key or channels missing', 400);
        }
        await runPlacesAndWeatherSync(env);
        await runYouTubeSync(env);
        return jsonResponse({ success: true, message: 'Full sync completed' });
      }

      // Route: GET /api/health - Health check
      if (path === '/api/health') {
        const config = getConfigStatus(env);
    return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          config,
        });
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404);

    } catch (error) {
      console.error('Request error:', error);
      const message = error instanceof Error ? error.message : 'Internal server error';
      return errorResponse(message, 500);
    }
  },

  /**
   * Scheduled (Cron) Handler
   * Runs every 6 hours to sync data
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cronTime = event.cron;
    console.log(`Cron triggered: ${cronTime} at ${new Date().toISOString()}`);

    try {
      // Every 6 hours: run all syncs
      if (cronTime === '0 */6 * * *') {
        // 1. Sync places from Google Sheet
        console.log('Running: sheets-sync');
        await syncPlacesFromSheet(env);

        // 2. Sync weather and nearby places for all user locations
        console.log('Running: places-and-weather');
        await runPlacesAndWeatherSync(env);

        // 3. Sync YouTube videos
        console.log('Running: youtube-sync');
        await runYouTubeSync(env);
      }

      console.log('Cron jobs completed successfully');
    } catch (error) {
      console.error('Cron error:', error);
    }
  },
};
