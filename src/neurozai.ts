import path from "node:path";

import type { LoadModelOptions, ModelRecord } from "./core/types.js";
import { ConfigurationError } from "./core/errors.js";
import { ArtifactStore } from "./storage/artifact-store.js";
import { ModelRegistry } from "./registry/model-registry.js";
import { TfjsModel } from "./backends/tfjs/tfjs-model.js";
import type { CreateTfjsModelOptions, TfjsModelConfig } from "./backends/tfjs/types.js";
import { NlpModel } from "./backends/nlp/nlp-model.js";
import type { CreateNlpModelOptions, NlpModelConfig } from "./backends/nlp/types.js";
import { OnnxModel } from "./backends/onnx/onnx-model.js";
import type { CreateOnnxModelOptions, OnnxModelConfig } from "./backends/onnx/types.js";
import { Dataset } from "./datasets/dataset.js";
import { CausalLanguageModel } from "./llm/causal-language-model.js";
import type { CreateCausalLanguageModelOptions } from "./llm/types.js";
import { ModerationAuditLog } from "./moderation/audit.js";
import { ModerationEngine } from "./moderation/engine.js";
import { ModerationModel } from "./moderation/moderation-model.js";
import type { CreateModerationModelOptions } from "./moderation/types.js";
import type { ModerationEngineOptions } from "./moderation/platform-types.js";
import { DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL, OPENAI_MODERATION_CATEGORIES } from "./moderation/openai-schema.js";
import { ModerationReviewQueue } from "./moderation/queue.js";
import {
  ModerationPolicyRegistry,
  ModerationRolloutManager,
  TenantModerationRegistry,
  type ModerationRolloutManagerOptions,
} from "./moderation/rollout.js";
import { ModerationUserRiskStore } from "./moderation/risk.js";
import { Trainer } from "./trainer/trainer.js";

export interface NeurozAIOptions {
  rootDir?: string;
}

export type ManagedModel =
  | TfjsModel
  | NlpModel
  | OnnxModel
  | CausalLanguageModel
  | ModerationModel;

export class NeurozAI {
  public readonly store: ArtifactStore;
  public readonly registry: ModelRegistry;

  public constructor(options: NeurozAIOptions = {}) {
    const rootDir = path.resolve(options.rootDir ?? ".neurozai");
    this.store = new ArtifactStore(rootDir);
    this.registry = new ModelRegistry(this.store);
  }

  public async initialize(): Promise<this> {
    await this.store.ensureReady();
    return this;
  }

  public async createTfjsModel(options: CreateTfjsModelOptions): Promise<TfjsModel> {
    return new TfjsModel(this.store, this.registry, options);
  }

  public async createNlpModel(options: CreateNlpModelOptions): Promise<NlpModel> {
    return new NlpModel(this.store, this.registry, options);
  }

  public async createOnnxModel(options: CreateOnnxModelOptions): Promise<OnnxModel> {
    return new OnnxModel(this.store, this.registry, options);
  }

  public async createCausalLanguageModel(
    options: CreateCausalLanguageModelOptions,
  ): Promise<CausalLanguageModel> {
    return new CausalLanguageModel(this.store, this.registry, options);
  }

  public async createModerationModel(
    options: CreateModerationModelOptions,
  ): Promise<ModerationModel> {
    return new ModerationModel(this.store, this.registry, options);
  }

  public async createOpenAIModerationModel(
    options: Omit<CreateModerationModelOptions, "schema" | "labels" | "modelName">,
  ): Promise<ModerationModel> {
    return new ModerationModel(this.store, this.registry, {
      ...options,
      schema: "openai",
      labels: [...OPENAI_MODERATION_CATEGORIES],
      modelName: DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL,
    });
  }

  public createDataset<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T> {
    return Dataset.from(records);
  }

  public createTrainer(): Trainer {
    return new Trainer();
  }

  public createModerationEngine(options: ModerationEngineOptions = {}): ModerationEngine {
    return new ModerationEngine(options);
  }

  public createModerationReviewQueue(rootDir?: string): ModerationReviewQueue {
    return new ModerationReviewQueue({
      rootDir: rootDir ?? path.join(this.store.rootDir, "moderation", "reviews"),
    });
  }

  public createModerationAuditLog(rootDir?: string): ModerationAuditLog {
    return new ModerationAuditLog({
      rootDir: rootDir ?? path.join(this.store.rootDir, "moderation", "audit"),
    });
  }

  public createModerationUserRiskStore(): ModerationUserRiskStore {
    return new ModerationUserRiskStore();
  }

  public createModerationPolicyRegistry(): ModerationPolicyRegistry {
    return new ModerationPolicyRegistry();
  }

  public createTenantModerationRegistry(): TenantModerationRegistry {
    return new TenantModerationRegistry();
  }

  public createModerationRolloutManager(
    options: ModerationRolloutManagerOptions,
  ): ModerationRolloutManager {
    return new ModerationRolloutManager(options);
  }

  public async loadModel(options: LoadModelOptions): Promise<ManagedModel> {
    const record = await this.registry.getRecord(options.id, options.version);

    switch (record.backend) {
      case "tfjs":
        if ((record.metadata as { modelFamily?: string } | undefined)?.modelFamily === "causal-language-model") {
          return CausalLanguageModel.load(
            this.store,
            this.registry,
            record as ModelRecord<TfjsModelConfig>,
          );
        }

        if ((record.metadata as { modelFamily?: string } | undefined)?.modelFamily === "moderation-model") {
          return ModerationModel.load(
            this.store,
            this.registry,
            record as ModelRecord<TfjsModelConfig>,
          );
        }

        return TfjsModel.load(
          this.store,
          this.registry,
          record as ModelRecord<TfjsModelConfig>,
        );
      case "nlp":
        return NlpModel.load(
          this.store,
          this.registry,
          record as ModelRecord<NlpModelConfig>,
        );
      case "onnx":
        return OnnxModel.load(
          this.store,
          this.registry,
          record as ModelRecord<OnnxModelConfig>,
        );
      default:
        throw new ConfigurationError(
          `Unsupported backend: ${(record as { backend: string }).backend}`,
        );
    }
  }

  public async listModels(): Promise<ModelRecord[]> {
    return this.registry.listRecords();
  }
}

export async function createNeurozAI(options?: NeurozAIOptions): Promise<NeurozAI> {
  const neurozai = new NeurozAI(options);
  return neurozai.initialize();
}
