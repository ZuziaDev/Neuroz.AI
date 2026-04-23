import path from "node:path";
import { ConfigurationError, ModelNotReadyError } from "../core/errors.js";
import { buildCausalLanguageModelDataset } from "../text/datasets.js";
import { TextTokenizer } from "../text/tokenizer.js";
import { Trainer } from "../trainer/trainer.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
const TOKENIZER_FILE = "tokenizer.json";
const LANGUAGE_MODEL_CONFIG_FILE = "language-model.json";
function createTokenizer(tokenizer) {
    if (tokenizer instanceof TextTokenizer) {
        return tokenizer;
    }
    return new TextTokenizer(tokenizer);
}
function pickIndexFromScores(scores, options) {
    if (scores.length === 0) {
        throw new ConfigurationError("Language model returned an empty score vector.");
    }
    if (options.strategy === "greedy" || options.temperature <= 0) {
        return scores.reduce((bestIndex, value, index, values) => value > values[bestIndex] ? index : bestIndex, 0);
    }
    const ranked = scores
        .map((value, index) => ({ value, index }))
        .sort((left, right) => right.value - left.value)
        .slice(0, Math.max(1, Math.min(options.topK, scores.length)));
    const stabilized = ranked.map(({ value }) => Math.exp(Math.log(Math.max(value, 1e-9)) / options.temperature));
    const total = stabilized.reduce((sum, value) => sum + value, 0);
    const threshold = Math.random() * total;
    let cumulative = 0;
    for (let position = 0; position < ranked.length; position += 1) {
        cumulative += stabilized[position];
        if (threshold <= cumulative) {
            return ranked[position].index;
        }
    }
    return ranked[ranked.length - 1].index;
}
export class CausalLanguageModel {
    store;
    registry;
    id;
    task;
    sequenceLength;
    embeddingDim;
    hiddenUnits;
    dropoutRate;
    recurrentLayerType;
    tags;
    tokenizer;
    tfjsModel;
    trainer = new Trainer();
    constructor(store, registry, options) {
        this.store = store;
        this.registry = registry;
        if (!Number.isInteger(options.sequenceLength) || options.sequenceLength <= 0) {
            throw new ConfigurationError("Language model sequenceLength must be a positive integer.");
        }
        this.id = options.id;
        this.task = options.task ?? "causal-language-model";
        this.sequenceLength = options.sequenceLength;
        this.embeddingDim = options.embeddingDim ?? 32;
        this.hiddenUnits = options.hiddenUnits ?? 64;
        this.dropoutRate = options.dropoutRate ?? 0.1;
        this.recurrentLayerType = options.recurrentLayerType ?? "lstm";
        this.tags = options.tags ?? [];
        this.tokenizer = createTokenizer(options.tokenizer);
    }
    static async load(store, registry, record) {
        const artifactDir = store.resolveArtifactDir(record.id, record.version);
        const config = await store.readJson(path.join(artifactDir, LANGUAGE_MODEL_CONFIG_FILE));
        const tokenizer = TextTokenizer.fromJSON(await store.readJson(path.join(artifactDir, TOKENIZER_FILE)));
        const model = new CausalLanguageModel(store, registry, {
            id: config.id,
            task: config.task,
            sequenceLength: config.sequenceLength,
            embeddingDim: config.embeddingDim,
            hiddenUnits: config.hiddenUnits,
            dropoutRate: config.dropoutRate,
            recurrentLayerType: config.recurrentLayerType,
            tags: config.tags,
            tokenizer,
        });
        model.tfjsModel = await TfjsModel.load(store, registry, record);
        return model;
    }
    async train(texts, options = {}) {
        if (texts.length === 0) {
            throw new ConfigurationError("Language model training requires at least one text sample.");
        }
        if (!this.isInitialized()) {
            this.tokenizer.fitOnTexts(texts);
            this.tfjsModel = await this.createTfjsModel();
        }
        const dataset = buildCausalLanguageModelDataset(texts, this.tokenizer, {
            sequenceLength: this.sequenceLength,
            stride: options.stride ?? 1,
            addBos: true,
            addEos: true,
        });
        if (dataset.size === 0) {
            throw new ConfigurationError("Language model dataset is empty. Provide longer texts or reduce sequenceLength.");
        }
        return this.trainer.fit(this.requireModel(), dataset, {
            fit: options.fit,
        });
    }
    async generate(prompt, options = {}) {
        const model = this.requireModel();
        const maxTokens = options.maxTokens ?? 16;
        const temperature = options.temperature ?? 1;
        const topK = options.topK ?? 5;
        const strategy = options.strategy ?? "greedy";
        const stopOnEos = options.stopOnEos ?? true;
        let context = this.tokenizer.encode(prompt, {
            addBos: true,
            maxLength: this.sequenceLength,
            padToLength: this.sequenceLength,
            padDirection: "left",
            truncateDirection: "left",
        });
        const generatedIds = [];
        for (let step = 0; step < maxTokens; step += 1) {
            const prediction = await model.predict({ inputs: [context] });
            const scores = prediction.values[0] ?? [];
            const nextId = pickIndexFromScores(scores, {
                temperature,
                topK,
                strategy,
            });
            if (stopOnEos && nextId === this.tokenizer.eosId) {
                break;
            }
            generatedIds.push(nextId);
            context = [...context, nextId].slice(-this.sequenceLength);
        }
        const completion = this.tokenizer.decode(generatedIds, {
            skipSpecialTokens: true,
        });
        return {
            prompt,
            completion,
            text: `${prompt}${this.tokenizer.options.level === "char" ? "" : " "}${completion}`.trim(),
            tokenIds: generatedIds,
        };
    }
    async save(options) {
        const model = this.requireModel();
        const record = await model.save({
            ...options,
            metadata: {
                ...(options.metadata ?? {}),
                modelFamily: "causal-language-model",
            },
        });
        const artifactDir = this.store.resolveArtifactDir(this.id, options.version);
        await this.store.writeJson(path.join(artifactDir, TOKENIZER_FILE), this.tokenizer.toJSON());
        await this.store.writeJson(path.join(artifactDir, LANGUAGE_MODEL_CONFIG_FILE), {
            id: this.id,
            task: this.task,
            sequenceLength: this.sequenceLength,
            embeddingDim: this.embeddingDim,
            hiddenUnits: this.hiddenUnits,
            dropoutRate: this.dropoutRate,
            recurrentLayerType: this.recurrentLayerType,
            tags: this.tags,
        });
        record.artifactFiles = [...record.artifactFiles, TOKENIZER_FILE, LANGUAGE_MODEL_CONFIG_FILE];
        record.metadata = {
            ...(record.metadata ?? {}),
            modelFamily: "causal-language-model",
        };
        await this.registry.saveRecord(record);
        return record;
    }
    isInitialized() {
        return this.tfjsModel !== undefined;
    }
    requireModel() {
        if (this.tfjsModel === undefined) {
            throw new ModelNotReadyError("Language model is not initialized. Train it first or load a saved version.");
        }
        return this.tfjsModel;
    }
    async createTfjsModel() {
        return new TfjsModel(this.store, this.registry, {
            id: this.id,
            task: this.task,
            tags: this.tags,
            config: {
                inputShape: [this.sequenceLength],
                inputDType: "int32",
                layers: [
                    {
                        type: "embedding",
                        inputDim: this.tokenizer.vocabSize,
                        outputDim: this.embeddingDim,
                        inputLength: this.sequenceLength,
                        maskZero: true,
                    },
                    this.recurrentLayerType === "lstm"
                        ? {
                            type: "lstm",
                            units: this.hiddenUnits,
                        }
                        : {
                            type: "gru",
                            units: this.hiddenUnits,
                        },
                    {
                        type: "dropout",
                        rate: this.dropoutRate,
                    },
                    {
                        type: "dense",
                        units: this.tokenizer.vocabSize,
                        activation: "softmax",
                    },
                ],
                compile: {
                    optimizer: "adam",
                    loss: "categoricalCrossentropy",
                    metrics: ["accuracy"],
                },
            },
        });
    }
}
//# sourceMappingURL=causal-language-model.js.map