import type { ModerationRule, ModerationRuleContext, ModerationRuleResult } from "./platform-types.js";
export declare function createBuiltinModerationRules(): ModerationRule[];
export declare class ModerationRuleEngine {
    private readonly rules;
    constructor(rules?: readonly ModerationRule[]);
    evaluate(context: ModerationRuleContext): Promise<ModerationRuleResult>;
}
