import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ArtifactError } from "../core/errors.js";
import { sanitizeSegment } from "../core/utils.js";
export class ArtifactStore {
    rootDir;
    constructor(rootDir) {
        this.rootDir = path.resolve(rootDir);
    }
    async ensureReady() {
        await mkdir(this.modelsRoot(), { recursive: true });
    }
    modelsRoot() {
        return path.join(this.rootDir, "models");
    }
    resolveModelDir(id) {
        return path.join(this.modelsRoot(), sanitizeSegment(id, "model id"));
    }
    resolveVersionDir(id, version) {
        return path.join(this.resolveModelDir(id), sanitizeSegment(version, "model version"));
    }
    resolveArtifactDir(id, version) {
        return path.join(this.resolveVersionDir(id, version), "artifacts");
    }
    resolveMetaPath(id, version) {
        return path.join(this.resolveVersionDir(id, version), "meta.json");
    }
    resolveConfigPath(id, version) {
        return path.join(this.resolveVersionDir(id, version), "config.json");
    }
    async initializeVersion(options) {
        const versionDir = this.resolveVersionDir(options.id, options.version);
        const artifactDir = this.resolveArtifactDir(options.id, options.version);
        await mkdir(versionDir, { recursive: true });
        await mkdir(artifactDir, { recursive: true });
        return {
            modelDir: this.resolveModelDir(options.id),
            versionDir,
            artifactDir,
            metaPath: this.resolveMetaPath(options.id, options.version),
            configPath: this.resolveConfigPath(options.id, options.version),
        };
    }
    async writeJson(filePath, value) {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
    }
    async readJson(filePath) {
        try {
            const content = await readFile(filePath, "utf8");
            return JSON.parse(content);
        }
        catch (error) {
            throw new ArtifactError(`Failed to read JSON artifact at ${filePath}.`, {
                cause: error,
            });
        }
    }
    async writeBuffer(filePath, value) {
        await mkdir(path.dirname(filePath), { recursive: true });
        await writeFile(filePath, value);
    }
    async readBuffer(filePath) {
        try {
            return await readFile(filePath);
        }
        catch (error) {
            throw new ArtifactError(`Failed to read binary artifact at ${filePath}.`, {
                cause: error,
            });
        }
    }
    async copyIntoArtifacts(sourcePath, id, version, targetName) {
        const destination = path.join(this.resolveArtifactDir(id, version), targetName ?? path.basename(sourcePath));
        await mkdir(path.dirname(destination), { recursive: true });
        await cp(sourcePath, destination);
        return destination;
    }
    async listModelIds() {
        await this.ensureReady();
        const entries = await readdir(this.modelsRoot(), { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right));
    }
    async listVersions(id) {
        const modelDir = this.resolveModelDir(id);
        try {
            const entries = await readdir(modelDir, { withFileTypes: true });
            return entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort((left, right) => left.localeCompare(right));
        }
        catch {
            return [];
        }
    }
}
//# sourceMappingURL=artifact-store.js.map