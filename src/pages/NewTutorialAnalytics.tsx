import React, { useEffect, useState } from 'react';
import { Compass, Users, Clock, Gift, MousePointerClick, Crown, RefreshCw, ArrowRight, CheckCircle, Ship, MessageCircle, Library, CalendarDays, TreePalm, Repeat } from 'lucide-react';
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

interface RetentionSlot {
    eligible: number;
    retained: number;
    rate: number | null;
}

interface PersonRow {
    id: string;
    name: string;
    kids: string[];
    plan: string;
    lastActiveAt: string | null;
    createdAt: string | null;
    cameBack: boolean;
    daysRetained: number | null;
    sessions: number;
    timeSpentSeconds: number;
    packsCompleted: number;
    packsStarted: number;
    boatSessions: number;
    characterTalks: number;
    friendsVisits?: number;
    friendsTimeMs?: number;
    booksRead: number;
    lessonsCompleted: number;
    quizzesCompleted: number;
    tutorial: string | null;
}

interface Life {
    familiesActive: number;
    scanned: number;
    packsCompleted: number;
    familiesWithPack: number;
    boatSessions: number;
    boatFamilies: number;
    characterTalks: number;
    characterMessages: number;
    characterFamilies: number;
    appSessions: number;
    topCharacters: { name: string; talks: number; messages: number }[];
    retention: {
        cameBack: RetentionSlot;
        day1: RetentionSlot;
        day7: RetentionSlot;
        day30: RetentionSlot;
    };
    friends?: Friends;
    people: PersonRow[];
}

interface FriendsGroup {
    size: number;
    cameBack: RetentionSlot;
    day1: RetentionSlot;
    day7: RetentionSlot;
}

/** Friends World — the island game opened from the ship. */
interface Friends {
    visits: number;
    families: number;
    returningFamilies: number;
    timedVisits: number;
    totalTimeMs: number;
    medianVisitMs: number | null;
    longVisits: number;
    actions: number;
    actionMix: { source: string; label: string; count: number; families: number; top: { name: string; count: number }[] }[];
    retention: { players: FriendsGroup; others: FriendsGroup };
    byDay: { day: string; visits: number; families: number }[];
}

interface Experience {
    version: string; started: number; firstTrackedAt: string | null;
    avatarCompleted: number; island: number; islandCompleted: number; tourCompleted: number; storyPackCompleted: number;
    parentIntro: number; parentIntroRate: number; paywall: number; paywallRate: number;
    paywallAfterExperience: number; paywallAfterExperienceRate: number;
    offerViews: number; trialTaps: number; trialCheckouts: number; trialSuccessReports: number; changedChoice: number;
    funnel: FunnelStep[]; dropoffs: FunnelStep[];
    branches: {key: string; label: string; count: number; rate: number; island: number; paywall: number; paywallRate: number}[];
    tasks: {key: string; label: string; count: number; rate: number; remaining: number}[];
}
interface Study {
    experience?: Experience;
    previousExperience?: Experience;
    success: boolean;
    flowVersion: string;
    generatedAt: string;
    summary: {
        journeys: number; tutorialStarted: number; parentStarted: number; paywall: number;
        accountCreated: number; checkout: number; confirmed: number; trials: number; paid: number;
        converted: number; trialCancelled: number; completion: number; continued: number;
        checkoutConversion: number; paywallConversion: number; paywallConfirmed: number; sandboxJourneys: number;
        sandboxConfirmed: number; resumed: number;
    };
    funnel: FunnelStep[]; childFunnel: FunnelStep[]; dropoffs: FunnelStep[];
    screens: { screen: string; views: number; continues: number; backs: number; medianActiveMs: number | null }[];
    plans: { plan: string; checkout: number; confirmed: number; rate: number }[];
    diagnostics: { key: string; label: string; journeys: number; events: number }[];
    dailyTrends: { date: string; started: number; trials: number; paid: number }[];
    life?: Life;
}
const PLAN_LABELS: Record<string, string> = { free: 'Free', trial: 'Trial', active: 'Member', cancelled: 'Cancelled', expired: 'Expired', reverse_trial: 'Reverse trial' };
const SCREEN_LABELS: Record<string, string> = { badge: 'Adventure badge', handoff: 'Hey, Parents', why: 'Why a Bible game?', stories: 'Bible stories', world: 'Build a community', library: 'Content library', family: 'Family membership', reminder: 'Trial reminder', account: 'Create account', paywall: 'Paywall' };

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

function formatWhen(iso: string | null, withYear = false): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        ...(withYear ? { year: 'numeric' } : {}),
    });
}

function formatSessionTime(seconds: number, sessions: number): { total: string; average: string | null } {
    if (!Number.isFinite(seconds) || seconds <= 0) return { total: '—', average: null };
    const total = formatDuration(seconds * 1000);
    if (!sessions) return { total, average: null };
    return { total, average: `avg ${formatDuration((seconds / sessions) * 1000)}` };
}

function formatDay(iso: string): string {
    const date = new Date(`${iso}T00:00:00Z`);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const NewTutorialAnalytics: React.FC = () => {
    const [days, setDays] = useState(30);
    const [platform, setPlatform] = useState('all');
    const [entry, setEntry] = useState('all');
    const [study, setStudy] = useState<Study | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refresh, setRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true); setError(null); setStudy(null);
        apiClient.get(`/api/analytics/journey?flow=parent_white_v1&days=${days}&platform=${platform}&entry=${entry}`, { signal: controller.signal })
            .then(res => {
                if (res.data?.flowVersion !== 'parent_white_v1') throw new Error('The updated tutorial report is not available yet.');
                if (!controller.signal.aborted) setStudy(res.data);
            }).catch(err => { if (!controller.signal.aborted) setError(err?.response?.data?.message || err.message || 'Could not load this report.'); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [days, platform, entry, refresh]);
    const summary = study?.summary;
    return <div className="space-y-6 pb-8">
        <header className="flex flex-wrap justify-between gap-5">
            <div><p className="text-xs uppercase tracking-widest font-semibold text-indigo-600 mb-2">Splash → Perry → ship → Bible story → island → membership</p>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Compass className="w-6 h-6 text-indigo-600" />New Tutorial</h1>
                <p className="text-gray-600 mt-2 max-w-2xl">See how many families start the experience, finish the tutorial, and reach the new paywall. Then follow the parent flow to a confirmed membership.</p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
                <label className="text-xs text-gray-500">Cohort window<select aria-label="Cohort window" className="block mt-1 border rounded-lg p-2 bg-white text-gray-800" value={days} onChange={e => setDays(Number(e.target.value))}>{[1, 7, 14, 30, 90].map(n => <option key={n} value={n}>Last {n} {n === 1 ? 'day' : 'days'}</option>)}</select></label>
                <label className="text-xs text-gray-500">Platform<select aria-label="Platform" className="block mt-1 border rounded-lg p-2 bg-white text-gray-800" value={platform} onChange={e => setPlatform(e.target.value)}><option value="all">All platforms</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></label>
                <label className="text-xs text-gray-500">Parent entry<select aria-label="Parent entry" className="block mt-1 border rounded-lg p-2 bg-white text-gray-800" value={entry} onChange={e => setEntry(e.target.value)}><option value="all">All entries</option><option value="tour">Badge / handoff</option><option value="resumed">Reopened / direct</option></select></label>
                <button aria-label="Refresh report" onClick={() => setRefresh(n => n + 1)} disabled={loading} className="mt-5 p-2 border rounded-lg bg-white"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
            </div>
        </header>
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-5 py-4 text-sm text-indigo-950 leading-relaxed">
            <strong>Current flow only.</strong> Old free-book and discount-offer events are excluded. Counts are unique device journeys, carried through sign-in and reopening. A checkout tap is not a trial: conversions require a verified billing webhook. Test purchases are separated below.
        </div>
        {error && <div role="alert" className="p-5 border border-red-200 bg-red-50 rounded-xl text-red-800">{error}<button className="ml-4 underline" onClick={() => setRefresh(n => n + 1)}>Try again</button></div>}
        {loading && <div role="status" className="p-10 text-center text-gray-500">Loading the current journey…</div>}
        {study && summary && <>
            {summary.journeys === 0 && <section className="p-6 border border-dashed border-indigo-200 bg-white rounded-xl"><h2 className="font-semibold text-gray-900">Ready for the first new journeys</h2><p className="mt-2 text-sm text-gray-600">Tracking starts with this release. Existing tutorial history is preserved, but it won’t be presented as data from this new flow.</p></section>}
            {study.experience && <ExperienceSection data={study.experience} />}
            {study.previousExperience && <details className="bg-white border rounded-xl p-5"><summary className="cursor-pointer font-semibold">Previous island-first flow · {study.previousExperience.started} starters</summary><ExperienceSection data={study.previousExperience} /></details>}
            <h2 className="text-xl font-semibold text-gray-900 pt-3">After the experience · parent flow</h2>
            <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
                <Stat icon={Users} label="Parent entries" value={String(summary.parentStarted)} hint={`${summary.resumed} reopened / direct`} />
                <Stat icon={Gift} label="Paywall reached" value={String(summary.paywall)} />
                <Stat icon={MousePointerClick} label="Checkout requested" value={String(summary.checkout)} />
                <Stat icon={Crown} label="Confirmed trials" value={String(summary.trials)} hint="Verified store receipt" />
                <Stat icon={CheckCircle} label="Paid starts" value={String(summary.paid)} hint="Started without a trial" />
                <Stat icon={ArrowRight} label="Paywall conversion" value={`${summary.paywallConversion}%`} hint={`${summary.paywallConfirmed ?? summary.confirmed} of ${summary.paywall} paywall viewers`} />
            </div>
            <section className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap justify-between items-start gap-3 mb-5"><div><h2 className="text-lg font-semibold text-gray-900">The parent journey</h2><p className="text-sm text-gray-500 mt-1">Observed reach, as a percentage of parent entries. Reopened journeys may skip earlier screens.</p></div><span className="text-xs rounded-full bg-indigo-50 px-3 py-2 text-indigo-700">{summary.checkoutConversion}% of checkouts confirmed</span></div>
                <div className="space-y-3">{study.funnel.map(step => <FunnelRow key={step.stepKey} step={step} />)}</div>
                <p className="text-xs text-gray-500 mt-5">Right column: median elapsed time to the next observed step, among journeys reaching both. This includes time away from the app.</p>
            </section>
            <div className="grid lg:grid-cols-2 gap-5">
                <section className="bg-white border rounded-xl p-5"><h2 className="text-lg font-semibold mb-2">Where to look next</h2><p className="text-sm text-gray-500 mb-4">Reached the earlier step but haven’t reached the next one. This is not a confirmed abandonment.</p>{study.dropoffs.length ? study.dropoffs.map(d => <div className="flex justify-between gap-4 py-3 border-b last:border-0 text-sm" key={d.stepKey}><span>{d.from} → {d.step}</span><strong className="shrink-0">{d.dropFromPrevious} · {d.dropRate}%</strong></div>) : <p className="text-gray-500 text-sm">No gaps recorded in this cohort yet.</p>}</section>
                <section className="bg-white border rounded-xl p-5"><h2 className="text-lg font-semibold mb-2">Membership plans</h2><p className="text-sm text-gray-500 mb-4">A journey trying both plans appears in both checkout rows. A receipt is attributed to the latest eligible checkout.</p><table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="py-2">Plan</th><th>Checkouts</th><th>Confirmed</th><th>Rate</th></tr></thead><tbody>{study.plans.map(p => <tr key={p.plan} className="border-b last:border-0"><th className="text-left py-4 capitalize">{p.plan}</th><td>{p.checkout}</td><td>{p.confirmed}</td><td>{p.rate}%</td></tr>)}</tbody></table><div className="mt-5 text-sm text-gray-600">Trial → paid: <strong>{summary.converted}</strong><span className="mx-3">·</span>Trial cancellations: <strong>{summary.trialCancelled}</strong></div></section>
            </div>
            <section className="bg-white border rounded-xl p-5 overflow-x-auto"><h2 className="text-lg font-semibold mb-1">How parents use each screen</h2><p className="text-sm font-medium text-indigo-700 mb-2">{summary.accountCreated} new accounts created · {summary.completion} completion screens seen</p><p className="text-sm text-gray-500 mb-4">Views are unique journeys; Continue and Back are tap counts. Active time excludes background time and caps each recorded interval at five minutes.</p><table className="w-full text-sm text-left min-w-[520px]"><thead className="text-gray-500 border-b"><tr><th className="py-3">Screen</th><th>Views</th><th>Continue</th><th>Back</th><th>Median active time</th></tr></thead><tbody>{study.screens.map(row => <tr className="border-b last:border-0" key={row.screen}><th className="font-medium py-3">{SCREEN_LABELS[row.screen]}</th><td>{row.views}</td><td>{row.continues}</td><td>{row.backs}</td><td>{formatDuration(row.medianActiveMs)}</td></tr>)}</tbody></table></section>
            <section className="bg-white border rounded-xl p-5"><h2 className="text-lg font-semibold mb-1">Checkout, return visits & completion</h2><p className="text-sm text-gray-500 mb-5">Completion-screen views show the user experience. Only the verified billing counts above measure new subscriptions.</p><div className="grid grid-cols-2 lg:grid-cols-5 gap-4">{study.diagnostics.map(d => <div className="rounded-lg bg-gray-50 p-3" key={d.key}><p className="text-xs text-gray-600">{d.label}</p><p className="text-xl font-semibold mt-1">{d.journeys}</p><p className="text-xs text-gray-500">journeys · {d.events} events</p></div>)}</div></section>
            <details className="bg-white border rounded-xl p-5"><summary className="cursor-pointer font-semibold">Earlier tutorial tracking · {summary.tutorialStarted} starts</summary><p className="text-sm text-gray-500 my-4">Preserved history from the earlier map-based tutorial. Use the full experience report above for the current island tutorial.</p><div className="space-y-3">{study.childFunnel.map(step => <FunnelRow key={step.stepKey} step={step} />)}</div></details>
            <section className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-amber-950">Sandbox / test purchases</h2><p className="text-sm text-amber-900 mt-1">Excluded from the conversion funnel and plan rates once a test receipt is identified.</p></div><p className="text-sm text-amber-950"><strong>{summary.sandboxJourneys}</strong> test journeys · <strong>{summary.sandboxConfirmed}</strong> confirmed test memberships</p></section>
            <details className="bg-white border rounded-xl p-5"><summary className="cursor-pointer font-semibold">Daily parent cohorts</summary><p className="text-sm text-gray-500 my-4">UTC entry date. Later conversions remain with the original entry cohort.</p><table className="w-full text-sm text-left"><thead className="text-gray-500"><tr><th>Date</th><th>Parent entries</th><th>Trials</th><th>Paid starts</th></tr></thead><tbody>{study.dailyTrends.map(d => <tr key={d.date} className="border-t"><td className="py-3">{formatDay(d.date)}</td><td>{d.started}</td><td>{d.trials}</td><td>{d.paid}</td></tr>)}</tbody></table></details>
            <details className="bg-gray-50 border rounded-xl p-5"><summary className="cursor-pointer font-semibold text-gray-800">Gameplay & retention · all families in the date range</summary><p className="text-sm text-gray-500 my-4">Existing activity reports are preserved. They use the date range, not the parent-flow platform or entry filters.</p>{study.life && <LifeSection life={study.life} />}</details>
            <p className="text-xs text-gray-400">Updated {new Date(study.generatedAt).toLocaleString()} · Flow: {study.flowVersion}</p>
        </>}
    </div>;
};

function ExperienceSection({ data }: { data: Experience }) {
    const storyFirst=data.version==='story_first_v1';
    return <section aria-label="Full experience funnel" className="space-y-5">
        <div className="rounded-2xl bg-slate-900 p-6 text-white">
            <p className="text-xs uppercase tracking-widest text-sky-200 font-semibold">{storyFirst ? 'Story-first journey' : 'Previous island-first journey'}</p>
            <div className="flex flex-wrap justify-between gap-6 mt-3">
                <div><h2 className="text-2xl font-bold">How many make it to the paywall?</h2>
                    <p className="text-slate-300 text-sm mt-2 max-w-xl">{data.paywallAfterExperience} of {data.started} starters reached the new paywall after welcoming Adam to their island.</p></div>
                <div><strong className="text-4xl">{data.started ? `${data.paywallAfterExperienceRate}%` : '—'}</strong><p className="text-xs text-sky-200 mt-1">Splash → finished experience → paywall</p></div>
            </div>
            <p className="text-xs text-slate-300 mt-5">All paywall arrivals from this cohort: {data.paywall} ({data.paywallRate}%), including reopen shortcuts. The Parent entry filter applies to the parent report only; the platform and date filters apply here.</p>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
            <Stat icon={Users} label="Splash starters" value={String(data.started)} hint="Unique device journeys" />
            <Stat icon={CheckCircle} label="Avatars created" value={String(data.avatarCompleted)} />
            <Stat icon={TreePalm} label={storyFirst?"Island reached":"Island tasks done"} value={String(storyFirst?data.island:data.islandCompleted)} hint={storyFirst?"Ready-made home for Adam":`${data.island} loaded the island`} />
            <Stat icon={Ship} label={storyFirst?"Adam welcomed":"Ship tours done"} value={String(storyFirst?data.funnel.find(s=>s.stepKey==='exp_adam_home')?.count||0:data.tourCompleted)} />
            <Stat icon={Library} label="Story packs done" value={String(data.storyPackCompleted)} />
            <Stat icon={ArrowRight} label="Parent intro reached" value={String(data.parentIntro)} hint={`${data.parentIntroRate}% of splash starters`} />
        </div>
        {!data.started && <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">Ready to measure new starters. Story-first tracking begins with this update. Earlier island-first results are preserved in the section below. Existing parent-flow history remains below.</p>}
        <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-5">
            <section className="bg-white border rounded-xl p-5 overflow-x-auto">
                <h3 className="text-lg font-semibold">From first splash to the new paywall</h3>
                <p className="text-sm text-gray-500 mt-1 mb-5">Unique journeys at each step, as a percentage of splash starters. Counts show observed visits; returning users may skip a screen.</p>
                <div className="space-y-3 min-w-[390px]">{data.funnel.map(step => <FunnelRow key={step.stepKey} step={step} />)}</div>
                <p className="text-xs text-gray-500 mt-5">Right: median time to the next observed step, including time away. A missing step means “not reached yet,” not confirmed abandonment.</p>
            </section>
            <div className="space-y-5 min-w-0">
                <section className="bg-white border rounded-xl p-5 overflow-x-auto">
                    <h3 className="text-lg font-semibold">Maybe later vs Start Trial</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-4">First choice among {data.offerViews} early-offer viewers. The trial button says “Try 3 Days Free.”</p>
                    <table className="w-full text-sm text-left min-w-[340px]"><thead className="text-gray-500 border-b"><tr><th className="pb-2">Choice</th><th>Journeys</th><th>Island</th><th>Paywall</th></tr></thead><tbody>{data.branches.map(b => <tr className="border-b last:border-0" key={b.key}><th className="font-medium py-3">{b.label}</th><td>{b.count} <span className="text-xs text-gray-500">({b.rate}%)</span></td><td>{b.island}</td><td>{b.paywall}</td></tr>)}</tbody></table>
                    <p className="text-xs text-gray-500 mt-4">{data.trialTaps} tapped trial · {data.trialCheckouts} requested checkout · {data.changedChoice} tried both choices. These are actions, not verified subscriptions.</p>
                </section>
                <section className="bg-white border rounded-xl p-5">
                    <h3 className="text-lg font-semibold">{storyFirst?"Optional island activities":"Island tasks"}</h3><p className="text-sm text-gray-500 mt-1 mb-4">{storyFirst?"Available after Adam arrives; these do not block the parent flow.":"Tasks can be finished in a different order."}</p>
                    {data.tasks.map(t => <div className="py-3 border-b last:border-0" key={t.key}><div className="flex justify-between text-sm gap-2"><span className="font-medium">{t.label}</span><strong>{t.count} / {data.island}</strong></div><div className="h-1.5 rounded-full bg-gray-100 mt-2"><div className="h-full rounded-full bg-emerald-500" style={{width:`${t.rate}%`}} /></div><p className="text-xs text-gray-500 mt-1">{t.remaining} haven’t finished yet</p></div>)}
                </section>
                <section className="bg-amber-50 border border-amber-100 rounded-xl p-5"><h3 className="font-semibold">Biggest gaps before the paywall</h3>{data.dropoffs.length ? data.dropoffs.map(d => <div className="flex justify-between gap-3 border-b border-amber-100 py-3 text-sm last:border-0" key={d.stepKey}><span>{d.from} → {d.step}</span><strong className="shrink-0">{d.dropFromPrevious} · {d.dropRate}%</strong></div>) : <p className="text-sm text-gray-600 mt-2">No gaps recorded yet.</p>}</section>
            </div>
        </div>
        <p className="text-xs text-gray-500">This section includes only journeys first seen on the updated splash screen. Reopening doesn’t create another starter. Test purchases are excluded. {data.firstTrackedAt && `Earliest starter in this cohort: ${formatWhen(data.firstTrackedAt, true)}.`}</p>
    </section>;
}

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

function LifeSection({ life }: { life: Life }) {
    const packHint = life.scanned < life.familiesActive
        ? `Among the ${life.scanned.toLocaleString()} most recently active`
        : `${life.familiesWithPack.toLocaleString()} families finished at least one`;
    return (
        <div className="space-y-4">
            <section className="space-y-3">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Who comes back</h2>
                    <p className="text-sm text-gray-500">
                        Families who signed up in this range. A day counts when they were still active that many days after they joined.
                    </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <RetentionCard label="Came back" slot={life.retention.cameBack} hint="Active on a later day" />
                    <RetentionCard label="Next day" slot={life.retention.day1} hint="Still active after 1 day" />
                    <RetentionCard label="Day 7" slot={life.retention.day7} hint="Still active after 7 days" />
                    <RetentionCard label="Day 30" slot={life.retention.day30} hint="Still active after 30 days" />
                </div>
            </section>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={Library} label="Story packs finished" value={life.packsCompleted.toLocaleString()} hint={packHint} />
                <Stat icon={Ship} label="Boat sessions" value={life.boatSessions.toLocaleString()} hint={life.boatFamilies ? `${life.boatFamilies.toLocaleString()} families` : 'Recorded as families open the boat'} />
                <Stat icon={MessageCircle} label="Character talks" value={life.characterTalks.toLocaleString()} hint={life.characterMessages ? `${life.characterMessages.toLocaleString()} were messages from a child` : 'Opens and messages with the crew'} />
                <Stat icon={CalendarDays} label="App sessions" value={life.appSessions.toLocaleString()} hint={`Lifetime sessions for the ${life.familiesActive.toLocaleString()} families active in this range`} />
            </div>

            {life.friends && <FriendsWorldSection friends={life.friends} />}

            <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 pt-6 pb-3">
                    <h2 className="text-lg font-semibold text-gray-900">Each family</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        The {life.people.length.toLocaleString()} most recently active families. Packs, books, and sessions are already saved on the account. Boat visits, character talks, and Friends World fill in from the current app.
                    </p>
                </div>
                {life.people.length === 0 ? (
                    <p className="px-6 pb-6 text-sm text-gray-500">No families were active in this range.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[1040px] w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-y border-gray-100">
                                    <th className="px-6 py-2 font-medium">Family</th>
                                    <th className="px-3 py-2 font-medium">Signed up</th>
                                    <th className="px-3 py-2 font-medium">Last active</th>
                                    <th className="px-3 py-2 font-medium">Session time</th>
                                    <th className="px-3 py-2 font-medium">Came back</th>
                                    <th className="px-3 py-2 font-medium text-right">Sessions</th>
                                    <th className="px-3 py-2 font-medium text-right">Packs</th>
                                    <th className="px-3 py-2 font-medium text-right">Boat</th>
                                    <th className="px-3 py-2 font-medium text-right">Talks</th>
                                    <th className="px-3 py-2 font-medium text-right">Friends World</th>
                                    <th className="px-3 py-2 font-medium">Tutorial</th>
                                    <th className="px-6 py-2 font-medium">Plan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {life.people.map((person) => {
                                    const time = formatSessionTime(person.timeSpentSeconds || 0, person.sessions);
                                    return (
                                    <tr key={person.id} className="border-b border-gray-50 align-top">
                                        <td className="px-6 py-3">
                                            <p className="font-medium text-gray-900">{person.name}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {[
                                                    person.kids.length ? person.kids.join(', ') : '',
                                                    `${person.booksRead} books`,
                                                    `${person.lessonsCompleted} lessons`,
                                                    `${person.quizzesCompleted} quizzes`,
                                                ].filter(Boolean).join(' · ')}
                                            </p>
                                        </td>
                                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{formatWhen(person.createdAt, true)}</td>
                                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{formatWhen(person.lastActiveAt)}</td>
                                        <td className="px-3 py-3 text-gray-900 whitespace-nowrap">
                                            <p>{time.total}</p>
                                            {time.average && <p className="text-xs text-gray-500">{time.average}</p>}
                                        </td>
                                        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
                                            {person.cameBack
                                                ? `${person.daysRetained ?? 0}d`
                                                : 'Same day'}
                                        </td>
                                        <td className="px-3 py-3 text-right text-gray-900">{person.sessions.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right text-gray-900" title={`${person.packsStarted} started`}>
                                            {person.packsCompleted.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-3 text-right text-gray-900">{person.boatSessions.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right text-gray-900">{person.characterTalks.toLocaleString()}</td>
                                        <td className="px-3 py-3 text-right text-gray-900 whitespace-nowrap">
                                            {(person.friendsVisits || 0).toLocaleString()}
                                            {person.friendsTimeMs ? <span className="text-xs text-gray-500"> · {formatDuration(person.friendsTimeMs)}</span> : null}
                                        </td>
                                        <td className="px-3 py-3 text-gray-700">{person.tutorial || '—'}</td>
                                        <td className="px-6 py-3 text-gray-700 whitespace-nowrap">{PLAN_LABELS[person.plan] || person.plan}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Who they talk to</h2>
                <p className="text-sm text-gray-500 mb-4">
                    {life.characterFamilies
                        ? `${life.characterFamilies.toLocaleString()} families opened a character in this range.`
                        : 'Character talks show up when a child opens someone on the crew.'}
                </p>
                {life.topCharacters.length === 0 ? (
                    <p className="text-sm text-gray-400">No character talks in this range yet.</p>
                ) : (
                    <div className="space-y-2">
                        {life.topCharacters.map((row) => (
                            <div key={row.name} className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-medium text-gray-800">{row.name}</span>
                                <span className="text-gray-500">
                                    {row.talks.toLocaleString()} talks{row.messages ? ` · ${row.messages.toLocaleString()} messages` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function FriendsWorldSection({ friends }: { friends: Friends }) {
    const { players, others } = friends.retention;
    const peak = Math.max(1, ...friends.byDay.map((row) => row.visits));
    const lift = (a: RetentionSlot, b: RetentionSlot) => (a.rate == null || b.rate == null ? null : a.rate - b.rate);
    const rows: { label: string; players: RetentionSlot; others: RetentionSlot }[] = [
        { label: 'Came back', players: players.cameBack, others: others.cameBack },
        { label: 'Next day', players: players.day1, others: others.day1 },
        { label: 'Day 7', players: players.day7, others: others.day7 },
    ];
    return (
        <section className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Friends World</h2>
                <p className="text-sm text-gray-500">
                    The island game opened from the ship. A visit starts when the island is ready and ends when the family leaves the page.
                </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Stat icon={TreePalm} label="Visits" value={friends.visits.toLocaleString()} hint={friends.families ? `${friends.families.toLocaleString()} families` : 'Counted as families open the island'} />
                <Stat icon={Clock} label="Typical visit" value={formatDuration(friends.medianVisitMs)} hint={friends.timedVisits ? `${friends.longVisits.toLocaleString()} of ${friends.timedVisits.toLocaleString()} visits lasted 5 min or more` : 'Time shows once a visit has ended'} />
                <Stat icon={Repeat} label="Came back to the island" value={friends.returningFamilies.toLocaleString()} hint={friends.families ? `${Math.round((friends.returningFamilies / friends.families) * 100)}% of families visited more than once` : 'Families with two or more visits'} />
                <Stat icon={MousePointerClick} label="Things they did" value={friends.actions.toLocaleString()} hint={`${formatDuration(friends.totalTimeMs)} on the island in total`} />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-1">Is it working for retention?</h3>
                    <p className="text-sm text-gray-500 mb-4">
                        New families in this range, split by whether they played Friends World ({players.size.toLocaleString()} played · {others.size.toLocaleString()} did not).
                    </p>
                    {players.size === 0 && others.size === 0 ? (
                        <p className="text-sm text-gray-400">No new families in this range yet.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 border-b border-gray-100">
                                    <th className="py-2 font-medium">Still active</th>
                                    <th className="py-2 font-medium text-right">Played</th>
                                    <th className="py-2 font-medium text-right">Did not</th>
                                    <th className="py-2 font-medium text-right">Lift</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const delta = lift(row.players, row.others);
                                    return (
                                        <tr key={row.label} className="border-b border-gray-50">
                                            <td className="py-2 text-gray-700">{row.label}</td>
                                            <td className="py-2 text-right text-gray-900" title={`${row.players.retained} of ${row.players.eligible}`}>{row.players.rate == null ? '—' : `${row.players.rate}%`}</td>
                                            <td className="py-2 text-right text-gray-900" title={`${row.others.retained} of ${row.others.eligible}`}>{row.others.rate == null ? '—' : `${row.others.rate}%`}</td>
                                            <td className={`py-2 text-right font-semibold ${delta == null ? 'text-gray-400' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-gray-500'}`}>
                                                {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta} pts`}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    {players.size > 0 && players.size < 20 && (
                        <p className="text-xs text-gray-400 mt-3">Fewer than 20 players so far; treat the lift as a hint, not a result.</p>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-1">What they do there</h3>
                    <p className="text-sm text-gray-500 mb-4">Each action once, with the friends it involved most.</p>
                    {friends.actionMix.every((row) => row.count === 0) ? (
                        <p className="text-sm text-gray-400">Actions show up as children drop friends off, play as them, and talk to them.</p>
                    ) : (
                        <div className="space-y-3">
                            {friends.actionMix.filter((row) => row.count > 0).map((row) => (
                                <div key={row.source} className="text-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-gray-800">{row.label}</span>
                                        <span className="text-gray-500 whitespace-nowrap">{row.count.toLocaleString()} · {row.families.toLocaleString()} {row.families === 1 ? 'family' : 'families'}</span>
                                    </div>
                                    {row.top.length > 0 && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {row.top.map((item) => `${item.name} ${item.count}`).join(' · ')}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {friends.byDay.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-3">Visits by day</h3>
                    <div className="flex items-end gap-1 h-24">
                        {friends.byDay.map((row) => (
                            <div key={row.day} className="flex-1 flex flex-col items-center justify-end h-full" title={`${row.day}: ${row.visits} visits from ${row.families} families`}>
                                <div className="w-full rounded-t bg-gradient-to-t from-emerald-500 to-emerald-400" style={{ height: `${Math.max(4, (row.visits / peak) * 100)}%` }} />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                        <span>{friends.byDay[0].day}</span>
                        <span>{friends.byDay[friends.byDay.length - 1].day}</span>
                    </div>
                </div>
            )}
        </section>
    );
}

function RetentionCard({ label, slot, hint }: { label: string; slot: RetentionSlot; hint: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-gray-500 text-sm">{label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{slot.rate == null ? '—' : `${slot.rate}%`}</p>
            <p className="text-xs text-gray-500 mt-1">
                {slot.eligible ? `${slot.retained.toLocaleString()} of ${slot.eligible.toLocaleString()} families` : 'Not enough time yet'}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
        </div>
    );
}

function FunnelRow({ step }: { step: FunnelStep }) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-40 sm:w-56 shrink-0 text-xs sm:text-sm font-medium text-gray-700" title={step.step}>{step.step}</div>
            <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden relative">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-200 to-indigo-300"
                    style={{ width: `${Math.min(100, Math.max(step.count > 0 ? 2 : 0, step.rate))}%` }}
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
