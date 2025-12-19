'use client';

import React, { useMemo } from 'react';
import { PlaceForecast } from '@/lib/api';

interface GoldenHourTimelineProps {
    forecasts: PlaceForecast[];
    showDays?: number;
}

export function GoldenHourTimeline({ forecasts, showDays = 3 }: GoldenHourTimelineProps) {
    const now = new Date();

    const timelineData = useMemo(() => {
        return forecasts.slice(0, showDays).map((forecast) => {
            const date = new Date(forecast.date);
            const isToday = date.toDateString() === now.toDateString();

            // Parse times
            const blueMorningStart = forecast.blue_morning_start ? new Date(forecast.blue_morning_start) : null;
            const blueMorningEnd = forecast.blue_morning_end ? new Date(forecast.blue_morning_end) : null;
            const goldenMorningStart = forecast.golden_morning_start ? new Date(forecast.golden_morning_start) : null;
            const goldenMorningEnd = forecast.golden_morning_end ? new Date(forecast.golden_morning_end) : null;
            const sunrise = forecast.sunrise ? new Date(forecast.sunrise) : null;
            const sunset = forecast.sunset ? new Date(forecast.sunset) : null;
            const goldenEveningStart = forecast.golden_evening_start ? new Date(forecast.golden_evening_start) : null;
            const goldenEveningEnd = forecast.golden_evening_end ? new Date(forecast.golden_evening_end) : null;
            const blueEveningStart = forecast.blue_evening_start ? new Date(forecast.blue_evening_start) : null;
            const blueEveningEnd = forecast.blue_evening_end ? new Date(forecast.blue_evening_end) : null;

            // Calculate positions (0-100 representing 4am to 10pm = 18 hours)
            const timeToPercent = (time: Date | null) => {
                if (!time) return null;
                const hours = time.getHours() + time.getMinutes() / 60;
                // Map 4am-10pm (4-22) to 0-100
                return Math.max(0, Math.min(100, ((hours - 4) / 18) * 100));
            };

            return {
                date: forecast.date,
                dayLabel: isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                isToday,
                morningClouds: forecast.morning_clouds,
                eveningClouds: forecast.evening_clouds,
                blueMorning: {
                    start: timeToPercent(blueMorningStart),
                    end: timeToPercent(blueMorningEnd),
                },
                goldenMorning: {
                    start: timeToPercent(goldenMorningStart),
                    end: timeToPercent(goldenMorningEnd),
                },
                sunrise: timeToPercent(sunrise),
                sunset: timeToPercent(sunset),
                goldenEvening: {
                    start: timeToPercent(goldenEveningStart),
                    end: timeToPercent(goldenEveningEnd),
                },
                blueEvening: {
                    start: timeToPercent(blueEveningStart),
                    end: timeToPercent(blueEveningEnd),
                },
                nowPosition: isToday ? timeToPercent(now) : null,
            };
        });
    }, [forecasts, showDays, now]);

    if (forecasts.length === 0) {
        return (
            <div className="golden-timeline-empty">
                <p>No forecast data available</p>
            </div>
        );
    }

    return (
        <div className="golden-timeline">
            <div className="golden-timeline-header">
                <h4>Light Windows Timeline</h4>
                <div className="golden-timeline-legend">
                    <span className="legend-blue">Blue Hour</span>
                    <span className="legend-golden">Golden Hour</span>
                    <span className="legend-day">Daylight</span>
                </div>
            </div>

            {/* Time axis */}
            <div className="golden-timeline-axis">
                <span>4AM</span>
                <span>8AM</span>
                <span>12PM</span>
                <span>4PM</span>
                <span>8PM</span>
            </div>

            {/* Timeline rows */}
            <div className="golden-timeline-rows">
                {timelineData.map((day) => (
                    <div key={day.date} className={`golden-timeline-row ${day.isToday ? 'today' : ''}`}>
                        <div className="golden-timeline-label">
                            <span className="day-name">{day.dayLabel}</span>
                            <span className="cloud-info">
                                {day.morningClouds !== null && (
                                    <span title="Morning clouds">☁️ {day.morningClouds}%</span>
                                )}
                            </span>
                        </div>
                        <div className="golden-timeline-bar">
                            {/* Night background */}
                            <div className="timeline-night" />

                            {/* Blue Morning */}
                            {day.blueMorning.start !== null && day.blueMorning.end !== null && (
                                <div
                                    className="timeline-segment blue"
                                    style={{
                                        left: `${day.blueMorning.start}%`,
                                        width: `${day.blueMorning.end - day.blueMorning.start}%`,
                                    }}
                                    title="Blue Hour (Morning)"
                                />
                            )}

                            {/* Golden Morning */}
                            {day.goldenMorning.start !== null && day.goldenMorning.end !== null && (
                                <div
                                    className="timeline-segment golden"
                                    style={{
                                        left: `${day.goldenMorning.start}%`,
                                        width: `${day.goldenMorning.end - day.goldenMorning.start}%`,
                                    }}
                                    title="Golden Hour (Morning)"
                                />
                            )}

                            {/* Daylight */}
                            {day.sunrise !== null && day.sunset !== null && (
                                <div
                                    className="timeline-segment daylight"
                                    style={{
                                        left: `${day.sunrise}%`,
                                        width: `${day.sunset - day.sunrise}%`,
                                    }}
                                    title="Daylight"
                                />
                            )}

                            {/* Golden Evening */}
                            {day.goldenEvening.start !== null && day.goldenEvening.end !== null && (
                                <div
                                    className="timeline-segment golden"
                                    style={{
                                        left: `${day.goldenEvening.start}%`,
                                        width: `${day.goldenEvening.end - day.goldenEvening.start}%`,
                                    }}
                                    title="Golden Hour (Evening)"
                                />
                            )}

                            {/* Blue Evening */}
                            {day.blueEvening.start !== null && day.blueEvening.end !== null && (
                                <div
                                    className="timeline-segment blue"
                                    style={{
                                        left: `${day.blueEvening.start}%`,
                                        width: `${day.blueEvening.end - day.blueEvening.start}%`,
                                    }}
                                    title="Blue Hour (Evening)"
                                />
                            )}

                            {/* Current time marker */}
                            {day.nowPosition !== null && (
                                <div
                                    className="timeline-now-marker"
                                    style={{ left: `${day.nowPosition}%` }}
                                    title="Current time"
                                >
                                    <div className="now-line" />
                                    <div className="now-dot" />
                                </div>
                            )}

                            {/* Sunrise/Sunset markers */}
                            {day.sunrise !== null && (
                                <div
                                    className="timeline-sun-marker sunrise"
                                    style={{ left: `${day.sunrise}%` }}
                                    title="Sunrise"
                                >
                                    ☀️
                                </div>
                            )}
                            {day.sunset !== null && (
                                <div
                                    className="timeline-sun-marker sunset"
                                    style={{ left: `${day.sunset}%` }}
                                    title="Sunset"
                                >
                                    🌅
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GoldenHourTimeline;
