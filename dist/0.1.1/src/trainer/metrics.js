function flattenNumbers(values) {
    if (values.length === 0) {
        return [];
    }
    if (Array.isArray(values[0])) {
        return values.flat();
    }
    return [...values];
}
function flattenOnnxOutputs(prediction) {
    return Object.values(prediction.outputs).flatMap((tensor) => tensor.data);
}
function flattenExpectedOnnx(sample) {
    return Object.values(sample.expectedOutputs ?? {}).flatMap((tensor) => tensor.data);
}
export function createAccuracyMetric(options) {
    return {
        name: options.name ?? "accuracy",
        compute(samples, predictions) {
            if (samples.length === 0 || predictions.length === 0) {
                return 0;
            }
            const matches = samples.reduce((count, sample, index) => {
                const prediction = predictions[index];
                if (prediction === undefined) {
                    return count;
                }
                return options.expected(sample) === options.predicted(prediction, sample)
                    ? count + 1
                    : count;
            }, 0);
            return matches / samples.length;
        },
    };
}
export function createBinaryAccuracyMetric(options) {
    const threshold = options.threshold ?? 0.5;
    return createAccuracyMetric({
        name: options.name ?? "binaryAccuracy",
        expected: (sample) => (options.expected(sample) >= threshold ? 1 : 0),
        predicted: (prediction, sample) => (options.score(prediction, sample) >= threshold ? 1 : 0),
    });
}
export function createMeanSquaredErrorMetric(options) {
    return {
        name: options.name ?? "meanSquaredError",
        compute(samples, predictions) {
            const squaredErrors = [];
            samples.forEach((sample, index) => {
                const prediction = predictions[index];
                if (prediction === undefined) {
                    return;
                }
                const expected = options.expected(sample);
                const predicted = options.predicted(prediction, sample);
                const length = Math.min(expected.length, predicted.length);
                for (let position = 0; position < length; position += 1) {
                    const delta = predicted[position] - expected[position];
                    squaredErrors.push(delta * delta);
                }
            });
            if (squaredErrors.length === 0) {
                return 0;
            }
            return squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length;
        },
    };
}
export function createMeanAbsoluteErrorMetric(options) {
    return {
        name: options.name ?? "meanAbsoluteError",
        compute(samples, predictions) {
            const absoluteErrors = [];
            samples.forEach((sample, index) => {
                const prediction = predictions[index];
                if (prediction === undefined) {
                    return;
                }
                const expected = options.expected(sample);
                const predicted = options.predicted(prediction, sample);
                const length = Math.min(expected.length, predicted.length);
                for (let position = 0; position < length; position += 1) {
                    absoluteErrors.push(Math.abs(predicted[position] - expected[position]));
                }
            });
            if (absoluteErrors.length === 0) {
                return 0;
            }
            return absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length;
        },
    };
}
export function createTfjsMeanSquaredErrorMetric() {
    return createMeanSquaredErrorMetric({
        expected: (sample) => (Array.isArray(sample.label) ? sample.label : [sample.label]),
        predicted: (prediction) => flattenNumbers(prediction),
    });
}
export function createTfjsMeanAbsoluteErrorMetric() {
    return createMeanAbsoluteErrorMetric({
        expected: (sample) => (Array.isArray(sample.label) ? sample.label : [sample.label]),
        predicted: (prediction) => flattenNumbers(prediction),
    });
}
export function createTfjsBinaryAccuracyMetric() {
    return createBinaryAccuracyMetric({
        expected: (sample) => (Array.isArray(sample.label) ? sample.label[0] ?? 0 : sample.label),
        score: (prediction) => flattenNumbers(prediction)[0] ?? 0,
    });
}
export function createIntentAccuracyMetric() {
    return createAccuracyMetric({
        expected: (sample) => sample.intent,
        predicted: (prediction) => prediction.intent ?? "",
    });
}
export function createOnnxMeanSquaredErrorMetric() {
    return {
        name: "meanSquaredError",
        compute(samples, predictions) {
            const squaredErrors = [];
            samples.forEach((sample, index) => {
                const prediction = predictions[index];
                if (prediction === undefined || sample.expectedOutputs === undefined) {
                    return;
                }
                const expected = flattenExpectedOnnx(sample);
                const predicted = flattenOnnxOutputs(prediction);
                const length = Math.min(expected.length, predicted.length);
                for (let position = 0; position < length; position += 1) {
                    const left = Number(expected[position]);
                    const right = Number(predicted[position]);
                    const delta = right - left;
                    squaredErrors.push(delta * delta);
                }
            });
            if (squaredErrors.length === 0) {
                return 0;
            }
            return squaredErrors.reduce((sum, value) => sum + value, 0) / squaredErrors.length;
        },
    };
}
export function createOnnxMeanAbsoluteErrorMetric() {
    return {
        name: "meanAbsoluteError",
        compute(samples, predictions) {
            const absoluteErrors = [];
            samples.forEach((sample, index) => {
                const prediction = predictions[index];
                if (prediction === undefined || sample.expectedOutputs === undefined) {
                    return;
                }
                const expected = flattenExpectedOnnx(sample);
                const predicted = flattenOnnxOutputs(prediction);
                const length = Math.min(expected.length, predicted.length);
                for (let position = 0; position < length; position += 1) {
                    absoluteErrors.push(Math.abs(Number(predicted[position]) - Number(expected[position])));
                }
            });
            if (absoluteErrors.length === 0) {
                return 0;
            }
            return absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length;
        },
    };
}
//# sourceMappingURL=metrics.js.map