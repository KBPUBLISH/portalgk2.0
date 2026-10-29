import React, { useMemo, useState } from 'react';
import { Image as ImageIcon, Map as MapIcon, Smartphone, Tablet } from 'lucide-react';
import { getMediaUrl } from '../../services/apiClient';
import MainMapIconCanvas, { type PlacedMarker } from './MainMapIconCanvas';
import {
    MAIN_MAP_DEVICE_FRAME,
    MAIN_MAP_LAYOUT_KEYS,
    MAIN_MAP_LAYOUT_LABELS,
    type MainMapLayoutKey,
    type MainMapPoint,
    type MainMapSize,
} from './types';

export interface MainMapDevicePreviewProps {
    device: MainMapLayoutKey;
    onDeviceChange?: (device: MainMapLayoutKey) => void;
    mainMapUrl: string;
    /** Looping video background; when set, plays instead of (or over) the PNG poster. */
    mainMapVideoUrl?: string;
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
    /** Hide the device toggle (parent owns it). */
    hideDeviceToggle?: boolean;
    className?: string;
}

type MediaBox = { w: number; h: number };
type StageBox = { left: number; top: number; width: number; height: number };

/** Same phone fit as the kid app: grow a wide map toward full-bleed. */
function fitMediaStage(view: { w: number; h: number }, media: MediaBox): StageBox {
    const widthFit = view.w / media.w;
    const heightFit = view.h / media.h;
    const contain = Math.min(widthFit, heightFit);
    const tallPhone = widthFit < heightFit;
    const scale = tallPhone ? contain + (heightFit - contain) * 0.78 : contain;
    const width = media.w * scale;
    const height = media.h * scale;
    return {
        left: (view.w - width) / 2,
        top: view.h - height,
        width,
        height,
    };
}

function coverBox(view: { w: number; h: number }, media: MediaBox) {
    const s = Math.max(view.w / media.w, view.h / media.h);
    const coverW = media.w * s;
    const coverH = media.h * s;
    return {
        coverW,
        coverH,
        coverX: (view.w - coverW) / 2,
        coverY: view.h - coverH,
    };
}

/** Stored % is the old object-cover frame. Show it on the fitted image. */
function coverPointToImagePercent(
    point: MainMapPoint,
    view: { w: number; h: number },
    media: MediaBox,
): MainMapPoint {
    const { coverW, coverH, coverX, coverY } = coverBox(view, media);
    return {
        x: (((point.x / 100) * view.w - coverX) / coverW) * 100,
        y: (((point.y / 100) * view.h - coverY) / coverH) * 100,
    };
}

function imagePercentToCoverPoint(
    point: MainMapPoint,
    view: { w: number; h: number },
    media: MediaBox,
): MainMapPoint {
    const { coverW, coverH, coverX, coverY } = coverBox(view, media);
    return {
        x: ((coverX + (point.x / 100) * coverW) / view.w) * 100,
        y: ((coverY + (point.y / 100) * coverH) / view.h) * 100,
    };
}

function coverSizeToImagePercent(
    size: MainMapSize,
    view: { w: number; h: number },
    media: MediaBox,
): MainMapSize {
    const { coverW, coverH } = coverBox(view, media);
    return {
        w: ((size.w / 100) * view.w / coverW) * 100,
        h: ((size.h / 100) * view.h / coverH) * 100,
    };
}

function imageSizeToCoverPercent(
    size: MainMapSize,
    view: { w: number; h: number },
    media: MediaBox,
): MainMapSize {
    const { coverW, coverH } = coverBox(view, media);
    return {
        w: ((size.w / 100) * coverW / view.w) * 100,
        h: ((size.h / 100) * coverH / view.h) * 100,
    };
}

const DEVICE_TOGGLE: {
    id: MainMapLayoutKey;
    label: string;
    Icon: typeof Smartphone;
}[] = [
    { id: 'phone_se', label: 'Phone SE', Icon: Smartphone },
    { id: 'phone', label: 'Phone', Icon: Smartphone },
    { id: 'phone_max', label: 'Phone Max', Icon: Smartphone },
    { id: 'tablet', label: 'iPad portrait', Icon: Tablet },
    { id: 'tablet_landscape', label: 'iPad landscape', Icon: Tablet },
];

/**
 * Form-factor chrome preview of the island main map screen
 * (background video or PNG + story icons) as kids see it in the app.
 *
 * Icon % coords are saved against the device frame. The preview draws the same
 * enlarged map as the kid app and places badges on that image, so a pad you
 * drag here is the pad kids see.
 */
const MainMapDevicePreview: React.FC<MainMapDevicePreviewProps> = ({
    device,
    onDeviceChange,
    mainMapUrl,
    mainMapVideoUrl = '',
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
    const frame = MAIN_MAP_DEVICE_FRAME[device];
    const videoSrc = mainMapVideoUrl ? getMediaUrl(mainMapVideoUrl) : '';
    const mapSrc = mainMapUrl ? getMediaUrl(mainMapUrl) : '';
    const hasVideo = Boolean(videoSrc);
    const hasMap = hasVideo || Boolean(mapSrc);
    const storyCount = markers.length;
    const isPhoneChrome = device !== 'tablet' && device !== 'tablet_landscape';
    const activeSrc = hasVideo ? videoSrc : mapSrc;
    const [mediaSize, setMediaSize] = useState<{ src: string; box: MediaBox } | null>(null);
    const sized = mediaSize && mediaSize.src === activeSrc ? mediaSize.box : null;
    const view = { w: frame.width, h: frame.height };
    const stage = useMemo(
        () => (sized ? fitMediaStage(view, sized) : null),
        [sized, view.w, view.h],
    );
    const displayMarkers = useMemo(() => {
        if (!stage || !sized) return markers;
        return markers.map((marker) => ({
            ...marker,
            position: coverPointToImagePercent(marker.position, view, sized),
            size: coverSizeToImagePercent(marker.size, view, sized),
        }));
    }, [markers, stage, sized, view.w, view.h]);
    const noteMediaSize = (w: number, h: number) => {
        if (w > 0 && h > 0) {
            setMediaSize((prev) =>
                prev && prev.src === activeSrc && prev.box.w === w && prev.box.h === h
                    ? prev
                    : { src: activeSrc, box: { w, h } },
            );
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            {!hideDeviceToggle && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <MapIcon className="w-4 h-4 text-indigo-600" />
                            Device preview
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Kid app picks the closest saved layout for the user’s screen
                        </p>
                    </div>
                    <div className="flex flex-wrap rounded-lg border border-gray-300 overflow-hidden text-sm">
                        {DEVICE_TOGGLE.map(({ id: deviceId, label, Icon }) => (
                            <button
                                key={deviceId}
                                type="button"
                                onClick={() => onDeviceChange?.(deviceId)}
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
                        boxSizing: 'content-box',
                        borderRadius: frame.borderRadius,
                        border: '10px solid #1f2937',
                        boxShadow:
                            '0 12px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                    }}
                >
                    {isPhoneChrome ? (
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937] rounded-b-xl"
                            style={{
                                width: device === 'phone_se' ? 72 : device === 'phone_max' ? 96 : 88,
                                height: 18,
                            }}
                            aria-hidden
                        />
                    ) : (
                        <div
                            className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-[#1f2937]/80 rounded-full"
                            style={{ width: 72, height: 5 }}
                            aria-hidden
                        />
                    )}

                    {hasVideo ? (
                        <video
                            key={videoSrc}
                            src={videoSrc}
                            className="absolute select-none"
                            style={
                                stage
                                    ? {
                                          left: stage.left,
                                          top: stage.top,
                                          width: stage.width,
                                          height: stage.height,
                                          maxWidth: 'none',
                                          maxHeight: 'none',
                                      }
                                    : {
                                          inset: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          objectPosition: 'center bottom',
                                      }
                            }
                            muted
                            loop
                            playsInline
                            autoPlay
                            preload="auto"
                            poster={mapSrc || undefined}
                            onLoadedMetadata={(e) =>
                                noteMediaSize(e.currentTarget.videoWidth, e.currentTarget.videoHeight)
                            }
                        />
                    ) : mapSrc ? (
                        <img
                            src={mapSrc}
                            alt="Main map"
                            className="absolute select-none"
                            style={
                                stage
                                    ? {
                                          left: stage.left,
                                          top: stage.top,
                                          width: stage.width,
                                          height: stage.height,
                                          maxWidth: 'none',
                                          maxHeight: 'none',
                                      }
                                    : {
                                          inset: 0,
                                          width: '100%',
                                          height: '100%',
                                          objectFit: 'cover',
                                          objectPosition: 'center bottom',
                                      }
                            }
                            draggable={false}
                            onLoad={(e) =>
                                noteMediaSize(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
                            }
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sky-900/90 text-white/80 px-5 text-center text-xs">
                            <ImageIcon className="w-9 h-9 opacity-50" />
                            <p className="font-medium text-sm text-white/90">No main map yet</p>
                            <p className="text-white/50 leading-relaxed">
                                Upload a main map video or PNG on this island form to preview the kid
                                screen.
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
                        <div
                            className="absolute"
                            style={
                                stage
                                    ? {
                                          left: stage.left,
                                          top: stage.top,
                                          width: stage.width,
                                          height: stage.height,
                                      }
                                    : { inset: 0 }
                            }
                        >
                            <MainMapIconCanvas
                                markers={displayMarkers}
                                selectedId={interactive ? selectedId : null}
                                onSelect={interactive ? onSelect || (() => undefined) : () => undefined}
                                onMove={
                                    interactive && onMove
                                        ? (id, next) =>
                                              onMove(
                                                  id,
                                                  sized
                                                      ? imagePercentToCoverPoint(next, view, sized)
                                                      : next,
                                              )
                                        : () => undefined
                                }
                                onResize={
                                    interactive && onResize
                                        ? (id, next) =>
                                              onResize(
                                                  id,
                                                  sized
                                                      ? imageSizeToCoverPercent(next, view, sized)
                                                      : next,
                                              )
                                        : undefined
                                }
                                readOnly={!interactive}
                            />
                        </div>
                    )}

                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 text-white text-sm">
                            Loading stories…
                        </div>
                    )}
                </div>

                <p className="mt-3 text-[11px] text-slate-300/90 text-center">
                    {MAIN_MAP_DEVICE_FRAME[device].label}
                    {hasMap
                        ? storyCount > 0
                            ? ` · ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}`
                            : ' · empty map'
                        : ' · waiting for map'}
                    {hasVideo ? ' · video BG' : ''}
                    {interactive
                        ? ' · drag badge center onto pads · corner to resize'
                        : ''}
                </p>
                <p className="mt-1 text-[10px] text-slate-400/90 text-center max-w-xs">
                    Layouts: {MAIN_MAP_LAYOUT_KEYS.map((k) => MAIN_MAP_LAYOUT_LABELS[k]).join(' · ')}
                </p>
            </div>

            {caption ? <div className="text-xs text-gray-500 text-center">{caption}</div> : null}
        </div>
    );
};

export default MainMapDevicePreview;
