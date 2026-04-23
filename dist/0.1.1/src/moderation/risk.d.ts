import type { ModerationDecision, ModerationUserRiskStoreLike } from "./platform-types.js";
export declare class ModerationUserRiskStore implements ModerationUserRiskStoreLike {
    private readonly riskByUser;
    getRiskScore(userId: string): Promise<number>;
    recordDecision(userId: string, decision: ModerationDecision): Promise<void>;
}
