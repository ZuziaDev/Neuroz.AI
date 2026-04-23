import path from "node:path";

import {
  RuntimeDependencyError,
  UnsupportedOperationError,
} from "../../core/errors.js";
import type { ModelRecord, SaveModelOptions } from "../../core/types.js";
import { toAbsolutePath, toIsoDate } from "../../core/utils.js";
import { ModelRegistry } from "../../registry/model-registry.js";
import { ArtifactStore } from "../../storage/artifact-store.js";

import type {
  CreateOnnxModelOptions,
  OnnxModelConfig,
  OnnxPredictionInput,
  OnnxPredictionOutput,
  OnnxPredictionTensor,
  OnnxTensorInput,
} from "./types.js";

const ONNX_MODEL_FILE = "model.onnx";

type OrtTensorLike = {
  type: string;
  dims: readonly number[];
  data: ArrayLike<number | bigint | boolean>;
};

type OrtModuleLike = {
  InferenceSession: {
    create(
      modelPath: string,
      options?: Record<string, unknown>,
    ): Promise<{
      inputNames: readonly string[];
      outputNames: readonly string[];
      run(
        feeds: Record<string, unknown>,
      ): Promise<Record<string, OrtTensorLike>>;
    }>;
  };
  Tensor: new (
    type: string,
    data: OnnxTensorInput["data"],
    dims: number[],
  ) => unknown;
};

async function loadOrt(): Promise<OrtModuleLike> {
  try {
    const ortModule = await import("onnxruntime-node");
    return (ortModule.default ?? ortModule) as unknown as OrtModuleLike;
  } catch (error) {
    throw new RuntimeDependencyError(
      "Failed to load onnxruntime-node. Install the optional dependency to use ONNX models.",
      { cause: error },
    );
  }
}

function normalizeOrtTensor(tensor: OrtTensorLike): OnnxPredictionTensor {
  return {
    type: tensor.type,
    dims: [...tensor.dims],
    data: Array.from(tensor.data),
  };
}

export class OnnxModel {
  public readonly id: string;
  public readonly task: string;
  public readonly config: OnnxModelConfig;
  public readonly tags: string[];

  private ort?: OrtModuleLike;
  private session?: Awaited<ReturnType<OrtModuleLike["InferenceSession"]["create"]>>;
  private activeVersion?: string;

  public constructor(
    private readonly store: ArtifactStore,
    private readonly registry: ModelRegistry,
    options: CreateOnnxModelOptions,
  ) {
    this.id = options.id;
    this.task = options.task;
    this.config = options.config;
    this.tags = options.tags ?? [];
  }

  public static async load(
    store: ArtifactStore,
    registry: ModelRegistry,
    record: ModelRecord<OnnxModelConfig>,
  ): Promise<OnnxModel> {
    const model = new OnnxModel(store, registry, {
      id: record.id,
      task: record.task,
      config: record.config,
      tags: record.tags,
    });

    await model.loadVersion(record.version);
    return model;
  }

  public async save(options: SaveModelOptions): Promise<ModelRecord<OnnxModelConfig>> {
    const paths = await this.store.initializeVersion({
      id: this.id,
      version: options.version,
      backend: "onnx",
    });
    const sourcePath = toAbsolutePath(process.cwd(), this.config.sourcePath);
    await this.store.copyIntoArtifacts(sourcePath, this.id, options.version, ONNX_MODEL_FILE);
    await this.loadVersion(options.version);

    const now = toIsoDate();
    const record: ModelRecord<OnnxModelConfig> = {
      id: this.id,
      version: options.version,
      backend: "onnx",
      task: this.task,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      tags: this.tags,
      runtime: "onnxruntime-node",
      config: this.config,
      metrics: options.metrics,
      metadata: {
        inputNames: this.session?.inputNames ?? [],
        outputNames: this.session?.outputNames ?? [],
        ...(options.metadata ?? {}),
      },
      artifactDir: paths.artifactDir,
      artifactFiles: [ONNX_MODEL_FILE],
    };

    await this.registry.saveRecord(record);
    return record;
  }

  public async loadVersion(version: string): Promise<void> {
    const ort = await this.ensureOrt();
    const modelPath = path.join(this.store.resolveArtifactDir(this.id, version), ONNX_MODEL_FILE);
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: this.config.executionProviders,
    });
    this.activeVersion = version;
  }

  public async predict(input: OnnxPredictionInput): Promise<OnnxPredictionOutput> {
    if (this.session === undefined) {
      throw new RuntimeDependencyError(
        "ONNX session is not initialized. Import or load a saved version first.",
      );
    }

    const ort = await this.ensureOrt();
    const feeds = Object.fromEntries(
      Object.entries(input.feeds).map(([name, tensor]) => [
        name,
        new ort.Tensor(tensor.type, tensor.data, tensor.dims),
      ]),
    );

    const output = await this.session.run(feeds);
    return {
      outputs: Object.fromEntries(
        Object.entries(output).map(([name, tensor]) => [name, normalizeOrtTensor(tensor)]),
      ),
    };
  }

  public async train(): Promise<never> {
    throw new UnsupportedOperationError(
      "onnxruntime-node is used by NeurozAI as an inference/runtime backend, not a training backend.",
    );
  }

  public get version(): string | undefined {
    return this.activeVersion;
  }

  private async ensureOrt(): Promise<OrtModuleLike> {
    if (this.ort !== undefined) {
      return this.ort;
    }

    this.ort = await loadOrt();
    return this.ort;
  }
}
