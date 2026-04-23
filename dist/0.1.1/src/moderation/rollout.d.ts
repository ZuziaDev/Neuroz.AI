import type { ModerationPolicyProfile, ModerationRequest, ModerationRolloutManagerLike, ModerationRolloutSelection } from "./platform-types.js";
export declare class ModerationPolicyRegistry {
    private readonly versions;
    private readonly activeVersion;
    private readonly previousVersion;
    register(policy: ModerationPolicyProfile): void;
    activate(policyId: string, version: string): void;
    rollback(policyId: string): ModerationPolicyProfile | undefined;
    getActive(policyId: string): ModerationPolicyProfile | undefined;
}
export declare class TenantModerationRegistry {
    private readonly tenantPolicies;
    setTenantPolicy(tenantId: string, policyId: string, version?: string): void;
    getTenantPolicy(tenantId: string): {
        policyId: string;
        version?: string;
    } | undefined;
}
export interface ModerationRolloutManagerOptions {
    primaryPolicy: ModerationPolicyProfile;
    secondaryPolicy?: ModerationPolicyProfile | undefined;
    mode?: ModerationRolloutSelection["mode"];
    canaryPercentage?: number | undefined;
}
export declare class ModerationRolloutManager implements ModerationRolloutManagerLike {
    private readonly options;
    constructor(options: ModerationRolloutManagerOptions);
    select(request: ModerationRequest): ModerationRolloutSelection;
}
