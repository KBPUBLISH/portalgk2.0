#!/usr/bin/env node
/**
 * Verifies the character-model GLB optimization pipeline against a sample
 * file, using the exact same transforms as src/utils/glbOptimizer.ts:
 *
 *   dedup → prune → weld → resample → textureCompress (webp, max 1024px)
 *   → Draco mesh compression
 *
 * Reports input/output sizes and proves animation clips survive with their
 * names intact (the app looks clips up by name).
 *
 * Usage:
 *   node scripts/verify-glb-pipeline.mjs <input.glb> [output.glb]
 *
 * Texture compression requires `sharp` in Node (the browser uses the canvas
 * instead). Resolution order: local `sharp` install, then the directory in
 * env SHARP_MODULE (e.g. SHARP_MODULE=../backend/node_modules/sharp).
 * Without sharp the texture step is skipped and noted in the report.
 */
import { NodeIO } from '@gltf-transform/core';
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
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const [inputPath, outputPathArg] = process.argv.slice(2);
if (!inputPath) {
    console.error('Usage: node scripts/verify-glb-pipeline.mjs <input.glb> [output.glb]');
    process.exit(1);
}
const outputPath =
    outputPathArg || path.join(os.tmpdir(), `glb-verify-${Date.now()}.glb`);

// --- optional sharp (texture step) ---
let sharp = null;
try {
    sharp = (await import('sharp')).default;
} catch {
    if (process.env.SHARP_MODULE) {
        try {
            sharp = createRequire(import.meta.url)(process.env.SHARP_MODULE);
        } catch (err) {
            console.warn(`Could not load sharp from SHARP_MODULE: ${err.message}`);
        }
    }
}

const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
        'draco3d.encoder': await draco3d.createEncoderModule(),
        'draco3d.decoder': await draco3d.createDecoderModule(),
    });

const inputBytes = fs.readFileSync(inputPath);
const document = await io.readBinary(new Uint8Array(inputBytes));

const describeAnimations = (doc) =>
    doc.getRoot().listAnimations().map((anim) => ({
        name: anim.getName(),
        channels: anim.listChannels().length,
        samplers: anim.listSamplers().length,
    }));

const inputAnims = describeAnimations(document);
console.log(`Input:  ${inputPath}`);
console.log(`        ${mb(inputBytes.length)}, ${inputAnims.length} animation clip(s):`);
for (const a of inputAnims) {
    console.log(`          - "${a.name}" (${a.channels} channels, ${a.samplers} samplers)`);
}

await document.transform(dedup(), prune(), weld(), resample());

let textureNote;
if (sharp) {
    await document.transform(
        textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
    );
    textureNote = 'textureCompress: webp @ max 1024px (sharp)';
} else {
    textureNote =
        'textureCompress: SKIPPED (sharp unavailable in Node — the browser build uses canvas-native webp instead)';
}
console.log(`\n${textureNote}`);

await document.transform(draco());
const outputBytes = await io.writeBinary(document);
fs.writeFileSync(outputPath, outputBytes);

// Re-parse the written output (through the Draco decoder) to prove clips survive.
const verifyDoc = await io.readBinary(new Uint8Array(fs.readFileSync(outputPath)));
const outputAnims = describeAnimations(verifyDoc);

console.log(`\nOutput: ${outputPath}`);
console.log(`        ${mb(outputBytes.length)}, ${outputAnims.length} animation clip(s):`);
for (const a of outputAnims) {
    console.log(`          - "${a.name}" (${a.channels} channels, ${a.samplers} samplers)`);
}
console.log(
    `\nCompression: ${mb(inputBytes.length)} → ${mb(outputBytes.length)} ` +
        `(${((1 - outputBytes.length / inputBytes.length) * 100).toFixed(1)}% smaller)`,
);

const inputNames = inputAnims.map((a) => a.name);
const outputNames = outputAnims.map((a) => a.name);
const missing = inputNames.filter((n) => !outputNames.includes(n));
if (missing.length > 0 || outputAnims.length !== inputAnims.length) {
    console.error(`\nFAIL: animation clips lost or renamed (missing: ${missing.join(', ') || 'none, but count differs'})`);
    process.exit(1);
}
console.log(`\nPASS: all ${inputAnims.length} animation clips survived with names intact.`);
