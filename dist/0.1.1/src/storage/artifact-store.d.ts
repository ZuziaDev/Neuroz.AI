import type { BackendKind } from "../core/types.js";
export interface VersionPaths {
    modelDir: string;
    versionDir: string;
    artifactDir: string;
    metaPath: string;
    configPath: string;
}
export interface InitializeVersionOptions {
    id: string;
    version: string;
    backend: BackendKind;
}
export declare class ArtifactStore {
    readonly rootDir: string;
    constructor(rootDir: string);
    ensureReady(): Promise<void>;
    modelsRoot(): string;
    resolveModelDir(id: string): string;
    resolveVersionDir(id: string, version: string): string;
    resolveArtifactDir(id: string, version: string): string;
    resolveMetaPath(id: string, version: string): string;
    resolveConfigPath(id: string, version: string): string;
    initializeVersion(options: InitializeVersionOptions): Promise<VersionPaths>;
    writeJson(filePath: string, value: unknown): Promise<void>;
    readJson<T>(filePath: string): Promise<T>;
    writeBuffer(filePath: string, value: Uint8Array): Promise<void>;
    readBuffer(filePath: string): Promise<Buffer>;
    copyIntoArtifacts(sourcePath: string, id: string, version: string, targetName?: string): Promise<string>;
    listModelIds(): Promise<string[]>;
    listVersions(id: string): Promise<string[]>;
}
