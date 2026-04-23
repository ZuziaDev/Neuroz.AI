import { ConfigurationError } from "../core/errors.js";

import type {
  DecodeTextOptions,
  EncodeTextOptions,
  SerializedTextTokenizer,
  TextTokenizerOptions,
  TokenizerLevel,
} from "./types.js";

const DEFAULT_OPTIONS: Required<TextTokenizerOptions> = {
  level: "word",
  lowercase: true,
  minFrequency: 1,
};

const SPECIAL_TOKENS = ["<pad>", "<unk>", "<bos>", "<eos>"] as const;

function normalizeOptions(options: TextTokenizerOptions = {}): Required<TextTokenizerOptions> {
  return {
    level: options.level ?? DEFAULT_OPTIONS.level,
    lowercase: options.lowercase ?? DEFAULT_OPTIONS.lowercase,
    minFrequency: options.minFrequency ?? DEFAULT_OPTIONS.minFrequency,
  };
}

function isPunctuation(token: string): boolean {
  return /^[^\p{L}\p{N}\s]+$/u.test(token);
}

function splitWords(text: string): string[] {
  return text.match(/\p{L}+(?:['’-]\p{L}+)*|\p{N}+|[^\s\p{L}\p{N}]/gu) ?? [];
}

export class TextTokenizer {
  public readonly options: Required<TextTokenizerOptions>;

  private readonly tokenToIdMap = new Map<string, number>();
  private readonly idToTokenList: string[] = [];

  public constructor(options: TextTokenizerOptions = {}, initialVocabulary?: string[]) {
    this.options = normalizeOptions(options);

    for (const token of SPECIAL_TOKENS) {
      this.registerToken(token);
    }

    for (const token of initialVocabulary ?? []) {
      if (!this.tokenToIdMap.has(token)) {
        this.registerToken(token);
      }
    }
  }

  public get vocabulary(): string[] {
    return [...this.idToTokenList];
  }

  public get vocabSize(): number {
    return this.idToTokenList.length;
  }

  public get padToken(): string {
    return SPECIAL_TOKENS[0];
  }

  public get unkToken(): string {
    return SPECIAL_TOKENS[1];
  }

  public get bosToken(): string {
    return SPECIAL_TOKENS[2];
  }

  public get eosToken(): string {
    return SPECIAL_TOKENS[3];
  }

  public get padId(): number {
    return this.tokenToId(this.padToken);
  }

  public get unkId(): number {
    return this.tokenToId(this.unkToken);
  }

  public get bosId(): number {
    return this.tokenToId(this.bosToken);
  }

  public get eosId(): number {
    return this.tokenToId(this.eosToken);
  }

  public fitOnTexts(texts: readonly string[]): this {
    const counts = new Map<string, number>();
    const minFrequency = this.options.minFrequency ?? 1;

    for (const text of texts) {
      for (const token of this.tokenize(text)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }

    const vocabulary = [...counts.entries()]
      .filter((entry) => (entry[1] ?? 0) >= minFrequency)
      .sort(([leftToken, leftCount], [rightToken, rightCount]) => {
        const normalizedLeftCount = leftCount ?? 0;
        const normalizedRightCount = rightCount ?? 0;

        if (normalizedRightCount !== normalizedLeftCount) {
          return normalizedRightCount - normalizedLeftCount;
        }

        return leftToken.localeCompare(rightToken);
      })
      .map(([token]) => token);

    for (const token of vocabulary) {
      if (!this.tokenToIdMap.has(token)) {
        this.registerToken(token);
      }
    }

    return this;
  }

  public tokenize(text: string): string[] {
    const normalized = this.options.lowercase ? text.toLowerCase() : text;

    if (this.options.level === "char") {
      return Array.from(normalized);
    }

    return splitWords(normalized);
  }

  public encode(text: string, options: EncodeTextOptions = {}): number[] {
    const tokens = this.tokenize(text);
    const encoded: number[] = [];

    if (options.addBos) {
      encoded.push(this.bosId);
    }

    encoded.push(...tokens.map((token) => this.tokenToIdMap.get(token) ?? this.unkId));

    if (options.addEos) {
      encoded.push(this.eosId);
    }

    let output = [...encoded];

    if (options.maxLength !== undefined && output.length > options.maxLength) {
      output =
        (options.truncateDirection ?? "left") === "left"
          ? output.slice(output.length - options.maxLength)
          : output.slice(0, options.maxLength);
    }

    const padLength = options.padToLength ?? options.maxLength;
    if (padLength !== undefined && output.length < padLength) {
      const padding = Array.from({ length: padLength - output.length }, () => this.padId);
      output =
        (options.padDirection ?? "left") === "left"
          ? [...padding, ...output]
          : [...output, ...padding];
    }

    return output;
  }

  public decode(ids: readonly number[], options: DecodeTextOptions = {}): string {
    const tokens = ids
      .map((id) => this.idToTokenList[id] ?? this.unkToken)
      .filter((token) => {
        if (!options.skipSpecialTokens) {
          return true;
        }

        return !SPECIAL_TOKENS.includes(token as (typeof SPECIAL_TOKENS)[number]);
      });

    if (this.options.level === "char") {
      return tokens.join("");
    }

    let output = "";
    for (const token of tokens) {
      if (output.length === 0) {
        output = token;
        continue;
      }

      if (isPunctuation(token)) {
        output += token;
        continue;
      }

      output += ` ${token}`;
    }

    return output;
  }

  public tokenToId(token: string): number {
    const id = this.tokenToIdMap.get(token);
    if (id === undefined) {
      throw new ConfigurationError(`Unknown token "${token}" is not part of the vocabulary.`);
    }

    return id;
  }

  public idToToken(id: number): string {
    return this.idToTokenList[id] ?? this.unkToken;
  }

  public toJSON(): SerializedTextTokenizer {
    return {
      options: this.options,
      vocabulary: this.idToTokenList.filter((token) => !SPECIAL_TOKENS.includes(token as never)),
    };
  }

  public static fromJSON(serialized: SerializedTextTokenizer): TextTokenizer {
    return new TextTokenizer(serialized.options, serialized.vocabulary);
  }

  private registerToken(token: string): void {
    this.tokenToIdMap.set(token, this.idToTokenList.length);
    this.idToTokenList.push(token);
  }
}
