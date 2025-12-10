/**
 * Sun Position & Golden/Blue Hour Calculator
 * 
 * Golden Hour: When sun is 0° to 6° above horizon
 * Blue Hour: When sun is 0° to 6° below horizon
 * 
 * We calculate these from sunrise/sunset times using simple approximations.
 * For more accuracy, we'd use a full solar position library, but this is
 * good enough for photography planning.
 */

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  goldenMorningStart: Date;
  goldenMorningEnd: Date;
  goldenEveningStart: Date;
  goldenEveningEnd: Date;
  blueMorningStart: Date;
  blueMorningEnd: Date;
  blueEveningStart: Date;
  blueEveningEnd: Date;
}

/**
 * Calculate golden and blue hour windows from sunrise/sunset times.
 * 
 * Approximations:
 * - Golden hour morning: starts ~20 min before sunrise, ends ~40-60 min after
 * - Golden hour evening: starts ~60 min before sunset, ends ~20 min after
 * - Blue hour: ~30 min window before golden morning / after golden evening
 */
export function calculateSunWindows(sunrise: Date, sunset: Date): SunTimes {
  // Golden hour durations (in minutes)
  const GOLDEN_BEFORE_SUNRISE = 20;
  const GOLDEN_AFTER_SUNRISE = 50;
  const GOLDEN_BEFORE_SUNSET = 60;
  const GOLDEN_AFTER_SUNSET = 20;
  
  // Blue hour: ~30 min before/after golden hours
  const BLUE_DURATION = 30;

  // Morning golden hour
  const goldenMorningStart = addMinutes(sunrise, -GOLDEN_BEFORE_SUNRISE);
  const goldenMorningEnd = addMinutes(sunrise, GOLDEN_AFTER_SUNRISE);

  // Evening golden hour  
  const goldenEveningStart = addMinutes(sunset, -GOLDEN_BEFORE_SUNSET);
  const goldenEveningEnd = addMinutes(sunset, GOLDEN_AFTER_SUNSET);

  // Morning blue hour (before golden)
  const blueMorningStart = addMinutes(goldenMorningStart, -BLUE_DURATION);
  const blueMorningEnd = goldenMorningStart;

  // Evening blue hour (after golden)
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
    blueEveningEnd,
  };
}

/**
 * Check if a given time falls within a specific window
 */
export function isTimeInWindow(time: Date, windowStart: Date, windowEnd: Date): boolean {
  return time >= windowStart && time <= windowEnd;
}

/**
 * Check if time is during any golden hour
 */
export function isDuringGoldenHour(time: Date, sunTimes: SunTimes): 'morning' | 'evening' | null {
  if (isTimeInWindow(time, sunTimes.goldenMorningStart, sunTimes.goldenMorningEnd)) {
    return 'morning';
  }
  if (isTimeInWindow(time, sunTimes.goldenEveningStart, sunTimes.goldenEveningEnd)) {
    return 'evening';
  }
  return null;
}

/**
 * Check if time is during any blue hour
 */
export function isDuringBlueHour(time: Date, sunTimes: SunTimes): 'morning' | 'evening' | null {
  if (isTimeInWindow(time, sunTimes.blueMorningStart, sunTimes.blueMorningEnd)) {
    return 'morning';
  }
  if (isTimeInWindow(time, sunTimes.blueEveningStart, sunTimes.blueEveningEnd)) {
    return 'evening';
  }
  return null;
}

// Helper: add minutes to a date
function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Format date to ISO string for storage
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Format date to YYYY-MM-DD
 */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse ISO string to Date
 */
export function parseISO(isoString: string): Date {
  return new Date(isoString);
}
