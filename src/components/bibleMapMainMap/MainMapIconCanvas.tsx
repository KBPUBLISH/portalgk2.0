import React, { useCallback, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getMediaUrl } from '../../services/apiClient';
import {
    MAIN_MAP_SIZE_MAX,
    MAIN_MAP_SIZE_MIN,
    clampBadgeCenter,
    type MainMapPoint,
    type MainMapSize,
    type MainMapStoryMarker,
} from './types';

export interface PlacedMarker {
    story: MainMapStoryMarker;
    position: MainMapPoint;
    size: MainMapSize;
    iconUrl: string;
}

interface MainMapIconCanvasProps {
    markers: PlacedMarker[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    onMove: (id: string, next: MainMapPoint) => void;
    onResize?: (id: string, next: MainMapSize) => void;
    /** Display-only kid-app view — no drag/select chrome. */
    readOnly?: boolean;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Drag story icons as % of the device frame.
 * (x,y) is the center of the circular badge; the label hangs below and does not shift the center.
 */
const MainMapIconCanvas: React.FC<MainMapIconCanvasProps> = ({
    markers,
    selectedId,
    onSelect,
    onMove,
    onResize,
    readOnly = false,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        id: string;
        mode: 'move' | 'resize';
        startX: number;
        startY: number;
        origPos: MainMapPoint;
        origSize: MainMapSize;
    } | null>(null);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = (
        e: React.PointerEvent,
        id: string,
        mode: 'move' | 'resize',
    ) => {
        if (readOnly) return;
        e.stopPropagation();
        e.preventDefault();
        const marker = markers.find((m) => m.story._id === id);
        if (!marker || !rootRef.current) return;
        onSelect(id);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        dragRef.current = {
            id,
            mode,
            startX: e.clientX,
            startY: e.clientY,
            origPos: { ...marker.position },
            origSize: { ...marker.size },
        };
        setDragging(true);
    };

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            const drag = dragRef.current;
            const root = rootRef.current;
            if (!drag || !root) return;
            const rect = root.getBoundingClientRect();
            if (rect.width < 1 || rect.height < 1) return;
            const dxPct = ((e.clientX - drag.startX) / rect.width) * 100;
            const dyPct = ((e.clientY - drag.startY) / rect.height) * 100;

            if (drag.mode === 'move') {
                onMove(
                    drag.id,
                    clampBadgeCenter(
                        {
                            x: drag.origPos.x + dxPct,
                            y: drag.origPos.y + dyPct,
                        },
                        drag.origSize,
                    ),
                );
                return;
            }

            if (!onResize) return;
            // Resize expands around the badge center (position stays put).
            const maxW = Math.min(
                MAIN_MAP_SIZE_MAX,
                2 * Math.min(drag.origPos.x, 100 - drag.origPos.x),
            );
            const maxH = Math.min(
                MAIN_MAP_SIZE_MAX,
                2 * Math.min(drag.origPos.y, 100 - drag.origPos.y),
            );
            onResize(drag.id, {
                w: clamp(drag.origSize.w + dxPct, MAIN_MAP_SIZE_MIN, maxW),
                h: clamp(drag.origSize.h + dyPct, MAIN_MAP_SIZE_MIN, maxH),
            });
        },
        [onMove, onResize],
    );

    const onPointerUp = () => {
        dragRef.current = null;
        setDragging(false);
    };

    return (
        <div
            ref={rootRef}
            className={`absolute inset-0 ${
                readOnly ? 'pointer-events-none' : dragging ? 'cursor-grabbing' : ''
            }`}
            onPointerMove={readOnly ? undefined : onPointerMove}
            onPointerUp={readOnly ? undefined : onPointerUp}
            onPointerLeave={readOnly ? undefined : onPointerUp}
            onClick={readOnly ? undefined : () => onSelect(null)}
        >
            {markers.map((marker) => {
                const { story, position, size, iconUrl } = marker;
                const selected = !readOnly && selectedId === story._id;
                const label = story.displayTitle || story.title || `#${story.order}`;
                const src = iconUrl ? getMediaUrl(iconUrl) : '';

                const body = (
                    <>
                        <span className="relative flex items-center justify-center w-full h-full">
                            {src ? (
                                <img
                                    src={src}
                                    alt=""
                                    className="max-w-full max-h-full object-contain drop-shadow-md pointer-events-none rounded-full"
                                    draggable={false}
                                />
                            ) : (
                                <span
                                    className={`flex flex-col items-center justify-center w-[90%] aspect-square rounded-full shadow-md ${
                                        readOnly
                                            ? 'bg-emerald-700/90 border-2 border-emerald-300 text-white'
                                            : 'bg-amber-50 border-2 border-dashed border-amber-400 text-amber-800'
                                    }`}
                                    title={readOnly ? undefined : 'Add a map icon for this pack'}
                                >
                                    <MapPin className="w-[42%] h-[42%]" strokeWidth={2.2} />
                                    {!readOnly && (
                                        <span className="text-[6px] font-bold leading-none mt-0.5 px-0.5 text-center">
                                            Add icon
                                        </span>
                                    )}
                                </span>
                            )}
                            {!readOnly && (
                                <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-indigo-600 text-white text-[9px] font-bold leading-4 text-center">
                                    {story.order}
                                </span>
                            )}
                            {selected && (
                                <span
                                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                    aria-hidden
                                >
                                    <span className="absolute w-[70%] h-px bg-rose-400/90" />
                                    <span className="absolute h-[70%] w-px bg-rose-400/90" />
                                    <span className="absolute w-2 h-2 rounded-full border-2 border-rose-500 bg-white/80" />
                                </span>
                            )}
                        </span>
                        <span
                            className="absolute left-1/2 top-full -translate-x-1/2 mt-0.5 text-[7px] leading-tight font-bold text-white tracking-wide truncate max-w-[140%] text-center px-0.5 pointer-events-none"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                        >
                            {label}
                        </span>
                        {selected && onResize && (
                            <span
                                className="absolute right-0 bottom-0 w-3 h-3 bg-indigo-500 border border-white rounded-sm cursor-nwse-resize z-30"
                                onPointerDown={(e) => onPointerDown(e, story._id, 'resize')}
                                aria-label="Resize"
                            />
                        )}
                    </>
                );

                // Position = center of circular badge (label is absolutely below).
                const style: React.CSSProperties = {
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${size.w}%`,
                    height: `${size.h}%`,
                    transform: 'translate(-50%, -50%)',
                };

                if (readOnly) {
                    return (
                        <div
                            key={story._id}
                            className="absolute flex items-center justify-center select-none z-10"
                            style={style}
                            aria-label={label}
                        >
                            {body}
                        </div>
                    );
                }

                return (
                    <button
                        key={story._id}
                        type="button"
                        className={`absolute flex items-center justify-center touch-none select-none ${
                            selected
                                ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-transparent z-20'
                                : 'z-10'
                        } ${dragging && selected ? 'opacity-90' : ''}`}
                        style={{
                            ...style,
                            cursor: dragging && selected ? 'grabbing' : 'grab',
                        }}
                        onPointerDown={(e) => onPointerDown(e, story._id, 'move')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(story._id);
                        }}
                        aria-label={label}
                        title={`${label} — center ${position.x.toFixed(1)}, ${position.y.toFixed(1)}`}
                    >
                        {body}
                    </button>
                );
            })}
        </div>
    );
};

export default MainMapIconCanvas;
