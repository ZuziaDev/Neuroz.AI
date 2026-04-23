import type { ModelRecord, SaveModelOptions } from "../../core/types.js";
import { ModelRegistry } from "../../registry/model-registry.js";
import { ArtifactStore } from "../../storage/artifact-store.js";
import type { CreateNlpModelOptions, NlpModelConfig, NlpPredictionInput, NlpPredictionOutput, NlpTrainingCorpus } from "./types.js";
export declare class NlpModel {
    private readonly store;
    private readonly registry;
    readonly id: string;
    readonly task: string;
    readonly config: NlpModelConfig;
    readonly tags: string[];
    private manager?;
    constructor(store: ArtifactStore, registry: ModelRegistry, options: CreateNlpModelOptions);
    static load(store: ArtifactStore, registry: ModelRegistry, record: ModelRecord<NlpModelConfig>): Promise<NlpModel>;
    train(corpus: NlpTrainingCorpus): Promise<void>;
    predict(input: NlpPredictionInput): Promise<NlpPredictionOutput>;
    save(options: SaveModelOptions & {
        corpus?: NlpTrainingCorpus;
    }): Promise<ModelRecord<NlpModelConfig>>;
    loadVersion(version: string): Promise<void>;
    private ensureManager;
}
