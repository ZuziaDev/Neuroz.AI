import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
function findPackageJson(startDir) {
    let currentDir = startDir;
    for (;;) {
        const candidate = path.join(currentDir, "package.json");
        if (existsSync(candidate)) {
            return candidate;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            return undefined;
        }
        currentDir = parentDir;
    }
}
function resolveNeurozAIPackageVersion() {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = findPackageJson(moduleDir);
    if (packageJsonPath === undefined) {
        return "0.0.0";
    }
    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
        return typeof packageJson.version === "string" && packageJson.version.length > 0
            ? packageJson.version
            : "0.0.0";
    }
    catch {
        return "0.0.0";
    }
}
export const OPENAI_MODERATION_CATEGORIES = [
    "sexual",
    "sexual/minors",
    "harassment",
    "harassment/threatening",
    "hate",
    "hate/threatening",
    "illicit",
    "illicit/violent",
    "self-harm",
    "self-harm/intent",
    "self-harm/instructions",
    "violence",
    "violence/graphic",
];
export const NEUROZAI_PACKAGE_VERSION = resolveNeurozAIPackageVersion();
export const DEFAULT_NEUROZAI_OPENAI_MODERATION_MODEL = `neurozai-moderation-${NEUROZAI_PACKAGE_VERSION}`;
//# sourceMappingURL=openai-schema.js.map