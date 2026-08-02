import { DEVICE_FRAME } from '../sceneStudio/types';

export { DEVICE_FRAME };

/** Form-factor layout keys for the island main map. */
export const MAIN_MAP_LAYOUT_KEYS = ['phone_se', 'phone', 'phone_max', 'tablet'] as const;
export type MainMapLayoutKey = (typeof MAIN_MAP_LAYOUT_KEYS)[number];

/** @deprecated Prefer MainMapLayoutKey — kept for older SceneDevice imports. */
export type SceneDevice = 'phone' | 'tablet';

export interface MainMapPoint {
    x: number;
    y: number;
}

export interface MainMapSize {
    w: number;
    h: number;
}

export type MainMapPosition = Record<MainMapLayoutKey, MainMapPoint>;
export type MainMapSizeLayout = Record<MainMapLayoutKey, MainMapSize>;

/**
 * Coordinate semantics for mainMapPosition (x,y):
 * - badgeCenter (current): center of the circular icon face
 * - topLeft (legacy): top-left of the icon+label chip
 */
export type MainMapPositionAnchor = 'topLeft' | 'badgeCenter';

export interface MainMapStoryMarker {
    _id: string;
    order: number;
    title: string;
    displayTitle?: string;
    mapIconUrl?: string;
    heroImageUrl?: string;
    mainMapPosition?: Partial<MainMapPosition> | null;
    mainMapSize?: Partial<MainMapSizeLayout> | null;
    /** When missing, stored coords are treated as legacy top-left. */
    mainMapPositionAnchor?: MainMapPositionAnchor | null;
    status?: string;
}

/** Default icon size % of frame (badge face box; label hangs below). */
export const DEFAULT_MAIN_MAP_SIZE: MainMapSizeLayout = {
    phone_se: { w: 17, h: 13 },
    phone: { w: 16, h: 12 },
    phone_max: { w: 15, h: 11 },
    tablet: { w: 14, h: 11 },
};

/** Sensible clamp for main-map icon size (% of device frame). */
export const MAIN_MAP_SIZE_MIN = 7;
export const MAIN_MAP_SIZE_MAX = 32;

/**
 * Fallback chain when a layout key is unset.
 * phone_max → phone → phone_se → tablet (and adjacent-first for others).
 */
export const MAIN_MAP_FALLBACK_CHAIN: Record<MainMapLayoutKey, MainMapLayoutKey[]> = {
    phone_se: ['phone_se', 'phone', 'phone_max', 'tablet'],
    phone: ['phone', 'phone_se', 'phone_max', 'tablet'],
    phone_max: ['phone_max', 'phone', 'phone_se', 'tablet'],
    tablet: ['tablet', 'phone_max', 'phone', 'phone_se'],
};

/** Preview chrome sizes — match ~375×667 / 390×844 / 430×932 / iPad-ish crops. */
export const MAIN_MAP_DEVICE_FRAME: Record<
    MainMapLayoutKey,
    { width: number; height: number; label: string; shortLabel: string; borderRadius: number }
> = {
    phone_se: {
        width: 220,
        height: 391,
        label: 'Phone SE (~375×667)',
        shortLabel: 'Phone SE',
        borderRadius: 28,
    },
    phone: {
        width: 260,
        height: 562,
        label: 'Phone (~390×844)',
        shortLabel: 'Phone',
        borderRadius: 28,
    },
    phone_max: {
        width: 280,
        height: 607,
        label: 'Phone Max (~430×932)',
        shortLabel: 'Phone Max',
        borderRadius: 30,
    },
    tablet: {
        width: 360,
        height: 480,
        label: 'Tablet / iPad',
        shortLabel: 'Tablet',
        borderRadius: 22,
    },
};

export const MAIN_MAP_LAYOUT_LABELS: Record<MainMapLayoutKey, string> = {
    phone_se: 'Phone SE',
    phone: 'Phone',
    phone_max: 'Phone Max',
    tablet: 'Tablet',
};

/** Approx. label height as % of frame (legacy chip had label inside the box). */
const LEGACY_LABEL_RESERVE_PCT = 2.2;

function clamp(n: number, min: number, max: number) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Convert legacy top-left-of-chip coords to badge-center coords.
 * Old layout: flex column with label at bottom; circle centered in remaining area.
 */
export function legacyTopLeftToBadgeCenter(
    pos: MainMapPoint,
    size: MainMapSize,
): MainMapPoint {
    const labelReserve = Math.min(LEGACY_LABEL_RESERVE_PCT, Math.max(1.2, size.h * 0.22));
    return {
        x: clamp(pos.x + size.w / 2, 0, 100),
        y: clamp(pos.y + (size.h - labelReserve) / 2, 0, 100),
    };
}

/**
 * Staggered S-curve defaults so unset icons are not stacked at 50,50.
 * Values are badge-center coordinates. index is 0-based among stories sorted by order.
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

export function hasExplicitSize(size?: MainMapSize | null): boolean {
    return (
        !!size &&
        typeof size.w === 'number' &&
        Number.isFinite(size.w) &&
        typeof size.h === 'number' &&
        Number.isFinite(size.h) &&
        size.w > 0 &&
        size.h > 0
    );
}

/** First key in the fallback chain that has an explicit saved point. */
export function resolveLayoutKeyForPoint(
    story: MainMapStoryMarker,
    device: MainMapLayoutKey,
): MainMapLayoutKey | null {
    for (const key of MAIN_MAP_FALLBACK_CHAIN[device]) {
        if (hasExplicitPoint(story.mainMapPosition?.[key])) return key;
    }
    return null;
}

/** First key in the fallback chain that has an explicit saved size. */
export function resolveLayoutKeyForSize(
    story: MainMapStoryMarker,
    device: MainMapLayoutKey,
): MainMapLayoutKey | null {
    for (const key of MAIN_MAP_FALLBACK_CHAIN[device]) {
        if (hasExplicitSize(story.mainMapSize?.[key])) return key;
    }
    return null;
}

export function resolveMainMapSize(
    story: MainMapStoryMarker,
    device: MainMapLayoutKey,
): MainMapSize {
    const sourceKey = resolveLayoutKeyForSize(story, device);
    const fallback = DEFAULT_MAIN_MAP_SIZE[device];
    if (!sourceKey) return { ...fallback };
    const raw = story.mainMapSize?.[sourceKey];
    if (!raw || typeof raw !== 'object') return { ...fallback };
    const w = Number(raw.w);
    const h = Number(raw.h);
    return {
        w: Number.isFinite(w) ? clamp(w, MAIN_MAP_SIZE_MIN, MAIN_MAP_SIZE_MAX) : fallback.w,
        h: Number.isFinite(h) ? clamp(h, MAIN_MAP_SIZE_MIN, MAIN_MAP_SIZE_MAX) : fallback.h,
    };
}

/**
 * Resolve badge-center (x,y) for a layout key, walking the fallback chain.
 * Legacy saved points (no mainMapPositionAnchor / topLeft) are converted once for display.
 */
export function resolveMainMapPoint(
    story: MainMapStoryMarker,
    device: MainMapLayoutKey,
    index: number,
    total: number,
): MainMapPoint {
    const sourceKey = resolveLayoutKeyForPoint(story, device);
    if (sourceKey) {
        const explicit = story.mainMapPosition?.[sourceKey];
        const raw = {
            x: clamp(Number(explicit!.x), 0, 100),
            y: clamp(Number(explicit!.y), 0, 100),
        };
        if (story.mainMapPositionAnchor === 'badgeCenter') {
            return raw;
        }
        return legacyTopLeftToBadgeCenter(raw, resolveMainMapSize(story, sourceKey));
    }
    return defaultMainMapPoint(index, total);
}

export function formatSize(s?: MainMapSize | null): string {
    if (!s || typeof s.w !== 'number' || typeof s.h !== 'number') return '—';
    return `${Number(s.w).toFixed(1)}×${Number(s.h).toFixed(1)}`;
}

export function emptyMainMapPosition(): MainMapPosition {
    return {
        phone_se: { x: 50, y: 50 },
        phone: { x: 50, y: 50 },
        phone_max: { x: 50, y: 50 },
        tablet: { x: 50, y: 50 },
    };
}

/** Build a full local position map (resolved), for editor drag state. */
export function resolveAllMainMapPositions(
    story: MainMapStoryMarker,
    orderIndex: number,
    total: number,
): MainMapPosition {
    return {
        phone_se: resolveMainMapPoint(story, 'phone_se', orderIndex, total),
        phone: resolveMainMapPoint(story, 'phone', orderIndex, total),
        phone_max: resolveMainMapPoint(story, 'phone_max', orderIndex, total),
        tablet: resolveMainMapPoint(story, 'tablet', orderIndex, total),
    };
}

export function resolveAllMainMapSizes(story: MainMapStoryMarker): MainMapSizeLayout {
    return {
        phone_se: resolveMainMapSize(story, 'phone_se'),
        phone: resolveMainMapSize(story, 'phone'),
        phone_max: resolveMainMapSize(story, 'phone_max'),
        tablet: resolveMainMapSize(story, 'tablet'),
    };
}

/** Which layout keys have explicitly saved coords (not fallback). */
export function explicitPositionKeys(
    story: MainMapStoryMarker,
): Record<MainMapLayoutKey, boolean> {
    return {
        phone_se: hasExplicitPoint(story.mainMapPosition?.phone_se),
        phone: hasExplicitPoint(story.mainMapPosition?.phone),
        phone_max: hasExplicitPoint(story.mainMapPosition?.phone_max),
        tablet: hasExplicitPoint(story.mainMapPosition?.tablet),
    };
}

export function explicitSizeKeys(
    story: MainMapStoryMarker,
): Record<MainMapLayoutKey, boolean> {
    return {
        phone_se: hasExplicitSize(story.mainMapSize?.phone_se),
        phone: hasExplicitSize(story.mainMapSize?.phone),
        phone_max: hasExplicitSize(story.mainMapSize?.phone_max),
        tablet: hasExplicitSize(story.mainMapSize?.tablet),
    };
}

/**
 * Payload for API save: only include customized/explicit keys so unset
 * form-factors keep runtime fallback. Always keeps phone (and tablet if set)
 * when materializing stagger defaults.
 */
export function pickExplicitMainMapPosition(
    position: MainMapPosition,
    explicit: Record<MainMapLayoutKey, boolean>,
): Partial<MainMapPosition> {
    const out: Partial<MainMapPosition> = {};
    for (const key of MAIN_MAP_LAYOUT_KEYS) {
        if (explicit[key] && hasExplicitPoint(position[key])) {
            out[key] = {
                x: clamp(Number(position[key].x), 0, 100),
                y: clamp(Number(position[key].y), 0, 100),
            };
        }
    }
    return out;
}

export function pickExplicitMainMapSize(
    size: MainMapSizeLayout,
    explicit: Record<MainMapLayoutKey, boolean>,
): Partial<MainMapSizeLayout> {
    const out: Partial<MainMapSizeLayout> = {};
    for (const key of MAIN_MAP_LAYOUT_KEYS) {
        if (explicit[key] && hasExplicitSize(size[key])) {
            out[key] = {
                w: clamp(Number(size[key].w), MAIN_MAP_SIZE_MIN, MAIN_MAP_SIZE_MAX),
                h: clamp(Number(size[key].h), MAIN_MAP_SIZE_MIN, MAIN_MAP_SIZE_MAX),
            };
        }
    }
    return out;
}

export function normalizeMainMapPosition(
    raw: unknown,
    orderIndex = 0,
    total = 1,
): MainMapPosition {
    const def = defaultMainMapPoint(orderIndex, total);
    if (!raw || typeof raw !== 'object') {
        return {
            phone_se: { ...def },
            phone: { ...def },
            phone_max: { ...def },
            tablet: { ...def },
        };
    }
    const obj = raw as Partial<MainMapPosition>;
    const pick = (key: MainMapLayoutKey): MainMapPoint =>
        hasExplicitPoint(obj[key])
            ? {
                  x: clamp(Number(obj[key]!.x), 0, 100),
                  y: clamp(Number(obj[key]!.y), 0, 100),
              }
            : { ...def };
    return {
        phone_se: pick('phone_se'),
        phone: pick('phone'),
        phone_max: pick('phone_max'),
        tablet: pick('tablet'),
    };
}

export function formatPoint(p?: MainMapPoint | null): string {
    if (!hasExplicitPoint(p)) return '— (auto)';
    return `${Number(p!.x).toFixed(1)}, ${Number(p!.y).toFixed(1)}`;
}

/** Clamp a badge-center point so the badge face stays inside the frame. */
export function clampBadgeCenter(
    pos: MainMapPoint,
    size: MainMapSize,
): MainMapPoint {
    const halfW = size.w / 2;
    const halfH = size.h / 2;
    return {
        x: clamp(pos.x, halfW, 100 - halfW),
        y: clamp(pos.y, halfH, 100 - halfH),
    };
}
