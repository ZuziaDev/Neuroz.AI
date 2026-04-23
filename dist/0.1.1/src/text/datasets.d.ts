import { Dataset } from "../datasets/dataset.js";
import { TextTokenizer } from "./tokenizer.js";
import type { BuildCausalLanguageModelDatasetOptions, BuildModerationDatasetOptions, CausalLanguageModelSample, ModerationDatasetBundle, ModerationTrainingExample } from "./types.js";
export declare function buildCausalLanguageModelDataset(texts: readonly string[], tokenizer: TextTokenizer, options: BuildCausalLanguageModelDatasetOptions): Dataset<CausalLanguageModelSample>;
export declare function buildModerationDataset(examples: readonly ModerationTrainingExample[], tokenizer: TextTokenizer, options: BuildModerationDatasetOptions): ModerationDatasetBundle;
