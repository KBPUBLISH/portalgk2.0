import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

type Arm = {
  variant: 'upfront_trial' | 'play_first'; assigned: number; mature: number; pending: number;
  paid30: number; paid30Rate: number | null; paid30Interval: [number, number] | null;
  paidSoFar: number; netPaid30: number; refunds: number; trials: number; netInitialRevenueUsd: number;
  continued: number; paywall: number; checkout: number; checkoutErrors: number; island: number; trialUnavailable: number;
};
type Report = { experiment: string; enrollmentEnabled: boolean; observedAt: string; firstAssignment: string | null;
  readyPlatforms: { ios: boolean; android: boolean };
  excludedSandbox: number; excludedPriorSubscribers: number; linkedMultiple: number; splitWarning: boolean; decision: string; arms: Arm[] };
const title = (variant: string) => variant === 'upfront_trial' ? 'A · Upfront yearly trial' : 'B · Play first';
const percent = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}%` : '—';
const rows: [string, keyof Arm][] = [
  ['Assigned installs', 'assigned'], ['Continued past splash', 'continued'], ['Reached the island', 'island'],
  ['Opened a paywall', 'paywall'], ['Requested store checkout', 'checkout'], ['Had a checkout error', 'checkoutErrors'],
  ['Started a verified trial', 'trials'], ['Paid so far · still maturing', 'paidSoFar'],
  ['Refunded first payments', 'refunds'], ['Yearly trial unavailable', 'trialUnavailable'],
];

export default function PaywallExperiment() {
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [platform, setPlatform] = useState('all');
  const [report, setReport] = useState<Report | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoading(true); setError(''); setReport(null);
    apiClient.get<Report>('/api/paywall-experiment/report', { params: { from: from || undefined, to: to || undefined, platform } })
      .then(({ data }) => { if (!cancelled) setReport(data); })
      .catch(() => { if (!cancelled) setError('Could not load the test. Check your date range and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to, platform, refresh]);
  return <div className="space-y-6 p-6 max-w-7xl mx-auto">
    <div><h1 className="text-3xl font-bold text-gray-900">Paywall test</h1>
      <p className="text-gray-600 mt-2">Which complete onboarding offer produces more paying subscribers within 30 days?</p></div>
    <div className="flex flex-wrap items-end gap-4 rounded-xl bg-white border p-4">
      <label className="text-sm">Assigned from (UTC)<input aria-label="Assigned from" type="date" value={from} onChange={e => setFrom(e.target.value)} className="block border rounded p-2 mt-1" /></label>
      <label className="text-sm">Assigned through (UTC)<input aria-label="Assigned through" type="date" value={to} onChange={e => setTo(e.target.value)} className="block border rounded p-2 mt-1" /></label>
      <label className="text-sm">Platform<select value={platform} onChange={e => setPlatform(e.target.value)} className="block border rounded p-2 mt-1"><option value="all">Both stores</option><option value="ios">App Store</option><option value="android">Google Play</option></select></label>
      <button onClick={() => setRefresh(n => n + 1)} disabled={loading} className="bg-indigo-600 text-white rounded px-4 py-2 disabled:opacity-50">Refresh</button>
      <button onClick={() => { setFrom(''); setTo(''); }} className="text-indigo-700 px-2 py-2">All enrollment dates</button>
    </div>
    <p className="text-sm text-gray-600">Dates select when installs entered the test. Their next 30 days of payments remain attached, including payments after the selected dates.</p>
    {loading && <p role="status">Loading the experiment…</p>}
    {error && <p role="alert" className="rounded bg-red-50 text-red-800 p-4">{error}</p>}
    {report && <>
      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4 space-y-2">
        <p className="font-semibold">{report.enrollmentEnabled ? 'New enrollment enabled · 50/50 allocation' : 'New enrollment paused · existing assignments retained'}</p>
        <p className="text-sm">Billing readiness: App Store {report.readyPlatforms.ios ? 'ready' : 'blocked'} · Google Play {report.readyPlatforms.android ? 'ready' : 'blocked'}. A blocked store cannot enroll new installs.</p>
        <p className="text-sm">A shows the parent introduction and a store-confirmed yearly trial before play. B keeps the current play-first flow and annual promo. Monthly remains an option. This compares both the offer and its timing.</p>
        <p className="text-sm">The main result counts new installs with at least one real, verified payment within 30 days. Free trials and restored access are not payments.</p>
        <p className="text-sm">Updated {new Date(report.observedAt).toLocaleString()}. {report.firstAssignment ? `First enrollment: ${new Date(report.firstAssignment).toLocaleString()}.` : 'No installs enrolled yet.'}</p>
      </div>
      {(report.splitWarning || report.linkedMultiple > 0) && <div className="rounded bg-amber-50 text-amber-900 p-4" role="status">
        {report.splitWarning && <p>The assignment split is unusually uneven. Check enrollment before interpreting conversion.</p>}
        {report.linkedMultiple > 0 && <p>{report.linkedMultiple} installs are linked to another enrolled device. A payment is credited only once, to the earliest matching eligible assignment. Review this overlap before drawing conclusions.</p>}
      </div>}
      <div className="grid md:grid-cols-2 gap-4">{report.arms.map(arm => <section key={arm.variant} className="rounded-xl border bg-white p-6">
        <h2 className="text-xl font-bold">{title(arm.variant)}</h2>
        <p className="text-4xl font-bold mt-5 text-indigo-700">{arm.paid30Rate == null ? 'Waiting' : `${arm.paid30Rate.toFixed(1)}%`}</p>
        <p className="mt-2">{arm.paid30} paying subscribers / {arm.mature} installs with a full 30 days</p>
        <p className="text-sm text-gray-600 mt-2">{arm.paid30Interval ? `95% interval: ${arm.paid30Interval[0]}%–${arm.paid30Interval[1]}%` : 'No mature cohort yet. Early payments are shown below.'}</p>
        <p className="mt-4 text-sm">{arm.pending} installs still maturing · {arm.netPaid30} mature payers after known refunds</p>
      </section>)}</div>
      <div className="rounded-xl border bg-white overflow-x-auto"><table className="w-full text-left"><caption className="text-left px-5 py-4 font-semibold">Supporting measures · selected cohort, first 30 days</caption>
        <thead><tr className="bg-gray-50"><th className="p-4">Measure</th>{report.arms.map(a => <th key={a.variant} className="p-4">{title(a.variant)}</th>)}</tr></thead>
        <tbody>{rows.map(([label, key]) => <tr className="border-t" key={key}><th className="p-4 font-normal">{label}</th>{report.arms.map(a => <td className="p-4" key={a.variant}>{String(a[key])}{key !== 'assigned' && <span className="text-gray-500 ml-2">({percent(Number(a[key]), a.assigned)})</span>}</td>)}</tr>)}
          <tr className="border-t"><th className="p-4 font-normal">Net first-payment revenue · USD, before fees</th>{report.arms.map(a => <td className="p-4" key={a.variant}>${a.netInitialRevenueUsd.toFixed(2)}</td>)}</tr>
        </tbody></table></div>
      <div className="text-sm text-gray-600 space-y-2"><p>{report.decision}</p>
        <p>Enrollment is per new native installation, not a proven unique household. Existing local profiles and signed-in users are excluded. Before sign-in, another device or reinstall may appear as a new install. Installs that continue before configuration loads stay outside the test. {report.excludedSandbox} sandbox-linked installs and {report.excludedPriorSubscribers} installs with known prior subscriptions are excluded.</p>
        <p>A sticky assignment survives app restarts. Refunds can revise net results as receipts arrive. Keep both flows stable during measurement and inspect each store separately.</p>
      </div>
    </>}
  </div>;
}
