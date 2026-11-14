import { evaluateJq, type JqEvaluationResult } from './jqEvaluator';

export interface JqTransformOptions {
  timeoutMs?: number;
}

/**
 * Executes a JQ transformation safely with a strict execution timeout.
 */
export async function runJqTransform(
  inputJson: unknown,
  filter: string,
  options: JqTransformOptions = { timeoutMs: 500 },
): Promise<JqEvaluationResult> {
  const timeoutMs = options.timeoutMs ?? 500;

  return new Promise<JqEvaluationResult>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          success: false,
          error: `JQ transformation timed out after ${timeoutMs}ms`,
        });
      }
    }, timeoutMs);

    try {
      const result = evaluateJq(inputJson, filter);
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      }
    } catch (err: unknown) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}
