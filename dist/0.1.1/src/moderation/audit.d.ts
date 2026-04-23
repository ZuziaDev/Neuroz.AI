import type { ModerationAuditEvent } from "./platform-types.js";
export interface ModerationAuditLogOptions {
    rootDir: string;
}
export declare class ModerationAuditLog {
    private readonly filePath;
    constructor(options: ModerationAuditLogOptions);
    append(event: ModerationAuditEvent): Promise<ModerationAuditEvent>;
    list(limit?: number): Promise<ModerationAuditEvent[]>;
    static hashInput(input: string): string;
}
