export class ModerationUserRiskStore {
    riskByUser = new Map();
    async getRiskScore(userId) {
        return this.riskByUser.get(userId) ?? 0;
    }
    async recordDecision(userId, decision) {
        const delta = decision.action === "block" || decision.action === "hard-block"
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
//# sourceMappingURL=risk.js.map