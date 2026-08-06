/**
 * Minimal typings for the `draco3d` npm package (no official @types needed
 * for our usage — gltf-transform just wants the opaque encoder/decoder
 * module objects passed through registerDependencies()).
 */
declare module 'draco3d' {
    export interface DracoModuleConfig {
        /** Pre-fetched wasm binary; skips Emscripten's own file/URL resolution. */
        wasmBinary?: ArrayBuffer;
    }

    const draco3d: {
        createEncoderModule(config?: DracoModuleConfig): Promise<object>;
        createDecoderModule(config?: DracoModuleConfig): Promise<object>;
    };
    export default draco3d;
}
