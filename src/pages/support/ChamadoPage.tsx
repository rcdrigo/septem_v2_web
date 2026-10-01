import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Paperclip, Send, Lock, Pencil, History, Trash2, X, Loader2, AlertTriangle, Clock, RotateCcw,
} from 'lucide-react';
import {
  useSupportTicket, useSupportMessages, useSupportTimeline, useEnviarMensagem,
  useEditarMensagem, useRevisoesDaMensagem, useRemoverAnexo, subirArquivoDeSuporte,
  urlDoAnexo, ESTADOS, PRIORIDADES, NATUREZAS,
  type SupportScope, type SupportMessageItem, type SupportAttachment,
} from '@/lib/api/support';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/Field';
import { confirm } from '@/components/ui/ConfirmDialog';
import { toast } from '@/stores/toast';
import { routes } from '@/lib/routes';
import { useSessionStore } from '@/stores/session';
import { AtendimentoPanel, AtividadesEHoras, AcoesDoRequisitante } from '@/components/support/AtendimentoPanel';
import { AprovacoesPanel } from '@/components/support/AprovacoesPanel';
import { useLimites } from '@/components/support/LimitesDoSuporte';
import { avisarErro } from '@/lib/avisos';
import { ApiError } from '@/lib/api';
import { Quando } from '@/components/ui/Quando';

/**
 * Um chamado (Fase 4 — SUP-01/SUP-07).
 *
 * <p>
 * A tela é a MESMA para os dois lados; o que muda é o que o servidor devolve. O compositor
 * oferece "nota interna" só quando `capabilities.canReadInternal` vem verdadeiro — e a decisão
 * continua sendo do backend: a tela não esconde um botão que o servidor aceitaria, nem mostra um
 * que ele recusaria.
 * </p>
 */
export function ChamadoPage({ escopo = 'cliente' }: { escopo?: SupportScope }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const chamado = useSupportTicket(escopo, id);
  const mensagens = useSupportMessages(escopo, id);
  const historico = useSupportTimeline(escopo, id);
  const [revisoesDe, setRevisoesDe] = useState<SupportMessageItem | null>(null);
  const [editando, setEditando] = useState<SupportMessageItem | null>(null);

  const usuario = useSessionStore((s) => s.user?.name ?? '');

  if (chamado.isLoading) return <p className="p-6 text-sm text-slate-400">Carregando…</p>;

  // Falha que NÃO é "não existe para você" (rede, servidor): diz que falhou e oferece tentar de
  // novo — confundir com "indisponível" mandaria a pessoa embora de um chamado que é dela.
  if (chamado.isError && !(chamado.error instanceof ApiError && (chamado.error.status === 404 || chamado.error.status === 403))) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="chamado-erro">
          Não foi possível carregar o chamado.{' '}
          <button type="button" onClick={() => void chamado.refetch()} className="font-medium underline" data-testid="chamado-tentar-de-novo">
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  if (chamado.isError) {
    return (
      <div className="p-6">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" data-testid="chamado-indisponivel">
          Este chamado não está disponível para você.{' '}
          <button type="button" onClick={() => navigate(routes.support)} className="font-medium underline">
            Voltar para a lista
          </button>
        </div>
      </div>
    );
  }

  const t = chamado.data!;
  const caps = t.capabilities;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <button
            type="button" onClick={() => navigate(escopo === 'septem' ? routes.platformSupportTickets : routes.support)}
            className="mt-0.5 shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50"
            aria-label="Voltar"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600" data-testid="detalhe-protocolo">
                {t.protocol}
              </code>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700" data-testid="detalhe-estado">
                {ESTADOS[t.state] ?? t.state}
              </span>
              <span className="text-xs text-slate-500">Prioridade {PRIORIDADES[t.priority] ?? t.priority}</span>
              {t.team && <span className="text-xs text-slate-500" data-testid="detalhe-equipe">Equipe {t.team}</span>}
              {t.dueAt && (
                <span className="text-xs text-slate-500">
                  Previsto para <Quando iso={t.dueAt} so="data" />
                </span>
              )}
            </div>
            <h1 className="mt-1 text-lg font-semibold text-slate-900">{t.subject}</h1>
            <p className="text-xs text-slate-500">
              {NATUREZAS.find((n) => n.value === t.nature)?.label ?? t.nature} · aberto por {t.requester} em{' '}
              <Quando iso={t.createdAt} />
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* Encerramento automático: a data vem do servidor, com o mesmo prazo da varredura. */}
          {t.autoCloseAt && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" data-testid="aviso-encerramento-automatico">
              <Clock size={16} className="mt-0.5 shrink-0" />
              <span>
                Chamado resolvido. Se ninguém responder, ele será <b>encerrado automaticamente em{' '}
                <Quando iso={t.autoCloseAt} so="data" /></b>.
                {caps?.isRequester && ' Se o problema continuar, responda abaixo — o chamado volta para análise.'}
              </span>
            </div>
          )}

          {/* Descrição original: é o pedido, e não some no meio da conversa. */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">O que foi relatado</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700" data-testid="detalhe-descricao">{t.description}</p>
            {t.impact && (
              <>
                <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Impacto</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{t.impact}</p>
              </>
            )}
            <Anexos escopo={escopo} ticketId={id} itens={t.attachments} podeRemover />
          </section>

          {/* Atendimento: só aparece para quem atende — o servidor diz quem é. */}
          <AtendimentoPanel escopo={escopo} chamado={t} />

          {/* Encerrar, cancelar, reabrir: do requisitante, com a lista de ações do servidor (Fase 7). */}
          <AcoesDoRequisitante escopo={escopo} chamado={t} />

          {/* Propostas e validações: o requisitante decide; quem atende propõe (Fase 6). */}
          <AprovacoesPanel escopo={escopo} chamado={t} />

          {/* Atividades concluídas e horas: públicas ao requisitante (S-A12). */}
          <AtividadesEHoras escopo={escopo} ticketId={id} />

          {/* Conversa */}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Conversa</h2>
            {mensagens.isLoading && <p className="text-sm text-slate-400">Carregando mensagens…</p>}
            {(mensagens.data?.items.length ?? 0) === 0 && !mensagens.isLoading && (
              <p className="text-sm text-slate-400" data-testid="sem-mensagens">Nenhuma mensagem ainda.</p>
            )}
            {mensagens.data?.items.map((m) => (
              <article
                key={m.id}
                data-testid="mensagem"
                data-visibilidade={m.visibility}
                className={`rounded-lg border p-3 ${m.visibility === 'internal'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-slate-200 bg-white'}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{m.author}</span>
                  <Quando iso={m.createdAt} />
                  {m.visibility === 'internal' && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-900" data-testid="selo-interna">
                      <Lock size={11} /> Nota interna
                    </span>
                  )}
                  {m.revision > 1 && (
                    <button
                      type="button" onClick={() => setRevisoesDe(m)}
                      data-testid="ver-revisoes"
                      className="flex items-center gap-1 underline hover:text-slate-700"
                    >
                      <History size={11} /> editada ({m.revision - 1})
                    </button>
                  )}
                  {m.author === usuario && (
                    <button
                      type="button" onClick={() => setEditando(m)}
                      data-testid="editar-mensagem"
                      className="flex items-center gap-1 underline hover:text-slate-700"
                    >
                      <Pencil size={11} /> editar
                    </button>
                  )}
                </div>
                {m.body && <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-800">{m.body}</p>}
                <Anexos escopo={escopo} ticketId={id} itens={m.attachments} podeRemover={m.author === usuario} />
              </article>
            ))}
          </section>

          <Compositor escopo={escopo} ticketId={id} podeNotaInterna={caps?.canReadInternal ?? false} reabre={t.replyReopens} />

          {/* Histórico: o que aconteceu, além do que foi dito. */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Histórico</h2>
            <ol className="mt-2 space-y-1.5">
              {historico.data?.items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-xs" data-testid="evento">
                  <Quando iso={e.at} className="shrink-0 text-slate-400" />
                  <span className="text-slate-700">{e.summary}</span>
                  <span className="text-slate-400">— {e.author}</span>
                  {e.visibility === 'internal' && <Lock size={10} className="text-amber-600" />}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {revisoesDe && (
        <DialogoRevisoes escopo={escopo} ticketId={id} mensagem={revisoesDe} onClose={() => setRevisoesDe(null)} />
      )}
      {editando && (
        <DialogoEdicao escopo={escopo} ticketId={id} mensagem={editando} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function Anexos({
  escopo, ticketId, itens, podeRemover,
}: {
  escopo: SupportScope;
  ticketId: string;
  itens: SupportAttachment[];
  podeRemover: boolean;
}) {
  const remover = useRemoverAnexo(escopo, ticketId);
  if (itens.length === 0) return null;

  async function pedirRemocao(a: SupportAttachment) {
    const ok = await confirm({
      title: 'Remover anexo?',
      message: `"${a.name}" deixa de abrir para todos, inclusive para quem já tem o link. O registro de que ele existiu fica.`,
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await remover.mutateAsync(a.id);
      toast.success('Anexo removido.');
    } catch {
      toast.error('Falha ao remover o anexo.');
    }
  }

  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {itens.map((a) => (
        <li key={a.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs" data-testid="anexo">
          <Paperclip size={12} className="shrink-0 text-slate-400" />
          <a href={urlDoAnexo(escopo, a.id)} target="_blank" rel="noreferrer" className="max-w-40 truncate text-slate-700 underline">
            {a.name}
          </a>
          <span className="shrink-0 text-slate-400">{Math.max(1, Math.round(a.size / 1024))} KB</span>
          {podeRemover && (
            <button
              type="button" onClick={() => void pedirRemocao(a)}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
              aria-label={`Remover ${a.name}`}
            >
              <Trash2 size={12} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Compositor: texto, anexo, ou os dois. Vazio não envia — o servidor recusaria de todo modo. */
function Compositor({
  escopo, ticketId, podeNotaInterna, reabre,
}: {
  escopo: SupportScope;
  ticketId: string;
  podeNotaInterna: boolean;
  /** O servidor avisa que este envio reabre o chamado (requisitante, em Resolvido/Encerrado). */
  reabre: boolean;
}) {
  const limites = useLimites();
  const [texto, setTexto] = useState('');
  const [interna, setInterna] = useState(false);
  const [arquivos, setArquivos] = useState<{ nome: string; id?: string; erro?: string; subindo?: boolean }[]>([]);
  const enviar = useEnviarMensagem(escopo, ticketId);
  // Mesma trava do formulário de abertura: estado não segura dois cliques no mesmo instante.
  const enviando = useRef(false);

  const prontos = arquivos.filter((a) => a.id).map((a) => a.id!);
  const subindo = arquivos.some((a) => a.subindo);
  const podeEnviar = (texto.trim().length > 0 || prontos.length > 0) && !subindo && !enviar.isPending;

  async function escolher(lista: FileList | null) {
    if (!lista) return;
    for (const file of Array.from(lista)) {
      setArquivos((a) => [...a, { nome: file.name, subindo: true }]);
      try {
        const salvo = await subirArquivoDeSuporte(escopo, file);
        setArquivos((a) => a.map((x) => x.nome === file.name && x.subindo ? { nome: x.nome, id: salvo.id } : x));
      } catch (err) {
        const erro = err instanceof Error ? err.message : 'falhou';
        setArquivos((a) => a.map((x) => x.nome === file.name && x.subindo ? { nome: x.nome, erro } : x));
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar || enviando.current) return;
    enviando.current = true;
    try {
      await enviar.mutateAsync({ body: texto.trim() || undefined, internal: interna, fileIds: prontos });
      setTexto('');
      setArquivos([]);
      setInterna(false);
    } catch {
      toast.error('Não foi possível enviar. O texto continua aqui.');
    } finally {
      // Aqui a tela NÃO navega, então a trava volta sempre — senão o segundo envio nunca sai.
      enviando.current = false;
    }
  }

  return (
    <form
      onSubmit={submit}
      className={`rounded-lg border p-3 ${interna ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}
      data-testid="compositor"
      data-modo={interna ? 'interna' : 'publica'}
    >
      {podeNotaInterna && (
        <div className="mb-2 flex flex-wrap gap-1" role="tablist" aria-label="Para quem é esta mensagem">
          <button
            type="button" role="tab" aria-selected={!interna} onClick={() => setInterna(false)}
            data-testid="modo-publico"
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${!interna ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Mensagem ao requisitante
          </button>
          <button
            type="button" role="tab" aria-selected={interna} onClick={() => setInterna(true)}
            data-testid="marcar-interna"
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${interna ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Lock size={11} /> Nota interna da organização
          </button>
        </div>
      )}
      <TextArea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={3}
        maxLength={limites.body}
        name="body"
        aria-label={interna ? 'Nota interna da organização' : 'Mensagem ao requisitante'}
        placeholder={interna ? 'Nota visível só para quem atende…' : 'Escreva uma mensagem…'}
      />

      <ul className="mt-2 space-y-1">
        {arquivos.map((a, i) => (
          <li key={`${a.nome}-${i}`} className="flex min-w-0 items-center gap-2 text-xs" data-testid="anexo-compositor">
            {a.subindo && <Loader2 size={12} className="shrink-0 animate-spin text-slate-400" />}
            {a.erro && <AlertTriangle size={12} className="shrink-0 text-amber-600" />}
            <span className={`min-w-0 flex-1 truncate ${a.erro ? 'text-amber-800' : 'text-slate-600'}`}>{a.nome}</span>
            {a.erro && <span className="shrink-0 text-amber-700">{a.erro}</span>}
            <button
              type="button" onClick={() => setArquivos((l) => l.filter((_, idx) => idx !== i))}
              className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label={`Remover ${a.nome}`}
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>

      {reabre && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800" data-testid="aviso-reabre">
          <RotateCcw size={13} className="mt-0.5 shrink-0" />
          Este envio reabrirá o chamado: ele volta para análise da equipe.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
            <Paperclip size={13} /> Anexar
            <input type="file" multiple className="hidden" data-testid="anexar-mensagem" onChange={(e) => void escolher(e.target.files)} />
          </label>
          {/* O modo "nota interna" não é mais um checkbox discreto: quem atende escolhe
              explicitamente entre falar com o requisitante ou anotar para a própria organização. */}
          {podeNotaInterna && <span className="sr-only">modo de envio</span>}
        </div>
        <button
          type="submit"
          disabled={!podeEnviar}
          data-testid="enviar-mensagem"
          className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          <Send size={14} /> {enviar.isPending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}

function DialogoRevisoes({
  escopo, ticketId, mensagem, onClose,
}: {
  escopo: SupportScope;
  ticketId: string;
  mensagem: SupportMessageItem;
  onClose: () => void;
}) {
  const revisoes = useRevisoesDaMensagem(escopo, ticketId, mensagem.id);
  return (
    <Dialog open onClose={onClose} title="Versões anteriores">
      <div className="flex flex-col gap-3" data-testid="dialogo-revisoes">
        {revisoes.isLoading && <p className="text-sm text-slate-400">Carregando…</p>}
        {revisoes.data?.map((r) => (
          <article key={r.revision} className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-xs text-slate-500">
              Versão {r.revision} · editada por {r.editedBy} em{' '}
              <Quando iso={r.editedAt} />
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.body}</p>
          </article>
        ))}
        <div>
          <p className="text-xs font-medium text-slate-500">Versão atual ({mensagem.revision})</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{mensagem.body}</p>
        </div>
      </div>
    </Dialog>
  );
}

function DialogoEdicao({
  escopo, ticketId, mensagem, onClose,
}: {
  escopo: SupportScope;
  ticketId: string;
  mensagem: SupportMessageItem;
  onClose: () => void;
}) {
  const limites = useLimites();
  const [texto, setTexto] = useState(mensagem.body);
  const editar = useEditarMensagem(escopo, ticketId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await editar.mutateAsync({ messageId: mensagem.id, body: texto.trim(), expectedRevision: mensagem.revision });
      toast.success('Mensagem atualizada. A versão anterior fica no histórico.');
      onClose();
    } catch (err) {
      // 409 quando alguém editou no meio: o texto fica, e o aviso oferece recarregar o atual.
      avisarErro(err, 'A mensagem mudou desde que você abriu. Recarregue para ver a versão atual — o seu texto continua aqui.');
    }
  }

  return (
    <Dialog open onClose={onClose} title="Editar mensagem">
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="form-edicao">
        <TextArea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={limites.body} name="body" autoFocus />
        <p className="text-xs text-slate-500">A versão anterior continua visível no histórico de revisões.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="submit" disabled={texto.trim().length === 0 || editar.isPending}
            data-testid="salvar-edicao"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
