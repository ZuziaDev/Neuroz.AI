export async function loadTensorFlow() {
    try {
        const tfNodeModule = await import("@tensorflow/tfjs-node");
        return {
            tf: tfNodeModule,
            runtime: "tfjs-node",
        };
    }
    catch {
        const tfModule = await import("@tensorflow/tfjs");
        return {
            tf: tfModule,
            runtime: "tfjs",
        };
    }
}
//# sourceMappingURL=tfjs-module.js.map