import { Env, Task, WeatherSlot, SunWindow } from '../types';
import { conditionsMatch } from '../lib/weather-score';
import { parseISO } from '../lib/sun';

/**
 * Cron: task-windows
 * 
 * Runs every hour to:
 * 1. For each active task, find weather/sun slots that match the task's conditions
 * 2. Generate recommended shooting windows with scores
 * 
 * This is the "smart matching" logic that connects tasks to optimal times.
 */
export async function runTaskWindowsSync(env: Env): Promise<void> {
  console.log('Calculating task windows...');
  
  // Get all active tasks
  const tasks = await env.DB
    .prepare('SELECT * FROM tasks WHERE active = 1')
    .all<Task>();
  
  if (!tasks.results?.length) {
    console.log('No active tasks found');
    return;
  }
  
  // Get weather slots for next 72 hours
  const now = new Date();
  const in72hours = new Date(now.getTime() + 72 * 3600 * 1000);
  
  const weatherSlots = await env.DB
    .prepare(`
      SELECT * FROM weather_slots 
      WHERE date_time >= ? AND date_time <= ?
      ORDER BY date_time ASC
    `)
    .bind(now.toISOString(), in72hours.toISOString())
    .all<WeatherSlot>();
  
  // Get sun windows for next 3 days
  const today = now.toISOString().split('T')[0];
  const in3days = new Date(now.getTime() + 3 * 86400 * 1000).toISOString().split('T')[0];
  
  const sunWindows = await env.DB
    .prepare(`
      SELECT * FROM sun_windows 
      WHERE date >= ? AND date <= ?
    `)
    .bind(today, in3days)
    .all<SunWindow>();
  
  // Clear old task windows (before now)
  await env.DB
    .prepare('DELETE FROM task_windows WHERE window_end < ?')
    .bind(now.toISOString())
    .run();
  
  let createdCount = 0;
  
  for (const task of tasks.results) {
    const windows = findMatchingWindows(
      task,
      weatherSlots.results || [],
      sunWindows.results || []
    );
    
    // Insert new windows (limit to top 5 per task)
    for (const window of windows.slice(0, 5)) {
      await env.DB
        .prepare(`
          INSERT INTO task_windows (task_id, window_start, window_end, score, reason, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          task.task_id,
          window.start,
          window.end,
          window.score,
          window.reason
        )
        .run();
      
      createdCount++;
    }
  }
  
  console.log(`Created ${createdCount} task windows for ${tasks.results.length} tasks`);
}

interface MatchedWindow {
  start: string;
  end: string;
  score: number;
  reason: string;
}

/**
 * Find time windows that match a task's conditions
 */
function findMatchingWindows(
  task: Task,
  weatherSlots: WeatherSlot[],
  sunWindows: SunWindow[]
): MatchedWindow[] {
  const windows: MatchedWindow[] = [];
  const condition = task.condition || 'any';
  const timeWindow = task.time_window || 'any_day';
  
  // Check if this is a golden/blue hour condition
  const isGoldenMorning = condition === 'golden-hour-morning' || condition === 'golden-hour-any';
  const isGoldenEvening = condition === 'golden-hour-evening' || condition === 'golden-hour-any';
  const isBlueMorning = condition === 'blue-hour-morning';
  const isBlueEvening = condition === 'blue-hour-evening';
  const isSunBased = isGoldenMorning || isGoldenEvening || isBlueMorning || isBlueEvening;
  
  // For sun-based conditions, iterate over sun windows
  if (isSunBased) {
    for (const sun of sunWindows) {
      // Check time_window constraint (morning_only, evening_only, weekend_only, etc.)
      const date = new Date(sun.date);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (timeWindow === 'weekend_only' && !isWeekend) continue;
      if (timeWindow === 'weekday_only' && isWeekend) continue;
      
      // Find matching golden/blue hour windows
      if (isGoldenMorning && sun.golden_morning_start && sun.golden_morning_end) {
        if (timeWindow === 'evening_only') continue;
        
        const weatherMatch = findBestWeatherInWindow(
          weatherSlots,
          sun.golden_morning_start,
          sun.golden_morning_end,
          condition
        );
        
        if (weatherMatch) {
          windows.push({
            start: sun.golden_morning_start,
            end: sun.golden_morning_end,
            score: weatherMatch.score,
            reason: `Morning golden hour - ${weatherMatch.reason}`,
          });
        }
      }
      
      if (isGoldenEvening && sun.golden_evening_start && sun.golden_evening_end) {
        if (timeWindow === 'morning_only') continue;
        
        const weatherMatch = findBestWeatherInWindow(
          weatherSlots,
          sun.golden_evening_start,
          sun.golden_evening_end,
          condition
        );
        
        if (weatherMatch) {
          windows.push({
            start: sun.golden_evening_start,
            end: sun.golden_evening_end,
            score: weatherMatch.score,
            reason: `Evening golden hour - ${weatherMatch.reason}`,
          });
        }
      }
      
      if (isBlueMorning && sun.blue_morning_start && sun.blue_morning_end) {
        if (timeWindow === 'evening_only') continue;
        
        const weatherMatch = findBestWeatherInWindow(
          weatherSlots,
          sun.blue_morning_start,
          sun.blue_morning_end,
          condition
        );
        
        if (weatherMatch) {
          windows.push({
            start: sun.blue_morning_start,
            end: sun.blue_morning_end,
            score: weatherMatch.score,
            reason: `Morning blue hour - ${weatherMatch.reason}`,
          });
        }
      }
      
      if (isBlueEvening && sun.blue_evening_start && sun.blue_evening_end) {
        if (timeWindow === 'morning_only') continue;
        
        const weatherMatch = findBestWeatherInWindow(
          weatherSlots,
          sun.blue_evening_start,
          sun.blue_evening_end,
          condition
        );
        
        if (weatherMatch) {
          windows.push({
            start: sun.blue_evening_start,
            end: sun.blue_evening_end,
            score: weatherMatch.score,
            reason: `Evening blue hour - ${weatherMatch.reason}`,
          });
        }
      }
    }
  } else {
    // For weather-based conditions (overcast, fog, clear, etc.)
    // Group consecutive matching hours into windows
    let currentWindow: { start: string; slots: WeatherSlot[] } | null = null;
    
    for (const slot of weatherSlots) {
      const slotTime = new Date(slot.date_time);
      const hour = slotTime.getHours();
      const dayOfWeek = slotTime.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      // Check time_window constraints
      if (timeWindow === 'morning_only' && hour >= 12) continue;
      if (timeWindow === 'evening_only' && hour < 12) continue;
      if (timeWindow === 'weekend_only' && !isWeekend) continue;
      if (timeWindow === 'weekday_only' && isWeekend) continue;
      
      // Check if conditions match
      const match = conditionsMatch(
        {
          clouds: slot.clouds || 50,
          precip: slot.precip || 0,
          visibility: slot.visibility || 20,
          temp: slot.temp || 15,
        },
        condition
      );
      
      if (match.matches) {
        if (currentWindow) {
          currentWindow.slots.push(slot);
        } else {
          currentWindow = { start: slot.date_time, slots: [slot] };
        }
      } else {
        // End current window if exists
        if (currentWindow && currentWindow.slots.length > 0) {
          const lastSlot = currentWindow.slots[currentWindow.slots.length - 1];
          const avgScore = Math.round(
            currentWindow.slots.reduce((sum, s) => sum + (s.photoday_score || 50), 0) /
              currentWindow.slots.length
          );
          
          windows.push({
            start: currentWindow.start,
            end: new Date(new Date(lastSlot.date_time).getTime() + 3600000).toISOString(),
            score: avgScore,
            reason: `${currentWindow.slots.length}h window with ${condition} conditions`,
          });
        }
        currentWindow = null;
      }
    }
    
    // Don't forget last window
    if (currentWindow && currentWindow.slots.length > 0) {
      const lastSlot = currentWindow.slots[currentWindow.slots.length - 1];
      const avgScore = Math.round(
        currentWindow.slots.reduce((sum, s) => sum + (s.photoday_score || 50), 0) /
          currentWindow.slots.length
      );
      
      windows.push({
        start: currentWindow.start,
        end: new Date(new Date(lastSlot.date_time).getTime() + 3600000).toISOString(),
        score: avgScore,
        reason: `${currentWindow.slots.length}h window with ${condition} conditions`,
      });
    }
  }
  
  // Sort by score (descending), then by start time (ascending)
  return windows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });
}

/**
 * Find the best weather conditions within a time window
 */
function findBestWeatherInWindow(
  weatherSlots: WeatherSlot[],
  windowStart: string,
  windowEnd: string,
  condition: string
): { score: number; reason: string } | null {
  const start = new Date(windowStart).getTime();
  const end = new Date(windowEnd).getTime();
  
  // Find weather slots that overlap with this window
  const overlapping = weatherSlots.filter(slot => {
    const slotTime = new Date(slot.date_time).getTime();
    return slotTime >= start - 3600000 && slotTime <= end + 3600000;
  });
  
  if (overlapping.length === 0) {
    // No weather data, assume moderate conditions
    return { score: 60, reason: 'No weather data available' };
  }
  
  // Calculate average score and check conditions
  const avgScore = Math.round(
    overlapping.reduce((sum, s) => sum + (s.photoday_score || 50), 0) / overlapping.length
  );
  
  const avgClouds = Math.round(
    overlapping.reduce((sum, s) => sum + (s.clouds || 50), 0) / overlapping.length
  );
  
  const hasPrecip = overlapping.some(s => (s.precip || 0) > 0.5);
  
  // Build reason string
  let reason: string;
  if (hasPrecip) {
    reason = 'Precipitation expected';
  } else if (avgClouds < 30) {
    reason = 'Clear skies expected';
  } else if (avgClouds < 60) {
    reason = 'Partly cloudy';
  } else {
    reason = 'Mostly cloudy';
  }
  
  return { score: avgScore, reason };
}
