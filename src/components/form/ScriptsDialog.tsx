import { useState } from 'react';
import { AlertCircle, Check, Code2, History, Play, Plus, Trash2, X } from 'lucide-react';
import {
  useFormScripts, useCreateScript, useDeleteScript,
  useScriptRevisions, useCreateRevision,
  useScriptTests, useCreateTest, useDeleteTest,
  type FormScriptItem, type ScriptRevision,
} from '@/lib/api/forms';
import { Dialog } from '@/components/ui/Dialog';
import { Field, TextInput, TextArea, Select } from '@/components/ui/Field';
import { toast } from '@/stores/toast';
import { runTest, type TestOutcome } from '@/lib/script-runner';

function TestBadge({ outcome }: { outcome: TestOutcome }) {
  const map = {
    passed: { cls: 'text-emerald-600', icon: <Check size={13} /> },
    failed: { cls: 'text-rose-600', icon: <X size={13} /> },
    error: { cls: 'text-amber-600', icon: <AlertCircle size={13} /> },
    timeout: { cls: 'text-amber-600', icon: <AlertCircle size={13} /> },
  }[outcome.status];
  return <span className={map.cls} title={`${outcome.status} · ${outcome.durationMs}ms`}>{map.icon}</span>;
}

/** Lint de sintaxe JS sem dependência: new Function lança SyntaxError no código inválido. */
function lintJs(code: string): string | null {
  if (!code.trim()) return null;
  try { new Function(code); return null; } catch (e) { return (e as Error).message; }
}

/** Scripts JS do formulário (Forms F4): editor com lint + revisões versionadas + testes. */
export function ScriptsDialog({ formId, onClose }: { formId: string; onClose: () => void }) {
  const scripts = useFormScripts(formId);
  const create = useCreateScript(formId);
  const del = useDeleteScript(formId);
  const [selected, setSelected] = useState<string | null>(null);
  const [scope, setScope] = useState('global');

  async function add() {
    try {
      const r = await create.mutateAsync({ formId, scope });
      setSelected(r.id);
    } catch { toast.error('Falha ao criar script.'); }
  }

  return (
    <Dialog open onClose={onClose} width="lg" title="Scripts do formulário" footer={<button onClick={onClose} className="rounded-md border border-slate-300 px-3.5 py-1.5 text-sm">Fechar</button>}>
      <div className="flex min-h-[420px] gap-3">
        <div className="w-52 shrink-0 border-r border-slate-200 pr-3">
          <div className="mb-2 flex gap-1">
            <Select value={scope} options={[{ value: 'global', label: 'Global' }, { value: 'task', label: 'Por tarefa' }]} onChange={(e) => setScope(e.target.value)} />
            <button type="button" onClick={add} className="shrink-0 rounded-md bg-slate-900 px-2 text-white hover:bg-slate-700"><Plus size={15} /></button>
          </div>
          <div className="space-y-1">
            {scripts.data?.length === 0 && <p className="text-xs text-slate-400">Nenhum script.</p>}
            {scripts.data?.map((s: FormScriptItem) => (
              <div key={s.id} className={`flex items-center justify-between rounded-md px-2 py-1.5 text-sm ${selected === s.id ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <button type="button" onClick={() => setSelected(s.id)} className="flex items-center gap-1.5 text-left">
                  <Code2 size={14} className="text-slate-400" />
                  <span>{s.scope === 'global' ? 'Global' : 'Tarefa'}{s.latestVersion ? ` · v${s.latestVersion}` : ''}</span>
                </button>
                <button type="button" onClick={() => del.mutate(s.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1">
          {selected ? <ScriptEditor scriptId={selected} /> : <p className="pt-8 text-center text-sm text-slate-400">Selecione ou crie um script.</p>}
        </div>
      </div>
    </Dialog>
  );
}

function ScriptEditor({ scriptId }: { scriptId: string }) {
  const revisions = useScriptRevisions(scriptId);
  const createRev = useCreateRevision(scriptId);
  const tests = useScriptTests(scriptId);
  const createTest = useCreateTest(scriptId);
  const delTest = useDeleteTest(scriptId);

  const latest = revisions.data?.[0];
  const [code, setCode] = useState<string | null>(null);
  const [changelog, setChangelog] = useState('');
  const [status, setStatus] = useState('draft');
  const [testName, setTestName] = useState('');
  const [testInput, setTestInput] = useState('');
  const [testExpected, setTestExpected] = useState('');
  const [results, setResults] = useState<Record<number, TestOutcome>>({});
  const [running, setRunning] = useState(false);

  // hidrata o editor com a revisão mais recente na 1ª carga
  if (code === null && revisions.data) setCode(latest?.code ?? '');

  const current = code ?? '';
  const lintError = lintJs(current);

  /** Roda todos os testes ativos contra o código atual. Devolve true se todos passaram. */
  async function runAll(): Promise<boolean> {
    const list = tests.data ?? [];
    if (list.length === 0) return true;
    setRunning(true);
    const acc: Record<number, TestOutcome> = {};
    let allPassed = true;
    for (const t of list) {
      const r = await runTest(current, t.inputContext ?? null, t.expectedResult ?? null);
      acc[t.id] = { name: t.name, ...r };
      if (r.status !== 'passed') allPassed = false;
    }
    setResults(acc);
    setRunning(false);
    return allPassed;
  }

  async function saveRevision() {
    if (lintError) { toast.error('Corrija os erros de sintaxe antes de salvar.'); return; }
    if (status === 'published' && !(await runAll())) {
      toast.error('Há testes falhando — não é possível publicar.');
      return;
    }
    try {
      const r = await createRev.mutateAsync({ code: current, changelog: changelog || undefined, status });
      toast.success(`Revisão v${r.version} salva.`);
      setChangelog('');
    } catch { toast.error('Falha ao salvar a revisão.'); }
  }

  async function addTest(e: React.FormEvent) {
    e.preventDefault();
    let inputContext: unknown; let expectedResult: unknown;
    try { inputContext = testInput ? JSON.parse(testInput) : undefined; expectedResult = testExpected ? JSON.parse(testExpected) : undefined; }
    catch { toast.error('Input/esperado precisam ser JSON válido.'); return; }
    try {
      await createTest.mutateAsync({ name: testName, inputContext, expectedResult });
      setTestName(''); setTestInput(''); setTestExpected('');
    } catch { toast.error('Falha ao criar o teste.'); }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Código (JavaScript)</span>
          {lintError
            ? <span className="inline-flex items-center gap-1 text-xs text-rose-600"><AlertCircle size={13} /> sintaxe inválida</span>
            : current.trim() && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check size={13} /> sintaxe ok</span>}
        </div>
        <textarea
          value={current}
          onChange={(e) => setCode(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full rounded-md border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-slate-100 focus:outline-none"
          placeholder={'function onChange(field, form) {\n  // ...\n}'}
        />
        {lintError && <p className="mt-1 text-xs text-rose-600">{lintError}</p>}
      </div>

      <div className="grid grid-cols-[1fr_140px_auto] items-end gap-2">
        <Field label="Changelog"><TextInput value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="O que mudou nesta versão" /></Field>
        <Field label="Status"><Select value={status} options={[{ value: 'draft', label: 'Rascunho' }, { value: 'published', label: 'Publicado' }]} onChange={(e) => setStatus(e.target.value)} /></Field>
        <button type="button" onClick={saveRevision} disabled={!!lintError || createRev.isPending} className="h-[34px] rounded-md bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">Salvar revisão</button>
      </div>

      <div>
        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><History size={13} /> Revisões</p>
        <div className="max-h-32 overflow-auto rounded-md border border-slate-200">
          {revisions.data?.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">Nenhuma revisão ainda.</p>}
          {revisions.data?.map((r: ScriptRevision) => (
            <div key={r.version} className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5 text-xs last:border-b-0">
              <span><span className="font-medium text-slate-700">v{r.version}</span> <span className={`rounded-full px-1.5 ${r.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.status}</span> <span className="text-slate-500">{r.changelog}</span></span>
              <button type="button" onClick={() => setCode(r.code)} className="font-medium text-slate-600 hover:text-slate-900">Carregar</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Testes</p>
          <button type="button" onClick={runAll} disabled={running || !!lintError || (tests.data?.length ?? 0) === 0} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <Play size={12} /> {running ? 'Rodando…' : 'Rodar testes'}
          </button>
        </div>
        <div className="mb-2 space-y-1">
          {tests.data?.map((t) => {
            const r = results[t.id];
            return (
              <div key={t.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2">
                  {r && <TestBadge outcome={r} />}
                  <span className="text-slate-700">{t.name}</span>
                  {r?.detail && <span className="text-xs text-slate-400" title={r.detail}>· {r.detail.length > 40 ? `${r.detail.slice(0, 40)}…` : r.detail}</span>}
                </span>
                <button type="button" onClick={() => delTest.mutate(t.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={13} /></button>
              </div>
            );
          })}
        </div>
        <form onSubmit={addTest} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
          <TextInput value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Nome do teste" />
          <div className="grid grid-cols-2 gap-2">
            <TextArea rows={2} value={testInput} onChange={(e) => setTestInput(e.target.value)} className="font-mono text-xs" placeholder='input (JSON), ex: {"valor":10}' />
            <TextArea rows={2} value={testExpected} onChange={(e) => setTestExpected(e.target.value)} className="font-mono text-xs" placeholder="esperado (JSON), ex: 20" />
          </div>
          <button type="submit" disabled={!testName} className="rounded-md border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Adicionar teste</button>
        </form>
        <p className="mt-1 text-[11px] text-slate-400">O script deve definir <code>function run(context)</code>; o teste compara o retorno ao esperado (Web Worker isolado).</p>
      </div>
    </div>
  );
}
