'use client';

import { useState, useCallback } from 'react';
import { 
    MyPlaceWithData, 
    YouTubeVideo, 
    PlaceWithDistance,
    fetchMyPlaces, 
    syncFromSheet,
    checkNow,
    deleteMyPlace 
} from '@/lib/api';
import { PlaceRow } from './PlaceRow';
import { DiscoveredPlaces } from './DiscoveredPlaces';
import { VideosGrid } from './VideosGrid';
import { PlacesGrid } from './PlacesGrid';

interface Props {
    initialPlaces: MyPlaceWithData[];
    initialVideos: YouTubeVideo[];
    nearbyPlaces?: PlaceWithDistance[];
    currentLocation?: { lat: number; lng: number; source: string };
}

export function MyPlacesPage({ 
    initialPlaces, 
    initialVideos, 
    nearbyPlaces = [],
    currentLocation 
}: Props) {
    const [places, setPlaces] = useState(initialPlaces);
    const [videos] = useState(initialVideos);
    const [syncing, setSyncing] = useState(false);
    const [checkingId, setCheckingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleRefresh = useCallback(async () => {
        try {
            const refreshedPlaces = await fetchMyPlaces();
            setPlaces(refreshedPlaces);
        } catch (error) {
            console.error('Refresh error:', error);
        }
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncFromSheet();
            alert(`Synced ${result.synced} places from Google Sheet. Deleted ${'deleted' in result ? (result as any).deleted : 0}.`);
            handleRefresh();
        } catch (error) {
            console.error('Sync error:', error);
            alert('Failed to sync from Google Sheet');
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (placeId: number) => {
        setDeletingId(placeId);
        try {
            await deleteMyPlace(placeId);
            handleRefresh();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Failed to delete place');
        } finally {
            setDeletingId(null);
        }
    };

    const handleCheckNow = async (placeId: number) => {
        setCheckingId(placeId);
        try {
            await checkNow(placeId);
            handleRefresh();
        } catch (error) {
            console.error('Check now error:', error);
            alert('Failed to check weather');
        } finally {
            setCheckingId(null);
        }
    };

    // Filter: Only show places from Google Sheet (have sheet_row defined)
    const sheetPlaces = places.filter(p => p.place.sheet_row !== undefined && p.place.sheet_row !== null);
    
    // Get all discovered places from all user places
    const allDiscoveredPlaces = places.flatMap(p => p.nearby);

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>📷 Photo Day Dashboard</h1>
                <p className="subtitle">Plan your perfect photo sessions</p>
            </header>

            {/* ================================================================
                SECTION A: My Photo Locations (from Google Sheet only)
                Row-by-row layout: Weather (left) + Photos (right)
                ================================================================ */}
            <section className="section">
                <div className="section-header">
                    <h2 className="section-title">📍 My Photo Locations</h2>
                    <button
                        className="btn-sync"
                        onClick={handleSync}
                        disabled={syncing}
                    >
                        {syncing ? '⏳ Syncing...' : '🔄 Sync from Sheet'}
                    </button>
                </div>

                {sheetPlaces.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📍</div>
                        <h2>No Places Yet</h2>
                        <p>Add photo locations to your Google Sheet and click "Sync from Sheet".</p>
                        <p className="text-sm text-zinc-500">
                            Sheet format: <code>name, lat, lng, notes</code>
                        </p>
                    </div>
                ) : (
                    <div className="places-rows">
                        {sheetPlaces.map((placeData) => (
                            <PlaceRow
                                key={placeData.place.id}
                                placeData={placeData}
                                onCheckNow={handleCheckNow}
                                isChecking={checkingId === placeData.place.id}
                                onDelete={() => handleDelete(placeData.place.id)}
                                isDeleting={deletingId === placeData.place.id}
                                onPinned={handleRefresh}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* ================================================================
                SECTION B: Photos Around My Location
                Shows places discovered via Google Places around current location
                ================================================================ */}
            {nearbyPlaces.length > 0 && (
                <section className="section">
                    <div className="nearby-header">
                        <h2 className="section-title">📸 Photos Around My Location</h2>
                        {currentLocation && (
                            <div className="nearby-coords">
                                <code>{currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}</code>
                                <span className="ml-2 text-xs">({currentLocation.source})</span>
                            </div>
                        )}
                    </div>
                    <p className="section-desc">
                        Best-rated photo locations around your current position.
                    </p>
                    <PlacesGrid places={nearbyPlaces} />
                </section>
            )}

            {/* ================================================================
                SECTION B2: Discovered Photo Spots (Pin to Sheet feature)
                Shows places that can be pinned to Google Sheet
                ================================================================ */}
            {allDiscoveredPlaces.length > 0 && (
                <section className="section">
                    <h2 className="section-title">🔍 Discovered Photo Spots</h2>
                    <p className="section-desc">
                        Interesting locations found near your places. Click "📌 Pin to Sheet" to save 
                        to your Google Sheet - they'll appear in My Photo Locations after syncing!
                    </p>
                    <DiscoveredPlaces
                        places={allDiscoveredPlaces}
                        onPinned={handleRefresh}
                    />
                </section>
            )}

            {/* ================================================================
                SECTION C: YouTube Videos
                Latest from configured photography channels
                ================================================================ */}
            {videos.length > 0 && (
                <section className="section">
                    <h2 className="section-title">🎬 YouTube Photography Highlights</h2>
                    <p className="section-desc">
                        Latest videos from your subscribed photography channels.
                    </p>
                    <VideosGrid videos={videos} />
                </section>
            )}

            {/* Global empty state */}
            {sheetPlaces.length === 0 && videos.length === 0 && nearbyPlaces.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">🌅</div>
                    <h2>Welcome to Photo Day Dashboard</h2>
                    <p>Get started by adding places to your Google Sheet or configure your APIs.</p>
                    <p className="text-sm text-zinc-500 mt-2">
                        Sheet format: <code>name, lat, lng, notes</code>
                    </p>
                </div>
            )}
        </div>
    );
}
