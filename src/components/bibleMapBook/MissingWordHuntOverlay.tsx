import React, { useState } from 'react';
import { puzzleChipPosition } from '../../utils/interactiveWords';

export type MissingWordHuntChip = {
    /** Stable id used for found / next matching */
    id: string;
    /** Visible answer text on the chip */
    label: string;
};

export type MissingWordHuntOverlayProps = {
    pageSeed: string | number;
    chips: MissingWordHuntChip[];
    foundIds: ReadonlySet<string>;
    /** Id of the blank that must be found next (null when done) */
    nextId: string | null;
    onCorrect: (id: string) => void;
    /**
     * `image` — scatter chips over the art container (percentage positions).
     * `scroll-top` — row of chips along the top of the scroll when there is no art.
     */
    placement?: 'image' | 'scroll-top';
    /** Bounds for image placement (% of overlay container) */
    areaTopMin?: number;
    areaTopMax?: number;
    areaLeftMin?: number;
    areaLeftMax?: number;
    className?: string;
    compact?: boolean;
};

/**
 * Playful word-hunt chips for Bible Map missing words.
 * Kids find and tap answers in blank order; wrong taps get a light shake.
 */
const MissingWordHuntOverlay: React.FC<MissingWordHuntOverlayProps> = ({
    pageSeed,
    chips,
    foundIds,
    nextId,
    onCorrect,
    placement = 'image',
    areaTopMin = 10,
    areaTopMax = 52,
    areaLeftMin = 6,
    areaLeftMax = 86,
    className = '',
    compact = false,
}) => {
    const [shakingId, setShakingId] = useState<string | null>(null);
    const remaining = chips.filter((c) => !foundIds.has(c.id));
    if (!remaining.length || nextId == null) return null;

    const handleSelect = (id: string) => {
        if (foundIds.has(id)) return;
        if (id === nextId) {
            onCorrect(id);
            return;
        }
        setShakingId(id);
        window.setTimeout(() => {
            setShakingId((cur) => (cur === id ? null : cur));
        }, 420);
    };

    const chipClass = (id: string, shakeClass: string) => {
        const isNext = id === nextId;
        const shaking = shakingId === id;
        return [
            'pointer-events-auto select-none font-semibold tracking-wide',
            'rounded-lg border-2 shadow-md',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-1',
            compact ? 'px-1.5 py-0.5 text-[10px] leading-tight' : 'px-2.5 py-1 text-xs sm:text-sm',
            isNext
                ? 'border-amber-500/90 bg-[#f7ecd4] text-[#3d2e1f] shadow-amber-900/20'
                : 'border-[#8b6914]/70 bg-[#f3e6c8]/95 text-[#4a3b2a]',
            shaking ? shakeClass : 'hover:scale-105 active:scale-95 transition-transform',
        ].join(' ');
    };

    if (placement === 'scroll-top') {
        return (
            <div
                className={`pointer-events-none absolute left-0 right-0 z-[25] flex flex-wrap justify-center gap-1.5 px-2 pt-1 ${className}`}
                style={{ top: 0 }}
                role="group"
                aria-label="Find the missing words in order"
            >
                {remaining.map((chip) => (
                    <button
                        key={chip.id}
                        type="button"
                        className={chipClass(chip.id, 'missing-word-hunt-shake-row')}
                        aria-label={`Puzzle word ${chip.label}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(chip.id);
                        }}
                    >
                        {chip.label}
                    </button>
                ))}
                <style>{SHAKE_STYLE}</style>
            </div>
        );
    }

    return (
        <div
            className={`pointer-events-none absolute inset-0 z-[25] ${className}`}
            role="group"
            aria-label="Find the missing words on the picture"
        >
            {remaining.map((chip) => {
                const chipIndex = Math.max(
                    0,
                    chips.findIndex((c) => c.id === chip.id),
                );
                const pos = puzzleChipPosition(pageSeed, chip.id, {
                    topMin: areaTopMin,
                    topMax: areaTopMax,
                    leftMin: areaLeftMin,
                    leftMax: areaLeftMax,
                    chipIndex,
                    chipCount: chips.length,
                });
                return (
                    <div
                        key={chip.id}
                        className="absolute"
                        style={{
                            left: `${pos.leftPct}%`,
                            top: `${pos.topPct}%`,
                            transform: 'translate(-50%, -50%)',
                            maxWidth: '42%',
                        }}
                    >
                        <button
                            type="button"
                            className={chipClass(chip.id, 'missing-word-hunt-shake-row')}
                            aria-label={`Puzzle word ${chip.label}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelect(chip.id);
                            }}
                        >
                            <span className="block truncate">{chip.label}</span>
                        </button>
                    </div>
                );
            })}
            <style>{SHAKE_STYLE}</style>
        </div>
    );
};

const SHAKE_STYLE = `
@keyframes missing-word-hunt-shake-row-kf {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px) rotate(-2deg); }
  40% { transform: translateX(4px) rotate(2deg); }
  60% { transform: translateX(-3px) rotate(-1deg); }
  80% { transform: translateX(3px) rotate(1deg); }
}
.missing-word-hunt-shake-row {
  animation: missing-word-hunt-shake-row-kf 0.4s ease-in-out;
  border-color: #b45309 !important;
  background-color: #fde68a !important;
}
`;

export default MissingWordHuntOverlay;
