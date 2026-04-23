import type { SaveModelOptions } from "../core/types.js";
import type { TextTokenizer } from "../text/tokenizer.js";
import type { TextTokenizerOptions as TextTokenizerOptionsType, ModerationTrainingExample } from "../text/types.js";
import type { TfjsTrainingData } from "../backends/tfjs/types.js";

export type ModerationOutputSchema = "openai" | "flat";
export type ModerationInputType = "text";

export interface ModerationThresholds {
  default?: number | undefined;
  categories?: Record<string, number> | undefined;
}

export interface CreateModerationModelOptions {
  id: string;
  task?: string | undefined;
  sequenceLength: number;
  embeddingDim?: number | undefined;
  hiddenUnits?: number | undefined;
  dropoutRate?: number | undefined;
  schema?: ModerationOutputSchema | undefined;
  modelName?: string | undefined;
  labels?: string[] | undefined;
  safeLabel?: string | undefined;
  thresholds?: ModerationThresholds | undefined;
  tokenizer?: TextTokenizer | TextTokenizerOptionsType | undefined;
  tags?: string[] | undefined;
}

export interface ModerationModelArtifactConfig {
  id: string;
  task: string;
  sequenceLength: number;
  embeddingDim: number;
  hiddenUnits: number;
  dropoutRate: number;
  schema: ModerationOutputSchema;
  modelName: string;
  labels: string[];
  safeLabel?: string | undefined;
  thresholds?: ModerationThresholds | undefined;
  tags: string[];
}

export interface ModerationTrainOptions {
  fit?: TfjsTrainingData["fit"] | undefined;
}

export interface ModerationCategoryScore {
  category: string;
  score: number;
  flagged: boolean;
}

export interface ModerationResultEntry {
  flagged: boolean;
  categories: Record<string, boolean>;
  category_scores: Record<string, number>;
  category_applied_input_types?: Record<string, ModerationInputType[]> | undefined;
}

export interface ModerationPredictionResult {
  id: string;
  model: string;
  results: ModerationResultEntry[];
}

export interface ModerationBatchPredictionResult {
  model: string;
  inputs: string[];
  outputs: ModerationPredictionResult[];
}

export interface ModerationFlatPredictionResult {
  text: string;
  flagged: boolean;
  top_category?: string | undefined;
  top_score?: number | undefined;
  scores: ModerationCategoryScore[];
}

export interface ModerationTokenContribution {
  token: string;
  category: string;
  contribution: number;
}

export interface ModerationPredictionExplanation {
  summary: string;
  tokenContributions: ModerationTokenContribution[];
}

export interface ModerationModelSaveOptions extends SaveModelOptions {}

export type { ModerationTrainingExample };
