import path from "node:path";

import { RuntimeDependencyError } from "../../core/errors.js";
import type { ModelRecord, SaveModelOptions } from "../../core/types.js";
import { toIsoDate } from "../../core/utils.js";
import { ModelRegistry } from "../../registry/model-registry.js";
import { ArtifactStore } from "../../storage/artifact-store.js";

import type {
  CreateNlpModelOptions,
  NlpModelConfig,
  NlpPredictionInput,
  NlpPredictionOutput,
  NlpTrainingCorpus,
} from "./types.js";

const NLP_MODEL_FILE = "model.nlp";
const NLP_CORPUS_FILE = "corpus.json";

type NlpManagerLike = {
  addDocument(language: string, utterance: string, intent: string): void;
  addAnswer?(language: string, intent: string, answer: string): void;
  train(): Promise<void>;
  process(language: string, utterance: string): Promise<Record<string, unknown>>;
  save?(filePath?: string): Promise<void> | void;
  load?(filePath: string): Promise<void> | void;
  export?(includeSettings?: boolean): Promise<unknown> | unknown;
  import?(serialized: unknown): Promise<void> | void;
};

async function createManager(config: NlpModelConfig): Promise<NlpManagerLike> {
  try {
    const nlpModule = await import("node-nlp");
    const namespace = (nlpModule.default ?? nlpModule) as {
      NlpManager?: new (config: Record<string, unknown>) => NlpManagerLike;
    };

    if (namespace.NlpManager === undefined) {
      throw new RuntimeDependencyError("node-nlp was loaded but NlpManager is not available.");
    }

    return new namespace.NlpManager({
      languages: config.languages,
      forceNER: config.forceNER ?? false,
      autoSave: config.autoSave ?? false,
      nlu: {
        useNoneFeature: config.useNoneFeature ?? true,
      },
    });
  } catch (error) {
    throw new RuntimeDependencyError("Failed to load node-nlp runtime.", {
      cause: error,
    });
  }
}

export class NlpModel {
  public readonly id: string;
  public readonly task: string;
  public readonly config: NlpModelConfig;
  public readonly tags: string[];

  private manager?: NlpManagerLike;

  public constructor(
    private readonly store: ArtifactStore,
    private readonly registry: ModelRegistry,
    options: CreateNlpModelOptions,
  ) {
    this.id = options.id;
    this.task = options.task;
    this.config = options.config;
    this.tags = options.tags ?? [];
  }

  public static async load(
    store: ArtifactStore,
    registry: ModelRegistry,
    record: ModelRecord<NlpModelConfig>,
  ): Promise<NlpModel> {
    const model = new NlpModel(store, registry, {
      id: record.id,
      task: record.task,
      config: record.config,
      tags: record.tags,
    });

    await model.loadVersion(record.version);
    return model;
  }

  public async train(corpus: NlpTrainingCorpus): Promise<void> {
    const manager = await this.ensureManager();

    for (const document of corpus.documents) {
      manager.addDocument(document.language, document.utterance, document.intent);
    }

    for (const answer of corpus.answers ?? []) {
      manager.addAnswer?.(answer.language, answer.intent, answer.answer);
    }

    await manager.train();
  }

  public async predict(input: NlpPredictionInput): Promise<NlpPredictionOutput> {
    const manager = await this.ensureManager();
    const output = await manager.process(input.language, input.utterance);

    return {
      language: typeof output.language === "string" ? output.language : undefined,
      locale: typeof output.locale === "string" ? output.locale : undefined,
      intent: typeof output.intent === "string" ? output.intent : undefined,
      score: typeof output.score === "number" ? output.score : undefined,
      sentiment:
        typeof output.sentiment === "number"
          ? output.sentiment
          : typeof (output.sentiment as { score?: unknown } | undefined)?.score === "number"
            ? (output.sentiment as { score: number }).score
            : undefined,
      answer: typeof output.answer === "string" ? output.answer : undefined,
      classifications: Array.isArray(output.classifications)
        ? output.classifications
            .map((item) => {
              if (
                typeof item === "object" &&
                item !== null &&
                typeof (item as { intent?: unknown }).intent === "string" &&
                typeof (item as { score?: unknown }).score === "number"
              ) {
                return {
                  intent: (item as { intent: string }).intent,
                  score: (item as { score: number }).score,
                };
              }

              return undefined;
            })
            .filter((item): item is { intent: string; score: number } => item !== undefined)
        : undefined,
    };
  }

  public async save(
    options: SaveModelOptions & {
      corpus?: NlpTrainingCorpus;
    },
  ): Promise<ModelRecord<NlpModelConfig>> {
    const manager = await this.ensureManager();
    const paths = await this.store.initializeVersion({
      id: this.id,
      version: options.version,
      backend: "nlp",
    });
    const modelPath = path.join(paths.artifactDir, NLP_MODEL_FILE);

    if (typeof manager.save === "function") {
      await manager.save(modelPath);
    } else if (typeof manager.export === "function") {
      const exported = await manager.export(true);
      await this.store.writeJson(modelPath, exported);
    } else {
      throw new RuntimeDependencyError(
        "node-nlp manager does not expose a supported save API.",
      );
    }

    if (options.corpus !== undefined) {
      await this.store.writeJson(
        path.join(paths.artifactDir, NLP_CORPUS_FILE),
        options.corpus,
      );
    }

    const now = toIsoDate();
    const record: ModelRecord<NlpModelConfig> = {
      id: this.id,
      version: options.version,
      backend: "nlp",
      task: this.task,
      status: "trained",
      createdAt: now,
      updatedAt: now,
      tags: this.tags,
      runtime: "node-nlp",
      config: this.config,
      metrics: options.metrics,
      metadata: options.metadata,
      artifactDir: paths.artifactDir,
      artifactFiles:
        options.corpus === undefined
          ? [NLP_MODEL_FILE]
          : [NLP_MODEL_FILE, NLP_CORPUS_FILE],
    };

    await this.registry.saveRecord(record);
    return record;
  }

  public async loadVersion(version: string): Promise<void> {
    const manager = await this.ensureManager(true);
    const modelPath = path.join(this.store.resolveArtifactDir(this.id, version), NLP_MODEL_FILE);

    if (typeof manager.load === "function") {
      await manager.load(modelPath);
      return;
    }

    if (typeof manager.import === "function") {
      const imported = await this.store.readJson<unknown>(modelPath);
      await manager.import(imported);
      return;
    }

    throw new RuntimeDependencyError("node-nlp manager does not expose a supported load API.");
  }

  private async ensureManager(recreate = false): Promise<NlpManagerLike> {
    if (this.manager !== undefined && !recreate) {
      return this.manager;
    }

    this.manager = await createManager(this.config);
    return this.manager;
  }
}
