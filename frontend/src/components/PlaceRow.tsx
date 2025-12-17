'use client';

import Image from 'next/image';
import { useState, useCallback } from 'react';
import {
    MyPlaceWithData,
    PlaceForecast,
    DiscoveredPlace,
    pinPlace,
    formatTimeRange,
    formatDate,
} from '@/lib/api';

interface Props {
    placeData: MyPlaceWithData;
    onCheckNow: (placeId: number) => void;
    isChecking: boolean;
    onDelete: () => void;
    isDeleting: boolean;
    onPinned: () => void;
}

export function PlaceRow({ placeData, onCheckNow, isChecking, onDelete, isDeleting, onPinned }: Props) {
    const { place, forecasts, nearby } = placeData;

    // Photos for main grid/lightbox (from nearby with photo)
    const photos = nearby.filter(p => p.photo_url);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [pinningId, setPinningId] = useState<number | null>(null);

    const openLightbox = useCallback((idx: number) => setLightboxIndex(idx), []);
    const closeLightbox = useCallback(() => setLightboxIndex(null), []);
    const nextPhoto = useCallback(() => {
        if (lightboxIndex === null || photos.length === 0) return;
        setLightboxIndex((lightboxIndex + 1) % photos.length);
    }, [lightboxIndex, photos.length]);
    const prevPhoto = useCallback(() => {
        if (lightboxIndex === null || photos.length === 0) return;
        setLightboxIndex((lightboxIndex - 1 + photos.length) % photos.length);
    }, [lightboxIndex, photos.length]);

    const handlePin = async (discoveredId?: number) => {
        if (!discoveredId) {
            console.error('Pin error: missing discoveredId');
            alert('Cannot pin this place (missing id)');
            return;
        }
        setPinningId(discoveredId);
        try {
            const result = await pinPlace(discoveredId);
            if (result.success) {
                onPinned();
            }
        } catch (error) {
            console.error('Pin error:', error);
            alert('Failed to pin place');
        } finally {
            setPinningId(null);
        }
    };

    const topDiscovered = nearby.slice(0, 4);
    const lightboxPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

    return (
        <div className="place-row">
            {/* Place Header */}
            <div className="place-row-header">
                <div className="place-row-title">
                    <h3>{place.name}</h3>
                    <span className="place-row-coords">
                        📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                    </span>
                    {place.notes && (
                        <span className="place-row-notes">{place.notes}</span>
                    )}
                    {place.pinned_from && (
                        <span className="badge-pinned-small">📌 Pinned</span>
                    )}
                </div>
                <div className="place-row-actions">
                    <button
                        className="btn-check-now-small"
                        onClick={() => onCheckNow(place.id)}
                        disabled={isChecking}
                    >
                        {isChecking ? '⏳' : '🔍 Check Weather'}
                    </button>
                    <button
                        className="btn-delete-small"
                        onClick={onDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? '⏳' : '🗑️ Remove'}
                    </button>
                </div>
            </div>

            {/* Main Content: Weather on Left, Photos on Right */}
            <div className="place-row-content">
                {/* Weather Forecast Widget (Left) */}
                <div className="place-row-weather">
                    <h4 className="weather-widget-title">🌤️ Weather Forecast</h4>
                    {forecasts.length > 0 ? (
                        <div className="weather-days">
                            {forecasts.slice(0, 3).map((forecast) => (
                                <ForecastDay key={forecast.date} forecast={forecast} />
                            ))}
                        </div>
                    ) : (
                        <div className="weather-empty">
                            <p>Click "Check Weather" to get forecast</p>
                        </div>
                    )}
                </div>

                {/* Photos Grid (Right) */}
                <div className="place-row-photos">
                    <h4 className="photos-widget-title">📸 Nearby Photos</h4>
                    {photos.length > 0 ? (
                        <div className="photos-grid-4">
                            {photos.slice(0, 4).map((photo, idx) => (
                                <PhotoCard
                                    key={photo.id}
                                    place={photo}
                                    onClick={() => openLightbox(idx)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="photos-empty">
                            <div className="photos-empty-icon">🏞️</div>
                            <p>No photos available yet</p>
                        </div>
                    )}
                </div>
            </div>

            {topDiscovered.length > 0 && (
                <div className="place-row-discovered">
                    <div className="place-row-discovered-header">
                        <h4 className="discovered-inline-title">🔍 Discovered nearby (top 4)</h4>
                        <span className="discovered-inline-sub">Click to pin into your Sheet</span>
                    </div>
                    <div className="discovered-inline-grid">
                        {topDiscovered.map((d) => (
                            <div key={d.id} className="discovered-inline-card">
                                <div className="discovered-inline-image">
                                    {d.photo_url ? (
                                        <Image
                                            src={d.photo_url}
                                            alt={d.name}
                                            fill
                                            className="object-cover"
                                            sizes="150px"
                                        />
                                    ) : (
                                        <div className="discovered-inline-placeholder">🏞️</div>
                                    )}
                                </div>
                                <div className="discovered-inline-content">
                                    <div className="discovered-inline-name" title={d.name}>{d.name}</div>
                                    <div className="discovered-inline-meta">
                                        {d.rating && <span>⭐ {d.rating.toFixed(1)}</span>}
                                        {d.distance_km !== null && d.distance_km !== undefined && (
                                            <span>📏 {d.distance_km.toFixed(1)} km</span>
                                        )}
                                    </div>
                                    <button
                                        className="btn-pin-inline"
                                        onClick={() => handlePin(d.id)}
                                        disabled={!d.id || pinningId === d.id || d.is_pinned === 1}
                                    >
                                        {d.is_pinned === 1 ? '✅ Pinned' : pinningId === d.id ? '⏳ Pinning...' : '📌 Pin to Sheet'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {lightboxPhoto && (
                <div className="lightbox-backdrop" onClick={closeLightbox}>
                    <div className="lightbox" onClick={(e) => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">✕</button>
                        <div className="lightbox-image-wrapper">
                            <Image
                                src={lightboxPhoto.photo_url!}
                                alt={lightboxPhoto.name}
                                fill
                                className="object-contain"
                                sizes="90vw"
                                priority
                            />
                        </div>
                        <div className="lightbox-meta">
                            <div className="lightbox-title">{lightboxPhoto.name}</div>
                            {lightboxPhoto.rating && (
                                <div className="lightbox-rating">⭐ {lightboxPhoto.rating.toFixed(1)}</div>
                            )}
                            {lightboxPhoto.types && (
                                <div className="lightbox-types">
                                    {(() => {
                                        try {
                                            const parsed = JSON.parse(lightboxPhoto.types) as string[];
                                            return parsed.slice(0, 3).join(', ');
                                        } catch {
                                            return null;
                                        }
                                    })()}
                                </div>
                            )}
                            {lightboxPhoto.distance_km !== null && lightboxPhoto.distance_km !== undefined && (
                                <div className="lightbox-distance">📏 {lightboxPhoto.distance_km.toFixed(1)} km</div>
                            )}
                            <button
                                className="btn-pin-inline"
                                onClick={() => handlePin(lightboxPhoto.id)}
                                disabled={!lightboxPhoto.id || pinningId === lightboxPhoto.id || lightboxPhoto.is_pinned === 1}
                            >
                                {lightboxPhoto.is_pinned === 1 ? '✅ Pinned' : pinningId === lightboxPhoto.id ? '⏳ Pinning...' : '📌 Pin to Sheet'}
                            </button>
                        </div>
                        {photos.length > 1 && (
                            <div className="lightbox-controls">
                                <button onClick={prevPhoto} aria-label="Previous photo">◀</button>
                                <span className="lightbox-counter">{lightboxIndex! + 1} / {photos.length}</span>
                                <button onClick={nextPhoto} aria-label="Next photo">▶</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function ForecastDay({ forecast }: { forecast: PlaceForecast }) {
    const morningIcon = forecast.sky_open_morning ? '☀️' : '☁️';
    const eveningIcon = forecast.sky_open_evening ? '☀️' : '☁️';

    return (
        <div className="forecast-day-card">
            <div className="forecast-day-date">{formatDate(forecast.date)}</div>
            
            <div className="forecast-day-grid">
                {/* Golden Hours */}
                <div className="forecast-hour-block golden">
                    <div className="hour-label">🌅 Golden AM</div>
                    <div className="hour-time">
                        {formatTimeRange(forecast.golden_morning_start, forecast.golden_morning_end)}
                    </div>
                    <div className="hour-sky">{morningIcon} {forecast.morning_clouds ?? '--'}%</div>
                </div>

                <div className="forecast-hour-block golden">
                    <div className="hour-label">🌇 Golden PM</div>
                    <div className="hour-time">
                        {formatTimeRange(forecast.golden_evening_start, forecast.golden_evening_end)}
                    </div>
                    <div className="hour-sky">{eveningIcon} {forecast.evening_clouds ?? '--'}%</div>
                </div>

                {/* Blue Hours */}
                <div className="forecast-hour-block blue">
                    <div className="hour-label">🌌 Blue AM</div>
                    <div className="hour-time">
                        {formatTimeRange(forecast.blue_morning_start, forecast.blue_morning_end)}
                    </div>
                </div>

                <div className="forecast-hour-block blue">
                    <div className="hour-label">🌃 Blue PM</div>
                    <div className="hour-time">
                        {formatTimeRange(forecast.blue_evening_start, forecast.blue_evening_end)}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PhotoCard({ place, onClick }: { place: DiscoveredPlace; onClick: () => void }) {
    return (
        <button className="photo-card" onClick={onClick} aria-label={`Open photo of ${place.name}`}>
            <div className="photo-card-image">
                {place.photo_url && (
                    <Image
                        src={place.photo_url}
                        alt={place.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, 150px"
                    />
                )}
            </div>
            <div className="photo-card-overlay">
                <span className="photo-card-name">{place.name}</span>
                {place.rating && (
                    <span className="photo-card-rating">⭐ {place.rating.toFixed(1)}</span>
                )}
            </div>
        </button>
    );
}

