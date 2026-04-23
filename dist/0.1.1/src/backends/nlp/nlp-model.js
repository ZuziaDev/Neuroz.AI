import path from "node:path";
import { RuntimeDependencyError } from "../../core/errors.js";
import { toIsoDate } from "../../core/utils.js";
const NLP_MODEL_FILE = "model.nlp";
const NLP_CORPUS_FILE = "corpus.json";
async function createManager(config) {
    try {
        const nlpModule = await import("node-nlp");
        const namespace = (nlpModule.default ?? nlpModule);
        if (namespace.NlpManager === undefined) {
            throw new RuntimeDependencyError("node-nlp was loaded but NlpManager is not available.");
        }
        return new namespace.NlpManager({
            languages: config.languages,
            forceNER: config.forceNER ?? false,
            autoSave: config.autoSave ?? false,
            nlu: {
                useNoneFeature: config.useNoneFeature ?? true,
            },
        });
    }
    catch (error) {
        throw new RuntimeDependencyError("Failed to load node-nlp runtime.", {
            cause: error,
        });
    }
}
export class NlpModel {
    store;
    registry;
    id;
    task;
    config;
    tags;
    manager;
    constructor(store, registry, options) {
        this.store = store;
        this.registry = registry;
        this.id = options.id;
        this.task = options.task;
        this.config = options.config;
        this.tags = options.tags ?? [];
    }
    static async load(store, registry, record) {
        const model = new NlpModel(store, registry, {
            id: record.id,
            task: record.task,
            config: record.config,
            tags: record.tags,
        });
        await model.loadVersion(record.version);
        return model;
    }
    async train(corpus) {
        const manager = await this.ensureManager();
        for (const document of corpus.documents) {
            manager.addDocument(document.language, document.utterance, document.intent);
        }
        for (const answer of corpus.answers ?? []) {
            manager.addAnswer?.(answer.language, answer.intent, answer.answer);
        }
        await manager.train();
    }
    async predict(input) {
        const manager = await this.ensureManager();
        const output = await manager.process(input.language, input.utterance);
        return {
            language: typeof output.language === "string" ? output.language : undefined,
            locale: typeof output.locale === "string" ? output.locale : undefined,
            intent: typeof output.intent === "string" ? output.intent : undefined,
            score: typeof output.score === "number" ? output.score : undefined,
            sentiment: typeof output.sentiment === "number"
                ? output.sentiment
                : typeof output.sentiment?.score === "number"
                    ? output.sentiment.score
                    : undefined,
            answer: typeof output.answer === "string" ? output.answer : undefined,
            classifications: Array.isArray(output.classifications)
                ? output.classifications
                    .map((item) => {
                    if (typeof item === "object" &&
                        item !== null &&
                        typeof item.intent === "string" &&
                        typeof item.score === "number") {
                        return {
                            intent: item.intent,
                            score: item.score,
                        };
                    }
                    return undefined;
                })
                    .filter((item) => item !== undefined)
                : undefined,
        };
    }
    async save(options) {
        const manager = await this.ensureManager();
        const paths = await this.store.initializeVersion({
            id: this.id,
            version: options.version,
            backend: "nlp",
        });
        const modelPath = path.join(paths.artifactDir, NLP_MODEL_FILE);
        if (typeof manager.save === "function") {
            await manager.save(modelPath);
        }
        else if (typeof manager.export === "function") {
            const exported = await manager.export(true);
            await this.store.writeJson(modelPath, exported);
        }
        else {
            throw new RuntimeDependencyError("node-nlp manager does not expose a supported save API.");
        }
        if (options.corpus !== undefined) {
            await this.store.writeJson(path.join(paths.artifactDir, NLP_CORPUS_FILE), options.corpus);
        }
        const now = toIsoDate();
        const record = {
            id: this.id,
            version: options.version,
            backend: "nlp",
            task: this.task,
            status: "trained",
            createdAt: now,
            updatedAt: now,
            tags: this.tags,
            runtime: "node-nlp",
            config: this.config,
            metrics: options.metrics,
            metadata: options.metadata,
            artifactDir: paths.artifactDir,
            artifactFiles: options.corpus === undefined
                ? [NLP_MODEL_FILE]
                : [NLP_MODEL_FILE, NLP_CORPUS_FILE],
        };
        await this.registry.saveRecord(record);
        return record;
    }
    async loadVersion(version) {
        const manager = await this.ensureManager(true);
        const modelPath = path.join(this.store.resolveArtifactDir(this.id, version), NLP_MODEL_FILE);
        if (typeof manager.load === "function") {
            await manager.load(modelPath);
            return;
        }
        if (typeof manager.import === "function") {
            const imported = await this.store.readJson(modelPath);
            await manager.import(imported);
            return;
        }
        throw new RuntimeDependencyError("node-nlp manager does not expose a supported load API.");
    }
    async ensureManager(recreate = false) {
        if (this.manager !== undefined && !recreate) {
            return this.manager;
        }
        this.manager = await createManager(this.config);
        return this.manager;
    }
}
//# sourceMappingURL=nlp-model.js.map