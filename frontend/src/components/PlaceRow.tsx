'use client';

import Image from 'next/image';
import {
    MyPlaceWithData,
    PlaceForecast,
    DiscoveredPlace,
    formatTimeRange,
    formatDate,
} from '@/lib/api';

interface Props {
    placeData: MyPlaceWithData;
    onCheckNow: (placeId: number) => void;
    isChecking: boolean;
}

export function PlaceRow({ placeData, onCheckNow, isChecking }: Props) {
    const { place, forecasts, nearby } = placeData;
    
    // Get up to 4 photos from nearby discovered places
    const photos = nearby
        .filter(p => p.photo_url)
        .slice(0, 4);

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
                <button
                    className="btn-check-now-small"
                    onClick={() => onCheckNow(place.id)}
                    disabled={isChecking}
                >
                    {isChecking ? '⏳' : '🔍 Check Weather'}
                </button>
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
                            {photos.map((photo) => (
                                <PhotoCard key={photo.id} place={photo} />
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

function PhotoCard({ place }: { place: DiscoveredPlace }) {
    return (
        <div className="photo-card">
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
        </div>
    );
}

