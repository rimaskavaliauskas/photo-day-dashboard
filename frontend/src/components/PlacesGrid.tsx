'use client';

import Image from 'next/image';
import { PlaceWithDistance, formatDistance } from '@/lib/api';

interface PlacesGridProps {
  places: PlaceWithDistance[];
}

export function PlacesGrid({ places }: PlacesGridProps) {
  if (places.length === 0) {
    return (
      <div className="card p-8 text-center text-zinc-500">
        <p>No places found nearby. Try expanding your search radius.</p>
      </div>
    );
  }
  
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {places.slice(0, 8).map((place) => (
        <PlaceCard key={place.place_id} place={place} />
      ))}
    </div>
  );
}

function PlaceCard({ place }: { place: PlaceWithDistance }) {
  // Parse types from JSON string
  let types: string[] = [];
  try {
    types = place.types ? JSON.parse(place.types) : [];
  } catch {
    types = [];
  }
  
  // Get primary type for display
  const primaryType = types[0]?.replace(/_/g, ' ') || 'Location';
  
  return (
    <div className="card group hover:border-zinc-700 transition-colors">
      {/* Image */}
      <div className="aspect-[4/3] bg-zinc-800 relative overflow-hidden">
        {place.photo_url ? (
          <Image
            src={place.photo_url}
            alt={place.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🏞️
          </div>
        )}
        
        {/* Distance badge */}
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-xs">
          {formatDistance(place.distance_km)}
        </div>
      </div>
      
      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-sm truncate" title={place.name}>
          {place.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-zinc-500 capitalize">
            {primaryType}
          </span>
          {place.rating && (
            <span className="text-xs text-yellow-500 flex items-center gap-1">
              ⭐ {place.rating.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
