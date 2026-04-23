import { randomUUID } from "node:crypto";
import path from "node:path";

import type { ModelRecord } from "../core/types.js";
import { ConfigurationError, ModelNotReadyError } from "../core/errors.js";
import { ModelRegistry } from "../registry/model-registry.js";
import { ArtifactStore } from "../storage/artifact-store.js";
import { buildModerationDataset } from "../text/datasets.js";
import { TextTokenizer } from "../text/tokenizer.js";
import type {
  ModerationTrainingExample,
  SerializedTextTokenizer,
} from "../text/types.js";
import { Trainer } from "../trainer/trainer.js";
import type { TrainerRunResult } from "../trainer/types.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
import type { TfjsModelConfig } from "../backends/tfjs/types.js";

import {
  DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL,
  OPENAI_MODERATION_CATEGORIES,
} from "./openai-schema.js";
import type {
  ModerationBatchPredictionResult,
  CreateModerationModelOptions,
  ModerationCategoryScore,
  ModerationFlatPredictionResult,
  ModerationModelArtifactConfig,
  ModerationModelSaveOptions,
  ModerationPredictionExplanation,
  ModerationPredictionResult,
  ModerationResultEntry,
  ModerationThresholds,
  ModerationTrainOptions,
} from "./types.js";

const TOKENIZER_FILE = "tokenizer.json";
const MODERATION_CONFIG_FILE = "moderation-model.json";

function createTokenizer(tokenizer?: CreateModerationModelOptions["tokenizer"]): TextTokenizer {
  if (tokenizer instanceof TextTokenizer) {
    return tokenizer;
  }

  return new TextTokenizer(tokenizer);
}

function argmax(values: readonly number[]): number {
  return values.reduce(
    (bestIndex, value, index, items) =>
      value > items[bestIndex]! ? index : bestIndex,
    0,
  );
}

function deriveDefaultCategories(options: CreateModerationModelOptions): string[] {
  if (options.labels !== undefined && options.labels.length > 0) {
    return options.labels.filter((label) => label !== options.safeLabel);
  }

  return [...OPENAI_MODERATION_CATEGORIES];
}

function defaultSafeLabel(categories: readonly string[], preferred?: string): string | undefined {
  if (preferred !== undefined) {
    return preferred;
  }

  return categories.find((label) => ["safe", "ok", "allowed", "clean"].includes(label.toLowerCase()));
}

function thresholdForCategory(
  thresholds: ModerationThresholds | undefined,
  category: string,
): number {
  return thresholds?.categories?.[category] ?? thresholds?.default ?? 0.5;
}

function modelNameFor(options: CreateModerationModelOptions): string {
  return options.modelName ?? DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL;
}

export class ModerationModel {
  public readonly id: string;
  public readonly task: string;
  public readonly sequenceLength: number;
  public readonly embeddingDim: number;
  public readonly hiddenUnits: number;
  public readonly dropoutRate: number;
  public readonly tags: string[];
  public readonly tokenizer: TextTokenizer;
  public readonly schema: "openai" | "flat";
  public readonly modelName: string;

  private tfjsModel?: TfjsModel;
  private trainer = new Trainer();
  private categories: string[];
  private safeLabel: string | undefined;
  private thresholds: ModerationThresholds | undefined;

  public constructor(
    private readonly store: ArtifactStore,
    private readonly registry: ModelRegistry,
    options: CreateModerationModelOptions,
  ) {
    if (!Number.isInteger(options.sequenceLength) || options.sequenceLength <= 0) {
      throw new ConfigurationError("Moderation model sequenceLength must be a positive integer.");
    }

    this.id = options.id;
    this.task = options.task ?? "moderation-classification";
    this.sequenceLength = options.sequenceLength;
    this.embeddingDim = options.embeddingDim ?? 32;
    this.hiddenUnits = options.hiddenUnits ?? 32;
    this.dropoutRate = options.dropoutRate ?? 0.1;
    this.tags = options.tags ?? [];
    this.tokenizer = createTokenizer(options.tokenizer);
    this.schema = options.schema ?? "openai";
    this.modelName = modelNameFor(options);
    this.categories = deriveDefaultCategories(options);
    this.safeLabel = defaultSafeLabel(this.categories, options.safeLabel);
    this.thresholds = options.thresholds;
  }

  public static async load(
    store: ArtifactStore,
    registry: ModelRegistry,
    record: ModelRecord<TfjsModelConfig>,
  ): Promise<ModerationModel> {
    const artifactDir = store.resolveArtifactDir(record.id, record.version);
    const config = await store.readJson<ModerationModelArtifactConfig>(
      path.join(artifactDir, MODERATION_CONFIG_FILE),
    );
    const tokenizer = TextTokenizer.fromJSON(
      await store.readJson<SerializedTextTokenizer>(path.join(artifactDir, TOKENIZER_FILE)),
    );

    const model = new ModerationModel(store, registry, {
      id: config.id,
      task: config.task,
      sequenceLength: config.sequenceLength,
      embeddingDim: config.embeddingDim,
      hiddenUnits: config.hiddenUnits,
      dropoutRate: config.dropoutRate,
      schema: config.schema,
      modelName: config.modelName,
      labels: config.labels,
      safeLabel: config.safeLabel,
      thresholds: config.thresholds,
      tags: config.tags,
      tokenizer,
    });

    model.tfjsModel = await TfjsModel.load(store, registry, record);
    return model;
  }

  public async train(
    examples: readonly ModerationTrainingExample[],
    options: ModerationTrainOptions = {},
  ): Promise<TrainerRunResult> {
    if (examples.length === 0) {
      throw new ConfigurationError("Moderation training requires at least one labeled example.");
    }

    if (!this.isInitialized()) {
      this.tokenizer.fitOnTexts(examples.map((example) => example.text));
      this.categories = this.resolveCategoriesFromExamples(examples);
      this.tfjsModel = await this.createTfjsModel();
    }

    const datasetBundle = buildModerationDataset(examples, this.tokenizer, {
      sequenceLength: this.sequenceLength,
      labels: this.categories,
      safeLabel: this.safeLabel,
      addBos: true,
      addEos: true,
    });

    this.categories = datasetBundle.labels;

    return this.trainer.fit(this.requireModel(), datasetBundle.dataset, {
      fit: options.fit,
    });
  }

  public async predict(text: string): Promise<ModerationPredictionResult> {
    const entry = await this.predictEntry(text);

    return {
      id: `modr-${randomUUID().replaceAll("-", "")}`,
      model: this.modelName,
      results: [entry],
    };
  }

  public async predictMany(texts: readonly string[]): Promise<ModerationPredictionResult[]> {
    return Promise.all(texts.map((text) => this.predict(text)));
  }

  public async predictFlat(text: string): Promise<ModerationFlatPredictionResult> {
    const entry = await this.predictEntry(text);
    const scores = this.categories.map((category) => ({
      category,
      score: entry.category_scores[category] ?? 0,
      flagged: entry.categories[category] ?? false,
    }));

    const topIndex = argmax(scores.map((item) => item.score));
    const top = scores[topIndex];

    return {
      text,
      flagged: entry.flagged,
      top_category: top?.category,
      top_score: top?.score,
      scores,
    };
  }

  public async explain(text: string): Promise<ModerationPredictionExplanation> {
    const base = await this.predictEntry(text);
    const tokens = [...new Set(this.tokenizer.tokenize(text))].slice(0, 12);
    const candidateCategories = Object.entries(base.category_scores)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([category]) => category);

    const tokenContributions = [];

    for (const token of tokens) {
      const masked = text.replace(new RegExp(token, "i"), " ");
      const ablated = await this.predictEntry(masked);

      for (const category of candidateCategories) {
        tokenContributions.push({
          token,
          category,
          contribution: Number(
            ((base.category_scores[category] ?? 0) - (ablated.category_scores[category] ?? 0)).toFixed(
              6,
            ),
          ),
        });
      }
    }

    tokenContributions.sort((left, right) => right.contribution - left.contribution);

    return {
      summary:
        tokenContributions.length === 0
          ? "No strong token-level contribution was detected."
          : `Top token influence: ${tokenContributions[0]?.token ?? "n/a"}.`,
      tokenContributions,
    };
  }

  public async save(options: ModerationModelSaveOptions): Promise<ModelRecord<TfjsModelConfig>> {
    const model = this.requireModel();
    const record = await model.save({
      ...options,
      metadata: {
        ...(options.metadata ?? {}),
        modelFamily: "moderation-model",
        moderationSchema: this.schema,
      },
    });

    const artifactDir = this.store.resolveArtifactDir(this.id, options.version);
    await this.store.writeJson(path.join(artifactDir, TOKENIZER_FILE), this.tokenizer.toJSON());
    await this.store.writeJson(path.join(artifactDir, MODERATION_CONFIG_FILE), {
      id: this.id,
      task: this.task,
      sequenceLength: this.sequenceLength,
      embeddingDim: this.embeddingDim,
      hiddenUnits: this.hiddenUnits,
      dropoutRate: this.dropoutRate,
      schema: this.schema,
      modelName: this.modelName,
      labels: this.categories,
      safeLabel: this.safeLabel,
      thresholds: this.thresholds,
      tags: this.tags,
    } satisfies ModerationModelArtifactConfig);

    record.artifactFiles = [...record.artifactFiles, TOKENIZER_FILE, MODERATION_CONFIG_FILE];
    record.metadata = {
      ...(record.metadata ?? {}),
      modelFamily: "moderation-model",
      moderationSchema: this.schema,
    };
    await this.registry.saveRecord(record);
    return record;
  }

  public get moderationLabels(): string[] {
    return [...this.categories];
  }

  public get moderationCategories(): string[] {
    return [...this.categories];
  }

  private isInitialized(): boolean {
    return this.tfjsModel !== undefined;
  }

  private requireModel(): TfjsModel {
    if (this.tfjsModel === undefined) {
      throw new ModelNotReadyError(
        "Moderation model is not initialized. Train it first or load a saved version.",
      );
    }

    return this.tfjsModel;
  }

  private resolveCategoriesFromExamples(examples: readonly ModerationTrainingExample[]): string[] {
    if (this.categories.length > 0) {
      return [...this.categories];
    }

    const discovered = new Set<string>();
    for (const example of examples) {
      for (const label of example.labels ?? []) {
        if (label !== this.safeLabel) {
          discovered.add(label);
        }
      }

      for (const [category, active] of Object.entries(example.categories ?? {})) {
        if (active) {
          discovered.add(category);
        }
      }

      if (example.label !== undefined && example.label !== this.safeLabel) {
        discovered.add(example.label);
      }
    }

    const categories = [...discovered].sort();
    if (categories.length === 0) {
      throw new ConfigurationError(
        "No moderation categories were discovered. Provide labels/categories or configure labels explicitly.",
      );
    }

    return categories;
  }

  private async predictEntry(text: string): Promise<ModerationResultEntry> {
    const model = this.requireModel();
    const encoded = this.tokenizer.encode(text, {
      addBos: true,
      addEos: true,
      maxLength: this.sequenceLength,
      padToLength: this.sequenceLength,
      padDirection: "left",
      truncateDirection: "left",
    });
    const prediction = await model.predict({ inputs: [encoded] });
    const rawScores = prediction.values[0] ?? [];

    const categories = Object.fromEntries(
      this.categories.map((category, index) => {
        const score = rawScores[index] ?? 0;
        return [category, score >= thresholdForCategory(this.thresholds, category)];
      }),
    );
    const categoryScores = Object.fromEntries(
      this.categories.map((category, index) => [category, rawScores[index] ?? 0]),
    );
    const categoryAppliedInputTypes = Object.fromEntries(
      this.categories.map((category) => [
        category,
        (categories[category] ? ["text"] : []) as ("text")[],
      ]),
    );

    return {
      flagged: Object.values(categories).some(Boolean),
      categories,
      category_scores: categoryScores,
      category_applied_input_types: categoryAppliedInputTypes,
    };
  }

  private async createTfjsModel(): Promise<TfjsModel> {
    if (this.categories.length === 0) {
      throw new ConfigurationError(
        "Moderation model labels are empty. Provide labels or train with labeled examples first.",
      );
    }

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
          {
            type: "globalAveragePooling1d",
          },
          {
            type: "dense",
            units: this.hiddenUnits,
            activation: "relu",
          },
          {
            type: "dropout",
            rate: this.dropoutRate,
          },
          {
            type: "dense",
            units: this.categories.length,
            activation: "sigmoid",
          },
        ],
        compile: {
          optimizer: "adam",
          loss: "binaryCrossentropy",
          metrics: ["accuracy"],
        },
      },
    });
  }
}
