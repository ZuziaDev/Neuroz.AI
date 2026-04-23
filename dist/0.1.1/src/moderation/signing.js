import { createHash, createHmac } from "node:crypto";
export function signModerationArtifact(payload, secret) {
    const digest = createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");
    return {
        algorithm: "sha256-hmac",
        digest,
    };
}
export function verifyModerationArtifactSignature(payload, secret, signature) {
    const expected = signModerationArtifact(payload, secret);
    return expected.algorithm === signature.algorithm && expected.digest === signature.digest;
}
export function createModerationDatasetFingerprint(dataset) {
    return createHash("sha256").update(JSON.stringify(dataset)).digest("hex");
}
export function createReproducibleTrainingManifest(options) {
    return {
        ...options,
        createdAt: options.createdAt ?? new Date().toISOString(),
    };
}
//# sourceMappingURL=signing.js.map