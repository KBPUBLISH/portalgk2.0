export type SceneDevice = 'phone' | 'tablet';
export type ScenePreviewMode = 'intro' | 'scene';
export type SceneActivityId = 'read' | 'quiz' | 'puzzle' | 'coloring' | 'game';
export type SceneLockUntil = 'always' | 'content' | 'trigger';
export type SceneAfterAction = 'navigate' | 'stay';

/** Bundled dialogue / tap-to-talk bubble (portal + kid app public assets). */
export const DIALOGUE_TAP_TO_TALK_ICON = '/assets/images/dialogue-tap-to-talk.png';

export function isDialogueButtonId(id: string): boolean {
    return id === 'dialogue' || id.startsWith('dialogue_');
}

/** Default phone placement for a tap-to-talk bubble (mid-scene, above activities). */
export function defaultDialogueButton(id = 'dialogue'): SceneButton {
    return {
        id,
        x: 72,
        y: 38,
        w: 18,
        h: 14,
        iconUrl: DIALOGUE_TAP_TO_TALK_ICON,
        label: 'TAP TO TALK',
        lockedUntil: 'always',
    };
}

/** Default tablet placement for a tap-to-talk bubble. */
export function defaultDialogueButtonTablet(id = 'dialogue'): SceneButton {
    return {
        id,
        x: 74,
        y: 36,
        w: 14,
        h: 12,
        iconUrl: DIALOGUE_TAP_TO_TALK_ICON,
        label: 'TAP TO TALK',
        lockedUntil: 'always',
    };
}

export interface SceneButton {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    iconUrl?: string;
    label?: string;
    lockedUntil?: SceneLockUntil;
}

export interface SceneDeviceLayout {
    showActivitiesBoard: boolean;
    buttons: SceneButton[];
}

export interface SceneLayout {
    phone: SceneDeviceLayout;
    tablet: SceneDeviceLayout;
}

export interface SceneAnimation {
    id: string;
    label: string;
    videoUrl: string;
}

export interface SceneTrigger {
    id: string;
    fromButtonId: string;
    animationId: string;
    after: SceneAfterAction;
    navigateTo: SceneActivityId | '';
}

export const SCENE_ACTIVITY_DEFS: Array<{
    id: SceneActivityId;
    label: string;
}> = [
    { id: 'read', label: 'READ STORY' },
    { id: 'quiz', label: 'QUIZZ' },
    { id: 'puzzle', label: 'PUZZLE' },
    { id: 'coloring', label: 'COLORING' },
    { id: 'game', label: 'GAME' },
];

/**
 * Default % positions roughly matching the in-app ACTIVITIES tray (phone).
 * No iconUrl — kid app uses its built-in tray until editors upload button icons.
 */
export function defaultPhoneButtons(): SceneButton[] {
    const ids = SCENE_ACTIVITY_DEFS;
    const startX = 10;
    const gap = 1.5;
    const w = 15;
    const y = 72;
    const h = 14;
    return ids.map((d, i) => ({
        id: d.id,
        x: startX + i * (w + gap),
        y,
        w,
        h,
        label: d.label,
        lockedUntil: d.id === 'read' ? 'always' : 'content',
    }));
}

export function defaultTabletButtons(): SceneButton[] {
    const ids = SCENE_ACTIVITY_DEFS;
    const startX = 18;
    const gap = 2;
    const w = 12;
    const y = 74;
    const h = 12;
    return ids.map((d, i) => ({
        id: d.id,
        x: startX + i * (w + gap),
        y,
        w,
        h,
        label: d.label,
        lockedUntil: d.id === 'read' ? 'always' : 'content',
    }));
}

export function emptySceneLayout(): SceneLayout {
    return {
        phone: { showActivitiesBoard: true, buttons: [] },
        tablet: { showActivitiesBoard: true, buttons: [] },
    };
}

export function normalizeLoadedLayout(raw: unknown): SceneLayout {
    const empty = emptySceneLayout();
    if (!raw || typeof raw !== 'object') return empty;
    const obj = raw as Partial<SceneLayout>;
    const normDevice = (d: unknown): SceneDeviceLayout => {
        if (!d || typeof d !== 'object') {
            return { showActivitiesBoard: true, buttons: [] };
        }
        const device = d as Partial<SceneDeviceLayout>;
        const buttons = Array.isArray(device.buttons)
            ? device.buttons
                  .filter((b): b is SceneButton => !!b && typeof b === 'object' && !!b.id)
                  .map((b) => ({
                      id: String(b.id),
                      x: Number(b.x) || 0,
                      y: Number(b.y) || 0,
                      w: Number(b.w) || 14,
                      h: Number(b.h) || 12,
                      iconUrl: b.iconUrl ? String(b.iconUrl) : undefined,
                      label: b.label ? String(b.label) : undefined,
                      lockedUntil:
                          b.lockedUntil === 'always' ||
                          b.lockedUntil === 'content' ||
                          b.lockedUntil === 'trigger'
                              ? b.lockedUntil
                              : 'content',
                  }))
            : [];
        return {
            showActivitiesBoard: device.showActivitiesBoard !== false,
            buttons,
        };
    };
    return {
        phone: normDevice(obj.phone),
        tablet: normDevice(obj.tablet),
    };
}

export function ensureDefaultButtons(layout: SceneLayout): SceneLayout {
    return {
        phone: {
            ...layout.phone,
            buttons:
                layout.phone.buttons.length > 0
                    ? layout.phone.buttons
                    : defaultPhoneButtons(),
        },
        tablet: {
            ...layout.tablet,
            buttons:
                layout.tablet.buttons.length > 0
                    ? layout.tablet.buttons
                    : defaultTabletButtons(),
        },
    };
}

export const DEVICE_FRAME: Record<
    SceneDevice,
    { width: number; height: number; label: string; borderRadius: number }
> = {
    phone: { width: 260, height: 520, label: 'Phone', borderRadius: 28 },
    tablet: { width: 360, height: 480, label: 'Tablet', borderRadius: 22 },
};

/**
 * @deprecated Import MAIN_MAP_DEVICE_FRAME from bibleMapMainMap/types
 * (supports phone_se / phone / phone_max / tablet). Legacy phone|tablet only.
 */
export const MAIN_MAP_DEVICE_FRAME: Record<
    SceneDevice,
    { width: number; height: number; label: string; borderRadius: number }
> = {
    phone: { width: 260, height: 562, label: 'Phone', borderRadius: 28 },
    tablet: { width: 360, height: 480, label: 'Tablet', borderRadius: 22 },
};

export function newId(prefix: string): string {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
