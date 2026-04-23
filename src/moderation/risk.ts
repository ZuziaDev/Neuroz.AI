import type {
  ModerationDecision,
  ModerationUserRiskStoreLike,
} from "./platform-types.js";

export class ModerationUserRiskStore implements ModerationUserRiskStoreLike {
  private readonly riskByUser = new Map<string, number>();

  public async getRiskScore(userId: string): Promise<number> {
    return this.riskByUser.get(userId) ?? 0;
  }

  public async recordDecision(userId: string, decision: ModerationDecision): Promise<void> {
    const delta =
      decision.action === "block" || decision.action === "hard-block"
        ? 1.4
        : decision.action === "review" || decision.needsReview
          ? 0.6
          : decision.flagged
            ? 0.3
            : -0.05;

    const next = Math.max(0, (this.riskByUser.get(userId) ?? 0) + delta);
    this.riskByUser.set(userId, Number(next.toFixed(3)));
  }
}
