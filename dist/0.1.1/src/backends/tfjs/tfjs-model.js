import path from "node:path";
import { ConfigurationError, ModelNotReadyError, UnsupportedOperationError, } from "../../core/errors.js";
import { ensureNumberArray, mean, resolveArrayBuffer, toIsoDate } from "../../core/utils.js";
import { loadTensorFlow } from "./tfjs-module.js";
const TFJS_MODEL_FILE = "model-artifacts.json";
const TFJS_WEIGHTS_FILE = "weights.bin";
function buildOptimizer(tf, compile) {
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
function buildTensor(tf, values, dtype = "float32") {
    const matrix = ensureNumberArray(values);
    const rows = matrix.length;
    const columns = matrix[0]?.length ?? 1;
    return tf.tensor2d(matrix.flat(), [rows, columns], dtype);
}
function combineWeightData(weightData) {
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
    store;
    registry;
    id;
    task;
    config;
    tags;
    model;
    runtime = "tfjs";
    tf;
    lastMetrics;
    constructor(store, registry, options) {
        this.store = store;
        this.registry = registry;
        this.id = options.id;
        this.task = options.task;
        this.config = options.config;
        this.tags = options.tags ?? [];
    }
    static async load(store, registry, record) {
        const model = new TfjsModel(store, registry, {
            id: record.id,
            task: record.task,
            config: record.config,
            tags: record.tags,
        });
        await model.loadVersion(record.version);
        return model;
    }
    async train(trainingData) {
        await this.ensureRuntime();
        await this.ensureModel();
        const tf = this.getTf();
        const xs = buildTensor(tf, trainingData.inputs, this.config.inputDType ?? "float32");
        const ys = buildTensor(tf, trainingData.labels);
        try {
            this.compileIfNeeded();
            const fitOptions = {
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
            const history = await this.model.fit(xs, ys, fitOptions);
            const lossValues = Array.isArray(history.history.loss)
                ? history.history.loss.filter((value) => typeof value === "number")
                : [];
            const metricName = Object.keys(history.history).find((name) => name !== "loss");
            const metricValues = metricName === undefined
                ? []
                : (history.history[metricName] ?? []).filter((value) => typeof value === "number");
            const metrics = {};
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
        }
        finally {
            xs.dispose();
            ys.dispose();
        }
    }
    async predict(input) {
        if (this.model === undefined) {
            throw new ModelNotReadyError("TFJS model is not initialized. Train it first or load a saved version.");
        }
        const tf = this.getTf();
        const xs = buildTensor(tf, input.inputs, this.config.inputDType ?? "float32");
        try {
            const prediction = this.model.predict(xs);
            if (Array.isArray(prediction)) {
                throw new UnsupportedOperationError("NeurozAI TFJS adapter currently supports single-output prediction only.");
            }
            const values = (await prediction.array());
            return { values };
        }
        finally {
            xs.dispose();
        }
    }
    async save(options) {
        if (this.model === undefined) {
            throw new ModelNotReadyError("TFJS model is not initialized. Train it first before saving.");
        }
        const paths = await this.store.initializeVersion({
            id: this.id,
            version: options.version,
            backend: "tfjs",
        });
        const tf = this.getTf();
        await this.model.save(tf.io.withSaveHandler(async (artifacts) => {
            const artifactPayload = {
                format: artifacts.format ?? undefined,
                generatedBy: artifacts.generatedBy ?? undefined,
                convertedBy: artifacts.convertedBy ?? undefined,
                modelTopology: artifacts.modelTopology,
                weightSpecs: artifacts.weightSpecs ?? [],
            };
            await this.store.writeJson(path.join(paths.artifactDir, TFJS_MODEL_FILE), artifactPayload);
            const combinedWeights = combineWeightData(artifacts.weightData);
            if (combinedWeights !== undefined) {
                await this.store.writeBuffer(path.join(paths.artifactDir, TFJS_WEIGHTS_FILE), combinedWeights);
            }
            return {
                modelArtifactsInfo: tf.io.getModelArtifactsInfoForJSON(artifacts),
            };
        }));
        const now = toIsoDate();
        const record = {
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
    async loadVersion(version) {
        await this.ensureRuntime();
        const tf = this.getTf();
        const artifactDir = this.store.resolveArtifactDir(this.id, version);
        const artifacts = await this.store.readJson(path.join(artifactDir, TFJS_MODEL_FILE));
        const weightBuffer = await this.store.readBuffer(path.join(artifactDir, TFJS_WEIGHTS_FILE));
        this.model = await tf.loadLayersModel(tf.io.fromMemory({
            modelTopology: artifacts.modelTopology,
            format: artifacts.format,
            generatedBy: artifacts.generatedBy,
            convertedBy: artifacts.convertedBy,
            weightSpecs: artifacts.weightSpecs,
            weightData: resolveArrayBuffer(weightBuffer),
        }));
        this.compileIfNeeded();
    }
    async ensureRuntime() {
        if (this.tf !== undefined) {
            return;
        }
        const runtime = await loadTensorFlow();
        this.tf = runtime.tf;
        this.runtime = runtime.runtime;
    }
    getTf() {
        if (this.tf === undefined) {
            throw new ModelNotReadyError("TensorFlow runtime is not loaded.");
        }
        return this.tf;
    }
    async ensureModel() {
        if (this.model !== undefined) {
            return;
        }
        const tf = this.getTf();
        const model = tf.sequential();
        let hasAnyLayer = false;
        for (const layer of this.config.layers) {
            if (layer.type === "dense") {
                const inputShape = !hasAnyLayer && layer.inputShape === undefined
                    ? this.config.inputShape
                    : layer.inputShape;
                const denseConfig = {
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
                const embeddingConfig = {
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
                model.add(tf.layers.dropout({
                    rate: layer.rate,
                }));
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
                const lstmConfig = {
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
                const gruConfig = {
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
            throw new ConfigurationError(`Unsupported TFJS layer type: ${layer.type}`);
        }
        this.model = model;
    }
    compileIfNeeded() {
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
//# sourceMappingURL=tfjs-model.js.map