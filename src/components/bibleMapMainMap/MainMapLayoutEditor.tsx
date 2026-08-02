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
import apiClient, { getMediaUrl } from '../../services/apiClient';
import type { SceneDevice } from '../sceneStudio/types';
import MainMapDevicePreview from './MainMapDevicePreview';
import type { PlacedMarker } from './MainMapIconCanvas';
import {
    DEFAULT_MAIN_MAP_SIZE,
    resolveMainMapPoint,
    resolveMainMapSize,
    type MainMapPoint,
    type MainMapPosition,
    type MainMapSizeLayout,
    type MainMapStoryMarker,
} from './types';

export interface MainMapLayoutEditorProps {
    islandId: string;
    islandSlug?: string;
    mainMapUrl: string;
    onMainMapUrlChange?: (url: string) => void;
    /** When true, show upload control for main map (island form already has one — can hide). */
    showMainMapUpload?: boolean;
}

interface LocalStoryState extends MainMapStoryMarker {
    mainMapPosition: MainMapPosition;
    mainMapSize: MainMapSizeLayout;
    dirty: boolean;
}

function fmt(p: MainMapPoint): string {
    return `${p.x.toFixed(1)}, ${p.y.toFixed(1)}`;
}

const MainMapLayoutEditor: React.FC<MainMapLayoutEditorProps> = ({
    islandId,
    islandSlug,
    mainMapUrl,
    onMainMapUrlChange,
    showMainMapUpload = false,
}) => {
    const [device, setDevice] = useState<SceneDevice>('phone');
    /** preview = kid-app view; edit = drag icons to position */
    const [canvasMode, setCanvasMode] = useState<'preview' | 'edit'>('preview');
    const [stories, setStories] = useState<LocalStoryState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [generatingIcon, setGeneratingIcon] = useState(false);
    const [uploadingMap, setUploadingMap] = useState(false);
    const [dirty, setDirty] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const mapInputRef = useRef<HTMLInputElement>(null);

    const loadStories = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiClient.get(
                `/api/bible-map/stories?islandId=${encodeURIComponent(islandId)}&status=all`,
            );
            const list: MainMapStoryMarker[] = Array.isArray(res.data) ? res.data : [];
            const sorted = [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            const total = sorted.length;
            setStories(
                sorted.map((s, i) => ({
                    ...s,
                    mainMapPosition: {
                        phone: resolveMainMapPoint(s, 'phone', i, total),
                        tablet: resolveMainMapPoint(s, 'tablet', i, total),
                    },
                    mainMapSize: {
                        phone: resolveMainMapSize(s, 'phone'),
                        tablet: resolveMainMapSize(s, 'tablet'),
                    },
                    dirty: false,
                })),
            );
            setDirty(false);
        } catch (err) {
            console.error(err);
            alert('Failed to load stories for main map layout');
        } finally {
            setLoading(false);
        }
    }, [islandId]);

    useEffect(() => {
        void loadStories();
    }, [loadStories]);

    const markers: PlacedMarker[] = useMemo(
        () =>
            stories.map((s) => ({
                story: s,
                position: s.mainMapPosition[device],
                size: resolveMainMapSize(s, device),
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
                prev.map((s) =>
                    s._id === selectedId
                        ? {
                              ...s,
                              mapIconUrl: url,
                              mainMapPosition: res.data?.mainMapPosition
                                  ? {
                                        phone: resolveMainMapPoint(
                                            {
                                                ...s,
                                                mainMapPosition: res.data.mainMapPosition,
                                            },
                                            'phone',
                                            0,
                                            1,
                                        ),
                                        tablet: resolveMainMapPoint(
                                            {
                                                ...s,
                                                mainMapPosition: res.data.mainMapPosition,
                                            },
                                            'tablet',
                                            0,
                                            1,
                                        ),
                                    }
                                  : s.mainMapPosition,
                              dirty: false,
                          }
                        : s,
                ),
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

    const handleSave = async () => {
        // Persist all current positions so auto-staggered defaults get written on first save
        const toSave = dirty ? stories.filter((s) => s.dirty) : stories;
        if (toSave.length === 0) {
            alert('Nothing to save.');
            return;
        }
        setSaving(true);
        try {
            await Promise.all(
                toSave.map((s) =>
                    apiClient.put(`/api/bible-map/stories/${s._id}`, {
                        mapIconUrl: s.mapIconUrl || null,
                        mainMapPosition: s.mainMapPosition,
                        mainMapSize: s.mainMapSize || DEFAULT_MAIN_MAP_SIZE,
                    }),
                ),
            );
            setStories((prev) => prev.map((s) => ({ ...s, dirty: false })));
            setDirty(false);
            alert(`Saved layout for ${toSave.length} stor${toSave.length === 1 ? 'y' : 'ies'}.`);
        } catch (err) {
            console.error(err);
            alert('Failed to save main map layout');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAll = async () => {
        if (stories.length === 0) return;
        setSaving(true);
        try {
            await Promise.all(
                stories.map((s) =>
                    apiClient.put(`/api/bible-map/stories/${s._id}`, {
                        mapIconUrl: s.mapIconUrl || null,
                        mainMapPosition: s.mainMapPosition,
                        mainMapSize: s.mainMapSize || DEFAULT_MAIN_MAP_SIZE,
                    }),
                ),
            );
            setStories((prev) => prev.map((s) => ({ ...s, dirty: false })));
            setDirty(false);
            alert(`Saved layout for ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'}.`);
        } catch (err) {
            console.error(err);
            alert('Failed to save main map layout');
        } finally {
            setSaving(false);
        }
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
                        Toggle Phone/Tablet for device-specific positions. Preview shows the kid
                        screen; Edit layout lets you drag icons (% of frame). Unset icons start on a
                        staggered path by story order.
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
                        Main map PNG
                    </label>
                    <input
                        ref={mapInputRef}
                        type="file"
                        accept="image/png,image/*"
                        className="hidden"
                        onChange={handleMainMapUpload}
                    />
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
                              ? 'Replace main map'
                              : 'Upload main map'}
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
                    {(
                        [
                            { id: 'phone' as const, label: 'Phone', Icon: Smartphone },
                            { id: 'tablet' as const, label: 'Tablet', Icon: Tablet },
                        ] as const
                    ).map(({ id: deviceId, label, Icon }) => (
                        <button
                            key={deviceId}
                            type="button"
                            onClick={() => setDevice(deviceId)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${
                                device === deviceId
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
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
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,auto)_1fr] gap-6 items-start">
                <MainMapDevicePreview
                    device={device}
                    mainMapUrl={mainMapUrl}
                    markers={markers}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMove={handleMove}
                    interactive={canvasMode === 'edit'}
                    loading={loading}
                    hideDeviceToggle
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
                                                {s.dirty && (
                                                    <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                                        unsaved
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 font-mono">
                                                {device}: {fmt(pos)} %
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
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div>
                                    Phone:{' '}
                                    <span className="font-mono">
                                        {fmt(selected.mainMapPosition.phone)}
                                    </span>
                                </div>
                                <div>
                                    Tablet:{' '}
                                    <span className="font-mono">
                                        {fmt(selected.mainMapPosition.tablet)}
                                    </span>
                                </div>
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
