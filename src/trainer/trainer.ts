import { NlpModel } from "../backends/nlp/nlp-model.js";
import type { NlpPredictionOutput } from "../backends/nlp/types.js";
import { OnnxModel } from "../backends/onnx/onnx-model.js";
import type { OnnxPredictionOutput } from "../backends/onnx/types.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
import type { TfjsTrainingData } from "../backends/tfjs/types.js";
import { ConfigurationError, UnsupportedOperationError } from "../core/errors.js";
import type { BackendKind, ModelMetrics } from "../core/types.js";
import { Dataset } from "../datasets/dataset.js";

import {
  createIntentAccuracyMetric,
  createOnnxMeanAbsoluteErrorMetric,
  createOnnxMeanSquaredErrorMetric,
  createTfjsBinaryAccuracyMetric,
  createTfjsMeanAbsoluteErrorMetric,
  createTfjsMeanSquaredErrorMetric,
} from "./metrics.js";
import type {
  DatasetLike,
  NlpTrainerSample,
  OnnxTrainerSample,
  TfjsTrainerSample,
  TrainerCallbacks,
  TrainerEvaluateOptions,
  TrainerEvaluationResult,
  TrainerMetric,
  TrainerPredictOptions,
  TrainerPredictionResult,
  TrainerRunContext,
  TrainerRunResult,
  TfjsTrainerFitOptions,
} from "./types.js";

type TrainerModel = TfjsModel | NlpModel | OnnxModel;

function materialize<T>(dataset: DatasetLike<T>): T[] {
  return dataset instanceof Dataset ? dataset.toArray() : Array.from(dataset);
}

function createContext<TModel>(
  model: TModel,
  backend: BackendKind,
  sampleCount: number,
): TrainerRunContext<TModel> {
  return {
    model,
    backend,
    sampleCount,
    startedAt: new Date().toISOString(),
  };
}

async function emit<T>(callback: ((payload: T) => void | Promise<void>) | undefined, payload: T) {
  if (callback !== undefined) {
    await callback(payload);
  }
}

async function computeMetrics<TSample, TPrediction>(
  samples: readonly TSample[],
  predictions: readonly TPrediction[],
  metrics: readonly TrainerMetric<TSample, TPrediction>[],
): Promise<ModelMetrics> {
  const output: ModelMetrics = {};

  for (const metric of metrics) {
    output[metric.name] = await metric.compute(samples, predictions);
  }

  return output;
}

function isBinaryLabels(samples: readonly TfjsTrainerSample[]): boolean {
  return samples.every((sample) => {
    const value = Array.isArray(sample.label) ? sample.label[0] : sample.label;
    return value === 0 || value === 1;
  });
}

export class Trainer {
  public async fit(
    model: TfjsModel,
    dataset: DatasetLike<TfjsTrainerSample>,
    options?: TfjsTrainerFitOptions,
  ): Promise<TrainerRunResult>;
  public async fit(
    model: NlpModel,
    dataset: DatasetLike<NlpTrainerSample>,
    options?: {
      callbacks?: TrainerCallbacks<NlpModel, NlpPredictionOutput> | undefined;
    },
  ): Promise<TrainerRunResult>;
  public async fit(
    model: OnnxModel,
    dataset: DatasetLike<OnnxTrainerSample>,
  ): Promise<never>;
  public async fit(
    model: TrainerModel,
    dataset: DatasetLike<TfjsTrainerSample | NlpTrainerSample | OnnxTrainerSample>,
    options:
      | TfjsTrainerFitOptions
      | {
          callbacks?: TrainerCallbacks<NlpModel, NlpPredictionOutput> | undefined;
        }
      | undefined = undefined,
  ): Promise<TrainerRunResult> {
    if (model instanceof TfjsModel) {
      return this.fitTfjs(
        model,
        materialize(dataset as DatasetLike<TfjsTrainerSample>),
        options as TfjsTrainerFitOptions | undefined,
      );
    }

    if (model instanceof NlpModel) {
      return this.fitNlp(
        model,
        materialize(dataset as DatasetLike<NlpTrainerSample>),
        options as { callbacks?: TrainerCallbacks<NlpModel, NlpPredictionOutput> | undefined },
      );
    }

    throw new UnsupportedOperationError(
      "NeurozAI trainer does not support fitting ONNX models. Use TFJS or NLP backends for training.",
    );
  }

  public async predict(
    model: TfjsModel,
    dataset: DatasetLike<Pick<TfjsTrainerSample, "input">>,
    options?: TrainerPredictOptions<TfjsModel, number[]>,
  ): Promise<TrainerPredictionResult<number[]>>;
  public async predict(
    model: NlpModel,
    dataset: DatasetLike<Pick<NlpTrainerSample, "language" | "utterance">>,
    options?: TrainerPredictOptions<NlpModel, NlpPredictionOutput>,
  ): Promise<TrainerPredictionResult<NlpPredictionOutput>>;
  public async predict(
    model: OnnxModel,
    dataset: DatasetLike<OnnxTrainerSample>,
    options?: TrainerPredictOptions<OnnxModel, OnnxPredictionOutput>,
  ): Promise<TrainerPredictionResult<OnnxPredictionOutput>>;
  public async predict(
    model: TrainerModel,
    dataset:
      | DatasetLike<Pick<TfjsTrainerSample, "input">>
      | DatasetLike<Pick<NlpTrainerSample, "language" | "utterance">>
      | DatasetLike<OnnxTrainerSample>,
    options:
      | TrainerPredictOptions<TfjsModel, number[]>
      | TrainerPredictOptions<NlpModel, NlpPredictionOutput>
      | TrainerPredictOptions<OnnxModel, OnnxPredictionOutput>
      | undefined = undefined,
  ): Promise<
    | TrainerPredictionResult<number[]>
    | TrainerPredictionResult<NlpPredictionOutput>
    | TrainerPredictionResult<OnnxPredictionOutput>
  > {
    if (model instanceof TfjsModel) {
      const samples = materialize(dataset as DatasetLike<Pick<TfjsTrainerSample, "input">>);
      return this.predictTfjs(
        model,
        samples,
        options as TrainerPredictOptions<TfjsModel, number[]> | undefined,
      );
    }

    if (model instanceof NlpModel) {
      const samples = materialize(
        dataset as DatasetLike<Pick<NlpTrainerSample, "language" | "utterance">>,
      );
      return this.predictNlp(
        model,
        samples,
        options as TrainerPredictOptions<NlpModel, NlpPredictionOutput> | undefined,
      );
    }

    const samples = materialize(dataset as DatasetLike<OnnxTrainerSample>);
    return this.predictOnnx(
      model,
      samples,
      options as TrainerPredictOptions<OnnxModel, OnnxPredictionOutput> | undefined,
    );
  }

  public async evaluate(
    model: TfjsModel,
    dataset: DatasetLike<TfjsTrainerSample>,
    options?: TrainerEvaluateOptions<TfjsModel, TfjsTrainerSample, number[]>,
  ): Promise<TrainerEvaluationResult<number[]>>;
  public async evaluate(
    model: NlpModel,
    dataset: DatasetLike<NlpTrainerSample>,
    options?: TrainerEvaluateOptions<NlpModel, NlpTrainerSample, NlpPredictionOutput>,
  ): Promise<TrainerEvaluationResult<NlpPredictionOutput>>;
  public async evaluate(
    model: OnnxModel,
    dataset: DatasetLike<OnnxTrainerSample>,
    options?: TrainerEvaluateOptions<OnnxModel, OnnxTrainerSample, OnnxPredictionOutput>,
  ): Promise<TrainerEvaluationResult<OnnxPredictionOutput>>;
  public async evaluate(
    model: TrainerModel,
    dataset: DatasetLike<TfjsTrainerSample | NlpTrainerSample | OnnxTrainerSample>,
    options:
      | TrainerEvaluateOptions<TfjsModel, TfjsTrainerSample, number[]>
      | TrainerEvaluateOptions<NlpModel, NlpTrainerSample, NlpPredictionOutput>
      | TrainerEvaluateOptions<OnnxModel, OnnxTrainerSample, OnnxPredictionOutput>
      | undefined = undefined,
  ): Promise<
    | TrainerEvaluationResult<number[]>
    | TrainerEvaluationResult<NlpPredictionOutput>
    | TrainerEvaluationResult<OnnxPredictionOutput>
  > {
    if (model instanceof TfjsModel) {
      return this.evaluateTfjs(
        model,
        materialize(dataset as DatasetLike<TfjsTrainerSample>),
        options as TrainerEvaluateOptions<TfjsModel, TfjsTrainerSample, number[]> | undefined,
      );
    }

    if (model instanceof NlpModel) {
      return this.evaluateNlp(
        model,
        materialize(dataset as DatasetLike<NlpTrainerSample>),
        options as
          | TrainerEvaluateOptions<NlpModel, NlpTrainerSample, NlpPredictionOutput>
          | undefined,
      );
    }

    return this.evaluateOnnx(
      model,
      materialize(dataset as DatasetLike<OnnxTrainerSample>),
      options as
        | TrainerEvaluateOptions<OnnxModel, OnnxTrainerSample, OnnxPredictionOutput>
        | undefined,
    );
  }

  private async fitTfjs(
    model: TfjsModel,
    samples: readonly TfjsTrainerSample[],
    options: TfjsTrainerFitOptions | undefined,
  ): Promise<TrainerRunResult> {
    if (samples.length === 0) {
      throw new ConfigurationError("Cannot train a TFJS model with an empty dataset.");
    }

    const context = createContext(model, "tfjs", samples.length);
    await emit(options?.callbacks?.onFitStart, context);

    const startedAt = Date.now();
    const trainingData: TfjsTrainingData = {
      inputs: samples.map((sample) => sample.input),
      labels: samples.map((sample) =>
        Array.isArray(sample.label) ? sample.label : [sample.label],
      ),
    };

    if (options?.fit !== undefined) {
      trainingData.fit = options.fit;
    }

    const metrics = await model.train(trainingData);

    const result: TrainerRunResult = {
      backend: "tfjs",
      sampleCount: samples.length,
      durationMs: Date.now() - startedAt,
      metrics,
    };

    await emit(options?.callbacks?.onFitEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async fitNlp(
    model: NlpModel,
    samples: readonly NlpTrainerSample[],
    options: { callbacks?: TrainerCallbacks<NlpModel, NlpPredictionOutput> | undefined } = {},
  ): Promise<TrainerRunResult> {
    if (samples.length === 0) {
      throw new ConfigurationError("Cannot train an NLP model with an empty dataset.");
    }

    const context = createContext(model, "nlp", samples.length);
    await emit(options.callbacks?.onFitStart, context);

    const startedAt = Date.now();
    await model.train({
      documents: samples.map((sample) => ({
        language: sample.language,
        utterance: sample.utterance,
        intent: sample.intent,
      })),
      answers: samples
        .filter((sample) => sample.answer !== undefined)
        .map((sample) => ({
          language: sample.language,
          intent: sample.intent,
          answer: sample.answer!,
        })),
    });

    const result: TrainerRunResult = {
      backend: "nlp",
      sampleCount: samples.length,
      durationMs: Date.now() - startedAt,
      metrics: {
        documentCount: samples.length,
        intentCount: new Set(samples.map((sample) => sample.intent)).size,
      },
    };

    await emit(options.callbacks?.onFitEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async predictTfjs(
    model: TfjsModel,
    samples: readonly Pick<TfjsTrainerSample, "input">[],
    options: TrainerPredictOptions<TfjsModel, number[]> | undefined,
  ): Promise<TrainerPredictionResult<number[]>> {
    const context = createContext(model, "tfjs", samples.length);
    await emit(options?.callbacks?.onPredictStart, context);

    const startedAt = Date.now();
    const predictions: number[][] = [];

    for (const sample of samples) {
      const prediction = await model.predict({ inputs: [sample.input] });
      predictions.push(prediction.values[0] ?? []);
    }

    const result: TrainerPredictionResult<number[]> = {
      backend: "tfjs",
      sampleCount: samples.length,
      durationMs: Date.now() - startedAt,
      predictions,
    };

    await emit(options?.callbacks?.onPredictEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async predictNlp(
    model: NlpModel,
    samples: readonly Pick<NlpTrainerSample, "language" | "utterance">[],
    options: TrainerPredictOptions<NlpModel, NlpPredictionOutput> | undefined,
  ): Promise<TrainerPredictionResult<NlpPredictionOutput>> {
    const context = createContext(model, "nlp", samples.length);
    await emit(options?.callbacks?.onPredictStart, context);

    const startedAt = Date.now();
    const predictions: NlpPredictionOutput[] = [];

    for (const sample of samples) {
      predictions.push(
        await model.predict({
          language: sample.language,
          utterance: sample.utterance,
        }),
      );
    }

    const result: TrainerPredictionResult<NlpPredictionOutput> = {
      backend: "nlp",
      sampleCount: samples.length,
      durationMs: Date.now() - startedAt,
      predictions,
    };

    await emit(options?.callbacks?.onPredictEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async predictOnnx(
    model: OnnxModel,
    samples: readonly OnnxTrainerSample[],
    options: TrainerPredictOptions<OnnxModel, OnnxPredictionOutput> | undefined,
  ): Promise<TrainerPredictionResult<OnnxPredictionOutput>> {
    const context = createContext(model, "onnx", samples.length);
    await emit(options?.callbacks?.onPredictStart, context);

    const startedAt = Date.now();
    const predictions: OnnxPredictionOutput[] = [];

    for (const sample of samples) {
      predictions.push(
        await model.predict({
          feeds: sample.feeds,
        }),
      );
    }

    const result: TrainerPredictionResult<OnnxPredictionOutput> = {
      backend: "onnx",
      sampleCount: samples.length,
      durationMs: Date.now() - startedAt,
      predictions,
    };

    await emit(options?.callbacks?.onPredictEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async evaluateTfjs(
    model: TfjsModel,
    samples: readonly TfjsTrainerSample[],
    options: TrainerEvaluateOptions<TfjsModel, TfjsTrainerSample, number[]> | undefined,
  ): Promise<TrainerEvaluationResult<number[]>> {
    const context = createContext(model, "tfjs", samples.length);
    await emit(options?.callbacks?.onEvaluateStart, context);

    const startedAt = Date.now();
    const predictionResult = await this.predictTfjs(model, samples, undefined);
    const defaultMetrics = [
      createTfjsMeanSquaredErrorMetric(),
      createTfjsMeanAbsoluteErrorMetric(),
      ...(isBinaryLabels(samples) ? [createTfjsBinaryAccuracyMetric()] : []),
    ];

    const metrics = await computeMetrics(
      samples,
      predictionResult.predictions,
      options?.metrics ?? defaultMetrics,
    );

    const result: TrainerEvaluationResult<number[]> = {
      ...predictionResult,
      durationMs: Date.now() - startedAt,
      metrics,
    };

    await emit(options?.callbacks?.onEvaluateEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async evaluateNlp(
    model: NlpModel,
    samples: readonly NlpTrainerSample[],
    options:
      | TrainerEvaluateOptions<NlpModel, NlpTrainerSample, NlpPredictionOutput>
      | undefined,
  ): Promise<TrainerEvaluationResult<NlpPredictionOutput>> {
    const context = createContext(model, "nlp", samples.length);
    await emit(options?.callbacks?.onEvaluateStart, context);

    const startedAt = Date.now();
    const predictionResult = await this.predictNlp(model, samples, undefined);
    const metrics = await computeMetrics(
      samples,
      predictionResult.predictions,
      options?.metrics ?? [createIntentAccuracyMetric()],
    );

    const result: TrainerEvaluationResult<NlpPredictionOutput> = {
      ...predictionResult,
      durationMs: Date.now() - startedAt,
      metrics,
    };

    await emit(options?.callbacks?.onEvaluateEnd, {
      ...context,
      result,
    });

    return result;
  }

  private async evaluateOnnx(
    model: OnnxModel,
    samples: readonly OnnxTrainerSample[],
    options:
      | TrainerEvaluateOptions<OnnxModel, OnnxTrainerSample, OnnxPredictionOutput>
      | undefined,
  ): Promise<TrainerEvaluationResult<OnnxPredictionOutput>> {
    const context = createContext(model, "onnx", samples.length);
    await emit(options?.callbacks?.onEvaluateStart, context);

    const startedAt = Date.now();
    const predictionResult = await this.predictOnnx(model, samples, undefined);
    const defaultMetrics = samples.some((sample) => sample.expectedOutputs !== undefined)
      ? [createOnnxMeanSquaredErrorMetric(), createOnnxMeanAbsoluteErrorMetric()]
      : [];
    const metrics = await computeMetrics(
      samples,
      predictionResult.predictions,
      options?.metrics ?? defaultMetrics,
    );

    const result: TrainerEvaluationResult<OnnxPredictionOutput> = {
      ...predictionResult,
      durationMs: Date.now() - startedAt,
      metrics,
    };

    await emit(options?.callbacks?.onEvaluateEnd, {
      ...context,
      result,
    });

    return result;
  }
}
