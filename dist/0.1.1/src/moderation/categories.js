import { OPENAI_MODERATION_CATEGORIES } from "./openai-schema.js";
export const DEFAULT_BRAND_SAFETY_CATEGORIES = [
    "brand/nsfw",
    "brand/politics",
    "brand/gambling",
    "brand/drugs",
    "brand/extremism",
    "brand/spam",
    "brand/scam",
    "brand/phishing",
    "brand/pii",
    "brand/jailbreak",
];
export const OPENAI_CATEGORY_HIERARCHY = {
    "sexual/minors": ["sexual"],
    "harassment/threatening": ["harassment"],
    "hate/threatening": ["hate"],
    "illicit/violent": ["illicit"],
    "self-harm/intent": ["self-harm"],
    "self-harm/instructions": ["self-harm"],
    "violence/graphic": ["violence"],
};
export function applyCategoryHierarchy(categories, categoryScores, hierarchy = OPENAI_CATEGORY_HIERARCHY) {
    const nextCategories = { ...categories };
    const nextScores = { ...categoryScores };
    for (const [child, parents] of Object.entries(hierarchy)) {
        const childScore = nextScores[child] ?? 0;
        const childFlagged = nextCategories[child] ?? false;
        for (const parent of parents) {
            nextScores[parent] = Math.max(nextScores[parent] ?? 0, childScore);
            nextCategories[parent] = (nextCategories[parent] ?? false) || childFlagged;
        }
    }
    return {
        categories: nextCategories,
        categoryScores: nextScores,
    };
}
export function createExtendedModerationCategorySet(extraCategories = []) {
    return [...new Set([
            ...OPENAI_MODERATION_CATEGORIES,
            ...DEFAULT_BRAND_SAFETY_CATEGORIES,
            ...extraCategories,
        ])];
}
export function createCustomModerationTaxonomy(categories) {
    return [...new Set(categories.map((category) => category.trim()).filter((category) => category.length > 0))];
}
//# sourceMappingURL=categories.js.map