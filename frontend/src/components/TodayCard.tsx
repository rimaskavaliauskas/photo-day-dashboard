'use client';

import { SunWindow, WeatherSlot, formatTime, formatTimeRange, getScoreClass } from '@/lib/api';

interface TodayCardProps {
  sunWindow: SunWindow | null;
  weather: {
    current: WeatherSlot | null;
    hourly: WeatherSlot[];
    photoDayScore: number;
  };
}

export function TodayCard({ sunWindow, weather }: TodayCardProps) {
  const score = weather.photoDayScore;
  const scoreClass = getScoreClass(score);
  
  // Determine which golden hour is next
  const now = new Date();
  const morningEnd = sunWindow?.golden_morning_end 
    ? new Date(sunWindow.golden_morning_end) 
    : null;
  const eveningStart = sunWindow?.golden_evening_start 
    ? new Date(sunWindow.golden_evening_start) 
    : null;
  
  const isMorningPast = morningEnd ? now > morningEnd : true;
  const isEveningPast = eveningStart 
    ? now > new Date(sunWindow?.golden_evening_end || '') 
    : true;
  
  // Build conditions description
  const current = weather.current;
  let conditionsText = 'No weather data';
  
  if (current) {
    const parts: string[] = [];
    
    if (current.clouds !== null) {
      if (current.clouds < 20) parts.push('Clear skies');
      else if (current.clouds < 40) parts.push('Few clouds');
      else if (current.clouds < 70) parts.push('Partly cloudy');
      else parts.push('Overcast');
    }
    
    if (current.temp !== null) {
      parts.push(`${Math.round(current.temp)}°C`);
    }
    
    if (current.precip !== null && current.precip > 0) {
      parts.push('Rain expected');
    }
    
    conditionsText = parts.join(' • ');
  }
  
  return (
    <div className="card">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6">
        {/* Left: Main info */}
        <div className="space-y-6">
          {/* Score + Conditions */}
          <div className="flex items-start gap-4">
            <div className={`score-badge ${scoreClass}`}>
              {score}
            </div>
            <div>
              <h3 className="font-medium text-lg">Photo Day Score</h3>
              <p className="text-zinc-400 text-sm">{conditionsText}</p>
            </div>
          </div>
          
          {/* Golden Hours */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Morning Golden Hour */}
            <div className={`p-4 rounded-lg bg-gradient-to-br from-orange-950/50 to-yellow-950/30 border border-orange-900/30 ${isMorningPast ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 text-orange-400 mb-2">
                <span>🌅</span>
                <span className="text-sm font-medium">Morning Golden Hour</span>
                {isMorningPast && <span className="text-xs text-zinc-500">(passed)</span>}
              </div>
              <div className="text-lg font-semibold text-orange-200">
                {formatTimeRange(sunWindow?.golden_morning_start || null, sunWindow?.golden_morning_end || null)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Sunrise: {formatTime(sunWindow?.sunrise || null)}
              </div>
            </div>
            
            {/* Evening Golden Hour */}
            <div className={`p-4 rounded-lg bg-gradient-to-br from-amber-950/50 to-red-950/30 border border-amber-900/30 ${isEveningPast ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 text-amber-400 mb-2">
                <span>🌇</span>
                <span className="text-sm font-medium">Evening Golden Hour</span>
              </div>
              <div className="text-lg font-semibold text-amber-200">
                {formatTimeRange(sunWindow?.golden_evening_start || null, sunWindow?.golden_evening_end || null)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Sunset: {formatTime(sunWindow?.sunset || null)}
              </div>
            </div>
          </div>
        </div>
        
        {/* Right: Mini hourly forecast */}
        <div className="md:w-48">
          <h4 className="text-sm font-medium text-zinc-500 mb-3">Next 6 Hours</h4>
          <div className="space-y-2">
            {weather.hourly.slice(0, 6).map((slot) => {
              const time = new Date(slot.date_time);
              const hourScore = slot.photoday_score || 50;
              
              return (
                <div 
                  key={slot.id} 
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-zinc-500 w-12">
                    {time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })}
                  </span>
                  <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        hourScore >= 70 ? 'bg-green-500' : 
                        hourScore >= 50 ? 'bg-yellow-500' : 
                        'bg-red-500'
                      }`}
                      style={{ width: `${hourScore}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-600 w-8">{hourScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
