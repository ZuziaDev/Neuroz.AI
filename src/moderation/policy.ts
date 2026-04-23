import { applyCategoryHierarchy } from "./categories.js";
import type {
  ModerationDecision,
  ModerationPolicyProfile,
  ModerationRuleResult,
} from "./platform-types.js";
import type { ModerationResultEntry, ModerationThresholds } from "./types.js";

function thresholdForCategory(
  thresholds: ModerationThresholds | undefined,
  category: string,
  fallback: number,
): number {
  return thresholds?.categories?.[category] ?? thresholds?.default ?? fallback;
}

export function createModerationPolicyProfile(
  mode: "strict" | "balanced" | "relaxed" | "custom",
  overrides: Partial<ModerationPolicyProfile> = {},
): ModerationPolicyProfile {
  const reviewMargin = overrides.reviewMargin ?? (mode === "strict" ? 0.15 : 0.08);
  const defaultThreshold =
    mode === "strict" ? 0.45 : mode === "relaxed" ? 0.7 : mode === "custom" ? 0.5 : 0.55;
  const defaultAction =
    mode === "strict" ? "review" : mode === "relaxed" ? "annotate" : "review";

  return {
    id: overrides.id ?? `${mode}-policy`,
    version: overrides.version ?? "v1",
    mode,
    applyHierarchy: overrides.applyHierarchy ?? true,
    defaultAction,
    reviewMargin,
    thresholds: {
      default: defaultThreshold,
      ...(overrides.thresholds ?? {}),
    },
    categoryActions: {
      harassment: { action: "review", threshold: 0.5 },
      "harassment/threatening": { action: "block", threshold: 0.45 },
      hate: { action: "review", threshold: 0.5 },
      "hate/threatening": { action: "block", threshold: 0.45 },
      "self-harm": { action: "review", threshold: 0.45 },
      "self-harm/intent": { action: "escalate", threshold: 0.35 },
      "self-harm/instructions": { action: "block", threshold: 0.3 },
      violence: { action: "review", threshold: 0.5 },
      "violence/graphic": { action: "block", threshold: 0.45 },
      "brand/pii": { action: "redact", threshold: 0.55 },
      "brand/jailbreak": { action: "block", threshold: 0.55 },
      "brand/phishing": { action: "block", threshold: 0.55 },
      "brand/scam": { action: "block", threshold: 0.55 },
      ...(overrides.categoryActions ?? {}),
    },
    risk: {
      reviewScore: 1.2,
      blockScore: 2.4,
      ...(overrides.risk ?? {}),
    },
    compliance: {
      redactPii: true,
      storeInputHashOnly: false,
      ...(overrides.compliance ?? {}),
    },
    shadowMode: overrides.shadowMode ?? false,
    locale: overrides.locale,
  };
}

export function createModerationPolicyFromDsl(
  id: string,
  version: string,
  dsl: string,
): ModerationPolicyProfile {
  const profile = createModerationPolicyProfile("custom", {
    id,
    version,
    categoryActions: {},
  });

  for (const line of dsl.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
    const match = /^if\s+([a-z0-9/_-]+)\s*>\s*(0(?:\.\d+)?|1(?:\.0+)?)\s+then\s+([a-z-]+)$/i.exec(line);
    if (match === null) {
      continue;
    }

    const [, rawCategory, rawThreshold, rawAction] = match;
    if (rawCategory === undefined || rawThreshold === undefined || rawAction === undefined) {
      continue;
    }

    const category = rawCategory;
    const threshold = rawThreshold;
    const action = rawAction;
    profile.categoryActions ??= {};
    profile.categoryActions[category] = {
      threshold: Number(threshold),
      action: action as ModerationDecision["action"],
      reasonCode: `${category.replaceAll("/", "_")}_${action}`,
    };
  }

  return profile;
}

export function mergeModerationSources(
  modelEntry: ModerationResultEntry | undefined,
  rules: ModerationRuleResult,
  applyHierarchy: boolean,
): ModerationResultEntry {
  const categoryScores = {
    ...(modelEntry?.category_scores ?? {}),
  };

  for (const [category, rawScore] of Object.entries(rules.categoryScores)) {
    const score = typeof rawScore === "number" ? rawScore : 0;
    categoryScores[category] = Math.max(categoryScores[category] ?? 0, score);
  }

  const categories = {
    ...(modelEntry?.categories ?? {}),
  };
  for (const [category, score] of Object.entries(categoryScores)) {
    categories[category] = (categories[category] ?? false) || score >= 0.5;
  }

  const applied = applyHierarchy
    ? applyCategoryHierarchy(categories, categoryScores)
    : { categories, categoryScores };

  return {
    flagged: Object.values(applied.categories).some(Boolean),
    categories: applied.categories,
    category_scores: applied.categoryScores,
    category_applied_input_types: Object.fromEntries(
      Object.keys(applied.categoryScores).map((category) => [
        category,
        applied.categories[category] ? ["text"] : [],
      ]),
    ),
  };
}

export function resolveModerationDecision(
  entry: ModerationResultEntry,
  policy: ModerationPolicyProfile,
  reasonCodes: readonly string[],
  riskScore: number = 0,
): ModerationDecision {
  let action = policy.defaultAction ?? "allow";
  let secondaryAction: ModerationDecision["secondaryAction"];
  let needsReview = false;

  for (const [category, rawScore] of Object.entries(entry.category_scores)) {
    const score = typeof rawScore === "number" ? rawScore : 0;
    const actionConfig = policy.categoryActions?.[category];
    const threshold = actionConfig?.threshold ?? thresholdForCategory(policy.thresholds, category, 0.5);
    const reviewThreshold =
      actionConfig?.reviewThreshold ?? Math.max(threshold - (policy.reviewMargin ?? 0.08), 0);

    if (score >= threshold) {
      action = actionConfig?.action ?? policy.defaultAction ?? "review";
      needsReview = needsReview || action === "review";
      if (action === "block" && (category.includes("self-harm") || category.includes("threatening"))) {
        secondaryAction = "escalate";
      }
      break;
    }

    if (score >= reviewThreshold) {
      needsReview = true;
      if (action === "allow") {
        action = "review";
      }
    }
  }

  if (riskScore >= (policy.risk?.blockScore ?? Number.POSITIVE_INFINITY) && action !== "block") {
    action = "block";
  } else if (
    riskScore >= (policy.risk?.reviewScore ?? Number.POSITIVE_INFINITY) &&
    action === "allow"
  ) {
    action = "review";
    needsReview = true;
  }

  const status =
    action === "allow" || action === "annotate" || action === "redact"
      ? entry.flagged
        ? "flagged"
        : "allowed"
      : action === "review" || action === "shadow-block"
        ? "review"
        : "blocked";

  return {
    action: policy.shadowMode ? "shadow-block" : action,
    status,
    flagged: entry.flagged,
    needsReview,
    reasonCodes: [...new Set(reasonCodes)],
    categories: { ...entry.categories },
    categoryScores: { ...entry.category_scores },
    policyId: policy.id,
    policyVersion: policy.version,
    riskScore,
    secondaryAction,
  };
}
