import { evaluateJq } from './jqEvaluator';

self.onmessage = (e: MessageEvent<{ id: number; inputJson: unknown; filter: string }>) => {
  const { id, inputJson, filter } = e.data;
  try {
    const result = evaluateJq(inputJson, filter);
    self.postMessage({ id, ...result });
  } catch (err: unknown) {
    self.postMessage({
      id,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
