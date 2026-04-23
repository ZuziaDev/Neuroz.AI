import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
export class ModerationAuditLog {
    filePath;
    constructor(options) {
        this.filePath = path.join(options.rootDir, "audit.jsonl");
    }
    async append(event) {
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
    async list(limit = 100) {
        try {
            const content = await readFile(this.filePath, "utf8");
            return content
                .split(/\r?\n/)
                .filter((line) => line.trim().length > 0)
                .map((line) => JSON.parse(line))
                .slice(-limit);
        }
        catch {
            return [];
        }
    }
    static hashInput(input) {
        return createHash("sha256").update(input).digest("hex");
    }
}
//# sourceMappingURL=audit.js.map