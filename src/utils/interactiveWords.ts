/** Split story text into tappable word tokens (whitespace-separated). */
export function splitInteractiveWords(text: string): string[] {
    if (!text?.trim()) return [];
    return text.trim().split(/\s+/).filter((w) => w.length > 0);
}

/** Never use these as tap-to-reveal blanks — prefer story content words. */
const INTERACTIVE_STOP_WORDS = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'if',
    'then',
    'than',
    'so',
    'as',
    'at',
    'by',
    'for',
    'from',
    'in',
    'into',
    'of',
    'on',
    'onto',
    'to',
    'too',
    'with',
    'without',
    'over',
    'under',
    'about',
    'after',
    'before',
    'between',
    'through',
    'during',
    'above',
    'below',
    'up',
    'down',
    'out',
    'off',
    'again',
    'further',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'every',
    'both',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'any',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'just',
    'also',
    'very',
    'can',
    'will',
    'shall',
    'may',
    'might',
    'must',
    'should',
    'would',
    'could',
    'do',
    'does',
    'did',
    'doing',
    'done',
    'be',
    'am',
    'is',
    'are',
    'was',
    'were',
    'been',
    'being',
    'have',
    'has',
    'had',
    'having',
    'i',
    'me',
    'my',
    'we',
    'our',
    'you',
    'your',
    'he',
    'him',
    'his',
    'she',
    'her',
    'it',
    'its',
    'they',
    'them',
    'their',
    'this',
    'that',
    'these',
    'those',
    'what',
    'which',
    'who',
    'whom',
    'whose',
    'yes',
    'oh',
    'ok',
    'okay',
    'well',
    'now',
    'still',
    'even',
    'back',
    'away',
    'said',
    'says',
    'say',
    'like',
    'let',
    'lets',
    'got',
    'get',
    'gets',
    'went',
    'come',
    'came',
    'go',
    'goes',
    'going',
]);

function coreInteractiveWord(token: string): string {
    return token.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, '');
}

/** True for names / nouns / vivid verbs — false for filler like "the", "and", "of". */
export function isImportantInteractiveWord(token: string): boolean {
    const w = coreInteractiveWord(token);
    if (!w || w.length < 3) return false;
    if (INTERACTIVE_STOP_WORDS.has(w)) return false;
    if (/^\d+$/.test(w)) return false;
    return true;
}

/** Keep only indices that still exist after text edits (and drop stop-word blanks). */
export function sanitizeInteractiveWordIndices(
    text: string,
    indices: number[] | undefined | null,
): number[] {
    if (!indices?.length) return [];
    const words = splitInteractiveWords(text);
    const unique = new Set<number>();
    for (const i of indices) {
        if (!Number.isInteger(i) || i < 0 || i >= words.length) continue;
        if (!isImportantInteractiveWord(words[i])) continue;
        unique.add(i);
    }
    return Array.from(unique).sort((a, b) => a - b);
}

/**
 * Toggle a blank index. When `text` is provided, refuse to add filler/stop words
 * (unmarking is always allowed).
 */
export function toggleInteractiveWordIndex(
    indices: number[] | undefined | null,
    wordIndex: number,
    text?: string,
): number[] {
    const current = indices ? [...indices] : [];
    const pos = current.indexOf(wordIndex);
    if (pos >= 0) {
        current.splice(pos, 1);
        return current.sort((a, b) => a - b);
    }
    if (text !== undefined) {
        const words = splitInteractiveWords(text);
        if (!isImportantInteractiveWord(words[wordIndex] || '')) {
            return current.sort((a, b) => a - b);
        }
    }
    current.push(wordIndex);
    return current.sort((a, b) => a - b);
}

export function collectPageInteractiveTargets(
    textBoxes: Array<{ text?: string; interactiveWordIndices?: number[] }> | undefined | null,
): Array<{ boxIndex: number; wordIndex: number }> {
    if (!textBoxes?.length) return [];
    const targets: Array<{ boxIndex: number; wordIndex: number }> = [];
    textBoxes.forEach((box, boxIndex) => {
        const indices = sanitizeInteractiveWordIndices(box.text || '', box.interactiveWordIndices);
        indices.forEach((wordIndex) => targets.push({ boxIndex, wordIndex }));
    });
    return targets;
}

/** Stable key for a tap target across the whole book. */
export function interactiveTapKey(
    pageKey: string | number,
    boxIndex: number,
    wordIndex: number,
): string {
    return `${pageKey}:${boxIndex}:${wordIndex}`;
}

export function countInteractiveTargetsInTextBoxes(
    textBoxes: Array<{ text?: string; interactiveWordIndices?: number[] }> | undefined | null,
): number {
    return collectPageInteractiveTargets(textBoxes).length;
}

/** Visible blank slot length roughly matching the hidden word. */
export function blankSlotUnits(word: string): number {
    const letters = word.replace(/[^\p{L}\p{N}]/gu, '');
    return Math.min(Math.max(letters.length || word.length || 3, 3), 14);
}

/** Speakable form of a tap word (strip edge punctuation). */
export function wordForSpeech(word: string): string {
    const cleaned = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return cleaned || word;
}

/** FNV-1a style hash for stable puzzle layout seeds. */
export function hashInteractiveSeed(seed: string): number {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** Precomputed slot lattice in unit space [0,1]×[0,1] — scattered, not a rigid grid. */
const PUZZLE_SLOT_UNITS: Array<{ u: number; v: number }> = [
    { u: 0.12, v: 0.14 },
    { u: 0.48, v: 0.1 },
    { u: 0.82, v: 0.16 },
    { u: 0.22, v: 0.34 },
    { u: 0.58, v: 0.3 },
    { u: 0.78, v: 0.42 },
    { u: 0.1, v: 0.52 },
    { u: 0.38, v: 0.48 },
    { u: 0.68, v: 0.58 },
    { u: 0.9, v: 0.28 },
    { u: 0.3, v: 0.68 },
    { u: 0.52, v: 0.72 },
];

/**
 * Deterministic % position for a hunt chip over the page art.
 * Slots stay above the parchment band and away from extreme edges.
 * Pass `slotCount` (remaining chips) so nearby chips prefer distinct lattice points.
 */
export function puzzleChipPosition(
    pageSeed: string | number,
    chipKey: string | number,
    options?: {
        topMin?: number;
        topMax?: number;
        leftMin?: number;
        leftMax?: number;
        /** Prefer unique slots when several chips share a page */
        chipIndex?: number;
        chipCount?: number;
    },
): { leftPct: number; topPct: number } {
    const topMin = options?.topMin ?? 10;
    const topMax = options?.topMax ?? 52;
    const leftMin = options?.leftMin ?? 6;
    const leftMax = options?.leftMax ?? 88;
    const chipIndex = options?.chipIndex ?? 0;
    const chipCount = Math.max(options?.chipCount ?? 1, 1);
    const slotCount = Math.min(Math.max(chipCount, 1), PUZZLE_SLOT_UNITS.length);

    // Stable permutation of slots for this page
    const order = PUZZLE_SLOT_UNITS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
        const j = hashInteractiveSeed(`${pageSeed}:slot:${i}`) % (i + 1);
        const tmp = order[i];
        order[i] = order[j];
        order[j] = tmp;
    }
    const slotIdx = order[chipIndex % slotCount];
    const unit = PUZZLE_SLOT_UNITS[slotIdx];
    // Tiny per-chip jitter so identical pages with different words still feel varied
    const jitter = hashInteractiveSeed(`${pageSeed}::${chipKey}`);
    const jx = ((jitter % 17) - 8) * 0.35;
    const jy = (((jitter >> 8) % 17) - 8) * 0.35;
    const leftPct = leftMin + unit.u * (leftMax - leftMin) + jx;
    const topPct = topMin + unit.v * (topMax - topMin) + jy;
    return {
        leftPct: Math.min(Math.max(leftPct, leftMin), leftMax),
        topPct: Math.min(Math.max(topPct, topMin), topMax),
    };
}

/** Next blank in reading order that is not yet revealed. */
export function nextInteractiveTargetIndex(
    orderedIndices: number[],
    revealed: Set<number> | ReadonlySet<number>,
): number | null {
    for (const i of orderedIndices) {
        if (!revealed.has(i)) return i;
    }
    return null;
}

/** Short pleasant “ding” via Web Audio (no asset required). */
export function playInteractiveWordDing(): void {
    try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        osc.onended = () => {
            void ctx.close();
        };
    } catch {
        // Ignore audio failures in preview
    }
}
