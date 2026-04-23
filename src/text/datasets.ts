import { ConfigurationError } from "../core/errors.js";
import { Dataset } from "../datasets/dataset.js";

import { TextTokenizer } from "./tokenizer.js";
import type {
  BuildCausalLanguageModelDatasetOptions,
  BuildModerationDatasetOptions,
  CausalLanguageModelSample,
  ModerationDatasetBundle,
  ModerationTrainingExample,
} from "./types.js";

function oneHot(index: number, size: number): number[] {
  const vector = Array.from({ length: size }, () => 0);
  if (index >= 0 && index < size) {
    vector[index] = 1;
  }

  return vector;
}

function ensurePositiveSequenceLength(sequenceLength: number): void {
  if (!Number.isInteger(sequenceLength) || sequenceLength <= 0) {
    throw new ConfigurationError("Sequence length must be a positive integer.");
  }
}

export function buildCausalLanguageModelDataset(
  texts: readonly string[],
  tokenizer: TextTokenizer,
  options: BuildCausalLanguageModelDatasetOptions,
): Dataset<CausalLanguageModelSample> {
  ensurePositiveSequenceLength(options.sequenceLength);
  const stride = options.stride ?? 1;

  if (!Number.isInteger(stride) || stride <= 0) {
    throw new ConfigurationError("Language model stride must be a positive integer.");
  }

  const samples: CausalLanguageModelSample[] = [];

  for (const text of texts) {
    const tokens = tokenizer.encode(text, {
      addBos: options.addBos ?? true,
      addEos: options.addEos ?? true,
      padDirection: "left",
      truncateDirection: "left",
    });

    if (tokens.length <= options.sequenceLength) {
      continue;
    }

    for (
      let start = 0;
      start + options.sequenceLength < tokens.length;
      start += stride
    ) {
      const input = tokens.slice(start, start + options.sequenceLength);
      const targetTokenId = tokens[start + options.sequenceLength]!;

      samples.push({
        input,
        targetTokenId,
        label: oneHot(targetTokenId, tokenizer.vocabSize),
      });
    }
  }

  return new Dataset(samples);
}

export function buildModerationDataset(
  examples: readonly ModerationTrainingExample[],
  tokenizer: TextTokenizer,
  options: BuildModerationDatasetOptions,
): ModerationDatasetBundle {
  ensurePositiveSequenceLength(options.sequenceLength);

  const labels = options.labels ?? [...new Set(examples.map((example) => example.label))].sort();
  const normalizedLabels = labels.filter((label): label is string => typeof label === "string");
  const labelToIndex = new Map(normalizedLabels.map((label, index) => [label, index]));

  function activeLabelsForExample(example: ModerationTrainingExample): string[] {
    if (example.categories !== undefined) {
      return normalizedLabels.filter((label) => example.categories?.[label] === true);
    }

    if (example.labels !== undefined) {
      return example.labels.filter(
        (label) => label !== options.safeLabel && labelToIndex.has(label),
      );
    }

    if (example.label === undefined || example.label === options.safeLabel) {
      return [];
    }

    if (!labelToIndex.has(example.label)) {
      throw new ConfigurationError(`Unknown moderation label "${example.label}".`);
    }

    return [example.label];
  }

  function multiHot(activeLabels: readonly string[]): number[] {
    const vector = Array.from({ length: normalizedLabels.length }, () => 0);

    for (const label of activeLabels) {
      const index = labelToIndex.get(label);
      if (index !== undefined) {
        vector[index] = 1;
      }
    }

    return vector;
  }

  const dataset = new Dataset(
    examples.map((example) => {
      const activeLabels = activeLabelsForExample(example);
      const categories = Object.fromEntries(
        normalizedLabels.map((label) => [label, activeLabels.includes(label)]),
      );

      return {
        input: tokenizer.encode(example.text, {
          addBos: options.addBos ?? true,
          addEos: options.addEos ?? true,
          maxLength: options.sequenceLength,
          padToLength: options.sequenceLength,
          padDirection: "left",
          truncateDirection: "left",
        }),
        label: multiHot(activeLabels),
        activeLabels,
        categories,
      };
    }),
  );

  return {
    dataset,
    labels: normalizedLabels,
  };
}
