import { Env, ChatRequest, ChatResponse, ChatMessage } from '../types';
import { handleGetMyPlaces } from './my-places';

const SYSTEM_PROMPT = `You are a photography planning assistant for the Photo Day Dashboard.
You help photographers decide the best times, locations, and conditions for shooting.

WEATHER INTERPRETATION:
- Cloud cover 0-30%: Clear skies, excellent for golden hour with warm direct light
- Cloud cover 30-70%: Dramatic clouds, can create stunning skies and dynamic compositions
- Cloud cover 70%+: Overcast, soft diffused light ideal for portraits and forest shots
- Golden hour: ~1 hour after sunrise and before sunset, warm orange/red tones
- Blue hour: ~30 min before sunrise and after sunset, cool blue/purple tones
- sky_open_morning/evening = 1 means clear skies (<30% clouds), 0 means cloudy

PHOTOGRAPHY ADVICE:
- Recommend arriving 15-30 min before golden hour to set up
- Consider nearby water for reflections during calm conditions
- Suggest backup indoor/covered locations for rainy forecasts
- Mention seasonal factors (foliage, crowds, accessibility)
- For dramatic sky photos, 30-60% clouds can be ideal

RESPONSE STYLE:
- Be concise but helpful (2-4 paragraphs max)
- Include specific times when discussing forecasts
- Suggest concrete actions the photographer can take
- If data is limited, acknowledge it and give general advice
- Use markdown for formatting (bold for emphasis, lists for multiple items)`;

/**
 * Handle AI chat requests
 * Tries Workers AI first (free), falls back to Claude if configured
 */
export async function handleAIChat(env: Env, request: ChatRequest): Promise<ChatResponse> {
    // 1. Build context from dashboard data
    const context = await buildContext(env, request.placeId, request.includeVideos);

    // 2. Construct messages
    const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'system', content: `CURRENT DATA:\n${JSON.stringify(context, null, 2)}` },
        ...(request.history || []),
        { role: 'user', content: request.message }
    ];

    // 3. Try Workers AI first (free)
    try {
        const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: messages.map(m => ({
                role: m.role as 'system' | 'user' | 'assistant',
                content: m.content
            })),
            max_tokens: 1024,
        });

        return {
            response: (response as any).response || 'I could not generate a response.',
            model: 'workers-ai'
        };
    } catch (workersError) {
        console.error('Workers AI failed:', workersError);

        // 4. Fallback to Claude if configured
        if (env.ANTHROPIC_API_KEY) {
            return await callClaude(env, messages);
        }

        throw new Error('AI service unavailable. Please try again later.');
    }
}

/**
 * Build context from dashboard data for the AI
 */
async function buildContext(env: Env, placeId?: number, includeVideos?: boolean) {
    const context: Record<string, unknown> = {
        currentTime: new Date().toISOString(),
        timezone: 'Europe/Vilnius',
        currentDate: new Date().toISOString().split('T')[0]
    };

    try {
        // Get all places with forecasts
        const placesData = await handleGetMyPlaces(env);

        if (placeId) {
            // Filter to specific place
            const place = placesData.find(p => p.place.id === placeId);
            if (place) {
                context.focusedPlace = {
                    name: place.place.name,
                    lat: place.place.lat,
                    lng: place.place.lng,
                    notes: place.place.notes,
                    forecasts: place.forecasts.map(f => ({
                        date: f.date,
                        sunrise: f.sunrise,
                        sunset: f.sunset,
                        golden_morning: `${f.golden_morning_start} - ${f.golden_morning_end}`,
                        golden_evening: `${f.golden_evening_start} - ${f.golden_evening_end}`,
                        morning_clouds: f.morning_clouds,
                        evening_clouds: f.evening_clouds,
                        sky_clear_morning: f.sky_open_morning === 1,
                        sky_clear_evening: f.sky_open_evening === 1
                    })),
                    nearbyPlaces: place.nearby.slice(0, 5).map(n => ({
                        name: n.name,
                        rating: n.rating,
                        distance_km: n.distance_km,
                        types: n.types ? JSON.parse(n.types).slice(0, 3) : []
                    }))
                };
            }
        } else {
            // Include summary of all places
            context.allPlaces = placesData.map(p => ({
                id: p.place.id,
                name: p.place.name,
                forecasts: p.forecasts.map(f => ({
                    date: f.date,
                    morning_clouds: f.morning_clouds,
                    evening_clouds: f.evening_clouds,
                    sky_clear_morning: f.sky_open_morning === 1,
                    sky_clear_evening: f.sky_open_evening === 1,
                    golden_morning: f.golden_morning_start ?
                        `${f.golden_morning_start.split('T')[1]?.substring(0, 5)} - ${f.golden_morning_end?.split('T')[1]?.substring(0, 5)}` : null,
                    golden_evening: f.golden_evening_start ?
                        `${f.golden_evening_start.split('T')[1]?.substring(0, 5)} - ${f.golden_evening_end?.split('T')[1]?.substring(0, 5)}` : null
                }))
            }));
        }

        // Optionally include recent videos
        if (includeVideos) {
            const videos = await env.DB
                .prepare('SELECT title, published_at FROM youtube_videos ORDER BY published_at DESC LIMIT 5')
                .all();
            context.recentVideos = videos.results?.map((v: any) => ({
                title: v.title,
                published: v.published_at?.split('T')[0]
            }));
        }
    } catch (error) {
        console.error('Error building context:', error);
        context.error = 'Could not load full dashboard data';
    }

    return context;
}

/**
 * Call Claude API as fallback
 */
async function callClaude(env: Env, messages: ChatMessage[]): Promise<ChatResponse> {
    const systemMessages = messages.filter(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: nonSystemMessages.map(m => ({
                role: m.role,
                content: m.content
            })),
            system: systemMessages.map(m => m.content).join('\n\n')
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Claude API error:', response.status, errorText);
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json() as {
        content: Array<{ text: string }>;
        usage?: { output_tokens: number };
    };

    return {
        response: data.content[0].text,
        model: 'claude',
        tokensUsed: data.usage?.output_tokens
    };
}
