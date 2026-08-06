/**
 * Browser-side GLB optimizer for character reward models.
 *
 * Raw Meshy AI exports arrive at 15–40 MB (uncompressed PNG textures + dense
 * animation tracks). This module shrinks them before upload with the same
 * pipeline we previously ran manually via gltf-transform CLI
 * (18.66 MB → 1.27 MB on the reference model):
 *
 *   dedup → prune → weld → resample (animation) → textureCompress (webp,
 *   max 1024px, canvas-native) → Draco mesh compression (draco3d wasm).
 *
 * The app's three.js loader has DRACOLoader wired, so Draco output is what it
 * expects. Animation clips (walk/idle/dance, referenced by name in-app) must
 * survive — we re-parse the compressed output and verify every input clip
 * name is still present, throwing otherwise so the caller can fall back to
 * uploading the original file.
 *
 * This module is heavy (~1 MB of wasm/js) — only load it via dynamic
 * `import()` once a .glb has actually been selected.
 */
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
    dedup,
    draco,
    prune,
    resample,
    textureCompress,
    weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3d';
// Vite serves the raw wasm binaries as static assets; we fetch them ourselves
// and hand them to Emscripten via `wasmBinary` so no path resolution is needed.
import dracoEncoderWasmUrl from 'draco3d/draco_encoder.wasm?url';
import dracoDecoderWasmUrl from 'draco3d/draco_decoder.wasm?url';

export interface OptimizeGlbResult {
    /** File to upload (optimized, or the original if it was already smaller). */
    file: File;
    originalSize: number;
    optimizedSize: number;
    /** Animation clip names present in the input document. */
    inputAnimations: string[];
    /** Animation clip names verified in the re-parsed optimized output. */
    outputAnimations: string[];
    /** True when optimization produced no savings and the original is kept. */
    keptOriginal: boolean;
}

export type OptimizeProgress = (message: string) => void;

const fetchWasm = async (url: string): Promise<ArrayBuffer> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch Draco wasm (${res.status})`);
    return res.arrayBuffer();
};

/** Uint8Array → plain ArrayBuffer copy (satisfies BlobPart typing exactly). */
const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
    const buf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buf).set(bytes);
    return buf;
};

let ioPromise: Promise<WebIO> | null = null;

/** Lazily build a WebIO with Draco encoder+decoder wasm registered (cached). */
const getIO = (): Promise<WebIO> => {
    if (!ioPromise) {
        ioPromise = (async () => {
            const [encoderWasm, decoderWasm] = await Promise.all([
                fetchWasm(dracoEncoderWasmUrl),
                fetchWasm(dracoDecoderWasmUrl),
            ]);
            const [encoderModule, decoderModule] = await Promise.all([
                draco3d.createEncoderModule({ wasmBinary: encoderWasm }),
                draco3d.createDecoderModule({ wasmBinary: decoderWasm }),
            ]);
            return new WebIO()
                .registerExtensions(ALL_EXTENSIONS)
                .registerDependencies({
                    'draco3d.encoder': encoderModule,
                    'draco3d.decoder': decoderModule,
                });
        })();
        // Allow a retry on the next call if wasm setup failed (e.g. offline).
        ioPromise.catch(() => {
            ioPromise = null;
        });
    }
    return ioPromise;
};

/**
 * Optimize a .glb file in the browser. Throws if anything goes wrong or if
 * animation clips would be lost — callers should catch and upload the
 * original file instead.
 */
export async function optimizeGlb(
    file: File,
    onProgress?: OptimizeProgress,
): Promise<OptimizeGlbResult> {
    onProgress?.('Preparing optimizer…');
    const io = await getIO();

    onProgress?.('Reading model…');
    const inputBytes = new Uint8Array(await file.arrayBuffer());
    const document = await io.readBinary(inputBytes);
    const inputAnimations = document
        .getRoot()
        .listAnimations()
        .map((anim) => anim.getName());

    onProgress?.('Optimizing meshes & animations…');
    await document.transform(dedup(), prune(), weld(), resample());

    // Texture compression: webp at max 1024px via the browser's canvas
    // encoder. Some engines (older Safari) can't encode webp — fall back to
    // resized png so we still get the resolution savings.
    onProgress?.('Compressing textures…');
    try {
        await document.transform(
            textureCompress({ targetFormat: 'webp', resize: [1024, 1024] }),
        );
    } catch (err) {
        console.warn('WebP texture compression failed, falling back to PNG:', err);
        await document.transform(
            textureCompress({ targetFormat: 'png', resize: [1024, 1024] }),
        );
    }

    onProgress?.('Applying Draco compression…');
    await document.transform(draco());
    const outputBytes = await io.writeBinary(document);

    // Sanity check: re-parse the output and make sure every animation clip
    // survived with its name intact (the app looks clips up by name).
    onProgress?.('Verifying animations…');
    const verifyDocument = await io.readBinary(outputBytes);
    const outputAnimations = verifyDocument
        .getRoot()
        .listAnimations()
        .map((anim) => anim.getName());
    if (inputAnimations.length > 0) {
        const missing = inputAnimations.filter(
            (name) => !outputAnimations.includes(name),
        );
        if (outputAnimations.length === 0 || missing.length > 0) {
            throw new Error(
                `Animation clips lost during optimization (missing: ${
                    missing.join(', ') || 'all'
                })`,
            );
        }
    }

    if (outputBytes.byteLength >= file.size) {
        // Already optimized (e.g. re-upload of a previously compressed model).
        return {
            file,
            originalSize: file.size,
            optimizedSize: file.size,
            inputAnimations,
            outputAnimations,
            keptOriginal: true,
        };
    }

    const optimizedFile = new File([toArrayBuffer(outputBytes)], file.name, {
        type: 'model/gltf-binary',
    });
    return {
        file: optimizedFile,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        inputAnimations,
        outputAnimations,
        keptOriginal: false,
    };
}
