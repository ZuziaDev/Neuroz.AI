import path from "node:path";

import type { LayersModel, Optimizer, Tensor } from "@tensorflow/tfjs";

import {
  ConfigurationError,
  ModelNotReadyError,
  UnsupportedOperationError,
} from "../../core/errors.js";
import type { ModelMetrics, ModelRecord, SaveModelOptions } from "../../core/types.js";
import { ensureNumberArray, mean, resolveArrayBuffer, toIsoDate } from "../../core/utils.js";
import { ArtifactStore } from "../../storage/artifact-store.js";
import { ModelRegistry } from "../../registry/model-registry.js";

import type {
  CreateTfjsModelOptions,
  StoredTfjsArtifacts,
  TfjsInputDType,
  TfjsModelConfig,
  TfjsPredictionInput,
  TfjsPredictionOutput,
  TfjsTrainingData,
} from "./types.js";
import { loadTensorFlow, type TensorFlowModule } from "./tfjs-module.js";

const TFJS_MODEL_FILE = "model-artifacts.json";
const TFJS_WEIGHTS_FILE = "weights.bin";

function buildOptimizer(
  tf: TensorFlowModule,
  compile: TfjsModelConfig["compile"] | undefined,
): string | Optimizer {
  const optimizer = compile?.optimizer ?? "adam";
  const learningRate = compile?.learningRate;

  if (learningRate === undefined) {
    return optimizer;
  }

  switch (optimizer) {
    case "adam":
      return tf.train.adam(learningRate);
    case "sgd":
      return tf.train.sgd(learningRate);
    case "adagrad":
      return tf.train.adagrad(learningRate);
    case "rmsprop":
      return tf.train.rmsprop(learningRate);
    default:
      throw new ConfigurationError(`Unsupported optimizer: ${optimizer}`);
  }
}

function buildTensor(
  tf: TensorFlowModule,
  values: number[] | number[][],
  dtype: TfjsInputDType = "float32",
): Tensor {
  const matrix = ensureNumberArray(values);
  const rows = matrix.length;
  const columns = matrix[0]?.length ?? 1;
  return tf.tensor2d(matrix.flat(), [rows, columns], dtype);
}

function combineWeightData(
  weightData: ArrayBuffer | ArrayBuffer[] | undefined,
): Uint8Array | undefined {
  if (weightData === undefined) {
    return undefined;
  }

  if (!Array.isArray(weightData)) {
    return new Uint8Array(weightData);
  }

  const totalLength = weightData.reduce((sum, part) => sum + part.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of weightData) {
    const view = new Uint8Array(part);
    merged.set(view, offset);
    offset += view.byteLength;
  }

  return merged;
}

export class TfjsModel {
  public readonly id: string;
  public readonly task: string;
  public readonly config: TfjsModelConfig;
  public readonly tags: string[];

  private model?: LayersModel;
  private runtime = "tfjs";
  private tf?: TensorFlowModule;
  private lastMetrics?: ModelMetrics;

  public constructor(
    private readonly store: ArtifactStore,
    private readonly registry: ModelRegistry,
    options: CreateTfjsModelOptions,
  ) {
    this.id = options.id;
    this.task = options.task;
    this.config = options.config;
    this.tags = options.tags ?? [];
  }

  public static async load(
    store: ArtifactStore,
    registry: ModelRegistry,
    record: ModelRecord<TfjsModelConfig>,
  ): Promise<TfjsModel> {
    const model = new TfjsModel(store, registry, {
      id: record.id,
      task: record.task,
      config: record.config,
      tags: record.tags,
    });

    await model.loadVersion(record.version);
    return model;
  }

  public async train(trainingData: TfjsTrainingData): Promise<ModelMetrics> {
    await this.ensureRuntime();
    await this.ensureModel();

    const tf = this.getTf();
    const xs = buildTensor(tf, trainingData.inputs, this.config.inputDType ?? "float32");
    const ys = buildTensor(tf, trainingData.labels);

    try {
      this.compileIfNeeded();
      const fitOptions: {
        epochs: number;
        batchSize?: number;
        validationSplit?: number;
        shuffle: boolean;
        verbose: 0 | 1;
      } = {
        epochs: trainingData.fit?.epochs ?? 30,
        shuffle: trainingData.fit?.shuffle ?? true,
        verbose: trainingData.fit?.verbose ?? 0,
      };

      if (trainingData.fit?.batchSize !== undefined) {
        fitOptions.batchSize = trainingData.fit.batchSize;
      }

      if (trainingData.fit?.validationSplit !== undefined) {
        fitOptions.validationSplit = trainingData.fit.validationSplit;
      }

      const history = await this.model!.fit(xs, ys, fitOptions);

      const lossValues = Array.isArray(history.history.loss)
        ? history.history.loss.filter((value): value is number => typeof value === "number")
        : [];
      const metricName = Object.keys(history.history).find((name) => name !== "loss");
      const metricValues =
        metricName === undefined
          ? []
          : (history.history[metricName] ?? []).filter(
              (value): value is number => typeof value === "number",
            );

      const metrics: ModelMetrics = {};
      const lossMean = mean(lossValues);
      if (lossMean !== undefined) {
        metrics.loss = lossMean;
      }

      if (metricName !== undefined) {
        const metricMean = mean(metricValues);
        if (metricMean !== undefined) {
          metrics[metricName] = metricMean;
        }
      }

      this.lastMetrics = metrics;
      return metrics;
    } finally {
      xs.dispose();
      ys.dispose();
    }
  }

  public async predict(input: TfjsPredictionInput): Promise<TfjsPredictionOutput> {
    if (this.model === undefined) {
      throw new ModelNotReadyError(
        "TFJS model is not initialized. Train it first or load a saved version.",
      );
    }

    const tf = this.getTf();
    const xs = buildTensor(tf, input.inputs, this.config.inputDType ?? "float32");

    try {
      const prediction = this.model.predict(xs);
      if (Array.isArray(prediction)) {
        throw new UnsupportedOperationError(
          "NeurozAI TFJS adapter currently supports single-output prediction only.",
        );
      }

      const values = (await prediction.array()) as number[][];
      return { values };
    } finally {
      xs.dispose();
    }
  }

  public async save(options: SaveModelOptions): Promise<ModelRecord<TfjsModelConfig>> {
    if (this.model === undefined) {
      throw new ModelNotReadyError(
        "TFJS model is not initialized. Train it first before saving.",
      );
    }

    const paths = await this.store.initializeVersion({
      id: this.id,
      version: options.version,
      backend: "tfjs",
    });

    const tf = this.getTf();

    await this.model.save(
      tf.io.withSaveHandler(async (artifacts) => {
        const artifactPayload: StoredTfjsArtifacts = {
          format: artifacts.format ?? undefined,
          generatedBy: artifacts.generatedBy ?? undefined,
          convertedBy: artifacts.convertedBy ?? undefined,
          modelTopology: artifacts.modelTopology,
          weightSpecs: artifacts.weightSpecs ?? [],
        };

        await this.store.writeJson(
          path.join(paths.artifactDir, TFJS_MODEL_FILE),
          artifactPayload,
        );

        const combinedWeights = combineWeightData(artifacts.weightData);
        if (combinedWeights !== undefined) {
          await this.store.writeBuffer(
            path.join(paths.artifactDir, TFJS_WEIGHTS_FILE),
            combinedWeights,
          );
        }

        return {
          modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifacts),
        };
      }),
    );

    const now = toIsoDate();
    const record: ModelRecord<TfjsModelConfig> = {
      id: this.id,
      version: options.version,
      backend: "tfjs",
      task: this.task,
      status: "trained",
      createdAt: now,
      updatedAt: now,
      tags: this.tags,
      runtime: this.runtime,
      config: this.config,
      metrics: options.metrics ?? this.lastMetrics,
      metadata: options.metadata,
      artifactDir: paths.artifactDir,
      artifactFiles: [TFJS_MODEL_FILE, TFJS_WEIGHTS_FILE],
    };

    await this.registry.saveRecord(record);
    return record;
  }

  public async loadVersion(version: string): Promise<void> {
    await this.ensureRuntime();
    const tf = this.getTf();
    const artifactDir = this.store.resolveArtifactDir(this.id, version);
    const artifacts = await this.store.readJson<StoredTfjsArtifacts>(
      path.join(artifactDir, TFJS_MODEL_FILE),
    );
    const weightBuffer = await this.store.readBuffer(
      path.join(artifactDir, TFJS_WEIGHTS_FILE),
    );

    this.model = await tf.loadLayersModel(
      tf.io.fromMemory({
        modelTopology: artifacts.modelTopology,
        format: artifacts.format,
        generatedBy: artifacts.generatedBy,
        convertedBy: artifacts.convertedBy,
        weightSpecs: artifacts.weightSpecs as never[],
        weightData: resolveArrayBuffer(weightBuffer),
      }),
    );
    this.compileIfNeeded();
  }

  private async ensureRuntime(): Promise<void> {
    if (this.tf !== undefined) {
      return;
    }

    const runtime = await loadTensorFlow();
    this.tf = runtime.tf;
    this.runtime = runtime.runtime;
  }

  private getTf(): TensorFlowModule {
    if (this.tf === undefined) {
      throw new ModelNotReadyError("TensorFlow runtime is not loaded.");
    }

    return this.tf;
  }

  private async ensureModel(): Promise<void> {
    if (this.model !== undefined) {
      return;
    }

    const tf = this.getTf();
    const model = tf.sequential();
    let hasAnyLayer = false;

    for (const layer of this.config.layers) {
      if (layer.type === "dense") {
        const inputShape =
          !hasAnyLayer && layer.inputShape === undefined
            ? this.config.inputShape
            : layer.inputShape;

        const denseConfig: Parameters<TensorFlowModule["layers"]["dense"]>[0] = {
          units: layer.units,
        };

        if (layer.activation !== undefined) {
          denseConfig.activation = layer.activation;
        }

        if (inputShape !== undefined) {
          denseConfig.inputShape = inputShape;
        }

        model.add(tf.layers.dense(denseConfig));
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "embedding") {
        const embeddingConfig: Parameters<TensorFlowModule["layers"]["embedding"]>[0] = {
          inputDim: layer.inputDim,
          outputDim: layer.outputDim,
        };

        if (layer.inputLength !== undefined) {
          embeddingConfig.inputLength = layer.inputLength;
        }

        if (layer.maskZero !== undefined) {
          embeddingConfig.maskZero = layer.maskZero;
        }

        model.add(tf.layers.embedding(embeddingConfig));
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "dropout") {
        model.add(
          tf.layers.dropout({
            rate: layer.rate,
          }),
        );
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "flatten") {
        model.add(tf.layers.flatten({}));
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "globalAveragePooling1d") {
        model.add(tf.layers.globalAveragePooling1d({}));
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "lstm") {
        const lstmConfig: Parameters<TensorFlowModule["layers"]["lstm"]>[0] = {
          units: layer.units,
        };

        if (layer.activation !== undefined) {
          lstmConfig.activation = layer.activation;
        }

        if (layer.recurrentActivation !== undefined) {
          lstmConfig.recurrentActivation = layer.recurrentActivation;
        }

        if (layer.returnSequences !== undefined) {
          lstmConfig.returnSequences = layer.returnSequences;
        }

        model.add(tf.layers.lstm(lstmConfig));
        hasAnyLayer = true;
        continue;
      }

      if (layer.type === "gru") {
        const gruConfig: Parameters<TensorFlowModule["layers"]["gru"]>[0] = {
          units: layer.units,
        };

        if (layer.activation !== undefined) {
          gruConfig.activation = layer.activation;
        }

        if (layer.recurrentActivation !== undefined) {
          gruConfig.recurrentActivation = layer.recurrentActivation;
        }

        if (layer.returnSequences !== undefined) {
          gruConfig.returnSequences = layer.returnSequences;
        }

        model.add(tf.layers.gru(gruConfig));
        hasAnyLayer = true;
        continue;
      }

      throw new ConfigurationError(
        `Unsupported TFJS layer type: ${(layer as { type: string }).type}`,
      );
    }

    this.model = model;
  }

  private compileIfNeeded(): void {
    if (this.model === undefined) {
      return;
    }

    this.model.compile({
      optimizer: buildOptimizer(this.getTf(), this.config.compile),
      loss: this.config.compile?.loss ?? "meanSquaredError",
      metrics: this.config.compile?.metrics ?? ["accuracy"],
    });
  }
}
