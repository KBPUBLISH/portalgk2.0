import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Check, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

const STEPS = [
    { id: 'source', label: 'Source' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'images', label: 'Images' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'puzzle', label: 'Puzzle' },
    { id: 'coloring', label: 'Coloring' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

interface StepState {
    status: 'pending' | 'running' | 'done' | 'error';
    message?: string;
}

interface JobStatus {
    jobId: string;
    storyId: string | null;
    status: 'queued' | 'running' | 'done' | 'error';
    step: string;
    steps: Record<string, StepState>;
    percent: number;
    error: string | null;
    result?: {
        storyId?: string;
        bookId?: string | null;
    } | null;
}

interface OneClickPackPanelProps {
    mode: 'new' | 'existing';
    storyId?: string | null;
    islandId: string;
    title?: string;
    scriptureRef?: string;
    verse?: string;
    verseRef?: string;
    /** Called when job finishes successfully — parent should reload or navigate */
    onComplete: (storyId: string) => void;
}

const OneClickPackPanel: React.FC<OneClickPackPanelProps> = ({
    mode,
    storyId,
    islandId,
    title,
    scriptureRef,
    verse,
    verseRef,
    onComplete,
}) => {
    const [themePrompt, setThemePrompt] = useState('');
    const [sourceText, setSourceText] = useState(verse || '');
    const [busy, setBusy] = useState(false);
    const [job, setJob] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completedRef = useRef(false);

    useEffect(() => {
        if (verse && !sourceText) setSourceText(verse);
    }, [verse, sourceText]);

    useEffect(() => {
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, []);

    const stopPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const pollJob = (jobId: string) => {
        stopPolling();
        completedRef.current = false;
        pollRef.current = setInterval(async () => {
            try {
                const res = await apiClient.get(`/api/bible-map/one-click/${jobId}`);
                const data = res.data as JobStatus;
                setJob(data);
                if (data.storyId && mode === 'new' && !storyId) {
                    // allow parent to know story id early via URL later
                }
                if (data.status === 'done') {
                    stopPolling();
                    setBusy(false);
                    const sid = data.storyId || data.result?.storyId;
                    if (sid && !completedRef.current) {
                        completedRef.current = true;
                        onComplete(String(sid));
                    }
                } else if (data.status === 'error') {
                    stopPolling();
                    setBusy(false);
                    setError(data.error || 'One-click pack failed');
                }
            } catch (err) {
                console.error(err);
                stopPolling();
                setBusy(false);
                setError('Failed to poll one-click job status');
            }
        }, 2500);
    };

    const startFromTheme = async () => {
        setError(null);
        if (!islandId) {
            setError('Select an island first');
            return;
        }
        const prompt = themePrompt.trim();
        if (prompt.length < 8) {
            setError('Describe the Bible story theme in at least a short sentence');
            return;
        }
        setBusy(true);
        setJob(null);
        try {
            const res = await apiClient.post('/api/bible-map/stories/one-click', {
                islandId,
                themePrompt: prompt,
                title: title?.trim() || undefined,
                scriptureRef: scriptureRef?.trim() || undefined,
                verse: verse?.trim() || undefined,
                verseRef: verseRef?.trim() || undefined,
            });
            const jobId = res.data.jobId as string;
            setJob({
                jobId,
                storyId: res.data.storyId || null,
                status: 'queued',
                step: 'source',
                steps: Object.fromEntries(
                    STEPS.map((s) => [s.id, { status: 'pending' as const }]),
                ),
                percent: 0,
                error: null,
            });
            pollJob(jobId);
        } catch (err: unknown) {
            setBusy(false);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to start one-click create';
            setError(msg);
        }
    };

    const startExisting = async () => {
        setError(null);
        if (!storyId) {
            setError('Save the pack first');
            return;
        }
        const confirmed = window.confirm(
            'This will regenerate scripts, images, quiz, puzzle, and coloring for this pack. Continue?',
        );
        if (!confirmed) return;

        setBusy(true);
        setJob(null);
        try {
            const res = await apiClient.post(`/api/bible-map/stories/${storyId}/one-click`, {
                sourceText: sourceText.trim() || undefined,
                title: title?.trim() || undefined,
                scriptureRef: scriptureRef?.trim() || undefined,
            });
            const jobId = res.data.jobId as string;
            setJob({
                jobId,
                storyId: String(storyId),
                status: 'queued',
                step: 'source',
                steps: Object.fromEntries(
                    STEPS.map((s) => [s.id, { status: 'pending' as const }]),
                ),
                percent: 0,
                error: null,
            });
            pollJob(jobId);
        } catch (err: unknown) {
            setBusy(false);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to start one-click generate';
            setError(msg);
        }
    };

    const renderStep = (stepId: StepId, label: string) => {
        const st = job?.steps?.[stepId];
        const status = st?.status || 'pending';
        return (
            <li key={stepId} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0">
                    {status === 'done' ? (
                        <Check className="w-4 h-4 text-emerald-600" />
                    ) : status === 'running' ? (
                        <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
                    ) : status === 'error' ? (
                        <X className="w-4 h-4 text-red-600" />
                    ) : (
                        <span className="inline-block w-4 h-4 rounded-full border border-gray-300" />
                    )}
                </span>
                <span className="min-w-0">
                    <span
                        className={
                            status === 'done'
                                ? 'text-emerald-800 font-medium'
                                : status === 'error'
                                  ? 'text-red-700 font-medium'
                                  : status === 'running'
                                    ? 'text-amber-800 font-medium'
                                    : 'text-gray-600'
                        }
                    >
                        {label}
                    </span>
                    {st?.message ? (
                        <span className="block text-xs text-gray-500 mt-0.5">{st.message}</span>
                    ) : null}
                </span>
            </li>
        );
    };

    return (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-100 p-2 text-amber-800">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">
                        One-click create all
                    </h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                        Builds scripts → images → quizzes → puzzle → coloring in order (uses Book
                        character/style refs). Scene video and game stay manual. Images can take
                        several minutes.
                    </p>
                </div>
            </div>

            {mode === 'new' ? (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Theme / prompt
                    </label>
                    <textarea
                        value={themePrompt}
                        onChange={(e) => setThemePrompt(e.target.value)}
                        rows={3}
                        disabled={busy}
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
                        placeholder="e.g. Creation of Adam and Eve in the garden — Genesis 1–2"
                    />
                    <button
                        type="button"
                        onClick={() => void startFromTheme()}
                        disabled={busy || !islandId}
                        className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
                    >
                        {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {busy ? 'Creating…' : 'One-click create'}
                    </button>
                    {!islandId ? (
                        <p className="text-xs text-amber-800">Select an island above first.</p>
                    ) : null}
                </div>
            ) : (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Source story (optional if spotlight verse is long enough)
                    </label>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        rows={3}
                        disabled={busy}
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
                        placeholder="Paste 2–6 sentences of the Bible story plot…"
                    />
                    <button
                        type="button"
                        onClick={() => void startExisting()}
                        disabled={busy || !storyId}
                        className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
                    >
                        {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {busy ? 'Generating…' : 'One-click generate pack'}
                    </button>
                </div>
            )}

            {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                </div>
            ) : null}

            {job ? (
                <div className="bg-white/80 border border-amber-100 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span>
                            Status: <span className="font-medium text-gray-800">{job.status}</span>
                            {job.storyId ? ` · pack ${job.storyId.slice(-6)}` : ''}
                        </span>
                        <span>{Math.round(job.percent || 0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-amber-600 transition-all duration-500"
                            style={{ width: `${Math.min(100, job.percent || 0)}%` }}
                        />
                    </div>
                    <ul className="space-y-1.5 mt-2">
                        {STEPS.map((s) => renderStep(s.id, s.label))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
};

export default OneClickPackPanel;
