import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
type Game = { gameId: string; gameName: string; totalPlays: number; uniquePlayers: number; totalSessionSeconds: number; timedSessions: number; avgSessionSeconds: number | null; completionRate: number | null; reportedResults: number };
type Play = { id: string; gameName: string; playedAt: string; sessionDurationSeconds: number | null; completed: boolean | null };
type Data = { games: Game[]; recentPlays: Play[] };
const num = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
const duration = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value / 60 * 10) / 10} min`;
export default function GamesAnalytics({ rangeQuery }: { rangeQuery: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError('');
    apiClient.get(`/api/analytics/games?${rangeQuery}`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setData(r.data); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load games for these dates. Apply dates again to retry.'); });
    return () => controller.abort();
  }, [rangeQuery]);
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (!data) return <p role="status">Loading games…</p>;
  return <div className="space-y-5">
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><caption className="text-left p-4 font-semibold">Games used during selected dates</caption><thead className="bg-gray-50"><tr>{['Game','Sessions','Devices','Game time','Avg measured time','Completion'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.games.map(game => <tr key={game.gameId} className="border-t"><td className="p-3 font-medium">{game.gameName || game.gameId}</td><td className="p-3">{num(game.totalPlays)}</td><td className="p-3">{num(game.uniquePlayers)}</td><td className="p-3">{duration(game.timedSessions ? game.totalSessionSeconds : null)}</td><td className="p-3">{duration(game.avgSessionSeconds)}</td><td className="p-3">{game.completionRate == null ? '—' : `${game.completionRate}% (${num(game.reportedResults)} reported)`}</td></tr>)}
      {!data.games.length && <tr><td colSpan={6} className="p-6 text-gray-500">No recorded game sessions in these dates.</td></tr>}
    </tbody></table></div>
    <p className="text-sm text-gray-500">Time excludes background use. Completion is shown only when the game reports an outcome; closing an embedded game does not imply completion.</p>
    <div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><caption className="p-4 text-left font-semibold">Recent sessions in selected dates</caption><thead className="bg-gray-50"><tr>{['Game','Started','Time in range','Completed'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.recentPlays.map(play => <tr key={play.id} className="border-t"><td className="p-3">{play.gameName}</td><td className="p-3">{new Date(play.playedAt).toLocaleString()}</td><td className="p-3">{duration(play.sessionDurationSeconds)}</td><td className="p-3">{play.completed == null ? '—' : play.completed ? 'Yes' : 'No'}</td></tr>)}</tbody></table></div>
  </div>;
}
