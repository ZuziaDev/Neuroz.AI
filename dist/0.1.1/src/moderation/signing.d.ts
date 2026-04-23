import type { ModerationDatasetRecord } from "./platform-types.js";
export interface ModerationArtifactSignature {
    algorithm: "sha256-hmac";
    digest: string;
}
export declare function signModerationArtifact(payload: unknown, secret: string): ModerationArtifactSignature;
export declare function verifyModerationArtifactSignature(payload: unknown, secret: string, signature: ModerationArtifactSignature): boolean;
export declare function createModerationDatasetFingerprint(dataset: readonly ModerationDatasetRecord[]): string;
export declare function createReproducibleTrainingManifest(options: {
    seed: number;
    datasetFingerprint: string;
    modelId: string;
    modelVersion: string;
    createdAt?: string | undefined;
}): {
    createdAt: string;
    seed: number;
    datasetFingerprint: string;
    modelId: string;
    modelVersion: string;
};
