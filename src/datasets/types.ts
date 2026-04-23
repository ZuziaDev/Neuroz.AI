export interface BatchDatasetOptions {
  dropRemainder?: boolean | undefined;
}

export interface SplitDatasetOptions {
  train?: number | undefined;
  validation?: number | undefined;
  test?: number | undefined;
  shuffle?: boolean | undefined;
  seed?: number | undefined;
}

export interface DatasetSplit<T> {
  train: T;
  validation: T;
  test: T;
}

export interface DatasetNormalizationStats {
  means: number[];
  standardDeviations: number[];
}

export interface NormalizeRowsOptions {
  epsilon?: number | undefined;
}
