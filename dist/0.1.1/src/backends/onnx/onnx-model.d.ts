import type { ModelRecord, SaveModelOptions } from "../../core/types.js";
import { ModelRegistry } from "../../registry/model-registry.js";
import { ArtifactStore } from "../../storage/artifact-store.js";
import type { CreateOnnxModelOptions, OnnxModelConfig, OnnxPredictionInput, OnnxPredictionOutput } from "./types.js";
export declare class OnnxModel {
    private readonly store;
    private readonly registry;
    readonly id: string;
    readonly task: string;
    readonly config: OnnxModelConfig;
    readonly tags: string[];
    private ort?;
    private session?;
    private activeVersion?;
    constructor(store: ArtifactStore, registry: ModelRegistry, options: CreateOnnxModelOptions);
    static load(store: ArtifactStore, registry: ModelRegistry, record: ModelRecord<OnnxModelConfig>): Promise<OnnxModel>;
    save(options: SaveModelOptions): Promise<ModelRecord<OnnxModelConfig>>;
    loadVersion(version: string): Promise<void>;
    predict(input: OnnxPredictionInput): Promise<OnnxPredictionOutput>;
    train(): Promise<never>;
    get version(): string | undefined;
    private ensureOrt;
}
