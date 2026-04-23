import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ModerationReviewDraft,
  ModerationReviewItem,
} from "./platform-types.js";

interface PersistedQueue {
  items: ModerationReviewItem[];
}

export interface ModerationReviewQueueOptions {
  rootDir: string;
}

export class ModerationReviewQueue {
  private readonly filePath: string;

  public constructor(options: ModerationReviewQueueOptions) {
    this.filePath = path.join(options.rootDir, "queue.json");
  }

  public async enqueue(draft: ModerationReviewDraft): Promise<ModerationReviewItem> {
    const queue = await this.load();
    const item: ModerationReviewItem = {
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

  public async list(status?: ModerationReviewItem["status"]): Promise<ModerationReviewItem[]> {
    const queue = await this.load();
    return status === undefined ? queue.items : queue.items.filter((item) => item.status === status);
  }

  public async resolve(
    id: string,
    resolution: string,
    reviewerId?: string,
  ): Promise<ModerationReviewItem | undefined> {
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

  public async appeal(id: string, reason: string): Promise<ModerationReviewItem | undefined> {
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

  public async recordHumanFeedback(
    id: string,
    label: ModerationReviewItem["humanLabel"],
  ): Promise<ModerationReviewItem | undefined> {
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

  private async load(): Promise<PersistedQueue> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return JSON.parse(content) as PersistedQueue;
    } catch {
      return {
        items: [],
      };
    }
  }

  private async save(queue: PersistedQueue): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(queue, null, 2), "utf8");
  }
}
