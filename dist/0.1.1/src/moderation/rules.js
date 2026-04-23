function buildKeywordRule(id, name, category, keywords, reasonCode, score) {
    return {
        id,
        name,
        evaluate(context) {
            const hits = keywords
                .filter((keyword) => context.normalized.text.includes(keyword))
                .map((keyword) => ({
                ruleId: id,
                category,
                score,
                reasonCode,
                excerpt: keyword,
            }));
            return hits;
        },
    };
}
export function createBuiltinModerationRules() {
    return [
        buildKeywordRule("rule-harassment-keywords", "Harassment keywords", "harassment", ["idiot", "stupid", "moron", "salak", "aptal"], "harassment_keyword", 0.92),
        buildKeywordRule("rule-hate-keywords", "Hate keywords", "hate", ["i hate you", "nefret ediyorum", "hate you"], "hate_keyword", 0.95),
        buildKeywordRule("rule-brand-spam", "Spam keywords", "brand/spam", ["buy now", "limited offer", "free money", "hemen tikla"], "spam_keyword", 0.86),
        buildKeywordRule("rule-brand-gambling", "Gambling keywords", "brand/gambling", ["casino", "bet now", "sportsbook", "bahis"], "gambling_keyword", 0.84),
        buildKeywordRule("rule-brand-drugs", "Drugs keywords", "brand/drugs", ["cocaine", "meth", "buy weed", "uyusturucu"], "drugs_keyword", 0.9),
        buildKeywordRule("rule-brand-extremism", "Extremism keywords", "brand/extremism", ["join our extremist group", "terror cell", "extremist manifesto"], "extremism_keyword", 0.97),
        buildKeywordRule("rule-brand-politics", "Politics keywords", "brand/politics", ["election", "vote for", "political campaign", "secim"], "politics_keyword", 0.62),
        buildKeywordRule("rule-brand-nsfw", "NSFW keywords", "brand/nsfw", ["explicit content", "porn", "nsfw"], "nsfw_keyword", 0.9),
        buildKeywordRule("rule-self-harm", "Self-harm keywords", "self-harm", ["kill myself", "hurt myself", "kendime zarar"], "self_harm_keyword", 0.98),
        buildKeywordRule("rule-jailbreak", "Prompt injection keywords", "brand/jailbreak", ["ignore previous instructions", "reveal system prompt", "developer mode"], "jailbreak_keyword", 0.94),
        buildKeywordRule("rule-brand-phishing", "Phishing keywords", "brand/phishing", ["verify your account", "reset your bank password", "wallet seed phrase"], "phishing_keyword", 0.95),
        buildKeywordRule("rule-brand-scam", "Scam keywords", "brand/scam", ["guaranteed return", "double your money", "send crypto first"], "scam_keyword", 0.94),
        {
            id: "rule-pii",
            name: "PII detection",
            evaluate(context) {
                const hits = [];
                const searchableTexts = [context.normalized.originalText, context.normalized.text];
                const emailMatches = new Set();
                const phoneMatches = new Set();
                const ibanMatches = new Set();
                const cardMatches = new Set();
                for (const text of searchableTexts) {
                    for (const match of text.match(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi) ?? []) {
                        emailMatches.add(match);
                    }
                    for (const match of text.match(/\b(?:\+?\d{1,3}[- ]?)?(?:\d[- ]?){9,12}\b/g) ?? []) {
                        phoneMatches.add(match);
                    }
                    for (const match of text.match(/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi) ?? []) {
                        ibanMatches.add(match);
                    }
                    for (const match of text.match(/\b(?:\d[ -]*?){13,19}\b/g) ?? []) {
                        cardMatches.add(match);
                    }
                }
                for (const match of [...emailMatches, ...phoneMatches, ...ibanMatches]) {
                    hits.push({
                        ruleId: "rule-pii",
                        category: "brand/pii",
                        score: 0.98,
                        reasonCode: "pii_detected",
                        excerpt: match,
                    });
                }
                for (const match of cardMatches) {
                    const digitsOnly = match.replace(/\D/g, "");
                    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
                        hits.push({
                            ruleId: "rule-pii",
                            category: "brand/pii",
                            score: 0.99,
                            reasonCode: "payment_card_detected",
                            excerpt: match,
                        });
                    }
                }
                return hits;
            },
        },
        {
            id: "rule-obfuscation",
            name: "Adversarial obfuscation",
            evaluate(context) {
                if (!context.normalized.containsObfuscation) {
                    return [];
                }
                return [
                    {
                        ruleId: "rule-obfuscation",
                        category: "brand/spam",
                        score: 0.58,
                        reasonCode: "obfuscation_detected",
                        excerpt: context.request.input,
                    },
                ];
            },
        },
    ];
}
export class ModerationRuleEngine {
    rules;
    constructor(rules = createBuiltinModerationRules()) {
        this.rules = [...rules];
    }
    async evaluate(context) {
        const hits = (await Promise.all(this.rules.map((rule) => Promise.resolve(rule.evaluate(context))))).flat();
        const categoryScores = {};
        for (const hit of hits) {
            categoryScores[hit.category] = Math.max(categoryScores[hit.category] ?? 0, hit.score);
        }
        return {
            hits,
            categories: Object.fromEntries(Object.entries(categoryScores).map(([category, score]) => [category, score >= 0.5])),
            categoryScores,
            reasonCodes: [...new Set(hits.map((hit) => hit.reasonCode))],
        };
    }
}
//# sourceMappingURL=rules.js.map