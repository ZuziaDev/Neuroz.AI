import type { ModerationDetectedLanguage } from "./platform-types.js";

const ENGLISH_HINTS = ["the", "you", "and", "please", "help", "thanks", "hate"];
const TURKISH_HINTS = ["ve", "bir", "sen", "merhaba", "yardim", "teşekkür", "nefret"];

function countHints(text: string, hints: readonly string[]): number {
  return hints.reduce((count, hint) => count + (text.includes(hint) ? 1 : 0), 0);
}

export function detectModerationLanguage(text: string): ModerationDetectedLanguage {
  const normalized = text.toLocaleLowerCase();
  const englishHits = countHints(normalized, ENGLISH_HINTS);
  const turkishHits = countHints(normalized, TURKISH_HINTS);
  const hasTurkishChars = /[çğıöşü]/i.test(text);

  if (turkishHits > englishHits || hasTurkishChars) {
    return {
      language: "tr",
      confidence: hasTurkishChars ? 0.85 : 0.65,
      reasons: hasTurkishChars ? ["turkish-characters"] : ["turkish-hints"],
    };
  }

  if (englishHits > 0) {
    return {
      language: "en",
      confidence: 0.65,
      reasons: ["english-hints"],
    };
  }

  return {
    language: "unknown",
    confidence: 0.2,
    reasons: ["no-strong-language-signal"],
  };
}
