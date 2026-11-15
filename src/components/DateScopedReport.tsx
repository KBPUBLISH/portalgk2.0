import { useState, type ReactNode } from 'react';
import { recentDays, rangeQuery } from '../utils/reportingRange';
export default function DateScopedReport({ children }: { children: (query: string) => ReactNode }) {
  const [dates, setDates] = useState(() => recentDays(7));
  const [query, setQuery] = useState(() => rangeQuery(dates));
  const [error, setError] = useState('');
  return <div className="space-y-4"><form className="flex gap-3 items-end flex-wrap bg-white border rounded-xl p-4" onSubmit={e => { e.preventDefault(); try { setQuery(rangeQuery(dates)); setError(''); } catch (err) { setError((err as Error).message); } }}>
    <label>From<input className="block border rounded p-2" type="date" required value={dates.from} onChange={e => setDates({ ...dates, from: e.target.value })} /></label>
    <label>Through<input className="block border rounded p-2" type="date" required value={dates.to} onChange={e => setDates({ ...dates, to: e.target.value })} /></label>
    <button className="rounded bg-indigo-600 text-white px-4 py-2">Apply dates</button>
    <p className="w-full text-sm text-gray-500">Dates include the full end day in {Intl.DateTimeFormat().resolvedOptions().timeZone}. Book and audio history is retained for 30 days; earlier dates are incomplete.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </form><div key={query}>{children(query)}</div></div>;
}
