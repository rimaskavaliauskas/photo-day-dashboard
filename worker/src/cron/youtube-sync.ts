import { Env, YouTubeSearchResponse } from '../types';

/**
 * Cron: youtube-sync
 * 
 * Runs every hour to:
 * 1. Fetch latest videos from configured photography channels
 * 2. Upsert into youtube_videos table
 */
export async function runYouTubeSync(env: Env): Promise<void> {
  const apiKey = env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set, skipping YouTube sync');
    return;
  }
  
  // Get channel IDs from environment (comma-separated)
  const channelIds = env.YOUTUBE_CHANNELS?.split(',').map(id => id.trim()).filter(Boolean) || [];
  
  if (channelIds.length === 0) {
    console.log('No YouTube channels configured');
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

/**
 * Sync videos from a single YouTube channel
 */
async function syncChannelVideos(
  env: Env,
  apiKey: string,
  channelId: string
): Promise<number> {
  // YouTube Data API v3 - Search
  // https://developers.google.com/youtube/v3/docs/search/list
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('key', apiKey);
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'date');
  url.searchParams.set('maxResults', '10'); // Get latest 10 videos per channel
  
  const response = await fetch(url.toString());
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`YouTube API error: ${error}`);
  }
  
  const data = (await response.json()) as YouTubeSearchResponse;
  
  if (!data.items || data.items.length === 0) {
    return 0;
  }
  
  for (const item of data.items) {
    const videoId = item.id.videoId;
    const snippet = item.snippet;
    
    await env.DB
      .prepare(`
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
      `)
      .bind(
        snippet.channelId,
        videoId,
        snippet.title,
        snippet.description?.substring(0, 500) || null, // Truncate long descriptions
        snippet.publishedAt,
        snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || null,
        `https://www.youtube.com/watch?v=${videoId}`
      )
      .run();
  }
  
  return data.items.length;
}
