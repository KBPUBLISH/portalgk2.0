import { useEffect, useState } from 'react';
import apiClient from '../services/apiClient';
import DateScopedReport from './DateScopedReport';
type Row = { _id: string; title: string; playlistTitle?: string; viewCount?: number; playCount?: number; readCount?: number; totalPagesRead?: number; avgPagesRead?: number; totalListeningSeconds?: number; avgCompletionPercent?: number };
type Kind = 'book' | 'playlist' | 'episodes';
const num = (n: number | undefined) => n == null ? '—' : n.toLocaleString();
function ContentTable({ kind, query }: { kind: Kind; query: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setRows(null); setError('');
    apiClient.get(`/api/analytics/content?type=${kind}&${query}`, { signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setRows(response.data[kind === 'book' ? 'books' : kind === 'playlist' ? 'playlists' : 'episodes'] || []); })
      .catch(() => { if (!controller.signal.aborted) setError('Could not load content for these dates. Apply dates again to retry.'); });
    return () => controller.abort();
  }, [kind, query]);
  if (error) return <p role="alert" className="text-red-700">{error}</p>;
  if (!rows) return <p role="status">Loading content…</p>;
  const sorted = [...rows].sort((a,b) => kind === 'book' ? (b.viewCount || 0) - (a.viewCount || 0) : (b.playCount || 0) - (a.playCount || 0));
  const headings = kind === 'book' ? ['Book','Opens','Completions','Pages read','Avg pages per open'] : ['Title','Starts','Recorded listening time','Avg completion'];
  return <div className="space-y-3"><div className="bg-white border rounded-xl overflow-x-auto"><table className="w-full text-sm text-left"><caption className="p-4 text-left font-semibold">{kind === 'book' ? 'Book sessions' : kind === 'playlist' ? 'Playlist and episode starts by playlist' : 'Episode sessions'} started during selected dates</caption><thead className="bg-gray-50"><tr>{headings.map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{sorted.map(row => <tr key={row._id} className="border-t"><td className="p-3 font-medium">{row.title}{row.playlistTitle && <span className="block font-normal text-gray-500">{row.playlistTitle}</span>}</td>{kind === 'book' ? <><td className="p-3">{num(row.viewCount)}</td><td className="p-3">{num(row.readCount)}</td><td className="p-3">{num(row.totalPagesRead)}</td><td className="p-3">{num(row.avgPagesRead)}</td></> : <><td className="p-3">{num(row.playCount)}</td><td className="p-3">{row.totalListeningSeconds == null ? '—' : `${(row.totalListeningSeconds / 60).toLocaleString(undefined,{maximumFractionDigits:1})} min`}</td><td className="p-3">{row.avgCompletionPercent == null ? '—' : `${row.avgCompletionPercent}%`}</td></>}</tr>)}{!sorted.length && <tr><td colSpan={headings.length} className="p-6 text-gray-500">No recorded content.</td></tr>}</tbody></table></div><p className="text-sm text-gray-500">Totals belong to sessions started in this range, including later progress updates to those sessions. Lifetime likes, saves and game-unlock counters are excluded from this dated report.</p></div>;
}
export default function ContentEngagement({ kind, rangeQuery }: { kind: Kind; rangeQuery?: string }) {
  return rangeQuery ? <ContentTable kind={kind} query={rangeQuery} /> : <DateScopedReport>{query => <ContentTable kind={kind} query={query} />}</DateScopedReport>;
}
