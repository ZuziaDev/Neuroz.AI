import type * as TensorFlow from "@tensorflow/tfjs";
export type TensorFlowModule = typeof TensorFlow;
export declare function loadTensorFlow(): Promise<{
    tf: TensorFlowModule;
    runtime: "tfjs-node" | "tfjs";
}>;
