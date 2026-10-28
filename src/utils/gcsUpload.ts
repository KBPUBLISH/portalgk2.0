import apiClient from '../services/apiClient';

/**
 * In local dev, PUT chunks through the Vite proxy (`/gcs-upload`).
 * The browser then stays on localhost, so the storage bucket CORS list
 * does not have to include every Vite port. Production still uploads
 * straight to the signed URL (portal.godlykids.com is allowed).
 */
export function gcsBrowserPutUrl(uploadUrl: string): string {
    if (!import.meta.env.DEV) return uploadUrl;
    try {
        const url = new URL(uploadUrl);
        if (url.hostname !== 'storage.googleapis.com') return uploadUrl;
        return `/gcs-upload${url.pathname}${url.search}`;
    } catch {
        return uploadUrl;
    }
}

async function putBlob(uploadUrl: string, blob: Blob, contentType: string): Promise<void> {
    const putRes = await fetch(gcsBrowserPutUrl(uploadUrl), {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
    });
    if (!putRes.ok) {
        throw new Error(`Storage upload failed (HTTP ${putRes.status})`);
    }
}

/** Types the live /api/upload/signed-url endpoint will sign. */
const LIVE_SIGNED_TYPES = new Set(['video', 'audio', 'cover']);

/**
 * Upload a file straight to storage. Posting the bytes through the API
 * drops the TLS connection (ERR_SSL_BAD_RECORD_MAC_ALERT).
 *
 * The live signer only accepts video, audio, and cover. Other files (a .glb
 * character model) are signed as video so the request is not rejected; the
 * filename and content type stay the model's.
 */
export async function uploadFileDirect(opts: {
    bookId: string;
    filename: string;
    contentType: string;
    file: Blob;
    type: string;
}): Promise<string> {
    const { bookId, filename, contentType, file, type } = opts;
    const signedType = LIVE_SIGNED_TYPES.has(type) ? type : 'video';
    try {
        const { data } = await apiClient.post('/api/upload/signed-url', {
            bookId,
            type: signedType,
            contentType,
            filename,
        });
        await putBlob(data.uploadUrl, file, contentType);
        return String(data.publicUrl || '');
    } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status && status !== 400) throw err;
    }

    const MAX_CHUNKS = 32;
    const MIN_CHUNK = 8 * 1024 * 1024;
    const chunkSize = Math.max(MIN_CHUNK, Math.ceil(file.size / MAX_CHUNKS));
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
    const sessionId = `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempObjectNames: string[] = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const blob = file.slice(start, Math.min(file.size, start + chunkSize));
        const { data } = await apiClient.post('/api/upload/signed-url-chunk', {
            bookId,
            type: 'video',
            contentType,
            filename,
            chunkIdx: i,
            totalChunks,
            sessionId,
        });
        await putBlob(data.uploadUrl, blob, contentType);
        tempObjectNames.push(data.tempObjectName);
    }

    const { data: composed } = await apiClient.post('/api/upload/compose-chunks', {
        bookId,
        type: 'video',
        filename,
        tempObjectNames,
        sessionId,
    });
    return String(composed.url || '');
}
