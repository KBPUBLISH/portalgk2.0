import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Play, Plus, Trash2, Upload, X } from 'lucide-react';
import { getMediaUrl } from '../services/apiClient';

export type TryItPromptType = 'statement' | 'fill_blank' | 'practice_write';

export interface TryItPrompt {
    type: TryItPromptType;
    text: string;
    blanks?: number;
}

export interface TryItState {
    videoUrl: string;
    prompts: TryItPrompt[];
}

export const emptyTryIt = (): TryItState => ({
    videoUrl: '',
    prompts: [],
});

export const emptyTryItPrompt = (type: TryItPromptType = 'statement'): TryItPrompt => ({
    type,
    text: '',
    blanks: type === 'fill_blank' ? 1 : undefined,
});

const TYPE_META: Record<TryItPromptType, { label: string; hint: string; placeholder: string }> = {
    statement: {
        label: 'Statement',
        hint: 'Show text only — kids just read it (no writing).',
        placeholder: 'God made you on purpose.',
    },
    fill_blank: {
        label: 'Fill in the blank',
        hint: 'Practice only — answers are not saved. Use ___ in the text or set a blank count.',
        placeholder: 'God made the ___ and the ___.',
    },
    practice_write: {
        label: 'Practice write',
        hint: 'Kids can type locally — text is discarded and never saved to the server.',
        placeholder: 'What are 3 things you are grateful for God today?',
    },
};

interface BibleMapTryItPanelProps {
    value: TryItState;
    onChange: (next: TryItState) => void;
    onUploadVideo: (file: File) => Promise<string>;
}

const BibleMapTryItPanel: React.FC<BibleMapTryItPanelProps> = ({
    value,
    onChange,
    onUploadVideo,
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const updatePrompts = (prompts: TryItPrompt[]) => onChange({ ...value, prompts });

    const patchPrompt = (index: number, patch: Partial<TryItPrompt>) => {
        updatePrompts(
            value.prompts.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        );
    };

    const movePrompt = (index: number, dir: -1 | 1) => {
        const next = index + dir;
        if (next < 0 || next >= value.prompts.length) return;
        const copy = [...value.prompts];
        const [item] = copy.splice(index, 1);
        copy.splice(next, 0, item);
        updatePrompts(copy);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('video/') && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
            alert('Please upload a video file (MP4, MOV, or WebM)');
            return;
        }
        setUploading(true);
        try {
            const url = await onUploadVideo(file);
            onChange({ ...value, videoUrl: url });
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to upload Try It video';
            alert(msg);
        } finally {
            setUploading(false);
        }
    };

    const previewUrl = value.videoUrl ? getMediaUrl(value.videoUrl) : '';
    const hasVideo = !!value.videoUrl.trim();
    const filledPrompts = value.prompts.filter((p) => p.text.trim()).length;

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-lg font-semibold text-gray-900">Try It</h2>
                <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                    Optional reflection after the story — not a scored quiz. Upload a video, then
                    add one or more prompts (statement, fill-in-the-blank, or practice write).
                    Kids’ typed answers stay on the device and are never saved.
                </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-800">Try It video</label>
                    {hasVideo && (
                        <button
                            type="button"
                            onClick={() => onChange({ ...value, videoUrl: '' })}
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                        >
                            <X className="w-3.5 h-3.5" />
                            Remove video
                        </button>
                    )}
                </div>
                {previewUrl ? (
                    <video
                        key={previewUrl}
                        src={previewUrl}
                        controls
                        className="w-full max-w-xl rounded-lg border border-gray-200 bg-black max-h-72"
                    />
                ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Play className="w-4 h-4" />
                        No video yet — upload to enable Try It in the kids app later.
                    </div>
                )}
                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => void handleUpload(e)}
                    />
                    <button
                        type="button"
                        disabled={uploading}
                        onClick={() => fileRef.current?.click()}
                        className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Upload className="w-4 h-4" />
                        )}
                        {uploading ? 'Uploading…' : hasVideo ? 'Replace video' : 'Upload video'}
                    </button>
                    <p className="text-xs text-gray-400 mt-1.5">
                        Uses the same upload as scene videos (multipart field <code>file</code>).
                    </p>
                </div>
            </div>

            {hasVideo && filledPrompts < 1 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Add at least one prompt before saving — Try It with a video requires a minimum
                    of 1 prompt.
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">
                        Prompts
                        {value.prompts.length > 0 && (
                            <span className="ml-2 font-normal text-gray-500">
                                ({filledPrompts} with text)
                            </span>
                        )}
                    </h3>
                    <button
                        type="button"
                        onClick={() =>
                            updatePrompts([...value.prompts, emptyTryItPrompt('statement')])
                        }
                        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                    >
                        <Plus className="w-4 h-4" />
                        Add prompt
                    </button>
                </div>

                {value.prompts.length === 0 && (
                    <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
                        No prompts yet. Add a statement, fill-in-the-blank, or practice write.
                        Empty Try It is fine if you are not using this activity yet.
                    </p>
                )}

                {value.prompts.map((prompt, index) => {
                    const meta = TYPE_META[prompt.type];
                    return (
                        <div
                            key={index}
                            className="rounded-xl border border-gray-200 bg-white p-4 space-y-3"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium text-gray-400 w-6">
                                    {index + 1}
                                </span>
                                <select
                                    value={prompt.type}
                                    onChange={(e) => {
                                        const type = e.target.value as TryItPromptType;
                                        patchPrompt(index, {
                                            type,
                                            blanks:
                                                type === 'fill_blank'
                                                    ? prompt.blanks && prompt.blanks >= 1
                                                        ? prompt.blanks
                                                        : 1
                                                    : undefined,
                                        });
                                    }}
                                    className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                                >
                                    {(Object.keys(TYPE_META) as TryItPromptType[]).map((t) => (
                                        <option key={t} value={t}>
                                            {TYPE_META[t].label}
                                        </option>
                                    ))}
                                </select>
                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={index === 0}
                                        onClick={() => movePrompt(index, -1)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                        aria-label="Move up"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={index === value.prompts.length - 1}
                                        onClick={() => movePrompt(index, 1)}
                                        className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                        aria-label="Move down"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            updatePrompts(
                                                value.prompts.filter((_, i) => i !== index),
                                            )
                                        }
                                        className="p-1.5 text-gray-400 hover:text-red-600"
                                        aria-label="Remove prompt"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">{meta.hint}</p>
                            <textarea
                                value={prompt.text}
                                onChange={(e) => patchPrompt(index, { text: e.target.value })}
                                rows={3}
                                placeholder={meta.placeholder}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
                            />
                            {prompt.type === 'fill_blank' && (
                                <label className="flex items-center gap-2 text-sm text-gray-700">
                                    <span>Number of blanks</span>
                                    <input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={prompt.blanks ?? 1}
                                        onChange={(e) => {
                                            const n = parseInt(e.target.value, 10);
                                            patchPrompt(index, {
                                                blanks: Number.isFinite(n) && n >= 1 ? n : 1,
                                            });
                                        }}
                                        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm"
                                    />
                                    <span className="text-xs text-gray-400">
                                        Optional if you type ___ in the prompt
                                    </span>
                                </label>
                            )}
                        </div>
                    );
                })}

                {value.prompts.length > 0 && (
                    <button
                        type="button"
                        onClick={() =>
                            updatePrompts([...value.prompts, emptyTryItPrompt('practice_write')])
                        }
                        className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                    >
                        <Plus className="w-4 h-4" />
                        Add another prompt
                    </button>
                )}
            </div>
        </div>
    );
};

export default BibleMapTryItPanel;
