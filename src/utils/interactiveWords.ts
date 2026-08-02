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

/** Max tap-to-reveal blanks per age band (older = more missing words). */
export const READING_LEVEL_MAX_BLANKS = {
    ages_3_5: 2,
    ages_6_7: 4,
    ages_8_plus: 6,
} as const;

export type ReadingLevelBlankKey = keyof typeof READING_LEVEL_MAX_BLANKS;

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
 * Keep / fill tap blanks with meaningful story words.
 * Explicit empty preferred [] means "no blanks".
 * Otherwise keep good preferred picks and top up (spread) until maxCount.
 * Matches backend bible-map generation.
 */
export function pickImportantInteractiveWordIndices(
    text: string,
    preferred: number[] | undefined | null,
    maxCount = 4,
): number[] {
    const words = splitInteractiveWords(text);
    if (!words.length || maxCount <= 0) return [];
    if (Array.isArray(preferred) && preferred.length === 0) return [];

    const candidates: number[] = [];
    for (let i = 0; i < words.length; i++) {
        if (!isImportantInteractiveWord(words[i])) continue;
        candidates.push(i);
    }
    if (!candidates.length) return [];

    const target = Math.min(maxCount, candidates.length);
    const preferredGood = sanitizeInteractiveWordIndices(text, preferred);
    const out: number[] = [];
    const seen = new Set<number>();
    for (const i of preferredGood) {
        if (out.length >= target) break;
        out.push(i);
        seen.add(i);
    }

    if (out.length < target) {
        const need = target - out.length;
        const pool = candidates.filter((i) => !seen.has(i));
        for (let s = 0; s < need && pool.length; s++) {
            const pick = Math.round((s * (pool.length - 1)) / Math.max(need - 1, 1));
            const i = pool[Math.min(pick, pool.length - 1)];
            if (seen.has(i)) continue;
            seen.add(i);
            out.push(i);
        }
        for (const i of pool) {
            if (out.length >= target) break;
            if (seen.has(i)) continue;
            out.push(i);
        }
    }
    return out.sort((a, b) => a - b);
}

export function maxInteractiveBlanksForLevel(level: ReadingLevelBlankKey): number {
    return READING_LEVEL_MAX_BLANKS[level];
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

/**
 * Precomputed slot lattice in unit space [0,1]×[0,1].
 * Corners/edges first so small chip counts can spread wide; mid slots fill denser hunts.
 */
const PUZZLE_SLOT_UNITS: Array<{ u: number; v: number }> = [
    { u: 0.1, v: 0.12 },
    { u: 0.9, v: 0.12 },
    { u: 0.5, v: 0.18 },
    { u: 0.18, v: 0.42 },
    { u: 0.82, v: 0.4 },
    { u: 0.5, v: 0.55 },
    { u: 0.12, v: 0.72 },
    { u: 0.88, v: 0.72 },
    { u: 0.35, v: 0.3 },
    { u: 0.65, v: 0.32 },
    { u: 0.28, v: 0.62 },
    { u: 0.72, v: 0.6 },
];

function slotDistSq(
    a: { u: number; v: number },
    b: { u: number; v: number },
): number {
    const du = a.u - b.u;
    const dv = a.v - b.v;
    return du * du + dv * dv;
}

/**
 * Pick `count` lattice indices that stay far apart (farthest-point sampling).
 * Seed picks the first slot so layouts vary by page without clustering.
 */
function pickSpreadSlotIndices(pageSeed: string | number, count: number): number[] {
    const n = Math.min(Math.max(count, 1), PUZZLE_SLOT_UNITS.length);
    const available = PUZZLE_SLOT_UNITS.map((_, i) => i);
    const first =
        hashInteractiveSeed(`${pageSeed}:spread:0`) % available.length;
    const selected: number[] = [available[first]];
    available.splice(first, 1);

    while (selected.length < n && available.length > 0) {
        let bestIdx = 0;
        let bestScore = -1;
        for (let i = 0; i < available.length; i++) {
            const candidate = PUZZLE_SLOT_UNITS[available[i]];
            let minD = Infinity;
            for (const s of selected) {
                minD = Math.min(minD, slotDistSq(candidate, PUZZLE_SLOT_UNITS[s]));
            }
            // Tiny seed tie-break so equal distances stay deterministic
            const tie =
                (hashInteractiveSeed(`${pageSeed}:spread:${available[i]}`) % 1000) * 1e-9;
            if (minD + tie > bestScore) {
                bestScore = minD + tie;
                bestIdx = i;
            }
        }
        selected.push(available[bestIdx]);
        available.splice(bestIdx, 1);
    }
    return selected;
}

/**
 * Deterministic % position for a hunt chip over the page art.
 * Slots stay above the parchment band and away from extreme edges.
 * Pass `chipCount` (remaining chips) so nearby chips prefer maximally distant lattice points.
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

    const spread = pickSpreadSlotIndices(pageSeed, slotCount);
    const slotIdx = spread[chipIndex % spread.length];
    const unit = PUZZLE_SLOT_UNITS[slotIdx];
    // Light jitter only — keep small counts from drifting back into clumps
    const jitterScale = chipCount <= 4 ? 0.15 : 0.35;
    const jitter = hashInteractiveSeed(`${pageSeed}::${chipKey}`);
    const jx = ((jitter % 17) - 8) * jitterScale;
    const jy = (((jitter >> 8) % 17) - 8) * jitterScale;
    const leftPct = leftMin + unit.u * (leftMax - leftMin) + jx;
    const topPct = topMin + unit.v * (topMax - topMin) + jy;
    return {
        leftPct: Math.min(Math.max(leftPct, leftMin), leftMax),
        topPct: Math.min(Math.max(topPct, topMin), topMax),
    };
}

/**
 * Adaptive Bible Map parchment band (% of viewport height).
 * Short pages keep the scroll low so more of the illustration shows.
 */
export function bibleMapScrollBandPct(wordCount: number): { mid: number; max: number } {
    const n = Math.max(0, Math.floor(Number(wordCount) || 0));
    if (n <= 12) return { mid: 24, max: 28 };
    if (n <= 24) return { mid: 30, max: 34 };
    return { mid: 36, max: 40 };
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
