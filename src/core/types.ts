export type BackendKind = "tfjs" | "nlp" | "onnx";

export type ModelStatus = "draft" | "trained" | "ready";

export interface ModelMetrics {
  [metricName: string]: number;
}

export interface ModelRecord<TConfig = unknown> {
  id: string;
  version: string;
  backend: BackendKind;
  task: string;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  runtime: string;
  config: TConfig;
  metrics?: ModelMetrics | undefined;
  metadata?: Record<string, unknown> | undefined;
  artifactDir: string;
  artifactFiles: string[];
}

export interface CreateModelOptions<TConfig> {
  id: string;
  task: string;
  config: TConfig;
  tags?: string[];
}

export interface SaveModelOptions {
  version: string;
  metrics?: ModelMetrics | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface LoadModelOptions {
  id: string;
  version: string;
}
