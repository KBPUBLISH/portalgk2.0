import React, { useState, useEffect } from 'react';
import { BarChart3, Eye, Heart, BookmarkCheck, Trophy, Palette, Gamepad2, RefreshCw, TrendingUp } from 'lucide-react';
import apiClient from '../services/apiClient';

interface BookAnalyticsData {
    book: { _id: string; title: string };
    counters: {
        views: number;
        reads: number;
        likes: number;
        favorites: number;
        quizStarts: number;
        quizCompletions: number;
        coloringSessions: number;
        gameUnlocks: number;
        gameOpens: number;
    };
    quizCompletionRate: string | number;
    dailyViews: Array<{ _id: string; count: number }>;
}

interface PlaylistAnalyticsData {
    playlist: { _id: string; title: string; itemCount: number };
    counters: {
        views: number;
        plays: number;
        itemPlays: number;
        likes: number;
        favorites: number;
    };
    dailyPlays: Array<{ _id: string; count: number }>;
}

interface ContentAnalyticsProps {
    contentId: string;
    contentType: 'book' | 'playlist';
}

const StatCard: React.FC<{
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
}> = ({ label, value, icon, color }) => (
    <div className={`bg-white rounded-lg p-4 border border-gray-200 shadow-sm`}>
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-800">{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
            </div>
        </div>
    </div>
);

const MiniBarChart: React.FC<{
    data: Array<{ _id: string; count: number }>;
}> = ({ data }) => {
    if (!data || data.length === 0) return null;
    
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const last7Days = data.slice(-7);
    
    return (
        <div className="flex items-end gap-1 h-16">
            {last7Days.map((day, index) => {
                const height = (day.count / maxCount) * 100;
                return (
                    <div 
                        key={index}
                        className="flex-1 flex flex-col items-center group"
                    >
                        <div 
                            className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors cursor-pointer min-h-[2px]"
                            style={{ height: `${Math.max(height, 5)}%` }}
                            title={`${day._id}: ${day.count}`}
                        />
                    </div>
                );
            })}
        </div>
    );
};

const ContentAnalytics: React.FC<ContentAnalyticsProps> = ({ contentId, contentType }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [bookData, setBookData] = useState<BookAnalyticsData | null>(null);
    const [playlistData, setPlaylistData] = useState<PlaylistAnalyticsData | null>(null);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | 'all'>('30d');

    const fetchAnalytics = async () => {
        if (!contentId) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const endpoint = contentType === 'book' 
                ? `/api/analytics/book/${contentId}?range=${dateRange}`
                : `/api/analytics/playlist/${contentId}?range=${dateRange}`;
            
            const response = await apiClient.get(endpoint);
            
            if (contentType === 'book') {
                setBookData(response.data);
            } else {
                setPlaylistData(response.data);
            }
        } catch (err: any) {
            console.error('Error fetching analytics:', err);
            setError(err.response?.data?.error || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [contentId, contentType, dateRange]);

    if (loading) {
        return (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <div className="flex items-center justify-center gap-2 text-gray-500">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading analytics...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                <p className="text-red-600 text-sm mb-2">{error}</p>
                <button
                    onClick={fetchAnalytics}
                    className="text-sm text-red-700 underline hover:no-underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    // Render Book Analytics
    if (contentType === 'book' && bookData) {
        return (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Analytics</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="text-sm px-2 py-1 border border-gray-300 rounded-lg bg-white"
                        >
                            <option value="7d">7 days</option>
                            <option value="30d">30 days</option>
                            <option value="all">All time</option>
                        </select>
                        <button
                            onClick={fetchAnalytics}
                            className="p-1 text-gray-500 hover:text-indigo-600 rounded"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <StatCard
                        label="Views"
                        value={bookData.counters.views.toLocaleString()}
                        icon={<Eye className="w-4 h-4 text-blue-600" />}
                        color="bg-blue-100"
                    />
                    <StatCard
                        label="Completed Reads"
                        value={bookData.counters.reads.toLocaleString()}
                        icon={<BookmarkCheck className="w-4 h-4 text-green-600" />}
                        color="bg-green-100"
                    />
                    <StatCard
                        label="Likes"
                        value={bookData.counters.likes.toLocaleString()}
                        icon={<Heart className="w-4 h-4 text-red-600" />}
                        color="bg-red-100"
                    />
                    <StatCard
                        label="Favorites"
                        value={bookData.counters.favorites.toLocaleString()}
                        icon={<BookmarkCheck className="w-4 h-4 text-amber-600" />}
                        color="bg-amber-100"
                    />
                </div>

                {/* Feature Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <StatCard
                        label="Quiz Completions"
                        value={bookData.counters.quizCompletions.toLocaleString()}
                        icon={<Trophy className="w-4 h-4 text-purple-600" />}
                        color="bg-purple-100"
                    />
                    <StatCard
                        label="Quiz Rate"
                        value={`${bookData.quizCompletionRate}%`}
                        icon={<TrendingUp className="w-4 h-4 text-indigo-600" />}
                        color="bg-indigo-100"
                    />
                    <StatCard
                        label="Coloring Sessions"
                        value={bookData.counters.coloringSessions.toLocaleString()}
                        icon={<Palette className="w-4 h-4 text-pink-600" />}
                        color="bg-pink-100"
                    />
                    <StatCard
                        label="Game Opens"
                        value={bookData.counters.gameOpens.toLocaleString()}
                        icon={<Gamepad2 className="w-4 h-4 text-teal-600" />}
                        color="bg-teal-100"
                    />
                </div>

                {/* Daily Views Chart */}
                {bookData.dailyViews && bookData.dailyViews.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Views (last 7 days)</p>
                        <MiniBarChart data={bookData.dailyViews} />
                    </div>
                )}
            </div>
        );
    }

    // Render Playlist Analytics
    if (contentType === 'playlist' && playlistData) {
        return (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-800">Analytics</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="text-sm px-2 py-1 border border-gray-300 rounded-lg bg-white"
                        >
                            <option value="7d">7 days</option>
                            <option value="30d">30 days</option>
                            <option value="all">All time</option>
                        </select>
                        <button
                            onClick={fetchAnalytics}
                            className="p-1 text-gray-500 hover:text-purple-600 rounded"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                    <StatCard
                        label="Views"
                        value={playlistData.counters.views.toLocaleString()}
                        icon={<Eye className="w-4 h-4 text-blue-600" />}
                        color="bg-blue-100"
                    />
                    <StatCard
                        label="Total Plays"
                        value={playlistData.counters.plays.toLocaleString()}
                        icon={<TrendingUp className="w-4 h-4 text-green-600" />}
                        color="bg-green-100"
                    />
                    <StatCard
                        label="Item Plays"
                        value={playlistData.counters.itemPlays.toLocaleString()}
                        icon={<BarChart3 className="w-4 h-4 text-purple-600" />}
                        color="bg-purple-100"
                    />
                    <StatCard
                        label="Likes"
                        value={playlistData.counters.likes.toLocaleString()}
                        icon={<Heart className="w-4 h-4 text-red-600" />}
                        color="bg-red-100"
                    />
                    <StatCard
                        label="Favorites"
                        value={playlistData.counters.favorites.toLocaleString()}
                        icon={<BookmarkCheck className="w-4 h-4 text-amber-600" />}
                        color="bg-amber-100"
                    />
                </div>

                {/* Daily Plays Chart */}
                {playlistData.dailyPlays && playlistData.dailyPlays.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-2">Plays (last 7 days)</p>
                        <MiniBarChart data={playlistData.dailyPlays} />
                    </div>
                )}
            </div>
        );
    }

    return null;
};

export default ContentAnalytics;

