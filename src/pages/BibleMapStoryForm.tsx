import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    BookOpen,
    Puzzle,
    Palette,
    HelpCircle,
    Gift,
    Trash2,
    LayoutDashboard,
    ExternalLink,
    Plus,
    Unlink,
    Check,
    Clapperboard,
    Sparkles,
    Loader2,
    Upload,
    X,
    Play,
    Map as MapIcon,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../services/apiClient';
import {
    formatPoint,
    hasExplicitPoint,
    MAIN_MAP_LAYOUT_KEYS,
    MAIN_MAP_LAYOUT_LABELS,
    normalizeMainMapPosition,
    type MainMapLayoutKey,
    type MainMapPosition,
    type MainMapSizeLayout,
    DEFAULT_MAIN_MAP_SIZE,
} from '../components/bibleMapMainMap/types';
import SlidingPuzzlePreview from '../components/SlidingPuzzlePreview';
import TapFillColoringPreview from '../components/TapFillColoringPreview';
import BibleMapQuizPanel, { emptyQuizLevels } from '../components/BibleMapQuizPanel';
import type { QuizLevel, QuizLevelsState, QuizQuestion } from '../components/BibleMapQuizPanel';
import SceneStudio from '../components/sceneStudio/SceneStudio';
import {
    emptySceneLayout,
    normalizeLoadedLayout,
    type SceneAnimation,
    type SceneLayout,
    type SceneTrigger,
} from '../components/sceneStudio/types';
import BibleMapBookBuilder from '../components/bibleMapBook/BibleMapBookBuilder';
import OneClickPackPanel from '../components/bibleMapBook/OneClickPackPanel';

type PackTab = 'overview' | 'scene' | 'book' | 'puzzle' | 'coloring' | 'quiz' | 'rewards';

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

interface ColoringTapFill {
    enabled?: boolean;
    regionMapUrl?: string;
    regionPreviewUrl?: string;
    regionCount?: number;
    width?: number;
    height?: number;
    palette?: string[];
}

interface ColoringPage {
    _id: string;
    pageNumber: number;
    bookId?: string | null;
    isColoringPage?: boolean;
    backgroundUrl?: string;
    files?: { background?: { url?: string } };
    tapFill?: ColoringTapFill;
}

const DEFAULT_COLORING_PALETTE = [
    '#E74C3C',
    '#E67E22',
    '#F1C40F',
    '#2ECC71',
    '#3498DB',
    '#9B59B6',
    '#E91E63',
    '#1ABC9C',
    '#F1948A',
    '#F8C471',
    '#F9E79F',
    '#A9DFBF',
    '#AED6F1',
    '#D7BDE2',
    '#F5B7B1',
    '#27AE60',
    '#1E8449',
    '#5DADE2',
    '#1A5276',
    '#D4AC0D',
    '#F5CBA7',
    '#D4A574',
    '#8D6E63',
    '#5D4037',
    '#FFFFFF',
    '#BDC3C7',
    '#7F8C8D',
    '#2C3E50',
    '#000000',
];

const MAX_COLORING_PALETTE = 32;

interface StoryFormState {
    islandId: string;
    order: number;
    title: string;
    displayTitle: string;
    scriptureRef: string;
    verse: string;
    verseRef: string;
    heroImageUrl: string;
    mapIconUrl: string;
    mainMapPosition: MainMapPosition;
    mainMapSize: MainMapSizeLayout;
    sceneBgVideoUrl: string;
    sceneMusicUrl: string;
    status: 'draft' | 'published' | 'archived';
    bookId: string | null;
    quizMode: 'book_quiz' | 'custom' | 'none';
    quizLevels: QuizLevelsState;
    quizDefaultLevel: QuizLevel;
    coloringPageIds: string[];
    puzzleEnabled: boolean;
    puzzleType: 'sliding_image' | 'scripture_words' | 'none';
    puzzleImageUrl: string;
    puzzleDifficulties: Array<'easy' | 'medium' | 'hard'>;
    puzzleDefaultDifficulty: 'easy' | 'medium' | 'hard';
    puzzleVerseText: string;
    puzzleVerseRef: string;
    gameEnabled: boolean;
    gameKind: 'catalog' | 'webview' | 'none';
    gameId: string;
    gameWebviewTitle: string;
    gameWebviewUrl: string;
    gameWebviewCover: string;
    gameWebviewDescription: string;
    rewardsEnabled: boolean;
    rewardsPool: RewardPoolItem[];
    sceneLayout: SceneLayout;
    sceneAnimations: SceneAnimation[];
    sceneTriggers: SceneTrigger[];
}

interface CatalogGame {
    _id: string;
    gameId: string;
    name: string;
    enabled?: boolean;
}

type RewardPoolType = 'character' | 'game' | 'coins' | 'book_template';

interface RewardPoolItem {
    id: string;
    type: RewardPoolType;
    title: string;
    imageUrl: string;
    characterName: string;
    /** GLB 3D model URL — character walks the ship deck in-app */
    modelUrl: string;
    /** ElevenLabs voice id for in-app character TTS chat */
    voiceId: string;
    /** Optional freeform description of how this Bible character speaks/acts */
    persona: string;
    gameUrl: string;
    bookId: string;
    bookCoverUrl: string;
    coinMin: number;
    coinMax: number;
}

/** Voice option from GET /api/tts/voices (new contract shape, legacy keys tolerated) */
interface TtsVoiceOption {
    id: string;
    name: string;
    previewUrl?: string;
}

const emptyRewardItem = (type: RewardPoolType = 'coins'): RewardPoolItem => ({
    id: `reward-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    title: type === 'coins' ? 'Gold Coins' : type === 'character' ? 'Character' : type === 'game' ? 'New Game' : 'Story Template',
    imageUrl: '',
    characterName: '',
    modelUrl: '',
    voiceId: '',
    persona: '',
    gameUrl: '',
    bookId: '',
    bookCoverUrl: '',
    coinMin: 100,
    coinMax: 1000,
});

const TABS: { id: PackTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'scene', label: 'Scene', icon: Clapperboard },
    { id: 'book', label: 'Book', icon: BookOpen },
    { id: 'puzzle', label: 'Puzzle', icon: Puzzle },
    { id: 'coloring', label: 'Coloring', icon: Palette },
    { id: 'quiz', label: 'Quiz', icon: HelpCircle },
    { id: 'rewards', label: 'Rewards', icon: Gift },
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
    mapIconUrl: '',
    mainMapPosition: normalizeMainMapPosition(null, 0, 1),
    mainMapSize: { ...DEFAULT_MAIN_MAP_SIZE },
    sceneBgVideoUrl: '',
    sceneMusicUrl: '',
    status: 'draft',
    bookId: null,
    quizMode: 'book_quiz',
    quizLevels: emptyQuizLevels(),
    quizDefaultLevel: 'easy',
    coloringPageIds: [],
    puzzleEnabled: false,
    puzzleType: 'sliding_image',
    puzzleImageUrl: '',
    puzzleDifficulties: ['easy', 'medium', 'hard'],
    puzzleDefaultDifficulty: 'easy',
    puzzleVerseText: '',
    puzzleVerseRef: '',
    gameEnabled: false,
    gameKind: 'none',
    gameId: '',
    gameWebviewTitle: '',
    gameWebviewUrl: '',
    gameWebviewCover: '',
    gameWebviewDescription: '',
    rewardsEnabled: true,
    rewardsPool: [emptyRewardItem('coins')],
    sceneLayout: emptySceneLayout(),
    sceneAnimations: [],
    sceneTriggers: [],
});

const BibleMapStoryForm: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const isNew = !id || id === 'new';
    const navigate = useNavigate();

    const initialTab = (searchParams.get('tab') as PackTab | null) || 'overview';
    const [tab, setTab] = useState<PackTab>(
        TABS.some((t) => t.id === initialTab) ? initialTab : 'overview',
    );
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
    const [uploadingPuzzleImage, setUploadingPuzzleImage] = useState(false);
    const [uploadingMapIcon, setUploadingMapIcon] = useState(false);
    const [uploadingColoring, setUploadingColoring] = useState(false);
    const [generatingMapIconAi, setGeneratingMapIconAi] = useState(false);
    const [generatingPuzzleAi, setGeneratingPuzzleAi] = useState(false);
    const [generatingColoringAi, setGeneratingColoringAi] = useState(false);
    const [previewColoringId, setPreviewColoringId] = useState<string | null>(null);
    const [savingPalette, setSavingPalette] = useState(false);

    // Character reward extras: ElevenLabs voice picker + GLB model upload
    const [ttsVoices, setTtsVoices] = useState<TtsVoiceOption[]>([]);
    const [ttsVoicesError, setTtsVoicesError] = useState(false);
    const [ttsVoicesRequested, setTtsVoicesRequested] = useState(false);
    const [uploadingModelFor, setUploadingModelFor] = useState<string | null>(null);
    /** Local name/size of GLBs uploaded this session (URL only survives reload) */
    const [modelFileMeta, setModelFileMeta] = useState<
        Record<string, { name: string; size: number }>
    >({});
    const voicePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

    const update = <K extends keyof StoryFormState>(key: K, value: StoryFormState[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    // Load ElevenLabs voices the first time the Rewards tab opens.
    // Endpoint returns { voices: [{ id, name, previewUrl? }] } (legacy bare-array/keys tolerated).
    useEffect(() => {
        if (tab !== 'rewards' || ttsVoicesRequested) return;
        setTtsVoicesRequested(true);
        (async () => {
            try {
                const res = await apiClient.get('/api/tts/voices');
                const raw: Record<string, unknown>[] = Array.isArray(res.data)
                    ? res.data
                    : res.data?.voices ?? [];
                const list: TtsVoiceOption[] = raw
                    .map((v) => ({
                        id: String(v.id || v.voice_id || ''),
                        name: String(v.name || ''),
                        previewUrl: v.previewUrl
                            ? String(v.previewUrl)
                            : v.preview_url
                              ? String(v.preview_url)
                              : undefined,
                    }))
                    .filter((v) => v.id && v.name);
                if (list.length === 0) throw new Error('No voices returned');
                setTtsVoices(list);
                setTtsVoicesError(false);
            } catch (err) {
                console.error('Failed to load TTS voices:', err);
                setTtsVoicesError(true);
            }
        })();
    }, [tab, ttsVoicesRequested]);

    useEffect(
        () => () => {
            voicePreviewAudioRef.current?.pause();
        },
        [],
    );

    const playVoicePreview = (url: string) => {
        voicePreviewAudioRef.current?.pause();
        const audio = new Audio(url);
        voicePreviewAudioRef.current = audio;
        void audio.play().catch(() => alert('Could not play voice preview'));
    };

    const handleCharacterModelUpload = async (rewardId: string, file: File) => {
        if (!/\.glb$/i.test(file.name)) {
            alert('Please upload a .glb 3D model file');
            return;
        }
        if (file.size > 25 * 1024 * 1024) {
            alert('Model file is too large. Maximum size is 25 MB.');
            return;
        }
        setUploadingModelFor(rewardId);
        try {
            const island = islands.find((i) => i._id === form.islandId);
            const islandKey = island?.slug || form.islandId || id || 'temp';
            const fd = new FormData();
            // Field name must be `file` — the upload endpoint reads upload.single('file')
            fd.append('file', file);
            const res = await apiClient.post(
                `/api/upload/image?bookId=bible-map&type=character-model&islandId=${encodeURIComponent(islandKey)}`,
                fd,
            );
            const url = String(res.data?.url || '');
            if (!url) throw new Error('No URL returned');
            setForm((prev) => ({
                ...prev,
                rewardsPool: prev.rewardsPool.map((r) =>
                    r.id === rewardId ? { ...r, modelUrl: url } : r,
                ),
            }));
            setModelFileMeta((prev) => ({
                ...prev,
                [rewardId]: { name: file.name, size: file.size },
            }));
        } catch (err) {
            console.error(err);
            alert('Failed to upload 3D model');
        } finally {
            setUploadingModelFor(null);
        }
    };

    const togglePuzzleDifficulty = (level: 'easy' | 'medium' | 'hard') => {
        setForm((prev) => {
            const has = prev.puzzleDifficulties.includes(level);
            let next = has
                ? prev.puzzleDifficulties.filter((d) => d !== level)
                : [...prev.puzzleDifficulties, level];
            if (next.length === 0) next = [level];
            const defaultDifficulty = next.includes(prev.puzzleDefaultDifficulty)
                ? prev.puzzleDefaultDifficulty
                : next[0];
            return { ...prev, puzzleDifficulties: next, puzzleDefaultDifficulty: defaultDifficulty };
        });
    };

    const handlePuzzleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.match(/^image\/(png|jpeg|jpg)$/i) && !/\.(png|jpe?g)$/i.test(file.name)) {
            alert('Please upload a PNG or JPG image');
            return;
        }
        setUploadingPuzzleImage(true);
        try {
            const island = islands.find((i) => i._id === form.islandId);
            const islandKey = island?.slug || form.islandId || id || 'temp';
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post(
                `/api/upload/image?bookId=bible-map&type=puzzle-image&islandId=${encodeURIComponent(islandKey)}`,
                formData,
            );
            update('puzzleImageUrl', res.data.url as string);
            if (!form.puzzleEnabled) update('puzzleEnabled', true);
            if (form.puzzleType === 'none') update('puzzleType', 'sliding_image');
        } catch (err) {
            console.error(err);
            alert('Failed to upload puzzle image');
        } finally {
            setUploadingPuzzleImage(false);
        }
    };

    const handleMapIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingMapIcon(true);
        try {
            const island = islands.find((i) => i._id === form.islandId);
            const islandKey = island?.slug || form.islandId || id || 'temp';
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post(
                `/api/upload/image?bookId=bible-map&type=map-icon&islandId=${encodeURIComponent(islandKey)}`,
                formData,
            );
            update('mapIconUrl', res.data.url as string);
        } catch (err) {
            console.error(err);
            alert('Failed to upload map icon');
        } finally {
            setUploadingMapIcon(false);
        }
    };

    const handleGenerateMapIconAi = async () => {
        if (isNew || !id) {
            alert('Save the story pack first, then generate a map icon.');
            return;
        }
        setGeneratingMapIconAi(true);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${id}/generate-map-icon`,
                {},
                { timeout: 300000 },
            );
            const imageUrl = String(res.data?.mapIconUrl || '').trim();
            if (imageUrl) {
                setForm((prev) => ({
                    ...prev,
                    mapIconUrl: imageUrl,
                    mainMapPosition: res.data?.mainMapPosition
                        ? normalizeMainMapPosition(res.data.mainMapPosition, 0, 1)
                        : prev.mainMapPosition,
                }));
            }
            alert(
                res.data?.characterNames?.length
                    ? `Map icon ready (${res.data.characterNames.join(', ')}). Save the pack if you made other edits.`
                    : 'Map icon ready. Save the pack if you made other edits.',
            );
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to generate map icon';
            alert(msg);
        } finally {
            setGeneratingMapIconAi(false);
        }
    };

    const uploadSceneVideo = async (
        file: File,
        kind: 'scene-bg' | 'scene-anim',
    ): Promise<string> => {
        const island = islands.find((i) => i._id === form.islandId);
        const islandKey = island?.slug || form.islandId || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/video?bookId=bible-map&type=${kind}&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const uploadSceneMusic = async (file: File): Promise<string> => {
        const island = islands.find((i) => i._id === form.islandId);
        const islandKey = island?.slug || form.islandId || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/audio?bookId=bible-map&type=scene-music&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const uploadSceneButtonIcon = async (file: File): Promise<string> => {
        const island = islands.find((i) => i._id === form.islandId);
        const islandKey = island?.slug || form.islandId || id || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/image?bookId=bible-map&type=scene-button-icon&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const handleColoringLineArtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/i) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
            alert('Please upload a PNG, JPG, or WebP line-art image');
            return;
        }
        setUploadingColoring(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            // Optional: attach to linked book when present; otherwise standalone pack page
            if (form.bookId) {
                formData.append('bookId', form.bookId);
            }
            const res = await apiClient.post('/api/bible-map/coloring/preprocess', formData);
            const page = res.data.page as ColoringPage;
            setColoringPages((prev) => {
                const without = prev.filter((p) => p._id !== page._id);
                return [...without, page].sort((a, b) => a.pageNumber - b.pageNumber);
            });
            setForm((prev) => ({
                ...prev,
                coloringPageIds: prev.coloringPageIds.includes(page._id)
                    ? prev.coloringPageIds
                    : [...prev.coloringPageIds, page._id],
            }));
            setPreviewColoringId(page._id);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to preprocess coloring page';
            alert(msg);
        } finally {
            setUploadingColoring(false);
        }
    };

    const updatePreviewPalette = async (pageId: string, palette: string[]) => {
        setSavingPalette(true);
        try {
            const res = await apiClient.patch(`/api/bible-map/coloring/pages/${pageId}`, {
                palette,
            });
            const page = res.data.page as ColoringPage;
            setColoringPages((prev) =>
                prev.map((p) => (p._id === pageId ? { ...p, tapFill: page.tapFill } : p)),
            );
        } catch (err) {
            console.error(err);
            alert('Failed to save palette');
        } finally {
            setSavingPalette(false);
        }
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
                    mapIconUrl: story.mapIconUrl || '',
                    mainMapPosition: (() => {
                        const orderIndex = Math.max(0, (story.order ?? 1) - 1);
                        const normalized = normalizeMainMapPosition(
                            story.mainMapPosition,
                            orderIndex,
                            1,
                        );
                        // Keep unset devices as non-explicit so UI can show "— (auto)"
                        const out = {} as MainMapPosition;
                        for (const key of MAIN_MAP_LAYOUT_KEYS) {
                            out[key] = hasExplicitPoint(story.mainMapPosition?.[key])
                                ? normalized[key]
                                : ({} as MainMapPosition[MainMapLayoutKey]);
                        }
                        return out;
                    })(),
                    mainMapSize: {
                        phone_se: {
                            w:
                                story.mainMapSize?.phone_se?.w ??
                                DEFAULT_MAIN_MAP_SIZE.phone_se.w,
                            h:
                                story.mainMapSize?.phone_se?.h ??
                                DEFAULT_MAIN_MAP_SIZE.phone_se.h,
                        },
                        phone: {
                            w: story.mainMapSize?.phone?.w ?? DEFAULT_MAIN_MAP_SIZE.phone.w,
                            h: story.mainMapSize?.phone?.h ?? DEFAULT_MAIN_MAP_SIZE.phone.h,
                        },
                        phone_max: {
                            w:
                                story.mainMapSize?.phone_max?.w ??
                                DEFAULT_MAIN_MAP_SIZE.phone_max.w,
                            h:
                                story.mainMapSize?.phone_max?.h ??
                                DEFAULT_MAIN_MAP_SIZE.phone_max.h,
                        },
                        tablet: {
                            w: story.mainMapSize?.tablet?.w ?? DEFAULT_MAIN_MAP_SIZE.tablet.w,
                            h: story.mainMapSize?.tablet?.h ?? DEFAULT_MAIN_MAP_SIZE.tablet.h,
                        },
                    },
                    sceneBgVideoUrl: story.sceneBgVideoUrl || '',
                    sceneMusicUrl: story.sceneMusicUrl || '',
                    status: story.status || 'draft',
                    bookId: book?._id || (typeof story.bookId === 'string' ? story.bookId : null),
                    quizMode: story.quizMode || 'book_quiz',
                    quizLevels: (() => {
                        const fromLevels = story.quiz?.levels;
                        const normalize = (list: QuizQuestion[] | undefined): QuizQuestion[] =>
                            (Array.isArray(list) ? list : []).map((q) => ({
                                question: q.question || '',
                                options:
                                    Array.isArray(q.options) && q.options.length
                                        ? [...q.options, '', '', '', ''].slice(0, 4)
                                        : ['', '', '', ''],
                                correctIndex:
                                    typeof q.correctIndex === 'number' ? q.correctIndex : 0,
                                explanation: q.explanation || '',
                            }));
                        const easy = normalize(fromLevels?.easy);
                        const medium = normalize(fromLevels?.medium);
                        const hard = normalize(fromLevels?.hard);
                        if (easy.length || medium.length || hard.length) {
                            return { easy, medium, hard };
                        }
                        // Legacy flat customQuestions → easy
                        return {
                            easy: normalize(story.customQuestions),
                            medium: [],
                            hard: [],
                        };
                    })(),
                    quizDefaultLevel:
                        story.quiz?.defaultLevel === 'medium' ||
                        story.quiz?.defaultLevel === 'hard'
                            ? story.quiz.defaultLevel
                            : 'easy',
                    coloringPageIds: (story.coloringPageIds || []).map((p: { _id?: string } | string) =>
                        typeof p === 'object' && p?._id ? p._id : String(p),
                    ),
                    puzzleEnabled: !!story.puzzle?.enabled,
                    puzzleType:
                        story.puzzle?.type === 'scripture_words'
                            ? 'scripture_words'
                            : story.puzzle?.type === 'none'
                              ? 'none'
                              : 'sliding_image',
                    puzzleImageUrl: story.puzzle?.imageUrl || '',
                    puzzleDifficulties:
                        Array.isArray(story.puzzle?.difficulties) &&
                        story.puzzle.difficulties.length > 0
                            ? story.puzzle.difficulties
                            : ['easy', 'medium', 'hard'],
                    puzzleDefaultDifficulty: story.puzzle?.defaultDifficulty || 'easy',
                    puzzleVerseText: story.puzzle?.verseText || '',
                    puzzleVerseRef: story.puzzle?.verseRef || '',
                    gameEnabled: !!story.game?.enabled,
                    gameKind: story.game?.kind || 'none',
                    gameId: story.game?.gameId || '',
                    gameWebviewTitle: story.game?.webview?.title || '',
                    gameWebviewUrl: story.game?.webview?.url || '',
                    gameWebviewCover: story.game?.webview?.coverImage || '',
                    gameWebviewDescription: story.game?.webview?.description || '',
                    rewardsEnabled: story.rewards?.enabled !== false,
                    rewardsPool: Array.isArray(story.rewards?.pool) && story.rewards.pool.length
                        ? story.rewards.pool.map((r: Record<string, unknown>) => ({
                              id: String(r.id || emptyRewardItem().id),
                              type: (['character', 'game', 'coins', 'book_template'].includes(String(r.type))
                                  ? String(r.type)
                                  : 'coins') as RewardPoolType,
                              title: String(r.title || ''),
                              imageUrl: String(r.imageUrl || ''),
                              characterName: String(r.characterName || ''),
                              modelUrl: String(r.modelUrl || ''),
                              voiceId: String(r.voiceId || ''),
                              persona: String(r.persona || ''),
                              gameUrl: String(r.gameUrl || ''),
                              bookId: r.bookId
                                  ? String(typeof r.bookId === 'object' && r.bookId && '_id' in (r.bookId as object)
                                      ? (r.bookId as { _id: string })._id
                                      : r.bookId)
                                  : '',
                              bookCoverUrl: String(r.bookCoverUrl || ''),
                              coinMin: typeof r.coinMin === 'number' ? r.coinMin : 100,
                              coinMax: typeof r.coinMax === 'number' ? r.coinMax : 1000,
                          }))
                        : [emptyRewardItem('coins')],
                    sceneLayout: normalizeLoadedLayout(story.sceneLayout),
                    sceneAnimations: Array.isArray(story.sceneAnimations)
                        ? story.sceneAnimations
                              .filter(
                                  (a: SceneAnimation) =>
                                      a && typeof a === 'object' && a.id && a.videoUrl,
                              )
                              .map((a: SceneAnimation) => ({
                                  id: String(a.id),
                                  label: String(a.label || ''),
                                  videoUrl: String(a.videoUrl),
                              }))
                        : [],
                    sceneTriggers: Array.isArray(story.sceneTriggers)
                        ? story.sceneTriggers
                              .filter(
                                  (t: SceneTrigger) =>
                                      t && typeof t === 'object' && t.id && t.fromButtonId,
                              )
                              .map((t: SceneTrigger) => ({
                                  id: String(t.id),
                                  fromButtonId: String(t.fromButtonId),
                                  animationId: String(t.animationId || ''),
                                  after: t.after === 'stay' ? 'stay' : 'navigate',
                                  navigateTo:
                                      t.navigateTo === 'read' ||
                                      t.navigateTo === 'quiz' ||
                                      t.navigateTo === 'puzzle' ||
                                      t.navigateTo === 'coloring' ||
                                      t.navigateTo === 'rewards' ||
                                      t.navigateTo === 'game'
                                          ? t.navigateTo
                                          : '',
                              }))
                        : [],
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

    // New packs get an AI map icon asynchronously — poll briefly so the overview preview updates
    useEffect(() => {
        if (isNew || !id || form.mapIconUrl || loading) return;
        let cancelled = false;
        let attempts = 0;
        const poll = async () => {
            if (cancelled || attempts >= 10) return;
            attempts += 1;
            try {
                const res = await apiClient.get(`/api/bible-map/stories/${id}`);
                const url = String(res.data?.story?.mapIconUrl || '').trim();
                if (url && !cancelled) {
                    setForm((prev) => (prev.mapIconUrl ? prev : { ...prev, mapIconUrl: url }));
                    return;
                }
            } catch {
                /* ignore transient poll errors */
            }
            if (!cancelled) {
                window.setTimeout(() => {
                    void poll();
                }, 4000);
            }
        };
        const t = window.setTimeout(() => {
            void poll();
        }, 3000);
        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [id, isNew, form.mapIconUrl, loading]);

    // When book link changes, merge that book's coloring pages with pack-attached ones
    useEffect(() => {
        const bookId = form.bookId;
        if (!bookId) {
            // Keep standalone / pack-attached coloring pages; do not wipe
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get(`/api/pages/book/${bookId}`);
                const pages = Array.isArray(res.data) ? res.data : [];
                if (!cancelled) {
                    const fromBook = pages.filter((p: ColoringPage) => p.isColoringPage);
                    setColoringPages((prev) => {
                        const bookIds = new Set(fromBook.map((p) => p._id));
                        const extras = prev.filter((p) => !bookIds.has(p._id));
                        return [...extras, ...fromBook].sort(
                            (a, b) => a.pageNumber - b.pageNumber,
                        );
                    });
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
            puzzle:
                form.puzzleEnabled &&
                (form.puzzleType === 'sliding_image'
                    ? !!form.puzzleImageUrl.trim()
                    : form.puzzleType === 'scripture_words'
                      ? !!form.puzzleVerseText.trim()
                      : false),
            coloring: form.coloringPageIds.length > 0,
            quiz:
                form.quizMode === 'book_quiz'
                    ? !!form.bookId
                    : form.quizMode === 'custom'
                      ? ['easy', 'medium', 'hard'].some(
                            (l) =>
                                form.quizLevels[l as QuizLevel].filter((q) =>
                                    q.question.trim(),
                                ).length > 0,
                        )
                      : false,
            rewards: form.rewardsEnabled && form.rewardsPool.length > 0,
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
        // Icon can be set here; phone/tablet placement is edited on the island main map layout
        mapIconUrl: form.mapIconUrl.trim() || null,
        sceneBgVideoUrl: form.sceneBgVideoUrl.trim() || undefined,
        sceneMusicUrl: form.sceneMusicUrl.trim() || null,
        status: form.status,
        bookId: form.bookId || null,
        quizMode: form.quizMode,
        quiz:
            form.quizMode === 'custom'
                ? {
                      defaultLevel: form.quizDefaultLevel,
                      levels: {
                          easy: form.quizLevels.easy.filter((q) => q.question.trim()),
                          medium: form.quizLevels.medium.filter((q) => q.question.trim()),
                          hard: form.quizLevels.hard.filter((q) => q.question.trim()),
                      },
                  }
                : { defaultLevel: form.quizDefaultLevel, levels: emptyQuizLevels() },
        customQuestions:
            form.quizMode === 'custom'
                ? form.quizLevels.easy.filter((q) => q.question.trim())
                : [],
        coloringPageIds: form.coloringPageIds,
        puzzle: {
            enabled: form.puzzleEnabled,
            type: form.puzzleEnabled
                ? form.puzzleType === 'scripture_words'
                    ? 'scripture_words'
                    : 'sliding_image'
                : 'none',
            imageUrl: form.puzzleImageUrl.trim() || undefined,
            difficulties: form.puzzleDifficulties,
            defaultDifficulty: form.puzzleDefaultDifficulty,
            verseText: form.puzzleVerseText,
            verseRef: form.puzzleVerseRef || form.verseRef,
        },
        sceneLayout: form.sceneLayout,
        sceneAnimations: form.sceneAnimations.filter((a) => a.id && a.videoUrl),
        sceneTriggers: form.sceneTriggers.filter((t) => t.id && t.fromButtonId),
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
        rewards: {
            enabled: form.rewardsEnabled,
            pool: form.rewardsPool
                .filter((r) => r.id && r.type)
                .map((r) => ({
                    id: r.id,
                    type: r.type,
                    title: r.title,
                    imageUrl: r.imageUrl || undefined,
                    characterName: r.characterName || undefined,
                    modelUrl: r.modelUrl || undefined,
                    voiceId: r.voiceId || undefined,
                    persona: r.persona || undefined,
                    gameUrl: r.gameUrl || undefined,
                    bookId: r.bookId || undefined,
                    bookCoverUrl: r.bookCoverUrl || undefined,
                    coinMin: r.type === 'coins' ? r.coinMin : undefined,
                    coinMax: r.type === 'coins' ? r.coinMax : undefined,
                })),
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
                const tabQuery = tab !== 'overview' ? `?tab=${tab}` : '';
                navigate(`/bible-map/stories/${res.data._id}${tabQuery}`);
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

    const handleUnlinkBook = async () => {
        if (isNew || !id) return;
        if (
            !window.confirm(
                'Unlink this book from the story pack? The book and its pages stay in the library — only the connection is removed. Generate age scripts later will create/link a new book.',
            )
        ) {
            return;
        }
        setSaving(true);
        try {
            await apiClient.put(`/api/bible-map/stories/${id}`, { bookId: null });
            update('bookId', null);
            setLinkedBook(null);
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { error?: string; message?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to unlink book';
            alert(msg);
        } finally {
            setSaving(false);
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

    const handleGeneratePuzzleAi = async () => {
        if (isNew || !id) {
            alert('Save the story pack first, then generate puzzle art.');
            return;
        }
        if (!form.bookId) {
            alert('Generate Book age scripts (and ideally page images) first so puzzle art can match the story.');
            setTab('book');
            return;
        }
        setGeneratingPuzzleAi(true);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${id}/generate-puzzle-image`,
                {},
                { timeout: 300000 },
            );
            const imageUrl = String(res.data?.imageUrl || res.data?.puzzle?.imageUrl || '').trim();
            if (imageUrl) {
                setForm((prev) => ({
                    ...prev,
                    puzzleEnabled: true,
                    puzzleType: 'sliding_image',
                    puzzleImageUrl: imageUrl,
                }));
            }
            alert(
                res.data?.characterNames?.length
                    ? `Puzzle image ready (${res.data.characterNames.join(', ')}). Save the pack to keep it.`
                    : 'Puzzle image ready. Save the pack to keep it.',
            );
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to generate puzzle image';
            alert(msg);
        } finally {
            setGeneratingPuzzleAi(false);
        }
    };

    const handleGenerateColoringAi = async () => {
        if (isNew || !id) {
            alert('Save the story pack first, then generate a coloring page.');
            return;
        }
        if (!form.bookId) {
            alert('Generate Book age scripts first so coloring can match the story.');
            setTab('book');
            return;
        }
        setGeneratingColoringAi(true);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${id}/generate-coloring-page`,
                {},
                { timeout: 300000 },
            );
            const page = res.data?.page as ColoringPage | undefined;
            if (page?._id) {
                setColoringPages((prev) => {
                    if (prev.some((p) => p._id === page._id)) return prev;
                    return [...prev, page].sort((a, b) => a.pageNumber - b.pageNumber);
                });
                setForm((prev) => ({
                    ...prev,
                    coloringPageIds: prev.coloringPageIds.includes(page._id)
                        ? prev.coloringPageIds
                        : [...prev.coloringPageIds, page._id],
                }));
                setPreviewColoringId(page._id);
            }
            alert(
                res.data?.regionCount
                    ? `Coloring page created with ${res.data.regionCount} tap regions. Save the pack to keep it.`
                    : 'Coloring page created. Save the pack to keep it.',
            );
        } catch (err: unknown) {
            console.error(err);
            const msg =
                (err as { response?: { data?: { message?: string; error?: string } } })?.response
                    ?.data?.message ||
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Failed to generate coloring page';
            alert(msg);
        } finally {
            setGeneratingColoringAi(false);
        }
    };

    if (loading) {
        return <div className="text-gray-500 py-12 text-center">Loading story pack…</div>;
    }

    const saveLabel = saving ? 'Saving…' : isNew ? 'Create Pack' : 'Save Pack';

    return (
        <div className="max-w-5xl">
            <Link
                to="/bible-map?tab=stories"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600 mb-4"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Story Packs
            </Link>

            {/* Sticky so Save stays visible while scrolling tabs (main is overflow-y-auto). */}
            <div className="sticky top-0 z-20 -mx-2 px-2 py-3 mb-4 bg-gray-100/95 backdrop-blur-sm border-b border-gray-200">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isNew
                                ? 'New Story Pack'
                                : form.displayTitle || form.title || 'Edit Story Pack'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Bundle Read + Puzzle + Coloring + Quiz + Rewards for one map adventure.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="inline-flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 shrink-0 shadow-sm"
                    >
                        <Save className="w-4 h-4" />
                        {saveLabel}
                    </button>
                </div>
            </div>

            <div className="mb-4" id="one-click-pack">
                <OneClickPackPanel
                    mode={isNew ? 'new' : 'existing'}
                    storyId={isNew ? null : id}
                    islandId={form.islandId}
                    title={form.title}
                    scriptureRef={form.scriptureRef}
                    verse={form.verse}
                    verseRef={form.verseRef}
                    onComplete={(completedStoryId) => {
                        if (isNew || completedStoryId !== id) {
                            navigate(`/bible-map/stories/${completedStoryId}`);
                        } else {
                            window.location.assign(`/bible-map/stories/${completedStoryId}`);
                        }
                    }}
                />
            </div>

            {/* Readiness strip */}
            <div className="flex flex-wrap gap-2 mb-4">
                {(
                    [
                        ['book', 'Read'],
                        ['puzzle', 'Puzzle'],
                        ['coloring', 'Coloring'],
                        ['quiz', 'Quiz'],
                        ['rewards', 'Rewards'],
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
                                <div className="flex gap-2 items-center">
                                    <input
                                        value={form.heroImageUrl}
                                        onChange={(e) => update('heroImageUrl', e.target.value)}
                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                        placeholder="https://… or upload"
                                    />
                                    <label className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium cursor-pointer hover:bg-gray-50">
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = '';
                                                if (!file) return;
                                                try {
                                                    const fd = new FormData();
                                                    fd.append('file', file);
                                                    const islandKey =
                                                        form.islandId || 'bible-map';
                                                    const res = await apiClient.post(
                                                        `/api/upload/image?bookId=bible-map&type=hero-image&islandId=${encodeURIComponent(islandKey)}`,
                                                        fd,
                                                    );
                                                    const url =
                                                        res.data?.url ||
                                                        res.data?.imageUrl ||
                                                        '';
                                                    if (!url) throw new Error('No URL');
                                                    update('heroImageUrl', url);
                                                } catch (err) {
                                                    console.error(err);
                                                    alert('Failed to upload image');
                                                }
                                            }}
                                        />
                                    </label>
                                </div>
                                {form.heroImageUrl ? (
                                    <img
                                        src={getMediaUrl(form.heroImageUrl)}
                                        alt=""
                                        className="mt-2 w-16 h-16 object-cover rounded-lg border"
                                    />
                                ) : null}
                            </div>
                            <div className="md:col-span-2 flex items-end">
                                <button
                                    type="button"
                                    onClick={() => setTab('scene')}
                                    className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:underline"
                                >
                                    <Clapperboard className="w-4 h-4" />
                                    Open Scene Studio to upload videos, place buttons, and wire
                                    animations
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-800 flex items-center gap-2">
                                        <MapIcon className="w-4 h-4 text-indigo-600" />
                                        Main map story icon
                                    </label>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Circular icon on the island main map. New packs get an AI
                                        icon after create; you can regenerate or upload anytime.
                                        Placement is on the island’s Main map layout editor.
                                    </p>
                                </div>
                                {form.islandId && (
                                    <Link
                                        to={`/bible-map/islands/${form.islandId}`}
                                        className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:underline"
                                    >
                                        <MapIcon className="w-3.5 h-3.5" />
                                        Open island main map layout
                                    </Link>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                {form.mapIconUrl ? (
                                    <div className="relative">
                                        <img
                                            src={getMediaUrl(form.mapIconUrl)}
                                            alt="Map icon"
                                            className="w-16 h-16 rounded-full object-cover border border-gray-200 bg-white"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => update('mapIconUrl', '')}
                                            className="absolute -top-1 -right-1 p-0.5 rounded-full bg-white border border-gray-200 text-gray-600 hover:text-red-600"
                                            aria-label="Remove map icon"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-16 h-16 rounded-full border border-dashed border-amber-300 bg-amber-50 flex items-center justify-center text-amber-700 text-[10px] text-center px-1 leading-tight">
                                        {generatingMapIconAi ? 'Generating…' : 'Add icon'}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => void handleGenerateMapIconAi()}
                                            disabled={generatingMapIconAi || isNew || uploadingMapIcon}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {generatingMapIconAi ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Sparkles className="w-4 h-4" />
                                            )}
                                            {generatingMapIconAi
                                                ? 'Generating…'
                                                : form.mapIconUrl
                                                  ? 'Regenerate map icon'
                                                  : 'Generate map icon'}
                                        </button>
                                        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 cursor-pointer disabled:opacity-50">
                                            <Upload className="w-4 h-4" />
                                            {uploadingMapIcon
                                                ? 'Uploading…'
                                                : form.mapIconUrl
                                                  ? 'Replace icon'
                                                  : 'Upload icon'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingMapIcon || generatingMapIconAi}
                                                onChange={handleMapIconUpload}
                                            />
                                        </label>
                                    </div>
                                    <input
                                        value={form.mapIconUrl}
                                        onChange={(e) => update('mapIconUrl', e.target.value)}
                                        className="w-full min-w-[220px] border border-gray-300 rounded-lg px-3 py-1.5 text-xs"
                                        placeholder="Or paste map icon URL"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 pt-1 border-t border-indigo-100">
                                {MAIN_MAP_LAYOUT_KEYS.map((key) => (
                                    <div key={key}>
                                        <span className="font-medium text-gray-700">
                                            {MAIN_MAP_LAYOUT_LABELS[key]} position %
                                        </span>
                                        <p className="font-mono mt-0.5">
                                            {formatPoint(form.mainMapPosition[key])}
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] text-gray-500 pt-1">
                                Place icons per device on the island layout editor. The app picks the
                                closest saved layout for the user’s screen; unset sizes fall back.
                            </p>
                        </div>
                    </div>
                )}

                {tab === 'scene' && (
                    <SceneStudio
                        sceneTitle={form.displayTitle}
                        sceneBgVideoUrl={form.sceneBgVideoUrl}
                        sceneMusicUrl={form.sceneMusicUrl}
                        sceneLayout={form.sceneLayout}
                        sceneAnimations={form.sceneAnimations}
                        sceneTriggers={form.sceneTriggers}
                        onSceneTitle={(title) => update('displayTitle', title)}
                        onSceneBgVideoUrl={(url) => update('sceneBgVideoUrl', url)}
                        onSceneMusicUrl={(url) => update('sceneMusicUrl', url)}
                        onSceneLayout={(layout) => update('sceneLayout', layout)}
                        onSceneAnimations={(anims) => update('sceneAnimations', anims)}
                        onSceneTriggers={(triggers) => update('sceneTriggers', triggers)}
                        onUploadVideo={uploadSceneVideo}
                        onUploadMusic={uploadSceneMusic}
                        onUploadButtonIcon={uploadSceneButtonIcon}
                    />
                )}

                {tab === 'book' && (
                    <div className="space-y-5">
                        {isNew ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 text-sm text-amber-900 space-y-4">
                                <div>
                                    <p className="font-medium">
                                        Create this story pack before building age-leveled pages.
                                    </p>
                                    <p className="mt-1 text-amber-800/90">
                                        Use <span className="font-semibold">Create Pack</span> in
                                        the sticky bar at the top, or create it here. Island and
                                        Title are required (Overview tab).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Creating…' : 'Create Pack'}
                                </button>
                            </div>
                        ) : (
                            <>
                                {form.bookId && (
                                    <div className="flex flex-wrap items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-gray-900 truncate">
                                                {linkedBook?.title || 'Linked Bible Map book'}
                                            </div>
                                            <div className="text-xs text-gray-500 capitalize">
                                                {linkedBook?.status || 'draft'} · bible_map
                                            </div>
                                        </div>
                                        <Link
                                            to={`/books/edit/${form.bookId}`}
                                            className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
                                        >
                                            Book settings
                                            <ExternalLink className="w-3 h-3" />
                                        </Link>
                                        <button
                                            type="button"
                                            disabled={saving}
                                            onClick={() => void handleUnlinkBook()}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
                                        >
                                            <Unlink className="w-3.5 h-3.5" />
                                            Unlink
                                        </button>
                                    </div>
                                )}

                                {!form.bookId && (
                                    <div className="space-y-3">
                                        <label className="block text-sm font-medium text-gray-700">
                                            Or link an existing Bible Map book
                                        </label>
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const val = e.target.value || null;
                                                if (!val) return;
                                                update('bookId', val);
                                                setLinkedBook(
                                                    bibleMapBooks.find((b) => b._id === val) ||
                                                        null,
                                                );
                                            }}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                        >
                                            <option value="">— Select book —</option>
                                            {bibleMapBooks.map((b) => (
                                                <option key={b._id} value={b._id}>
                                                    {b.title} ({b.status})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    <span>
                                        Need everything at once? Run{' '}
                                        <span className="font-semibold">One-click generate pack</span>{' '}
                                        on Overview (scripts → images → quiz → puzzle → coloring).
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setTab('overview')}
                                        className="shrink-0 text-amber-800 font-medium underline hover:no-underline"
                                    >
                                        Open Overview
                                    </button>
                                </div>

                                <BibleMapBookBuilder
                                    storyId={id!}
                                    bookId={form.bookId}
                                    packTitle={form.displayTitle || form.title}
                                    scriptureRef={form.scriptureRef}
                                    verse={form.verse}
                                    creatingBook={creatingBook}
                                    onCreateBook={handleCreateBook}
                                    onBookLinked={(bid, book) => {
                                        update('bookId', bid);
                                        if (book) {
                                            setLinkedBook({
                                                _id: book._id,
                                                title: book.title,
                                                status: book.status,
                                                bookType: 'bible_map',
                                            });
                                        } else {
                                            const found = bibleMapBooks.find((b) => b._id === bid);
                                            if (found) setLinkedBook(found);
                                        }
                                    }}
                                />
                            </>
                        )}
                    </div>
                )}

                {tab === 'puzzle' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.puzzleEnabled}
                                onChange={(e) => {
                                    update('puzzleEnabled', e.target.checked);
                                    if (e.target.checked && form.puzzleType === 'none') {
                                        update('puzzleType', 'sliding_image');
                                    }
                                }}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">
                                Enable sliding picture puzzle
                            </span>
                        </label>
                        <p className="text-sm text-gray-500">
                            Kids slide image tiles into place. Easy = 3×3, Medium = 4×4, Hard = 5×5.
                            App route: /sail/{'{island}'}/lesson/puzzle
                        </p>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-amber-950 min-w-0">
                                <p className="font-semibold">Generate puzzle image with AI</p>
                                <p className="text-amber-900/80 text-xs mt-0.5">
                                    Uses the same character refs, style image, and image provider as
                                    the Book tab. Generate book scripts first.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleGeneratePuzzleAi()}
                                disabled={generatingPuzzleAi || isNew}
                                className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50 shrink-0"
                            >
                                {generatingPuzzleAi ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                {generatingPuzzleAi ? 'Generating…' : 'Generate puzzle image'}
                            </button>
                        </div>

                        {form.puzzleEnabled && (
                            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                                <div className="space-y-5 min-w-0">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Puzzle image (PNG / JPG)
                                        </label>
                                        {form.puzzleImageUrl ? (
                                            <div className="flex items-start gap-4">
                                                <img
                                                    src={getMediaUrl(form.puzzleImageUrl)}
                                                    alt="Puzzle thumbnail"
                                                    className="w-40 h-40 object-cover rounded-lg border border-gray-200"
                                                />
                                                <div className="space-y-2">
                                                    <label className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:underline cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                                                            className="hidden"
                                                            onChange={(e) => void handlePuzzleImageUpload(e)}
                                                            disabled={uploadingPuzzleImage}
                                                        />
                                                        {uploadingPuzzleImage ? 'Uploading…' : 'Replace image'}
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="block text-xs text-red-600 hover:underline"
                                                        onClick={() => update('puzzleImageUrl', '')}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/40">
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                                                    className="hidden"
                                                    onChange={(e) => void handlePuzzleImageUpload(e)}
                                                    disabled={uploadingPuzzleImage}
                                                />
                                                <span className="text-sm text-gray-600">
                                                    {uploadingPuzzleImage
                                                        ? 'Uploading…'
                                                        : 'Click to upload puzzle image'}
                                                </span>
                                                <span className="text-xs text-gray-400 mt-1">
                                                    Square images work best
                                                </span>
                                            </label>
                                        )}
                                        <input
                                            type="url"
                                            value={form.puzzleImageUrl}
                                            onChange={(e) => update('puzzleImageUrl', e.target.value)}
                                            className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                            placeholder="Or paste image URL…"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Available difficulties
                                        </label>
                                        <div className="flex flex-wrap gap-3">
                                            {(
                                                [
                                                    ['easy', 'Easy (3×3)'],
                                                    ['medium', 'Medium (4×4)'],
                                                    ['hard', 'Hard (5×5)'],
                                                ] as const
                                            ).map(([level, label]) => (
                                                <label
                                                    key={level}
                                                    className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={form.puzzleDifficulties.includes(level)}
                                                        onChange={() => togglePuzzleDifficulty(level)}
                                                        className="w-4 h-4 text-emerald-600 rounded"
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Default difficulty
                                        </label>
                                        <select
                                            value={form.puzzleDefaultDifficulty}
                                            onChange={(e) =>
                                                update(
                                                    'puzzleDefaultDifficulty',
                                                    e.target.value as 'easy' | 'medium' | 'hard',
                                                )
                                            }
                                            className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2"
                                        >
                                            {form.puzzleDifficulties.map((d) => (
                                                <option key={d} value={d}>
                                                    {d.charAt(0).toUpperCase() + d.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="lg:sticky lg:top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                                    <SlidingPuzzlePreview
                                        imageUrl={
                                            form.puzzleImageUrl
                                                ? getMediaUrl(form.puzzleImageUrl)
                                                : ''
                                        }
                                        title={form.displayTitle || form.title || 'PUZZLE'}
                                        difficulties={form.puzzleDifficulties}
                                        defaultDifficulty={form.puzzleDefaultDifficulty}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'coloring' && (
                    <div className="space-y-5">
                        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900 space-y-1">
                            <p className="font-medium">Tap-to-fill line art guidelines</p>
                            <ul className="list-disc pl-5 text-xs text-sky-800 space-y-0.5">
                                <li>Closed black outlines with white interiors (no gaps in lines).</li>
                                <li>Avoid gray fills or open shapes — regions are auto-detected from white areas.</li>
                                <li>PNG preferred. Kids tap a region to fill; no freehand for this mode.</li>
                            </ul>
                            <p className="text-xs text-sky-700 pt-1">
                                App route: /sail/{'{island}'}/lesson/coloring
                            </p>
                        </div>

                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm text-amber-950 min-w-0">
                                <p className="font-semibold">Generate coloring page with AI</p>
                                <p className="text-amber-900/80 text-xs mt-0.5">
                                    Creates line art from the story using Book tab character refs +
                                    style image, then auto-segments tap regions.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void handleGenerateColoringAi()}
                                disabled={generatingColoringAi || isNew}
                                className="inline-flex items-center gap-2 bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50 shrink-0"
                            >
                                {generatingColoringAi ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                {generatingColoringAi ? 'Generating…' : 'Generate coloring page'}
                            </button>
                        </div>

                        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                            <div className="space-y-5 min-w-0">
                                <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                                    <label className="flex flex-col items-center gap-2 cursor-pointer">
                                        <span className="text-sm font-medium text-gray-800">
                                            {uploadingColoring
                                                ? 'Segmenting regions…'
                                                : 'Upload line art (auto-segment)'}
                                        </span>
                                        <span className="text-xs text-gray-500 text-center max-w-md">
                                            Creates a tap-fill coloring page with a region map +
                                            default palette, and adds it to this pack. No book
                                            link required.
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                                            className="hidden"
                                            disabled={uploadingColoring}
                                            onChange={(e) => void handleColoringLineArtUpload(e)}
                                        />
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                                            <Plus className="w-4 h-4" />
                                            {uploadingColoring ? 'Working…' : 'Choose image'}
                                        </span>
                                    </label>
                                </div>

                                {coloringPages.length === 0 ? (
                                    <p className="text-sm text-gray-600">
                                        No coloring pages yet. Upload line art above to create one.
                                    </p>
                                ) : (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {coloringPages.map((page) => {
                                            const selected = form.coloringPageIds.includes(
                                                page._id,
                                            );
                                            const tap =
                                                page.tapFill?.enabled && page.tapFill.regionMapUrl;
                                            const thumb =
                                                page.tapFill?.regionPreviewUrl ||
                                                page.files?.background?.url ||
                                                page.backgroundUrl;
                                            return (
                                                <div
                                                    key={page._id}
                                                    className={`rounded-lg border p-3 transition ${
                                                        selected
                                                            ? 'border-emerald-500 bg-emerald-50'
                                                            : 'border-gray-200'
                                                    }`}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            toggleColoringPage(page._id);
                                                            if (tap) setPreviewColoringId(page._id);
                                                        }}
                                                        className="flex items-center gap-3 w-full text-left"
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
                                                        <div className="min-w-0 flex-1">
                                                            <div className="font-medium text-gray-900">
                                                                {page.bookId
                                                                    ? `Page ${page.pageNumber}`
                                                                    : `Coloring ${page.pageNumber}`}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {tap
                                                                    ? `Tap-fill · ${page.tapFill?.regionCount ?? 0} regions`
                                                                    : 'Freehand (no region map)'}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {selected
                                                                    ? 'Included in pack'
                                                                    : 'Click to include'}
                                                            </div>
                                                        </div>
                                                        {selected && (
                                                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                        )}
                                                    </button>
                                                    {tap && (
                                                        <button
                                                            type="button"
                                                            className="mt-2 text-xs text-indigo-600 hover:underline"
                                                            onClick={() =>
                                                                setPreviewColoringId(page._id)
                                                            }
                                                        >
                                                            {previewColoringId === page._id
                                                                ? 'Showing in phone →'
                                                                : 'Show in phone / edit palette'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {(() => {
                                    const page =
                                        coloringPages.find((p) => p._id === previewColoringId) ||
                                        coloringPages.find(
                                            (p) =>
                                                form.coloringPageIds.includes(p._id) &&
                                                p.tapFill?.enabled &&
                                                p.tapFill.regionMapUrl,
                                        );
                                    if (!page?.tapFill?.regionMapUrl) return null;
                                    const palette =
                                        page.tapFill.palette && page.tapFill.palette.length > 0
                                            ? page.tapFill.palette
                                            : DEFAULT_COLORING_PALETTE;
                                    return (
                                        <div className="space-y-4 border-t border-gray-200 pt-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-sm font-medium text-gray-800">
                                                        Palette
                                                        {page.bookId
                                                            ? ` (page ${page.pageNumber})`
                                                            : ''}
                                                    </label>
                                                    {savingPalette && (
                                                        <span className="text-xs text-gray-500">
                                                            Saving…
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    {palette.map((c, i) => (
                                                        <label
                                                            key={`${page._id}-${i}`}
                                                            className="relative w-9 h-9 rounded-full border border-gray-300 overflow-hidden cursor-pointer"
                                                            style={{ backgroundColor: c }}
                                                            title={c}
                                                        >
                                                            <input
                                                                type="color"
                                                                value={
                                                                    /^#[0-9a-fA-F]{6}$/.test(c)
                                                                        ? c
                                                                        : '#E74C3C'
                                                                }
                                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                                onChange={(ev) => {
                                                                    const next = [...palette];
                                                                    next[i] = ev.target.value;
                                                                    void updatePreviewPalette(
                                                                        page._id,
                                                                        next,
                                                                    );
                                                                }}
                                                            />
                                                        </label>
                                                    ))}
                                                    <button
                                                        type="button"
                                                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                                        onClick={() =>
                                                            void updatePreviewPalette(
                                                                page._id,
                                                                [...palette, '#95A5A6'].slice(
                                                                    0,
                                                                    MAX_COLORING_PALETTE,
                                                                ),
                                                            )
                                                        }
                                                        disabled={palette.length >= MAX_COLORING_PALETTE}
                                                    >
                                                        + color
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                                        onClick={() =>
                                                            void updatePreviewPalette(
                                                                page._id,
                                                                DEFAULT_COLORING_PALETTE,
                                                            )
                                                        }
                                                    >
                                                        Reset default
                                                    </button>
                                                </div>
                                            </div>
                                            {page.tapFill.regionPreviewUrl && (
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-1">
                                                        Detected regions (auto-colored)
                                                    </p>
                                                    <img
                                                        src={getMediaUrl(
                                                            page.tapFill.regionPreviewUrl,
                                                        )}
                                                        alt="Region preview"
                                                        className="max-w-xs w-full rounded border border-gray-200 bg-white"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="lg:sticky lg:top-4 rounded-xl border border-gray-200 bg-gray-50/80 p-4">
                                {(() => {
                                    const page =
                                        coloringPages.find((p) => p._id === previewColoringId) ||
                                        coloringPages.find(
                                            (p) =>
                                                form.coloringPageIds.includes(p._id) &&
                                                p.tapFill?.enabled &&
                                                p.tapFill.regionMapUrl,
                                        );
                                    const lineArt = page
                                        ? page.files?.background?.url || page.backgroundUrl || ''
                                        : '';
                                    const regionMap = page?.tapFill?.regionMapUrl || '';
                                    const palette =
                                        page?.tapFill?.palette && page.tapFill.palette.length > 0
                                            ? page.tapFill.palette
                                            : DEFAULT_COLORING_PALETTE;
                                    return (
                                        <TapFillColoringPreview
                                            lineArtUrl={
                                                lineArt ? getMediaUrl(lineArt) : undefined
                                            }
                                            regionMapUrl={
                                                regionMap ? getMediaUrl(regionMap) : undefined
                                            }
                                            palette={palette}
                                            title={
                                                form.displayTitle || form.title || 'COLORING'
                                            }
                                            regionCount={page?.tapFill?.regionCount}
                                        />
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'quiz' && (
                    <BibleMapQuizPanel
                        quizMode={form.quizMode}
                        onQuizModeChange={(mode) => update('quizMode', mode)}
                        hasBook={!!form.bookId}
                        storyId={!isNew ? id : null}
                        bookId={form.bookId}
                        levels={form.quizLevels}
                        defaultLevel={form.quizDefaultLevel}
                        onLevelsChange={(levels) => update('quizLevels', levels)}
                        onDefaultLevelChange={(level) => update('quizDefaultLevel', level)}
                        packTitle={form.displayTitle || form.title}
                        scriptureRef={form.scriptureRef}
                        verse={form.verse}
                    />
                )}

                {tab === 'rewards' && (
                    <div className="space-y-5">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={form.rewardsEnabled}
                                onChange={(e) => update('rewardsEnabled', e.target.checked)}
                                className="w-4 h-4 text-emerald-600 rounded"
                            />
                            <span className="text-sm font-medium text-gray-800">
                                Enable Rewards loot box (Island ACTIVITIES)
                            </span>
                        </label>
                        <p className="text-xs text-gray-500 max-w-xl">
                            Kids unlock Rewards after Read + Quiz. Configure the loot pool below
                            (characters, games, coins, Dive Deeper book templates). Empty pool →
                            app defaults to gold coins (100–1000).
                        </p>

                        {form.rewardsEnabled && (
                            <div className="space-y-4">
                                {form.rewardsPool.map((item, idx) => (
                                    <div
                                        key={item.id}
                                        className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white max-w-2xl"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold text-gray-800">
                                                Reward {idx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    update(
                                                        'rewardsPool',
                                                        form.rewardsPool.filter((_, i) => i !== idx),
                                                    )
                                                }
                                                className="text-red-500 hover:text-red-700 p-1"
                                                aria-label="Remove reward"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Type
                                                </label>
                                                <select
                                                    value={item.type}
                                                    onChange={(e) => {
                                                        const type = e.target.value as RewardPoolType;
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = {
                                                            ...item,
                                                            type,
                                                            title:
                                                                item.title ||
                                                                emptyRewardItem(type).title,
                                                        };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                                >
                                                    <option value="coins">Gold Coins</option>
                                                    <option value="character">Character</option>
                                                    <option value="game">New Game</option>
                                                    <option value="book_template">
                                                        Book template (Dive Deeper)
                                                    </option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Title
                                                </label>
                                                <input
                                                    value={item.title}
                                                    onChange={(e) => {
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = { ...item, title: e.target.value };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    placeholder="Display title"
                                                />
                                            </div>
                                        </div>

                                        {(item.type === 'character' ||
                                            item.type === 'game' ||
                                            item.type === 'book_template') && (
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                                    Image URL
                                                </label>
                                                <div className="flex gap-2 items-center">
                                                    <input
                                                        value={item.imageUrl}
                                                        onChange={(e) => {
                                                            const next = [...form.rewardsPool];
                                                            next[idx] = {
                                                                ...item,
                                                                imageUrl: e.target.value,
                                                            };
                                                            update('rewardsPool', next);
                                                        }}
                                                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="https://… or upload"
                                                    />
                                                    <label className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium cursor-pointer hover:bg-gray-50">
                                                        <Upload className="w-3.5 h-3.5" />
                                                        Upload
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                e.target.value = '';
                                                                if (!file) return;
                                                                try {
                                                                    const fd = new FormData();
                                                                    fd.append('file', file);
                                                                    const islandKey =
                                                                        form.islandId || 'bible-map';
                                                                    const res = await apiClient.post(
                                                                        `/api/upload/image?bookId=bible-map&type=reward-image&islandId=${encodeURIComponent(islandKey)}`,
                                                                        fd,
                                                                    );
                                                                    const url =
                                                                        res.data?.url ||
                                                                        res.data?.imageUrl ||
                                                                        '';
                                                                    if (!url) throw new Error('No URL');
                                                                    const next = [...form.rewardsPool];
                                                                    next[idx] = {
                                                                        ...item,
                                                                        imageUrl: url,
                                                                    };
                                                                    update('rewardsPool', next);
                                                                } catch (err) {
                                                                    console.error(err);
                                                                    alert('Failed to upload image');
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                </div>
                                                {item.imageUrl ? (
                                                    <img
                                                        src={getMediaUrl(item.imageUrl)}
                                                        alt=""
                                                        className="mt-2 w-16 h-16 object-cover rounded-lg border"
                                                    />
                                                ) : null}
                                            </div>
                                        )}

                                        {item.type === 'character' && (
                                            <div className="space-y-3">
                                                <input
                                                    value={item.characterName}
                                                    onChange={(e) => {
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = {
                                                            ...item,
                                                            characterName: e.target.value,
                                                        };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    placeholder="Character name"
                                                />

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        3D model (.glb)
                                                    </label>
                                                    {item.modelUrl ? (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span
                                                                className="truncate max-w-[18rem] text-gray-700"
                                                                title={item.modelUrl}
                                                            >
                                                                {modelFileMeta[item.id]?.name ||
                                                                    decodeURIComponent(
                                                                        item.modelUrl
                                                                            .split('/')
                                                                            .pop() || '3D model',
                                                                    )}
                                                            </span>
                                                            {modelFileMeta[item.id] ? (
                                                                <span className="text-xs text-gray-400 shrink-0">
                                                                    {(
                                                                        modelFileMeta[item.id].size /
                                                                        1024 /
                                                                        1024
                                                                    ).toFixed(1)}{' '}
                                                                    MB
                                                                </span>
                                                            ) : null}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const next = [
                                                                        ...form.rewardsPool,
                                                                    ];
                                                                    next[idx] = {
                                                                        ...item,
                                                                        modelUrl: '',
                                                                    };
                                                                    update('rewardsPool', next);
                                                                }}
                                                                className="text-red-500 hover:text-red-700 p-1 shrink-0"
                                                                aria-label="Remove 3D model"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium cursor-pointer hover:bg-gray-50">
                                                            {uploadingModelFor === item.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Upload className="w-3.5 h-3.5" />
                                                            )}
                                                            {uploadingModelFor === item.id
                                                                ? 'Uploading…'
                                                                : 'Upload .glb model'}
                                                            <input
                                                                type="file"
                                                                accept=".glb,model/gltf-binary"
                                                                className="hidden"
                                                                disabled={
                                                                    uploadingModelFor === item.id
                                                                }
                                                                onChange={(e) => {
                                                                    const file =
                                                                        e.target.files?.[0];
                                                                    e.target.value = '';
                                                                    if (!file) return;
                                                                    void handleCharacterModelUpload(
                                                                        item.id,
                                                                        file,
                                                                    );
                                                                }}
                                                            />
                                                        </label>
                                                    )}
                                                    <p className="text-[11px] text-gray-500 mt-1">
                                                        Character walks the ship deck in-app. Max 25 MB.
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Voice (ElevenLabs)
                                                    </label>
                                                    {ttsVoicesError ? (
                                                        <div>
                                                            <input
                                                                value={item.voiceId}
                                                                onChange={(e) => {
                                                                    const next = [
                                                                        ...form.rewardsPool,
                                                                    ];
                                                                    next[idx] = {
                                                                        ...item,
                                                                        voiceId: e.target.value,
                                                                    };
                                                                    update('rewardsPool', next);
                                                                }}
                                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                                placeholder="ElevenLabs voice id"
                                                            />
                                                            <p className="text-[11px] text-amber-600 mt-1">
                                                                Voice list unavailable (is
                                                                ELEVENLABS_API_KEY configured?).
                                                                Paste a voice id manually.
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex gap-2 items-center">
                                                            <select
                                                                value={item.voiceId}
                                                                onChange={(e) => {
                                                                    const next = [
                                                                        ...form.rewardsPool,
                                                                    ];
                                                                    next[idx] = {
                                                                        ...item,
                                                                        voiceId: e.target.value,
                                                                    };
                                                                    update('rewardsPool', next);
                                                                }}
                                                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                                            >
                                                                <option value="">
                                                                    — No voice (chat disabled) —
                                                                </option>
                                                                {item.voiceId &&
                                                                    !ttsVoices.some(
                                                                        (v) =>
                                                                            v.id === item.voiceId,
                                                                    ) && (
                                                                        <option
                                                                            value={item.voiceId}
                                                                        >
                                                                            {item.voiceId} (not in
                                                                            list)
                                                                        </option>
                                                                    )}
                                                                {ttsVoices.map((v) => (
                                                                    <option
                                                                        key={v.id}
                                                                        value={v.id}
                                                                    >
                                                                        {v.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            {(() => {
                                                                const previewUrl = ttsVoices.find(
                                                                    (v) => v.id === item.voiceId,
                                                                )?.previewUrl;
                                                                return previewUrl ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            playVoicePreview(
                                                                                previewUrl,
                                                                            )
                                                                        }
                                                                        className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 shrink-0"
                                                                        title="Play voice preview"
                                                                        aria-label="Play voice preview"
                                                                    >
                                                                        <Play className="w-4 h-4 text-emerald-600" />
                                                                    </button>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Persona / how this character speaks
                                                        (optional)
                                                    </label>
                                                    <textarea
                                                        value={item.persona}
                                                        onChange={(e) => {
                                                            const next = [...form.rewardsPool];
                                                            next[idx] = {
                                                                ...item,
                                                                persona: e.target.value,
                                                            };
                                                            update('rewardsPool', next);
                                                        }}
                                                        rows={3}
                                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="e.g. Noah is gentle and grateful, loves talking about animals and God's promises, often mentions the rainbow…"
                                                    />
                                                    <p className="text-[11px] text-gray-500 mt-1">
                                                        Guides the in-app AI chat so the character
                                                        stays true to their Bible story.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {item.type === 'game' && (
                                            <div className="space-y-1">
                                                <input
                                                    value={item.gameUrl}
                                                    onChange={(e) => {
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = {
                                                            ...item,
                                                            gameUrl: e.target.value,
                                                        };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    placeholder="https://game-url…"
                                                />
                                                <p className="text-[11px] text-gray-500">
                                                    Appears in the app Games Library when kids collect this reward.
                                                </p>
                                            </div>
                                        )}

                                        {item.type === 'book_template' && (
                                            <div className="space-y-2">
                                                <select
                                                    value={item.bookId}
                                                    onChange={(e) => {
                                                        const bookId = e.target.value;
                                                        const book = bibleMapBooks.find(
                                                            (b) => b._id === bookId,
                                                        );
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = {
                                                            ...item,
                                                            bookId,
                                                            title: item.title || book?.title || '',
                                                        };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                                >
                                                    <option value="">— Kids Monthly / book id —</option>
                                                    {bibleMapBooks.map((b) => (
                                                        <option key={b._id} value={b._id}>
                                                            {b.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-[11px] text-gray-500">
                                                    Prefer a Kids Monthly Book. Paste any book ObjectId in
                                                    Image/title fields if not listed.
                                                </p>
                                                <input
                                                    value={item.bookId}
                                                    onChange={(e) => {
                                                        const next = [...form.rewardsPool];
                                                        next[idx] = {
                                                            ...item,
                                                            bookId: e.target.value,
                                                        };
                                                        update('rewardsPool', next);
                                                    }}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    placeholder="Or paste book ObjectId"
                                                />
                                            </div>
                                        )}

                                        {item.type === 'coins' && (
                                            <div className="flex gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Min
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={item.coinMin}
                                                        onChange={(e) => {
                                                            const next = [...form.rewardsPool];
                                                            next[idx] = {
                                                                ...item,
                                                                coinMin: Number(e.target.value) || 100,
                                                            };
                                                            update('rewardsPool', next);
                                                        }}
                                                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                        Max
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={item.coinMax}
                                                        onChange={(e) => {
                                                            const next = [...form.rewardsPool];
                                                            next[idx] = {
                                                                ...item,
                                                                coinMax: Number(e.target.value) || 1000,
                                                            };
                                                            update('rewardsPool', next);
                                                        }}
                                                        className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() =>
                                        update('rewardsPool', [
                                            ...form.rewardsPool,
                                            emptyRewardItem('character'),
                                        ])
                                    }
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50"
                                >
                                    <Plus className="w-4 h-4" /> Add reward
                                </button>
                            </div>
                        )}

                        <details className="mt-6 border border-gray-200 rounded-xl p-4 max-w-2xl bg-gray-50">
                            <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                Legacy game unlock (optional)
                            </summary>
                            <p className="text-xs text-gray-500 mt-2 mb-3">
                                Older packs used a single Game activity. Prefer Rewards pool type
                                &quot;New Game&quot; above. Legacy fields still sync if needed.
                            </p>
                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                <input
                                    type="checkbox"
                                    checked={form.gameEnabled}
                                    onChange={(e) => {
                                        update('gameEnabled', e.target.checked);
                                        if (e.target.checked && form.gameKind === 'none') {
                                            update('gameKind', 'webview');
                                        }
                                    }}
                                    className="w-4 h-4 text-emerald-600 rounded"
                                />
                                <span className="text-sm text-gray-800">Enable legacy game</span>
                            </label>
                            {form.gameEnabled && (
                                <div className="space-y-2">
                                    <select
                                        value={form.gameKind}
                                        onChange={(e) =>
                                            update(
                                                'gameKind',
                                                e.target.value as StoryFormState['gameKind'],
                                            )
                                        }
                                        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
                                    >
                                        <option value="catalog">Catalog game</option>
                                        <option value="webview">Custom webview URL</option>
                                    </select>
                                    {form.gameKind === 'webview' && (
                                        <>
                                            <input
                                                value={form.gameWebviewTitle}
                                                onChange={(e) =>
                                                    update('gameWebviewTitle', e.target.value)
                                                }
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                placeholder="Game title"
                                            />
                                            <input
                                                value={form.gameWebviewUrl}
                                                onChange={(e) =>
                                                    update('gameWebviewUrl', e.target.value)
                                                }
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                                placeholder="https://game-url…"
                                            />
                                        </>
                                    )}
                                    {form.gameKind === 'catalog' && (
                                        <select
                                            value={form.gameId}
                                            onChange={(e) => update('gameId', e.target.value)}
                                            className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 bg-white text-sm"
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
                                    )}
                                </div>
                            )}
                        </details>
                    </div>
                )}

            </div>
        </div>
    );
};

export default BibleMapStoryForm;
