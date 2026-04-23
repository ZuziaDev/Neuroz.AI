import { Dataset } from "./dataset.js";
import type { DatasetNormalizationStats, NormalizeRowsOptions } from "./types.js";
export declare function normalizeRows(rows: readonly number[][], options?: NormalizeRowsOptions): {
    rows: number[][];
    stats: DatasetNormalizationStats;
};
export declare function applyRowNormalization(rows: readonly number[][], stats: DatasetNormalizationStats): number[][];
export declare function normalizeDatasetInputs<T extends {
    input: number[];
}>(dataset: Dataset<T> | Iterable<T>, options?: NormalizeRowsOptions): {
    dataset: Dataset<T>;
    stats: DatasetNormalizationStats;
};
export declare function applyDatasetInputNormalization<T extends {
    input: number[];
}>(dataset: Dataset<T> | Iterable<T>, stats: DatasetNormalizationStats): Dataset<T>;
