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
import { ChatPanel } from './ChatPanel';
import { GoldenHourTimeline } from './GoldenHourTimeline';
import { ConditionsGauge } from './ConditionsGauge';

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
    const [chatOpen, setChatOpen] = useState(false);

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
                        className="btn-ask-ai-small"
                        onClick={() => setChatOpen(true)}
                        title="Ask AI about this place"
                    >
                        ⚡ Ask AI
                    </button>
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
                        <>
                            {/* Golden Hour Timeline */}
                            <div className="weather-timeline-wrapper">
                                <GoldenHourTimeline forecasts={forecasts} showDays={3} />
                            </div>

                            {/* Conditions Gauge for today */}
                            {forecasts[0] && (
                                <div className="weather-gauge-wrapper">
                                    <ConditionsGauge
                                        clouds={(forecasts[0].morning_clouds ?? 0 + (forecasts[0].evening_clouds ?? 0)) / 2}
                                        visibility={null}
                                        precipitation={null}
                                        score={Math.round(100 - ((forecasts[0].morning_clouds ?? 50) + (forecasts[0].evening_clouds ?? 50)) / 2)}
                                    />
                                </div>
                            )}

                            {/* Day-by-day forecast cards */}
                            <div className="weather-days">
                                {forecasts.slice(0, 3).map((forecast) => (
                                    <ForecastDay key={forecast.date} forecast={forecast} />
                                ))}
                            </div>
                        </>
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

            {/* AI Chat Panel for this place */}
            <ChatPanel
                isOpen={chatOpen}
                onClose={() => setChatOpen(false)}
                placeId={place.id}
                placeName={place.name}
            />
        </div>
    );
}

function ForecastDay({ forecast }: { forecast: PlaceForecast }) {
    // Calculate overall score based on cloud coverage (lower is better)
    const morningClouds = forecast.morning_clouds ?? 50;
    const eveningClouds = forecast.evening_clouds ?? 50;
    const avgClouds = (morningClouds + eveningClouds) / 2;
    const score = Math.max(0, Math.round(100 - avgClouds));

    const getScoreColor = (s: number) => {
        if (s >= 70) return '#22c55e';
        if (s >= 50) return '#eab308';
        return '#ef4444';
    };

    const getScoreLabel = (s: number) => {
        if (s >= 80) return 'Excellent';
        if (s >= 70) return 'Great';
        if (s >= 50) return 'Good';
        if (s >= 30) return 'Fair';
        return 'Poor';
    };

    const formatTimeOnly = (isoString: string | null): string => {
        if (!isoString) return '--:--';
        const date = new Date(isoString);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    return (
        <div className="forecast-day-card enhanced">
            {/* Header with date and score */}
            <div className="forecast-day-header">
                <div className="forecast-day-date">{formatDate(forecast.date)}</div>
                <div
                    className="forecast-day-score"
                    style={{ backgroundColor: getScoreColor(score) }}
                    title={`Photo conditions: ${getScoreLabel(score)}`}
                >
                    {score}
                </div>
            </div>

            {/* Sunrise/Sunset bar */}
            <div className="forecast-sun-times">
                <div className="sun-time sunrise">
                    <span className="sun-icon">☀️</span>
                    <span className="sun-label">Rise</span>
                    <span className="sun-value">{formatTimeOnly(forecast.sunrise)}</span>
                </div>
                <div className="sun-divider"></div>
                <div className="sun-time sunset">
                    <span className="sun-icon">🌅</span>
                    <span className="sun-label">Set</span>
                    <span className="sun-value">{formatTimeOnly(forecast.sunset)}</span>
                </div>
            </div>

            {/* Morning Section */}
            <div className="forecast-period-section">
                <div className="period-header morning">
                    <span className="period-title">Morning</span>
                    <div className="cloud-indicator">
                        <div
                            className="cloud-bar"
                            style={{
                                width: `${100 - morningClouds}%`,
                                backgroundColor: morningClouds <= 30 ? '#22c55e' : morningClouds <= 60 ? '#eab308' : '#ef4444'
                            }}
                        />
                    </div>
                    <span className="cloud-percent">{100 - morningClouds}% clear</span>
                </div>
                <div className="period-times">
                    <div className="time-block golden">
                        <span className="time-icon">🌅</span>
                        <span className="time-label">Golden</span>
                        <span className="time-value">{formatTimeRange(forecast.golden_morning_start, forecast.golden_morning_end)}</span>
                    </div>
                    <div className="time-block blue">
                        <span className="time-icon">🌌</span>
                        <span className="time-label">Blue</span>
                        <span className="time-value">{formatTimeRange(forecast.blue_morning_start, forecast.blue_morning_end)}</span>
                    </div>
                </div>
            </div>

            {/* Evening Section */}
            <div className="forecast-period-section">
                <div className="period-header evening">
                    <span className="period-title">Evening</span>
                    <div className="cloud-indicator">
                        <div
                            className="cloud-bar"
                            style={{
                                width: `${100 - eveningClouds}%`,
                                backgroundColor: eveningClouds <= 30 ? '#22c55e' : eveningClouds <= 60 ? '#eab308' : '#ef4444'
                            }}
                        />
                    </div>
                    <span className="cloud-percent">{100 - eveningClouds}% clear</span>
                </div>
                <div className="period-times">
                    <div className="time-block golden">
                        <span className="time-icon">🌇</span>
                        <span className="time-label">Golden</span>
                        <span className="time-value">{formatTimeRange(forecast.golden_evening_start, forecast.golden_evening_end)}</span>
                    </div>
                    <div className="time-block blue">
                        <span className="time-icon">🌃</span>
                        <span className="time-label">Blue</span>
                        <span className="time-value">{formatTimeRange(forecast.blue_evening_start, forecast.blue_evening_end)}</span>
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

