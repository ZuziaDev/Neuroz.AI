import type { LoadModelOptions, ModelRecord } from "./core/types.js";
import { ArtifactStore } from "./storage/artifact-store.js";
import { ModelRegistry } from "./registry/model-registry.js";
import { TfjsModel } from "./backends/tfjs/tfjs-model.js";
import type { CreateTfjsModelOptions } from "./backends/tfjs/types.js";
import { NlpModel } from "./backends/nlp/nlp-model.js";
import type { CreateNlpModelOptions } from "./backends/nlp/types.js";
import { OnnxModel } from "./backends/onnx/onnx-model.js";
import type { CreateOnnxModelOptions } from "./backends/onnx/types.js";
import { Dataset } from "./datasets/dataset.js";
import { CausalLanguageModel } from "./llm/causal-language-model.js";
import type { CreateCausalLanguageModelOptions } from "./llm/types.js";
import { ModerationAuditLog } from "./moderation/audit.js";
import { ModerationEngine } from "./moderation/engine.js";
import { ModerationModel } from "./moderation/moderation-model.js";
import type { CreateModerationModelOptions } from "./moderation/types.js";
import type { ModerationEngineOptions } from "./moderation/platform-types.js";
import { ModerationReviewQueue } from "./moderation/queue.js";
import { ModerationPolicyRegistry, ModerationRolloutManager, TenantModerationRegistry, type ModerationRolloutManagerOptions } from "./moderation/rollout.js";
import { ModerationUserRiskStore } from "./moderation/risk.js";
import { Trainer } from "./trainer/trainer.js";
export interface NeurozAIOptions {
    rootDir?: string;
}
export type ManagedModel = TfjsModel | NlpModel | OnnxModel | CausalLanguageModel | ModerationModel;
export declare class NeurozAI {
    readonly store: ArtifactStore;
    readonly registry: ModelRegistry;
    constructor(options?: NeurozAIOptions);
    initialize(): Promise<this>;
    createTfjsModel(options: CreateTfjsModelOptions): Promise<TfjsModel>;
    createNlpModel(options: CreateNlpModelOptions): Promise<NlpModel>;
    createOnnxModel(options: CreateOnnxModelOptions): Promise<OnnxModel>;
    createCausalLanguageModel(options: CreateCausalLanguageModelOptions): Promise<CausalLanguageModel>;
    createModerationModel(options: CreateModerationModelOptions): Promise<ModerationModel>;
    createOpenAIModerationModel(options: Omit<CreateModerationModelOptions, "schema" | "labels" | "modelName">): Promise<ModerationModel>;
    createDataset<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T>;
    createTrainer(): Trainer;
    createModerationEngine(options?: ModerationEngineOptions): ModerationEngine;
    createModerationReviewQueue(rootDir?: string): ModerationReviewQueue;
    createModerationAuditLog(rootDir?: string): ModerationAuditLog;
    createModerationUserRiskStore(): ModerationUserRiskStore;
    createModerationPolicyRegistry(): ModerationPolicyRegistry;
    createTenantModerationRegistry(): TenantModerationRegistry;
    createModerationRolloutManager(options: ModerationRolloutManagerOptions): ModerationRolloutManager;
    loadModel(options: LoadModelOptions): Promise<ManagedModel>;
    listModels(): Promise<ModelRecord[]>;
}
export declare function createNeurozAI(options?: NeurozAIOptions): Promise<NeurozAI>;
