import type { ModelRecord } from "../core/types.js";
import { ArtifactStore } from "../storage/artifact-store.js";

export class ModelRegistry {
  public constructor(private readonly store: ArtifactStore) {}

  public async saveRecord<TConfig>(record: ModelRecord<TConfig>): Promise<void> {
    const paths = await this.store.initializeVersion({
      id: record.id,
      version: record.version,
      backend: record.backend,
    });

    await this.store.writeJson(paths.configPath, record.config);
    await this.store.writeJson(paths.metaPath, record);
  }

  public async getRecord<TConfig>(
    id: string,
    version: string,
  ): Promise<ModelRecord<TConfig>> {
    return this.store.readJson<ModelRecord<TConfig>>(
      this.store.resolveMetaPath(id, version),
    );
  }

  public async listModelIds(): Promise<string[]> {
    return this.store.listModelIds();
  }

  public async listVersions(id: string): Promise<string[]> {
    return this.store.listVersions(id);
  }

  public async listRecords(): Promise<ModelRecord[]> {
    const ids = await this.listModelIds();
    const records: ModelRecord[] = [];

    for (const id of ids) {
      const versions = await this.listVersions(id);

      for (const version of versions) {
        records.push(await this.getRecord(id, version));
      }
    }

    return records.sort((left, right) => {
      if (left.id === right.id) {
        return left.version.localeCompare(right.version);
      }

      return left.id.localeCompare(right.id);
    });
  }
}
