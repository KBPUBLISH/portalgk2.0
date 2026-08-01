import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Check, X, ImagePlus, Palette } from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';

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

interface CharacterOption {
    _id: string;
    displayName: string;
    referenceImageUrl?: string;
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
    const [pageCount, setPageCount] = useState(5);
    const [styleReferenceImageUrl, setStyleReferenceImageUrl] = useState('');
    const [imageProvider, setImageProvider] = useState<'gemini' | 'openai'>('gemini');
    const [characters, setCharacters] = useState<CharacterOption[]>([]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
    const [uploadingStyleRef, setUploadingStyleRef] = useState(false);
    const [busy, setBusy] = useState(false);
    const [job, setJob] = useState<JobStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completedRef = useRef(false);
    const styleRefInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (verse && !sourceText) setSourceText(verse);
    }, [verse, sourceText]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const charsRes = await apiClient.get('/api/bible-map/characters');
                if (cancelled) return;
                const list = Array.isArray(charsRes.data)
                    ? charsRes.data
                    : charsRes.data?.characters || [];
                setCharacters(
                    list.map((c: CharacterOption) => ({
                        _id: String(c._id),
                        displayName: c.displayName || 'Character',
                        referenceImageUrl: c.referenceImageUrl,
                    })),
                );
            } catch (err) {
                console.error(err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (mode !== 'existing' || !storyId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get(`/api/bible-map/stories/${storyId}`);
                if (cancelled) return;
                const story = res.data?.story || res.data;
                const styleUrl = String(story?.styleReferenceImageUrl || '').trim();
                if (styleUrl) setStyleReferenceImageUrl(styleUrl);
                const provider = String(story?.imageProvider || '').toLowerCase();
                if (provider === 'openai' || provider === 'chatgpt') setImageProvider('openai');
                const refs = Array.isArray(story?.referenceCharacterIds)
                    ? story.referenceCharacterIds.map((id: string | { _id?: string }) =>
                          typeof id === 'object' && id?._id ? String(id._id) : String(id),
                      )
                    : [];
                if (refs.length) setSelectedCharacterIds(refs.slice(0, 4));
            } catch (err) {
                console.error(err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [mode, storyId]);

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

    const toggleCharacter = (id: string) => {
        setSelectedCharacterIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4),
        );
    };

    const uploadStyleReference = async (file: File) => {
        setUploadingStyleRef(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post('/api/upload/image?type=map-art', formData);
            const url = String(res.data?.url || '').trim();
            if (!url) throw new Error('No URL returned');
            setStyleReferenceImageUrl(url);
            if (mode === 'existing' && storyId) {
                await apiClient.put(`/api/bible-map/stories/${storyId}`, {
                    styleReferenceImageUrl: url,
                });
            }
        } catch (err) {
            console.error(err);
            setError('Failed to upload style reference image');
        } finally {
            setUploadingStyleRef(false);
        }
    };

    const validateArtSettings = (): boolean => {
        if (!pageCount || pageCount < 3 || pageCount > 12) {
            setError('Choose number of pages (3–12) before running one-click.');
            return false;
        }
        if (!styleReferenceImageUrl.trim()) {
            setError('Upload a style reference image before running one-click.');
            return false;
        }
        return true;
    };

    const artPayload = () => ({
        pageCount,
        styleReferenceImageUrl: styleReferenceImageUrl.trim(),
        referenceCharacterIds: selectedCharacterIds,
        // Backend maps openai → ChatGPT gpt-image-2
        imageProvider: imageProvider === 'openai' ? 'openai' : 'gemini',
    });

    const pollJob = (jobId: string) => {
        stopPolling();
        completedRef.current = false;
        pollRef.current = setInterval(async () => {
            try {
                const res = await apiClient.get(`/api/bible-map/one-click/${jobId}`);
                const data = res.data as JobStatus;
                setJob(data);
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
        if (!validateArtSettings()) return;
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
                ...artPayload(),
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
        if (!validateArtSettings()) return;
        const modelLabel =
            imageProvider === 'openai' ? 'ChatGPT (gpt-image-2)' : 'Gemini';
        const confirmed = window.confirm(
            `This will regenerate ${pageCount} script pages, images, quiz, puzzle, and coloring with ${modelLabel} using your style reference${
                selectedCharacterIds.length
                    ? ` and ${selectedCharacterIds.length} character(s)`
                    : ''
            }. Continue?`,
        );
        if (!confirmed) return;

        setBusy(true);
        setJob(null);
        try {
            const res = await apiClient.post(`/api/bible-map/stories/${storyId}/one-click`, {
                sourceText: sourceText.trim() || undefined,
                title: title?.trim() || undefined,
                scriptureRef: scriptureRef?.trim() || undefined,
                ...artPayload(),
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

    const readyToRun = !!styleReferenceImageUrl.trim() && pageCount >= 3 && pageCount <= 12;

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

    const artSettings = (
        <div className="rounded-lg border border-amber-300 bg-white/90 p-4 space-y-4">
            <p className="text-xs font-semibold text-amber-950 uppercase tracking-wide">
                Required before create all
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                        Number of pages <span className="text-red-600">*</span>
                    </label>
                    <select
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                        disabled={busy}
                        className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
                    >
                        {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => (
                            <option key={n} value={n}>
                                {n} pages
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Age scripts + images will use this page count.
                    </p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                        Image model
                    </label>
                    <div className="flex flex-col gap-2 pt-1">
                        <label className="text-sm text-gray-700 flex items-center gap-1.5">
                            <input
                                type="radio"
                                name="one-click-image-provider"
                                value="gemini"
                                checked={imageProvider === 'gemini'}
                                onChange={() => setImageProvider('gemini')}
                                disabled={busy}
                            />
                            Gemini (flash-image)
                        </label>
                        <label className="text-sm text-gray-700 flex items-center gap-1.5">
                            <input
                                type="radio"
                                name="one-click-image-provider"
                                value="openai"
                                checked={imageProvider === 'openai'}
                                onChange={() => setImageProvider('openai')}
                                disabled={busy}
                            />
                            ChatGPT (gpt-image-2)
                        </label>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                        Selected model is used for book pages, puzzle, and coloring.
                    </p>
                </div>
            </div>

            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium text-amber-950 inline-flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        Style reference <span className="text-red-600">*</span>
                    </label>
                    <input
                        ref={styleRefInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void uploadStyleReference(f);
                        }}
                    />
                    <button
                        type="button"
                        disabled={uploadingStyleRef || busy}
                        onClick={() => styleRefInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-xs text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                    >
                        {uploadingStyleRef ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <ImagePlus className="w-3.5 h-3.5" />
                        )}
                        {styleReferenceImageUrl ? 'Replace style image' : 'Upload style image'}
                    </button>
                </div>
                {styleReferenceImageUrl ? (
                    <div className="flex items-start gap-3">
                        <img
                            src={getMediaUrl(styleReferenceImageUrl)}
                            alt="Story style reference"
                            className="w-20 h-20 rounded-lg object-cover border border-amber-300 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-amber-900/90">
                                Book pages, puzzle, and coloring will match this style.
                            </p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setStyleReferenceImageUrl('')}
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-red-700"
                            >
                                <X className="w-3 h-3" />
                                Remove
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-[11px] text-amber-900/80">
                        Required — upload one reference illustration before running create all.
                    </p>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-violet-900">
                    Character references (recommended)
                </label>
                {characters.length === 0 ? (
                    <p className="text-[11px] text-violet-700/80">
                        No characters in the library yet. You can still run with style only.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {characters.map((c) => {
                            const selected = selectedCharacterIds.includes(c._id);
                            return (
                                <button
                                    key={c._id}
                                    type="button"
                                    disabled={busy}
                                    onClick={() => toggleCharacter(c._id)}
                                    className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition disabled:opacity-50 ${
                                        selected
                                            ? 'border-violet-600 bg-violet-100 text-violet-900'
                                            : 'border-violet-200 bg-white text-gray-700 hover:bg-violet-50'
                                    }`}
                                >
                                    {c.referenceImageUrl ? (
                                        <img
                                            src={getMediaUrl(c.referenceImageUrl)}
                                            alt=""
                                            className="w-8 h-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <span className="w-8 h-8 rounded-full bg-violet-200 inline-block" />
                                    )}
                                    {c.displayName}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

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
                        Set page count + style reference first, then builds scripts → images → quiz
                        → puzzle → coloring. Scene video and game stay manual.
                    </p>
                </div>
            </div>

            {artSettings}

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
                        disabled={busy || !islandId || !readyToRun}
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
                        <p className="text-xs text-amber-800">Select an island on Overview first.</p>
                    ) : !readyToRun ? (
                        <p className="text-xs text-amber-800">
                            Upload a style image and choose page count to enable create all.
                        </p>
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
                        disabled={busy || !storyId || !readyToRun}
                        className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50"
                    >
                        {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        {busy ? 'Generating…' : 'One-click generate pack'}
                    </button>
                    {!readyToRun ? (
                        <p className="text-xs text-amber-800">
                            Upload a style image and choose page count to enable create all.
                        </p>
                    ) : null}
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
