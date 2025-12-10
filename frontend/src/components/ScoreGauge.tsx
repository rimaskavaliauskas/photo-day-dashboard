import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface ScoreGaugeProps {
    score: number; // 0-100
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
    const data = [{ name: 'score', value: score, fill: score >= 70 ? '#0ec979' : score >= 40 ? '#f4e684' : '#ff4d4f' }];

    return (
        <div className="relative w-full h-32 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={10}
                    data={data}
                    startAngle={90}
                    endAngle={-270}
                >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar
                        background
                        clockWise
                        dataKey="value"
                        cornerRadius={10}
                    />
                </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-800">{score}</span>
                <span className="text-xs text-gray-500">SCORE</span>
            </div>
        </div>
    );
};

export default ScoreGauge;
