'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocation } from '@/lib/api';

interface LocationControlsProps {
  currentLocation: {
    lat: number;
    lng: number;
    source: string;
  };
}

export function LocationControls({ currentLocation }: LocationControlsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  // Get human-readable source label
  const sourceLabel = 
    currentLocation.source === 'browser' ? 'GPS' :
    currentLocation.source === 'manual' ? 'Manual' :
    currentLocation.source === 'ip' ? 'IP' :
    'Default';
  
  const handleUsePreciseLocation = async () => {
    setError(null);
    setIsLocating(true);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Send to backend
      await setLocation(latitude, longitude, 'browser');
      
      // Refresh the page to get new data
      startTransition(() => {
        router.refresh();
      });
      
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError('Location permission denied');
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Location unavailable');
            break;
          case err.TIMEOUT:
            setError('Location request timed out');
            break;
          default:
            setError('Failed to get location');
        }
      } else {
        setError('Failed to update location');
      }
    } finally {
      setIsLocating(false);
    }
  };
  
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
      {/* Current location display */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500">📍</span>
        <span className="text-zinc-400">
          {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
        </span>
        <span className="text-xs text-zinc-600 px-1.5 py-0.5 bg-zinc-800 rounded">
          {sourceLabel}
        </span>
      </div>
      
      {/* Controls */}
      <div className="flex items-center gap-3">
        {error && (
          <span className="text-xs text-red-400">{error}</span>
        )}
        
        <button
          onClick={handleUsePreciseLocation}
          disabled={isLocating || isPending}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg transition-colors flex items-center gap-2"
        >
          {isLocating || isPending ? (
            <>
              <LoadingSpinner />
              <span>Locating...</span>
            </>
          ) : (
            <>
              <span>🎯</span>
              <span>Use Precise Location</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg 
      className="animate-spin h-4 w-4" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
