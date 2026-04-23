import type { ModerationBatchResult, ModerationContextMessage, ModerationEngineOptions, ModerationEngineResult, ModerationPolicyProfile, ModerationRequest } from "./platform-types.js";
export declare class ModerationEngine {
    private readonly options;
    private readonly ruleEngine;
    private readonly defaultPolicy;
    private readonly reviewQueue;
    private readonly auditLog;
    private readonly userRiskStore;
    constructor(options?: ModerationEngineOptions);
    moderate(request: ModerationRequest | string): Promise<ModerationEngineResult>;
    moderateWithPolicy(request: ModerationRequest | string, policy: ModerationPolicyProfile): Promise<ModerationEngineResult>;
    moderateBatch(requests: readonly ModerationRequest[]): Promise<ModerationBatchResult>;
    moderateConversation(conversation: readonly ModerationContextMessage[], request?: Omit<ModerationRequest, "input" | "conversation">): Promise<ModerationEngineResult>;
    moderateStream(chunks: readonly string[], request?: Omit<ModerationRequest, "input">): Promise<{
        chunks: ModerationEngineResult[];
        combined: ModerationEngineResult;
    }>;
    simulatePolicies(request: ModerationRequest, policies: readonly ModerationPolicyProfile[]): Promise<ModerationEngineResult[]>;
    private runModeration;
}
