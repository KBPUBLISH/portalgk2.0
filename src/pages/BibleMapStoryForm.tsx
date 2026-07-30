import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    BookOpen,
    Puzzle,
    Palette,
    HelpCircle,
    Gamepad2,
    LayoutDashboard,
    ExternalLink,
    Plus,
    Unlink,
    Check,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';

type PackTab = 'overview' | 'book' | 'puzzle' | 'coloring' | 'quiz' | 'game';

interface IslandOption {
    _id: string;
    title: string;
    slug: string;
}

interface BookOption {
    _id: string;
    title: string;
    status: string;
    bookType?: string;
    coverImage?: string;
    files?: { coverImage?: string };
}

interface ColoringPage {
    _id: string;
    pageNumber: number;
    isColoringPage?: boolean;
    backgroundUrl?: string;
    files?: { background?: { url?: string } };
}

interface CustomQuestion {
    question: string;
    options: string[];
    correctIndex: number;
}

interface StoryFormState {
    islandId: string;
    order: number;
    title: string;
    displayTitle: string;
    scriptureRef: string;
    verse: string;
    verseRef: string;
    heroImageUrl: string;
    introVideoUrl: string;
    sceneBgVideoUrl: string;
    status: 'draft' | 'published' | 'archived';
    bookId: string | null;
    quizMode: 'book_quiz' | 'custom' | 'none';
    customQuestions: CustomQuestion[];
    coloringPageIds: string[];
    puzzleEnabled: boolean;
    puzzleType: 'scripture_words' | 'none';
    puzzleVerseText: string;
    puzzleVerseRef: string;
    gameEnabled: boolean;
    gameKind: 'catalog' | 'webview' | 'none';
    gameId: string;
    gameWebviewTitle: string;
    gameWebviewUrl: string;
    gameWebviewCover: string;
    gameWebviewDescription: string;
}

interface CatalogGame {
    _id: string;
    gameId: string;
    name: string;
    enabled?: boolean;
}

const TABS: { id: PackTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'book', label: 'Book', icon: BookOpen },
    { id: 'puzzle', label: 'Puzzle', icon: Puzzle },
    { id: 'coloring', label: 'Coloring', icon: Palette },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'game', label: 'Game', icon: Gamepad2 },
];

const emptyForm = (islandId = ''): StoryFormState => ({
    islandId,
    order: 1,
    title: '',
    displayTitle: '',
    scriptureRef: '',
    verse: '',
    verseRef: '',
    heroImageUrl: '',
    introVideoUrl: '',
    sceneBgVideoUrl: '',
    status: 'draft',
    bookId: null,
    quizMode: 'book_quiz',
    customQuestions: [],
    coloringPageIds: [],
    puzzleEnabled: false,
    puzzleType: 'scripture_words',
    puzzleVerseText: '',
    puzzleVerseRef: '',
    gameEnabled: false,
    gameKind: 'none',
    gameId: '',
    gameWebviewTitle: '',
    gameWebviewUrl: '',
    gameWebviewCover: '',
    gameWebviewDescription: '',
});

const BibleMapStoryForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();

    const [tab, setTab] = useState<PackTab>('overview');
    const [form, setForm] = useState<StoryFormState>(() =>
        emptyForm(searchParams.get('islandId') || ''),
    );
    const [islands, setIslands] = useState<IslandOption[]>([]);
    const [bibleMapBooks, setBibleMapBooks] = useState<BookOption[]>([]);
    const [coloringPages, setColoringPages] = useState<ColoringPage[]>([]);
    const [games, setGames] = useState<CatalogGame[]>([]);
    const [linkedBook, setLinkedBook] = useState<BookOption | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [creatingBook, setCreatingBook] = useState(false);

    const update = <K extends keyof StoryFormState>(key: K, value: StoryFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const loadMeta = useCallback(async () => {
        const [islandsRes, booksRes, gamesRes] = await Promise.all([
            apiClient.get('/api/bible-map/islands?status=all'),
            apiClient.get('/api/books?status=all&bookType=bible_map&limit=200'),
            apiClient.get('/api/games'),
        ]);
        setIslands(Array.isArray(islandsRes.data) ? islandsRes.data : []);
        const booksPayload = booksRes.data;
        const booksList = Array.isArray(booksPayload)
            ? booksPayload
            : booksPayload?.books || booksPayload?.data || [];
        setBibleMapBooks(booksList);
        const gamesData = Array.isArray(gamesRes.data)
            ? gamesRes.data
            : gamesRes.data?.data || gamesRes.data?.games || [];
        setGames(gamesData);
    }, []);

    useEffect(() => {
        void loadMeta().catch((err) => console.error('Failed to load meta', err));
    }, [loadMeta]);

    useEffect(() => {
        if (isNew) {
            setLoading(false);
            return;
        }
        const load = async () => {
            try {
                const res = await apiClient.get(`/api/bible-map/stories/${id}`);
                const story = res.data.story;
                setColoringPages(res.data.coloringPages || []);
                const book =
                    story.bookId && typeof story.bookId === 'object' ? story.bookId : null;
                setLinkedBook(book);
                setForm({
                    islandId:
                        typeof story.islandId === 'object'
                            ? story.islandId._id
                            : story.islandId || '',
                    order: story.order ?? 1,
                    title: story.title || '',
                    displayTitle: story.displayTitle || '',
                    scriptureRef: story.scriptureRef || '',
                    verse: story.verse || '',
                    verseRef: story.verseRef || '',
                    heroImageUrl: story.heroImageUrl || '',
                    introVideoUrl: story.introVideoUrl || '',
                    sceneBgVideoUrl: story.sceneBgVideoUrl || '',
                    status: story.status || 'draft',
                    bookId: book?._id || (typeof story.bookId === 'string' ? story.bookId : null),
                    quizMode: story.quizMode || 'book_quiz',
                    customQuestions: story.customQuestions || [],
                    coloringPageIds: (story.coloringPageIds || []).map((p: { _id?: string } | string) =>
                        typeof p === 'object' && p?._id ? p._id : String(p),
                    ),
                    puzzleEnabled: !!story.puzzle?.enabled,
                    puzzleType: story.puzzle?.type || 'scripture_words',
                    puzzleVerseText: story.puzzle?.verseText || '',
                    puzzleVerseRef: story.puzzle?.verseRef || '',
                    gameEnabled: !!story.game?.enabled,
                    gameKind: story.game?.kind || 'none',
                    gameId: story.game?.gameId || '',
                    gameWebviewTitle: story.game?.webview?.title || '',
                    gameWebviewUrl: story.game?.webview?.url || '',
                    gameWebviewCover: story.game?.webview?.coverImage || '',
                    gameWebviewDescription: story.game?.webview?.description || '',
                });
            } catch (err) {
                console.error(err);
                alert('Failed to load story pack');
                navigate('/bible-map?tab=stories');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [id, isNew, navigate]);

    // When book link changes, refresh coloring pages for that book
    useEffect(() => {
        const bookId = form.bookId;
        if (!bookId) {
            setColoringPages([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                const pages = Array.isArray(res.data) ? res.data : [];
                if (!cancelled) {
                    setColoringPages(pages.filter((p: ColoringPage) => p.isColoringPage));
                    const book = bibleMapBooks.find((b) => b._id === bookId) || linkedBook;
                    if (book) setLinkedBook(book);
                }
            } catch (err) {
                console.error('Failed to load pages for coloring', err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [form.bookId, bibleMapBooks, linkedBook]);

    const readiness = useMemo(
        () => ({
            book: !!form.bookId,
            puzzle: form.puzzleEnabled && !!form.puzzleVerseText.trim(),
            coloring: form.coloringPageIds.length > 0,
            quiz: form.quizMode !== 'none',
            game: form.gameEnabled && form.gameKind !== 'none',
        }),
        [form],
    );

    const buildPayload = () => ({
        islandId: form.islandId,
        order: form.order,
        title: form.title.trim(),
        displayTitle:
            form.displayTitle.trim() ||
            `${form.order}. ${form.title.trim().toUpperCase()}`,
        scriptureRef: form.scriptureRef.trim(),
        verse: form.verse.trim(),
        verseRef: form.verseRef.trim(),
        heroImageUrl: form.heroImageUrl.trim() || undefined,
        introVideoUrl: form.introVideoUrl.trim() || undefined,
        sceneBgVideoUrl: form.sceneBgVideoUrl.trim() || undefined,
        status: form.status,
        bookId: form.bookId || null,
        quizMode: form.quizMode,
        customQuestions: form.quizMode === 'custom' ? form.customQuestions : [],
        coloringPageIds: form.coloringPageIds,
        puzzle: {
            enabled: form.puzzleEnabled,
            type: form.puzzleEnabled ? form.puzzleType : 'none',
            verseText: form.puzzleVerseText,
            verseRef: form.puzzleVerseRef || form.verseRef,
        },
        game: {
            enabled: form.gameEnabled,
            kind: form.gameEnabled ? form.gameKind : 'none',
            gameId: form.gameKind === 'catalog' ? form.gameId : undefined,
            webview:
                form.gameKind === 'webview'
                    ? {
                          title: form.gameWebviewTitle,
                          url: form.gameWebviewUrl,
                          coverImage: form.gameWebviewCover,
                          description: form.gameWebviewDescription,
                      }
                    : undefined,
        },
    });

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!form.islandId || !form.title.trim()) {
            alert('Island and title are required');
            setTab('overview');
            return;
        }
        setSaving(true);
        try {
            const payload = buildPayload();
            if (isNew) {
                const res = await apiClient.post('/api/bible-map/stories', payload);
                navigate(`/bible-map/stories/${res.data._id}`);
            } else {
                const res = await apiClient.put(`/api/bible-map/stories/${id}`, payload);
                const book =
                    res.data.bookId && typeof res.data.bookId === 'object'
                        ? res.data.bookId
                        : linkedBook;
                setLinkedBook(book);
                alert('Story pack saved');
            }
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to save story pack';
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleCreateBook = async () => {
        if (isNew) {
            alert('Save the story pack first, then create a book.');
            return;
        }
        setCreatingBook(true);
        try {
            const res = await apiClient.post(`/api/bible-map/stories/${id}/create-book`, {
                title: form.title,
            });
            const story = res.data.story;
            const book = res.data.book;
            setLinkedBook(book);
            update('bookId', book._id);
            setBibleMapBooks((prev) => [book, ...prev]);
            if (story) {
                // refresh linked book from populated story
            }
            alert('Draft Bible Map book created and linked.');
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to create book';
            alert(msg);
        } finally {
            setCreatingBook(false);
        }
    };

    const toggleColoringPage = (pageId: string) => {
        setForm((prev) => {
            const has = prev.coloringPageIds.includes(pageId);
            return {
                ...prev,
                coloringPageIds: has
                    ? prev.coloringPageIds.filter((x) => x !== pageId)
                    : [...prev.coloringPageIds, pageId],
            };
        });
    };

    const addQuestion = () => {
        update('customQuestions', [
            ...form.customQuestions,
            { question: '', options: ['', '', '', ''], correctIndex: 0 },
        ]);
    };

    if (loading) {
        return <div className="text-gray-500 py-12 text-center">Loading story pack…</div>;
    }

    return (
        <div className="max-w-5xl">
            <Link
                to="/bible-map?tab=stories"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 mb-4"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Story Packs
            </Link>

            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isNew ? 'New Story Pack' : form.displayTitle || form.title || 'Edit Story Pack'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Bundle Read + Puzzle + Coloring + Quiz + Game for one map adventure.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving…' : isNew ? 'Create Pack' : 'Save Pack'}
                </button>
            </div>

            {/* Readiness strip */}
            <div className="flex flex-wrap gap-2 mb-4">
                {(
                    [
                        ['book', 'Read'],
                        ['puzzle', 'Puzzle'],
                        ['coloring', 'Coloring'],
                        ['quiz', 'Quiz'],
                        ['game', 'Game'],
                    ] as const
                ).map(([key, label]) => (
                    <span
                        key={key}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                            readiness[key]
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {readiness[key] && <Check className="w-3 h-3" />}
                        {label}
                    </span>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 mb-6 border-b border-gray-200">
                {TABS.map(({ id: tabId, label, icon: Icon }) => (
                    <button
                        key={tabId}
                        type="button"
                        onClick={() => setTab(tabId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                            tab === tabId
                                ? 'border-emerald-600 text-emerald-700'
                                : 'border-transparent text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
                {tab === 'overview' && (
                    <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Island
                                </label>
                                <select
                                    value={form.islandId}
                                    onChange={(e) => update('islandId', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                    required
                                >
                                    <option value="">Select island…</option>
                                    {islands.map((i) => (
                                        <option key={i._id} value={i._id}>
                                            {i.title} (/{i.slug})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Order on island
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.order}
                                    onChange={(e) =>
                                        update('order', parseInt(e.target.value, 10) || 1)
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Title
                                </label>
                                <input
                                    value={form.title}
                                    onChange={(e) => update('title', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="The Beginning"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display title
                                </label>
                                <input
                                    value={form.displayTitle}
                                    onChange={(e) => update('displayTitle', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="1. THE BEGINNING"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Scripture ref
                                </label>
                                <input
                                    value={form.scriptureRef}
                                    onChange={(e) => update('scriptureRef', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="Genesis 1"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Status
                                </label>
                                <select
                                    value={form.status}
                                    onChange={(e) =>
                                        update(
                                            'status',
                                            e.target.value as StoryFormState['status'],
                                        )
                                    }
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Spotlight verse
                            </label>
                            <textarea
                                value={form.verse}
                                onChange={(e) => update('verse', e.target.value)}
                                rows={2}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                placeholder="In the beginning God created the heavens and the earth."
                            />
                            <input
                                value={form.verseRef}
                                onChange={(e) => update('verseRef', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2"
                                placeholder="Genesis 1:1"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hero image URL
                                </label>
                                <input
                                    value={form.heroImageUrl}
                                    onChange={(e) => update('heroImageUrl', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Intro video URL
                                </label>
                                <input
                                    value={form.introVideoUrl}
                                    onChange={(e) => update('introVideoUrl', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Scene BG video URL
                                </label>
                                <input
                                    value={form.sceneBgVideoUrl}
                                    onChange={(e) => update('sceneBgVideoUrl', e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'book' && (
                    <div className="space-y-5">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                            Link a <strong>Bible Map</strong> book (tap-word interactive reader). Create
                            pages and mark tappable words in the page editor.
                        </div>

                        {form.bookId && linkedBook ? (
                            <div className="flex flex-wrap items-center gap-4 p-4 border border-gray-200 rounded-lg">
                                {(linkedBook.files?.coverImage || linkedBook.coverImage) && (
                                    <img
                                        src={getMediaUrl(
                                            linkedBook.files?.coverImage || linkedBook.coverImage,
                                        )}
                                        alt=""
                                        className="w-16 h-20 object-cover rounded"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900">
                                        {linkedBook.title}
                                    </div>
                                    <div className="text-xs text-gray-500 capitalize">
                                        {linkedBook.status} · bible_map
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Link
                                        to={`/pages/new/${form.bookId}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                                    >
                                        Edit pages
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </Link>
                                    <Link
                                        to={`/books/read/${form.bookId}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                                    >
                                        Preview
                                    </Link>
                                    <Link
                                        to={`/books/edit/${form.bookId}`}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                                    >
                                        Book settings
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            update('bookId', null);
                                            setLinkedBook(null);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-red-600 text-sm hover:bg-red-50"
                                    >
                                        <Unlink className="w-3.5 h-3.5" />
                                        Unlink
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Link existing Bible Map book
                                    </label>
                                    <select
                                        value={form.bookId || ''}
                                        onChange={(e) => {
                                            const val = e.target.value || null;
                                            update('bookId', val);
                                            setLinkedBook(
                                                bibleMapBooks.find((b) => b._id === val) || null,
                                            );
                                        }}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                    >
                                        <option value="">— None —</option>
                                        {bibleMapBooks.map((b) => (
                                            <option key={b._id} value={b._id}>
                                                {b.title} ({b.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-px flex-1 bg-gray-200" />
                                    <span className="text-xs text-gray-400">or</span>
                                    <div className="h-px flex-1 bg-gray-200" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleCreateBook()}
                                    disabled={creatingBook || isNew}
                                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    {creatingBook
                                        ? 'Creating…'
                                        : isNew
                                          ? 'Save pack first to create book'
                                          : 'Create draft Bible Map book'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'puzzle' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.puzzleEnabled}
                                onChange={(e) => update('puzzleEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">
                                Enable scripture word puzzle
                            </span>
                        </label>
                        <p className="text-sm text-gray-500">
                            Kids rearrange scrambled words into the verse (Duolingo-style). App
                            puzzle UI will consume this later.
                        </p>
                        {form.puzzleEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Verse text
                                    </label>
                                    <textarea
                                        value={form.puzzleVerseText}
                                        onChange={(e) => update('puzzleVerseText', e.target.value)}
                                        rows={3}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        placeholder={form.verse || 'Paste the verse to scramble…'}
                                    />
                                    <button
                                        type="button"
                                        className="text-xs text-emerald-700 hover:underline mt-1"
                                        onClick={() => {
                                            if (form.verse) update('puzzleVerseText', form.verse);
                                            if (form.verseRef) update('puzzleVerseRef', form.verseRef);
                                        }}
                                    >
                                        Copy from spotlight verse
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Verse reference
                                    </label>
                                    <input
                                        value={form.puzzleVerseRef}
                                        onChange={(e) => update('puzzleVerseRef', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                        placeholder="Genesis 1:1"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tab === 'coloring' && (
                    <div className="space-y-4">
                        {!form.bookId ? (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
                                Link a book first, then mark pages as coloring pages in the page
                                editor. Select which ones unlock here.
                            </p>
                        ) : coloringPages.length === 0 ? (
                            <div className="text-sm text-gray-600 space-y-2">
                                <p>No coloring pages found on this book yet.</p>
                                <Link
                                    to={`/pages/new/${form.bookId}`}
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                                >
                                    Open page editor
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                <p className="text-xs text-gray-500">
                                    Check “This is a coloring page” on a page, save, then return here.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                {coloringPages.map((page) => {
                                    const selected = form.coloringPageIds.includes(page._id);
                                    const thumb =
                                        page.files?.background?.url || page.backgroundUrl;
                                    return (
                                        <button
                                            key={page._id}
                                            type="button"
                                            onClick={() => toggleColoringPage(page._id)}
                                            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                                                selected
                                                    ? 'border-emerald-500 bg-emerald-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {thumb ? (
                                                <img
                                                    src={getMediaUrl(thumb)}
                                                    alt=""
                                                    className="w-12 h-16 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                                                    P{page.pageNumber}
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    Page {page.pageNumber}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {selected ? 'Included in pack' : 'Click to include'}
                                                </div>
                                            </div>
                                            {selected && (
                                                <Check className="w-4 h-4 text-emerald-600 ml-auto" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'quiz' && (
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Quiz mode
                            </label>
                            <select
                                value={form.quizMode}
                                onChange={(e) =>
                                    update('quizMode', e.target.value as StoryFormState['quizMode'])
                                }
                                className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                            >
                                <option value="book_quiz">
                                    Auto from linked book (AI / BookQuiz)
                                </option>
                                <option value="custom">Custom questions</option>
                                <option value="none">No quiz</option>
                            </select>
                        </div>
                        {form.quizMode === 'book_quiz' && (
                            <p className="text-sm text-gray-500">
                                Uses the existing BookQuiz pipeline for the linked bible_map book.
                                {!form.bookId && ' Link a book on the Book tab first.'}
                            </p>
                        )}
                        {form.quizMode === 'custom' && (
                            <div className="space-y-4">
                                {form.customQuestions.map((q, qi) => (
                                    <div
                                        key={qi}
                                        className="border border-gray-200 rounded-lg p-4 space-y-2"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-semibold text-gray-500">
                                                Question {qi + 1}
                                            </span>
                                            <button
                                                type="button"
                                                className="text-xs text-red-600 hover:underline"
                                                onClick={() =>
                                                    update(
                                                        'customQuestions',
                                                        form.customQuestions.filter(
                                                            (_, i) => i !== qi,
                                                        ),
                                                    )
                                                }
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        <input
                                            value={q.question}
                                            onChange={(e) => {
                                                const next = [...form.customQuestions];
                                                next[qi] = { ...q, question: e.target.value };
                                                update('customQuestions', next);
                                            }}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Question text"
                                        />
                                        {q.options.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name={`correct-${qi}`}
                                                    checked={q.correctIndex === oi}
                                                    onChange={() => {
                                                        const next = [...form.customQuestions];
                                                        next[qi] = { ...q, correctIndex: oi };
                                                        update('customQuestions', next);
                                                    }}
                                                />
                                                <input
                                                    value={opt}
                                                    onChange={(e) => {
                                                        const nextOpts = [...q.options];
                                                        nextOpts[oi] = e.target.value;
                                                        const next = [...form.customQuestions];
                                                        next[qi] = { ...q, options: nextOpts };
                                                        update('customQuestions', next);
                                                    }}
                                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                                                    placeholder={`Option ${oi + 1}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addQuestion}
                                    className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add question
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'game' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.gameEnabled}
                                onChange={(e) => {
                                    update('gameEnabled', e.target.checked);
                                    if (e.target.checked && form.gameKind === 'none') {
                                        update('gameKind', 'catalog');
                                    }
                                }}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">Enable game unlock</span>
                        </label>

                        {form.gameEnabled && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Game type
                                    </label>
                                    <select
                                        value={form.gameKind}
                                        onChange={(e) =>
                                            update(
                                                'gameKind',
                                                e.target.value as StoryFormState['gameKind'],
                                            )
                                        }
                                        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                    >
                                        <option value="catalog">Catalog game</option>
                                        <option value="webview">Custom webview URL</option>
                                    </select>
                                </div>

                                {form.gameKind === 'catalog' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Select game
                                        </label>
                                        <select
                                            value={form.gameId}
                                            onChange={(e) => update('gameId', e.target.value)}
                                            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white"
                                        >
                                            <option value="">— Choose —</option>
                                            {games
                                                .filter((g) => g.enabled !== false)
                                                .map((g) => (
                                                    <option key={g._id} value={g.gameId}>
                                                        {g.name} ({g.gameId})
                                                    </option>
                                                ))}
                                        </select>
                                        <Link
                                            to="/games"
                                            className="text-xs text-indigo-600 hover:underline mt-1 inline-block"
                                        >
                                            Manage games catalog
                                        </Link>
                                    </div>
                                )}

                                {form.gameKind === 'webview' && (
                                    <div className="space-y-3 max-w-xl">
                                        <input
                                            value={form.gameWebviewTitle}
                                            onChange={(e) =>
                                                update('gameWebviewTitle', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Game title"
                                        />
                                        <input
                                            value={form.gameWebviewUrl}
                                            onChange={(e) =>
                                                update('gameWebviewUrl', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="https://game-url…"
                                        />
                                        <input
                                            value={form.gameWebviewCover}
                                            onChange={(e) =>
                                                update('gameWebviewCover', e.target.value)
                                            }
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Cover image URL"
                                        />
                                        <textarea
                                            value={form.gameWebviewDescription}
                                            onChange={(e) =>
                                                update('gameWebviewDescription', e.target.value)
                                            }
                                            rows={2}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                            placeholder="Short description"
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BibleMapStoryForm;
