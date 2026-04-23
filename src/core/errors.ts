export class NeurixError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ConfigurationError extends NeurixError {}

export class ModelNotReadyError extends NeurixError {}

export class ArtifactError extends NeurixError {}

export class RuntimeDependencyError extends NeurixError {}

export class UnsupportedOperationError extends NeurixError {}
