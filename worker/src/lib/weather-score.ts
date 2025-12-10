/**
 * Weather Scoring for Photography
 * 
 * Calculates a "Photo Day Score" (0-100) based on weather conditions.
 * Different conditions are good for different types of photography.
 */

export interface WeatherConditions {
  clouds: number;      // Cloud cover 0-100%
  precip: number;      // Precipitation mm/h
  visibility: number;  // Visibility in km
  temp: number;        // Temperature in Celsius
}

/**
 * Calculate overall Photo Day Score (0-100)
 * 
 * Scoring logic:
 * - Clear skies (low clouds) are generally best for golden hour
 * - Some clouds (20-40%) can add drama
 * - Heavy clouds reduce score but can be good for portraits
 * - Rain/precipitation significantly reduces score
 * - Low visibility (fog) can be interesting but scores lower
 * - Extreme temperatures slightly reduce score
 */
export function calculatePhotoDayScore(conditions: WeatherConditions): number {
  let score = 100;
  
  // Cloud cover scoring
  // 0-20%: excellent (clear golden hour)
  // 20-40%: great (some drama)
  // 40-60%: okay (diffused light)
  // 60-80%: mediocre
  // 80-100%: poor for most outdoor
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
  
  // Precipitation penalty
  // Any precipitation significantly impacts outdoor photography
  if (conditions.precip > 0 && conditions.precip <= 0.5) {
    score -= 20; // Light drizzle
  } else if (conditions.precip > 0.5 && conditions.precip <= 2) {
    score -= 35; // Moderate rain
  } else if (conditions.precip > 2) {
    score -= 50; // Heavy rain
  }
  
  // Visibility scoring
  // High visibility is important for landscapes
  if (conditions.visibility >= 20) {
    score -= 0;  // Excellent
  } else if (conditions.visibility >= 10) {
    score -= 5;  // Good
  } else if (conditions.visibility >= 5) {
    score -= 10; // Okay
  } else if (conditions.visibility >= 1) {
    score -= 15; // Fog - can be artistic!
  } else {
    score -= 25; // Very poor
  }
  
  // Temperature comfort (minor factor)
  // Photographers need to be comfortable!
  if (conditions.temp >= 10 && conditions.temp <= 25) {
    score -= 0;  // Comfortable
  } else if (conditions.temp >= 0 && conditions.temp < 10) {
    score -= 3;  // Cold but manageable
  } else if (conditions.temp > 25 && conditions.temp <= 35) {
    score -= 3;  // Hot but manageable
  } else {
    score -= 8;  // Extreme temps
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Get a human-readable description of conditions
 */
export function describeConditions(conditions: WeatherConditions): string {
  const parts: string[] = [];
  
  // Cloud description
  if (conditions.clouds <= 10) {
    parts.push('clear skies');
  } else if (conditions.clouds <= 30) {
    parts.push('few clouds');
  } else if (conditions.clouds <= 60) {
    parts.push('partly cloudy');
  } else if (conditions.clouds <= 85) {
    parts.push('mostly cloudy');
  } else {
    parts.push('overcast');
  }
  
  // Precipitation
  if (conditions.precip > 2) {
    parts.push('heavy rain');
  } else if (conditions.precip > 0.5) {
    parts.push('rain');
  } else if (conditions.precip > 0) {
    parts.push('light drizzle');
  }
  
  // Visibility (only mention if notable)
  if (conditions.visibility < 1) {
    parts.push('dense fog');
  } else if (conditions.visibility < 5) {
    parts.push('foggy');
  } else if (conditions.visibility < 10) {
    parts.push('misty');
  }
  
  return parts.join(', ') || 'normal conditions';
}

/**
 * Check if conditions match a specific task condition requirement
 */
export function conditionsMatch(
  conditions: WeatherConditions,
  requirement: string
): { matches: boolean; reason: string } {
  switch (requirement) {
    case 'clear-any':
    case 'clear-noon':
      if (conditions.clouds <= 30 && conditions.precip === 0) {
        return { matches: true, reason: 'Clear skies with low cloud cover' };
      }
      return { matches: false, reason: 'Too cloudy or precipitation expected' };
      
    case 'overcast':
      if (conditions.clouds >= 70 && conditions.precip < 0.5) {
        return { matches: true, reason: 'Overcast skies, good for portraits' };
      }
      return { matches: false, reason: 'Not enough cloud cover' };
      
    case 'cloudy':
      if (conditions.clouds >= 40 && conditions.precip < 0.5) {
        return { matches: true, reason: 'Cloudy conditions for soft light' };
      }
      return { matches: false, reason: 'Conditions too clear or rainy' };
      
    case 'fog':
      if (conditions.visibility < 5 && conditions.precip < 0.5) {
        return { matches: true, reason: 'Foggy/misty conditions' };
      }
      return { matches: false, reason: 'No fog or mist present' };
      
    case 'golden-hour-morning':
    case 'golden-hour-evening':
    case 'golden-hour-any':
    case 'blue-hour-morning':
    case 'blue-hour-evening':
      // These are time-based, but weather still matters
      // Low clouds and no precipitation preferred
      if (conditions.clouds <= 50 && conditions.precip === 0) {
        return { matches: true, reason: 'Good conditions for golden/blue hour' };
      }
      return { matches: false, reason: 'Weather may obscure golden/blue hour effect' };
      
    case 'any':
    default:
      return { matches: true, reason: 'Any weather conditions acceptable' };
  }
}
