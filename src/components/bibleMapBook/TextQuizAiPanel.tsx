import React, { useEffect, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import apiClient from '../../services/apiClient';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface TextQuizAiPanelProps {
    /** Saved pack id — the panel needs a saved story to write scripts/quiz to. */
    storyId: string;
    title?: string;
    scriptureRef?: string;
    verse?: string;
    /** Called after both scripts + quiz are generated — parent should reload. */
    onComplete: (storyId: string) => void;
}

/**
 * Text-only AI feature: generates the age-leveled book text
 * (Ages 3–5 / 6–7 / 8+) and 7 quiz questions per level (easy / medium / hard)
 * in one click. Never generates or touches images — existing page artwork is
 * preserved (scripts are updated in place on the pages).
 */
const TextQuizAiPanel: React.FC<TextQuizAiPanelProps> = ({
    storyId,
    title,
    scriptureRef,
    verse,
    onComplete,
}) => {
    const [sourceText, setSourceText] = useState(verse || '');
    const [pageCount, setPageCount] = useState(5);
    const [busy, setBusy] = useState(false);
    const [scriptsStep, setScriptsStep] = useState<StepStatus>('pending');
    const [quizStep, setQuizStep] = useState<StepStatus>('pending');
    const [stepMessages, setStepMessages] = useState<{ scripts?: string; quiz?: string }>({});
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (verse && !sourceText) setSourceText(verse);
        // Prefill once when the verse loads; don't clobber user edits after.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verse]);

    const extractErrorMessage = (err: unknown, fallback: string): string =>
        (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
            ?.message ||
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        fallback;

    const handleGenerate = async () => {
        setError(null);
        const trimmed = sourceText.trim();
        if (trimmed.length < 40) {
            setError(
                'Paste a short source story first (at least a few sentences of the Bible story or scripture passage).',
            );
            return;
        }
        const confirmed = window.confirm(
            `Generate ${pageCount} pages of book text for all three age levels (3–5 / 6–7 / 8+) and 7 quiz questions per difficulty with AI?\n\nExisting page text and quiz questions will be replaced. Images are NOT generated or changed.`,
        );
        if (!confirmed) return;

        setBusy(true);
        setScriptsStep('running');
        setQuizStep('pending');
        setStepMessages({});
        let scriptsDone = false;

        try {
            // 1) Age-leveled book text — no images, keep existing page artwork
            const scriptsRes = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-reading-levels`,
                {
                    sourceText: trimmed,
                    pageCount,
                    scriptureRef: scriptureRef?.trim() || undefined,
                    title: title?.trim() || undefined,
                    generateImages: false,
                    preserveMedia: true,
                },
                { timeout: 300000 },
            );
            const pagesMade =
                scriptsRes.data?.pageCount ?? scriptsRes.data?.pages?.length ?? 0;
            scriptsDone = true;
            setScriptsStep('done');
            setStepMessages((prev) => ({
                ...prev,
                scripts: `${pagesMade} pages × 3 age levels`,
            }));

            // 2) Quiz questions for all three levels, grounded in the new scripts
            setQuizStep('running');
            const quizRes = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-quiz`,
                {},
                { timeout: 300000 },
            );
            const questionCount = quizRes.data?.questionCount ?? 0;
            setQuizStep('done');
            setStepMessages((prev) => ({
                ...prev,
                quiz: `${questionCount} questions across easy / medium / hard`,
            }));

            onComplete(storyId);
        } catch (err: unknown) {
            console.error(err);
            if (!scriptsDone) {
                setScriptsStep('error');
                setError(extractErrorMessage(err, 'Failed to generate age scripts'));
            } else {
                setQuizStep('error');
                setError(extractErrorMessage(err, 'Failed to generate quiz questions'));
            }
        } finally {
            setBusy(false);
        }
    };

    const renderStep = (label: string, status: StepStatus, message?: string) => (
        <li className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0">
                {status === 'done' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                ) : status === 'running' ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
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
                                ? 'text-indigo-800 font-medium'
                                : 'text-gray-600'
                    }
                >
                    {label}
                </span>
                {message ? (
                    <span className="block text-xs text-gray-500 mt-0.5">{message}</span>
                ) : null}
            </span>
        </li>
    );

    const showSteps = busy || scriptsStep !== 'pending' || quizStep !== 'pending';

    return (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="rounded-lg bg-indigo-100 p-2 text-indigo-800">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-900">
                        AI text + quiz (no images)
                    </h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                        Writes the book text for Ages 3–5 / 6–7 / 8+ and 7 quiz questions per
                        difficulty from your source story. Images are never generated or
                        changed — existing page artwork stays as is.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Source story
                    </label>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        rows={3}
                        disabled={busy}
                        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
                        placeholder="Paste 2–6 sentences of the Bible story plot or a scripture passage…"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pages</label>
                    <select
                        value={pageCount}
                        onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                        disabled={busy}
                        className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-60"
                    >
                        {Array.from({ length: 10 }, (_, i) => i + 3).map((n) => (
                            <option key={n} value={n}>
                                {n} pages
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={busy}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
                {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Sparkles className="w-4 h-4" />
                )}
                {busy ? 'Generating…' : 'Generate text + quiz'}
            </button>

            {error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {error}
                </div>
            ) : null}

            {showSteps ? (
                <ul className="bg-white/80 border border-indigo-100 rounded-lg p-3 space-y-1.5">
                    {renderStep(
                        'Book text · Ages 3–5 / 6–7 / 8+',
                        scriptsStep,
                        stepMessages.scripts,
                    )}
                    {renderStep(
                        'Quiz questions · easy / medium / hard',
                        quizStep,
                        stepMessages.quiz,
                    )}
                </ul>
            ) : null}
        </div>
    );
};

export default TextQuizAiPanel;
