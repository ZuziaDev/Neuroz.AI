function safeDivide(numerator, denominator) {
    return denominator === 0 ? 0 : numerator / denominator;
}
function metricFromCounts(truePositive, trueNegative, falsePositive, falseNegative) {
    const precision = safeDivide(truePositive, truePositive + falsePositive);
    const recall = safeDivide(truePositive, truePositive + falseNegative);
    const f1 = safeDivide(2 * precision * recall, precision + recall);
    const accuracy = safeDivide(truePositive + trueNegative, truePositive + trueNegative + falsePositive + falseNegative);
    return {
        truePositive,
        trueNegative,
        falsePositive,
        falseNegative,
        precision,
        recall,
        f1,
        accuracy,
    };
}
export function evaluateModerationSamples(samples) {
    const categories = new Set();
    for (const sample of samples) {
        for (const category of Object.keys(sample.expectedCategories)) {
            categories.add(category);
        }
        for (const category of Object.keys(sample.predicted.categories)) {
            categories.add(category);
        }
    }
    const reportCategories = {};
    for (const category of categories) {
        let truePositive = 0;
        let trueNegative = 0;
        let falsePositive = 0;
        let falseNegative = 0;
        for (const sample of samples) {
            const expected = sample.expectedCategories[category] ?? false;
            const predicted = sample.predicted.categories[category] ?? false;
            if (expected && predicted) {
                truePositive += 1;
            }
            else if (!expected && !predicted) {
                trueNegative += 1;
            }
            else if (!expected && predicted) {
                falsePositive += 1;
            }
            else {
                falseNegative += 1;
            }
        }
        reportCategories[category] = metricFromCounts(truePositive, trueNegative, falsePositive, falseNegative);
    }
    const categoryValues = Object.values(reportCategories);
    const actionComparable = samples.filter((sample) => sample.expectedAction !== undefined && sample.predictedAction !== undefined);
    return {
        sampleCount: samples.length,
        categories: reportCategories,
        macroF1: safeDivide(categoryValues.reduce((total, value) => total + value.f1, 0), categoryValues.length),
        macroAccuracy: safeDivide(categoryValues.reduce((total, value) => total + value.accuracy, 0), categoryValues.length),
        actionAccuracy: actionComparable.length > 0
            ? safeDivide(actionComparable.filter((sample) => sample.expectedAction === sample.predictedAction).length, actionComparable.length)
            : undefined,
    };
}
export function calibrateModerationThresholds(samples, categories) {
    const categorySet = new Set(categories ?? []);
    if (categorySet.size === 0) {
        for (const sample of samples) {
            for (const category of Object.keys(sample.expectedCategories)) {
                categorySet.add(category);
            }
        }
    }
    const calibrated = {};
    for (const category of categorySet) {
        let bestThreshold = 0.5;
        let bestF1 = -1;
        for (let threshold = 0.1; threshold <= 0.9; threshold += 0.05) {
            const report = evaluateModerationSamples(samples.map((sample) => ({
                ...sample,
                predicted: {
                    ...sample.predicted,
                    categories: {
                        ...sample.predicted.categories,
                        [category]: (sample.predicted.category_scores[category] ?? 0) >= threshold,
                    },
                },
            })));
            const f1 = report.categories[category]?.f1 ?? 0;
            if (f1 > bestF1) {
                bestF1 = f1;
                bestThreshold = Number(threshold.toFixed(2));
            }
        }
        calibrated[category] = bestThreshold;
    }
    return {
        categories: calibrated,
    };
}
export function selectActiveLearningSamples(results, count) {
    return [...results]
        .sort((left, right) => {
        const leftDistance = Math.min(...Object.values(left.decision.categoryScores).map((score) => Math.abs(score - 0.5)));
        const rightDistance = Math.min(...Object.values(right.decision.categoryScores).map((score) => Math.abs(score - 0.5)));
        return leftDistance - rightDistance;
    })
        .slice(0, Math.max(0, count));
}
export function formatModerationReportAsMarkdown(report) {
    const lines = [
        "# Moderation Evaluation Report",
        "",
        `Samples: ${report.sampleCount}`,
        `Macro F1: ${report.macroF1.toFixed(3)}`,
        `Macro Accuracy: ${report.macroAccuracy.toFixed(3)}`,
    ];
    if (report.actionAccuracy !== undefined) {
        lines.push(`Action Accuracy: ${report.actionAccuracy.toFixed(3)}`);
    }
    lines.push("", "| Category | Precision | Recall | F1 | Accuracy |", "| --- | ---: | ---: | ---: | ---: |");
    for (const [category, metrics] of Object.entries(report.categories)) {
        lines.push(`| ${category} | ${metrics.precision.toFixed(3)} | ${metrics.recall.toFixed(3)} | ${metrics.f1.toFixed(3)} | ${metrics.accuracy.toFixed(3)} |`);
    }
    return lines.join("\n");
}
export async function benchmarkModerationPolicies(cases, policies, runPolicy) {
    const results = [];
    for (const policy of policies) {
        const decisions = await Promise.all(cases.map((benchmarkCase) => runPolicy(policy, benchmarkCase.request)));
        const categoryChecks = decisions.flatMap((decision, index) => {
            const expected = cases[index]?.expectedCategories ?? {};
            const categories = new Set([
                ...Object.keys(expected),
                ...Object.keys(decision.decision.categories),
            ]);
            return [...categories].map((category) => ({
                expected: expected[category] ?? false,
                actual: decision.decision.categories[category] ?? false,
            }));
        });
        const actionComparable = decisions.filter((decision, index) => cases[index]?.expectedAction !== undefined);
        results.push({
            policyId: policy.id,
            policyVersion: policy.version,
            sampleCount: cases.length,
            actionAccuracy: actionComparable.length === 0
                ? 0
                : safeDivide(actionComparable.filter((decision, index) => decision.decision.action === cases[index]?.expectedAction).length, actionComparable.length),
            categoryAccuracy: safeDivide(categoryChecks.filter((check) => check.expected === check.actual).length, categoryChecks.length),
            decisions,
        });
    }
    return results;
}
//# sourceMappingURL=evaluation.js.map