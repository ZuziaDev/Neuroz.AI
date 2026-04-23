import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
export class ModerationReviewQueue {
    filePath;
    constructor(options) {
        this.filePath = path.join(options.rootDir, "queue.json");
    }
    async enqueue(draft) {
        const queue = await this.load();
        const item = {
            ...draft,
            id: `review-${randomUUID().replaceAll("-", "")}`,
            status: "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        queue.items.push(item);
        await this.save(queue);
        return item;
    }
    async list(status) {
        const queue = await this.load();
        return status === undefined ? queue.items : queue.items.filter((item) => item.status === status);
    }
    async resolve(id, resolution, reviewerId) {
        const queue = await this.load();
        const item = queue.items.find((candidate) => candidate.id === id);
        if (item === undefined) {
            return undefined;
        }
        item.status = "resolved";
        item.updatedAt = new Date().toISOString();
        item.resolution = resolution;
        item.reviewerId = reviewerId;
        await this.save(queue);
        return item;
    }
    async appeal(id, reason) {
        const queue = await this.load();
        const item = queue.items.find((candidate) => candidate.id === id);
        if (item === undefined) {
            return undefined;
        }
        item.status = "appealed";
        item.updatedAt = new Date().toISOString();
        item.appeal = {
            reason,
            createdAt: new Date().toISOString(),
        };
        await this.save(queue);
        return item;
    }
    async recordHumanFeedback(id, label) {
        const queue = await this.load();
        const item = queue.items.find((candidate) => candidate.id === id);
        if (item === undefined) {
            return undefined;
        }
        item.updatedAt = new Date().toISOString();
        item.humanLabel = label;
        await this.save(queue);
        return item;
    }
    async load() {
        try {
            const content = await readFile(this.filePath, "utf8");
            return JSON.parse(content);
        }
        catch {
            return {
                items: [],
            };
        }
    }
    async save(queue) {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, JSON.stringify(queue, null, 2), "utf8");
    }
}
//# sourceMappingURL=queue.js.map