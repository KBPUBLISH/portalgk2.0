import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Save,
    Smartphone,
    Tablet,
    Upload,
    Image as ImageIcon,
    ExternalLink,
    Map as MapIcon,
} from 'lucide-react';
import apiClient, { getMediaUrl } from '../../services/apiClient';
import { DEVICE_FRAME, type SceneDevice } from '../sceneStudio/types';
import MainMapIconCanvas, { type PlacedMarker } from './MainMapIconCanvas';
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
    const [stories, setStories] = useState<LocalStoryState[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadingIcon, setUploadingIcon] = useState(false);
    const [uploadingMap, setUploadingMap] = useState(false);
    const [dirty, setDirty] = useState(false);
    const iconInputRef = useRef<HTMLInputElement>(null);
    const mapInputRef = useRef<HTMLInputElement>(null);

    const frame = DEVICE_FRAME[device];

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
            stories.map((s, i) => ({
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

    const mapSrc = mainMapUrl ? getMediaUrl(mainMapUrl) : '';

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-indigo-600" />
                        Main map layout
                    </h2>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl">
                        App flow: Ocean → tap island → this main map (PNG + story icons) → tap icon
                        → intro video → Scene Studio for that pack. Drag icons to set phone/tablet
                        positions (% of frame). Unset icons start on a staggered path by story order.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
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

            <div className="flex flex-wrap gap-2">
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
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                            device === deviceId
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
                <div
                    className="relative bg-slate-800 shadow-xl mx-auto"
                    style={{
                        width: frame.width,
                        height: frame.height,
                        borderRadius: frame.borderRadius,
                        border: '10px solid #1f2937',
                        boxShadow:
                            '0 12px 40px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                    }}
                >
                    {device === 'phone' && (
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                            style={{ width: 88, height: 18 }}
                            aria-hidden
                        />
                    )}
                    {mapSrc ? (
                        <img
                            src={mapSrc}
                            alt="Main map"
                            className="absolute inset-0 w-full h-full object-cover"
                            draggable={false}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sky-900/80 text-white/70 px-4 text-center text-xs">
                            <ImageIcon className="w-8 h-8 opacity-50" />
                            <p>No main map PNG yet</p>
                            <p className="text-white/40">Upload on this island form</p>
                        </div>
                    )}
                    {!loading && (
                        <MainMapIconCanvas
                            markers={markers}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onMove={handleMove}
                        />
                    )}
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-white text-sm">
                            Loading stories…
                        </div>
                    )}
                </div>

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
                        <ul className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
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
                                            onClick={() => setSelectedId(s._id)}
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
                                <p className="text-xs text-gray-500">
                                    No map icon — using hero image or placeholder.
                                </p>
                            )}
                            <input
                                ref={iconInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleIconUpload}
                            />
                            <button
                                type="button"
                                disabled={uploadingIcon}
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
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainMapLayoutEditor;
