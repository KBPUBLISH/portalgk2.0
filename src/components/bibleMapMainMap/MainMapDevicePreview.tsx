import React from 'react';
import { Image as ImageIcon, Map as MapIcon, Smartphone, Tablet } from 'lucide-react';
import { getMediaUrl } from '../../services/apiClient';
import { DEVICE_FRAME, type SceneDevice } from '../sceneStudio/types';
import MainMapIconCanvas, { type PlacedMarker } from './MainMapIconCanvas';
import type { MainMapPoint, MainMapSize } from './types';

export interface MainMapDevicePreviewProps {
    device: SceneDevice;
    onDeviceChange?: (device: SceneDevice) => void;
    mainMapUrl: string;
    markers: PlacedMarker[];
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onMove?: (id: string, next: MainMapPoint) => void;
    onResize?: (id: string, next: MainMapSize) => void;
    /** When false, icons are display-only (kid-app view). Default false. */
    interactive?: boolean;
    loading?: boolean;
    /** Extra caption under the frame (e.g. save tip). */
    caption?: React.ReactNode;
    /** Hide the Phone | Tablet toggle (parent owns it). */
    hideDeviceToggle?: boolean;
    className?: string;
}

/**
 * Phone/tablet chrome preview of the island main map screen
 * (background PNG + story icons) as kids see it in the app.
 */
const MainMapDevicePreview: React.FC<MainMapDevicePreviewProps> = ({
    device,
    onDeviceChange,
    mainMapUrl,
    markers,
    selectedId = null,
    onSelect,
    onMove,
    onResize,
    interactive = false,
    loading = false,
    caption,
    hideDeviceToggle = false,
    className = '',
}) => {
    const frame = DEVICE_FRAME[device];
    const mapSrc = mainMapUrl ? getMediaUrl(mainMapUrl) : '';
    const hasMap = Boolean(mapSrc);
    const storyCount = markers.length;

    return (
        <div className={`space-y-3 ${className}`}>
            {!hideDeviceToggle && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <MapIcon className="w-4 h-4 text-indigo-600" />
                            Phone · Tablet preview
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Kid app view of the main map screen
                        </p>
                    </div>
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
                                onClick={() => onDeviceChange?.(deviceId)}
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
                </div>
            )}

            <div
                className="rounded-2xl border border-slate-200 px-4 py-6 flex flex-col items-center"
                style={{
                    background:
                        'radial-gradient(ellipse at 50% 20%, #334155 0%, #1e293b 55%, #0f172a 100%)',
                }}
            >
                <div
                    className="relative bg-slate-900 shadow-xl mx-auto transition-[width,height,border-radius] duration-300"
                    style={{
                        width: frame.width,
                        height: frame.height,
                        borderRadius: frame.borderRadius,
                        border: '10px solid #1f2937',
                        boxShadow:
                            '0 12px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                    }}
                >
                    {device === 'phone' ? (
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                            style={{ width: 88, height: 18 }}
                            aria-hidden
                        />
                    ) : (
                        <div
                            className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937]/80 rounded-full"
                            style={{ width: 72, height: 5 }}
                            aria-hidden
                        />
                    )}

                    {hasMap ? (
                        <img
                            src={mapSrc}
                            alt="Main map"
                            className="absolute inset-0 w-full h-full object-cover"
                            draggable={false}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sky-900/90 text-white/80 px-5 text-center text-xs">
                            <ImageIcon className="w-9 h-9 opacity-50" />
                            <p className="font-medium text-sm text-white/90">No main map PNG yet</p>
                            <p className="text-white/50 leading-relaxed">
                                Upload a main map image on this island form to preview the kid screen.
                            </p>
                        </div>
                    )}

                    {hasMap && !loading && storyCount === 0 && (
                        <div className="absolute inset-0 z-[5] flex items-end justify-center pointer-events-none pb-8 px-4">
                            <p
                                className="text-center text-[11px] font-medium text-white/90 bg-black/45 rounded-lg px-3 py-2 max-w-[90%]"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                            >
                                No story packs on this island yet — the map will show icons here once
                                you add packs.
                            </p>
                        </div>
                    )}

                    {!loading && hasMap && storyCount > 0 && (
                        <MainMapIconCanvas
                            markers={markers}
                            selectedId={interactive ? selectedId : null}
                            onSelect={interactive ? onSelect || (() => undefined) : () => undefined}
                            onMove={interactive && onMove ? onMove : () => undefined}
                            onResize={interactive && onResize ? onResize : undefined}
                            readOnly={!interactive}
                        />
                    )}

                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-white text-sm">
                            Loading stories…
                        </div>
                    )}
                </div>

                <p className="mt-3 text-[11px] text-slate-300/90 text-center">
                    {DEVICE_FRAME[device].label}
                    {hasMap
                        ? storyCount > 0
                            ? ` · ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}`
                            : ' · empty map'
                        : ' · waiting for map PNG'}
                    {interactive ? ' · drag to move · corner to resize' : ''}
                </p>
            </div>

            {caption ? <div className="text-xs text-gray-500 text-center">{caption}</div> : null}
        </div>
    );
};

export default MainMapDevicePreview;
