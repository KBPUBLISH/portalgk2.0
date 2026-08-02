import type { SceneDevice } from '../sceneStudio/types';
import { DEVICE_FRAME } from '../sceneStudio/types';

export type { SceneDevice };
export { DEVICE_FRAME };

export interface MainMapPoint {
    x: number;
    y: number;
}

export interface MainMapSize {
    w: number;
    h: number;
}

export interface MainMapPosition {
    phone: MainMapPoint;
    tablet: MainMapPoint;
}

export interface MainMapSizeLayout {
    phone: MainMapSize;
    tablet: MainMapSize;
}

export interface MainMapStoryMarker {
    _id: string;
    order: number;
    title: string;
    displayTitle?: string;
    mapIconUrl?: string;
    heroImageUrl?: string;
    mainMapPosition?: Partial<MainMapPosition> | null;
    mainMapSize?: Partial<MainMapSizeLayout> | null;
    status?: string;
}

/** Default icon size % of frame (fixed look for v1 if size unset). */
export const DEFAULT_MAIN_MAP_SIZE: MainMapSizeLayout = {
    phone: { w: 16, h: 12 },
    tablet: { w: 14, h: 11 },
};

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Staggered S-curve defaults so unset icons are not stacked at 50,50.
 * index is 0-based among stories sorted by order.
 */
export function defaultMainMapPoint(index: number, total: number): MainMapPoint {
    const n = Math.max(total, 1);
    const t = n === 1 ? 0.5 : index / (n - 1);
    // Vertical path with gentle left/right zig-zag
    const y = clamp(12 + t * 70, 6, 86);
    const phase = index % 2 === 0 ? -1 : 1;
    const x = clamp(50 + phase * (18 + (index % 3) * 4), 10, 78);
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
}

export function hasExplicitPoint(point?: MainMapPoint | null): boolean {
    return (
        !!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y)
    );
}

export function resolveMainMapPoint(
    story: MainMapStoryMarker,
    device: SceneDevice,
    index: number,
    total: number,
): MainMapPoint {
    const explicit = story.mainMapPosition?.[device];
    if (hasExplicitPoint(explicit)) {
        return {
            x: clamp(Number(explicit!.x), 0, 100),
            y: clamp(Number(explicit!.y), 0, 100),
        };
    }
    return defaultMainMapPoint(index, total);
}

export function resolveMainMapSize(
    story: MainMapStoryMarker,
    device: SceneDevice,
): MainMapSize {
    const fallback = DEFAULT_MAIN_MAP_SIZE[device];
    const raw = story.mainMapSize?.[device];
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const w = Number(raw.w);
    const h = Number(raw.h);
    return {
        w: Number.isFinite(w) ? clamp(w, 6, 40) : fallback.w,
        h: Number.isFinite(h) ? clamp(h, 6, 40) : fallback.h,
    };
}

export function emptyMainMapPosition(): MainMapPosition {
    return {
        phone: { x: 50, y: 50 },
        tablet: { x: 50, y: 50 },
    };
}

export function normalizeMainMapPosition(
    raw: unknown,
    orderIndex = 0,
    total = 1,
): MainMapPosition {
    const defPhone = defaultMainMapPoint(orderIndex, total);
    const defTablet = defaultMainMapPoint(orderIndex, total);
    if (!raw || typeof raw !== 'object') {
        return { phone: defPhone, tablet: defTablet };
    }
    const obj = raw as Partial<MainMapPosition>;
    return {
        phone: hasExplicitPoint(obj.phone)
            ? {
                  x: clamp(Number(obj.phone!.x), 0, 100),
                  y: clamp(Number(obj.phone!.y), 0, 100),
              }
            : defPhone,
        tablet: hasExplicitPoint(obj.tablet)
            ? {
                  x: clamp(Number(obj.tablet!.x), 0, 100),
                  y: clamp(Number(obj.tablet!.y), 0, 100),
              }
            : defTablet,
    };
}

export function formatPoint(p?: MainMapPoint | null): string {
    if (!hasExplicitPoint(p)) return '— (auto)';
    return `${Number(p!.x).toFixed(1)}, ${Number(p!.y).toFixed(1)}`;
}
