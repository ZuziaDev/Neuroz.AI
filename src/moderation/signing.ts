import { createHash, createHmac } from "node:crypto";

import type { ModerationDatasetRecord } from "./platform-types.js";

export interface ModerationArtifactSignature {
  algorithm: "sha256-hmac";
  digest: string;
}

export function signModerationArtifact(
  payload: unknown,
  secret: string,
): ModerationArtifactSignature {
  const digest = createHmac("sha256", secret)
    .update(JSON.stringify(payload))
    .digest("hex");

  return {
    algorithm: "sha256-hmac",
    digest,
  };
}

export function verifyModerationArtifactSignature(
  payload: unknown,
  secret: string,
  signature: ModerationArtifactSignature,
): boolean {
  const expected = signModerationArtifact(payload, secret);
  return expected.algorithm === signature.algorithm && expected.digest === signature.digest;
}

export function createModerationDatasetFingerprint(
  dataset: readonly ModerationDatasetRecord[],
): string {
  return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}

export function createReproducibleTrainingManifest(options: {
  seed: number;
  datasetFingerprint: string;
  modelId: string;
  modelVersion: string;
  createdAt?: string | undefined;
}) {
  return {
    ...options,
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
}
