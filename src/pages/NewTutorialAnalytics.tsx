import React, { useEffect, useState } from 'react';
import { Compass, Users, Clock, Gift, MousePointerClick, Crown, RefreshCw, AlertTriangle, Lightbulb, CheckCircle } from 'lucide-react';
import apiClient from '../services/apiClient';

interface FunnelStep {
    step: string;
    stepKey: string;
    count: number;
    rate: number;
    medianToReachMs?: number | null;
    medianDwellMs?: number | null;
    from: string | null;
    reachedPrevious: number;
    dropFromPrevious: number;
    dropRate: number;
}

interface Dropoff {
    from: string;
    to: string;
    dropped: number;
    dropRate: number;
}

interface Suggestion {
    severity: 'high' | 'medium' | 'good' | 'info';
    title: string;
    detail: string;
}

interface Study {
    success: boolean;
    narrative: string;
    summary: {
        started: number;
        sessions: number;
        medianEngagedMs: number | null;
        avgEngagedMs: number | null;
        reachedOffer: number;
        offerRate: number;
        paywallShown: number;
        paywallClicked: number;
        paywallDismissed: number;
        trialsStarted: number;
        clickRate: number;
        trialOfClicksRate: number;
        trialOfStartersRate: number;
        paywallBeforeOffer: number;
        challengeViews: number;
    };
    funnel: FunnelStep[];
    dropoffs: Dropoff[];
    offerScreens: FunnelStep[];
    paywallSources: { source: string; count: number }[];
    suggestions: Suggestion[];
    dailyTrends: { date: string; started: number; trials: number }[];
}

const SOURCE_LABELS: Record<string, string> = {
    'adam-offer': 'End of Adam’s tour',
    'skip-tour': 'Skipped the tour',
    'continue-journey': 'Tapped something locked',
    challenge: 'Challenge offer',
    library: 'Library paywall',
    paywall: 'Paywall',
};

function formatDuration(ms: number | null | undefined): string {
    if (ms == null || !Number.isFinite(ms)) return '—';
    const seconds = Math.max(0, Math.round(ms / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rem = seconds % 60;
    if (minutes < 60) return rem ? `${minutes}m ${rem}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
}

function formatDay(iso: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const suggestionStyle: Record<Suggestion['severity'], string> = {
    high: 'border-red-200 bg-red-50',
    medium: 'border-amber-200 bg-amber-50',
    good: 'border-green-200 bg-green-50',
    info: 'border-sky-200 bg-sky-50',
};

const NewTutorialAnalytics: React.FC = () => {
    const [days, setDays] = useState(30);
    const [study, setStudy] = useState<Study | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async (windowDays: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/api/analytics/journey?days=${windowDays}`);
            if (!res.data?.success) {
                setError(res.data?.message || 'The new tutorial study could not be loaded.');
                setStudy(null);
                return;
            }
            setStudy(res.data);
        } catch (err: any) {
            const status = err?.response?.status;
            setError(status === 404
                ? 'The server does not have this report yet. Deploy the backend, then this page fills in as families go through the new tutorial.'
                : (err?.response?.data?.message || 'The new tutorial study could not be loaded.'));
            setStudy(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(days);
    }, [days]);

    const summary = study?.summary;
    const maxDaily = study ? Math.max(...study.dailyTrends.map((day) => day.started), 1) : 1;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Compass className="w-6 h-6 text-indigo-600" />
                        New Tutorial
                    </h1>
                    <p className="text-gray-600 mt-1 max-w-2xl">
                        Perry’s first voyage, from the ocean map through the first story pack, Adam’s tour, the free-book offer, and the trial.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={days}
                        onChange={(event) => setDays(parseInt(event.target.value, 10))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button
                        type="button"
                        onClick={() => load(days)}
                        className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {loading && !study && (
                <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-500">
                    Gathering the new tutorial…
                </div>
            )}

            {study && summary && (
                <>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 text-indigo-950 leading-relaxed">
                        {study.narrative}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <Stat icon={Users} label="Started" value={summary.started.toLocaleString()} />
                        <Stat icon={Clock} label="Median time" value={formatDuration(summary.medianEngagedMs)} hint={summary.avgEngagedMs != null ? `Avg ${formatDuration(summary.avgEngagedMs)}` : undefined} />
                        <Stat icon={Gift} label="Saw the offer" value={summary.reachedOffer.toLocaleString()} hint={`${summary.offerRate}% of starters`} />
                        <Stat icon={MousePointerClick} label="Tapped trial" value={summary.paywallClicked.toLocaleString()} hint={`${summary.clickRate}% of paywall views`} />
                        <Stat icon={Crown} label="Trials started" value={summary.trialsStarted.toLocaleString()} hint={`${summary.trialOfStartersRate}% of starters`} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <p className="text-gray-500">Any paywall view</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{summary.paywallShown.toLocaleString()}</p>
                            <p className="text-gray-500 mt-1">{summary.paywallBeforeOffer.toLocaleString()} saw a paywall before the end-of-tour offer</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <p className="text-gray-500">Left the offer</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{summary.paywallDismissed.toLocaleString()}</p>
                            <p className="text-gray-500 mt-1">{summary.trialOfClicksRate}% of trial taps became a trial</p>
                        </div>
                        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                            <p className="text-gray-500">Where the paywall first appeared</p>
                            <div className="mt-2 space-y-1">
                                {study.paywallSources.length === 0 && <p className="text-gray-400">No paywall views yet</p>}
                                {study.paywallSources.map((row) => (
                                    <div key={row.source} className="flex justify-between gap-3">
                                        <span className="text-gray-700">{SOURCE_LABELS[row.source] || row.source}</span>
                                        <span className="font-semibold text-gray-900">{row.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <section className="space-y-3">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            What to improve
                        </h2>
                        <div className="space-y-3">
                            {study.suggestions.map((item) => (
                                <div key={item.title} className={`rounded-xl border px-4 py-3 ${suggestionStyle[item.severity] || suggestionStyle.info}`}>
                                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                                        {item.severity === 'good' ? <CheckCircle className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                                        {item.title}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1 leading-relaxed">{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-1">Where they drop off</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Time is how long families who continued spent before the next beat. A dash means too few people moved on to time it.
                        </p>
                        <div className="space-y-3">
                            {study.funnel.map((step, index) => (
                                <div key={step.stepKey}>
                                    {index > 0 && step.dropFromPrevious > 0 && (
                                        <p className={`text-xs mb-1 ml-8 ${step.dropRate >= 25 ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                                            {step.dropFromPrevious.toLocaleString()} left here ({step.dropRate}%)
                                        </p>
                                    )}
                                    <FunnelRow step={step} />
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Biggest leaks</h2>
                            {study.dropoffs.length === 0 ? (
                                <p className="text-sm text-gray-500">No drop-off yet. Everyone who started is still inside the steps we can see, or nobody has started.</p>
                            ) : (
                                <div className="space-y-3">
                                    {study.dropoffs.map((drop) => (
                                        <div key={`${drop.from}-${drop.to}`} className="flex items-center justify-between gap-3 text-sm">
                                            <div>
                                                <p className="font-medium text-gray-800">{drop.from} → {drop.to}</p>
                                                <p className="text-gray-500">{drop.dropped.toLocaleString()} families left</p>
                                            </div>
                                            <span className={`font-bold ${drop.dropRate >= 25 ? 'text-red-600' : 'text-gray-700'}`}>{drop.dropRate}%</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                            <h2 className="text-lg font-semibold text-gray-900 mb-1">Inside the offer</h2>
                            <p className="text-sm text-gray-500 mb-4">
                                The four screens after Adam’s tour, plus anyone who opened that same offer by tapping a lock.
                                {summary.challengeViews > 0 ? ` ${summary.challengeViews.toLocaleString()} families opened it.` : ''}
                            </p>
                            <div className="space-y-3">
                                {study.offerScreens.map((step) => (
                                    <FunnelRow key={step.stepKey} step={step} />
                                ))}
                            </div>
                        </section>
                    </div>

                    <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Starts and trials by day</h2>
                        <div className="flex items-end gap-2 h-36">
                            {study.dailyTrends.map((day) => (
                                <div key={day.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                                    <div className="w-full flex items-end justify-center gap-0.5 h-24">
                                        <div
                                            className="w-2 rounded-t bg-indigo-500"
                                            style={{ height: `${Math.max(4, (day.started / maxDaily) * 100)}%` }}
                                            title={`${day.started} started`}
                                        />
                                        <div
                                            className="w-2 rounded-t bg-emerald-500"
                                            style={{ height: `${Math.max(day.trials ? 4 : 0, (day.trials / maxDaily) * 100)}%` }}
                                            title={`${day.trials} trials`}
                                        />
                                    </div>
                                    <span className="text-[10px] text-gray-400">{formatDay(day.date)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500" /> Started</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" /> Trials</span>
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

function Stat({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint?: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <Icon className="w-4 h-4" />
                {label}
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
        </div>
    );
}

function FunnelRow({ step }: { step: FunnelStep }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-44 shrink-0 text-sm font-medium text-gray-700 truncate" title={step.step}>{step.step}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600"
                    style={{ width: `${Math.max(step.count > 0 ? 2 : 0, step.rate)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
                    {step.count.toLocaleString()} ({step.rate}%)
                </div>
            </div>
            <div className="w-16 text-right text-xs text-gray-500 shrink-0">{formatDuration(step.medianDwellMs)}</div>
        </div>
    );
}

export default NewTutorialAnalytics;
