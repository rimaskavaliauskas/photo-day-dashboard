'use client';

import { useState } from 'react';
import { DiscoveredPlace, pinPlace, formatDistance } from '@/lib/api';

interface Props {
    places: DiscoveredPlace[];
    onPinned: () => void;
}

export function DiscoveredPlaces({ places, onPinned }: Props) {
    const [pinningId, setPinningId] = useState<number | null>(null);

    const handlePin = async (discoveredId: number) => {
        setPinningId(discoveredId);
        try {
            const result = await pinPlace(discoveredId);
            if (result.success) {
                alert('Place pinned and added to your Google Sheet!');
                onPinned();
            }
        } catch (error) {
            console.error('Pin error:', error);
            alert('Failed to pin place');
        } finally {
            setPinningId(null);
        }
    };

    if (places.length === 0) {
        return null;
    }

    return (
        <div className="discovered-section">
            <h3 className="section-subtitle">🔍 Discovered Nearby</h3>
            <p className="section-desc">
                Interesting photo locations found near this place. Click 📌 to save to your Google Sheet.
            </p>

            <div className="discovered-grid">
                {places.map((place) => (
                    <DiscoveredCard
                        key={place.id}
                        place={place}
                        isPinning={pinningId === place.id}
                        onPin={() => handlePin(place.id)}
                    />
                ))}
            </div>
        </div>
    );
}

interface CardProps {
    place: DiscoveredPlace;
    isPinning: boolean;
    onPin: () => void;
}

function DiscoveredCard({ place, isPinning, onPin }: CardProps) {
    const types = place.types ? JSON.parse(place.types).slice(0, 2).join(', ') : '';

    return (
        <div className={`discovered-card ${place.is_pinned ? 'pinned' : ''}`}>
            {place.photo_url && (
                <div className="card-image">
                    <img src={place.photo_url} alt={place.name} />
                </div>
            )}

            <div className="card-content">
                <h4 className="card-title">{place.name}</h4>

                <div className="card-meta">
                    {place.rating && (
                        <span className="rating">⭐ {place.rating.toFixed(1)}</span>
                    )}
                    {place.distance_km && (
                        <span className="distance">📏 {formatDistance(place.distance_km)}</span>
                    )}
                </div>

                {types && <p className="card-types">{types}</p>}

                <button
                    className={`btn-pin ${place.is_pinned ? 'pinned' : ''}`}
                    onClick={onPin}
                    disabled={isPinning || place.is_pinned === 1}
                >
                    {place.is_pinned ? '✅ Pinned' : isPinning ? '⏳ Pinning...' : '📌 Pin to Sheet'}
                </button>
            </div>
        </div>
    );
}
