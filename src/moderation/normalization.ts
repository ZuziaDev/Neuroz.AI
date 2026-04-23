import type {
  ModerationNormalizationOptions,
  NormalizedModerationText,
} from "./platform-types.js";

const DEFAULT_OPTIONS: Required<ModerationNormalizationOptions> = {
  lowercase: true,
  unicodeForm: "NFKC",
  collapseWhitespace: true,
  stripZeroWidth: true,
  decodeLeetspeak: true,
  collapseRepeatedCharacters: true,
  deobfuscateSeparators: true,
  trim: true,
};

const LEETSPEAK_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s",
  "!": "i",
};

function collapseRepeats(text: string): string {
  return text.replace(/(\p{L})\1{2,}/gu, "$1$1");
}

function decodeLeetspeak(text: string): string {
  return Array.from(text)
    .map((character) => LEETSPEAK_MAP[character] ?? character)
    .join("");
}

function deobfuscateSeparatedLetters(text: string): string {
  return text.replace(
    /\b(?:[\p{L}\p{N}][\s._*-]*){3,}[\p{L}\p{N}]\b/gu,
    (match) => match.replace(/[\s._*-]+/g, ""),
  );
}

export function normalizeModerationText(
  text: string,
  options: ModerationNormalizationOptions = {},
): NormalizedModerationText {
  const resolved = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  const operations: string[] = [];
  let normalized = text;

  if (resolved.unicodeForm !== undefined) {
    normalized = normalized.normalize(resolved.unicodeForm);
    operations.push(`unicode:${resolved.unicodeForm}`);
  }

  if (resolved.stripZeroWidth) {
    const next = normalized.replace(/[\u200B-\u200D\uFEFF]/g, "");
    if (next !== normalized) {
      operations.push("strip-zero-width");
      normalized = next;
    }
  }

  if (resolved.lowercase) {
    normalized = normalized.toLocaleLowerCase();
    operations.push("lowercase");
  }

  if (resolved.decodeLeetspeak) {
    const next = decodeLeetspeak(normalized);
    if (next !== normalized) {
      operations.push("decode-leetspeak");
      normalized = next;
    }
  }

  if (resolved.deobfuscateSeparators) {
    const next = deobfuscateSeparatedLetters(normalized);
    if (next !== normalized) {
      operations.push("deobfuscate-separators");
      normalized = next;
    }
  }

  if (resolved.collapseRepeatedCharacters) {
    const next = collapseRepeats(normalized);
    if (next !== normalized) {
      operations.push("collapse-repeated-characters");
      normalized = next;
    }
  }

  if (resolved.collapseWhitespace) {
    const next = normalized.replace(/\s+/g, " ");
    if (next !== normalized) {
      operations.push("collapse-whitespace");
      normalized = next;
    }
  }

  if (resolved.trim) {
    const next = normalized.trim();
    if (next !== normalized) {
      operations.push("trim");
      normalized = next;
    }
  }

  return {
    originalText: text,
    text: normalized,
    operations,
    containsObfuscation: operations.some((operation) =>
      ["decode-leetspeak", "deobfuscate-separators", "collapse-repeated-characters"].includes(
        operation,
      ),
    ),
  };
}
