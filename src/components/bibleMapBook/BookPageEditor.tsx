import React, { useEffect, useRef, useState } from 'react';
import {
    Image as ImageIcon,
    Film,
    Loader2,
    Replace,
    ScrollText,
    Sparkles,
    Trash2,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import BookPhonePreview from './BookPhonePreview';
import type { ReadingLevelKey, ReadingPageDraft } from './types';
import { READING_LEVELS } from './types';
import { sanitizeInteractiveWordIndices } from '../../utils/interactiveWords';

interface BookPageEditorProps {
    page: ReadingPageDraft;
    bookId: string;
    level: ReadingLevelKey;
    bookPages?: ReadingPageDraft[];
    /** Book-level looping background music (files.audio) */
    backgroundMusicUrl?: string;
    onLevelChange: (level: ReadingLevelKey) => void;
    onChange: (next: ReadingPageDraft) => void;
    /** Optional extra art-direction prompt from CMS when regenerating this page */
    onGenerateImage?: (extraPrompt?: string) => void;
    generatingImage?: boolean;
    generateImageDisabled?: boolean;
}

const BookPageEditor: React.FC<BookPageEditorProps> = ({
    page,
    bookId,
    level,
    bookPages,
    backgroundMusicUrl,
    onLevelChange,
    onChange,
    onGenerateImage,
    generatingImage = false,
    generateImageDisabled = false,
}) => {
    const bgRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState<string | null>(null);
    const [showExtraPrompt, setShowExtraPrompt] = useState(false);
    const [extraPrompt, setExtraPrompt] = useState('');

    useEffect(() => {
        setShowExtraPrompt(false);
        setExtraPrompt('');
    }, [page.pageNumber]);

    const patch = (partial: Partial<ReadingPageDraft>) => onChange({ ...page, ...partial });

    const patchLevel = (
        key: ReadingLevelKey,
        partial: { text?: string; interactiveWordIndices?: number[] },
    ) => {
        const prev = page.readingLevels[key];
        const text = partial.text !== undefined ? partial.text : prev.text;
        const indices =
            partial.interactiveWordIndices !== undefined
                ? sanitizeInteractiveWordIndices(text, partial.interactiveWordIndices)
                : sanitizeInteractiveWordIndices(text, prev.interactiveWordIndices);
        onChange({
            ...page,
            readingLevels: {
                ...page.readingLevels,
                [key]: { text, interactiveWordIndices: indices },
            },
        });
    };

    const upload = async (file: File, kind: 'background' | 'scroll' | 'video') => {
        setUploading(kind);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const isVideo = kind === 'video' || file.type.startsWith('video/');
            // Backend expects pages/scroll (same as PageEditor) — not "background"
            const uploadType =
                kind === 'scroll' ? 'scroll' : isVideo || kind === 'background' ? 'pages' : kind;
            const endpoint = isVideo
                ? `/api/upload/video?bookId=${encodeURIComponent(bookId)}&type=${uploadType}`
                : `/api/upload/image?bookId=${encodeURIComponent(bookId)}&type=${uploadType}`;
            const res = await apiClient.post(endpoint, formData);
            const url = res.data.url as string;
            if (kind === 'scroll') {
                patch({ scrollUrl: url });
            } else if (isVideo) {
                const backgroundAudioUrl =
                    typeof res.data.backgroundAudioUrl === 'string'
                        ? res.data.backgroundAudioUrl
                        : undefined;
                patch({
                    backgroundUrl: url,
                    backgroundType: 'video',
                    backgroundAudioUrl,
                });
            } else {
                patch({
                    backgroundUrl: url,
                    backgroundType: 'image',
                    backgroundAudioUrl: undefined,
                });
            }
        } catch (err: unknown) {
            console.error(err);
            const apiMsg =
                (err as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ||
                (err as { message?: string })?.message ||
                'Unknown error';
            alert(`Failed to upload ${kind}: ${apiMsg}`);
        } finally {
            setUploading(null);
        }
    };

    const clearBackground = () => {
        if (!page.backgroundUrl) return;
        if (!window.confirm('Remove this page’s background image/video?')) return;
        patch({
            backgroundUrl: '',
            backgroundType: 'image',
            backgroundAudioUrl: undefined,
        });
    };

    const clearScroll = () => {
        if (!page.scrollUrl) return;
        if (!window.confirm('Clear custom scroll? The default parchment will be used on save.')) {
            return;
        }
        patch({ scrollUrl: '' });
    };

    const bgPreviewUrl = page.backgroundUrl ? getMediaUrl(page.backgroundUrl) : '';
    const scrollPreviewUrl = page.scrollUrl ? getMediaUrl(page.scrollUrl) : '';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                        Page {page.pageNumber} · shared media
                    </h3>

                    {/* Background image / video */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 mb-3">
                        <div className="flex items-start gap-3">
                            <div className="w-20 h-[6.5rem] rounded-lg overflow-hidden bg-[#2d5a3d] border border-gray-200 shrink-0 flex items-center justify-center">
                                {bgPreviewUrl ? (
                                    page.backgroundType === 'video' ? (
                                        <video
                                            src={bgPreviewUrl}
                                            className="w-full h-full object-cover"
                                            muted
                                            playsInline
                                        />
                                    ) : (
                                        <img
                                            src={bgPreviewUrl}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    )
                                ) : (
                                    <ImageIcon className="w-6 h-6 text-white/50" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div>
                                    <p className="text-xs font-medium text-gray-800">
                                        Background {page.backgroundType === 'video' ? 'video' : 'image'}
                                    </p>
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                        {page.backgroundUrl
                                            ? page.backgroundUrl.slice(-48)
                                            : 'No image yet — upload or generate one'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <input
                                        ref={bgRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (f) void upload(f, 'background');
                                        }}
                                    />
                                    <input
                                        ref={videoRef}
                                        type="file"
                                        accept="video/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (f) void upload(f, 'video');
                                        }}
                                    />
                                    {onGenerateImage ? (
                                        <button
                                            type="button"
                                            disabled={
                                                !!uploading ||
                                                generatingImage ||
                                                generateImageDisabled
                                            }
                                            onClick={() =>
                                                setShowExtraPrompt((open) => !open)
                                            }
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-700 disabled:opacity-50"
                                            title="AI-generate a new image for this page only"
                                        >
                                            {generatingImage ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-3.5 h-3.5" />
                                            )}
                                            {generatingImage
                                                ? 'Generating…'
                                                : page.backgroundUrl
                                                  ? 'Regenerate this page'
                                                  : 'Generate this page'}
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        disabled={!!uploading || generatingImage}
                                        onClick={() => bgRef.current?.click()}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {page.backgroundUrl ? (
                                            <Replace className="w-3.5 h-3.5" />
                                        ) : (
                                            <ImageIcon className="w-3.5 h-3.5" />
                                        )}
                                        {uploading === 'background'
                                            ? 'Uploading…'
                                            : page.backgroundUrl
                                              ? 'Replace image'
                                              : 'Upload image'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!!uploading || generatingImage}
                                        onClick={() => videoRef.current?.click()}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <Film className="w-3.5 h-3.5" />
                                        {uploading === 'video'
                                            ? 'Uploading…'
                                            : page.backgroundType === 'video' && page.backgroundUrl
                                              ? 'Replace video'
                                              : 'Video BG'}
                                    </button>
                                    {page.backgroundUrl ? (
                                        <button
                                            type="button"
                                            disabled={!!uploading || generatingImage}
                                            onClick={clearBackground}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    ) : null}
                                </div>
                                {onGenerateImage && showExtraPrompt && !generatingImage ? (
                                    <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5 space-y-2">
                                        <label className="block text-xs font-medium text-gray-800">
                                            Extra prompt (optional)
                                        </label>
                                        <textarea
                                            value={extraPrompt}
                                            onChange={(e) => setExtraPrompt(e.target.value)}
                                            rows={2}
                                            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white"
                                            placeholder='e.g. "Eve should not be in this scene", "show the garden from above"'
                                        />
                                        <div className="flex flex-wrap gap-1.5">
                                            <button
                                                type="button"
                                                disabled={!!uploading || generateImageDisabled}
                                                onClick={() => {
                                                    const prompt = extraPrompt.trim();
                                                    setShowExtraPrompt(false);
                                                    setExtraPrompt('');
                                                    onGenerateImage(prompt || undefined);
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-700 disabled:opacity-50"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                                {page.backgroundUrl
                                                    ? 'Regenerate image'
                                                    : 'Generate image'}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowExtraPrompt(false);
                                                    setExtraPrompt('');
                                                }}
                                                className="inline-flex items-center px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Scroll parchment */}
                    <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3">
                        <div className="flex items-start gap-3">
                            <div className="w-20 h-14 rounded-lg overflow-hidden bg-[#f0e4cc] border border-gray-200 shrink-0 flex items-center justify-center">
                                {scrollPreviewUrl ? (
                                    <img
                                        src={scrollPreviewUrl}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <ScrollText className="w-5 h-5 text-amber-800/40" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div>
                                    <p className="text-xs font-medium text-gray-800">Scroll parchment</p>
                                    <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                        {page.scrollUrl
                                            ? page.scrollUrl.slice(-48)
                                            : 'Using default parchment'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <input
                                        ref={scrollRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            e.target.value = '';
                                            if (f) void upload(f, 'scroll');
                                        }}
                                    />
                                    <button
                                        type="button"
                                        disabled={!!uploading}
                                        onClick={() => scrollRef.current?.click()}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        {page.scrollUrl ? (
                                            <Replace className="w-3.5 h-3.5" />
                                        ) : (
                                            <ScrollText className="w-3.5 h-3.5" />
                                        )}
                                        {uploading === 'scroll'
                                            ? 'Uploading…'
                                            : page.scrollUrl
                                              ? 'Replace scroll'
                                              : 'Upload scroll'}
                                    </button>
                                    {page.scrollUrl ? (
                                        <button
                                            type="button"
                                            disabled={!!uploading}
                                            onClick={clearScroll}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Delete
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs mb-2">
                        {READING_LEVELS.map((l) => (
                            <button
                                key={l.key}
                                type="button"
                                onClick={() => onLevelChange(l.key)}
                                className={`flex-1 px-2 py-1.5 ${
                                    level === l.key
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-white text-gray-600 hover:bg-gray-50'
                                } ${l.key !== 'ages_3_5' ? 'border-l border-gray-200' : ''}`}
                            >
                                {l.short}
                            </button>
                        ))}
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Text · {READING_LEVELS.find((l) => l.key === level)?.label}
                    </label>
                    <textarea
                        value={page.readingLevels[level].text}
                        onChange={(e) => patchLevel(level, { text: e.target.value })}
                        rows={6}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Age-appropriate story text for this page…"
                    />
                </div>
            </div>

            <BookPhonePreview
                page={page}
                level={level}
                bookPages={bookPages}
                backgroundMusicUrl={backgroundMusicUrl}
                editTapWords
                onChangeLevelText={patchLevel}
            />
        </div>
    );
};

export default BookPageEditor;
