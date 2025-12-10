'use client';

import { useState, useCallback } from 'react';
import { MyPlaceWithData, YouTubeVideo, fetchMyPlaces } from '@/lib/api';
import { MyPlacesSection } from './MyPlacesSection';
import { DiscoveredPlaces } from './DiscoveredPlaces';
import { VideosGrid } from './VideosGrid';

interface Props {
    initialPlaces: MyPlaceWithData[];
    initialVideos: YouTubeVideo[];
}

export function MyPlacesPage({ initialPlaces, initialVideos }: Props) {
    const [places, setPlaces] = useState(initialPlaces);
    const [videos] = useState(initialVideos);

    const handleRefresh = useCallback(async () => {
        try {
            const refreshedPlaces = await fetchMyPlaces();
            setPlaces(refreshedPlaces);
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }, []);

    // Get all discovered places from all user places
    const allDiscoveredPlaces = places.flatMap(p => p.nearby);

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>📷 Photo Day Dashboard</h1>
                <p className="subtitle">Plan your perfect photo sessions</p>
            </header>

            {/* My Photo Locations */}
            <section className="section">
                <MyPlacesSection
                    places={places}
                    onRefresh={handleRefresh}
                />
            </section>

            {/* Discovered Places (if any) */}
            {allDiscoveredPlaces.length > 0 && (
                <section className="section">
                    <h2 className="section-title">🔍 Discovered Photo Spots</h2>
                    <p className="section-desc">
                        Interesting locations found near your places. Pin them to add to your Google Sheet!
                    </p>
                    <DiscoveredPlaces
                        places={allDiscoveredPlaces}
                        onPinned={handleRefresh}
                    />
                </section>
            )}

            {/* YouTube Videos */}
            {videos.length > 0 && (
                <section className="section">
                    <h2 className="section-title">🎬 Latest from Photography Channels</h2>
                    <VideosGrid videos={videos} />
                </section>
            )}

            {/* Empty state */}
            {places.length === 0 && videos.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">📍</div>
                    <h2>Get Started</h2>
                    <p>Add photo locations to your Google Sheet or click "Sync from Sheet" to begin.</p>
                    <p className="text-sm">
                        Sheet format: <code>name, lat, lng, notes</code>
                    </p>
                </div>
            )}
        </div>
    );
}
