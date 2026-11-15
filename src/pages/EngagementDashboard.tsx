import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import BooksAnalytics from '../components/BooksAnalytics';
import PlaylistsAnalytics from '../components/PlaylistsAnalytics';
import GamesAnalytics from '../components/GamesAnalytics';
import { recentDays, rangeQuery } from '../utils/reportingRange';

type Report = {
  summary: Record<string, number | null>;
  island?: { availableSince: string | null; foregroundSeconds: number | null; activeSeconds: number | null; buildingSeconds: number | null; builders: number | null; avgBuildingSeconds: number | null; visits: number | null; legacyVisits: number; legacyVisitSeconds: number };
  coverage: { appActivitySince: string | null; contentRetentionDays: number; gameRetentionDays: number; gamesWithoutDuration: number };
};
const number = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString();
const hours = (n: number | null | undefined) => n == null ? '—' : n < 60 ? `${n} s` : n < 3600 ? `${(n / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} min` : `${(n / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
export default function EngagementDashboard() {
  const [draft, setDraft] = useState(() => recentDays(7));
  const [selected, setSelected] = useState(draft);
  const [query, setQuery] = useState(() => rangeQuery(draft));
  const [validation, setValidation] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<'games' | 'books' | 'audio'>('games');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const apply = (value = draft) => {
    try { const next = rangeQuery(value); setQuery(next); setSelected(value); setDraft(value); setValidation(''); setRefresh(v => v + 1); }
    catch (e) { setValidation((e as Error).message); }
  };
  useEffect(() => {
    const controller = new AbortController();
    setReport(null); setError('');
    apiClient.get(`/api/analytics/engagement?${query}`, { signal: controller.signal })
      .then(r => { if (!controller.signal.aborted) setReport(r.data); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load engagement for these dates. Please retry.'); });
    return () => controller.abort();
  }, [query, refresh]);
  const s = report?.summary;
  const cards = [
    ['Active devices', number(s?.activeUsers)], ['App sessions', number(s?.appSessions)], ['Foreground app time', hours(s?.foregroundSeconds)],
    ['Game sessions', number(s?.gameSessions)], ['Game time', hours(s?.gameSeconds)], ['Book opens', number(s?.bookStarts)],
    ['Book completions', number(s?.bookCompletions)], ['Pages read', number(s?.pagesRead)], ['Audio starts', number(s?.audioStarts)],
    ['Recorded listening time', hours(s?.listeningSeconds)], ['Lessons completed', number(s?.lessonCompletions)],
  ];
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">App engagement</h1><p className="text-gray-600 mt-1">Activity recorded during your selected dates.</p></div>
    <form className="bg-white border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); apply(); }}>
      <div className="flex gap-2 flex-wrap">{[7, 30, 90].map(days => <button type="button" key={days} className="px-3 py-2 rounded-lg bg-gray-100 text-sm" onClick={() => apply(recentDays(days))}>Last {days} days</button>)}</div>
      <div className="flex items-end gap-3 flex-wrap">
        <label className="text-sm">From<input aria-label="From date" type="date" required value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} className="block border rounded-lg px-3 py-2" /></label>
        <label className="text-sm">Through<input aria-label="Through date" type="date" required value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} className="block border rounded-lg px-3 py-2" /></label>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg" type="submit">Apply dates</button>
      </div>
      {validation && <p role="alert" className="text-red-700">{validation}</p>}
      <p className="text-sm text-gray-600">Showing {selected.from} through {selected.to}, inclusive · {timezone}</p>
    </form>
    {error ? <p role="alert" className="p-4 bg-red-50 text-red-800 rounded-xl">{error} <button className="underline" onClick={() => setRefresh(v => v + 1)}>Retry</button></p> : !report ? <p role="status">Loading selected dates…</p> : <>
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm space-y-1">
        <p>App sessions and foreground time {report.coverage.appActivitySince ? `are available from ${new Date(report.coverage.appActivitySince).toLocaleString()}` : 'will appear as updated app versions report activity'}. Earlier app and game time cannot be reconstructed. App activity is retained for 90 days.</p>
        <p>Book and audio history may be incomplete beyond {report.coverage.contentRetentionDays} days; game history beyond {report.coverage.gameRetentionDays} days. Earlier dates are incomplete. “—” means unavailable, not zero.</p>
        {report.coverage.gamesWithoutDuration > 0 && <p>{number(report.coverage.gamesWithoutDuration)} game sessions in this range have no recorded duration.</p>}
      </div>
      {report.island && <section className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 space-y-3">
        <h2 className="text-lg font-bold text-indigo-950">Island building</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{[
          ['Time on island', hours(report.island.foregroundSeconds)],
          ['Active island time', hours(report.island.activeSeconds)],
          ['Active building time', hours(report.island.buildingSeconds)],
          ['Builders (devices)', number(report.island.builders)],
          ['Building time per builder', hours(report.island.avgBuildingSeconds)],
          ['Island visits', number(report.island.visits)],
        ].map(([label,value]) => <div key={label} className="bg-white rounded-lg p-3"><p className="text-sm text-gray-600">{label}</p><p className="text-xl font-bold">{value}</p></div>)}</div>
        <p className="text-sm text-indigo-950">Active time pauses after 60 seconds without island interaction. Building time covers building menus, placement and the player’s construction actions. Background time and autonomous character work are excluded. These times overlap and should not be added.</p>
        <p className="text-sm">{report.island.availableSince ? `Accurate island timing starts ${new Date(report.island.availableSince).toLocaleString()}.` : 'Accurate island timing will appear after the updated app is released.'}</p>
        {(report.island.legacyVisits > 0 || report.island.legacyVisitSeconds > 0) && <p className="text-sm text-amber-900">Older visit records: {number(report.island.legacyVisits)} visits, {hours(report.island.legacyVisitSeconds)} recorded visit time. This can include idle/background time and is not a measure of active building.</p>}
      </section>}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">{cards.map(([label, value]) => <div key={label} className="bg-white border rounded-xl p-4"><p className="text-sm text-gray-600">{label}</p><p className="text-2xl font-bold text-gray-900 mt-2">{value}</p></div>)}</div>
      <p className="text-xs text-gray-500">Sessions active across midnight count in each day they were used; their time is split at the date boundary. App and game time overlap and should not be added. Book/audio totals belong to sessions started in the selected dates.</p>
    </>}
    <div className="flex gap-2 bg-white rounded-xl border p-2">{(['games','books','audio'] as const).map(value => <button key={value} onClick={() => setTab(value)} className={`flex-1 rounded-lg p-2 capitalize ${tab === value ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>{value}</button>)}</div>
    <div key={`${query}:${refresh}`}>
      {tab === 'games' && <GamesAnalytics rangeQuery={query} />}
      {tab === 'books' && <BooksAnalytics rangeQuery={query} />}
      {tab === 'audio' && <PlaylistsAnalytics rangeQuery={query} />}
    </div>
  </div>;
}
