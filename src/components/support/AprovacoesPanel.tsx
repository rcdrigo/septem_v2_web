import { useRef, useState } from 'react';
import { FileCheck2, FilePen, Send, RefreshCw, ThumbsUp, ThumbsDown, Ban, Paperclip } from 'lucide-react';
import {
  useAprovacoes, useTarefas, useComandoDoChamado, urlDoAnexo, formatarDuracao, STATUS_APROVACAO,
  type SupportScope, type SupportTicketDetail, type SupportApprovalVersion, type SupportTask,
} from '@/lib/api/support';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/toast';
import { ApiError } from '@/lib/api';
import { useLimites } from '@/components/support/LimitesDoSuporte';
import { avisarErro } from '@/lib/avisos';

/**
 * Aprovações (Fase 6 — SUP-05): proposta e validação da solução.
 *
 * <p>
 * Duas plateias na mesma seção. O REQUISITANTE decide — e sempre vendo a versão, o conteúdo e a
 * estimativa que está aprovando (a spec pede os três), com motivo obrigatório para rejeitar. Quem
 * ATENDE cria rascunho, submete, revisa e dispensa. As versões anteriores ficam à mostra para os
 * dois: o requisitante tem de poder ver o que já lhe foi proposto.
 * </p>
 */
export function AprovacoesPanel({ escopo, chamado }: { escopo: SupportScope; chamado: SupportTicketDetail }) {
  const versoes = useAprovacoes(escopo, chamado.id);
  const caps = chamado.capabilities;
  const atende = !!caps && (caps.isTriage || caps.isAssignee);
  // Mesma consulta do painel de atendimento (mesma chave): o React Query não busca duas vezes.
  const tarefasQ = useTarefas(escopo, chamado.id, atende);
  const tarefas = tarefasQ.data ?? [];
  const [criando, setCriando] = useState<'proposal' | 'solution' | null>(null);
  const [dispensando, setDispensando] = useState(false);

  const lista = versoes.data ?? [];
  // Agrupa por solicitação; a vigente de cada uma é a de maior revisão.
  const grupos = [...new Map(lista.map((v) => [v.groupId, lista.filter((x) => x.groupId === v.groupId)])).values()]
    .map((vs) => vs.sort((a, b) => b.revision - a.revision));

  if (!atende && grupos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4" data-testid="aprovacoes">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Propostas e validações</h2>
        {atende && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCriando('proposal')} data-testid="nova-proposta"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <FilePen size={12} /> Nova proposta
            </button>
            <button type="button" onClick={() => setCriando('solution')} data-testid="nova-validacao"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <FileCheck2 size={12} /> Pedir validação da solução
            </button>
            <button type="button" onClick={() => setDispensando(true)} data-testid="dispensar-proposta"
              className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <Ban size={12} /> Dispensar proposta
            </button>
          </div>
        )}
      </div>

      {grupos.length === 0 && <p className="text-xs text-slate-500">Nenhuma proposta ou validação neste chamado.</p>}

      {grupos.map((vs) => (
        <Solicitacao key={vs[0].groupId} escopo={escopo} chamado={chamado} versoes={vs} atende={atende} tarefas={tarefas} />
      ))}

      {criando && <DialogoAprovacao escopo={escopo} chamado={chamado} kind={criando} tarefas={tarefas} onClose={() => setCriando(null)} />}
      {dispensando && <DialogoDispensa escopo={escopo} chamado={chamado} onClose={() => setDispensando(false)} />}
    </section>
  );
}

function erro(err: unknown, padrao: string) {
  if (err instanceof ApiError) return err.detail ?? (err.body?.detail as string | undefined) ?? padrao;
  return padrao;
}

/** Uma solicitação: a versão vigente em destaque, as anteriores recolhidas abaixo. */
function Solicitacao({
  escopo, chamado, versoes, atende, tarefas,
}: {
  escopo: SupportScope; chamado: SupportTicketDetail; versoes: SupportApprovalVersion[];
  atende: boolean; tarefas: SupportTask[];
}) {
  const [vigente, ...anteriores] = versoes;
  const [revisando, setRevisando] = useState(false);
  const [decidindo, setDecidindo] = useState<'approve' | 'reject' | null>(null);
  const submeter = useComandoDoChamado<{ expectedVersion: number }>(escopo, chamado.id, 'post', `/approvals/${vigente.id}/submit`);
  const ehRequisitante = !!chamado.capabilities?.isRequester;

  return (
    <article
      id={`aprovacao-${vigente.id}`}
      className="rounded-md border border-slate-200 p-3"
      data-testid="solicitacao" data-status={vigente.status} data-kind={vigente.kind}
    >
      <Versao escopo={escopo} v={vigente} destaque />

      <div className="mt-2 flex flex-wrap gap-2">
        {atende && vigente.status === 'draft' && (
          <button type="button" data-testid="submeter-aprovacao"
            onClick={() => submeter.mutateAsync({ expectedVersion: vigente.version })
              .then(() => toast.success('Enviada ao requisitante.'), (e) => { avisarErro(e, erro(e, 'Não foi possível enviar.')); })}
            className="flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
            <Send size={12} /> Enviar para aprovação
          </button>
        )}
        {atende && vigente.status !== 'superseded' && (
          <button type="button" onClick={() => setRevisando(true)} data-testid="revisar-aprovacao"
            className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700">
            <RefreshCw size={12} /> Revisar
          </button>
        )}
        {ehRequisitante && vigente.status === 'pending' && (
          <>
            <button type="button" onClick={() => setDecidindo('approve')} data-testid="aprovar"
              className="flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white">
              <ThumbsUp size={12} /> Aprovar
            </button>
            <button type="button" onClick={() => setDecidindo('reject')} data-testid="rejeitar"
              className="flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1 text-xs text-rose-800">
              <ThumbsDown size={12} /> Rejeitar
            </button>
          </>
        )}
      </div>

      {anteriores.length > 0 && (
        <details className="mt-2" data-testid="versoes-anteriores">
          <summary className="cursor-pointer text-xs text-slate-500">{anteriores.length} versão(ões) anterior(es)</summary>
          <div className="mt-2 flex flex-col gap-2">
            {anteriores.map((v) => <Versao key={v.id} escopo={escopo} v={v} />)}
          </div>
        </details>
      )}

      {revisando && <DialogoAprovacao escopo={escopo} chamado={chamado} kind={vigente.kind} base={vigente} tarefas={tarefas} onClose={() => setRevisando(false)} />}
      {decidindo && <DialogoDecisao escopo={escopo} chamado={chamado} v={vigente} decisao={decidindo} onClose={() => setDecidindo(null)} />}
    </article>
  );
}

function Versao({ escopo, v, destaque }: { escopo: SupportScope; v: SupportApprovalVersion; destaque?: boolean }) {
  return (
    <div className={destaque ? '' : 'rounded border border-slate-100 bg-slate-50 p-2 opacity-90'} data-testid="versao">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-800">
          {v.kind === 'proposal' ? 'Proposta' : 'Validação da solução'} · versão {v.revision}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700" data-testid="versao-status">{STATUS_APROVACAO[v.status]}</span>
        {v.kind === 'proposal' && (
          <span className="text-slate-600" data-testid="versao-estimativa">
            {v.estimatedMinutes === null ? 'Sem estimativa' : `Estimativa: ${formatarDuracao(v.estimatedMinutes)}`}
          </span>
        )}
        {v.status === 'pending' && v.blocksWork && <span className="text-amber-700">bloqueia o trabalho abrangido</span>}
        {v.status === 'pending' && !v.blocksWork && <span className="text-slate-500">(etapa dispensada — não bloqueia)</span>}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700" data-testid="versao-texto">{v.description}</p>
      {v.rejectionReason && <p className="mt-1 text-xs text-rose-800">Motivo da rejeição: {v.rejectionReason}</p>}
      {v.attachments.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {v.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-1 text-xs">
              <Paperclip size={11} className="text-slate-400" />
              <a href={urlDoAnexo(escopo, a.id)} target="_blank" rel="noreferrer" className="underline">{a.name}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Decidir: o requisitante vê de novo a versão, o conteúdo e a estimativa que está decidindo — a
 * spec pede os três no momento da decisão. Rejeitar exige motivo; trava em ref contra duplo clique.
 */
function DialogoDecisao({
  escopo, chamado, v, decisao, onClose,
}: { escopo: SupportScope; chamado: SupportTicketDetail; v: SupportApprovalVersion; decisao: 'approve' | 'reject'; onClose: () => void }) {
  const limites = useLimites();
  const [motivo, setMotivo] = useState('');
  const decidir = useComandoDoChamado<object>(escopo, chamado.id, 'post', `/approvals/${v.id}/decide`);
  const enviando = useRef(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current || (decisao === 'reject' && !motivo.trim())) return;
    enviando.current = true;
    try {
      await decidir.mutateAsync({ decision: decisao, reason: motivo.trim() || undefined, expectedVersion: v.version });
      toast.success(decisao === 'approve' ? 'Aprovada.' : 'Rejeitada — o chamado volta para análise.');
      onClose();
    } catch (err) {
      avisarErro(err, erro(err, 'Não foi possível registrar a decisão. Recarregue: a versão pode ter mudado.'));
    } finally {
      enviando.current = false;
    }
  }

  return (
    <Dialog open onClose={onClose} title={decisao === 'approve' ? 'Aprovar' : 'Rejeitar'}>
      <form onSubmit={confirmar} className="flex flex-col gap-3" data-testid="dialogo-decisao">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3" data-testid="decisao-resumo">
          <Versao escopo={escopo} v={v} destaque />
        </div>
        {decisao === 'reject' && (
          <Field label="Motivo da rejeição" help="Obrigatório — é o que orienta a próxima versão.">
            <TextArea name="reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={limites.reason} autoFocus />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={decidir.isPending || (decisao === 'reject' && !motivo.trim())} data-testid="confirmar-decisao"
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${decisao === 'approve' ? 'bg-emerald-700' : 'bg-rose-700'}`}>
            {decisao === 'approve' ? `Aprovar a versão ${v.revision}` : `Rejeitar a versão ${v.revision}`}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Criar rascunho ou revisar (mesmo formulário: o que muda é o verbo e a versão de base). */
function DialogoAprovacao({
  escopo, chamado, kind, base, tarefas, onClose,
}: {
  escopo: SupportScope; chamado: SupportTicketDetail; kind: 'proposal' | 'solution';
  base?: SupportApprovalVersion; tarefas: SupportTask[]; onClose: () => void;
}) {
  const limites = useLimites();
  const [texto, setTexto] = useState(base?.description ?? '');
  const [estimativa, setEstimativa] = useState(base?.estimatedMinutes != null ? String(base.estimatedMinutes) : '');
  const [escopoAprov, setEscopoAprov] = useState<'ticket' | 'tasks'>(base?.scope ?? 'ticket');
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const criar = useComandoDoChamado<object>(escopo, chamado.id, 'post', base ? `/approvals/${base.id}/revisions` : '/approvals');
  const abertas = tarefas.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const valido = texto.trim().length > 0 && (escopoAprov === 'ticket' || marcadas.length > 0);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await criar.mutateAsync({
        kind,
        description: texto.trim(),
        estimatedMinutes: kind === 'proposal' && estimativa !== '' ? Number(estimativa) : undefined,
        scope: escopoAprov,
        taskIds: escopoAprov === 'tasks' ? marcadas : undefined,
        expectedVersion: base?.version,
      });
      toast.success(base ? 'Nova versão criada.' : 'Rascunho criado.');
      onClose();
    } catch (err) {
      avisarErro(err, erro(err, 'Não foi possível salvar.'));
    }
  }

  return (
    <Dialog open onClose={onClose} title={`${base ? 'Revisar' : 'Nova'} ${kind === 'proposal' ? 'proposta' : 'validação da solução'}`} width="lg">
      <form onSubmit={salvar} className="flex flex-col gap-3" data-testid="form-aprovacao">
        <Field label={kind === 'proposal' ? 'Solução proposta' : 'O que o requisitante deve validar'}>
          <TextArea name="description" value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={limites.body} />
        </Field>
        {kind === 'proposal' && (
          <Field label="Estimativa (minutos)" help="Não limita a execução — ela pode ser excedida.">
            <TextInput type="number" min={0} name="estimatedMinutes" value={estimativa} onChange={(e) => setEstimativa(e.target.value)} />
          </Field>
        )}
        <Field label="Abrangência" help="O chamado inteiro trava também as tarefas criadas depois.">
          <Select name="scope" value={escopoAprov} onChange={(e) => setEscopoAprov(e.target.value as 'ticket' | 'tasks')}
            options={[{ value: 'ticket', label: 'O chamado inteiro' }, { value: 'tasks', label: 'Tarefas específicas' }]} />
        </Field>
        {escopoAprov === 'tasks' && (
          <fieldset className="flex flex-col gap-1" data-testid="tarefas-abrangidas">
            {abertas.length === 0 && <p className="text-xs text-slate-500">Nenhuma tarefa aberta.</p>}
            {abertas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={marcadas.includes(t.id)}
                  onChange={(e) => setMarcadas((m) => (e.target.checked ? [...m, t.id] : m.filter((x) => x !== t.id)))} />
                {t.title}
              </label>
            ))}
          </fieldset>
        )}
        {base?.status === 'approved' && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="aviso-novo-aceite">
            Esta versão já foi aprovada. A revisão exige novo aceite e volta a bloquear o trabalho abrangido — salvo
            dispensa registrada antes de enviar.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={!valido || criar.isPending} data-testid="salvar-aprovacao"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {base ? 'Criar nova versão' : 'Salvar rascunho'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function DialogoDispensa({ escopo, chamado, onClose }: { escopo: SupportScope; chamado: SupportTicketDetail; onClose: () => void }) {
  const limites = useLimites();
  const [motivo, setMotivo] = useState('');
  const dispensar = useComandoDoChamado<object>(escopo, chamado.id, 'post', '/proposal-waivers');
  return (
    <Dialog open onClose={onClose} title="Dispensar a etapa de proposta">
      <form
        className="flex flex-col gap-3" data-testid="form-dispensa"
        onSubmit={(e) => {
          e.preventDefault();
          void dispensar.mutateAsync({ reason: motivo.trim() })
            .then(() => { toast.success('Etapa de proposta dispensada.'); onClose(); },
              (err) => { avisarErro(err, erro(err, 'Não foi possível dispensar.')); });
        }}
      >
        <p className="text-sm text-slate-600">A dispensa fica no histórico público. Ela não passa por cima de uma proposta que já aguarda o requisitante.</p>
        <TextArea name="reason" aria-label="Motivo da dispensa" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={limites.reason} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={!motivo.trim() || dispensar.isPending} data-testid="confirmar-dispensa"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Dispensar
          </button>
        </div>
      </form>
    </Dialog>
  );
}
