import path from "node:path";
import { ConfigurationError } from "./core/errors.js";
import { ArtifactStore } from "./storage/artifact-store.js";
import { ModelRegistry } from "./registry/model-registry.js";
import { TfjsModel } from "./backends/tfjs/tfjs-model.js";
import { NlpModel } from "./backends/nlp/nlp-model.js";
import { OnnxModel } from "./backends/onnx/onnx-model.js";
import { Dataset } from "./datasets/dataset.js";
import { CausalLanguageModel } from "./llm/causal-language-model.js";
import { ModerationAuditLog } from "./moderation/audit.js";
import { ModerationEngine } from "./moderation/engine.js";
import { ModerationModel } from "./moderation/moderation-model.js";
import { DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL, OPENAI_MODERATION_CATEGORIES } from "./moderation/openai-schema.js";
import { ModerationReviewQueue } from "./moderation/queue.js";
import { ModerationPolicyRegistry, ModerationRolloutManager, TenantModerationRegistry, } from "./moderation/rollout.js";
import { ModerationUserRiskStore } from "./moderation/risk.js";
import { Trainer } from "./trainer/trainer.js";
export class NeurozAI {
    store;
    registry;
    constructor(options = {}) {
        const rootDir = path.resolve(options.rootDir ?? ".neurozai");
        this.store = new ArtifactStore(rootDir);
        this.registry = new ModelRegistry(this.store);
    }
    async initialize() {
        await this.store.ensureReady();
        return this;
    }
    async createTfjsModel(options) {
        return new TfjsModel(this.store, this.registry, options);
    }
    async createNlpModel(options) {
        return new NlpModel(this.store, this.registry, options);
    }
    async createOnnxModel(options) {
        return new OnnxModel(this.store, this.registry, options);
    }
    async createCausalLanguageModel(options) {
        return new CausalLanguageModel(this.store, this.registry, options);
    }
    async createModerationModel(options) {
        return new ModerationModel(this.store, this.registry, options);
    }
    async createOpenAIModerationModel(options) {
        return new ModerationModel(this.store, this.registry, {
            ...options,
            schema: "openai",
            labels: [...OPENAI_MODERATION_CATEGORIES],
            modelName: DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL,
        });
    }
    createDataset(records) {
        return Dataset.from(records);
    }
    createTrainer() {
        return new Trainer();
    }
    createModerationEngine(options = {}) {
        return new ModerationEngine(options);
    }
    createModerationReviewQueue(rootDir) {
        return new ModerationReviewQueue({
            rootDir: rootDir ?? path.join(this.store.rootDir, "moderation", "reviews"),
        });
    }
    createModerationAuditLog(rootDir) {
        return new ModerationAuditLog({
            rootDir: rootDir ?? path.join(this.store.rootDir, "moderation", "audit"),
        });
    }
    createModerationUserRiskStore() {
        return new ModerationUserRiskStore();
    }
    createModerationPolicyRegistry() {
        return new ModerationPolicyRegistry();
    }
    createTenantModerationRegistry() {
        return new TenantModerationRegistry();
    }
    createModerationRolloutManager(options) {
        return new ModerationRolloutManager(options);
    }
    async loadModel(options) {
        const record = await this.registry.getRecord(options.id, options.version);
        switch (record.backend) {
            case "tfjs":
                if (record.metadata?.modelFamily === "causal-language-model") {
                    return CausalLanguageModel.load(this.store, this.registry, record);
                }
                if (record.metadata?.modelFamily === "moderation-model") {
                    return ModerationModel.load(this.store, this.registry, record);
                }
                return TfjsModel.load(this.store, this.registry, record);
            case "nlp":
                return NlpModel.load(this.store, this.registry, record);
            case "onnx":
                return OnnxModel.load(this.store, this.registry, record);
            default:
                throw new ConfigurationError(`Unsupported backend: ${record.backend}`);
        }
    }
    async listModels() {
        return this.registry.listRecords();
    }
}
export async function createNeurozAI(options) {
    const neurozai = new NeurozAI(options);
    return neurozai.initialize();
}
//# sourceMappingURL=neurozai.js.map