import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Save,
    Smartphone,
    Tablet,
    Upload,
    ExternalLink,
    Map as MapIcon,
    Eye,
    Move,
    RefreshCw,
    Sparkles,
    Loader2,
} from 'lucide-react';
import apiClient, { API_BASE_URL, getMediaUrl } from '../../services/apiClient';
import MainMapDevicePreview from './MainMapDevicePreview';
import type { PlacedMarker } from './MainMapIconCanvas';
import {
    apiErrorMessage,
    DEFAULT_MAIN_MAP_SIZE,
    explicitPositionKeys,
    explicitSizeKeys,
    formatSize,
    MAIN_MAP_LAYOUT_KEYS,
    MAIN_MAP_LAYOUT_LABELS,
    pickExplicitMainMapPosition,
    pickExplicitMainMapSize,
    resolveAllMainMapPositions,
    resolveAllMainMapSizes,
    resolveMainMapPoint,
    responseHasBadgeCenterAnchor,
    type MainMapLayoutKey,
    type MainMapPoint,
    type MainMapPosition,
    type MainMapSize,
    type MainMapSizeLayout,
    type MainMapStoryMarker,
} from './types';

export interface MainMapLayoutEditorProps {
    islandId: string;
    islandSlug?: string;
    mainMapUrl: string;
    mainMapVideoUrl?: string;
    onMainMapUrlChange?: (url: string) => void;
    onMainMapVideoUrlChange?: (url: string) => void;
    /** When true, show upload control for main map (island form already has one — can hide). */
    showMainMapUpload?: boolean;
}

interface LocalStoryState extends MainMapStoryMarker {
    mainMapPosition: MainMapPosition;
    mainMapSize: MainMapSizeLayout;
    positionExplicit: Record<MainMapLayoutKey, boolean>;
    sizeExplicit: Record<MainMapLayoutKey, boolean>;
    dirty: boolean;
}

function fmt(p: MainMapPoint): string {
    return `${p.x.toFixed(1)}, ${p.y.toFixed(1)}`;
}

const DEVICE_TOGGLE: {
    id: MainMapLayoutKey;
    label: string;
    Icon: typeof Smartphone;
}[] = [
    { id: 'phone_se', label: 'Phone SE', Icon: Smartphone },
    { id: 'phone', label: 'Phone', Icon: Smartphone },
    { id: 'phone_max', label: 'Phone Max', Icon: Smartphone },
    { id: 'tablet', label: 'Tablet', Icon: Tablet },
];

function toLocalStory(
    s: MainMapStoryMarker,
    i: number,
    total: number,
    /** When true, skip legacy topLeft→badgeCenter (coords already badge-centered). */
    forceBadgeCenter = false,
): LocalStoryState {
    const posExplicit = explicitPositionKeys(s);
    const sizeExplicit = explicitSizeKeys(s);
    const asBadge: MainMapStoryMarker = forceBadgeCenter
        ? { ...s, mainMapPositionAnchor: 'badgeCenter' }
        : s;
    // Materialize phone + tablet stagger defaults into editable state; SE/Max stay fallback until edited
    const position = resolveAllMainMapPositions(asBadge, i, total);
    const size = resolveAllMainMapSizes(asBadge);
    return {
        ...s,
        mainMapPosition: position,
        mainMapSize: size,
        positionExplicit: {
            ...posExplicit,
            // Treat resolved phone/tablet defaults as saveable (legacy behavior)
            phone: posExplicit.phone || true,
            tablet: posExplicit.tablet || true,
        },
        sizeExplicit: {
            ...sizeExplicit,
            phone: sizeExplicit.phone || true,
            tablet: sizeExplicit.tablet || true,
        },
        mainMapPositionAnchor: 'badgeCenter' as const,
        // Force-badge reload needs a re-save so the API stores the anchor
        dirty: forceBadgeCenter,
    };
}

const MainMapLayoutEditor: React.FC<MainMapLayoutEditorProps> = ({
    islandId,
    islandSlug,
    mainMapUrl,
    mainMapVideoUrl = '',
    onMainMapUrlChange,
    onMainMapVideoUrlChange,
    showMainMapUpload = false,
}) => {
    const [device, setDevice] = useState<MainMapLayoutKey>('phone');
    /** preview = kid-app view; edit = drag icons to position (default — this is how you fix pads) */
    const [canvasMode, setCanvasMode] = useState<'preview' | 'edit'>('edit');
    const [stories, setStories] = useState<LocalStoryState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [generatingIcon, setGeneratingIcon] = useState(false);
    const [uploadingMap, setUploadingMap] = useState(false);
    const [uploadingMapVideo, setUploadingMapVideo] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const mapInputRef = useRef<HTMLInputElement>(null);
    const mapVideoInputRef = useRef<HTMLInputElement>(null);

    const loadStories = useCallback(
        async (opts?: { forceBadgeCenter?: boolean }) => {
            setLoading(true);
            setSaveError(null);
            try {
                const res = await apiClient.get(
                    `/api/bible-map/stories?islandId=${encodeURIComponent(islandId)}&status=all`,
                );
                const list: MainMapStoryMarker[] = Array.isArray(res.data) ? res.data : [];
                const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const total = sorted.length;
                const force = Boolean(opts?.forceBadgeCenter);
                setStories(sorted.map((s, i) => toLocalStory(s, i, total, force)));
                setDirty(force);
                if (force) {
                    setSaveError(
                        'Loaded raw coords as badge centers (skipped legacy conversion). ' +
                            'Re-check pad alignment, then Save all positions so the API stores mainMapPositionAnchor.',
                    );
                }
            } catch (err) {
                console.error(err);
                const msg = apiErrorMessage(err, 'Failed to load stories for main map layout');
                setSaveError(msg);
                alert(msg);
            } finally {
                setLoading(false);
            }
        },
        [islandId],
    );

    useEffect(() => {
        void loadStories();
    }, [loadStories]);

    const markers: PlacedMarker[] = useMemo(
        () =>
            stories.map((s) => ({
                story: s,
                position: s.mainMapPosition[device],
                size: s.mainMapSize[device],
                iconUrl: s.mapIconUrl || s.heroImageUrl || '',
            })),
        [stories, device],
    );

    const selected = stories.find((s) => s._id === selectedId) || null;

    const handleMove = (id: string, next: MainMapPoint) => {
        setStories((prev) =>
            prev.map((s) =>
                s._id === id
                    ? {
                          ...s,
                          mainMapPosition: {
                              ...s.mainMapPosition,
                              [device]: {
                                  x: Math.round(next.x * 10) / 10,
                                  y: Math.round(next.y * 10) / 10,
                              },
                          },
                          positionExplicit: {
                              ...s.positionExplicit,
                              [device]: true,
                          },
                          dirty: true,
                      }
                    : s,
            ),
        );
        setDirty(true);
    };

    const handleResize = (id: string, next: MainMapSize) => {
        setStories((prev) =>
            prev.map((s) =>
                s._id === id
                    ? {
                          ...s,
                          mainMapSize: {
                              ...s.mainMapSize,
                              [device]: {
                                  w: Math.round(next.w * 10) / 10,
                                  h: Math.round(next.h * 10) / 10,
                              },
                          },
                          sizeExplicit: {
                              ...s.sizeExplicit,
                              [device]: true,
                          },
                          dirty: true,
                      }
                    : s,
            ),
        );
        setDirty(true);
    };

    const handleResetSize = (id: string) => {
        const def = DEFAULT_MAIN_MAP_SIZE[device];
        setStories((prev) =>
            prev.map((s) =>
                s._id === id
                    ? {
                          ...s,
                          mainMapSize: {
                              ...s.mainMapSize,
                              [device]: { ...def },
                          },
                          sizeExplicit: {
                              ...s.sizeExplicit,
                              [device]: true,
                          },
                          dirty: true,
                      }
                    : s,
            ),
        );
        setDirty(true);
    };

    const uploadImage = async (file: File, kind: 'main-map' | 'map-icon'): Promise<string> => {
        const islandKey = islandSlug || islandId || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/image?bookId=bible-map&type=${kind}&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const uploadVideo = async (file: File): Promise<string> => {
        const islandKey = islandSlug || islandId || 'temp';
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiClient.post(
            `/api/upload/video?bookId=bible-map&type=main-map-video&islandId=${encodeURIComponent(islandKey)}`,
            formData,
        );
        return res.data.url as string;
    };

    const handleMainMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !onMainMapUrlChange) return;
        setUploadingMap(true);
        try {
            const url = await uploadImage(file, 'main-map');
            onMainMapUrlChange(url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload main map PNG');
        } finally {
            setUploadingMap(false);
        }
    };

    const handleMainMapVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !onMainMapVideoUrlChange) return;
        setUploadingMapVideo(true);
        try {
            const url = await uploadVideo(file);
            onMainMapVideoUrlChange(url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload main map video');
        } finally {
            setUploadingMapVideo(false);
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !selectedId) return;
        setUploadingIcon(true);
        try {
            const url = await uploadImage(file, 'map-icon');
            setStories((prev) =>
                prev.map((s) =>
                    s._id === selectedId ? { ...s, mapIconUrl: url, dirty: true } : s,
                ),
            );
            setDirty(true);
        } catch (err) {
            console.error(err);
            alert('Failed to upload map icon');
        } finally {
            setUploadingIcon(false);
        }
    };

    const handleGenerateIcon = async () => {
        if (!selectedId) return;
        setGeneratingIcon(true);
        try {
            const res = await apiClient.post(
                `/api/bible-map/stories/${selectedId}/generate-map-icon`,
                {},
                { timeout: 300000 },
            );
            const url = String(res.data?.mapIconUrl || '').trim();
            if (!url) {
                alert('Map icon generation returned no URL');
                return;
            }
            setStories((prev) =>
                prev.map((s) => {
                    if (s._id !== selectedId) return s;
                    if (!res.data?.mainMapPosition) {
                        return { ...s, mapIconUrl: url, dirty: false };
                    }
                    const merged: MainMapStoryMarker = {
                        ...s,
                        mainMapPosition: res.data.mainMapPosition,
                    };
                    return {
                        ...s,
                        mapIconUrl: url,
                        mainMapPosition: {
                            phone_se: resolveMainMapPoint(merged, 'phone_se', 0, 1),
                            phone: resolveMainMapPoint(merged, 'phone', 0, 1),
                            phone_max: resolveMainMapPoint(merged, 'phone_max', 0, 1),
                            tablet: resolveMainMapPoint(merged, 'tablet', 0, 1),
                        },
                        positionExplicit: explicitPositionKeys(merged),
                        dirty: false,
                    };
                }),
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
            setGeneratingIcon(false);
        }
    };

    const buildSavePayload = (s: LocalStoryState) => {
        const mainMapPosition = pickExplicitMainMapPosition(
            s.mainMapPosition,
            s.positionExplicit,
        );
        const mainMapSize = pickExplicitMainMapSize(s.mainMapSize, s.sizeExplicit);
        // Ensure at least phone exists so legacy clients still get a layout
        if (!mainMapPosition.phone) {
            mainMapPosition.phone = { ...s.mainMapPosition.phone };
        }
        if (!mainMapSize.phone) {
            mainMapSize.phone = { ...s.mainMapSize.phone };
        }
        return {
            mapIconUrl: s.mapIconUrl || null,
            mainMapPosition,
            mainMapSize,
            mainMapPositionAnchor: 'badgeCenter' as const,
        };
    };

    const persistStories = async (toSave: LocalStoryState[]) => {
        if (toSave.length === 0) {
            alert('Nothing to save.');
            return;
        }
        setSaving(true);
        setSaveError(null);
        const failures: string[] = [];
        let missingAnchor = 0;
        let savedOk = 0;

        try {
            const results = await Promise.allSettled(
                toSave.map(async (s) => {
                    const res = await apiClient.put(
                        `/api/bible-map/stories/${s._id}`,
                        buildSavePayload(s),
                    );
                    return { story: s, data: res.data };
                }),
            );

            for (const result of results) {
                if (result.status === 'rejected') {
                    failures.push(apiErrorMessage(result.reason, 'Save failed'));
                    continue;
                }
                savedOk += 1;
                if (!responseHasBadgeCenterAnchor(result.value.data)) {
                    missingAnchor += 1;
                }
            }

            if (failures.length > 0) {
                const msg =
                    `Failed to save ${failures.length} of ${toSave.length} stor` +
                    `${toSave.length === 1 ? 'y' : 'ies'}. ${failures[0]}` +
                    (failures.length > 1 ? ` (+${failures.length - 1} more)` : '');
                setSaveError(msg);
                alert(msg);
                // Keep dirty flags; partial successes still marked dirty so retry is safe
                return;
            }

            if (missingAnchor > 0) {
                const msg =
                    `Saved ${savedOk} stor${savedOk === 1 ? 'y' : 'ies'}, but the API at ${API_BASE_URL} ` +
                    `did not keep mainMapPositionAnchor=badgeCenter. Kid app + portal now treat ` +
                    `missing anchor as badge-center, but deploy the updated backend so the field persists.`;
                setSaveError(msg);
                alert(msg);
                // Still clear dirty — write "succeeded", schema is the problem
            }

            setStories((prev) =>
                prev.map((s) =>
                    toSave.some((t) => t._id === s._id)
                        ? {
                              ...s,
                              dirty: false,
                              mainMapPositionAnchor: 'badgeCenter',
                          }
                        : s,
                ),
            );
            setDirty(false);
            if (missingAnchor === 0) {
                setSaveError(null);
                alert(
                    `Saved layout for ${savedOk} stor${savedOk === 1 ? 'y' : 'ies'} ` +
                        `(badge-center coords).`,
                );
            }
        } catch (err) {
            console.error(err);
            const msg = apiErrorMessage(err, 'Failed to save main map layout');
            setSaveError(msg);
            alert(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const toSave = dirty ? stories.filter((s) => s.dirty) : stories;
        await persistStories(toSave);
    };

    const handleSaveAll = async () => {
        if (stories.length === 0) return;
        await persistStories(stories);
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-indigo-600" />
                        Layout editor
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl">
                        Use <span className="font-medium text-gray-700">Edit layout</span> to drag
                        each circular icon onto a green pad. Place icons for each phone size you care
                        about — the kid app picks the closest saved layout for the user’s screen.
                        (x,y) is the center of the circular badge; labels hang below.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        disabled={loading || saving}
                        onClick={() => void loadStories()}
                        className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-3 py-2.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                        title="Reload story packs (use after creating a pack to see its icon)"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <button
                        type="button"
                        disabled={loading || saving || stories.length === 0}
                        onClick={() => {
                            if (
                                !window.confirm(
                                    'Reload coords as badge centers without the legacy top-left shift?\n\n' +
                                        'Use this if icons jumped off pads after a save (API was missing mainMapPositionAnchor). ' +
                                        'Then Save all positions.',
                                )
                            ) {
                                return;
                            }
                            void loadStories({ forceBadgeCenter: true });
                        }}
                        className="inline-flex items-center gap-2 border border-amber-300 text-amber-900 px-3 py-2.5 rounded-lg font-medium hover:bg-amber-50 disabled:opacity-50 text-sm"
                        title="Recovery: treat stored x,y as badge centers"
                    >
                        Fix drifted coords
                    </button>
                    <button
                        type="button"
                        disabled={saving || stories.length === 0}
                        onClick={() => void handleSaveAll()}
                        className="inline-flex items-center gap-2 border border-indigo-200 text-indigo-800 px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50"
                        title="Write current positions for every story (including auto stagger)"
                    >
                        Save all positions
                    </button>
                    <button
                        type="button"
                        disabled={saving || !dirty}
                        onClick={() => void handleSave()}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
                    </button>
                </div>
            </div>

            {showMainMapUpload && (
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                        Main map background
                    </label>
                    <p className="text-xs text-gray-500">
                        Video plays as the map background; PNG is poster/fallback. Story icons overlay
                        on top.
                    </p>
                    <input
                        ref={mapVideoInputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleMainMapVideoUpload}
                    />
                    <input
                        ref={mapInputRef}
                        type="file"
                        accept="image/png,image/*"
                        className="hidden"
                        onChange={handleMainMapUpload}
                    />
                    <div className="flex flex-wrap gap-2">
                        {onMainMapVideoUrlChange && (
                            <button
                                type="button"
                                disabled={uploadingMapVideo}
                                onClick={() => mapVideoInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {uploadingMapVideo
                                    ? 'Uploading…'
                                    : mainMapVideoUrl
                                      ? 'Replace map video'
                                      : 'Upload map video'}
                            </button>
                        )}
                        {onMainMapUrlChange && (
                            <button
                                type="button"
                                disabled={uploadingMap}
                                onClick={() => mapInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Upload className="w-4 h-4" />
                                {uploadingMap
                                    ? 'Uploading…'
                                    : mainMapUrl
                                      ? 'Replace map PNG'
                                      : 'Upload map PNG'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div
                className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950 space-y-1.5"
                role="note"
            >
                <p className="font-semibold text-amber-900">
                    Place icons for Phone SE, Phone, Phone Max, and Tablet as needed. Save. The app
                    picks the closest layout for each device.
                </p>
                <p className="text-xs text-amber-900/85 leading-relaxed">
                    Drag the crosshair (badge center) onto each green pad. Labels stay under the
                    icon. Unset sizes fall back (Phone Max → Phone → Phone SE → Tablet). API:{' '}
                    <code className="rounded bg-amber-100/80 px-1 py-0.5 text-[11px] break-all">
                        {API_BASE_URL}
                    </code>
                    . Kid app must use the same host.
                </p>
            </div>

            {saveError && (
                <div
                    className="rounded-lg border border-red-300 bg-red-50 px-3.5 py-3 text-sm text-red-950"
                    role="alert"
                >
                    <p className="font-semibold text-red-900">Layout save problem</p>
                    <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap">{saveError}</p>
                    <button
                        type="button"
                        className="mt-2 text-xs font-medium text-red-800 underline"
                        onClick={() => setSaveError(null)}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap rounded-lg border border-gray-300 overflow-hidden text-sm">
                    {DEVICE_TOGGLE.map(({ id: deviceId, label, Icon }) => (
                        <button
                            key={deviceId}
                            type="button"
                            onClick={() => setDevice(deviceId)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 ${
                                device === deviceId
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                    <button
                        type="button"
                        onClick={() => setCanvasMode('preview')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                            canvasMode === 'preview'
                                ? 'bg-slate-800 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <Eye className="w-4 h-4" />
                        Preview
                    </button>
                    <button
                        type="button"
                        onClick={() => setCanvasMode('edit')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                            canvasMode === 'edit'
                                ? 'bg-amber-500 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <Move className="w-4 h-4" />
                        Edit layout
                    </button>
                </div>
                <span className="text-xs text-gray-500">
                    Editing{' '}
                    <span className="font-medium text-gray-700">
                        {MAIN_MAP_LAYOUT_LABELS[device]}
                    </span>{' '}
                    only
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,auto)_1fr] gap-6 items-start">
                <MainMapDevicePreview
                    device={device}
                    mainMapUrl={mainMapUrl}
                    mainMapVideoUrl={mainMapVideoUrl}
                    markers={markers}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMove={handleMove}
                    onResize={handleResize}
                    interactive={canvasMode === 'edit'}
                    loading={loading}
                    hideDeviceToggle
                    caption={
                        canvasMode === 'edit'
                            ? 'Crosshair marks the badge center — place that on each green pad.'
                            : undefined
                    }
                />

                <div className="space-y-3 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-800">
                        Stories ({stories.length}) — order preserved
                    </h3>
                    {stories.length === 0 && !loading ? (
                        <p className="text-sm text-gray-500">
                            No story packs on this island yet.{' '}
                            <Link
                                to={`/bible-map/stories/new?islandId=${islandId}`}
                                className="text-emerald-700 hover:underline"
                            >
                                Add a story pack
                            </Link>
                        </p>
                    ) : (
                        <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                            {stories.map((s) => {
                                const active = s._id === selectedId;
                                const pos = s.mainMapPosition[device];
                                const size = s.mainMapSize[device];
                                const customized = s.positionExplicit[device];
                                return (
                                    <li
                                        key={s._id}
                                        className={`rounded-lg border p-3 text-sm ${
                                            active
                                                ? 'border-indigo-400 bg-indigo-50'
                                                : 'border-gray-200 bg-gray-50'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            className="w-full text-left"
                                            onClick={() => {
                                                setSelectedId(s._id);
                                                if (canvasMode === 'preview') {
                                                    setCanvasMode('edit');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium text-gray-900 truncate">
                                                    {s.order}. {s.title}
                                                </span>
                                                <span className="flex items-center gap-1 shrink-0">
                                                    {customized ? (
                                                        <span className="text-[10px] uppercase tracking-wide text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                            set
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] uppercase tracking-wide text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded">
                                                            fallback
                                                        </span>
                                                    )}
                                                    {s.dirty && (
                                                        <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                                            unsaved
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                                {MAIN_MAP_LAYOUT_LABELS[device]}: {fmt(pos)} ·{' '}
                                                {formatSize(size)}%
                                            </p>
                                            {!s.mapIconUrl && (
                                                <p className="text-[11px] text-amber-700 mt-1">
                                                    Missing map icon — select & generate or upload
                                                </p>
                                            )}
                                        </button>
                                        <div className="mt-2">
                                            <Link
                                                to={`/bible-map/stories/${s._id}`}
                                                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Edit pack
                                            </Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    {selected && (
                        <div className="border border-indigo-200 rounded-lg p-4 space-y-3 bg-indigo-50/40">
                            <p className="text-sm font-medium text-gray-900">
                                Selected: {selected.displayTitle || selected.title}
                            </p>
                            <p className="text-[11px] text-gray-500">
                                Coordinates are badge center % of the frame. Unset sizes fall back
                                at runtime — customize only the ones you need.
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                {MAIN_MAP_LAYOUT_KEYS.map((key) => (
                                    <div key={key}>
                                        <span className="font-medium text-gray-700">
                                            {MAIN_MAP_LAYOUT_LABELS[key]}
                                        </span>
                                        {selected.positionExplicit[key] ? (
                                            <span className="ml-1 text-[10px] text-emerald-700">
                                                set
                                            </span>
                                        ) : (
                                            <span className="ml-1 text-[10px] text-slate-500">
                                                fallback
                                            </span>
                                        )}
                                        <p className="font-mono mt-0.5">
                                            {fmt(selected.mainMapPosition[key])} ·{' '}
                                            {formatSize(selected.mainMapSize[key])}%
                                        </p>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-xs text-gray-600 font-mono">
                                    {MAIN_MAP_LAYOUT_LABELS[device]} size:{' '}
                                    {formatSize(selected.mainMapSize[device])}%
                                </p>
                                <button
                                    type="button"
                                    onClick={() => handleResetSize(selected._id)}
                                    className="text-xs text-indigo-700 hover:underline"
                                    title={`Reset ${MAIN_MAP_LAYOUT_LABELS[device]} size to default`}
                                >
                                    Reset size
                                </button>
                            </div>
                            {selected.mapIconUrl ? (
                                <img
                                    src={getMediaUrl(selected.mapIconUrl)}
                                    alt=""
                                    className="w-14 h-14 rounded-full object-cover border border-gray-200"
                                />
                            ) : (
                                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                    <p className="font-medium">No map icon yet</p>
                                    <p className="mt-0.5 text-amber-800/80">
                                        Generate with AI (style-aware) or upload a circular badge so
                                        this pack shows on the main map.
                                    </p>
                                </div>
                            )}
                            <input
                                ref={iconInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleIconUpload}
                            />
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={generatingIcon || uploadingIcon}
                                    onClick={() => void handleGenerateIcon()}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {generatingIcon ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    {generatingIcon
                                        ? 'Generating…'
                                        : selected.mapIconUrl
                                          ? 'Regenerate icon'
                                          : 'Generate map icon'}
                                </button>
                                <button
                                    type="button"
                                    disabled={uploadingIcon || generatingIcon}
                                    onClick={() => iconInputRef.current?.click()}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploadingIcon
                                        ? 'Uploading…'
                                        : selected.mapIconUrl
                                          ? 'Replace map icon'
                                          : 'Upload map icon'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainMapLayoutEditor;
