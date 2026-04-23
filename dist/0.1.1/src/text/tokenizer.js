import { ConfigurationError } from "../core/errors.js";
const DEFAULT_OPTIONS = {
    level: "word",
    lowercase: true,
    minFrequency: 1,
};
const SPECIAL_TOKENS = ["<pad>", "<unk>", "<bos>", "<eos>"];
function normalizeOptions(options = {}) {
    return {
        level: options.level ?? DEFAULT_OPTIONS.level,
        lowercase: options.lowercase ?? DEFAULT_OPTIONS.lowercase,
        minFrequency: options.minFrequency ?? DEFAULT_OPTIONS.minFrequency,
    };
}
function isPunctuation(token) {
    return /^[^\p{L}\p{N}\s]+$/u.test(token);
}
function splitWords(text) {
    return text.match(/\p{L}+(?:['’-]\p{L}+)*|\p{N}+|[^\s\p{L}\p{N}]/gu) ?? [];
}
export class TextTokenizer {
    options;
    tokenToIdMap = new Map();
    idToTokenList = [];
    constructor(options = {}, initialVocabulary) {
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
    get vocabulary() {
        return [...this.idToTokenList];
    }
    get vocabSize() {
        return this.idToTokenList.length;
    }
    get padToken() {
        return SPECIAL_TOKENS[0];
    }
    get unkToken() {
        return SPECIAL_TOKENS[1];
    }
    get bosToken() {
        return SPECIAL_TOKENS[2];
    }
    get eosToken() {
        return SPECIAL_TOKENS[3];
    }
    get padId() {
        return this.tokenToId(this.padToken);
    }
    get unkId() {
        return this.tokenToId(this.unkToken);
    }
    get bosId() {
        return this.tokenToId(this.bosToken);
    }
    get eosId() {
        return this.tokenToId(this.eosToken);
    }
    fitOnTexts(texts) {
        const counts = new Map();
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
    tokenize(text) {
        const normalized = this.options.lowercase ? text.toLowerCase() : text;
        if (this.options.level === "char") {
            return Array.from(normalized);
        }
        return splitWords(normalized);
    }
    encode(text, options = {}) {
        const tokens = this.tokenize(text);
        const encoded = [];
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
    decode(ids, options = {}) {
        const tokens = ids
            .map((id) => this.idToTokenList[id] ?? this.unkToken)
            .filter((token) => {
            if (!options.skipSpecialTokens) {
                return true;
            }
            return !SPECIAL_TOKENS.includes(token);
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
    tokenToId(token) {
        const id = this.tokenToIdMap.get(token);
        if (id === undefined) {
            throw new ConfigurationError(`Unknown token "${token}" is not part of the vocabulary.`);
        }
        return id;
    }
    idToToken(id) {
        return this.idToTokenList[id] ?? this.unkToken;
    }
    toJSON() {
        return {
            options: this.options,
            vocabulary: this.idToTokenList.filter((token) => !SPECIAL_TOKENS.includes(token)),
        };
    }
    static fromJSON(serialized) {
        return new TextTokenizer(serialized.options, serialized.vocabulary);
    }
    registerToken(token) {
        this.tokenToIdMap.set(token, this.idToTokenList.length);
        this.idToTokenList.push(token);
    }
}
//# sourceMappingURL=tokenizer.js.map