import { evaluateJq, type JqEvaluationResult } from './jqEvaluator';

export interface JqTransformOptions {
  timeoutMs?: number;
}

/**
 * Executes a JQ transformation safely in a terminable Web Worker when available,
 * falling back to synchronous execution in environments without Web Worker support (e.g. Node / Vitest).
 * If execution exceeds the timeout, the worker is terminated to prevent main-thread freezing.
 */
export async function runJqTransform(
  inputJson: unknown,
  filter: string,
  options: JqTransformOptions = { timeoutMs: 500 },
): Promise<JqEvaluationResult> {
  const timeoutMs = options.timeoutMs ?? 500;

  if (typeof Worker !== 'undefined') {
    return new Promise<JqEvaluationResult>((resolve) => {
      let worker: Worker | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let completed = false;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        if (worker) {
          worker.terminate();
          worker = null;
        }
      };

      timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          cleanup();
          resolve({
            success: false,
            error: `JQ transformation timed out after ${timeoutMs}ms`,
          });
        }
      }, timeoutMs);

      try {
        worker = new Worker(new URL('./jqWorkerScript.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e: MessageEvent<JqEvaluationResult>) => {
          if (!completed) {
            completed = true;
            cleanup();
            resolve(e.data);
          }
        };
        worker.onerror = (e) => {
          if (!completed) {
            completed = true;
            cleanup();
            resolve({
              success: false,
              error: e.message || 'Worker execution error',
            });
          }
        };
        worker.postMessage({ id: 1, inputJson, filter });
      } catch {
        // Fallback for environments where Worker instantiation fails
        cleanup();
        try {
          resolve(evaluateJq(inputJson, filter));
        } catch (err: unknown) {
          resolve({
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });
  }

  // Fallback for non-worker environments (e.g., node test runner)
  try {
    return evaluateJq(inputJson, filter);
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
