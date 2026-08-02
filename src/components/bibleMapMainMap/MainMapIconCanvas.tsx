import React, { useCallback, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { getMediaUrl } from '../../services/apiClient';
import type { MainMapPoint, MainMapSize, MainMapStoryMarker } from './types';

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
    /** Display-only kid-app view — no drag/select chrome. */
    readOnly?: boolean;
}

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Drag story icons as % of the device frame (same math as Scene Studio OverlayCanvas).
 */
const MainMapIconCanvas: React.FC<MainMapIconCanvasProps> = ({
    markers,
    selectedId,
    onSelect,
    onMove,
    readOnly = false,
}) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        id: string;
        startX: number;
        startY: number;
        orig: MainMapPoint;
        size: MainMapSize;
    } | null>(null);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = (e: React.PointerEvent, id: string) => {
        if (readOnly) return;
        e.stopPropagation();
        e.preventDefault();
        const marker = markers.find((m) => m.story._id === id);
        if (!marker || !rootRef.current) return;
        onSelect(id);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        dragRef.current = {
            id,
            startX: e.clientX,
            startY: e.clientY,
            orig: { ...marker.position },
            size: { ...marker.size },
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
            onMove(drag.id, {
                x: clamp(drag.orig.x + dxPct, 0, 100 - drag.size.w),
                y: clamp(drag.orig.y + dyPct, 0, 100 - drag.size.h),
            });
        },
        [onMove],
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
                        <span className="relative flex items-center justify-center w-full flex-1 min-h-0">
                            {src ? (
                                <img
                                    src={src}
                                    alt=""
                                    className="max-w-full max-h-full object-contain drop-shadow-md pointer-events-none rounded-full"
                                    draggable={false}
                                />
                            ) : (
                                <span
                                    className={`flex flex-col items-center justify-center w-[85%] aspect-square rounded-full shadow-md ${
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
                        </span>
                        <span
                            className="text-[7px] leading-tight font-bold text-white tracking-wide truncate w-full text-center px-0.5"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                        >
                            {label}
                        </span>
                    </>
                );

                const style: React.CSSProperties = {
                    left: `${position.x}%`,
                    top: `${position.y}%`,
                    width: `${size.w}%`,
                    height: `${size.h}%`,
                };

                if (readOnly) {
                    return (
                        <div
                            key={story._id}
                            className="absolute flex flex-col items-center justify-end select-none z-10"
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
                        className={`absolute flex flex-col items-center justify-end touch-none select-none ${
                            selected
                                ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-transparent z-20'
                                : 'z-10'
                        } ${dragging && selected ? 'opacity-90' : ''}`}
                        style={{
                            ...style,
                            cursor: dragging && selected ? 'grabbing' : 'grab',
                        }}
                        onPointerDown={(e) => onPointerDown(e, story._id)}
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect(story._id);
                        }}
                        aria-label={label}
                        title={label}
                    >
                        {body}
                    </button>
                );
            })}
        </div>
    );
};

export default MainMapIconCanvas;
