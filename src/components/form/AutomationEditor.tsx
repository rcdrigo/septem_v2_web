import { useEffect, useMemo, useRef, useState } from 'react';
import { diffLines } from 'diff';
import { Code2, History, MessageSquare, Play, Save, Upload } from 'lucide-react';
import { automationApi, type AutomationState, type Conversation, type Revision } from '@/lib/form-automation/api';
import { validateAutomation } from '@/lib/form-automation/validation';
import type { AutomationSource } from '@/lib/form-automation/runtime';
import { ReactForm, type ReactFormHandle } from './ReactForm';
import { Dialog } from '@/components/ui/Dialog';
import { ApiError } from '@/lib/api';
import { useSessionStore } from '@/stores/session';

const button = 'rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-slate-50';
const primary = `${button} bg-slate-900 text-white hover:bg-slate-700`;
const codeOf = (scripts: AutomationSource[], taskId: string) => scripts.find(s => s.taskId === taskId)?.code ?? '';
export function CodeDiff({ before, after }: { before: string; after: string }) {
  return <pre className="max-h-80 overflow-auto rounded border bg-slate-50 p-3 text-xs" aria-label="Diferenças do código">
    {before === after ? 'Sem alterações.' : diffLines(before, after).map((part, i) => <span key={i} className={`block whitespace-pre-wrap ${part.added ? 'bg-emerald-100 text-emerald-900' : part.removed ? 'bg-rose-100 text-rose-900' : 'text-slate-500'}`}>{part.value.split('\n').map((line, j) => <span key={j}>{part.added ? '+ ' : part.removed ? '− ' : '  '}{line}{'\n'}</span>)}</span>)}
  </pre>;
}
export function AutomationEditor({ processKey, onClose }: { processKey: string; onClose?: () => void }) {
  const can = useSessionStore(s => s.can('forms:javascript'));
  const client = useMemo(() => automationApi(processKey), [processKey]);
  const [state, setState] = useState<AutomationState | null>(null);
  const [scripts, setScripts] = useState<AutomationSource[]>([]);
  const [selected, setSelected] = useState('');
  const [history, setHistory] = useState<Revision[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [restoredFrom, setRestoredFrom] = useState<number | null>(null);
  const [changelog, setChangelog] = useState('');
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<{ taskId: string; code: string; base: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remote, setRemote] = useState<AutomationState | null>(null);
  const [tab, setTab] = useState<'code' | 'diff' | 'history'>('code');
  const [revision, setRevision] = useState<Revision | null>(null);
  const [preview, setPreview] = useState<AutomationSource[] | null>(null);
  const [previewResult, setPreviewResult] = useState('');
  const previewRef = useRef<ReactFormHandle>(null);
  const current = codeOf(scripts, selected);
  const dirty = !!state && JSON.stringify(scripts) !== JSON.stringify(state.scripts);
  const diagnostics = useMemo(() => scripts.flatMap(s => {
    const result = validateAutomation(s.code);
    return [...result.errors.map(text => ({ scope: s.taskId || 'Comum', text, error: true })), ...result.warnings.map(text => ({ scope: s.taskId || 'Comum', text, error: false }))];
  }), [scripts]);
  const invalid = diagnostics.some(d => d.error);
  useEffect(() => {
    if (!can) return;
    let cancelled = false;
    Promise.all([client.load(), client.history(), client.conversations()]).then(([data, rows, chats]) => {
      if (cancelled) return;
      setState(data); setScripts(data.scripts); setHistory(rows); setConversations(chats);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [client, can]);
  useEffect(() => {
    if (!dirty && !proposal) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty, proposal]);
  const close = () => { if ((!dirty && !proposal) || window.confirm('Descartar alterações não salvas?')) onClose?.(); };
  function edit(code: string) {
    setScripts(prev => prev.some(s => s.taskId === selected) ? prev.map(s => s.taskId === selected ? { ...s, code } : s) : [...prev, { taskId: selected, code }]);
  }
  async function failure(e: unknown) {
    if (e instanceof ApiError && e.status === 409) setRemote(await client.load());
    setError(e instanceof ApiError ? (e.body as { error?: string })?.error ?? e.message : (e as Error).message);
  }
  async function save() {
    if (!state || invalid) return;
    setBusy(true); setError('');
    try {
      const saved = await client.save({ expectedVersion: state.head, scripts, changelog, conversationIds: linkedIds, restoredFrom });
      setState({ ...state, head: saved.version, scripts: structuredClone(scripts) });
      setHistory(await client.history()); setMessage(`Rascunho v${saved.version} salvo. A publicação continua separada.`);
      setRestoredFrom(null); setLinkedIds([]);
    } catch (e) { await failure(e); } finally { setBusy(false); }
  }
  async function publish() {
    if (!state || dirty || invalid || !state.head) return;
    setBusy(true); setError('');
    try {
      const result = await client.publish(state.head);
      setState({ ...state, head: result.version, publishedVersion: result.version });
      setHistory(await client.history()); setMessage(`Conjunto v${result.version} publicado.`);
    } catch (e) { await failure(e); } finally { setBusy(false); }
  }
  async function ask() {
    if (!prompt.trim()) return;
    setBusy(true); setError('');
    const base = current, taskId = selected;
    try {
      const chat = await client.chat({ conversationId: conversation?.id ?? null, expectedConversationVersion: conversation?.version ?? 0, taskId, prompt, scripts });
      setConversation(chat); setConversations(prev => [...prev.filter(c => c.id !== chat.id), chat]);
      setLinkedIds(prev => [...new Set([...prev, chat.id])]); setPrompt('');
      const last = chat.messages.at(-1);
      if (last?.code != null) setProposal({ taskId, code: last.code, base });
    } catch (e) { await failure(e); } finally { setBusy(false); }
  }
  if (!can) return <p role="alert">Você não tem permissão para customizar JavaScript.</p>;
  if (!state) return <p role={error ? 'alert' : 'status'}>{error || 'Carregando customização…'}</p>;
  const label = (id: string) => id ? state.tasks.find(t => t.id === id)?.name ?? `${id} (tarefa removida)` : 'Código comum';
  return <div className="space-y-4" data-testid="automation-editor">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">JavaScript do formulário</h2><p className="text-xs text-slate-500">{processKey} · Rascunho v{state.head} · {state.publishedVersion ? `Publicado v${state.publishedVersion}` : 'Ainda não publicado'}</p></div>
      <div className="flex flex-wrap gap-2">
        <button className={button} disabled={busy || invalid} onClick={() => { setPreview(scripts.filter(s => !s.taskId || s.taskId === selected)); setPreviewResult(''); }}><Play size={14} className="inline" /> Testar prévia</button>
        <button className={button} disabled={busy || invalid || !!remote} onClick={save}><Save size={14} className="inline" /> Salvar rascunho</button>
        <button className={primary} disabled={busy || invalid || dirty || !!remote || !state.head || state.head === state.publishedVersion} onClick={publish}><Upload size={14} className="inline" /> Publicar conjunto</button>
        {onClose && <button className={button} onClick={close}>Fechar</button>}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    {remote && <div className="space-y-2 rounded border border-amber-400 p-3"><p>Existe uma versão mais recente (v{remote.head}). Seu código foi preservado. Compare antes de continuar.</p>
      {[...new Set([...remote.scripts, ...scripts].map(s => s.taskId))].map(id => <div key={id}><h3>{label(id)}</h3><CodeDiff before={codeOf(remote.scripts, id)} after={codeOf(scripts, id)} /></div>)}
      <button className={button} onClick={() => { setState(remote); setScripts(remote.scripts); setRemote(null); setError(''); }}>Carregar versão do servidor</button>
      <button className={button} onClick={() => { setState(remote); setRemote(null); setError(''); setTab('diff'); }}>Manter minha edição sobre a nova base</button>
    </div>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <section className="min-w-0 space-y-3">
        <label className="block text-sm font-medium">Escopo<select aria-label="Escopo do código" className="mt-1 w-full rounded border p-2" value={selected} disabled={busy} onChange={e => { setSelected(e.target.value); setScripts(prev => prev.some(s => s.taskId === e.target.value) ? prev : [...prev, { taskId: e.target.value, code: '' }]); }}>
          <option value="">Código comum (todas as tarefas)</option>
          {state.tasks.map(t => <option key={t.id} value={t.id}>{t.name} · {t.id}</option>)}
          {scripts.filter(s => s.taskId && !state.tasks.some(t => t.id === s.taskId)).map(s => <option key={s.taskId} value={s.taskId}>{label(s.taskId)}</option>)}
        </select></label>
        {selected && <button className={button} disabled={busy} onClick={() => { setScripts(prev => prev.filter(s => s.taskId !== selected)); setSelected(''); }}>Remover código desta tarefa do rascunho</button>}
        <div className="flex gap-2"><button className={button} onClick={() => setTab('code')}><Code2 size={14} className="inline" /> Código</button><button className={button} onClick={() => setTab('diff')}>Diferenças</button><button className={button} onClick={() => setTab('history')}><History size={14} className="inline" /> Histórico</button></div>
        {tab === 'code' && <textarea aria-label="Código JavaScript" spellCheck={false} value={current} disabled={busy} onChange={e => edit(e.target.value)} rows={18} className="w-full rounded border bg-slate-950 p-3 font-mono text-xs text-slate-100" placeholder={'form.on("change", "tipo", () => {\n  if (form.get("tipo") === "empresa") form.show("empresa");\n  else form.hide("empresa");\n});'} />}
        {tab === 'diff' && <CodeDiff before={codeOf(state.scripts, selected)} after={current} />}
        {tab === 'history' && <div className="max-h-96 space-y-2 overflow-auto">{history.length === 0 && <p>Sem versões salvas.</p>}{history.map(r => <div key={r.version} className="rounded border p-3 text-sm"><p className="font-medium">v{r.version} · {r.status === 'published' ? 'Publicado' : 'Rascunho'}</p><p>{r.changelog}</p><p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()} · Autor: {r.authorName}{r.publisherName && ` · Publicado por: ${r.publisherName}`}</p><div className="mt-2 flex gap-2"><button className={button} onClick={() => setRevision(r)}>Comparar e ver conversa</button><button disabled={busy} className={button} onClick={() => { if (dirty && !window.confirm('Substituir sua edição pela versão escolhida?')) return; setScripts(structuredClone(r.scripts)); setRestoredFrom(r.version); setChangelog(`Restauração da versão ${r.version}`); setTab('diff'); setMessage('Versão carregada para revisão. Salve e publique para ativá-la.'); }}>Restaurar para revisão</button></div></div>)}</div>}
        {diagnostics.map((d, i) => <p key={i} role={d.error ? 'alert' : undefined} className={`text-xs ${d.error ? 'text-rose-700' : 'text-amber-700'}`}>{d.scope}: {d.text}</p>)}
        <label className="block text-sm">Descrição da alteração<input className="mt-1 w-full rounded border p-2" value={changelog} onChange={e => setChangelog(e.target.value)} /></label>
        <details className="text-xs text-slate-600"><summary>API de automação e limites da validação</summary><p className="mt-2">Use form.get/set, show/hide, update/add/remove, setRequired, setDisabled, setOptions, getSchema/setSchema, on e beforeSubmit. IDs e chaves identificam campos e grupos. form.root e form.query dão acesso ao DOM. jQuery está disponível em $ e jQuery; prefira $(form.root).find(...). Use form.set para atualizar valores controlados pelo React.</p><p className="mt-2">form.dataSource(id, parâmetros) consulta fontes pela API. fetch e $.ajax permitem outras integrações. Registre limpeza em form.onCleanup. Sintaxe e análise estática não detectam todos os erros: teste dados e respostas reais na prévia. O código comum será entregue também aos usuários externos.</p></details>
      </section>
      <section className="min-w-0 space-y-3 rounded border bg-slate-50 p-3">
        <h3 className="font-medium"><MessageSquare size={15} className="inline" /> Agente · OpenRouter</h3>
        <select aria-label="Conversa" className="w-full rounded border p-2 text-sm" value={conversation?.id ?? ''} disabled={busy} onChange={e => setConversation(conversations.find(c => c.id === e.target.value) ?? null)}><option value="">Nova conversa</option>{conversations.map(c => <option key={c.id} value={c.id}>{c.messages[0]?.content.slice(0, 65) || c.id}</option>)}</select>
        <div className="max-h-72 space-y-3 overflow-auto" aria-live="polite">{conversation?.messages.map((m, i) => <div key={i} className="rounded border bg-white p-2 text-sm"><p className="text-xs font-medium text-slate-500">{m.role === 'user' ? 'Solicitação' : 'Agente'} · {label(m.taskId)}{m.model && ` · ${m.model}`}</p><p className="whitespace-pre-wrap">{m.content}</p></div>)}</div>
        <textarea aria-label="Pedido ao agente" className="w-full rounded border p-2 text-sm" rows={4} value={prompt} disabled={busy} onChange={e => setPrompt(e.target.value)} placeholder="Descreva o comportamento desejado para o escopo selecionado…" />
        <button className={primary} disabled={busy || !prompt.trim()} onClick={ask}>{busy ? 'Aguarde…' : 'Gerar proposta'}</button>
        {proposal && <div className="space-y-2"><p className="text-sm font-medium">Proposta para {label(proposal.taskId)}</p><CodeDiff before={codeOf(scripts, proposal.taskId)} after={proposal.code} /><textarea aria-label="Editar proposta" className="w-full rounded border p-2 font-mono text-xs" rows={8} value={proposal.code} onChange={e => setProposal({ ...proposal, code: e.target.value })} />
          <button disabled={busy} className={button} onClick={() => { if (codeOf(scripts, proposal.taskId) !== proposal.base && !window.confirm('O código mudou após o pedido. Aplicar a proposta sobre sua edição atual?')) return; setScripts(prev => prev.some(s => s.taskId === proposal.taskId) ? prev.map(s => s.taskId === proposal.taskId ? { ...s, code: proposal.code } : s) : [...prev, { taskId: proposal.taskId, code: proposal.code }]); setSelected(proposal.taskId); setProposal(null); setTab('diff'); }}>Aplicar ao editor</button><button disabled={busy} className={button} onClick={() => setProposal(null)}>Descartar proposta</button>
        </div>}
      </section>
    </div>
    {preview && <Dialog open title={`Prévia · ${label(selected)}`} width="2xl" onClose={() => setPreview(null)}><ReactForm ref={previewRef} schema={state.schema} automationScripts={preview} /><button className={`${button} mt-4`} onClick={async () => { const result = await previewRef.current?.submit(); setPreviewResult(result && !Object.keys(result.errors).length ? 'Validação concluída. Nenhum dado foi enviado.' : JSON.stringify(result?.errors)); }}>Simular envio</button><p role="status" className="mt-2 text-sm">{previewResult}</p></Dialog>}
    {revision && <Dialog open title={`Versão ${revision.version} · diferenças e conversas`} width="2xl" onClose={() => setRevision(null)}><div className="space-y-4">{[...new Set([...scripts, ...revision.scripts].map(s => s.taskId))].map(id => <div key={id}><h3>{label(id)}</h3><CodeDiff before={codeOf(scripts, id)} after={codeOf(revision.scripts, id)} /></div>)}{revision.conversations.map((c, i) => <div key={i}><h3 className="font-medium">Solicitado por {c.requesterName}</h3>{c.messages.map((m, j) => <div key={j} className="my-2 rounded border p-2 text-sm"><p>{m.role} · {new Date(m.createdAt).toLocaleString()} · {m.model}</p><p className="whitespace-pre-wrap">{m.content}</p>{m.code != null && <pre className="overflow-auto text-xs">{m.code}</pre>}</div>)}</div>)}</div></Dialog>}
  </div>;
}
