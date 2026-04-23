import path from "node:path";
import { RuntimeDependencyError, UnsupportedOperationError, } from "../../core/errors.js";
import { toAbsolutePath, toIsoDate } from "../../core/utils.js";
const ONNX_MODEL_FILE = "model.onnx";
async function loadOrt() {
    try {
        const ortModule = await import("onnxruntime-node");
        return (ortModule.default ?? ortModule);
    }
    catch (error) {
        throw new RuntimeDependencyError("Failed to load onnxruntime-node. Install the optional dependency to use ONNX models.", { cause: error });
    }
}
function normalizeOrtTensor(tensor) {
    return {
        type: tensor.type,
        dims: [...tensor.dims],
        data: Array.from(tensor.data),
    };
}
export class OnnxModel {
    store;
    registry;
    id;
    task;
    config;
    tags;
    ort;
    session;
    activeVersion;
    constructor(store, registry, options) {
        this.store = store;
        this.registry = registry;
        this.id = options.id;
        this.task = options.task;
        this.config = options.config;
        this.tags = options.tags ?? [];
    }
    static async load(store, registry, record) {
        const model = new OnnxModel(store, registry, {
            id: record.id,
            task: record.task,
            config: record.config,
            tags: record.tags,
        });
        await model.loadVersion(record.version);
        return model;
    }
    async save(options) {
        const paths = await this.store.initializeVersion({
            id: this.id,
            version: options.version,
            backend: "onnx",
        });
        const sourcePath = toAbsolutePath(process.cwd(), this.config.sourcePath);
        await this.store.copyIntoArtifacts(sourcePath, this.id, options.version, ONNX_MODEL_FILE);
        await this.loadVersion(options.version);
        const now = toIsoDate();
        const record = {
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
    async loadVersion(version) {
        const ort = await this.ensureOrt();
        const modelPath = path.join(this.store.resolveArtifactDir(this.id, version), ONNX_MODEL_FILE);
        this.session = await ort.InferenceSession.create(modelPath, {
            executionProviders: this.config.executionProviders,
        });
        this.activeVersion = version;
    }
    async predict(input) {
        if (this.session === undefined) {
            throw new RuntimeDependencyError("ONNX session is not initialized. Import or load a saved version first.");
        }
        const ort = await this.ensureOrt();
        const feeds = Object.fromEntries(Object.entries(input.feeds).map(([name, tensor]) => [
            name,
            new ort.Tensor(tensor.type, tensor.data, tensor.dims),
        ]));
        const output = await this.session.run(feeds);
        return {
            outputs: Object.fromEntries(Object.entries(output).map(([name, tensor]) => [name, normalizeOrtTensor(tensor)])),
        };
    }
    async train() {
        throw new UnsupportedOperationError("onnxruntime-node is used by NeurozAI as an inference/runtime backend, not a training backend.");
    }
    get version() {
        return this.activeVersion;
    }
    async ensureOrt() {
        if (this.ort !== undefined) {
            return this.ort;
        }
        this.ort = await loadOrt();
        return this.ort;
    }
}
//# sourceMappingURL=onnx-model.js.map