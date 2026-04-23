import { NlpModel } from "../backends/nlp/nlp-model.js";
import { TfjsModel } from "../backends/tfjs/tfjs-model.js";
import { ConfigurationError, UnsupportedOperationError } from "../core/errors.js";
import { Dataset } from "../datasets/dataset.js";
import { createIntentAccuracyMetric, createOnnxMeanAbsoluteErrorMetric, createOnnxMeanSquaredErrorMetric, createTfjsBinaryAccuracyMetric, createTfjsMeanAbsoluteErrorMetric, createTfjsMeanSquaredErrorMetric, } from "./metrics.js";
function materialize(dataset) {
    return dataset instanceof Dataset ? dataset.toArray() : Array.from(dataset);
}
function createContext(model, backend, sampleCount) {
    return {
        model,
        backend,
        sampleCount,
        startedAt: new Date().toISOString(),
    };
}
async function emit(callback, payload) {
    if (callback !== undefined) {
        await callback(payload);
    }
}
async function computeMetrics(samples, predictions, metrics) {
    const output = {};
    for (const metric of metrics) {
        output[metric.name] = await metric.compute(samples, predictions);
    }
    return output;
}
function isBinaryLabels(samples) {
    return samples.every((sample) => {
        const value = Array.isArray(sample.label) ? sample.label[0] : sample.label;
        return value === 0 || value === 1;
    });
}
export class Trainer {
    async fit(model, dataset, options = undefined) {
        if (model instanceof TfjsModel) {
            return this.fitTfjs(model, materialize(dataset), options);
        }
        if (model instanceof NlpModel) {
            return this.fitNlp(model, materialize(dataset), options);
        }
        throw new UnsupportedOperationError("NeurozAI trainer does not support fitting ONNX models. Use TFJS or NLP backends for training.");
    }
    async predict(model, dataset, options = undefined) {
        if (model instanceof TfjsModel) {
            const samples = materialize(dataset);
            return this.predictTfjs(model, samples, options);
        }
        if (model instanceof NlpModel) {
            const samples = materialize(dataset);
            return this.predictNlp(model, samples, options);
        }
        const samples = materialize(dataset);
        return this.predictOnnx(model, samples, options);
    }
    async evaluate(model, dataset, options = undefined) {
        if (model instanceof TfjsModel) {
            return this.evaluateTfjs(model, materialize(dataset), options);
        }
        if (model instanceof NlpModel) {
            return this.evaluateNlp(model, materialize(dataset), options);
        }
        return this.evaluateOnnx(model, materialize(dataset), options);
    }
    async fitTfjs(model, samples, options) {
        if (samples.length === 0) {
            throw new ConfigurationError("Cannot train a TFJS model with an empty dataset.");
        }
        const context = createContext(model, "tfjs", samples.length);
        await emit(options?.callbacks?.onFitStart, context);
        const startedAt = Date.now();
        const trainingData = {
            inputs: samples.map((sample) => sample.input),
            labels: samples.map((sample) => Array.isArray(sample.label) ? sample.label : [sample.label]),
        };
        if (options?.fit !== undefined) {
            trainingData.fit = options.fit;
        }
        const metrics = await model.train(trainingData);
        const result = {
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
    async fitNlp(model, samples, options = {}) {
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
                answer: sample.answer,
            })),
        });
        const result = {
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
    async predictTfjs(model, samples, options) {
        const context = createContext(model, "tfjs", samples.length);
        await emit(options?.callbacks?.onPredictStart, context);
        const startedAt = Date.now();
        const predictions = [];
        for (const sample of samples) {
            const prediction = await model.predict({ inputs: [sample.input] });
            predictions.push(prediction.values[0] ?? []);
        }
        const result = {
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
    async predictNlp(model, samples, options) {
        const context = createContext(model, "nlp", samples.length);
        await emit(options?.callbacks?.onPredictStart, context);
        const startedAt = Date.now();
        const predictions = [];
        for (const sample of samples) {
            predictions.push(await model.predict({
                language: sample.language,
                utterance: sample.utterance,
            }));
        }
        const result = {
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
    async predictOnnx(model, samples, options) {
        const context = createContext(model, "onnx", samples.length);
        await emit(options?.callbacks?.onPredictStart, context);
        const startedAt = Date.now();
        const predictions = [];
        for (const sample of samples) {
            predictions.push(await model.predict({
                feeds: sample.feeds,
            }));
        }
        const result = {
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
    async evaluateTfjs(model, samples, options) {
        const context = createContext(model, "tfjs", samples.length);
        await emit(options?.callbacks?.onEvaluateStart, context);
        const startedAt = Date.now();
        const predictionResult = await this.predictTfjs(model, samples, undefined);
        const defaultMetrics = [
            createTfjsMeanSquaredErrorMetric(),
            createTfjsMeanAbsoluteErrorMetric(),
            ...(isBinaryLabels(samples) ? [createTfjsBinaryAccuracyMetric()] : []),
        ];
        const metrics = await computeMetrics(samples, predictionResult.predictions, options?.metrics ?? defaultMetrics);
        const result = {
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
    async evaluateNlp(model, samples, options) {
        const context = createContext(model, "nlp", samples.length);
        await emit(options?.callbacks?.onEvaluateStart, context);
        const startedAt = Date.now();
        const predictionResult = await this.predictNlp(model, samples, undefined);
        const metrics = await computeMetrics(samples, predictionResult.predictions, options?.metrics ?? [createIntentAccuracyMetric()]);
        const result = {
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
    async evaluateOnnx(model, samples, options) {
        const context = createContext(model, "onnx", samples.length);
        await emit(options?.callbacks?.onEvaluateStart, context);
        const startedAt = Date.now();
        const predictionResult = await this.predictOnnx(model, samples, undefined);
        const defaultMetrics = samples.some((sample) => sample.expectedOutputs !== undefined)
            ? [createOnnxMeanSquaredErrorMetric(), createOnnxMeanAbsoluteErrorMetric()]
            : [];
        const metrics = await computeMetrics(samples, predictionResult.predictions, options?.metrics ?? defaultMetrics);
        const result = {
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
//# sourceMappingURL=trainer.js.map