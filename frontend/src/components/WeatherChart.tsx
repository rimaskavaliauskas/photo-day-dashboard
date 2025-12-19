'use client';

import React, { useState } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine,
} from 'recharts';

interface WeatherChartProps {
    data: {
        date_time: string;
        temp: number | null;
        clouds: number | null;
        visibility?: number | null;
        precip?: number | null;
        score?: number | null;
    }[];
    showScore?: boolean;
    showVisibility?: boolean;
    showPrecipitation?: boolean;
    compact?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const temp = payload.find((p: any) => p.dataKey === 'temp')?.value;
        const clouds = payload.find((p: any) => p.dataKey === 'clouds')?.value;
        const visibility = payload.find((p: any) => p.dataKey === 'visibility')?.value;
        const precip = payload.find((p: any) => p.dataKey === 'precip')?.value;
        const score = payload.find((p: any) => p.dataKey === 'score')?.value;

        return (
            <div className="weather-chart-tooltip">
                <p className="tooltip-time">{label}</p>
                <div className="tooltip-grid">
                    {temp !== undefined && (
                        <div className="tooltip-row">
                            <span className="tooltip-icon">🌡️</span>
                            <span className="tooltip-label">Temp</span>
                            <span className="tooltip-value">{temp}°C</span>
                        </div>
                    )}
                    {clouds !== undefined && (
                        <div className="tooltip-row">
                            <span className="tooltip-icon">☁️</span>
                            <span className="tooltip-label">Clouds</span>
                            <span className="tooltip-value">{clouds}%</span>
                        </div>
                    )}
                    {visibility !== undefined && visibility !== null && (
                        <div className="tooltip-row">
                            <span className="tooltip-icon">👁️</span>
                            <span className="tooltip-label">Visibility</span>
                            <span className="tooltip-value">{visibility.toFixed(1)} km</span>
                        </div>
                    )}
                    {precip !== undefined && precip !== null && precip > 0 && (
                        <div className="tooltip-row">
                            <span className="tooltip-icon">🌧️</span>
                            <span className="tooltip-label">Rain</span>
                            <span className="tooltip-value">{precip} mm</span>
                        </div>
                    )}
                    {score !== undefined && score !== null && (
                        <div className="tooltip-row score">
                            <span className="tooltip-icon">📷</span>
                            <span className="tooltip-label">Photo Score</span>
                            <span className={`tooltip-value ${score >= 70 ? 'excellent' : score >= 50 ? 'good' : 'poor'}`}>
                                {score}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

const WeatherChart: React.FC<WeatherChartProps> = ({
    data,
    showScore = true,
    showVisibility = true,
    showPrecipitation = true,
    compact = false,
}) => {
    const [activeLines, setActiveLines] = useState({
        temp: true,
        clouds: true,
        visibility: showVisibility,
        precip: showPrecipitation,
        score: showScore,
    });

    const toggleLine = (key: keyof typeof activeLines) => {
        setActiveLines((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Find golden hour periods (score >= 70)
    const goldenPeriods = data.reduce((acc, point, idx) => {
        if (point.score && point.score >= 70) {
            if (acc.length === 0 || acc[acc.length - 1].end !== idx - 1) {
                acc.push({ start: idx, end: idx });
            } else {
                acc[acc.length - 1].end = idx;
            }
        }
        return acc;
    }, [] as { start: number; end: number }[]);

    return (
        <div className="weather-chart-container">
            {/* Toggle buttons */}
            <div className="weather-chart-toggles">
                <button
                    className={`toggle-btn ${activeLines.temp ? 'active' : ''}`}
                    onClick={() => toggleLine('temp')}
                    style={{ '--toggle-color': '#f97316' } as React.CSSProperties}
                >
                    🌡️ Temp
                </button>
                <button
                    className={`toggle-btn ${activeLines.clouds ? 'active' : ''}`}
                    onClick={() => toggleLine('clouds')}
                    style={{ '--toggle-color': '#8b5cf6' } as React.CSSProperties}
                >
                    ☁️ Clouds
                </button>
                {showVisibility && (
                    <button
                        className={`toggle-btn ${activeLines.visibility ? 'active' : ''}`}
                        onClick={() => toggleLine('visibility')}
                        style={{ '--toggle-color': '#06b6d4' } as React.CSSProperties}
                    >
                        👁️ Visibility
                    </button>
                )}
                {showPrecipitation && (
                    <button
                        className={`toggle-btn ${activeLines.precip ? 'active' : ''}`}
                        onClick={() => toggleLine('precip')}
                        style={{ '--toggle-color': '#3b82f6' } as React.CSSProperties}
                    >
                        🌧️ Rain
                    </button>
                )}
                {showScore && (
                    <button
                        className={`toggle-btn ${activeLines.score ? 'active' : ''}`}
                        onClick={() => toggleLine('score')}
                        style={{ '--toggle-color': '#22c55e' } as React.CSSProperties}
                    >
                        📷 Score
                    </button>
                )}
            </div>

            <ResponsiveContainer width="100%" height={compact ? 200 : 300}>
                <ComposedChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                    <defs>
                        <linearGradient id="colorClouds" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.6} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1} />
                        </linearGradient>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />

                    <XAxis
                        dataKey="date_time"
                        tick={{ fontSize: 11, fill: '#a1a1aa' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                    />

                    {/* Left Y-axis – Temperature */}
                    <YAxis
                        yAxisId="temp"
                        orientation="left"
                        tick={{ fontSize: 11, fill: '#a1a1aa' }}
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        unit="°"
                    />

                    {/* Right Y-axis – Percentage (clouds, score) */}
                    <YAxis
                        yAxisId="percent"
                        orientation="right"
                        tick={{ fontSize: 11, fill: '#a1a1aa' }}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        unit="%"
                    />

                    {/* Reference line for "good" score threshold */}
                    {activeLines.score && (
                        <ReferenceLine
                            yAxisId="percent"
                            y={70}
                            stroke="#22c55e"
                            strokeDasharray="5 5"
                            strokeOpacity={0.5}
                        />
                    )}

                    {/* Cloud cover area */}
                    {activeLines.clouds && (
                        <Area
                            yAxisId="percent"
                            type="monotone"
                            dataKey="clouds"
                            stroke="#8b5cf6"
                            fill="url(#colorClouds)"
                            strokeWidth={2}
                            dot={false}
                            name="Clouds"
                        />
                    )}

                    {/* Photo score area */}
                    {activeLines.score && (
                        <Area
                            yAxisId="percent"
                            type="monotone"
                            dataKey="score"
                            stroke="#22c55e"
                            fill="url(#colorScore)"
                            strokeWidth={2}
                            dot={false}
                            name="Photo Score"
                        />
                    )}

                    {/* Precipitation bars */}
                    {activeLines.precip && (
                        <Bar
                            yAxisId="temp"
                            dataKey="precip"
                            fill="#3b82f6"
                            opacity={0.6}
                            barSize={8}
                            name="Precipitation"
                        />
                    )}

                    {/* Temperature line */}
                    {activeLines.temp && (
                        <Line
                            yAxisId="temp"
                            type="monotone"
                            dataKey="temp"
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#f97316' }}
                            name="Temperature"
                        />
                    )}

                    {/* Visibility line */}
                    {activeLines.visibility && (
                        <Line
                            yAxisId="temp"
                            type="monotone"
                            dataKey="visibility"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Visibility"
                        />
                    )}

                    <Tooltip content={<CustomTooltip />} />
                </ComposedChart>
            </ResponsiveContainer>

            {/* Best times indicator */}
            {goldenPeriods.length > 0 && (
                <div className="weather-chart-best-times">
                    <span className="best-times-label">📷 Best photo times:</span>
                    {goldenPeriods.slice(0, 3).map((period, idx) => (
                        <span key={idx} className="best-time-badge">
                            {data[period.start]?.date_time}
                            {period.end > period.start && ` - ${data[period.end]?.date_time}`}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default WeatherChart;
