export declare class NeurixError extends Error {
    constructor(message: string, options?: ErrorOptions);
}
export declare class ConfigurationError extends NeurixError {
}
export declare class ModelNotReadyError extends NeurixError {
}
export declare class ArtifactError extends NeurixError {
}
export declare class RuntimeDependencyError extends NeurixError {
}
export declare class UnsupportedOperationError extends NeurixError {
}
