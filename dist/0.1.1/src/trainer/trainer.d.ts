import { NlpModel } from "../backends/nlp/nlp-model.js";
import type { NlpPredictionOutput } from "../backends/nlp/types.js";
import { OnnxModel } from "../backends/onnx/onnx-model.js";
import type { OnnxPredictionOutput } from "../backends/onnx/types.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
import type { DatasetLike, NlpTrainerSample, OnnxTrainerSample, TfjsTrainerSample, TrainerCallbacks, TrainerEvaluateOptions, TrainerEvaluationResult, TrainerPredictOptions, TrainerPredictionResult, TrainerRunResult, TfjsTrainerFitOptions } from "./types.js";
export declare class Trainer {
    fit(model: TfjsModel, dataset: DatasetLike<TfjsTrainerSample>, options?: TfjsTrainerFitOptions): Promise<TrainerRunResult>;
    fit(model: NlpModel, dataset: DatasetLike<NlpTrainerSample>, options?: {
        callbacks?: TrainerCallbacks<NlpModel, NlpPredictionOutput> | undefined;
    }): Promise<TrainerRunResult>;
    fit(model: OnnxModel, dataset: DatasetLike<OnnxTrainerSample>): Promise<never>;
    predict(model: TfjsModel, dataset: DatasetLike<Pick<TfjsTrainerSample, "input">>, options?: TrainerPredictOptions<TfjsModel, number[]>): Promise<TrainerPredictionResult<number[]>>;
    predict(model: NlpModel, dataset: DatasetLike<Pick<NlpTrainerSample, "language" | "utterance">>, options?: TrainerPredictOptions<NlpModel, NlpPredictionOutput>): Promise<TrainerPredictionResult<NlpPredictionOutput>>;
    predict(model: OnnxModel, dataset: DatasetLike<OnnxTrainerSample>, options?: TrainerPredictOptions<OnnxModel, OnnxPredictionOutput>): Promise<TrainerPredictionResult<OnnxPredictionOutput>>;
    evaluate(model: TfjsModel, dataset: DatasetLike<TfjsTrainerSample>, options?: TrainerEvaluateOptions<TfjsModel, TfjsTrainerSample, number[]>): Promise<TrainerEvaluationResult<number[]>>;
    evaluate(model: NlpModel, dataset: DatasetLike<NlpTrainerSample>, options?: TrainerEvaluateOptions<NlpModel, NlpTrainerSample, NlpPredictionOutput>): Promise<TrainerEvaluationResult<NlpPredictionOutput>>;
    evaluate(model: OnnxModel, dataset: DatasetLike<OnnxTrainerSample>, options?: TrainerEvaluateOptions<OnnxModel, OnnxTrainerSample, OnnxPredictionOutput>): Promise<TrainerEvaluationResult<OnnxPredictionOutput>>;
    private fitTfjs;
    private fitNlp;
    private predictTfjs;
    private predictNlp;
    private predictOnnx;
    private evaluateTfjs;
    private evaluateNlp;
    private evaluateOnnx;
}
