/// <reference lib="webworker" />
/**
 * Worker isolado para executar scripts de formulário nos testes (Forms F5).
 * Sem acesso ao DOM/app. O script deve definir uma função `run(context)`.
 */
self.onmessage = (e: MessageEvent) => {
  const { code, input } = e.data as { code: string; input: unknown };
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const factory = new Function(`${code}\n;return typeof run === "function" ? run : null;`);
    const run = factory();
    if (typeof run !== 'function') {
      (self as unknown as Worker).postMessage({ status: 'error', error: 'O script deve definir uma função run(context).' });
      return;
    }
    const output = run(input);
    (self as unknown as Worker).postMessage({ status: 'ok', output });
  } catch (err) {
    (self as unknown as Worker).postMessage({ status: 'error', error: String((err as Error)?.message ?? err) });
  }
};
