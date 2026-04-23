import type { CreateModelOptions } from "../../core/types.js";

export interface OnnxModelConfig {
  sourcePath: string;
  executionProviders?: string[] | undefined;
}

export interface CreateOnnxModelOptions extends CreateModelOptions<OnnxModelConfig> {}

export interface OnnxTensorInput {
  type: "float32" | "float64" | "int32" | "int64" | "bool";
  data: number[] | bigint[] | Float32Array | Float64Array | Int32Array | BigInt64Array | Uint8Array;
  dims: number[];
}

export interface OnnxPredictionInput {
  feeds: Record<string, OnnxTensorInput>;
}

export interface OnnxPredictionTensor {
  type: string;
  dims: number[];
  data: Array<number | bigint | boolean>;
}

export interface OnnxPredictionOutput {
  outputs: Record<string, OnnxPredictionTensor>;
}
