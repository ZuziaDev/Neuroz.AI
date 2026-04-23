import { randomUUID } from "node:crypto";
import { ModerationAuditLog } from "./audit.js";
import { detectModerationLanguage } from "./language.js";
import { normalizeModerationText } from "./normalization.js";
import { createModerationPolicyProfile, mergeModerationSources, resolveModerationDecision, } from "./policy.js";
import { ModerationReviewQueue } from "./queue.js";
import { ModerationUserRiskStore } from "./risk.js";
import { ModerationRuleEngine } from "./rules.js";
function topCategories(entry, count = 5) {
    return Object.entries(entry.category_scores)
        .sort((left, right) => right[1] - left[1])
        .slice(0, count)
        .map(([category, score]) => ({
        category,
        score,
        flagged: entry.categories[category] ?? false,
    }));
}
function scoreReasonCodes(entry) {
    return Object.entries(entry.category_scores)
        .filter((entryValue) => entryValue[1] >= 0.5)
        .map(([category]) => `${category.replaceAll("/", "_")}_score`);
}
function normalizeRequest(request) {
    return typeof request === "string" ? { input: request } : request;
}
function normalizeConversation(conversation = []) {
    return conversation.map((message) => message.text).join("\n");
}
export class ModerationEngine {
    options;
    ruleEngine;
    defaultPolicy;
    reviewQueue;
    auditLog;
    userRiskStore;
    constructor(options = {}) {
        this.options = options;
        this.ruleEngine = new ModerationRuleEngine(options.rules);
        this.defaultPolicy =
            options.policy ?? options.policies?.[0] ?? createModerationPolicyProfile("balanced");
        this.reviewQueue =
            options.reviewQueue instanceof ModerationReviewQueue ? options.reviewQueue : undefined;
        this.auditLog =
            options.auditLog instanceof ModerationAuditLog ? options.auditLog : undefined;
        this.userRiskStore =
            options.userRiskStore instanceof ModerationUserRiskStore
                ? options.userRiskStore
                : new ModerationUserRiskStore();
    }
    async moderate(request) {
        return this.runModeration(normalizeRequest(request), undefined);
    }
    async moderateWithPolicy(request, policy) {
        return this.runModeration(normalizeRequest(request), policy);
    }
    async moderateBatch(requests) {
        return {
            items: await Promise.all(requests.map((request) => this.moderate(request))),
        };
    }
    async moderateConversation(conversation, request = {}) {
        return this.moderate({
            ...request,
            input: normalizeConversation(conversation),
            conversation: [...conversation],
        });
    }
    async moderateStream(chunks, request = {}) {
        const chunkResults = [];
        let combined = "";
        for (const chunk of chunks) {
            combined += chunk;
            chunkResults.push(await this.moderate({
                ...request,
                input: combined,
            }));
        }
        return {
            chunks: chunkResults,
            combined: chunkResults[chunkResults.length - 1] ?? (await this.moderate({ ...request, input: combined })),
        };
    }
    async simulatePolicies(request, policies) {
        return Promise.all(policies.map((policy) => this.moderateWithPolicy(request, policy)));
    }
    async runModeration(request, forcedPolicy) {
        for (const plugin of this.options.plugins ?? []) {
            await plugin.beforeNormalize?.(request);
        }
        const normalization = {
            ...(this.options.normalization ?? {}),
            ...(request.locale !== undefined ? this.options.localeProfiles?.[request.locale] : {}),
        };
        const normalized = normalizeModerationText(request.input, normalization);
        for (const plugin of this.options.plugins ?? []) {
            await plugin.afterNormalize?.(request, normalized);
        }
        const language = detectModerationLanguage(normalized.text);
        const rules = await this.ruleEngine.evaluate({
            request,
            normalized,
            language,
            recentMessages: request.conversation ?? [],
        });
        for (const plugin of this.options.plugins ?? []) {
            await plugin.afterRules?.(request, rules);
        }
        const prediction = this.options.model !== undefined
            ? await this.options.model.predict(normalized.text)
            : undefined;
        for (const plugin of this.options.plugins ?? []) {
            await plugin.afterPrediction?.(request, prediction);
        }
        const rollout = this.options.rolloutManager?.select(request) ?? {
            mode: "single",
            variant: "primary",
            primaryPolicy: forcedPolicy ?? this.defaultPolicy,
        };
        const activePolicy = forcedPolicy ?? rollout.primaryPolicy;
        const mergedResult = mergeModerationSources(prediction?.results[0], rules, activePolicy.applyHierarchy ?? true);
        const riskScore = request.userId !== undefined ? await this.userRiskStore.getRiskScore(request.userId) : 0;
        const decision = resolveModerationDecision(mergedResult, activePolicy, [...rules.reasonCodes, ...scoreReasonCodes(mergedResult)], riskScore);
        if (rollout.secondaryPolicy !== undefined && rollout.mode !== "single") {
            const secondary = resolveModerationDecision(mergedResult, rollout.secondaryPolicy, [...rules.reasonCodes, ...scoreReasonCodes(mergedResult)], riskScore);
            decision.secondaryAction = secondary.action;
        }
        const explanation = {
            summary: decision.flagged
                ? `Flagged with action "${decision.action}" under ${decision.policyId}@${decision.policyVersion}.`
                : `Allowed by ${decision.policyId}@${decision.policyVersion}.`,
            matchedRules: rules.hits,
            topCategories: topCategories(mergedResult),
            modelExplanation: this.options.model?.explain !== undefined
                ? await this.options.model.explain(normalized.text)
                : undefined,
        };
        let reviewItemId;
        if (decision.needsReview && this.options.reviewQueue !== undefined) {
            const item = await this.options.reviewQueue.enqueue({
                request,
                decision,
                explanation,
            });
            reviewItemId = item.id;
        }
        let auditEventId;
        if (this.options.auditLog !== undefined) {
            const policy = activePolicy;
            const event = await this.options.auditLog.append({
                id: `audit-${randomUUID().replaceAll("-", "")}`,
                type: "decision",
                createdAt: new Date().toISOString(),
                tenantId: request.tenantId,
                userId: request.userId,
                inputHash: policy.compliance?.storeInputHashOnly === true
                    ? ModerationAuditLog.hashInput(request.input)
                    : undefined,
                inputPreview: policy.compliance?.storeInputHashOnly === true ? undefined : request.input.slice(0, 160),
                policyId: decision.policyId,
                policyVersion: decision.policyVersion,
                action: decision.action,
                categories: decision.categories,
                reasonCodes: decision.reasonCodes,
            });
            auditEventId = event.id;
        }
        if (request.userId !== undefined) {
            await this.userRiskStore.recordDecision(request.userId, decision);
        }
        const result = {
            request,
            normalized,
            language,
            model: prediction,
            rules,
            mergedResult,
            decision,
            explanation,
            reviewItemId,
            auditEventId,
            rollout,
        };
        if (this.options.webhook !== undefined) {
            await this.options.webhook({
                type: "moderation.decision",
                createdAt: new Date().toISOString(),
                payload: result,
            });
        }
        for (const plugin of this.options.plugins ?? []) {
            await plugin.afterDecision?.(result);
        }
        return result;
    }
}
//# sourceMappingURL=engine.js.map