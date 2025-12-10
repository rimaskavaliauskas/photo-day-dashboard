'use client';
import React, { useEffect, useState } from 'react';
import {
    Home,
    Search,
    Bell,
    Settings,
    User,
    Menu,
    HelpCircle,
    ArrowUpRight,
    ArrowDownRight,
    MapPin,
    Sun,
    Video,
    Cloud,
    Thermometer,
    Eye
} from 'lucide-react';
import WeatherChart from './WeatherChart';
import ScoreGauge from './ScoreGauge';

import {
    fetchDashboard,
    fetchMyPlaces,
    fetchVideos,
    DashboardData,
    MyPlaceWithData,
    YouTubeVideo,
    formatTime,
    getScoreClass
} from '@/lib/api';

/**
 * LightDashboard – a responsive dashboard layout based on the provided Figma node.
 * Now connected to real Photo Day API data.
 */

const LightDashboard = () => {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [myPlaces, setMyPlaces] = useState<MyPlaceWithData[]>([]);
    const [videos, setVideos] = useState<YouTubeVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                // Fetch all data in parallel
                const [dash, places, vids] = await Promise.all([
                    fetchDashboard(),
                    fetchMyPlaces(),
                    fetchVideos()
                ]);
                setDashboardData(dash);
                setMyPlaces(places);
                setVideos(vids);
            } catch (err) {
                console.error("Failed to load dashboard data:", err);
                setError("Failed to load data. Backend might be unreachable.");
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f1f1f1] text-[#333333]">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="w-12 h-12 bg-gray-300 rounded-full mb-4"></div>
                    <p>Loading Dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f1f1f1] text-red-500">
                <p>{error}</p>
            </div>
        );
    }

    // Derived Data for KPIs
    const photoScore = dashboardData?.weather.photoDayScore ?? 0;
    const nextGoldenHour = dashboardData?.sunWindows.today?.golden_evening_start
        ? formatTime(dashboardData?.sunWindows.today.golden_evening_start)
        : 'None';

    const placesCount = myPlaces.length;
    const recentVideosCount = videos.length; // Simply showing total count of fetched videos

    return (
        <div className="min-h-screen bg-[#f1f1f1] text-[#333333] font-sans">
            {/* -------------------------------------------------
          Sidebar – Collapsed navigation (left column)
          ------------------------------------------------- */}
            <aside className="fixed inset-y-0 left-0 z-20 flex flex-col w-16 bg-white border-r border-gray-200 shadow-sm">
                <nav className="flex flex-col items-center mt-4 space-y-6">
                    <a href="#" className="text-gray-600 hover:text-gray-900">
                        <Home className="w-5 h-5" />
                    </a>
                    <a href="#" className="text-gray-600 hover:text-gray-900">
                        <MapPin className="w-5 h-5" />
                    </a>
                    <a href="#" className="text-gray-600 hover:text-gray-900">
                        <Video className="w-5 h-5" />
                    </a>
                    <a href="#" className="text-gray-600 hover:text-gray-900">
                        <Settings className="w-5 h-5" />
                    </a>
                </nav>
            </aside>

            {/* -------------------------------------------------
          Main content wrapper (offset for sidebar)
          ------------------------------------------------- */}
            <main className="ml-16 flex flex-col min-h-screen">
                {/* -------------------------------------------------
            Header – Title, date, search, help button
            ------------------------------------------------- */}
                <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-[#333333]">Photo Day</h1>
                        <p className="text-sm text-[#666666]">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                    </div>

                    <div className="flex items-center space-x-4">
                        {/* Search input */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -mt-2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search places..."
                                className="pl-10 pr-4 py-2 w-64 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* Help button */}
                        <button className="flex items-center justify-center w-10 h-10 rounded-full bg-[#e5e7eb] hover:bg-[#d1d5db]">
                            <HelpCircle className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                </header>

                {/* -------------------------------------------------
            KPI Cards (4 cards)
            ------------------------------------------------- */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
                    {/* Card 1 – Photo Score */}
                    <div className="bg-white rounded-lg shadow-md p-5 flex flex-col items-center justify-between">
                        <div className="w-full flex justify-between items-start mb-2">
                            <p className="text-sm text-[#666666]">Photo Score</p>
                            <Sun className={`w-4 h-4 ${photoScore > 70 ? 'text-green-600' : 'text-yellow-600'}`} />
                        </div>

                        <ScoreGauge score={photoScore} />

                        <div className={`mt-2 text-sm font-medium ${photoScore > 70 ? 'text-green-600' : 'text-yellow-600'}`}>
                            {photoScore > 70 ? 'Excellent Conditions' : 'Fair Conditions'}
                        </div>
                    </div>

                    {/* Card 2 – Next Golden Hour */}
                    <div className="bg-white rounded-lg shadow-md p-5">
                        <p className="text-sm text-[#666666]">Next Golden Hour</p>
                        <p className="mt-2 text-3xl font-bold text-[#333333]">{nextGoldenHour}</p>
                        <div className="mt-2 flex items-center text-sm text-[#666666]">
                            <Sun className="w-4 h-4 mr-1" />
                            Evening
                        </div>
                    </div>

                    {/* Card 3 – Monitored Places */}
                    <div className="bg-white rounded-lg shadow-md p-5">
                        <p className="text-sm text-[#666666]">My Places</p>
                        <p className="mt-2 text-3xl font-bold text-[#333333]">{placesCount}</p>
                        <div className="mt-2 flex items-center text-sm text-green-600">
                            <MapPin className="w-4 h-4 mr-1" />
                            Active
                        </div>
                    </div>

                    {/* Card 4 – New Videos */}
                    <div className="bg-white rounded-lg shadow-md p-5">
                        <p className="text-sm text-[#666666]">New Videos</p>
                        <p className="mt-2 text-3xl font-bold text-[#333333]">{recentVideosCount}</p>
                        <div className="mt-2 flex items-center text-sm text-[#666666]">
                            <Video className="w-4 h-4 mr-1" />
                            Total in Feed
                        </div>
                    </div>
                </section>

                {/* -------------------------------------------------
            Charts Section – responsive grid
            ------------------------------------------------- */}
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6 px-6 pb-12">

                    {/* Hourly Weather (Was Income & Expenses) */}
                    <div className="bg-white rounded-lg shadow-md p-5">
                        <h2 className="text-lg font-semibold mb-4">Hourly Forecast</h2>
                        <div className="h-72 bg-white rounded p-2">
                            {dashboardData?.weather.hourly?.length ? (
                                <WeatherChart
                                    data={dashboardData.weather.hourly.map((h) => ({
                                        date_time: formatTime(h.date_time),
                                        temp: h.temp ?? 0,
                                        clouds: h.clouds ?? 0,
                                        score: h.photoday_score ?? 0
                                    }))}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    No hourly data available
                                </div>
                            )}
                        </div>
                        <p className="mt-2 text-sm text-[#666666]">Next 24 Hours</p>
                    </div>

                    {/* My Places List (Was Competitor Analysis) */}
                    <div className="bg-white rounded-lg shadow-md p-5">
                        <h2 className="text-lg font-semibold mb-4">My Places</h2>
                        <div className="h-64 bg-gray-50 overflow-y-auto rounded p-2">
                            {myPlaces.map((mp, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-white mb-2 rounded shadow-sm">
                                    <div>
                                        <p className="font-medium text-[#333333]">{mp.place.name}</p>
                                        <p className="text-xs text-gray-500">{mp.place.lat.toFixed(4)}, {mp.place.lng.toFixed(4)}</p>
                                    </div>
                                    {/* Show first forecast score if available */}
                                    {mp.forecasts[0] && (
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400">Tonight</p>
                                            <p className={`text-sm font-bold ${mp.forecasts[0].sky_open_evening ? 'text-green-600' : 'text-gray-600'}`}>
                                                {mp.forecasts[0].sky_open_evening ? 'Clear Sky' : 'Risk of Clouds'}
                                            </p>
                                        </div>
                                    )}
                                    <ArrowUpRight className="w-4 h-4 text-gray-400" />
                                </div>
                            ))}
                            {myPlaces.length === 0 && (
                                <div className="text-center text-gray-400 mt-20">No places monitored</div>
                            )}
                        </div>
                    </div>

                    {/* YouTube Feed (Was Customer Traffic) */}
                    <div className="bg-white rounded-lg shadow-md p-5 xl:col-span-2">
                        <h2 className="text-lg font-semibold mb-4">Recent Videos from Channels</h2>
                        <div className="h-80 bg-gray-50 overflow-y-auto rounded p-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {videos.map((video, idx) => (
                                    <a key={idx} href={`https://www.youtube.com/watch?v=${video.video_id}`} target="_blank" rel="noreferrer" className="block bg-white rounded shadow-sm overflow-hidden hover:shadow-md transition">
                                        {video.thumbnail_url ? (
                                            <img src={video.thumbnail_url} alt={video.title} className="w-full h-32 object-cover" />
                                        ) : (
                                            <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
                                                <Video className="w-8 h-8 text-gray-400" />
                                            </div>
                                        )}
                                        <div className="p-3">
                                            <h3 className="text-sm font-medium text-[#333333] line-clamp-2" title={video.title}>{video.title}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{video.channel_id}</p>
                                        </div>
                                    </a>
                                ))}
                            </div>
                            {videos.length === 0 && (
                                <div className="text-center text-gray-400 mt-32">No videos found</div>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default LightDashboard;
