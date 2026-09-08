import jquery from 'jquery';
import type { FormComponent } from '@/lib/form-validation';

export type AutomationSource = { taskId: string; code: string };
export type AutomationSchema = { components?: FormComponent[]; [key: string]: unknown };
export type AutomationEvent = { key: string; value: unknown; event?: unknown };
type Callback = (event: AutomationEvent) => unknown;
export type FormAutomationAdapter = {
  root: HTMLElement;
  getData: () => Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  getSchema: () => AutomationSchema;
  setSchema: (schema: AutomationSchema) => void;
  setOptions: (key: string, options: { value: string; label: string }[]) => void;
  dataSource: (id: string, parameters?: Record<string, string>) => Promise<unknown>;
  onError: (message: string) => void;
};
class SubmissionBlocked extends Error {}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/** One runtime per mounted form; neither code nor schema mutations are persisted here. */
export function createFormAutomation(adapter: FormAutomationAdapter, scripts: AutomationSource[]) {
  let disposed = false;
  let error: string | null = null;
  const cleanups: (() => void)[] = [];
  const handlers = new Map<string, Set<{ key: string | null; callback: Callback }>>();
  const submitters = new Set<() => unknown>();
  const pending = new Set<Promise<unknown>>();
  const fail = (reason: unknown) => {
    if (disposed) return;
    error = reason instanceof Error ? reason.message : String(reason);
    adapter.onError(error);
  };
  const guard = (callback: (...args: any[]) => unknown) => (...args: any[]) => {
    if (disposed) return;
    try {
      const result = callback(...args);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        const promise = Promise.resolve(result).catch(fail).finally(() => pending.delete(promise));
        pending.add(promise);
        return promise;
      }
      return result;
    } catch (e) { fail(e); }
  };
  function edit(id: string, action: (component: FormComponent, siblings: FormComponent[], index: number) => void) {
    if (disposed) return;
    const schema = structuredClone(adapter.getSchema());
    let found = false;
    const walk = (list: FormComponent[]) => {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.id === id || c.key === id) { action(c, list, i); found = true; return; }
        walk(c.components ?? []);
        if (found) return;
      }
    };
    walk(schema.components ?? []);
    if (!found) throw new Error(`Elemento não encontrado: ${id}`);
    adapter.setSchema(schema);
  }
  const form = {
    root: adapter.root,
    query: (selector: string) => adapter.root.querySelectorAll(selector),
    getData: () => structuredClone(adapter.getData()),
    get: (key: string) => structuredClone(adapter.getData()[key]),
    set: (key: string, value: unknown) => { if (!disposed) adapter.set(key, value); },
    getSchema: () => structuredClone(adapter.getSchema()),
    setSchema: (schema: AutomationSchema) => { if (!disposed) adapter.setSchema(structuredClone(schema)); },
    update: (id: string, patch: Partial<FormComponent>) => edit(id, c => Object.assign(c, patch)),
    add: (component: FormComponent, parentId?: string) => {
      const copy = structuredClone(component);
      if (parentId) edit(parentId, c => { (c.components ??= []).push(copy); });
      else { const schema = form.getSchema(); (schema.components ??= []).push(copy); form.setSchema(schema); }
    },
    remove: (id: string) => edit(id, (_c, list, index) => { list.splice(index, 1); }),
    show: (id: string) => edit(id, c => { c.automationHidden = false; }),
    hide: (id: string) => edit(id, c => { c.automationHidden = true; }),
    setRequired: (id: string, required: boolean) => edit(id, c => { c.validate = { ...c.validate, required }; }),
    setDisabled: (id: string, disabled: boolean) => edit(id, c => { c.disabled = disabled; }),
    setOptions: adapter.setOptions,
    dataSource: (id: string, parameters?: Record<string, string>) => tracked(adapter.dataSource(id, parameters)),
    on: (event: string, key: string | null, callback: Callback) => {
      const entry = { key, callback };
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(entry);
      return () => handlers.get(event)?.delete(entry);
    },
    beforeSubmit: (callback: () => unknown) => { submitters.add(callback); return () => submitters.delete(callback); },
    onCleanup: (callback: () => void) => { cleanups.push(callback); },
    fail,
  };
  // Local jQuery facade: never mutate the application's shared $.ajax.
  const $ = Object.assign((...args: any[]) => (jquery as any)(...args), jquery) as JQueryStatic;
  function monitorDeferred<T extends JQuery.Promise<any>>(deferred: T, handled = false): T {
    const originalFail: any = deferred.fail.bind(deferred);
    const originalThen: any = deferred.then.bind(deferred);
    deferred.fail = ((...callbacks: any[]) => {
      if (callbacks.flat(Infinity).some(callback => typeof callback === 'function')) handled = true;
      return originalFail(...callbacks);
    }) as typeof deferred.fail;
    deferred.then = ((ok: any, bad: any, progress: any) => {
      handled = true; // Responsibility passes to the resulting chain.
      return monitorDeferred(originalThen(ok, bad, progress));
    }) as typeof deferred.then;
    deferred.catch = ((bad: any) => {
      handled = true;
      return monitorDeferred(originalThen(undefined, bad));
    }) as typeof deferred.catch;
    originalFail((_xhr: unknown, status: string, reason: unknown) => {
      window.setTimeout(() => { if (!handled && !disposed) fail(reason || status || _xhr || 'Falha AJAX.'); }, 0);
    });
    const wait = new Promise<void>(resolve => deferred.always(() => { window.setTimeout(resolve, 0); }));
    pending.add(wait); void wait.finally(() => pending.delete(wait));
    return deferred;
  }
  $.ajax = ((...args: any[]) => {
    const options = typeof args[0] === 'string' ? args[1] : args[0];
    const handled = [options?.error].flat(Infinity).some(callback => typeof callback === 'function');
    const xhr = monitorDeferred((jquery.ajax as any)(...args) as JQuery.jqXHR, handled);
    cleanups.push(() => xhr.abort());
    return xhr;
  }) as typeof $.ajax;
  // Shortcuts must go through the local monitored ajax implementation as well.
  function request(method: string, url: string | JQuery.AjaxSettings, data?: any, success?: any, dataType?: string) {
    if (typeof data === 'function') { dataType = success; success = data; data = undefined; }
    return $.ajax(typeof url === 'string' ? { url, data, success, dataType, method } : { ...url, method });
  }
  $.get = ((url: string, data?: any, success?: any, dataType?: string) => request('GET', url, data, success, dataType)) as typeof $.get;
  $.post = ((url: string, data?: any, success?: any, dataType?: string) => request('POST', url, data, success, dataType)) as typeof $.post;
  $.getJSON = ((url: string, data?: any, success?: any) => typeof data === 'function' ? request('GET', url, undefined, data, 'json') : request('GET', url, data, success, 'json')) as typeof $.getJSON;
  $.getScript = ((url: string, success?: any) => request('GET', url, undefined, success, 'script')) as typeof $.getScript;
  const timer = (repeat: boolean) => (callback: () => unknown, delay?: number) => {
    const id = (repeat ? window.setInterval : window.setTimeout)(guard(callback), delay);
    cleanups.push(() => (repeat ? window.clearInterval : window.clearTimeout)(id));
    return id;
  };
  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  function tracked<T>(promise: Promise<T>): Promise<T> {
    let delegated = false;
    let finished!: () => void;
    const wait = new Promise<void>(resolve => { finished = resolve; });
    pending.add(wait);
    const settled = (reason?: unknown, rejected = false) => window.setTimeout(() => {
      if (rejected && !delegated) fail(reason);
      pending.delete(wait); finished();
    }, 0);
    void promise.then(() => settled(), reason => settled(reason, true));
    // A thenable (rather than an overwritten native Promise) is observed by await.
    return {
      then(ok: any, bad: any) { delegated = true; return tracked(promise.then(ok, bad)); },
      catch(bad: any) { delegated = true; return tracked(promise.catch(bad)); },
      finally(done: any) { delegated = true; return tracked(promise.finally(done)); },
      [Symbol.toStringTag]: 'Promise',
    } as Promise<T>;
  }
  const fetchChecked = (input: RequestInfo | URL, init?: RequestInit) => tracked(
    fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal }).then(response => {
      if (!response.ok) throw new Error(`Falha HTTP ${response.status}`);
      return response;
    }),
  );
  const onError = (event: ErrorEvent) => fail(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent) => fail(event.reason);
  if (scripts.some(s => s.code.trim())) {
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
  }
  const ready = (async () => {
    await Promise.resolve();
    for (const script of [...scripts].sort((a, b) => Number(a.taskId !== '') - Number(b.taskId !== ''))) {
      if (disposed || error) break;
      try {
        const fn = new AsyncFunction('form', '$', 'jQuery', 'fetch', 'setTimeout', 'setInterval', `${script.code}\n//# sourceURL=septem-form-${encodeURIComponent(script.taskId || 'common')}.js`);
        await fn(form, $, $, fetchChecked, timer(false), timer(true));
      } catch (e) { fail(e); }
    }
  })();
  return {
    form,
    emit(event: string, detail: AutomationEvent) {
      for (const h of handlers.get(event) ?? []) if (h.key === null || h.key === detail.key) guard(h.callback)(detail);
    },
    async beforeSubmit(runCallbacks = true) {
      if (disposed) throw new Error('Formulário encerrado.');
      // Bounds async hangs too (synchronous infinite loops require closing the page).
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([(async () => {
          await ready;
          while (pending.size) await Promise.all([...pending]);
          if (error) throw new Error(error);
          for (const callback of runCallbacks ? submitters : []) {
            if (await callback() === false) throw new SubmissionBlocked('Envio impedido pela automação.');
          }
          while (pending.size) await Promise.all([...pending]);
          if (error) throw new Error(error);
        })(), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('A automação não concluiu em 15 segundos.')), 15000); })]);
      } catch (e) { if (!(e instanceof SubmissionBlocked)) fail(e); throw e; }
      finally { clearTimeout(timeout); }
    },
    dispose() {
      disposed = true;
      window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection);
      handlers.clear(); submitters.clear();
      for (const cleanup of cleanups.reverse()) { try { cleanup(); } catch { /* already disposed */ } }
    },
  };
}
