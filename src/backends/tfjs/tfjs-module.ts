import type * as TensorFlow from "@tensorflow/tfjs";

export type TensorFlowModule = typeof TensorFlow;

export async function loadTensorFlow(): Promise<{
  tf: TensorFlowModule;
  runtime: "tfjs-node" | "tfjs";
}> {
  try {
    const tfNodeModule = await import("@tensorflow/tfjs-node");
    return {
      tf: tfNodeModule as unknown as TensorFlowModule,
      runtime: "tfjs-node",
    };
  } catch {
    const tfModule = await import("@tensorflow/tfjs");
    return {
      tf: tfModule,
      runtime: "tfjs",
    };
  }
}
