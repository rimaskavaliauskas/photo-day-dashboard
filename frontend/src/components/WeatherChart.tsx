import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from 'recharts';

interface WeatherChartProps {
    data: {
        date_time: string;
        temp: number; // Celsius
        clouds: number; // Percentage
        score?: number;
    }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const temp = payload.find((p: any) => p.dataKey === 'temp')?.value;
        const clouds = payload.find((p: any) => p.dataKey === 'clouds')?.value;

        return (
            <div className="bg-white border border-gray-200 p-3 rounded shadow-md text-sm">
                <p className="font-semibold text-gray-700 mb-1">{label}</p>
                <p className="text-blue-600">
                    <span className="font-medium">Temp:</span> {temp}°C
                </p>
                <p className="text-purple-600">
                    <span className="font-medium">Clouds:</span> {clouds}%
                </p>
            </div>
        );
    }
    return null;
};

const WeatherChart: React.FC<WeatherChartProps> = ({ data }) => {
    return (
        <ResponsiveContainer
            width="100%"
            height={300}
            style={{ minWidth: 0, minHeight: 0 }}
        >
            <AreaChart
                data={data}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
                <defs>
                    <linearGradient id="colorClouds" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />

                <XAxis
                    dataKey="date_time"
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                />

                {/* Left Y-axis – Temperature */}
                <YAxis
                    yAxisId="temp"
                    orientation="left"
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                    domain={['auto', 'auto']}
                />

                {/* Right Y-axis – Cloud Cover */}
                <YAxis
                    yAxisId="clouds"
                    orientation="right"
                    tick={{ fontSize: 12, fill: '#666' }}
                    tickLine={false}
                    axisLine={false}
                    unit="%"
                />

                {/* Cloud-cover area */}
                <Area
                    yAxisId="clouds"
                    type="monotone"
                    dataKey="clouds"
                    stroke="#8884d8"
                    fill="url(#colorClouds)"
                    fillOpacity={0.4}
                />

                {/* Temperature line – bold */}
                <Line
                    yAxisId="temp"
                    type="monotone"
                    dataKey="temp"
                    stroke="#333"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2, fill: '#fff', stroke: '#333' }}
                />

                <Tooltip content={<CustomTooltip />} />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default WeatherChart;
