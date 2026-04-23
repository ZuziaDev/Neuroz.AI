import { cp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BackendKind } from "../core/types.js";
import { ArtifactError } from "../core/errors.js";
import { sanitizeSegment } from "../core/utils.js";

export interface VersionPaths {
  modelDir: string;
  versionDir: string;
  artifactDir: string;
  metaPath: string;
  configPath: string;
}

export interface InitializeVersionOptions {
  id: string;
  version: string;
  backend: BackendKind;
}

export class ArtifactStore {
  public readonly rootDir: string;

  public constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  public async ensureReady(): Promise<void> {
    await mkdir(this.modelsRoot(), { recursive: true });
  }

  public modelsRoot(): string {
    return path.join(this.rootDir, "models");
  }

  public resolveModelDir(id: string): string {
    return path.join(this.modelsRoot(), sanitizeSegment(id, "model id"));
  }

  public resolveVersionDir(id: string, version: string): string {
    return path.join(
      this.resolveModelDir(id),
      sanitizeSegment(version, "model version"),
    );
  }

  public resolveArtifactDir(id: string, version: string): string {
    return path.join(this.resolveVersionDir(id, version), "artifacts");
  }

  public resolveMetaPath(id: string, version: string): string {
    return path.join(this.resolveVersionDir(id, version), "meta.json");
  }

  public resolveConfigPath(id: string, version: string): string {
    return path.join(this.resolveVersionDir(id, version), "config.json");
  }

  public async initializeVersion(options: InitializeVersionOptions): Promise<VersionPaths> {
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

  public async writeJson(filePath: string, value: unknown): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  }

  public async readJson<T>(filePath: string): Promise<T> {
    try {
      const content = await readFile(filePath, "utf8");
      return JSON.parse(content) as T;
    } catch (error) {
      throw new ArtifactError(`Failed to read JSON artifact at ${filePath}.`, {
        cause: error,
      });
    }
  }

  public async writeBuffer(filePath: string, value: Uint8Array): Promise<void> {
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, value);
  }

  public async readBuffer(filePath: string): Promise<Buffer> {
    try {
      return await readFile(filePath);
    } catch (error) {
      throw new ArtifactError(`Failed to read binary artifact at ${filePath}.`, {
        cause: error,
      });
    }
  }

  public async copyIntoArtifacts(
    sourcePath: string,
    id: string,
    version: string,
    targetName?: string,
  ): Promise<string> {
    const destination = path.join(
      this.resolveArtifactDir(id, version),
      targetName ?? path.basename(sourcePath),
    );

    await mkdir(path.dirname(destination), { recursive: true });
    await cp(sourcePath, destination);
    return destination;
  }

  public async listModelIds(): Promise<string[]> {
    await this.ensureReady();
    const entries = await readdir(this.modelsRoot(), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }

  public async listVersions(id: string): Promise<string[]> {
    const modelDir = this.resolveModelDir(id);

    try {
      const entries = await readdir(modelDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }
}
