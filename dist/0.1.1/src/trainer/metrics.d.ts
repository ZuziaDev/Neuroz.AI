import type { NlpPredictionOutput } from "../backends/nlp/types.js";
import type { OnnxPredictionOutput } from "../backends/onnx/types.js";
import type { NlpTrainerSample, OnnxTrainerSample, TrainerMetric, TfjsTrainerSample } from "./types.js";
export declare function createAccuracyMetric<TSample, TPrediction>(options: {
    name?: string | undefined;
    expected: (sample: TSample) => string | number | boolean;
    predicted: (prediction: TPrediction, sample: TSample) => string | number | boolean;
}): TrainerMetric<TSample, TPrediction>;
export declare function createBinaryAccuracyMetric<TSample, TPrediction>(options: {
    name?: string | undefined;
    threshold?: number | undefined;
    expected: (sample: TSample) => number;
    score: (prediction: TPrediction, sample: TSample) => number;
}): TrainerMetric<TSample, TPrediction>;
export declare function createMeanSquaredErrorMetric<TSample, TPrediction>(options: {
    name?: string | undefined;
    expected: (sample: TSample) => number[];
    predicted: (prediction: TPrediction, sample: TSample) => number[];
}): TrainerMetric<TSample, TPrediction>;
export declare function createMeanAbsoluteErrorMetric<TSample, TPrediction>(options: {
    name?: string | undefined;
    expected: (sample: TSample) => number[];
    predicted: (prediction: TPrediction, sample: TSample) => number[];
}): TrainerMetric<TSample, TPrediction>;
export declare function createTfjsMeanSquaredErrorMetric(): TrainerMetric<TfjsTrainerSample, number[]>;
export declare function createTfjsMeanAbsoluteErrorMetric(): TrainerMetric<TfjsTrainerSample, number[]>;
export declare function createTfjsBinaryAccuracyMetric(): TrainerMetric<TfjsTrainerSample, number[]>;
export declare function createIntentAccuracyMetric(): TrainerMetric<NlpTrainerSample, NlpPredictionOutput>;
export declare function createOnnxMeanSquaredErrorMetric(): TrainerMetric<OnnxTrainerSample, OnnxPredictionOutput>;
export declare function createOnnxMeanAbsoluteErrorMetric(): TrainerMetric<OnnxTrainerSample, OnnxPredictionOutput>;
