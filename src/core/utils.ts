import path from "node:path";

import { ConfigurationError } from "./errors.js";

export function toIsoDate(date: Date = new Date()): string {
  return date.toISOString();
}

export function sanitizeSegment(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new ConfigurationError(`${label} cannot be empty.`);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    throw new ConfigurationError(
      `${label} must use only letters, numbers, dots, underscores, and dashes.`,
    );
  }

  return trimmed;
}

export function resolveArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

export function toAbsolutePath(rootDir: string, maybeRelativePath: string): string {
  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }

  return path.resolve(rootDir, maybeRelativePath);
}

export function ensureNumberArray(value: number[] | number[][]): number[][] {
  if (Array.isArray(value[0])) {
    return value as number[][];
  }

  return (value as number[]).map((item) => [item]);
}

export function mean(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}
