import { createServer } from "node:http";
async function readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
        return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export class InMemoryModerationRateLimiter {
    options;
    buckets = new Map();
    constructor(options) {
        this.options = options;
    }
    check(key) {
        const now = Date.now();
        const bucket = this.buckets.get(key);
        if (bucket === undefined || bucket.resetAt <= now) {
            this.buckets.set(key, {
                count: 1,
                resetAt: now + this.options.windowMs,
            });
            return true;
        }
        if (bucket.count >= this.options.maxRequests) {
            return false;
        }
        bucket.count += 1;
        return true;
    }
}
export function createModerationHttpHandler(engine, rateLimiter) {
    return async (request, response) => {
        try {
            if (request.method === "GET" && request.url === "/health") {
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify({ ok: true }));
                return;
            }
            if (request.method === "POST" && request.url === "/moderate") {
                const body = (await readJsonBody(request));
                const key = body.userId ?? request.socket.remoteAddress ?? "anonymous";
                if (rateLimiter !== undefined && !rateLimiter.check(key)) {
                    response.writeHead(429, { "content-type": "application/json" });
                    response.end(JSON.stringify({ error: "rate_limited" }));
                    return;
                }
                const result = await engine.moderate(body);
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify(result));
                return;
            }
            if (request.method === "POST" && request.url === "/moderate/batch") {
                const body = (await readJsonBody(request));
                const result = await engine.moderateBatch(body.items ?? []);
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify(result));
                return;
            }
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ error: "not_found" }));
        }
        catch (error) {
            response.writeHead(500, { "content-type": "application/json" });
            response.end(JSON.stringify({
                error: "moderation_runtime_error",
                message: error instanceof Error ? error.message : String(error),
            }));
        }
    };
}
export function createModerationServer(engine, rateLimiter) {
    return createServer((request, response) => void createModerationHttpHandler(engine, rateLimiter)(request, response));
}
export function createExpressStyleModerationMiddleware(engine) {
    return async (request, response, next) => {
        try {
            request.moderation = await engine.moderate(request.body);
            next();
        }
        catch (error) {
            response.status(500).json({
                error: "moderation_middleware_error",
                message: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
export async function runModerationBatchJob(engine, items) {
    return engine.moderateBatch(items);
}
export async function dispatchModerationWebhook(url, event) {
    await fetch(url, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(event),
    });
}
//# sourceMappingURL=runtime.js.map