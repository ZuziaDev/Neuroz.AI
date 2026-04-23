import type { ModerationTrainingExample } from "../text/types.js";
import type { ModerationPredictionExplanation, ModerationPredictionResult, ModerationResultEntry, ModerationThresholds } from "./types.js";
export type ModerationLanguage = "en" | "tr" | "unknown";
export type ModerationAction = "allow" | "annotate" | "review" | "soft-block" | "block" | "hard-block" | "shadow-block" | "escalate" | "redact";
export type ModerationStatus = "allowed" | "flagged" | "review" | "blocked";
export type ModerationPolicyMode = "strict" | "balanced" | "relaxed" | "custom";
export type ModerationRolloutMode = "single" | "shadow" | "ab-test" | "canary";
export interface ModerationContextMessage {
    role?: string | undefined;
    text: string;
    createdAt?: string | undefined;
}
export interface ModerationRequest {
    input: string;
    inputId?: string | undefined;
    tenantId?: string | undefined;
    userId?: string | undefined;
    locale?: string | undefined;
    tags?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
    conversation?: ModerationContextMessage[] | undefined;
}
export interface ModerationNormalizationOptions {
    lowercase?: boolean | undefined;
    unicodeForm?: "NFC" | "NFKC" | "NFD" | "NFKD" | undefined;
    collapseWhitespace?: boolean | undefined;
    stripZeroWidth?: boolean | undefined;
    decodeLeetspeak?: boolean | undefined;
    collapseRepeatedCharacters?: boolean | undefined;
    deobfuscateSeparators?: boolean | undefined;
    trim?: boolean | undefined;
}
export interface NormalizedModerationText {
    originalText: string;
    text: string;
    operations: string[];
    containsObfuscation: boolean;
}
export interface ModerationDetectedLanguage {
    language: ModerationLanguage;
    confidence: number;
    reasons: string[];
}
export interface ModerationRuleContext {
    request: ModerationRequest;
    normalized: NormalizedModerationText;
    language: ModerationDetectedLanguage;
    recentMessages: ModerationContextMessage[];
}
export interface ModerationRuleHit {
    ruleId: string;
    category: string;
    score: number;
    reasonCode: string;
    excerpt?: string | undefined;
    action?: ModerationAction | undefined;
    metadata?: Record<string, unknown> | undefined;
}
export interface ModerationRule {
    id: string;
    name: string;
    description?: string | undefined;
    evaluate(context: ModerationRuleContext): ModerationRuleHit[] | Promise<ModerationRuleHit[]>;
}
export interface ModerationRuleResult {
    hits: ModerationRuleHit[];
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
    reasonCodes: string[];
}
export interface ModerationPolicyCategoryAction {
    threshold?: number | undefined;
    reviewThreshold?: number | undefined;
    action?: ModerationAction | undefined;
    reasonCode?: string | undefined;
}
export interface ModerationPolicyProfile {
    id: string;
    version: string;
    mode?: ModerationPolicyMode | undefined;
    locale?: string | undefined;
    shadowMode?: boolean | undefined;
    applyHierarchy?: boolean | undefined;
    thresholds?: ModerationThresholds | undefined;
    categoryActions?: Record<string, ModerationPolicyCategoryAction> | undefined;
    defaultAction?: ModerationAction | undefined;
    reviewMargin?: number | undefined;
    risk?: {
        reviewScore?: number | undefined;
        blockScore?: number | undefined;
    } | undefined;
    compliance?: {
        redactPii?: boolean | undefined;
        storeInputHashOnly?: boolean | undefined;
        retainAuditDays?: number | undefined;
    } | undefined;
}
export interface ModerationDecision {
    action: ModerationAction;
    status: ModerationStatus;
    flagged: boolean;
    needsReview: boolean;
    reasonCodes: string[];
    categories: Record<string, boolean>;
    categoryScores: Record<string, number>;
    policyId: string;
    policyVersion: string;
    riskScore?: number | undefined;
    secondaryAction?: ModerationAction | undefined;
}
export interface ModerationCategoryExplanation {
    category: string;
    score: number;
    flagged: boolean;
}
export interface ModerationModelExplanation extends ModerationPredictionExplanation {
}
export interface ModerationExplanation {
    summary: string;
    matchedRules: ModerationRuleHit[];
    topCategories: ModerationCategoryExplanation[];
    modelExplanation?: ModerationModelExplanation | undefined;
}
export interface ModerationModelRunner {
    predict(text: string): Promise<ModerationPredictionResult>;
    predictMany?(texts: readonly string[]): Promise<ModerationPredictionResult[]>;
    explain?(text: string): Promise<ModerationModelExplanation>;
    moderationCategories?: string[] | undefined;
}
export interface ModerationBatchItem {
    request: ModerationRequest;
    normalized: NormalizedModerationText;
    language: ModerationDetectedLanguage;
    model?: ModerationPredictionResult | undefined;
    rules: ModerationRuleResult;
    mergedResult: ModerationResultEntry;
    decision: ModerationDecision;
    explanation: ModerationExplanation;
    reviewItemId?: string | undefined;
    auditEventId?: string | undefined;
    rollout?: ModerationRolloutSelection | undefined;
}
export interface ModerationEngineResult extends ModerationBatchItem {
}
export interface ModerationBatchResult {
    items: ModerationBatchItem[];
}
export interface ModerationStreamChunk {
    chunk: string;
    sequence: number;
}
export interface ModerationStreamResult {
    chunks: ModerationBatchItem[];
    combined: ModerationBatchItem;
}
export interface ModerationRolloutSelection {
    mode: ModerationRolloutMode;
    variant: string;
    primaryPolicy: ModerationPolicyProfile;
    secondaryPolicy?: ModerationPolicyProfile | undefined;
}
export interface ModerationWebhookEvent {
    type: "moderation.decision";
    createdAt: string;
    payload: ModerationEngineResult;
}
export interface ModerationReviewQueueLike {
    enqueue(item: ModerationReviewDraft): Promise<ModerationReviewItem>;
}
export interface ModerationAuditLogLike {
    append(event: ModerationAuditEvent): Promise<ModerationAuditEvent>;
}
export interface ModerationUserRiskStoreLike {
    getRiskScore(userId: string): Promise<number>;
    recordDecision(userId: string, decision: ModerationDecision): Promise<void>;
}
export interface ModerationRolloutManagerLike {
    select(request: ModerationRequest): ModerationRolloutSelection;
}
export interface ModerationEngineOptions {
    model?: ModerationModelRunner | undefined;
    rules?: ModerationRule[] | undefined;
    policy?: ModerationPolicyProfile | undefined;
    policies?: ModerationPolicyProfile[] | undefined;
    normalization?: ModerationNormalizationOptions | undefined;
    localeProfiles?: Record<string, Partial<ModerationNormalizationOptions>> | undefined;
    reviewQueue?: ModerationReviewQueueLike | undefined;
    auditLog?: ModerationAuditLogLike | undefined;
    userRiskStore?: ModerationUserRiskStoreLike | undefined;
    rolloutManager?: ModerationRolloutManagerLike | undefined;
    webhook?: ((event: ModerationWebhookEvent) => void | Promise<void>) | undefined;
    plugins?: ModerationPlugin[] | undefined;
}
export interface ModerationPlugin {
    name: string;
    beforeNormalize?(request: ModerationRequest): void | Promise<void>;
    afterNormalize?(request: ModerationRequest, normalized: NormalizedModerationText): void | Promise<void>;
    afterRules?(request: ModerationRequest, rules: ModerationRuleResult): void | Promise<void>;
    afterPrediction?(request: ModerationRequest, prediction: ModerationPredictionResult | undefined): void | Promise<void>;
    afterDecision?(result: ModerationEngineResult): void | Promise<void>;
}
export interface ModerationReviewDraft {
    request: ModerationRequest;
    decision: ModerationDecision;
    explanation: ModerationExplanation;
}
export interface ModerationReviewItem extends ModerationReviewDraft {
    id: string;
    status: "open" | "resolved" | "appealed";
    createdAt: string;
    updatedAt: string;
    resolution?: string | undefined;
    reviewerId?: string | undefined;
    appeal?: {
        reason: string;
        createdAt: string;
    } | undefined;
    humanLabel?: ModerationTrainingExample | undefined;
}
export interface ModerationAuditEvent {
    id: string;
    type: "decision" | "appeal" | "resolution" | "feedback";
    createdAt: string;
    tenantId?: string | undefined;
    userId?: string | undefined;
    inputHash?: string | undefined;
    inputPreview?: string | undefined;
    policyId?: string | undefined;
    policyVersion?: string | undefined;
    action?: ModerationAction | undefined;
    categories?: Record<string, boolean> | undefined;
    reasonCodes?: string[] | undefined;
    metadata?: Record<string, unknown> | undefined;
}
export interface ModerationDatasetRecord extends ModerationTrainingExample {
    id?: string | undefined;
    locale?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}
export interface ModerationBenchmarkCase {
    id: string;
    request: ModerationRequest;
    expectedCategories: Record<string, boolean>;
    expectedAction?: ModerationAction | undefined;
}
export interface ModerationBenchmarkResult {
    policyId: string;
    policyVersion: string;
    sampleCount: number;
    actionAccuracy: number;
    categoryAccuracy: number;
    decisions: ModerationEngineResult[];
}
