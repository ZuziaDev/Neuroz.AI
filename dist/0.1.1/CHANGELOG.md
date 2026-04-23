# Changelog

All notable changes to this project are documented in this file.

## [0.1.1] - 2026-04-23

### Added

- Unified Node.js-first AI framework API exposed through `NeurozAI` and `createNeurozAI()`
- Local artifact storage and model registry for saving, versioning, and reloading model artifacts
- ESM-first package output with bundled TypeScript declarations

### TensorFlow.js

- Added `TfjsModel` for defining, training, saving, loading, and running sequential TensorFlow.js models
- Added configurable TFJS layer support including `dense`, `dropout`, `embedding`, `flatten`, `globalAveragePooling1d`, `lstm`, and `gru`
- Added unified trainer support for TFJS fit, predict, and evaluate workflows
- Added built-in TFJS evaluation helpers for mean squared error, mean absolute error, and binary accuracy
- Added optional `@tensorflow/tfjs-node` runtime support for faster Node.js execution

### NLP

- Added `NlpModel` integration powered by `node-nlp`
- Added intent classification training and inference flows with multilingual language configuration
- Added optional answer mapping support inside NLP training corpora
- Added save/load support for serialized NLP model artifacts and saved corpora
- Added trainer support for NLP fit, predict, and evaluate workflows

### ONNX

- Added `OnnxModel` integration powered by `onnxruntime-node`
- Added ONNX model import, local artifact persistence, and inference support
- Added typed tensor feed/output wrappers for ONNX runtime execution
- Added trainer-level predict and evaluate support for ONNX models
- Added runtime metadata capture for ONNX model input and output names

### Text And Datasets

- Added reusable `Dataset` utilities including `map`, `filter`, `shuffle`, `batch`, `split`, and `concat`
- Added tokenizer utilities through `TextTokenizer` with `word` and `char` tokenization modes
- Added dataset builders for text generation and moderation training scenarios
- Added shared trainer callbacks, metrics, and typed dataset sample definitions

### Language Modeling

- Added `CausalLanguageModel` for lightweight local text generation on top of the TFJS backend
- Added tokenizer-backed language model training with configurable sequence length, stride, embedding size, hidden units, and recurrent layer type
- Added text generation strategies with `greedy` and `sample` decoding, plus `temperature`, `topK`, and EOS stopping controls
- Added save/load support for tokenizer state and language model configuration artifacts

### Moderation

- Added `ModerationModel` for training local text moderation classifiers
- Added OpenAI-style moderation schema support and flat moderation output support
- Added moderation prediction helpers including batch prediction, flat scoring, and token contribution explanations
- Added moderation categories, thresholds, normalization helpers, evaluation utilities, and runtime helpers
- Added moderation review queue, audit log, risk store, policy registry, tenant registry, and rollout manager utilities
- Added `createOpenAIModerationModel()` helper with default OpenAI-compatible moderation categories

### Packaging

- Added npm package metadata for `neuroz.ai@0.1.1`
- Added Node.js engine requirement of `>=20`
- Added default dependencies for `@tensorflow/tfjs` and `node-nlp`
- Added optional dependencies for `@tensorflow/tfjs-node` and `onnxruntime-node`

### Notes

- `OnnxModel` is intended for inference/runtime usage and does not provide training support
- Package is published as ESM-only
