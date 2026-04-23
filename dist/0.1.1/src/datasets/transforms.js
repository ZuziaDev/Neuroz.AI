import { ConfigurationError } from "../core/errors.js";
import { Dataset } from "./dataset.js";
function validateRows(rows) {
    if (rows.length === 0) {
        return 0;
    }
    const width = rows[0]?.length ?? 0;
    for (const row of rows) {
        if (row.length !== width) {
            throw new ConfigurationError("All numeric rows must have the same length.");
        }
    }
    return width;
}
export function normalizeRows(rows, options = {}) {
    const width = validateRows(rows);
    const epsilon = options.epsilon ?? 1e-8;
    if (rows.length === 0 || width === 0) {
        return {
            rows: rows.map((row) => [...row]),
            stats: {
                means: Array.from({ length: width }, () => 0),
                standardDeviations: Array.from({ length: width }, () => 1),
            },
        };
    }
    const means = Array.from({ length: width }, (_, columnIndex) => {
        const total = rows.reduce((sum, row) => sum + row[columnIndex], 0);
        return total / rows.length;
    });
    const standardDeviations = Array.from({ length: width }, (_, columnIndex) => {
        const variance = rows.reduce((sum, row) => {
            const centered = row[columnIndex] - means[columnIndex];
            return sum + centered * centered;
        }, 0) / rows.length;
        return Math.max(Math.sqrt(variance), epsilon);
    });
    const normalized = rows.map((row) => row.map((value, columnIndex) => (value - means[columnIndex]) / standardDeviations[columnIndex]));
    return {
        rows: normalized,
        stats: {
            means,
            standardDeviations,
        },
    };
}
export function applyRowNormalization(rows, stats) {
    validateRows(rows);
    if (stats.means.length !== stats.standardDeviations.length) {
        throw new ConfigurationError("Normalization stats must have matching vector lengths.");
    }
    return rows.map((row) => row.map((value, columnIndex) => (value - (stats.means[columnIndex] ?? 0)) /
        (stats.standardDeviations[columnIndex] ?? 1)));
}
export function normalizeDatasetInputs(dataset, options = {}) {
    const records = dataset instanceof Dataset ? dataset.toArray() : Array.from(dataset);
    const rows = records.map((record) => record.input);
    const normalized = normalizeRows(rows, options);
    return {
        dataset: new Dataset(records.map((record, index) => ({
            ...record,
            input: normalized.rows[index] ?? [...record.input],
        }))),
        stats: normalized.stats,
    };
}
export function applyDatasetInputNormalization(dataset, stats) {
    const records = dataset instanceof Dataset ? dataset.toArray() : Array.from(dataset);
    const rows = records.map((record) => record.input);
    const normalizedRows = applyRowNormalization(rows, stats);
    return new Dataset(records.map((record, index) => ({
        ...record,
        input: normalizedRows[index] ?? [...record.input],
    })));
}
//# sourceMappingURL=transforms.js.map