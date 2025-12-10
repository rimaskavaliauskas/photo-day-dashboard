import { Env, Task } from '../types';
import { parseLatLng } from '../lib/geo';

/**
 * Cron: tasks-sync
 * 
 * Runs every 15 minutes to:
 * 1. Fetch tasks from a published Google Sheets CSV
 * 2. Parse and upsert into tasks table
 * 
 * Expected CSV columns:
 * task_id, title, location, radius_km, condition, time_window, notes, active
 */
export async function runTasksSync(env: Env): Promise<void> {
  const sheetUrl = env.TASKS_SHEET_URL;
  
  if (!sheetUrl) {
    console.warn('TASKS_SHEET_URL not set, skipping tasks sync');
    return;
  }
  
  console.log('Fetching tasks from Google Sheets...');
  
  const response = await fetch(sheetUrl);
  
  if (!response.ok) {
    console.error('Failed to fetch tasks sheet:', response.status);
    return;
  }
  
  const csvText = await response.text();
  const rows = parseCSV(csvText);
  
  if (rows.length < 2) {
    console.log('No tasks found in sheet (only header or empty)');
    return;
  }
  
  // First row is header
  const headers = rows[0].map(h => h.toLowerCase().trim());
  const dataRows = rows.slice(1);
  
  // Find column indices
  const cols = {
    task_id: headers.indexOf('task_id'),
    title: headers.indexOf('title'),
    location: headers.indexOf('location'),
    radius_km: headers.indexOf('radius_km'),
    condition: headers.indexOf('condition'),
    time_window: headers.indexOf('time_window'),
    notes: headers.indexOf('notes'),
    active: headers.indexOf('active'),
  };
  
  // Validate required columns
  if (cols.task_id === -1 || cols.title === -1) {
    console.error('Missing required columns: task_id, title');
    return;
  }
  
  let syncedCount = 0;
  
  for (const row of dataRows) {
    const taskId = row[cols.task_id]?.trim();
    const title = row[cols.title]?.trim();
    
    if (!taskId || !title) {
      continue; // Skip rows without id or title
    }
    
    // Parse location - might be "lat,lng" or free text
    const locationRaw = cols.location !== -1 ? row[cols.location]?.trim() : null;
    const parsedCoords = locationRaw ? parseLatLng(locationRaw) : null;
    
    // Parse radius
    const radiusStr = cols.radius_km !== -1 ? row[cols.radius_km]?.trim() : null;
    const radiusKm = radiusStr ? parseFloat(radiusStr) : 10;
    
    // Other fields
    const condition = cols.condition !== -1 ? row[cols.condition]?.trim() || 'any' : 'any';
    const timeWindow = cols.time_window !== -1 ? row[cols.time_window]?.trim() || 'any_day' : 'any_day';
    const notes = cols.notes !== -1 ? row[cols.notes]?.trim() : null;
    
    // Parse active flag (default true)
    const activeStr = cols.active !== -1 ? row[cols.active]?.trim().toLowerCase() : 'true';
    const active = activeStr !== 'false' && activeStr !== '0' && activeStr !== 'no';
    
    // Upsert task
    await env.DB
      .prepare(`
        INSERT INTO tasks (task_id, title, location_raw, lat, lng, radius_km, condition, time_window, notes, active, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(task_id) DO UPDATE SET
          title = excluded.title,
          location_raw = excluded.location_raw,
          lat = excluded.lat,
          lng = excluded.lng,
          radius_km = excluded.radius_km,
          condition = excluded.condition,
          time_window = excluded.time_window,
          notes = excluded.notes,
          active = excluded.active,
          updated_at = datetime('now')
      `)
      .bind(
        taskId,
        title,
        locationRaw,
        parsedCoords ? parsedCoords[0] : null,
        parsedCoords ? parsedCoords[1] : null,
        radiusKm,
        condition,
        timeWindow,
        notes,
        active ? 1 : 0
      )
      .run();
    
    syncedCount++;
  }
  
  console.log(`Synced ${syncedCount} tasks from sheet`);
}

/**
 * Simple CSV parser
 * Handles quoted fields with commas inside
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // Check for escaped quote ("")
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    row.push(current); // Don't forget last field
    rows.push(row);
  }
  
  return rows;
}
