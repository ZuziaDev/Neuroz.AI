import { readFile } from "node:fs/promises";
import path from "node:path";
function parseCsvLine(line) {
    const columns = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        const next = line[index + 1];
        if (character === "\"") {
            if (inQuotes && next === "\"") {
                current += "\"";
                index += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (character === "," && !inQuotes) {
            columns.push(current);
            current = "";
            continue;
        }
        current += character;
    }
    columns.push(current);
    return columns.map((value) => value.trim());
}
function toBoolean(value) {
    if (typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        return value !== 0;
    }
    if (typeof value === "string") {
        return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
    }
    return false;
}
function normalizeRecord(record, options = {}) {
    const textField = options.textField ?? "text";
    const categoryFields = options.categoryFields ??
        Object.keys(record).filter((field) => field !== textField && field !== "id" && field !== "locale");
    return {
        id: typeof record.id === "string" ? record.id : undefined,
        text: String(record[textField] ?? ""),
        locale: typeof record.locale === "string" ? record.locale : undefined,
        categories: Object.fromEntries(categoryFields.map((field) => [field, toBoolean(record[field])])),
        metadata: record,
    };
}
export async function loadModerationDatasetFromJson(filePath, options = {}) {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    const records = Array.isArray(parsed) ? parsed : [parsed];
    return records.map((record) => normalizeRecord(record, options));
}
export async function loadModerationDatasetFromJsonl(filePath, options = {}) {
    const lines = (await readFile(filePath, "utf8"))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    return lines.map((line) => normalizeRecord(JSON.parse(line), options));
}
export async function loadModerationDatasetFromCsv(filePath, options = {}) {
    const lines = (await readFile(filePath, "utf8"))
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);
    const [headerLine, ...rows] = lines;
    const headers = parseCsvLine(headerLine ?? "");
    return rows.map((row) => {
        const values = parseCsvLine(row);
        const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
        return normalizeRecord(record, options);
    });
}
export async function loadModerationDatasetFromFile(filePath, options = {}) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
        case ".json":
            return loadModerationDatasetFromJson(filePath, options);
        case ".jsonl":
            return loadModerationDatasetFromJsonl(filePath, options);
        case ".csv":
            return loadModerationDatasetFromCsv(filePath, options);
        default:
            throw new Error(`Unsupported moderation dataset format: ${extension}`);
    }
}
export function distillModerationDatasetFromOpenAIStyleResponses(examples) {
    return examples.map((example, index) => ({
        id: `distilled-${index + 1}`,
        text: example.text,
        categories: {
            ...(example.response.results[0]?.categories ?? {}),
        },
        metadata: {
            sourceModel: example.response.model,
            sourceId: example.response.id,
        },
    }));
}
export function synthesizeModerationExamples(examples) {
    const variants = [];
    for (const example of examples) {
        variants.push(example);
        variants.push({
            ...example,
            id: example.id !== undefined ? `${example.id}-upper` : undefined,
            text: example.text.toUpperCase(),
        });
        variants.push({
            ...example,
            id: example.id !== undefined ? `${example.id}-spaced` : undefined,
            text: example.text
                .split("")
                .join("."),
        });
        variants.push({
            ...example,
            id: example.id !== undefined ? `${example.id}-leet` : undefined,
            text: example.text
                .replace(/o/gi, "0")
                .replace(/i/gi, "1")
                .replace(/a/gi, "@"),
        });
    }
    return variants;
}
//# sourceMappingURL=datasets.js.map