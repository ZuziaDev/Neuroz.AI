import type { Dataset } from "../datasets/dataset.js";

export type TokenizerLevel = "word" | "char";

export interface TextTokenizerOptions {
  level?: TokenizerLevel | undefined;
  lowercase?: boolean | undefined;
  minFrequency?: number | undefined;
}

export interface EncodeTextOptions {
  addBos?: boolean | undefined;
  addEos?: boolean | undefined;
  maxLength?: number | undefined;
  padToLength?: number | undefined;
  padDirection?: "left" | "right" | undefined;
  truncateDirection?: "left" | "right" | undefined;
}

export interface DecodeTextOptions {
  skipSpecialTokens?: boolean | undefined;
}

export interface SerializedTextTokenizer {
  options: Required<TextTokenizerOptions>;
  vocabulary: string[];
}

export interface BuildCausalLanguageModelDatasetOptions {
  sequenceLength: number;
  stride?: number | undefined;
  addBos?: boolean | undefined;
  addEos?: boolean | undefined;
}

export interface CausalLanguageModelSample {
  input: number[];
  label: number[];
  targetTokenId: number;
}

export interface ModerationTrainingExample {
  text: string;
  label?: string | undefined;
  labels?: string[] | undefined;
  // OpenAI-style moderation training prefers category-wise boolean labels.
  categories?: Record<string, boolean> | undefined;
}

export interface BuildModerationDatasetOptions {
  sequenceLength: number;
  labels?: string[] | undefined;
  // Optional neutral label for legacy single-label moderation datasets.
  safeLabel?: string | undefined;
  addBos?: boolean | undefined;
  addEos?: boolean | undefined;
}

export interface ModerationDatasetSample {
  input: number[];
  label: number[];
  activeLabels: string[];
  categories: Record<string, boolean>;
}

export interface ModerationDatasetBundle {
  dataset: Dataset<ModerationDatasetSample>;
  labels: string[];
}
