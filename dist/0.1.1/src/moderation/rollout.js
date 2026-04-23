function hashToUnitInterval(value) {
    let hash = 2166136261;
    for (const character of value) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 0xffffffff;
}
export class ModerationPolicyRegistry {
    versions = new Map();
    activeVersion = new Map();
    previousVersion = new Map();
    register(policy) {
        const existing = this.versions.get(policy.id) ?? [];
        const filtered = existing.filter((candidate) => candidate.version !== policy.version);
        filtered.push(policy);
        filtered.sort((left, right) => left.version.localeCompare(right.version));
        this.versions.set(policy.id, filtered);
        if (!this.activeVersion.has(policy.id)) {
            this.activeVersion.set(policy.id, policy.version);
        }
    }
    activate(policyId, version) {
        const versions = this.versions.get(policyId) ?? [];
        const exists = versions.some((candidate) => candidate.version === version);
        if (!exists) {
            throw new Error(`Unknown moderation policy version ${policyId}@${version}.`);
        }
        const previous = this.activeVersion.get(policyId);
        if (previous !== undefined && previous !== version) {
            this.previousVersion.set(policyId, previous);
        }
        this.activeVersion.set(policyId, version);
    }
    rollback(policyId) {
        const previous = this.previousVersion.get(policyId);
        if (previous === undefined) {
            return undefined;
        }
        this.activate(policyId, previous);
        return this.getActive(policyId);
    }
    getActive(policyId) {
        const versions = this.versions.get(policyId) ?? [];
        const active = this.activeVersion.get(policyId);
        return versions.find((candidate) => candidate.version === active);
    }
}
export class TenantModerationRegistry {
    tenantPolicies = new Map();
    setTenantPolicy(tenantId, policyId, version) {
        this.tenantPolicies.set(tenantId, version === undefined ? { policyId } : { policyId, version });
    }
    getTenantPolicy(tenantId) {
        return this.tenantPolicies.get(tenantId);
    }
}
export class ModerationRolloutManager {
    options;
    constructor(options) {
        this.options = options;
    }
    select(request) {
        const mode = this.options.mode ?? "single";
        const identity = request.userId ?? request.tenantId ?? request.inputId ?? request.input.slice(0, 32);
        if (mode === "single" || this.options.secondaryPolicy === undefined) {
            return {
                mode: "single",
                variant: "primary",
                primaryPolicy: this.options.primaryPolicy,
            };
        }
        if (mode === "shadow") {
            return {
                mode,
                variant: "primary-with-shadow",
                primaryPolicy: this.options.primaryPolicy,
                secondaryPolicy: this.options.secondaryPolicy,
            };
        }
        const ratio = hashToUnitInterval(identity);
        if (mode === "ab-test") {
            return {
                mode,
                variant: ratio < 0.5 ? "primary" : "secondary",
                primaryPolicy: ratio < 0.5 ? this.options.primaryPolicy : this.options.secondaryPolicy,
                secondaryPolicy: ratio < 0.5 ? this.options.secondaryPolicy : this.options.primaryPolicy,
            };
        }
        return {
            mode: "canary",
            variant: ratio < (this.options.canaryPercentage ?? 0.05) ? "secondary-canary" : "primary",
            primaryPolicy: ratio < (this.options.canaryPercentage ?? 0.05)
                ? this.options.secondaryPolicy
                : this.options.primaryPolicy,
            secondaryPolicy: ratio < (this.options.canaryPercentage ?? 0.05)
                ? this.options.primaryPolicy
                : this.options.secondaryPolicy,
        };
    }
}
//# sourceMappingURL=rollout.js.map