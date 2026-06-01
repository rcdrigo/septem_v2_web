export type RunResult = { status: 'ok' | 'error' | 'timeout'; output?: unknown; error?: string; durationMs: number };

/**
 * Executa um script (que define `run(context)`) num Web Worker isolado, com
 * timeout (mata o worker em loop infinito). Usado pelo runner de testes (F5).
 */
export function runScript(code: string, input: unknown, timeoutMs = 2000): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./script-runner.worker.ts', import.meta.url), { type: 'module' });
    const start = performance.now();
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ status: 'timeout', error: 'Tempo de execução excedido.', durationMs: timeoutMs });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ ...(e.data as Omit<RunResult, 'durationMs'>), durationMs: Math.round(performance.now() - start) });
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      resolve({ status: 'error', error: e.message, durationMs: Math.round(performance.now() - start) });
    };
    worker.postMessage({ code, input });
  });
}

export type TestOutcome = { name: string; status: 'passed' | 'failed' | 'error' | 'timeout'; detail?: string; durationMs: number };

/** Roda um teste: executa o código com o input e compara o retorno ao esperado. */
export async function runTest(code: string, input: unknown, expected: unknown): Promise<Omit<TestOutcome, 'name'>> {
  const r = await runScript(code, input);
  if (r.status === 'timeout') return { status: 'timeout', detail: r.error, durationMs: r.durationMs };
  if (r.status === 'error') return { status: 'error', detail: r.error, durationMs: r.durationMs };
  const ok = stableStringify(r.output) === stableStringify(expected);
  return { status: ok ? 'passed' : 'failed', detail: ok ? undefined : `esperado ${stableStringify(expected)}, obtido ${stableStringify(r.output)}`, durationMs: r.durationMs };
}

/** JSON com chaves ordenadas (comparação insensível à ordem das chaves). */
function stableStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.keys(val as Record<string, unknown>).sort().reduce((acc, k) => { acc[k] = (val as Record<string, unknown>)[k]; return acc; }, {} as Record<string, unknown>)
      : val);
}
