import type { ModelRecord } from "../core/types.js";
import { ArtifactStore } from "../storage/artifact-store.js";
export declare class ModelRegistry {
    private readonly store;
    constructor(store: ArtifactStore);
    saveRecord<TConfig>(record: ModelRecord<TConfig>): Promise<void>;
    getRecord<TConfig>(id: string, version: string): Promise<ModelRecord<TConfig>>;
    listModelIds(): Promise<string[]>;
    listVersions(id: string): Promise<string[]>;
    listRecords(): Promise<ModelRecord[]>;
}
