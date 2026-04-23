import { ConfigurationError } from "../core/errors.js";

import type { BatchDatasetOptions, DatasetSplit, SplitDatasetOptions } from "./types.js";

function createSeededRandom(seed: number): () => number {
  let state = Math.trunc(seed) >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function normalizeRatios(options: SplitDatasetOptions): {
  train: number;
  validation: number;
  test: number;
} {
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
    throw new ConfigurationError(
      "Dataset split ratios must add up to a value between 0 and 1.",
    );
  }

  return { train, validation, test };
}

function toItems<T>(records: Iterable<T> | ArrayLike<T>): T[] {
  return Array.from(records as Iterable<T>);
}

export class Dataset<T> implements Iterable<T> {
  private readonly records: readonly T[];

  public constructor(records: Iterable<T> | ArrayLike<T>) {
    this.records = toItems(records);
  }

  public static from<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T> {
    return new Dataset(records);
  }

  public get size(): number {
    return this.records.length;
  }

  public at(index: number): T | undefined {
    return this.records[index];
  }

  public toArray(): T[] {
    return [...this.records];
  }

  public map<TResult>(
    mapper: (record: T, index: number, records: readonly T[]) => TResult,
  ): Dataset<TResult> {
    return new Dataset(this.records.map(mapper));
  }

  public filter(
    predicate: (record: T, index: number, records: readonly T[]) => boolean,
  ): Dataset<T> {
    return new Dataset(this.records.filter(predicate));
  }

  public forEach(
    iterator: (record: T, index: number, records: readonly T[]) => void,
  ): void {
    this.records.forEach(iterator);
  }

  public take(count: number): Dataset<T> {
    return new Dataset(this.records.slice(0, Math.max(0, count)));
  }

  public skip(count: number): Dataset<T> {
    return new Dataset(this.records.slice(Math.max(0, count)));
  }

  public concat(...others: Array<Dataset<T> | Iterable<T>>): Dataset<T> {
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

  public shuffle(seed: number = Date.now()): Dataset<T> {
    const random = createSeededRandom(seed);
    const shuffled = [...this.records];

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
    }

    return new Dataset(shuffled);
  }

  public batch(batchSize: number, options: BatchDatasetOptions = {}): Dataset<T[]> {
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new ConfigurationError("Dataset batch size must be a positive integer.");
    }

    const batches: T[][] = [];

    for (let index = 0; index < this.records.length; index += batchSize) {
      const batch = this.records.slice(index, index + batchSize);
      if (batch.length < batchSize && options.dropRemainder) {
        break;
      }

      batches.push([...batch]);
    }

    return new Dataset(batches);
  }

  public split(options: SplitDatasetOptions = {}): DatasetSplit<Dataset<T>> {
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

  public [Symbol.iterator](): Iterator<T> {
    return this.records[Symbol.iterator]();
  }
}

export function createDataset<T>(records: Iterable<T> | ArrayLike<T>): Dataset<T> {
  return Dataset.from(records);
}
