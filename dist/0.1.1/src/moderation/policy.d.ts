import type { ModerationDecision, ModerationPolicyProfile, ModerationRuleResult } from "./platform-types.js";
import type { ModerationResultEntry } from "./types.js";
export declare function createModerationPolicyProfile(mode: "strict" | "balanced" | "relaxed" | "custom", overrides?: Partial<ModerationPolicyProfile>): ModerationPolicyProfile;
export declare function createModerationPolicyFromDsl(id: string, version: string, dsl: string): ModerationPolicyProfile;
export declare function mergeModerationSources(modelEntry: ModerationResultEntry | undefined, rules: ModerationRuleResult, applyHierarchy: boolean): ModerationResultEntry;
export declare function resolveModerationDecision(entry: ModerationResultEntry, policy: ModerationPolicyProfile, reasonCodes: readonly string[], riskScore?: number): ModerationDecision;
