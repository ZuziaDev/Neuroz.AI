import type { ModerationBenchmarkCase, ModerationBenchmarkResult, ModerationDecision, ModerationEngineResult, ModerationPolicyProfile } from "./platform-types.js";
import type { ModerationResultEntry, ModerationThresholds } from "./types.js";
export interface ModerationCategoryMetrics {
    truePositive: number;
    trueNegative: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
    f1: number;
    accuracy: number;
}
export interface ModerationEvaluationSample {
    id: string;
    expectedCategories: Record<string, boolean>;
    predicted: ModerationResultEntry;
    expectedAction?: ModerationDecision["action"] | undefined;
    predictedAction?: ModerationDecision["action"] | undefined;
}
export interface ModerationEvaluationReport {
    sampleCount: number;
    categories: Record<string, ModerationCategoryMetrics>;
    macroF1: number;
    macroAccuracy: number;
    actionAccuracy?: number | undefined;
}
export declare function evaluateModerationSamples(samples: readonly ModerationEvaluationSample[]): ModerationEvaluationReport;
export declare function calibrateModerationThresholds(samples: readonly ModerationEvaluationSample[], categories?: readonly string[]): ModerationThresholds;
export declare function selectActiveLearningSamples(results: readonly ModerationEngineResult[], count: number): ModerationEngineResult[];
export declare function formatModerationReportAsMarkdown(report: ModerationEvaluationReport): string;
export declare function benchmarkModerationPolicies(cases: readonly ModerationBenchmarkCase[], policies: readonly ModerationPolicyProfile[], runPolicy: (policy: ModerationPolicyProfile, request: ModerationBenchmarkCase["request"]) => Promise<ModerationEngineResult>): Promise<ModerationBenchmarkResult[]>;
