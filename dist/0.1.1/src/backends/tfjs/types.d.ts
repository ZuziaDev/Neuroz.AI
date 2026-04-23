import type { CreateModelOptions } from "../../core/types.js";
export type TfjsActivation = "elu" | "hardSigmoid" | "linear" | "relu" | "relu6" | "selu" | "sigmoid" | "softmax" | "softplus" | "softsign" | "tanh" | "swish" | "mish" | "gelu" | "gelu_new";
export type TfjsRecurrentActivation = "hardSigmoid" | "sigmoid";
export type TfjsInputDType = "float32" | "int32";
export interface TfjsDenseLayerConfig {
    type: "dense";
    units: number;
    activation?: TfjsActivation | undefined;
    inputShape?: number[];
}
export interface TfjsDropoutLayerConfig {
    type: "dropout";
    rate: number;
}
export interface TfjsEmbeddingLayerConfig {
    type: "embedding";
    inputDim: number;
    outputDim: number;
    inputLength?: number[] | number | undefined;
    maskZero?: boolean | undefined;
}
export interface TfjsFlattenLayerConfig {
    type: "flatten";
}
export interface TfjsGlobalAveragePooling1dLayerConfig {
    type: "globalAveragePooling1d";
}
export interface TfjsLstmLayerConfig {
    type: "lstm";
    units: number;
    activation?: TfjsActivation | undefined;
    recurrentActivation?: TfjsRecurrentActivation | undefined;
    returnSequences?: boolean | undefined;
}
export interface TfjsGruLayerConfig {
    type: "gru";
    units: number;
    activation?: TfjsActivation | undefined;
    recurrentActivation?: TfjsRecurrentActivation | undefined;
    returnSequences?: boolean | undefined;
}
export type TfjsLayerConfig = TfjsDenseLayerConfig | TfjsDropoutLayerConfig | TfjsEmbeddingLayerConfig | TfjsFlattenLayerConfig | TfjsGlobalAveragePooling1dLayerConfig | TfjsLstmLayerConfig | TfjsGruLayerConfig;
export interface TfjsCompileConfig {
    optimizer?: "adam" | "sgd" | "adagrad" | "rmsprop";
    learningRate?: number;
    loss?: string;
    metrics?: string[];
}
export interface TfjsModelConfig {
    inputShape: number[];
    inputDType?: TfjsInputDType | undefined;
    layers: TfjsLayerConfig[];
    compile?: TfjsCompileConfig;
}
export interface CreateTfjsModelOptions extends CreateModelOptions<TfjsModelConfig> {
}
export interface TfjsTrainingData {
    inputs: number[] | number[][];
    labels: number[] | number[][];
    fit?: {
        epochs?: number;
        batchSize?: number;
        validationSplit?: number;
        shuffle?: boolean;
        verbose?: 0 | 1;
    };
}
export interface TfjsPredictionInput {
    inputs: number[] | number[][];
}
export interface TfjsPredictionOutput {
    values: number[][];
}
export interface StoredTfjsArtifacts {
    format?: string | undefined;
    generatedBy?: string | null | undefined;
    convertedBy?: string | null | undefined;
    modelTopology: unknown;
    weightSpecs: unknown[];
}
