import type { NlpPredictionOutput } from "../backends/nlp/types.js";
import type { OnnxPredictionInput, OnnxPredictionOutput } from "../backends/onnx/types.js";
import type { BackendKind, ModelMetrics } from "../core/types.js";
import type { Dataset } from "../datasets/dataset.js";
import type { TfjsTrainingData } from "../backends/tfjs/types.js";
export interface TfjsTrainerSample {
    input: number[];
    label: number | number[];
}
export interface NlpTrainerSample {
    language: string;
    utterance: string;
    intent: string;
    answer?: string | undefined;
}
export interface OnnxExpectedTensor {
    type: string;
    dims: number[];
    data: Array<number | bigint | boolean>;
}
export interface OnnxTrainerSample {
    feeds: OnnxPredictionInput["feeds"];
    expectedOutputs?: Record<string, OnnxExpectedTensor> | undefined;
}
export type DatasetLike<T> = Dataset<T> | Iterable<T>;
export interface TrainerRunContext<TModel> {
    model: TModel;
    backend: BackendKind;
    sampleCount: number;
    startedAt: string;
}
export interface TrainerRunResult {
    backend: BackendKind;
    sampleCount: number;
    durationMs: number;
    metrics: ModelMetrics;
}
export interface TrainerPredictionResult<TPrediction = unknown> {
    backend: BackendKind;
    sampleCount: number;
    durationMs: number;
    predictions: TPrediction[];
}
export interface TrainerEvaluationResult<TPrediction = unknown> extends TrainerPredictionResult<TPrediction> {
    metrics: ModelMetrics;
}
export interface TrainerMetric<TSample, TPrediction> {
    name: string;
    compute(samples: readonly TSample[], predictions: readonly TPrediction[]): number | Promise<number>;
}
export interface TrainerCallbacks<TModel = unknown, TPrediction = unknown, TResult extends TrainerRunResult = TrainerRunResult> {
    onFitStart?: (context: TrainerRunContext<TModel>) => void | Promise<void>;
    onFitEnd?: (context: TrainerRunContext<TModel> & {
        result: TResult;
    }) => void | Promise<void>;
    onEvaluateStart?: (context: TrainerRunContext<TModel>) => void | Promise<void>;
    onEvaluateEnd?: (context: TrainerRunContext<TModel> & {
        result: TrainerEvaluationResult<TPrediction>;
    }) => void | Promise<void>;
    onPredictStart?: (context: TrainerRunContext<TModel>) => void | Promise<void>;
    onPredictEnd?: (context: TrainerRunContext<TModel> & {
        result: TrainerPredictionResult<TPrediction>;
    }) => void | Promise<void>;
}
export interface TfjsTrainerFitOptions {
    fit?: TfjsTrainingData["fit"] | undefined;
    callbacks?: TrainerCallbacks<unknown, number[]> | undefined;
}
export interface TrainerEvaluateOptions<TModel, TSample, TPrediction> {
    metrics?: Array<TrainerMetric<TSample, TPrediction>> | undefined;
    callbacks?: TrainerCallbacks<TModel, TPrediction> | undefined;
}
export interface TrainerPredictOptions<TModel, TPrediction> {
    callbacks?: TrainerCallbacks<TModel, TPrediction> | undefined;
}
export type NlpTrainerPrediction = NlpPredictionOutput;
export type OnnxTrainerPrediction = OnnxPredictionOutput;
