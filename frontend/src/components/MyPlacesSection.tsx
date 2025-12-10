'use client';

import { useState } from 'react';
import {
    MyPlaceWithData,
    PlaceForecast,
    formatTime,
    formatTimeRange,
    formatDate,
    checkNow,
    syncFromSheet
} from '@/lib/api';

interface Props {
    places: MyPlaceWithData[];
    onRefresh: () => void;
}

export function MyPlacesSection({ places, onRefresh }: Props) {
    const [syncing, setSyncing] = useState(false);
    const [checkingId, setCheckingId] = useState<number | null>(null);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const result = await syncFromSheet();
            alert(`Synced ${result.synced} places from Google Sheet`);
            onRefresh();
        } catch (error) {
            console.error('Sync error:', error);
            alert('Failed to sync from Google Sheet');
        } finally {
            setSyncing(false);
        }
    };

    const handleCheckNow = async (placeId: number) => {
        setCheckingId(placeId);
        try {
            await checkNow(placeId);
            onRefresh();
        } catch (error) {
            console.error('Check now error:', error);
            alert('Failed to check weather');
        } finally {
            setCheckingId(null);
        }
    };

    return (
        <div className="my-places-section">
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

            {places.length === 0 ? (
                <div className="empty-state">
                    <p>No locations yet. Add places to your Google Sheet or pin discovered places.</p>
                    <p className="text-sm text-zinc-500">
                        Sheet format: name, lat, lng, notes
                    </p>
                </div>
            ) : (
                <div className="places-grid">
                    {places.map(({ place, forecasts }) => (
                        <PlaceCard
                            key={place.id}
                            place={place}
                            forecasts={forecasts}
                            isChecking={checkingId === place.id}
                            onCheckNow={() => handleCheckNow(place.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

interface PlaceCardProps {
    place: MyPlaceWithData['place'];
    forecasts: PlaceForecast[];
    isChecking: boolean;
    onCheckNow: () => void;
}

function PlaceCard({ place, forecasts, isChecking, onCheckNow }: PlaceCardProps) {
    return (
        <div className="place-card">
            <div className="place-header">
                <h3 className="place-name">{place.name}</h3>
                <button
                    className="btn-check-now"
                    onClick={onCheckNow}
                    disabled={isChecking}
                >
                    {isChecking ? '⏳' : '🔍 Check Now'}
                </button>
            </div>

            <p className="place-coords">
                📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            </p>

            {place.notes && (
                <p className="place-notes">{place.notes}</p>
            )}

            {place.pinned_from && (
                <span className="badge-pinned">📌 Pinned</span>
            )}

            {forecasts.length > 0 ? (
                <div className="forecasts">
                    <h4>Next 3 Days</h4>
                    {forecasts.map((forecast) => (
                        <ForecastRow key={forecast.date} forecast={forecast} />
                    ))}
                </div>
            ) : (
                <p className="no-forecast">Click "Check Now" to get forecast</p>
            )}
        </div>
    );
}

function ForecastRow({ forecast }: { forecast: PlaceForecast }) {
    const morningIcon = forecast.sky_open_morning ? '☀️' : '☁️';
    const eveningIcon = forecast.sky_open_evening ? '☀️' : '☁️';

    return (
        <div className="forecast-row">
            <div className="forecast-date">{formatDate(forecast.date)}</div>

            <div className="forecast-times">
                <div className="golden-hour">
                    <span className="label">🌅 Golden AM:</span>
                    <span className="time">
                        {formatTimeRange(forecast.golden_morning_start, forecast.golden_morning_end)}
                    </span>
                    <span className="sky-status">{morningIcon}</span>
                </div>

                <div className="golden-hour">
                    <span className="label">🌇 Golden PM:</span>
                    <span className="time">
                        {formatTimeRange(forecast.golden_evening_start, forecast.golden_evening_end)}
                    </span>
                    <span className="sky-status">{eveningIcon}</span>
                </div>

                <div className="blue-hour">
                    <span className="label">🌌 Blue AM:</span>
                    <span className="time">
                        {formatTimeRange(forecast.blue_morning_start, forecast.blue_morning_end)}
                    </span>
                </div>

                <div className="blue-hour">
                    <span className="label">🌃 Blue PM:</span>
                    <span className="time">
                        {formatTimeRange(forecast.blue_evening_start, forecast.blue_evening_end)}
                    </span>
                </div>
            </div>

            <div className="clouds-info">
                <span>AM: {forecast.morning_clouds ?? '--'}% clouds</span>
                <span>PM: {forecast.evening_clouds ?? '--'}% clouds</span>
            </div>
        </div>
    );
}
