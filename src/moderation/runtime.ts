import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import type { ModerationEngine } from "./engine.js";
import type { ModerationRequest, ModerationWebhookEvent } from "./platform-types.js";

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export interface ModerationRateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export class InMemoryModerationRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  public constructor(private readonly options: ModerationRateLimitOptions) {}

  public check(key: string): boolean {
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

export function createModerationHttpHandler(
  engine: ModerationEngine,
  rateLimiter?: InMemoryModerationRateLimiter,
): (request: IncomingMessage, response: ServerResponse) => Promise<void> {
  return async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true }));
        return;
      }

      if (request.method === "POST" && request.url === "/moderate") {
        const body = (await readJsonBody(request)) as ModerationRequest;
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
        const body = (await readJsonBody(request)) as { items?: ModerationRequest[] };
        const result = await engine.moderateBatch(body.items ?? []);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(result));
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "not_found" }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: "moderation_runtime_error",
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };
}

export function createModerationServer(
  engine: ModerationEngine,
  rateLimiter?: InMemoryModerationRateLimiter,
) {
  return createServer((request, response) =>
    void createModerationHttpHandler(engine, rateLimiter)(request, response),
  );
}

export function createExpressStyleModerationMiddleware(
  engine: ModerationEngine,
) {
  return async (
    request: { body: ModerationRequest; moderation?: unknown },
    response: { status(code: number): { json(payload: unknown): void } },
    next: () => void,
  ) => {
    try {
      request.moderation = await engine.moderate(request.body);
      next();
    } catch (error) {
      response.status(500).json({
        error: "moderation_middleware_error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
}

export async function runModerationBatchJob(
  engine: ModerationEngine,
  items: readonly ModerationRequest[],
) {
  return engine.moderateBatch(items);
}

export async function dispatchModerationWebhook(
  url: string,
  event: ModerationWebhookEvent,
): Promise<void> {
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
}
