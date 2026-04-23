import type { BatchDatasetOptions, DatasetSplit, SplitDatasetOptions } from "./types.js";
export declare class Dataset<T> implements Iterable<T> {
    private readonly records;
    constructor(records: Iterable<T> | ArrayLike<T>);
    static from<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T>;
    get size(): number;
    at(index: number): T | undefined;
    toArray(): T[];
    map<TResult>(mapper: (record: T, index: number, records: readonly T[]) => TResult): Dataset<TResult>;
    filter(predicate: (record: T, index: number, records: readonly T[]) => boolean): Dataset<T>;
    forEach(iterator: (record: T, index: number, records: readonly T[]) => void): void;
    take(count: number): Dataset<T>;
    skip(count: number): Dataset<T>;
    concat(...others: Array<Dataset<T> | Iterable<T>>): Dataset<T>;
    shuffle(seed?: number): Dataset<T>;
    batch(batchSize: number, options?: BatchDatasetOptions): Dataset<T[]>;
    split(options?: SplitDatasetOptions): DatasetSplit<Dataset<T>>;
    [Symbol.iterator](): Iterator<T>;
}
export declare function createDataset<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T>;
