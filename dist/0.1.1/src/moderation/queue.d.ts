import type { ModerationReviewDraft, ModerationReviewItem } from "./platform-types.js";
export interface ModerationReviewQueueOptions {
    rootDir: string;
}
export declare class ModerationReviewQueue {
    private readonly filePath;
    constructor(options: ModerationReviewQueueOptions);
    enqueue(draft: ModerationReviewDraft): Promise<ModerationReviewItem>;
    list(status?: ModerationReviewItem["status"]): Promise<ModerationReviewItem[]>;
    resolve(id: string, resolution: string, reviewerId?: string): Promise<ModerationReviewItem | undefined>;
    appeal(id: string, reason: string): Promise<ModerationReviewItem | undefined>;
    recordHumanFeedback(id: string, label: ModerationReviewItem["humanLabel"]): Promise<ModerationReviewItem | undefined>;
    private load;
    private save;
}
