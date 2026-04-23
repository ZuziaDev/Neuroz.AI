import type { ModerationDatasetRecord } from "./platform-types.js";
import type { ModerationPredictionResult } from "./types.js";
export interface LoadModerationDatasetOptions {
    textField?: string | undefined;
    categoryFields?: string[] | undefined;
}
export declare function loadModerationDatasetFromJson(filePath: string, options?: LoadModerationDatasetOptions): Promise<ModerationDatasetRecord[]>;
export declare function loadModerationDatasetFromJsonl(filePath: string, options?: LoadModerationDatasetOptions): Promise<ModerationDatasetRecord[]>;
export declare function loadModerationDatasetFromCsv(filePath: string, options?: LoadModerationDatasetOptions): Promise<ModerationDatasetRecord[]>;
export declare function loadModerationDatasetFromFile(filePath: string, options?: LoadModerationDatasetOptions): Promise<ModerationDatasetRecord[]>;
export interface OpenAIDistillationExample {
    text: string;
    response: ModerationPredictionResult;
}
export declare function distillModerationDatasetFromOpenAIStyleResponses(examples: readonly OpenAIDistillationExample[]): ModerationDatasetRecord[];
export declare function synthesizeModerationExamples(examples: readonly ModerationDatasetRecord[]): ModerationDatasetRecord[];
