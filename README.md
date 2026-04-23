<p align="center">
  <img src="./assets/neuroz-ai-banner.svg" alt="Neuroz.AI banner" width="960" />
</p>

# Neuroz.AI

Unified, Node.js-first AI training and inference framework with pluggable `tfjs`, `node-nlp`, and `onnxruntime-node` backends.

`neuroz.ai` gives you a single TypeScript-friendly API for:

- Training TensorFlow.js models in Node.js
- Building intent classification pipelines with `node-nlp`
- Running ONNX models with a consistent prediction interface
- Creating lightweight causal language models
- Training text moderation models with OpenAI-style category output
- Saving, versioning, and reloading model artifacts locally

## Why Use `neuroz.ai`?

- Single API surface for multiple AI runtimes
- ESM-first package with TypeScript types included
- Local artifact storage and model registry out of the box
- Dataset helpers, tokenizer utilities, and trainer abstractions
- Good fit for prototypes, internal tools, and Node-native AI workflows

## Installation

```bash
npm install neuroz.ai
```

### Runtime Notes

- Requires `Node.js >= 20`
- Package is ESM-only
- `@tensorflow/tfjs` and `node-nlp` are installed by default
- `@tensorflow/tfjs-node` and `onnxruntime-node` are optional dependencies

If you want faster TensorFlow execution in Node.js, install the native runtime too:

```bash
npm install @tensorflow/tfjs-node
```

If you want to run ONNX models, make sure the ONNX runtime is installed:

```bash
npm install onnxruntime-node
```

## Quick Start

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI({
  rootDir: ".neurozai",
});

const models = await neurozai.listModels();
console.log(models);
```

This creates a local artifact store and registry in `.neurozai`.

## Core Concepts

### `NeurozAI`

The main entry point. It creates and loads models, datasets, trainers, moderation utilities, and storage-backed registries.

### Artifact Store

Saved model versions are written to a local directory managed by the package. This makes it easy to keep training artifacts and registry metadata together.

### Model Registry

Each saved version is tracked with metadata such as:

- `id`
- `version`
- `backend`
- `task`
- `metrics`
- `tags`
- `artifactDir`

### Trainer

The `Trainer` provides a unified interface for:

- `fit()`
- `predict()`
- `evaluate()`

It supports:

- `TfjsModel`
- `NlpModel`
- `OnnxModel` for prediction and evaluation only

## TensorFlow.js Example

Use the TFJS backend when you want to define small neural models directly in Node.js.

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();
const trainer = neurozai.createTrainer();

const model = await neurozai.createTfjsModel({
  id: "xor-demo",
  task: "binary-classification",
  config: {
    inputShape: [2],
    layers: [
      { type: "dense", units: 8, activation: "relu", inputShape: [2] },
      { type: "dense", units: 1, activation: "sigmoid" },
    ],
    compile: {
      optimizer: "adam",
      loss: "binaryCrossentropy",
      metrics: ["accuracy"],
    },
  },
});

const dataset = neurozai.createDataset([
  { input: [0, 0], label: 0 },
  { input: [0, 1], label: 1 },
  { input: [1, 0], label: 1 },
  { input: [1, 1], label: 0 },
]);

const fitResult = await trainer.fit(model, dataset, {
  fit: {
    epochs: 200,
    verbose: 0,
  },
});

const prediction = await model.predict({
  inputs: [
    [0, 1],
    [1, 1],
  ],
});

await model.save({
  version: "1.0.0",
  metrics: fitResult.metrics,
});

console.log(prediction.values);
```

## NLP Intent Classification Example

Use the NLP backend for intent classification and optional answer generation powered by `node-nlp`.

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();
const trainer = neurozai.createTrainer();

const model = await neurozai.createNlpModel({
  id: "support-intents",
  task: "intent-classification",
  config: {
    languages: ["en"],
  },
});

const dataset = neurozai.createDataset([
  {
    language: "en",
    utterance: "hello",
    intent: "greet",
    answer: "Hi there!",
  },
  {
    language: "en",
    utterance: "good morning",
    intent: "greet",
    answer: "Good morning!",
  },
  {
    language: "en",
    utterance: "i need help with billing",
    intent: "billing",
    answer: "I can help with billing questions.",
  },
]);

await trainer.fit(model, dataset);

const result = await model.predict({
  language: "en",
  utterance: "can you help me with my invoice?",
});

await model.save({
  version: "1.0.0",
});

console.log(result.intent, result.score, result.answer);
```

## ONNX Inference Example

Use the ONNX backend when you already have a trained `.onnx` model and want a typed Node.js inference wrapper.

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();

const model = await neurozai.createOnnxModel({
  id: "sentiment-onnx",
  task: "classification",
  config: {
    sourcePath: "./models/sentiment.onnx",
    executionProviders: ["cpu"],
  },
});

await model.save({
  version: "1.0.0",
});

const output = await model.predict({
  feeds: {
    input_ids: {
      type: "int64",
      data: [101n, 7592n, 2088n, 102n],
      dims: [1, 4],
    },
  },
});

console.log(output.outputs);
```

## Causal Language Model Example

This package also includes a lightweight TFJS-based causal language model wrapper with built-in tokenization and text generation.

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();

const model = await neurozai.createCausalLanguageModel({
  id: "tiny-lm",
  sequenceLength: 8,
  tokenizer: {
    level: "word",
    lowercase: true,
  },
});

await model.train([
  "NeurozAI makes local AI workflows easier",
  "NeurozAI can train lightweight language models",
  "Local models can be versioned and reused",
], {
  fit: {
    epochs: 50,
    verbose: 0,
  },
});

const generated = await model.generate("NeurozAI", {
  maxTokens: 6,
  strategy: "sample",
  topK: 5,
  temperature: 0.8,
});

await model.save({
  version: "1.0.0",
});

console.log(generated.text);
```

## Moderation Model Example

`neuroz.ai` can train text moderation models that return OpenAI-style moderation output.

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();

const moderation = await neurozai.createOpenAIModerationModel({
  id: "content-moderation",
  sequenceLength: 16,
});

await moderation.train([
  {
    text: "I hope you have a wonderful day",
    label: "safe",
  },
  {
    text: "I will hurt you",
    labels: ["violence"],
  },
  {
    text: "explicit sexual content",
    labels: ["sexual"],
  },
], {
  fit: {
    epochs: 40,
    verbose: 0,
  },
});

const prediction = await moderation.predict("I will find you and hurt you");
const flat = await moderation.predictFlat("explicit sexual content");
const explanation = await moderation.explain("I will hurt you");

await moderation.save({
  version: "1.0.0",
});

console.log(prediction.results[0]);
console.log(flat);
console.log(explanation.summary);
```

## Loading Saved Models

Once a model is saved, you can load it again through the registry-backed API:

```ts
import { createNeurozAI } from "neuroz.ai";

const neurozai = await createNeurozAI();

const model = await neurozai.loadModel({
  id: "xor-demo",
  version: "1.0.0",
});

console.log(model);
```

You can also inspect stored versions:

```ts
const models = await neurozai.listModels();
console.log(models);
```

## Dataset Utilities

The `Dataset` helper supports common data preparation tasks:

- `map()`
- `filter()`
- `shuffle()`
- `batch()`
- `split()`
- `concat()`

Example:

```ts
import { createDataset } from "neuroz.ai";

const dataset = createDataset([1, 2, 3, 4, 5, 6]).shuffle(42);
const split = dataset.split({
  train: 0.7,
  validation: 0.15,
});

console.log(split.train.toArray());
console.log(split.validation.toArray());
console.log(split.test.toArray());
```

## Included Exports

The package exports:

- Core errors and shared types
- Dataset helpers
- Text tokenizer utilities
- TFJS, NLP, and ONNX model classes and types
- `Trainer` and trainer metric helpers
- `NeurozAI` and `createNeurozAI()`
- Moderation utilities, policies, review queues, audit tools, and rollout helpers

## Limitations

- ONNX support is for inference and evaluation, not training
- TFJS examples are best suited to lightweight models, not large-scale training
- Moderation and language model components are lightweight local building blocks, not drop-in replacements for large hosted foundation models
- Since the package is ESM-only, CommonJS `require()` is not supported

## Best Fit

`neuroz.ai` is a good fit if you want:

- A Node.js-native abstraction over multiple local AI runtimes
- A typed API for training and inference in TypeScript
- Simple local model versioning without external infrastructure
- A compact toolkit for experiments, internal apps, and AI utilities

## License

MIT
