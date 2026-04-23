import type { CreateModelOptions } from "../../core/types.js";
export interface NlpModelConfig {
    languages: string[];
    forceNER?: boolean;
    autoSave?: boolean;
    useNoneFeature?: boolean;
}
export interface CreateNlpModelOptions extends CreateModelOptions<NlpModelConfig> {
}
export interface NlpDocument {
    language: string;
    utterance: string;
    intent: string;
}
export interface NlpAnswer {
    language: string;
    intent: string;
    answer: string;
}
export interface NlpTrainingCorpus {
    documents: NlpDocument[];
    answers?: NlpAnswer[];
}
export interface NlpPredictionInput {
    language: string;
    utterance: string;
}
export interface NlpPredictionOutput {
    language?: string | undefined;
    locale?: string | undefined;
    intent?: string | undefined;
    score?: number | undefined;
    sentiment?: number | undefined;
    answer?: string | undefined;
    classifications?: Array<{
        intent: string;
        score: number;
    }> | undefined;
}
