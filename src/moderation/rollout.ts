import type {
  ModerationPolicyProfile,
  ModerationRequest,
  ModerationRolloutManagerLike,
  ModerationRolloutSelection,
} from "./platform-types.js";

function hashToUnitInterval(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 0xffffffff;
}

export class ModerationPolicyRegistry {
  private readonly versions = new Map<string, ModerationPolicyProfile[]>();
  private readonly activeVersion = new Map<string, string>();
  private readonly previousVersion = new Map<string, string>();

  public register(policy: ModerationPolicyProfile): void {
    const existing = this.versions.get(policy.id) ?? [];
    const filtered = existing.filter((candidate) => candidate.version !== policy.version);
    filtered.push(policy);
    filtered.sort((left, right) => left.version.localeCompare(right.version));
    this.versions.set(policy.id, filtered);

    if (!this.activeVersion.has(policy.id)) {
      this.activeVersion.set(policy.id, policy.version);
    }
  }

  public activate(policyId: string, version: string): void {
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

  public rollback(policyId: string): ModerationPolicyProfile | undefined {
    const previous = this.previousVersion.get(policyId);
    if (previous === undefined) {
      return undefined;
    }

    this.activate(policyId, previous);
    return this.getActive(policyId);
  }

  public getActive(policyId: string): ModerationPolicyProfile | undefined {
    const versions = this.versions.get(policyId) ?? [];
    const active = this.activeVersion.get(policyId);
    return versions.find((candidate) => candidate.version === active);
  }
}

export class TenantModerationRegistry {
  private readonly tenantPolicies = new Map<string, { policyId: string; version?: string }>();

  public setTenantPolicy(tenantId: string, policyId: string, version?: string): void {
    this.tenantPolicies.set(
      tenantId,
      version === undefined ? { policyId } : { policyId, version },
    );
  }

  public getTenantPolicy(tenantId: string): { policyId: string; version?: string } | undefined {
    return this.tenantPolicies.get(tenantId);
  }
}

export interface ModerationRolloutManagerOptions {
  primaryPolicy: ModerationPolicyProfile;
  secondaryPolicy?: ModerationPolicyProfile | undefined;
  mode?: ModerationRolloutSelection["mode"];
  canaryPercentage?: number | undefined;
}

export class ModerationRolloutManager implements ModerationRolloutManagerLike {
  public constructor(
    private readonly options: ModerationRolloutManagerOptions,
  ) {}

  public select(request: ModerationRequest): ModerationRolloutSelection {
    const mode = this.options.mode ?? "single";
    const identity =
      request.userId ?? request.tenantId ?? request.inputId ?? request.input.slice(0, 32);

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
      variant:
        ratio < (this.options.canaryPercentage ?? 0.05) ? "secondary-canary" : "primary",
      primaryPolicy:
        ratio < (this.options.canaryPercentage ?? 0.05)
          ? this.options.secondaryPolicy
          : this.options.primaryPolicy,
      secondaryPolicy:
        ratio < (this.options.canaryPercentage ?? 0.05)
          ? this.options.primaryPolicy
          : this.options.secondaryPolicy,
    };
  }
}
