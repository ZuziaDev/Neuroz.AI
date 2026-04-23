import type { ModelMetrics, ModelRecord, SaveModelOptions } from "../../core/types.js";
import { ArtifactStore } from "../../storage/artifact-store.js";
import { ModelRegistry } from "../../registry/model-registry.js";
import type { CreateTfjsModelOptions, TfjsModelConfig, TfjsPredictionInput, TfjsPredictionOutput, TfjsTrainingData } from "./types.js";
export declare class TfjsModel {
    private readonly store;
    private readonly registry;
    readonly id: string;
    readonly task: string;
    readonly config: TfjsModelConfig;
    readonly tags: string[];
    private model?;
    private runtime;
    private tf?;
    private lastMetrics?;
    constructor(store: ArtifactStore, registry: ModelRegistry, options: CreateTfjsModelOptions);
    static load(store: ArtifactStore, registry: ModelRegistry, record: ModelRecord<TfjsModelConfig>): Promise<TfjsModel>;
    train(trainingData: TfjsTrainingData): Promise<ModelMetrics>;
    predict(input: TfjsPredictionInput): Promise<TfjsPredictionOutput>;
    save(options: SaveModelOptions): Promise<ModelRecord<TfjsModelConfig>>;
    loadVersion(version: string): Promise<void>;
    private ensureRuntime;
    private getTf;
    private ensureModel;
    private compileIfNeeded;
}
