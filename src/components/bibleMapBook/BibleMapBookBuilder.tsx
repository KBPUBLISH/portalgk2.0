import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BookOpen,
    ImagePlus,
    Loader2,
    Music,
    Palette,
    Plus,
    Save,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import BookPageEditor from './BookPageEditor';
import {
    backgroundMusicUrlFromBook,
    emptyReadingPage,
    pageFromApi,
    type ReadingLevelKey,
    type ReadingPageDraft,
} from './types';

/** Match BookEdit default — permanently attenuates uploaded file for soft under-reading */
const BG_MUSIC_UPLOAD_VOLUME = 0.4;

interface BibleMapBookBuilderProps {
    storyId: string;
    bookId: string | null;
    packTitle: string;
    scriptureRef: string;
    verse: string;
    onBookLinked: (bookId: string, book?: { _id: string; title: string; status: string }) => void;
    onCreateBook: () => Promise<void>;
    creatingBook: boolean;
}

interface PortalCharacter {
    _id: string;
    displayName: string;
    referenceImageUrl?: string;
    status?: string;
}

const BibleMapBookBuilder: React.FC<BibleMapBookBuilderProps> = ({
    storyId,
    bookId,
    packTitle,
    scriptureRef,
    verse,
    onBookLinked,
    onCreateBook,
    creatingBook,
}) => {
    const [sourceText, setSourceText] = useState(verse || '');
    const [pageCount, setPageCount] = useState(5);
    const [pages, setPages] = useState<ReadingPageDraft[]>([]);
    const [activePage, setActivePage] = useState(0);
    const [level, setLevel] = useState<ReadingLevelKey>('ages_3_5');
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [saving, setSaving] = useState(false);
    const [characters, setCharacters] = useState<PortalCharacter[]>([]);
    const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
    /** gemini = Vertex + character refs; openai = ChatGPT GPT Image (gpt-image-2) */
    const [imageProvider, setImageProvider] = useState<'gemini' | 'openai'>('gemini');
    /** Story-wide art style reference — matched exactly on every page image */
    const [styleReferenceImageUrl, setStyleReferenceImageUrl] = useState('');
    const [uploadingStyleRef, setUploadingStyleRef] = useState(false);
    const styleRefInputRef = useRef<HTMLInputElement>(null);
    const musicInputRef = useRef<HTMLInputElement>(null);
    const [backgroundMusicUrl, setBackgroundMusicUrl] = useState('');
    const [backgroundMusicFilename, setBackgroundMusicFilename] = useState('');
    const [uploadingMusic, setUploadingMusic] = useState(false);
    const [imageStatus, setImageStatus] = useState<string | null>(null);
    const [generatingPageImage, setGeneratingPageImage] = useState<number | null>(null);

    const applyBookMusic = (book: unknown) => {
        const url = backgroundMusicUrlFromBook(book);
        setBackgroundMusicUrl(url);
        const files = (book as { files?: { audio?: Array<{ filename?: string; url?: string }> } })
            ?.files;
        const tracks = Array.isArray(files?.audio) ? files.audio : [];
        const match = tracks.find((t) => t?.url === url);
        setBackgroundMusicFilename(String(match?.filename || '').trim());
    };

    const loadPages = useCallback(async () => {
        if (!storyId) return;
        setLoading(true);
        try {
            const res = await apiClient.get(`/api/bible-map/stories/${storyId}/reading-pages`);
            if (res.data.bookId && !bookId) {
                onBookLinked(res.data.bookId, res.data.book);
            }
            if (res.data.book) {
                applyBookMusic(res.data.book);
            }
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : [];
            setPages(list.length ? list : []);
            setActivePage(0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [storyId, bookId, onBookLinked]);

    useEffect(() => {
        void loadPages();
    }, [loadPages]);

    useEffect(() => {
        if (verse && !sourceText) setSourceText(verse);
    }, [verse, sourceText]);

    useEffect(() => {
        const loadChars = async () => {
            try {
                const [charsRes, storyRes] = await Promise.all([
                    apiClient.get('/api/bible-map/characters'),
                    apiClient.get(`/api/bible-map/stories/${storyId}`),
                ]);
                const list = Array.isArray(charsRes.data?.characters)
                    ? charsRes.data.characters
                    : Array.isArray(charsRes.data)
                      ? charsRes.data
                      : [];
                setCharacters(
                    list.filter(
                        (c: PortalCharacter) =>
                            c.referenceImageUrl && String(c.referenceImageUrl).trim(),
                    ),
                );
                const saved = Array.isArray(storyRes.data?.referenceCharacterIds)
                    ? storyRes.data.referenceCharacterIds.map((id: string) => String(id))
                    : [];
                if (saved.length) setSelectedCharacterIds(saved);
                const provider = String(storyRes.data?.imageProvider || '').toLowerCase();
                if (provider === 'openai' || provider === 'chatgpt') {
                    setImageProvider('openai');
                } else if (provider === 'gemini') {
                    setImageProvider('gemini');
                }
                const styleUrl = String(storyRes.data?.styleReferenceImageUrl || '').trim();
                if (styleUrl) setStyleReferenceImageUrl(styleUrl);
            } catch (err) {
                console.error(err);
            }
        };
        void loadChars();
    }, [storyId]);

    const toggleCharacter = (id: string) => {
        setSelectedCharacterIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 4),
        );
    };

    const persistStyleReference = async (url: string | null) => {
        await apiClient.put(`/api/bible-map/stories/${storyId}`, {
            styleReferenceImageUrl: url,
        });
        setStyleReferenceImageUrl(url || '');
    };

    const persistBackgroundMusic = async (
        tracks: Array<{ url: string; filename: string; uploadedAt?: string }>,
    ) => {
        if (!bookId) {
            throw new Error('Book ID is required');
        }
        const res = await apiClient.put(`/api/books/${bookId}`, {
            files: {
                audio: tracks.slice(0, 1),
                defaultAudioIndex: 0,
            },
        });
        applyBookMusic(res.data);
    };

    const uploadStyleReference = async (file: File) => {
        setUploadingStyleRef(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const q = bookId
                ? `bookId=${encodeURIComponent(bookId)}&type=map-art`
                : 'type=map-art';
            const res = await apiClient.post(`/api/upload/image?${q}`, formData);
            const url = String(res.data?.url || '').trim();
            if (!url) throw new Error('No URL returned');
            await persistStyleReference(url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload style reference image');
        } finally {
            setUploadingStyleRef(false);
        }
    };

    const uploadBackgroundMusic = async (file: File) => {
        if (!bookId) {
            alert('Create or link a book first');
            return;
        }
        if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name)) {
            alert('Please select an audio file (MP3, WAV, M4A, etc.)');
            return;
        }
        setUploadingMusic(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post(
                `/api/upload/audio?bookId=${encodeURIComponent(bookId)}&type=audio&volume=${BG_MUSIC_UPLOAD_VOLUME}`,
                formData,
            );
            const url = String(res.data?.url || '').trim();
            if (!url) throw new Error('No URL returned');
            const filename = String(res.data?.filename || file.name || 'background-music.mp3');
            await persistBackgroundMusic([
                { url, filename, uploadedAt: new Date().toISOString() },
            ]);
        } catch (err) {
            console.error(err);
            alert('Failed to upload background music');
        } finally {
            setUploadingMusic(false);
            if (musicInputRef.current) musicInputRef.current.value = '';
        }
    };

    const clearBackgroundMusic = async () => {
        if (!bookId) return;
        if (!window.confirm('Remove background music from this book?')) return;
        setUploadingMusic(true);
        try {
            await persistBackgroundMusic([]);
        } catch (err) {
            console.error(err);
            alert('Failed to clear background music');
        } finally {
            setUploadingMusic(false);
        }
    };

    const handleGenerateScripts = async () => {
        const trimmed = sourceText.trim();
        if (!trimmed) {
            alert(
                'Paste a short Bible story description first — a few sentences of the main events, or a scripture passage.',
            );
            return;
        }
        if (trimmed.length < 40) {
            alert(
                'Add a clearer source description (about 2–4 sentences covering the story) so scripts can be written for each age level.',
            );
            return;
        }
        setGenerating(true);
        setImageStatus(null);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-reading-levels`,
                {
                    sourceText: trimmed,
                    pageCount,
                    scriptureRef,
                    title: packTitle,
                    referenceCharacterIds: selectedCharacterIds,
                    generateImages: false,
                    // Fresh scripts — do not revive deleted pages / old images
                    preserveMedia: false,
                    imageProvider,
                    styleReferenceImageUrl: styleReferenceImageUrl || undefined,
                },
                { timeout: 180000 },
            );
            if (res.data.bookId) {
                onBookLinked(res.data.bookId);
            }
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : [];
            setPages(list);
            setActivePage(0);
            alert(
                `Generated ${list.length} fresh age-leveled pages (previous pages/images for this book were replaced). Use Generate images when you’re ready for art.`,
            );
        } catch (err: unknown) {
            console.error(err);
            const data = (err as { response?: { data?: { message?: string; error?: string } } })
                ?.response?.data;
            const msg =
                data?.message ||
                data?.error ||
                'Script generation failed. Check that the backend is up, then try a clearer story summary.';
            alert(msg);
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateImages = async (onlyMissing: boolean) => {
        if (!bookId && pages.length === 0) {
            alert('Generate age scripts first');
            return;
        }
        setGeneratingImages(true);
        setImageStatus(null);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-page-images`,
                {
                    referenceCharacterIds: selectedCharacterIds,
                    onlyMissing,
                    imageProvider,
                    styleReferenceImageUrl: styleReferenceImageUrl || undefined,
                },
                { timeout: 600000 },
            );
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : pages;
            setPages(list);
            const results = Array.isArray(res.data.results) ? res.data.results : [];
            const ok = results.filter((r: { backgroundUrl?: string; error?: string }) =>
                r.backgroundUrl && !r.error,
            ).length;
            const failed = results.filter((r: { error?: string }) => r.error).length;
            const skipped = results.filter((r: { skipped?: boolean }) => r.skipped).length;
            setImageStatus(
                `Images: ${ok} ready${skipped ? `, ${skipped} skipped` : ''}${
                    failed ? `, ${failed} failed` : ''
                }`,
            );
            alert(`Page images updated (${ok} ok${failed ? `, ${failed} failed` : ''})`);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Image generation failed';
            alert(msg);
        } finally {
            setGeneratingImages(false);
        }
    };

    const handleGeneratePageImage = async (pageNumber: number, extraPrompt?: string) => {
        if (!bookId) {
            alert('Generate age scripts / link a book first');
            return;
        }
        setGeneratingPageImage(pageNumber);
        setImageStatus(null);
        try {
            // Persist current page text first so the image prompt uses latest scripts
            await persistPages(pages, { quiet: true });
            const trimmedExtra = String(extraPrompt || '').trim();
            const res = await apiClient.post(
                `/api/bible-map/stories/${storyId}/generate-page-images`,
                {
                    referenceCharacterIds: selectedCharacterIds,
                    onlyMissing: false,
                    pageNumber,
                    imageProvider,
                    styleReferenceImageUrl: styleReferenceImageUrl || undefined,
                    ...(trimmedExtra ? { extraPrompt: trimmedExtra } : {}),
                },
                { timeout: 300000 },
            );
            const list = Array.isArray(res.data.pages)
                ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
                : pages;
            setPages(list);
            const results = Array.isArray(res.data.results) ? res.data.results : [];
            const result = results[0];
            if (result?.error) {
                setImageStatus(`Page ${pageNumber}: ${result.error}`);
                alert(`Page ${pageNumber} image failed: ${result.error}`);
            } else {
                setImageStatus(`Page ${pageNumber} image ready`);
            }
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Image generation failed';
            alert(msg);
        } finally {
            setGeneratingPageImage(null);
        }
    };

    const persistPages = async (nextPages: ReadingPageDraft[], opts?: { quiet?: boolean }) => {
        if (!bookId && nextPages.length === 0) {
            throw new Error('Create a book or generate pages first');
        }
        const res = await apiClient.put(`/api/bible-map/stories/${storyId}/reading-pages`, {
            pages: nextPages.map((p, i) => ({
                ...p,
                pageNumber: i + 1,
                // Never re-send stale nested files blobs — backgroundUrl/scrollUrl are source of truth
                files: undefined,
            })),
        });
        const list = Array.isArray(res.data.pages)
            ? res.data.pages.map((p: Record<string, unknown>) => pageFromApi(p))
            : nextPages;
        setPages(list);
        if (res.data.bookId) onBookLinked(res.data.bookId);
        if (!opts?.quiet) {
            alert(
                list.length === 0
                    ? 'All reading pages cleared from this book.'
                    : 'Reading pages saved',
            );
        }
        return list;
    };

    const handleSave = async () => {
        if (!bookId && pages.length === 0) {
            alert('Create a book or generate pages first');
            return;
        }
        setSaving(true);
        try {
            await persistPages(pages);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                (err as Error)?.message ||
                'Save failed';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const addPage = () => {
        setPages((prev) => [...prev, emptyReadingPage(prev.length + 1)]);
        setActivePage(pages.length);
    };

    const removePage = async (idx: number) => {
        const removingLast = pages.length <= 1;
        if (
            !window.confirm(
                removingLast
                    ? 'Remove the last page and clear all reading pages from the book?'
                    : `Remove page ${pages[idx]?.pageNumber || idx + 1}? This will save immediately.`,
            )
        ) {
            return;
        }
        const next = removingLast
            ? []
            : pages.filter((_, i) => i !== idx).map((p, i) => ({ ...p, pageNumber: i + 1 }));
        setPages(next);
        setActivePage(next.length ? Math.min(idx, next.length - 1) : 0);
        if (!bookId) return;
        setSaving(true);
        try {
            await persistPages(next, { quiet: true });
        } catch (err: unknown) {
            console.error(err);
            alert('Could not save page removal — try Save pages again.');
            void loadPages();
        } finally {
            setSaving(false);
        }
    };

    const clearAllPages = async () => {
        if (!bookId) {
            setPages([]);
            setActivePage(0);
            return;
        }
        if (
            !window.confirm(
                'Clear ALL reading pages and images for this book? You can generate fresh scripts afterward.',
            )
        ) {
            return;
        }
        setSaving(true);
        try {
            await persistPages([]);
            setActivePage(0);
        } catch (err: unknown) {
            console.error(err);
            alert('Failed to clear pages');
        } finally {
            setSaving(false);
        }
    };

    const characterPicker = (
        <div className="space-y-3">
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-medium text-amber-950 inline-flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5" />
                        Story style reference (required for consistent art)
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
                        disabled={uploadingStyleRef}
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
                                Every page will match this image&apos;s art style, lighting, and
                                rendering. Character photos below supply identity only.
                            </p>
                            <button
                                type="button"
                                onClick={() => void persistStyleReference(null)}
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-amber-800 hover:text-red-700"
                            >
                                <X className="w-3 h-3" />
                                Remove
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-[11px] text-amber-900/80">
                        Upload one reference illustration for the whole story. Gemini and ChatGPT
                        will match it exactly across pages.
                    </p>
                )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-medium text-violet-900">
                    Character references (for page images)
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium text-violet-900">Image provider</span>
                <label className="text-xs text-violet-800 flex items-center gap-1.5">
                    <input
                        type="radio"
                        name="bible-map-image-provider"
                        checked={imageProvider === 'gemini'}
                        onChange={() => setImageProvider('gemini')}
                        className="border-violet-300"
                    />
                    Gemini (character refs)
                </label>
                <label className="text-xs text-violet-800 flex items-center gap-1.5">
                    <input
                        type="radio"
                        name="bible-map-image-provider"
                        checked={imageProvider === 'openai'}
                        onChange={() => setImageProvider('openai')}
                        className="border-violet-300"
                    />
                    ChatGPT / OpenAI
                </label>
            </div>
            {characters.length === 0 ? (
                <p className="text-[11px] text-violet-700/80">
                    No character reference images found. Add them under Kids Monthly character
                    library (reference photo required).
                </p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {characters.map((c) => {
                        const selected = selectedCharacterIds.includes(c._id);
                        return (
                            <button
                                key={c._id}
                                type="button"
                                onClick={() => toggleCharacter(c._id)}
                                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition ${
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
            <p className="text-[11px] text-violet-700/80">
                {imageProvider === 'openai'
                    ? 'Uses OpenAI gpt-image-2. Style image + character photos go to images/edits with high fidelity. Requires OPENAI_API_KEY.'
                    : 'Uses Vertex Gemini flash-image: style image first, then character identity refs.'}{' '}
                Pick up to 4 characters (e.g. Jesus, Noah). Page art is 3:4 above the parchment scroll.
            </p>
            {imageStatus && (
                <p className="text-[11px] text-emerald-800 font-medium">{imageStatus}</p>
            )}
        </div>
    );

    const current = pages[activePage];

    if (!bookId) {
        return (
            <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                    Create a Bible Map book for this story pack, then build age-leveled pages here
                    (shared art, different text for ages 3–5 / 6–7 / 8+).
                </div>
                <button
                    type="button"
                    disabled={creatingBook}
                    onClick={() => void onCreateBook()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                    {creatingBook ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <BookOpen className="w-4 h-4" />
                    )}
                    Create draft Bible Map book
                </button>
                <div className="border-t border-gray-200 pt-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        Paste a short story summary (main events in 2–6 sentences) or a scripture
                        passage, then generate age scripts. A book is created automatically.
                    </p>
                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        rows={5}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        placeholder="Example: God made the world in six days. On day six He made Adam from dust and breathed life into him. God made a beautiful garden for Adam to live in…"
                    />
                    {characterPicker}
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="text-xs text-gray-600 flex items-center gap-1">
                            Pages
                            <input
                                type="number"
                                min={3}
                                max={12}
                                value={pageCount}
                                onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                                className="w-16 border border-gray-300 rounded px-2 py-1"
                            />
                        </label>
                        <button
                            type="button"
                            disabled={generating}
                            onClick={() => void handleGenerateScripts()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"
                        >
                            {generating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            Generate age scripts
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-gray-900">Age-leveled book builder</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Shared image/scroll/video per page · text differs for ages 3–5, 6–7, and 8+
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={saving || (!bookId && pages.length === 0)}
                        onClick={() => void handleSave()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        Save pages
                    </button>
                    <button
                        type="button"
                        disabled={saving || !bookId || pages.length === 0}
                        onClick={() => void clearAllPages()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Clear all pages
                    </button>
                </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5">
                        <Music className="w-4 h-4 text-indigo-600" />
                        Book background music
                    </label>
                    <input
                        ref={musicInputRef}
                        type="file"
                        accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) void uploadBackgroundMusic(f);
                        }}
                    />
                    <button
                        type="button"
                        disabled={uploadingMusic || !bookId}
                        onClick={() => musicInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                    >
                        {uploadingMusic ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Music className="w-3.5 h-3.5" />
                        )}
                        {backgroundMusicUrl ? 'Replace music' : 'Upload music'}
                    </button>
                </div>
                <p className="text-[11px] text-slate-600">
                    Soft looping track under reading (separate from island scene music). Uploaded
                    at ~{Math.round(BG_MUSIC_UPLOAD_VOLUME * 100)}% volume so it stays under TTS.
                </p>
                {backgroundMusicUrl ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <audio
                            key={backgroundMusicUrl}
                            src={getMediaUrl(backgroundMusicUrl)}
                            controls
                            preload="metadata"
                            className="h-9 max-w-[260px]"
                        />
                        <span className="text-[11px] text-slate-500 truncate max-w-[180px]">
                            {backgroundMusicFilename || 'Track ready'}
                        </span>
                        <button
                            type="button"
                            disabled={uploadingMusic}
                            onClick={() => void clearBackgroundMusic()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-white disabled:opacity-50"
                            title="Clear background music"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    </div>
                ) : (
                    <p className="text-[11px] text-slate-500">No background music yet.</p>
                )}
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-lg p-4 space-y-3">
                <label className="block text-sm font-medium text-violet-900">
                    Source story / scripture
                </label>
                <p className="text-[11px] text-violet-800/90">
                    Write a clear summary of the Bible story (who, what happened, ending) or paste
                    the scripture. This is what the AI turns into age 3–5 / 6–7 / 8+ page scripts.
                </p>
                <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={4}
                    className="w-full border border-violet-200 rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Example: God made the world in six days. On day six He made Adam from dust and breathed life into him. God placed Adam in a beautiful garden…"
                />
                {characterPicker}
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-violet-800 flex items-center gap-1">
                        Pages
                        <input
                            type="number"
                            min={3}
                            max={12}
                            value={pageCount}
                            onChange={(e) => setPageCount(Number(e.target.value) || 5)}
                            className="w-16 border border-violet-200 rounded px-2 py-1 bg-white"
                        />
                    </label>
                    <button
                        type="button"
                        disabled={generating || generatingImages || generatingPageImage != null}
                        onClick={() => void handleGenerateScripts()}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-600 text-white text-sm hover:bg-violet-700 disabled:opacity-50"
                    >
                        {generating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4" />
                        )}
                        Generate age scripts
                    </button>
                    <button
                        type="button"
                        disabled={
                            generating ||
                            generatingImages ||
                            generatingPageImage != null ||
                            pages.length === 0
                        }
                        onClick={() => void handleGenerateImages(true)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-300 bg-white text-violet-800 text-sm hover:bg-violet-50 disabled:opacity-50"
                    >
                        {generatingImages ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ImagePlus className="w-4 h-4" />
                        )}
                        Generate images
                    </button>
                    <button
                        type="button"
                        disabled={
                            generating ||
                            generatingImages ||
                            generatingPageImage != null ||
                            pages.length === 0
                        }
                        onClick={() => void handleGenerateImages(false)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-violet-200 text-violet-700 text-sm hover:bg-white disabled:opacity-50"
                        title="Overwrite every page image"
                    >
                        Regenerate all images
                    </button>
                </div>
                <p className="text-[11px] text-violet-700/80">
                    Scripts and images are separate steps. Generate images only fills pages that are
                    missing art; Regenerate all overwrites every page.
                </p>
                {(generating || generatingImages || generatingPageImage != null) && (
                    <p className="text-xs text-violet-800">
                        {generating
                            ? 'Generating age scripts…'
                            : generatingPageImage != null
                              ? `Generating image for page ${generatingPageImage} via ${
                                    imageProvider === 'openai' ? 'ChatGPT / OpenAI' : 'Gemini'
                                }…`
                              : `Generating page images via ${
                                    imageProvider === 'openai' ? 'ChatGPT / OpenAI' : 'Gemini'
                                }…`}
                    </p>
                )}
            </div>

            {loading ? (
                <div className="text-sm text-gray-500 py-8 text-center">Loading pages…</div>
            ) : pages.length === 0 ? (
                <div className="text-sm text-gray-500 py-8 text-center border border-dashed border-gray-300 rounded-lg">
                    No pages yet — generate from a source story or add a blank page.
                    <div className="mt-3">
                        <button
                            type="button"
                            onClick={addPage}
                            className="inline-flex items-center gap-1 text-indigo-600 text-sm"
                        >
                            <Plus className="w-4 h-4" /> Add page
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2">
                        {pages.map((p, i) => (
                            <button
                                key={p._id || i}
                                type="button"
                                onClick={() => setActivePage(i)}
                                className={`px-2.5 py-1 rounded-lg text-xs border ${
                                    i === activePage
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {p.pageNumber}
                                {p.backgroundUrl ? ' · img' : ''}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={addPage}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-dashed border-gray-300 text-xs text-gray-600 hover:bg-gray-50"
                        >
                            <Plus className="w-3.5 h-3.5" /> Page
                        </button>
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => void removePage(activePage)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                    </div>

                    {current && (
                        <BookPageEditor
                            page={current}
                            level={level}
                            bookPages={pages}
                            backgroundMusicUrl={backgroundMusicUrl || undefined}
                            onLevelChange={setLevel}
                            onChange={(next) =>
                                setPages((prev) =>
                                    prev.map((p, i) => (i === activePage ? next : p)),
                                )
                            }
                            bookId={bookId}
                            onGenerateImage={(extraPrompt) =>
                                void handleGeneratePageImage(current.pageNumber, extraPrompt)
                            }
                            generatingImage={generatingPageImage === current.pageNumber}
                            generateImageDisabled={
                                generating ||
                                generatingImages ||
                                (generatingPageImage != null &&
                                    generatingPageImage !== current.pageNumber)
                            }
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default BibleMapBookBuilder;
