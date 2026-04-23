import type { DecodeTextOptions, EncodeTextOptions, SerializedTextTokenizer, TextTokenizerOptions } from "./types.js";
export declare class TextTokenizer {
    readonly options: Required<TextTokenizerOptions>;
    private readonly tokenToIdMap;
    private readonly idToTokenList;
    constructor(options?: TextTokenizerOptions, initialVocabulary?: string[]);
    get vocabulary(): string[];
    get vocabSize(): number;
    get padToken(): string;
    get unkToken(): string;
    get bosToken(): string;
    get eosToken(): string;
    get padId(): number;
    get unkId(): number;
    get bosId(): number;
    get eosId(): number;
    fitOnTexts(texts: readonly string[]): this;
    tokenize(text: string): string[];
    encode(text: string, options?: EncodeTextOptions): number[];
    decode(ids: readonly number[], options?: DecodeTextOptions): string;
    tokenToId(token: string): number;
    idToToken(id: number): string;
    toJSON(): SerializedTextTokenizer;
    static fromJSON(serialized: SerializedTextTokenizer): TextTokenizer;
    private registerToken;
}
