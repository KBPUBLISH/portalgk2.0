import React, { useCallback, useEffect, useState } from 'react';
import { Headphones, RefreshCw, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import apiClient from '../services/apiClient';

interface SeriesRow {
    seriesId: string;
    seriesTitle: string;
    ratings: number;
    average: number;
    loveItShare: number;
    notIntoItShare: number;
    kids: number;
    lastRatedAt: string;
}

interface RecentRating {
    seriesTitle: string;
    episodeTitle: string;
    rating: number;
    ageBand: string;
    platform: string;
    answeredAt: string;
}

interface Report {
    summary: { ratings: number; average: number | null; kids: number; series: number };
    series: SeriesRow[];
    recent: RecentRating[];
}

type Preset = 'all' | '1w' | '1m' | '3m' | 'custom';

const averageColor = (avg: number) => (avg >= 8 ? 'text-green-700' : avg >= 5 ? 'text-amber-700' : 'text-red-700');
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Kids rate an audio-drama series 1-10 after finishing an episode ("want more episodes?"). */
const SeriesRatings: React.FC = () => {
    const [preset, setPreset] = useState<Preset>('all');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        const params: Record<string, string> = {};
        if (preset === 'custom') {
            if (!from || !to) return;
            const end = new Date(`${to}T00:00`);
            end.setDate(end.getDate() + 1);
            params.startDate = new Date(`${from}T00:00`).toISOString();
            params.endDate = end.toISOString();
        } else {
            params.timeRange = preset;
        }
        try {
            setLoading(true);
            setError(null);
            const response = await apiClient.get('/api/analytics/series-ratings', { params });
            setData(response.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to load series ratings');
        } finally {
            setLoading(false);
        }
    }, [preset, from, to]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Headphones className="w-6 h-6 text-indigo-600" /> Audio Drama Ratings
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        After finishing an episode, kids answer "Are you enjoying this series? Want more episodes?" from 1 (not into it) to 10 (can't wait).
                    </p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                    <label className="text-sm text-gray-600">
                        Dates
                        <select value={preset} onChange={e => setPreset(e.target.value as Preset)} className="block mt-1 border rounded-lg px-3 py-2 bg-white">
                            <option value="all">All time</option>
                            <option value="1w">Last 7 days</option>
                            <option value="1m">Last 30 days</option>
                            <option value="3m">Last 90 days</option>
                            <option value="custom">Pick dates…</option>
                        </select>
                    </label>
                    {preset === 'custom' && (
                        <>
                            <label className="text-sm text-gray-600">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block mt-1 border rounded-lg px-3 py-2" /></label>
                            <label className="text-sm text-gray-600">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="block mt-1 border rounded-lg px-3 py-2" /></label>
                        </>
                    )}
                    <button onClick={load} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg">{error}</div>}
            {loading && !data && <div className="text-gray-500">Loading…</div>}

            {data && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow p-4"><p className="text-gray-500 text-sm">Ratings</p><p className="text-2xl font-bold">{data.summary.ratings}</p></div>
                        <div className="bg-white rounded-xl shadow p-4"><p className="text-gray-500 text-sm">Average (1-10)</p><p className="text-2xl font-bold">{data.summary.average ?? '—'}</p></div>
                        <div className="bg-white rounded-xl shadow p-4"><p className="text-gray-500 text-sm flex items-center gap-1"><Users className="w-4 h-4" /> Kids who answered</p><p className="text-2xl font-bold">{data.summary.kids}</p></div>
                        <div className="bg-white rounded-xl shadow p-4"><p className="text-gray-500 text-sm">Series rated</p><p className="text-2xl font-bold">{data.summary.series}</p></div>
                    </div>

                    <div className="bg-white rounded-xl shadow overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 text-left">
                                <tr>
                                    <th className="px-4 py-3">Series (most recently rated first)</th>
                                    <th className="px-4 py-3 text-right">Ratings</th>
                                    <th className="px-4 py-3 text-right">Average</th>
                                    <th className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1"><ThumbsUp className="w-4 h-4 text-green-600" /> 9-10</span></th>
                                    <th className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1"><ThumbsDown className="w-4 h-4 text-red-600" /> 1-3</span></th>
                                    <th className="px-4 py-3 text-right">Kids</th>
                                    <th className="px-4 py-3 text-right">Last rated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.series.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No ratings in this period yet.</td></tr>
                                )}
                                {data.series.map(row => (
                                    <tr key={row.seriesId} className="border-t">
                                        <td className="px-4 py-3 font-medium text-gray-800">{row.seriesTitle}</td>
                                        <td className="px-4 py-3 text-right">{row.ratings}</td>
                                        <td className={`px-4 py-3 text-right font-bold ${averageColor(row.average)}`}>{row.average}</td>
                                        <td className="px-4 py-3 text-right text-green-700">{row.loveItShare}%</td>
                                        <td className="px-4 py-3 text-right text-red-700">{row.notIntoItShare}%</td>
                                        <td className="px-4 py-3 text-right">{row.kids}</td>
                                        <td className="px-4 py-3 text-right text-gray-500">{formatDate(row.lastRatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {data.recent.length > 0 && (
                        <div className="bg-white rounded-xl shadow p-4">
                            <h2 className="font-semibold text-gray-800 mb-3">Latest answers</h2>
                            <ul className="divide-y text-sm">
                                {data.recent.map((r, i) => (
                                    <li key={i} className="py-2 flex flex-wrap justify-between gap-2">
                                        <span><b>{r.rating}/10</b> · {r.seriesTitle} — {r.episodeTitle}</span>
                                        <span className="text-gray-500">ages {r.ageBand} · {r.platform} · {formatDate(r.answeredAt)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SeriesRatings;
