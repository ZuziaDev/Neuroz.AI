import { ConfigurationError } from "../core/errors.js";
function createSeededRandom(seed) {
    let state = Math.trunc(seed) >>> 0;
    if (state === 0) {
        state = 0x6d2b79f5;
    }
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}
function normalizeRatios(options) {
    const train = options.train ?? 0.8;
    const validation = options.validation ?? 0.1;
    const remaining = 1 - train - validation;
    const test = options.test ?? Math.max(0, remaining);
    for (const [label, value] of Object.entries({ train, validation, test })) {
        if (value < 0 || value > 1) {
            throw new ConfigurationError(`Dataset split ratio "${label}" must be between 0 and 1.`);
        }
    }
    const total = train + validation + test;
    if (total > 1.0000001 || total <= 0) {
        throw new ConfigurationError("Dataset split ratios must add up to a value between 0 and 1.");
    }
    return { train, validation, test };
}
function toItems(records) {
    return Array.from(records);
}
export class Dataset {
    records;
    constructor(records) {
        this.records = toItems(records);
    }
    static from(records) {
        return new Dataset(records);
    }
    get size() {
        return this.records.length;
    }
    at(index) {
        return this.records[index];
    }
    toArray() {
        return [...this.records];
    }
    map(mapper) {
        return new Dataset(this.records.map(mapper));
    }
    filter(predicate) {
        return new Dataset(this.records.filter(predicate));
    }
    forEach(iterator) {
        this.records.forEach(iterator);
    }
    take(count) {
        return new Dataset(this.records.slice(0, Math.max(0, count)));
    }
    skip(count) {
        return new Dataset(this.records.slice(Math.max(0, count)));
    }
    concat(...others) {
        const merged = [...this.records];
        for (const other of others) {
            if (other instanceof Dataset) {
                merged.push(...other.records);
                continue;
            }
            merged.push(...Array.from(other));
        }
        return new Dataset(merged);
    }
    shuffle(seed = Date.now()) {
        const random = createSeededRandom(seed);
        const shuffled = [...this.records];
        for (let index = shuffled.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(random() * (index + 1));
            [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
        }
        return new Dataset(shuffled);
    }
    batch(batchSize, options = {}) {
        if (!Number.isInteger(batchSize) || batchSize <= 0) {
            throw new ConfigurationError("Dataset batch size must be a positive integer.");
        }
        const batches = [];
        for (let index = 0; index < this.records.length; index += batchSize) {
            const batch = this.records.slice(index, index + batchSize);
            if (batch.length < batchSize && options.dropRemainder) {
                break;
            }
            batches.push([...batch]);
        }
        return new Dataset(batches);
    }
    split(options = {}) {
        const ratios = normalizeRatios(options);
        const prepared = options.shuffle === false ? this : this.shuffle(options.seed);
        const trainCount = Math.floor(prepared.size * ratios.train);
        const validationCount = Math.floor(prepared.size * ratios.validation);
        const train = prepared.take(trainCount);
        const validation = prepared.skip(trainCount).take(validationCount);
        const test = prepared.skip(trainCount + validationCount);
        return {
            train,
            validation,
            test,
        };
    }
    [Symbol.iterator]() {
        return this.records[Symbol.iterator]();
    }
}
export function createDataset(records) {
    return Dataset.from(records);
}
//# sourceMappingURL=dataset.js.map