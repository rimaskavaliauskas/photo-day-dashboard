'use client';

import React from 'react';
import {
    RadialBarChart,
    RadialBar,
    PolarAngleAxis,
    ResponsiveContainer,
    Legend,
} from 'recharts';

interface ConditionsGaugeProps {
    clouds: number | null;      // 0-100% (lower is better)
    visibility: number | null;  // km (higher is better, max ~50)
    precipitation: number | null; // mm (lower is better)
    score: number;              // 0-100
}

export function ConditionsGauge({ clouds, visibility, precipitation, score }: ConditionsGaugeProps) {
    // Normalize values for display (all as 0-100 where 100 is best)
    const cloudScore = clouds !== null ? Math.max(0, 100 - clouds) : 50;
    const visScore = visibility !== null ? Math.min(100, (visibility / 20) * 100) : 50;
    const precipScore = precipitation !== null ? Math.max(0, 100 - (precipitation * 20)) : 100;

    const data = [
        { name: 'Clear Sky', value: cloudScore, fill: '#60a5fa' },
        { name: 'Visibility', value: visScore, fill: '#34d399' },
        { name: 'No Rain', value: precipScore, fill: '#a78bfa' },
    ];

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

    return (
        <div className="conditions-gauge">
            <div className="conditions-gauge-chart">
                <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart
                        innerRadius="30%"
                        outerRadius="90%"
                        data={data}
                        startAngle={180}
                        endAngle={0}
                    >
                        <PolarAngleAxis
                            type="number"
                            domain={[0, 100]}
                            angleAxisId={0}
                            tick={false}
                        />
                        <RadialBar
                            background={{ fill: 'rgba(255,255,255,0.1)' }}
                            dataKey="value"
                            cornerRadius={5}
                        />
                    </RadialBarChart>
                </ResponsiveContainer>

                {/* Center Score */}
                <div className="conditions-gauge-center">
                    <div
                        className="conditions-gauge-score"
                        style={{ color: getScoreColor(score) }}
                    >
                        {score}
                    </div>
                    <div className="conditions-gauge-label">
                        {getScoreLabel(score)}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="conditions-gauge-legend">
                <div className="conditions-legend-item">
                    <span className="legend-dot" style={{ background: '#60a5fa' }} />
                    <span className="legend-label">Sky</span>
                    <span className="legend-value">{clouds !== null ? `${100 - clouds}%` : '--'}</span>
                </div>
                <div className="conditions-legend-item">
                    <span className="legend-dot" style={{ background: '#34d399' }} />
                    <span className="legend-label">Visibility</span>
                    <span className="legend-value">{visibility !== null ? `${visibility.toFixed(1)}km` : '--'}</span>
                </div>
                <div className="conditions-legend-item">
                    <span className="legend-dot" style={{ background: '#a78bfa' }} />
                    <span className="legend-label">Dry</span>
                    <span className="legend-value">{precipitation !== null ? `${precipitation}mm` : '--'}</span>
                </div>
            </div>
        </div>
    );
}

export default ConditionsGauge;
