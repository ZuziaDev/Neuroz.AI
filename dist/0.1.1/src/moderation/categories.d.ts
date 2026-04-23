export declare const DEFAULT_BRAND_SAFETY_CATEGORIES: readonly ["brand/nsfw", "brand/politics", "brand/gambling", "brand/drugs", "brand/extremism", "brand/spam", "brand/scam", "brand/phishing", "brand/pii", "brand/jailbreak"];
export declare const OPENAI_CATEGORY_HIERARCHY: Record<string, readonly string[]>;
export declare function applyCategoryHierarchy(categories: Record<string, boolean>, categoryScores: Record<string, number>, hierarchy?: Record<string, readonly string[]>): {
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
};
export declare function createExtendedModerationCategorySet(extraCategories?: readonly string[]): string[];
export declare function createCustomModerationTaxonomy(categories: readonly string[]): string[];
