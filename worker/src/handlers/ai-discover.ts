import {
  Env,
  AIDiscoverRequest,
  AIDiscoverResponse,
  DiscoveredRecommendation,
  TavilyResponse,
  MyPlace,
} from '../types';

const DISCOVER_RADIUS_KM = 50;

/**
 * Search Tavily for photogenic places near a location
 */
async function searchTavily(
  env: Env,
  placeName: string,
  lat: number,
  lng: number
): Promise<TavilyResponse | null> {
  if (!env.TAVILY_API_KEY) {
    console.warn('TAVILY_API_KEY not configured');
    return null;
  }

  // Craft search query focused on photography spots
  const query = `beautiful photogenic photography locations scenic viewpoints nature spots hidden gems near ${placeName} within ${DISCOVER_RADIUS_KM}km reviews testimonials`;

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: env.TAVILY_API_KEY,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 8,
      }),
    });

    if (!response.ok) {
      console.error('Tavily API error:', response.status, await response.text());
      return null;
    }

    return (await response.json()) as TavilyResponse;
  } catch (error) {
    console.error('Tavily search failed:', error);
    return null;
  }
}

/**
 * AI prompt for analyzing Tavily results
 */
const DISCOVER_SYSTEM_PROMPT = `You are a photography location analyst. Analyze search results about locations and identify the best spots for photography.

For each promising location you find in the search results, provide:
1. Name of the place (exact name from the results)
2. Brief description (1-2 sentences about what the place is)
3. Why it's good for photography (lighting opportunities, composition ideas, unique features)
4. Summary of any testimonials or reviews mentioned in the search results
5. Confidence score (0-100) based on quality and specificity of information

OUTPUT FORMAT (return ONLY a valid JSON array, no markdown):
[
  {
    "name": "Location Name",
    "description": "Brief description of the place",
    "whyPhotogenic": "Why this is great for photography",
    "testimonials": "Summary of reviews/experiences mentioned, or 'No specific reviews found'",
    "confidenceScore": 85,
    "sourceIndices": [0, 2]
  }
]

RULES:
- Only include locations with specific photography value
- Prioritize: scenic viewpoints, natural landmarks, interesting architecture, unique features
- Skip generic businesses, hotels, restaurants (unless architecturally significant)
- Confidence should reflect how much specific, verifiable information exists
- Return empty array [] if no good photography locations found
- IMPORTANT: Return ONLY the JSON array, no other text`;

/**
 * Use AI to analyze and rank Tavily results
 */
async function analyzeWithAI(
  env: Env,
  tavilyResults: TavilyResponse[],
  placeContext: { id: number; name: string }[]
): Promise<{ recommendations: DiscoveredRecommendation[]; model: 'workers-ai' | 'claude' }> {
  // Prepare context for AI
  const searchContext = tavilyResults.map((result, idx) => ({
    nearPlace: placeContext[idx]?.name || 'Unknown',
    nearPlaceId: placeContext[idx]?.id,
    answer: result.answer,
    results: result.results.map((r, rIdx) => ({
      index: rIdx,
      title: r.title,
      content: r.content.substring(0, 800), // Limit content length
      url: r.url,
    })),
  }));

  const userMessage = `Analyze these search results and identify the best photography locations:

${JSON.stringify(searchContext, null, 2)}

Extract and rank the top photography spots from these results. Return ONLY the JSON array.`;

  // Try Workers AI first
  try {
    const response = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: DISCOVER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
    });

    const aiResponse = (response as { response: string }).response;
    const recommendations = parseAIResponse(aiResponse, searchContext, tavilyResults);
    return { recommendations, model: 'workers-ai' };
  } catch (error) {
    console.error('Workers AI failed for discover:', error);

    // Fallback to Claude
    if (env.ANTHROPIC_API_KEY) {
      return await analyzeWithClaude(env, userMessage, searchContext, tavilyResults);
    }

    throw new Error('AI analysis unavailable');
  }
}

/**
 * Parse AI response into recommendations
 */
function parseAIResponse(
  aiResponse: string,
  searchContext: Array<{
    nearPlace: string;
    nearPlaceId: number | undefined;
    results: Array<{ index: number; url: string }>;
  }>,
  tavilyResults: TavilyResponse[]
): DiscoveredRecommendation[] {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = aiResponse.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    // Find JSON array in the response
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.error('AI response is not an array:', parsed);
      return [];
    }

    return parsed.map((item: {
      name?: string;
      description?: string;
      whyPhotogenic?: string;
      testimonials?: string;
      confidenceScore?: number;
      sourceIndices?: number[];
    }, idx: number) => {
      // Find which place context this belongs to (use first by default)
      const sourceContext = searchContext[0];

      // Get source URLs from the indices
      const sourceUrls = (item.sourceIndices || [])
        .map((i: number) => {
          const result = sourceContext?.results?.find((r) => r.index === i);
          return result?.url;
        })
        .filter((url): url is string => Boolean(url));

      return {
        id: `discover-${Date.now()}-${idx}`,
        name: item.name || 'Unknown Location',
        description: item.description || '',
        whyPhotogenic: item.whyPhotogenic || 'Photogenic location',
        testimonials: item.testimonials || 'No specific reviews found',
        sourceUrls,
        nearPlaceId: sourceContext?.nearPlaceId || 0,
        nearPlaceName: sourceContext?.nearPlace || 'Unknown',
        confidenceScore: item.confidenceScore || 50,
      };
    });
  } catch (error) {
    console.error('Failed to parse AI response:', error, 'Response:', aiResponse);
    return [];
  }
}

/**
 * Claude fallback for AI analysis
 */
async function analyzeWithClaude(
  env: Env,
  userMessage: string,
  searchContext: Array<{
    nearPlace: string;
    nearPlaceId: number | undefined;
    results: Array<{ index: number; url: string }>;
  }>,
  tavilyResults: TavilyResponse[]
): Promise<{ recommendations: DiscoveredRecommendation[]; model: 'workers-ai' | 'claude' }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [{ role: 'user', content: userMessage }],
      system: DISCOVER_SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  const recommendations = parseAIResponse(data.content[0].text, searchContext, tavilyResults);

  return { recommendations, model: 'claude' };
}

/**
 * Main handler for AI Discover
 */
export async function handleAIDiscover(
  env: Env,
  request: AIDiscoverRequest
): Promise<AIDiscoverResponse> {
  const startTime = Date.now();

  // Check if Tavily is configured
  if (!env.TAVILY_API_KEY) {
    return {
      recommendations: [],
      searchedPlaces: [],
      model: 'workers-ai',
      processingTime: Date.now() - startTime,
    };
  }

  // Get user's places
  let places: MyPlace[];
  if (request.placeIds && request.placeIds.length > 0) {
    const placeholders = request.placeIds.map(() => '?').join(',');
    const result = await env.DB
      .prepare(`SELECT * FROM my_places WHERE id IN (${placeholders}) AND active = 1`)
      .bind(...request.placeIds)
      .all<MyPlace>();
    places = result.results || [];
  } else {
    const result = await env.DB
      .prepare('SELECT * FROM my_places WHERE active = 1 LIMIT 5')
      .all<MyPlace>();
    places = result.results || [];
  }

  if (places.length === 0) {
    return {
      recommendations: [],
      searchedPlaces: [],
      model: 'workers-ai',
      processingTime: Date.now() - startTime,
    };
  }

  // Search Tavily for each place (limit to first 3 to avoid rate limits)
  const tavilyResults: TavilyResponse[] = [];
  const placeContext: { id: number; name: string }[] = [];

  for (const place of places.slice(0, 3)) {
    const result = await searchTavily(env, place.name, place.lat, place.lng);
    if (result && result.results.length > 0) {
      tavilyResults.push(result);
      placeContext.push({ id: place.id!, name: place.name });
    }
  }

  if (tavilyResults.length === 0) {
    return {
      recommendations: [],
      searchedPlaces: placeContext,
      model: 'workers-ai',
      processingTime: Date.now() - startTime,
    };
  }

  // Analyze with AI
  const { recommendations, model } = await analyzeWithAI(env, tavilyResults, placeContext);

  // Sort by confidence and limit results
  const maxResults = request.maxResults || 10;
  const sortedRecommendations = recommendations
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, maxResults);

  return {
    recommendations: sortedRecommendations,
    searchedPlaces: placeContext,
    model,
    processingTime: Date.now() - startTime,
  };
}
