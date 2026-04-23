import path from "node:path";

import type { ModelRecord } from "../core/types.js";
import { ConfigurationError, ModelNotReadyError } from "../core/errors.js";
import { ModelRegistry } from "../registry/model-registry.js";
import { ArtifactStore } from "../storage/artifact-store.js";
import { buildCausalLanguageModelDataset } from "../text/datasets.js";
import { TextTokenizer } from "../text/tokenizer.js";
import type { SerializedTextTokenizer } from "../text/types.js";
import { Trainer } from "../trainer/trainer.js";
import type { TrainerRunResult } from "../trainer/types.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
import type { TfjsModelConfig } from "../backends/tfjs/types.js";

import type {
  CausalLanguageModelArtifactConfig,
  CausalLanguageModelSaveOptions,
  CausalLanguageModelTrainOptions,
  CreateCausalLanguageModelOptions,
  GenerateTextOptions,
  GenerateTextResult,
} from "./types.js";

const TOKENIZER_FILE = "tokenizer.json";
const LANGUAGE_MODEL_CONFIG_FILE = "language-model.json";

function createTokenizer(tokenizer?: CreateCausalLanguageModelOptions["tokenizer"]): TextTokenizer {
  if (tokenizer instanceof TextTokenizer) {
    return tokenizer;
  }

  return new TextTokenizer(tokenizer);
}

function pickIndexFromScores(
  scores: readonly number[],
  options: {
    temperature: number;
    topK: number;
    strategy: "greedy" | "sample";
  },
): number {
  if (scores.length === 0) {
    throw new ConfigurationError("Language model returned an empty score vector.");
  }

  if (options.strategy === "greedy" || options.temperature <= 0) {
    return scores.reduce(
      (bestIndex, value, index, values) =>
        value > values[bestIndex]! ? index : bestIndex,
      0,
    );
  }

  const ranked = scores
    .map((value, index) => ({ value, index }))
    .sort((left, right) => right.value - left.value)
    .slice(0, Math.max(1, Math.min(options.topK, scores.length)));

  const stabilized = ranked.map(({ value }) =>
    Math.exp(Math.log(Math.max(value, 1e-9)) / options.temperature),
  );
  const total = stabilized.reduce((sum, value) => sum + value, 0);
  const threshold = Math.random() * total;

  let cumulative = 0;
  for (let position = 0; position < ranked.length; position += 1) {
    cumulative += stabilized[position]!;
    if (threshold <= cumulative) {
      return ranked[position]!.index;
    }
  }

  return ranked[ranked.length - 1]!.index;
}

export class CausalLanguageModel {
  public readonly id: string;
  public readonly task: string;
  public readonly sequenceLength: number;
  public readonly embeddingDim: number;
  public readonly hiddenUnits: number;
  public readonly dropoutRate: number;
  public readonly recurrentLayerType: "lstm" | "gru";
  public readonly tags: string[];
  public readonly tokenizer: TextTokenizer;

  private tfjsModel?: TfjsModel;
  private trainer = new Trainer();

  public constructor(
    private readonly store: ArtifactStore,
    private readonly registry: ModelRegistry,
    options: CreateCausalLanguageModelOptions,
  ) {
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

  public static async load(
    store: ArtifactStore,
    registry: ModelRegistry,
    record: ModelRecord<TfjsModelConfig>,
  ): Promise<CausalLanguageModel> {
    const artifactDir = store.resolveArtifactDir(record.id, record.version);
    const config = await store.readJson<CausalLanguageModelArtifactConfig>(
      path.join(artifactDir, LANGUAGE_MODEL_CONFIG_FILE),
    );
    const tokenizer = TextTokenizer.fromJSON(
      await store.readJson<SerializedTextTokenizer>(path.join(artifactDir, TOKENIZER_FILE)),
    );

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

  public async train(
    texts: readonly string[],
    options: CausalLanguageModelTrainOptions = {},
  ): Promise<TrainerRunResult> {
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
      throw new ConfigurationError(
        "Language model dataset is empty. Provide longer texts or reduce sequenceLength.",
      );
    }

    return this.trainer.fit(this.requireModel(), dataset, {
      fit: options.fit,
    });
  }

  public async generate(
    prompt: string,
    options: GenerateTextOptions = {},
  ): Promise<GenerateTextResult> {
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

    const generatedIds: number[] = [];

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

  public async save(options: CausalLanguageModelSaveOptions): Promise<ModelRecord<TfjsModelConfig>> {
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
    } satisfies CausalLanguageModelArtifactConfig);

    record.artifactFiles = [...record.artifactFiles, TOKENIZER_FILE, LANGUAGE_MODEL_CONFIG_FILE];
    record.metadata = {
      ...(record.metadata ?? {}),
      modelFamily: "causal-language-model",
    };
    await this.registry.saveRecord(record);
    return record;
  }

  private isInitialized(): boolean {
    return this.tfjsModel !== undefined;
  }

  private requireModel(): TfjsModel {
    if (this.tfjsModel === undefined) {
      throw new ModelNotReadyError(
        "Language model is not initialized. Train it first or load a saved version.",
      );
    }

    return this.tfjsModel;
  }

  private async createTfjsModel(): Promise<TfjsModel> {
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
