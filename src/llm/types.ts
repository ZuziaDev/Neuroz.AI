import type { SaveModelOptions } from "../core/types.js";
import type { TextTokenizer } from "../text/tokenizer.js";
import type { TextTokenizerOptions as TextTokenizerOptionsType } from "../text/types.js";
import type { TfjsTrainingData } from "../backends/tfjs/types.js";

export interface CreateCausalLanguageModelOptions {
  id: string;
  task?: string | undefined;
  sequenceLength: number;
  embeddingDim?: number | undefined;
  hiddenUnits?: number | undefined;
  dropoutRate?: number | undefined;
  recurrentLayerType?: "lstm" | "gru" | undefined;
  tokenizer?: TextTokenizer | TextTokenizerOptionsType | undefined;
  tags?: string[] | undefined;
}

export interface CausalLanguageModelArtifactConfig {
  id: string;
  task: string;
  sequenceLength: number;
  embeddingDim: number;
  hiddenUnits: number;
  dropoutRate: number;
  recurrentLayerType: "lstm" | "gru";
  tags: string[];
}

export interface CausalLanguageModelTrainOptions {
  stride?: number | undefined;
  fit?: TfjsTrainingData["fit"] | undefined;
}

export interface GenerateTextOptions {
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  topK?: number | undefined;
  strategy?: "greedy" | "sample" | undefined;
  stopOnEos?: boolean | undefined;
}

export interface GenerateTextResult {
  prompt: string;
  completion: string;
  text: string;
  tokenIds: number[];
}

export interface CausalLanguageModelSaveOptions extends SaveModelOptions {}
