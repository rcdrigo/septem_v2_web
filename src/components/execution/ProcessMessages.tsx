import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AtSign, CornerUpLeft, EyeOff, MessageSquare, Send, User } from 'lucide-react';
import {
  useMentionCandidates,
  useProcessMessages,
  useSendProcessMessage,
  type MentionCandidate,
  type ProcessMessage,
} from '@/lib/api/messages';
import { toast } from '@/stores/toast';

type Props = {
  executionId: string;
  originType: 'task' | 'report';
  taskId?: string | null;
  messageAccess?: string | null;
};

type SelectedMention = { id: string; name: string };

export function ProcessMessages({ executionId, originType, taskId, messageAccess }: Props) {
  const messages = useProcessMessages(executionId, messageAccess);
  const send = useSendProcessMessage(executionId, messageAccess);
  const [body, setBody] = useState('');
  const [hidden, setHidden] = useState(false);
  const [replyTo, setReplyTo] = useState<ProcessMessage | null>(null);
  const [selected, setSelected] = useState<Record<string, SelectedMention>>({});
  const [menuIndex, setMenuIndex] = useState(0);
  const mentionMatch = body.match(/(?:^|\s)@([^@\s]*)$/);
  const mentionSearch = mentionMatch?.[1] ?? '';
  const mentionOpen = !!mentionMatch;
  const candidates = useMentionCandidates(executionId, mentionSearch, mentionOpen, messageAccess);
  const firstPage = messages.data?.pages[0];
  const canPost = firstPage?.canPost ?? false;
  const canHide = firstPage?.canHideFromRequester ?? false;
  const choices = useMemo<Array<MentionCandidate | { id: '__all'; name: 'Todos'; email: ''; photoUrl: null; isInternal: true }>>(() => {
    const all = candidates.data?.allowEveryone ? [{ id: '__all' as const, name: 'Todos' as const, email: '' as const, photoUrl: null, isInternal: true as const }] : [];
    return [...all, ...(candidates.data?.items ?? [])];
  }, [candidates.data]);
  const threads = useMemo(() => {
    const ordered = [...(messages.data?.pages ?? [])].reverse().flatMap((page) => page.items);
    const seen = new Set<string>();
    return ordered.filter((thread) => !seen.has(thread.message.id) && !!seen.add(thread.message.id));
  }, [messages.data?.pages]);

  function selectMention(choice: (typeof choices)[number]) {
    setBody((current) => current.replace(/@[^@\s]*$/, `@${choice.name} `));
    if (choice.id === '__all') setSelected((current) => ({ ...current, __all: { id: '__all', name: 'Todos' } }));
    else setSelected((current) => ({ ...current, [choice.id]: { id: choice.id, name: choice.name } }));
    setMenuIndex(0);
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!mentionOpen || choices.length === 0) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setMenuIndex((index) => (index + 1) % choices.length); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setMenuIndex((index) => (index - 1 + choices.length) % choices.length); }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); selectMention(choices[Math.min(menuIndex, choices.length - 1)]); }
    if (event.key === 'Escape') { event.preventDefault(); setBody((current) => current.replace(/@([^@\s]*)$/, '$1')); }
  }

  async function submit() {
    const text = body.trim();
    if (!text) { toast.error('Digite uma mensagem.'); return; }
    const active = Object.values(selected).filter((mention) => text.includes(`@${mention.name}`));
    try {
      await send.mutateAsync({
        body: text,
        mentionedUserIds: active.filter((mention) => mention.id !== '__all').map((mention) => mention.id),
        mentionAll: active.some((mention) => mention.id === '__all'),
        replyToId: replyTo?.id ?? null,
        hiddenFromRequester: canHide && hidden,
        originType,
        taskId: originType === 'task' ? taskId ?? null : null,
      });
      setBody('');
      setSelected({});
      setHidden(false);
      setReplyTo(null);
      toast.success('Mensagem enviada.');
    } catch { toast.error('Não foi possível enviar a mensagem.'); }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" aria-labelledby={`messages-${executionId}`}>
      <div className="flex items-center gap-2">
        <MessageSquare size={17} className="text-slate-500" />
        <h2 id={`messages-${executionId}`} className="text-sm font-semibold text-slate-900">Mensagens</h2>
      </div>

      {messages.isLoading ? (
        <div className="mt-4 space-y-3" aria-label="Carregando mensagens">
          <div className="h-16 animate-pulse rounded-md bg-slate-100" />
          <div className="h-16 animate-pulse rounded-md bg-slate-100" />
        </div>
      ) : threads.length === 0 ? (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">Nenhuma mensagem enviada.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {messages.hasNextPage && (
            <button type="button" onClick={() => void messages.fetchNextPage()} disabled={messages.isFetchingNextPage}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60">
              {messages.isFetchingNextPage ? 'Carregando…' : 'Carregar mensagens anteriores'}
            </button>
          )}
          {threads.map((thread) => (
            <div key={thread.message.id} className="space-y-3">
              <MessageItem message={thread.message} onReply={canPost ? setReplyTo : undefined} />
              {thread.replies.length > 0 && (
                <div className="ml-6 space-y-3 border-l-2 border-slate-100 pl-4 sm:ml-10">
                  {thread.replies.map((reply) => <MessageItem key={reply.id} message={reply} onReply={canPost ? setReplyTo : undefined} compact />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canPost ? (
        <div className="relative mt-5 border-t border-slate-100 pt-4">
          {replyTo && (
            <div className="mb-2 flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><CornerUpLeft size={13} /> Respondendo a <strong>{replyTo.author.name}</strong></span>
              <button type="button" onClick={() => setReplyTo(null)} className="font-medium text-slate-500 hover:text-slate-800">Cancelar</button>
            </div>
          )}
          <label className="sr-only" htmlFor={`message-body-${executionId}`}>Nova mensagem</label>
          <textarea id={`message-body-${executionId}`} value={body} maxLength={4000} rows={4}
            onChange={(event) => { setBody(event.target.value); setMenuIndex(0); }} onKeyDown={onComposerKeyDown}
            placeholder="Escreva uma mensagem. Use @ para mencionar alguém."
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" />
          {mentionOpen && (
            <div role="listbox" aria-label="Usuários para mencionar" className="absolute bottom-[8.25rem] left-0 z-30 max-h-56 w-full max-w-md overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
              {candidates.isLoading ? <p className="px-3 py-2 text-sm text-slate-400">Buscando…</p> : choices.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Nenhum usuário disponível.</p> : choices.map((choice, index) => (
                <button key={choice.id} type="button" role="option" aria-selected={index === menuIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => selectMention(choice)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${index === menuIndex ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                  {choice.id === '__all' ? <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"><AtSign size={15} /></span> : <MessageAvatar photoUrl={choice.photoUrl} name={choice.name} size="sm" />}
                  <span className="min-w-0"><strong className="block truncate text-sm text-slate-800">{choice.name}</strong>{choice.email && <span className="block truncate text-xs text-slate-400">{choice.email}</span>}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {canHide && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                  <EyeOff size={13} /> Ocultar do requisitante
                </label>
              )}
              <span className="text-xs tabular-nums text-slate-400">{body.length}/4000</span>
            </div>
            <button type="button" onClick={() => void submit()} disabled={send.isPending || !body.trim()}
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={14} /> {send.isPending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">A inserção de novas mensagens está desativada para este processo.</p>
      )}
    </section>
  );
}

function MessageItem({ message, onReply, compact = false }: { message: ProcessMessage; onReply?: (message: ProcessMessage) => void; compact?: boolean }) {
  const sentAt = new Date(message.createdAt);
  const friendly = formatDistanceToNow(sentAt, { addSuffix: true, locale: ptBR });
  const exact = sentAt.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium' });
  return (
    <article className={`flex gap-3 ${compact ? 'py-1' : ''}`}>
      <MessageAvatar photoUrl={message.author.photoUrl} name={message.author.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="text-sm text-slate-900">{message.author.name}</strong>
          <time dateTime={message.createdAt} title={exact} className="cursor-help text-xs text-slate-400">{friendly}</time>
          {message.hiddenFromRequester && <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><EyeOff size={10} /> interna</span>}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700"><MentionText message={message} /></p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-400">{originLabel(message)}</p>
          {onReply && <button type="button" onClick={() => onReply(message)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"><CornerUpLeft size={12} /> Responder</button>}
        </div>
      </div>
    </article>
  );
}

function MentionText({ message }: { message: ProcessMessage }) {
  const names = Array.from(new Set(message.mentions.map((mention) => `@${mention.name}`))).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{message.body}</>;
  const pattern = new RegExp(`(${names.map(escapeRegex).join('|')})`, 'g');
  return <>{message.body.split(pattern).map((part, index) => names.includes(part) ? <strong key={`${part}-${index}`} className="font-bold text-slate-900">{part}</strong> : <span key={index}>{part}</span>)}</>;
}

function MessageAvatar({ photoUrl, name, size = 'md' }: { photoUrl: string | null; name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  if (photoUrl) return <img src={photoUrl} alt={name} className={`${cls} shrink-0 rounded-full object-cover`} />;
  return <span role="img" aria-label={`Avatar de ${name}`} className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400`}><User size={size === 'sm' ? 15 : 18} /></span>;
}

function originLabel(message: ProcessMessage) {
  const process = `${message.origin.processName} nº ${message.origin.processNumber}`;
  return message.origin.type === 'task' ? `${message.origin.taskName ?? 'Tarefa'} · ${process}` : `Relatório · ${process}`;
}

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export function processMessagesExtra(props: Props): { id: string; label: string; icon: ReactNode; render: () => ReactNode } {
  return { id: 'messages', label: 'Mensagens', icon: <MessageSquare size={15} />, render: () => <ProcessMessages {...props} /> };
}
