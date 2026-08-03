import React, { useMemo, useRef, useState } from 'react';
import { Upload, Clapperboard, Music, X, Film, ChevronDown } from 'lucide-react';
import DevicePreview from './DevicePreview';
import OverlayCanvas from './OverlayCanvas';
import TriggerBoard from './TriggerBoard';
import {
    clearButtonVideo,
    defaultDialogueButton,
    defaultDialogueButtonTablet,
    DIALOGUE_TAP_TO_TALK_ICON,
    ensureDefaultButtons,
    getButtonVideoUrl,
    isDialogueButtonId,
    newId,
    upsertButtonStayVideo,
    type SceneAnimation,
    type SceneDevice,
    type SceneLayout,
    type ScenePreviewMode,
    type SceneTrigger,
} from './types';
import { getMediaUrl } from '../../services/apiClient';

export interface SceneStudioProps {
    /** Display title on the island scene wood header (MapStory.displayTitle). */
    sceneTitle: string;
    introVideoUrl: string;
    sceneBgVideoUrl: string;
    sceneMusicUrl: string;
    sceneLayout: SceneLayout;
    sceneAnimations: SceneAnimation[];
    sceneTriggers: SceneTrigger[];
    onSceneTitle: (title: string) => void;
    onIntroVideoUrl: (url: string) => void;
    onSceneBgVideoUrl: (url: string) => void;
    onSceneMusicUrl: (url: string) => void;
    onSceneLayout: (layout: SceneLayout) => void;
    onSceneAnimations: (anims: SceneAnimation[]) => void;
    onSceneTriggers: (triggers: SceneTrigger[]) => void;
    onUploadVideo: (file: File, kind: 'intro' | 'scene-bg' | 'scene-anim') => Promise<string>;
    onUploadMusic: (file: File) => Promise<string>;
    onUploadButtonIcon: (file: File) => Promise<string>;
}

const SceneStudio: React.FC<SceneStudioProps> = ({
    sceneTitle,
    introVideoUrl,
    sceneBgVideoUrl,
    sceneMusicUrl,
    sceneLayout,
    sceneAnimations,
    sceneTriggers,
    onSceneTitle,
    onIntroVideoUrl,
    onSceneBgVideoUrl,
    onSceneMusicUrl,
    onSceneLayout,
    onSceneAnimations,
    onSceneTriggers,
    onUploadVideo,
    onUploadMusic,
    onUploadButtonIcon,
}) => {
    const [device, setDevice] = useState<SceneDevice>('phone');
    const [previewMode, setPreviewMode] = useState<ScenePreviewMode>('scene');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uploadingIntro, setUploadingIntro] = useState(false);
    const [uploadingBg, setUploadingBg] = useState(false);
    const [uploadingMusic, setUploadingMusic] = useState(false);
    const [uploadingBtnIcon, setUploadingBtnIcon] = useState(false);
    const [uploadingBtnVideoId, setUploadingBtnVideoId] = useState<string | null>(null);
    const [iconUploadTargetId, setIconUploadTargetId] = useState<string | null>(null);
    const [showAdvancedWires, setShowAdvancedWires] = useState(false);
    const introRef = useRef<HTMLInputElement>(null);
    const bgRef = useRef<HTMLInputElement>(null);
    const musicRef = useRef<HTMLInputElement>(null);
    const btnIconRef = useRef<HTMLInputElement>(null);
    const btnVideoRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const layoutWithDefaults = useMemo(
        () => ensureDefaultButtons(sceneLayout),
        [sceneLayout],
    );
    const deviceLayout = layoutWithDefaults[device];

    const previewUrl = getMediaUrl(
        previewMode === 'intro' ? introVideoUrl : sceneBgVideoUrl,
    );

    /** Unique tap-to-talk buttons across phone + tablet (same id on both). */
    const dialogueButtons = useMemo(() => {
        const byId = new Map<string, (typeof deviceLayout.buttons)[0]>();
        for (const b of layoutWithDefaults.phone.buttons) {
            if (isDialogueButtonId(b.id)) byId.set(b.id, b);
        }
        for (const b of layoutWithDefaults.tablet.buttons) {
            if (isDialogueButtonId(b.id) && !byId.has(b.id)) byId.set(b.id, b);
        }
        return Array.from(byId.values());
    }, [layoutWithDefaults]);

    const setDeviceButtons = (buttons: typeof deviceLayout.buttons) => {
        // Persist preview defaults once the editor actually places/edits buttons.
        onSceneLayout({
            ...layoutWithDefaults,
            [device]: { ...deviceLayout, buttons },
        });
    };

    /** Patch a button by id on both phone and tablet (icon / label stay in sync). */
    const patchButtonBothDevices = (
        buttonId: string,
        patch: Partial<(typeof deviceLayout.buttons)[0]>,
    ) => {
        const patchList = (buttons: typeof deviceLayout.buttons) =>
            buttons.map((b) => (b.id === buttonId ? { ...b, ...patch } : b));
        onSceneLayout({
            phone: {
                ...layoutWithDefaults.phone,
                buttons: patchList(layoutWithDefaults.phone.buttons),
            },
            tablet: {
                ...layoutWithDefaults.tablet,
                buttons: patchList(layoutWithDefaults.tablet.buttons),
            },
        });
    };

    const setShowBoard = (show: boolean) => {
        // Do not seed icon-less default buttons just by toggling board chrome —
        // kid app falls back to its built-in ACTIVITIES tray when iconUrl is missing.
        onSceneLayout({
            ...sceneLayout,
            [device]: { ...sceneLayout[device], showActivitiesBoard: show },
        });
    };

    const seedDefaultsIfEmpty = () => {
        if (
            sceneLayout.phone.buttons.length === 0 &&
            sceneLayout.tablet.buttons.length === 0
        ) {
            onSceneLayout(layoutWithDefaults);
        }
    };

    /** Place a tap-to-talk bubble on both phone + tablet (drag to fine-tune). */
    const addDialogueButton = () => {
        const existing =
            layoutWithDefaults.phone.buttons.some((b) => isDialogueButtonId(b.id)) ||
            layoutWithDefaults.tablet.buttons.some((b) => isDialogueButtonId(b.id));
        const id = existing ? newId('dialogue') : 'dialogue';
        const phoneBtn = defaultDialogueButton(id);
        const tabletBtn = defaultDialogueButtonTablet(id);
        onSceneLayout({
            phone: {
                ...layoutWithDefaults.phone,
                buttons: layoutWithDefaults.phone.buttons.some((b) => b.id === id)
                    ? layoutWithDefaults.phone.buttons
                    : [...layoutWithDefaults.phone.buttons, phoneBtn],
            },
            tablet: {
                ...layoutWithDefaults.tablet,
                buttons: layoutWithDefaults.tablet.buttons.some((b) => b.id === id)
                    ? layoutWithDefaults.tablet.buttons
                    : [...layoutWithDefaults.tablet.buttons, tabletBtn],
            },
        });
        setDevice('phone');
        setSelectedId(id);
        setPreviewMode('scene');
    };

    const selectedButton = selectedId
        ? deviceLayout.buttons.find((b) => b.id === selectedId)
        : undefined;
    const selectedIsDialogue = selectedButton
        ? isDialogueButtonId(selectedButton.id)
        : false;

    const openIconPicker = (buttonId: string) => {
        setSelectedId(buttonId);
        setIconUploadTargetId(buttonId);
        setTimeout(() => btnIconRef.current?.click(), 0);
    };

    const handleButtonIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const buttonId = iconUploadTargetId || selectedId;
        if (!file || !buttonId) return;
        setUploadingBtnIcon(true);
        try {
            const url = await onUploadButtonIcon(file);
            if (isDialogueButtonId(buttonId)) {
                patchButtonBothDevices(buttonId, { iconUrl: url });
            } else {
                setDeviceButtons(
                    deviceLayout.buttons.map((b) =>
                        b.id === buttonId ? { ...b, iconUrl: url } : b,
                    ),
                );
            }
        } catch (err) {
            console.error(err);
            alert('Failed to upload button icon');
        } finally {
            setUploadingBtnIcon(false);
            setIconUploadTargetId(null);
        }
    };

    const handleDialogueVideoUpload = async (
        buttonId: string,
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingBtnVideoId(buttonId);
        try {
            const url = await onUploadVideo(file, 'scene-anim');
            const btn =
                dialogueButtons.find((b) => b.id === buttonId) ||
                deviceLayout.buttons.find((b) => b.id === buttonId);
            const label = btn?.label || 'Tap to talk';
            const { animations, triggers } = upsertButtonStayVideo(
                buttonId,
                url,
                label,
                sceneAnimations,
                sceneTriggers,
            );
            onSceneAnimations(animations);
            onSceneTriggers(triggers);
            setSelectedId(buttonId);
        } catch (err) {
            console.error(err);
            const apiMsg =
                (err as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ||
                (err as { message?: string })?.message ||
                'Unknown error';
            alert(`Failed to upload tap-to-talk video: ${apiMsg}`);
        } finally {
            setUploadingBtnVideoId(null);
        }
    };

    const handleClearDialogueVideo = (buttonId: string) => {
        const { animations, triggers } = clearButtonVideo(
            buttonId,
            sceneAnimations,
            sceneTriggers,
        );
        onSceneAnimations(animations);
        onSceneTriggers(triggers);
    };

    const handleIntroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingIntro(true);
        try {
            const url = await onUploadVideo(file, 'intro');
            onIntroVideoUrl(url);
            setPreviewMode('intro');
        } catch (err) {
            console.error(err);
            alert('Failed to upload intro video');
        } finally {
            setUploadingIntro(false);
        }
    };

    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingBg(true);
        try {
            const url = await onUploadVideo(file, 'scene-bg');
            onSceneBgVideoUrl(url);
            setPreviewMode('scene');
        } catch (err) {
            console.error(err);
            alert('Failed to upload scene background video');
        } finally {
            setUploadingBg(false);
        }
    };

    const handleMusicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setUploadingMusic(true);
        try {
            const url = await onUploadMusic(file);
            onSceneMusicUrl(url);
        } catch (err) {
            console.error(err);
            alert('Failed to upload scene music');
        } finally {
            setUploadingMusic(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                    <Clapperboard className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-medium">Scene Studio</p>
                        <p className="text-emerald-800/90 text-xs mt-1">
                            Upload intro, looping garden BG, and scene music. Add a tap-to-talk
                            button, upload its video, and place it on the phone/tablet preview.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene title
                        </label>
                        <input
                            value={sceneTitle}
                            onChange={(e) => onSceneTitle(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium"
                            placeholder="e.g. 1. THE BEGINNING"
                        />
                        <p className="text-xs text-gray-500">
                            Shown in the wood header on the kid app island scene. Same as Display
                            title on Overview.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Intro animation video
                        </label>
                        <input
                            value={introVideoUrl}
                            onChange={(e) => onIntroVideoUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload"
                        />
                        <input
                            ref={introRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleIntroUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingIntro}
                            onClick={() => introRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingIntro
                                ? 'Uploading…'
                                : introVideoUrl
                                  ? 'Replace intro'
                                  : 'Upload intro'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene background (loop) video
                        </label>
                        <input
                            value={sceneBgVideoUrl}
                            onChange={(e) => onSceneBgVideoUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload"
                        />
                        <input
                            ref={bgRef}
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={handleBgUpload}
                        />
                        <button
                            type="button"
                            disabled={uploadingBg}
                            onClick={() => bgRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4" />
                            {uploadingBg
                                ? 'Uploading…'
                                : sceneBgVideoUrl
                                  ? 'Replace BG'
                                  : 'Upload BG'}
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Scene background music
                        </label>
                        <input
                            value={sceneMusicUrl}
                            onChange={(e) => onSceneMusicUrl(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="https://… or upload MP3"
                        />
                        <input
                            ref={musicRef}
                            type="file"
                            accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg"
                            className="hidden"
                            onChange={handleMusicUpload}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={uploadingMusic}
                                onClick={() => musicRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Music className="w-4 h-4" />
                                {uploadingMusic
                                    ? 'Uploading…'
                                    : sceneMusicUrl
                                      ? 'Replace music'
                                      : 'Upload music'}
                            </button>
                            {sceneMusicUrl ? (
                                <>
                                    <audio
                                        key={sceneMusicUrl}
                                        src={getMediaUrl(sceneMusicUrl)}
                                        controls
                                        className="h-9 max-w-[220px]"
                                        preload="metadata"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onSceneMusicUrl('')}
                                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                                        title="Clear scene music"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Clear
                                    </button>
                                </>
                            ) : null}
                        </div>
                        <p className="text-xs text-gray-500">
                            Loops on the kid app scene after the intro (separate from book reader
                            music).
                        </p>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                            type="checkbox"
                            checked={deviceLayout.showActivitiesBoard}
                            onChange={(e) => setShowBoard(e.target.checked)}
                            className="rounded border-gray-300"
                        />
                        Show ACTIVITIES board chrome in preview
                    </label>

                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Add a button, upload its video, place it on the preview. On tap the kid app
                        plays the video, fades to white, then returns to the scene.
                    </p>

                    <button
                        type="button"
                        onClick={addDialogueButton}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100"
                    >
                        <img
                            src="/assets/images/dialogue-tap-to-talk.png"
                            alt=""
                            className="w-7 h-7 object-contain"
                        />
                        Add tap-to-talk button
                    </button>

                    <input
                        ref={btnIconRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleButtonIconUpload}
                    />

                    {/* One card per tap-to-talk: icon + video (auto-wires under the hood). */}
                    <div className="space-y-3">
                        {dialogueButtons.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-4 text-xs text-amber-900/80">
                                No tap-to-talk buttons yet. Click “Add tap-to-talk button” to place
                                a bubble on phone and tablet.
                            </div>
                        ) : (
                            dialogueButtons.map((btn) => {
                                const videoUrl = getButtonVideoUrl(
                                    btn.id,
                                    sceneAnimations,
                                    sceneTriggers,
                                );
                                const isSelected = selectedId === btn.id;
                                const uploadingVideo = uploadingBtnVideoId === btn.id;
                                const hasCustomIcon =
                                    !!btn.iconUrl &&
                                    btn.iconUrl !== DIALOGUE_TAP_TO_TALK_ICON;
                                return (
                                    <div
                                        key={btn.id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setSelectedId(btn.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setSelectedId(btn.id);
                                            }
                                        }}
                                        className={`rounded-lg border p-3 space-y-3 bg-white cursor-pointer transition-colors ${
                                            isSelected
                                                ? 'border-amber-400 ring-2 ring-amber-200'
                                                : 'border-gray-200 hover:border-amber-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-medium text-gray-800">
                                                {btn.label || 'TAP TO TALK'}
                                            </p>
                                            <span className="text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                                Tap to talk
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-gray-600">
                                                Button icon
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <img
                                                    src={getMediaUrl(
                                                        btn.iconUrl || DIALOGUE_TAP_TO_TALK_ICON,
                                                    )}
                                                    alt=""
                                                    className="w-12 h-12 object-contain rounded border border-gray-100 bg-gray-50"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={
                                                        uploadingBtnIcon &&
                                                        iconUploadTargetId === btn.id
                                                    }
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openIconPicker(btn.id);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                                                >
                                                    <Upload className="w-3.5 h-3.5" />
                                                    {uploadingBtnIcon &&
                                                    iconUploadTargetId === btn.id
                                                        ? 'Uploading…'
                                                        : 'Upload button icon'}
                                                </button>
                                                {hasCustomIcon ? (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            patchButtonBothDevices(btn.id, {
                                                                iconUrl: DIALOGUE_TAP_TO_TALK_ICON,
                                                            });
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        Clear icon
                                                    </button>
                                                ) : null}
                                            </div>
                                            <p className="text-[11px] text-gray-400">
                                                Default is the dialogue bubble. Drag the button on
                                                the preview to place it.
                                            </p>
                                        </div>

                                        <div className="space-y-2 border-t border-gray-100 pt-3">
                                            <p className="text-xs font-medium text-gray-600">
                                                Tap video
                                            </p>
                                            <input
                                                ref={(el) => {
                                                    btnVideoRefs.current[btn.id] = el;
                                                }}
                                                type="file"
                                                accept="video/*"
                                                className="hidden"
                                                onChange={(e) =>
                                                    handleDialogueVideoUpload(btn.id, e)
                                                }
                                            />
                                            {videoUrl ? (
                                                <div className="space-y-2">
                                                    <video
                                                        src={getMediaUrl(videoUrl)}
                                                        className="w-full h-28 object-cover rounded bg-black"
                                                        muted
                                                        playsInline
                                                        controls
                                                    />
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={uploadingVideo}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                btnVideoRefs.current[
                                                                    btn.id
                                                                ]?.click();
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-xs hover:bg-gray-50 disabled:opacity-50"
                                                        >
                                                            <Film className="w-3.5 h-3.5" />
                                                            {uploadingVideo
                                                                ? 'Uploading…'
                                                                : 'Replace video'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleClearDialogueVideo(btn.id);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                            Clear video
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={uploadingVideo}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        btnVideoRefs.current[btn.id]?.click();
                                                    }}
                                                    className="w-full h-24 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 text-xs text-amber-900 inline-flex flex-col items-center justify-center gap-1 hover:bg-amber-50 disabled:opacity-50"
                                                >
                                                    <Film className="w-4 h-4" />
                                                    {uploadingVideo
                                                        ? 'Uploading…'
                                                        : 'Upload video'}
                                                    <span className="text-[10px] text-amber-800/70">
                                                        Plays on tap, then returns to the scene
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Activity (non-dialogue) button icon when selected in preview */}
                    {selectedButton && !selectedIsDialogue ? (
                        <div className="rounded-lg border border-gray-200 p-3 space-y-2 bg-white">
                            <p className="text-sm font-medium text-gray-800">
                                Selected activity button icon
                            </p>
                            <p className="text-xs text-gray-500">
                                {selectedButton.label || selectedButton.id}
                            </p>
                            {selectedButton.iconUrl ? (
                                <div className="flex items-center gap-2">
                                    <img
                                        src={getMediaUrl(selectedButton.iconUrl)}
                                        alt=""
                                        className="w-12 h-12 object-contain rounded border border-gray-100 bg-gray-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDeviceButtons(
                                                deviceLayout.buttons.map((b) =>
                                                    b.id === selectedButton.id
                                                        ? { ...b, iconUrl: undefined }
                                                        : b,
                                                ),
                                            )
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                        Clear icon
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-gray-400">No custom icon yet</p>
                            )}
                            <button
                                type="button"
                                disabled={uploadingBtnIcon}
                                onClick={() => openIconPicker(selectedButton.id)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingBtnIcon ? 'Uploading…' : 'Upload button icon'}
                            </button>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={seedDefaultsIfEmpty}
                        className="text-xs text-indigo-600 hover:underline"
                    >
                        Reset / seed default button positions for empty layouts
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">Device preview</h3>
                        <div className="flex gap-2">
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                {(['phone', 'tablet'] as SceneDevice[]).map((d) => (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                            setDevice(d);
                                            setSelectedId(null);
                                        }}
                                        className={`px-2.5 py-1.5 capitalize ${
                                            device === d
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-600 hover:bg-gray-50'
                                        } ${d === 'tablet' ? 'border-l border-gray-200' : ''}`}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('scene')}
                                    className={`px-2.5 py-1.5 ${
                                        previewMode === 'scene'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Loop BG
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewMode('intro')}
                                    className={`px-2.5 py-1.5 border-l border-gray-200 ${
                                        previewMode === 'intro'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    Intro
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Drag buttons to position · select + corner handle to resize · positions
                        saved as % of frame.
                    </p>
                    <DevicePreview
                        device={device}
                        mode={previewMode}
                        videoUrl={previewUrl}
                        sceneTitle={sceneTitle}
                    >
                        <OverlayCanvas
                            buttons={deviceLayout.buttons}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onChangeButtons={setDeviceButtons}
                            showActivitiesBoard={deviceLayout.showActivitiesBoard}
                        />
                    </DevicePreview>
                </div>
            </div>

            {/* Advanced: keep Trigger board for activity wires / legacy packs — collapsed by default. */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/60">
                <button
                    type="button"
                    onClick={() => setShowAdvancedWires((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
                >
                    <div>
                        <p className="text-sm font-medium text-gray-800">
                            Advanced: activity wires
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Optional — wire READ / QUIZ / etc. to clips. Tap-to-talk videos are
                            managed on the cards above.
                        </p>
                    </div>
                    <ChevronDown
                        className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${
                            showAdvancedWires ? 'rotate-180' : ''
                        }`}
                    />
                </button>
                {showAdvancedWires ? (
                    <div className="px-4 pb-4">
                        <TriggerBoard
                            buttons={deviceLayout.buttons}
                            animations={sceneAnimations}
                            triggers={sceneTriggers}
                            onChangeAnimations={onSceneAnimations}
                            onChangeTriggers={onSceneTriggers}
                            onUploadAnimationVideo={(file) =>
                                onUploadVideo(file, 'scene-anim')
                            }
                        />
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default SceneStudio;
