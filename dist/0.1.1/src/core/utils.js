import path from "node:path";
import { ConfigurationError } from "./errors.js";
export function toIsoDate(date = new Date()) {
    return date.toISOString();
}
export function sanitizeSegment(value, label) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new ConfigurationError(`${label} cannot be empty.`);
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
        throw new ConfigurationError(`${label} must use only letters, numbers, dots, underscores, and dashes.`);
    }
    return trimmed;
}
export function resolveArrayBuffer(buffer) {
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}
export function toAbsolutePath(rootDir, maybeRelativePath) {
    if (path.isAbsolute(maybeRelativePath)) {
        return maybeRelativePath;
    }
    return path.resolve(rootDir, maybeRelativePath);
}
export function ensureNumberArray(value) {
    if (Array.isArray(value[0])) {
        return value;
    }
    return value.map((item) => [item]);
}
export function mean(values) {
    if (values.length === 0) {
        return undefined;
    }
    return values.reduce((total, value) => total + value, 0) / values.length;
}
//# sourceMappingURL=utils.js.map