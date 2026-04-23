import { type IncomingMessage, type ServerResponse } from "node:http";
import type { ModerationEngine } from "./engine.js";
import type { ModerationRequest, ModerationWebhookEvent } from "./platform-types.js";
export interface ModerationRateLimitOptions {
    maxRequests: number;
    windowMs: number;
}
export declare class InMemoryModerationRateLimiter {
    private readonly options;
    private readonly buckets;
    constructor(options: ModerationRateLimitOptions);
    check(key: string): boolean;
}
export declare function createModerationHttpHandler(engine: ModerationEngine, rateLimiter?: InMemoryModerationRateLimiter): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
export declare function createModerationServer(engine: ModerationEngine, rateLimiter?: InMemoryModerationRateLimiter): import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
export declare function createExpressStyleModerationMiddleware(engine: ModerationEngine): (request: {
    body: ModerationRequest;
    moderation?: unknown;
}, response: {
    status(code: number): {
        json(payload: unknown): void;
    };
}, next: () => void) => Promise<void>;
export declare function runModerationBatchJob(engine: ModerationEngine, items: readonly ModerationRequest[]): Promise<import("./platform-types.js").ModerationBatchResult>;
export declare function dispatchModerationWebhook(url: string, event: ModerationWebhookEvent): Promise<void>;
