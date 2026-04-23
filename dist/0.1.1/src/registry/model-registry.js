export class ModelRegistry {
    store;
    constructor(store) {
        this.store = store;
    }
    async saveRecord(record) {
        const paths = await this.store.initializeVersion({
            id: record.id,
            version: record.version,
            backend: record.backend,
        });
        await this.store.writeJson(paths.configPath, record.config);
        await this.store.writeJson(paths.metaPath, record);
    }
    async getRecord(id, version) {
        return this.store.readJson(this.store.resolveMetaPath(id, version));
    }
    async listModelIds() {
        return this.store.listModelIds();
    }
    async listVersions(id) {
        return this.store.listVersions(id);
    }
    async listRecords() {
        const ids = await this.listModelIds();
        const records = [];
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
//# sourceMappingURL=model-registry.js.map