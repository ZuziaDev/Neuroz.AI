import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ModerationAuditEvent } from "./platform-types.js";

export interface ModerationAuditLogOptions {
  rootDir: string;
}

export class ModerationAuditLog {
  private readonly filePath: string;

  public constructor(options: ModerationAuditLogOptions) {
    this.filePath = path.join(options.rootDir, "audit.jsonl");
  }

  public async append(event: ModerationAuditEvent): Promise<ModerationAuditEvent> {
    const persisted = {
      ...event,
      id: event.id || `audit-${randomUUID().replaceAll("-", "")}`,
    };

    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(persisted)}\n`, {
      encoding: "utf8",
      flag: "a",
    });
    return persisted;
  }

  public async list(limit: number = 100): Promise<ModerationAuditEvent[]> {
    try {
      const content = await readFile(this.filePath, "utf8");
      return content
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as ModerationAuditEvent)
        .slice(-limit);
    } catch {
      return [];
    }
  }

  public static hashInput(input: string): string {
    return createHash("sha256").update(input).digest("hex");
  }
}
