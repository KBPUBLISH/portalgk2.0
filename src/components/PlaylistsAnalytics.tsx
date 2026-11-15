import { useState } from 'react';
import ContentEngagement from './ContentEngagement';
import DateScopedReport from './DateScopedReport';
function AudioReport({ query }: { query: string }) {
  const [kind, setKind] = useState<'playlist' | 'episodes'>('episodes');
  return <div className="space-y-4"><div className="flex gap-2">{(['episodes','playlist'] as const).map(value => <button key={value} onClick={() => setKind(value)} className={`px-4 py-2 rounded-lg ${kind === value ? 'bg-purple-600 text-white' : 'bg-white border'}`}>{value === 'episodes' ? 'Episodes' : 'By playlist'}</button>)}</div><ContentEngagement kind={kind} rangeQuery={query} /></div>;
}
export default function PlaylistsAnalytics({ rangeQuery }: { rangeQuery?: string }) {
  return rangeQuery ? <AudioReport query={rangeQuery} /> : <DateScopedReport>{query => <AudioReport query={query} />}</DateScopedReport>;
}
