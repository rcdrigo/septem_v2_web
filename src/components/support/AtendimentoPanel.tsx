import { useRef, useState } from 'react';
import { Play, CheckCircle2, XCircle, PauseCircle, RotateCcw, Flag, ArrowRightLeft, Plus, Pencil, AlertTriangle } from 'lucide-react';
import {
  useTarefas, useApontamentos, useComandoDoChamado, useEquipesElegiveis,
  CATEGORIAS, STATUS_TAREFA, PRIORIDADES, formatarDuracao,
  type SupportScope, type SupportTicketDetail, type SupportTask, type SupportWorkLog,
} from '@/lib/api/support';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field';
import { toast } from '@/stores/toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { useLimites } from '@/components/support/LimitesDoSuporte';
import { avisarErro } from '@/lib/avisos';
import { Quando } from '@/components/ui/Quando';

/**
 * Painel de atendimento (Fase 5 — SUP-03/04/06/08).
 *
 * <p>
 * <b>A tela não decide nada sozinha.</b> Quais transições aparecem vem de `chamado.actions`; o
 * que dá para fazer em cada tarefa vem de `canStart`/`canComplete`/`canCancel`; quem corrige um
 * apontamento vem de `canCorrect`. Tudo calculado pelo servidor com as MESMAS regras dos
 * comandos — e há teste amarrando uma coisa à outra. Reimplementar a tabela SUP-03 aqui seria
 * criar a segunda versão dela.
 * </p>
 */
export function AtendimentoPanel({ escopo, chamado }: { escopo: SupportScope; chamado: SupportTicketDetail }) {
  const caps = chamado.capabilities;
  const atende = !!caps && (caps.isTriage || caps.isTeamMember || caps.isAssignee);
  const tarefas = useTarefas(escopo, chamado.id, atende);

  if (!atende) return null;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-cyan-200 bg-cyan-50/40 p-4" data-testid="painel-atendimento">
      <h2 className="text-sm font-semibold text-slate-900">Atendimento</h2>
      <Transicoes escopo={escopo} chamado={chamado} />
      {caps!.isTriage && <Classificacao escopo={escopo} chamado={chamado} />}
      {(caps!.isTriage || caps!.isAssignee) && (
        <Encaminhamento escopo={escopo} chamado={chamado} tarefas={tarefas.data ?? []} />
      )}
      <Tarefas escopo={escopo} chamado={chamado} tarefas={tarefas.data ?? []} />
    </section>
  );
}

/** Mostra a mensagem de erro do servidor — o `detail` já vem escrito para gente. */
function erroDoServidor(err: unknown, padrao: string) {
  if (err instanceof ApiError) {
    const detalhe = err.detail ?? (err.body?.detail as string | undefined);
    if (detalhe) return detalhe;
    if (err.status === 409) return 'O chamado mudou desde que você abriu. Recarregue e tente de novo.';
  }
  return padrao;
}

// ── Transições ──────────────────────────────────────────────────────────────────

const ROTULOS: Record<string, { label: string; icon: typeof Play }> = {
  analyze: { label: 'Iniciar análise', icon: Play },
  start: { label: 'Iniciar atendimento', icon: Play },
  wait: { label: 'Solicitar retorno', icon: PauseCircle },
  resume: { label: 'Retomar', icon: RotateCcw },
  resolve: { label: 'Marcar resolvido', icon: Flag },
  close: { label: 'Encerrar chamado', icon: CheckCircle2 },
  cancel: { label: 'Cancelar chamado', icon: XCircle },
  reopen: { label: 'Reabrir chamado', icon: RotateCcw },
};

/** Ações que pedem motivo antes de ir ao servidor (o servidor recusa sem ele de todo modo). */
const PEDEM_MOTIVO: Record<string, { titulo: string; explicacao: string }> = {
  wait: {
    titulo: 'Solicitar retorno do requisitante',
    explicacao: 'O chamado fica aguardando a resposta. O motivo aparece no histórico público.',
  },
  cancel: {
    titulo: 'Cancelar o chamado',
    explicacao: 'As tarefas em aberto são canceladas e as horas já registradas ficam. Conte o motivo — ele aparece no histórico.',
  },
  reopen: {
    titulo: 'Reabrir o chamado cancelado',
    explicacao: 'O chamado volta para análise. Explique por que ele precisa ser retomado.',
  },
};

/**
 * Ações do REQUISITANTE (Fase 7 — SUP-03): encerrar, cancelar, reabrir. São as mesmas transições
 * do painel de atendimento — a lista vem de `chamado.actions`, calculada pelo servidor.
 */
export function AcoesDoRequisitante({ escopo, chamado }: { escopo: SupportScope; chamado: SupportTicketDetail }) {
  const caps = chamado.capabilities;
  const atende = !!caps && (caps.isTriage || caps.isTeamMember || caps.isAssignee);
  if (!caps?.isRequester || atende || chamado.actions.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid="acoes-requisitante">
      <h2 className="mb-2 text-sm font-semibold text-slate-900">O que você pode fazer</h2>
      <Transicoes escopo={escopo} chamado={chamado} />
    </section>
  );
}

function Transicoes({ escopo, chamado }: { escopo: SupportScope; chamado: SupportTicketDetail }) {
  const transicionar = useComandoDoChamado<{ action: string; reason?: string; triageResolved?: boolean; expectedVersion: number }>(
    escopo, chamado.id, 'post', '/transitions');
  const [pedindo, setPedindo] = useState<string | null>(null);

  async function executar(action: string, reason?: string, triageResolved?: boolean) {
    try {
      await transicionar.mutateAsync({ action, reason, triageResolved, expectedVersion: chamado.version });
      toast.success(`${ROTULOS[action]?.label ?? action}: feito.`);
      setPedindo(null);
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'Não foi possível mudar o estado.'));
    }
  }

  /** Encerrar é definitivo para o fluxo normal — confirma antes (a spec pede a confirmação). */
  async function encerrar() {
    const ok = await confirm({
      title: 'Encerrar o chamado?',
      message: 'Confirme que o problema foi resolvido. Depois de encerrado, uma nova mensagem sua reabre o chamado.',
      confirmLabel: 'Encerrar',
      cancelLabel: 'Voltar',
    });
    if (ok) await executar('close');
  }

  if (chamado.actions.length === 0) {
    return <p className="text-xs text-slate-500" data-testid="sem-transicoes">Nenhuma mudança de estado disponível para você agora.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="transicoes">
      {chamado.actions.map((a) => {
        const r = ROTULOS[a] ?? { label: a, icon: Play };
        const Icone = r.icon;
        return (
          <button
            key={a} type="button"
            disabled={transicionar.isPending}
            data-testid={`transicao-${a}`}
            onClick={() => (a in PEDEM_MOTIVO || a === 'resolve' ? setPedindo(a) : a === 'close' ? void encerrar() : void executar(a))}
            className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Icone size={13} /> {r.label}
          </button>
        );
      })}
      {pedindo && PEDEM_MOTIVO[pedindo] && (
        <DialogoMotivo
          titulo={PEDEM_MOTIVO[pedindo].titulo}
          explicacao={PEDEM_MOTIVO[pedindo].explicacao}
          obrigatorio
          onClose={() => setPedindo(null)}
          onConfirm={(motivo) => executar(pedindo, motivo)}
        />
      )}
      {pedindo === 'resolve' && (
        <DialogoResolver onClose={() => setPedindo(null)} onConfirm={(motivo, resolutiva) => executar('resolve', motivo, resolutiva)} />
      )}
    </div>
  );
}

function DialogoMotivo({
  titulo, explicacao, obrigatorio, onClose, onConfirm,
}: {
  titulo: string; explicacao: string; obrigatorio: boolean;
  onClose: () => void; onConfirm: (motivo: string) => Promise<void> | void;
}) {
  const limites = useLimites();
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open onClose={onClose} title={titulo}>
      <form
        className="flex flex-col gap-3" data-testid="dialogo-motivo"
        onSubmit={(e) => { e.preventDefault(); void onConfirm(motivo.trim()); }}
      >
        <p className="text-sm text-slate-600">{explicacao}</p>
        <TextArea name="reason" aria-label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={limites.reason} autoFocus />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button
            type="submit" disabled={obrigatorio && !motivo.trim()}
            data-testid="confirmar-motivo"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** Resolver, com a marcação da Q25: a triagem resolveu o chamado (torna a triagem cobrável). */
function DialogoResolver({ onClose, onConfirm }: { onClose: () => void; onConfirm: (motivo: string | undefined, resolutiva: boolean) => void }) {
  const limites = useLimites();
  const [resolutiva, setResolutiva] = useState(false);
  const [motivo, setMotivo] = useState('');
  return (
    <Dialog open onClose={onClose} title="Marcar como resolvido">
      <form
        className="flex flex-col gap-3" data-testid="dialogo-resolver"
        onSubmit={(e) => { e.preventDefault(); onConfirm(motivo.trim() || undefined, resolutiva); }}
      >
        <p className="text-sm text-slate-600">
          Todas as tarefas precisam estar concluídas ou canceladas. O requisitante é avisado da resolução.
        </p>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={resolutiva} onChange={(e) => setResolutiva(e.target.checked)} data-testid="triagem-resolutiva" className="mt-0.5" />
          <span>
            A <b>triagem resolveu</b> o chamado, sem encaminhar para desenvolvimento.
            <span className="block text-xs text-slate-500">Isso torna cobrável o tempo de triagem da Septem neste chamado.</span>
          </span>
        </label>
        {resolutiva && (
          <Field label="Justificativa" help="Obrigatória: é ela que sustenta a cobrança da triagem.">
            <TextArea name="reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={limites.reason} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button
            type="submit" disabled={resolutiva && !motivo.trim()}
            data-testid="confirmar-resolver"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Marcar resolvido
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Classificação ───────────────────────────────────────────────────────────────

function Classificacao({ escopo, chamado }: { escopo: SupportScope; chamado: SupportTicketDetail }) {
  const [prioridade, setPrioridade] = useState(chamado.priority);
  const [prazo, setPrazo] = useState(chamado.dueAt ? chamado.dueAt.slice(0, 10) : '');
  const classificar = useComandoDoChamado<{ priority: string; dueAt?: string; clearDueAt?: boolean; expectedVersion: number }>(
    escopo, chamado.id, 'patch', '/classification');
  const mudou = prioridade !== chamado.priority || prazo !== (chamado.dueAt ? chamado.dueAt.slice(0, 10) : '');

  async function salvar() {
    try {
      await classificar.mutateAsync({
        priority: prioridade,
        dueAt: prazo ? new Date(`${prazo}T12:00:00Z`).toISOString() : undefined,
        clearDueAt: !prazo,
        expectedVersion: chamado.version,
      });
      toast.success('Classificação salva.');
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'Não foi possível classificar.'));
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="classificacao">
      <label className="w-40">
        <span className="mb-1 block text-xs font-medium text-slate-500">Prioridade</span>
        <Select
          value={prioridade} onChange={(e) => setPrioridade(e.target.value)} data-testid="prioridade"
          options={Object.entries(PRIORIDADES).map(([value, label]) => ({ value, label }))}
        />
      </label>
      <label className="w-44">
        <span className="mb-1 block text-xs font-medium text-slate-500">Prazo previsto (opcional)</span>
        <TextInput type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} data-testid="prazo" />
      </label>
      <button
        type="button" disabled={!mudou || classificar.isPending} onClick={() => void salvar()}
        data-testid="salvar-classificacao"
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
      >
        Salvar classificação
      </button>
    </div>
  );
}

// ── Encaminhamento / transferência ──────────────────────────────────────────────

type Destino = { action: 'complete' | 'cancel' | 'reassign' | ''; reason?: string; assigneeUserId?: string; minutos?: string; descricao?: string };

function Encaminhamento({ escopo, chamado, tarefas }: { escopo: SupportScope; chamado: SupportTicketDetail; tarefas: SupportTask[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
      <span data-testid="equipe-atual">
        {chamado.team ? <>Equipe <b>{chamado.team}</b> · responsável <b>{chamado.owner ?? '—'}</b></> : 'Ainda não encaminhado.'}
      </span>
      <button
        type="button" onClick={() => setAberto(true)} data-testid="abrir-transferencia"
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
      >
        <ArrowRightLeft size={13} /> {chamado.team ? 'Transferir' : 'Encaminhar'}
      </button>
      {aberto && <DialogoTransferencia escopo={escopo} chamado={chamado} tarefas={tarefas} onClose={() => setAberto(false)} />}
    </div>
  );
}

/**
 * Transferência com destino OBRIGATÓRIO para cada tarefa aberta de fora da nova equipe (SUP-04).
 * O botão só habilita quando todas têm destino — e o servidor revalida tudo, atomicamente.
 */
function DialogoTransferencia({
  escopo, chamado, tarefas, onClose,
}: { escopo: SupportScope; chamado: SupportTicketDetail; tarefas: SupportTask[]; onClose: () => void }) {
  const equipes = useEquipesElegiveis(escopo);
  const [equipeId, setEquipeId] = useState('');
  const [donoId, setDonoId] = useState('');
  const [destinos, setDestinos] = useState<Record<string, Destino>>({});
  const transferir = useComandoDoChamado<object>(escopo, chamado.id, 'post', '/assign');

  const equipe = (equipes.data ?? []).find((e) => e.id === equipeId);
  const membros = (equipe?.members ?? []);
  const idsDaNova = new Set(membros.map((m) => m.userId));
  // Tarefas abertas cujo responsável NÃO está na nova equipe: precisam de destino.
  const pendentes = tarefas.filter((t) => (t.status === 'pending' || t.status === 'in_progress')
    && !(t.assigneeId && idsDaNova.has(t.assigneeId)));

  const completo = pendentes.every((t) => {
    const d = destinos[t.id];
    if (!d?.action) return false;
    if (d.action === 'cancel') return !!d.reason?.trim();
    if (d.action === 'reassign') return !!d.assigneeUserId;
    return !!d.descricao?.trim() && d.minutos !== undefined && d.minutos !== '';
  });
  const pode = !!equipeId && !!donoId && completo && !transferir.isPending;

  async function confirmar() {
    try {
      await transferir.mutateAsync({
        teamId: equipeId,
        ownerId: donoId,
        expectedVersion: chamado.version,
        taskResolutions: pendentes.map((t) => {
          const d = destinos[t.id];
          return {
            taskId: t.id,
            action: d.action,
            reason: d.reason,
            assigneeUserId: d.assigneeUserId,
            activityDescription: d.descricao,
            durationMinutes: d.minutos === undefined ? undefined : Number(d.minutos),
          };
        }),
      });
      toast.success('Chamado transferido.');
      onClose();
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'A transferência não foi feita — nada mudou.'));
    }
  }

  const set = (id: string, patch: Partial<Destino>) => setDestinos((d) => ({ ...d, [id]: { ...(d[id] ?? { action: '' }), ...patch } }));

  return (
    <Dialog open onClose={onClose} title={chamado.team ? 'Transferir chamado' : 'Encaminhar chamado'} width="lg">
      <div className="flex flex-col gap-3" data-testid="dialogo-transferencia">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Equipe">
            <Select
              value={equipeId} onChange={(e) => { setEquipeId(e.target.value); setDonoId(''); }} data-testid="transferir-equipe"
              placeholder="Selecione a equipe"
              options={(equipes.data ?? []).filter((e) => e.active).map((e) => ({ value: e.id, label: e.name }))}
            />
          </Field>
          <Field label="Responsável">
            <Select
              value={donoId} onChange={(e) => setDonoId(e.target.value)} disabled={!equipe} data-testid="transferir-dono"
              placeholder="Selecione o responsável"
              options={membros.map((m) => ({ value: m.userId, label: m.name }))}
            />
          </Field>
        </div>

        {equipe && pendentes.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3" data-testid="tarefas-a-resolver">
            <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
              <AlertTriangle size={14} /> {pendentes.length} tarefa(s) aberta(s) precisam de destino
            </p>
            <p className="mb-2 text-xs text-amber-800">Conclua a sua, cancele com motivo ou reatribua a alguém da nova equipe. Se qualquer uma falhar, nada muda.</p>
            <ul className="flex flex-col gap-2">
              {pendentes.map((t) => {
                const d = destinos[t.id] ?? { action: '' };
                return (
                  <li key={t.id} className="rounded border border-amber-200 bg-white p-2 text-sm" data-testid="tarefa-a-resolver">
                    <p className="font-medium text-slate-800">{t.title} <span className="text-xs text-slate-500">· {t.assignee}</span></p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Select
                        value={d.action} onChange={(e) => set(t.id, { action: e.target.value as Destino['action'] })}
                        data-testid="destino-tarefa"
                        options={[
                          { value: '', label: 'Escolha o destino…' },
                          ...(t.canComplete ? [{ value: 'complete', label: 'Concluir (é minha)' }] : []),
                          { value: 'cancel', label: 'Cancelar' },
                          { value: 'reassign', label: 'Reatribuir' },
                        ]}
                      />
                      {d.action === 'cancel' && (
                        <TextInput placeholder="Motivo" value={d.reason ?? ''} onChange={(e) => set(t.id, { reason: e.target.value })} data-testid="motivo-cancelar-tarefa" />
                      )}
                      {d.action === 'reassign' && (
                        <Select
                          value={d.assigneeUserId ?? ''} onChange={(e) => set(t.id, { assigneeUserId: e.target.value })}
                          placeholder="Novo responsável"
                          options={membros.map((m) => ({ value: m.userId, label: m.name }))}
                        />
                      )}
                      {d.action === 'complete' && (
                        <>
                          <TextInput placeholder="O que foi feito" value={d.descricao ?? ''} onChange={(e) => set(t.id, { descricao: e.target.value })} />
                          <TextInput type="number" min={0} placeholder="Minutos" value={d.minutos ?? ''} onChange={(e) => set(t.id, { minutos: e.target.value })} className="w-28" />
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button
            type="button" disabled={!pode} onClick={() => void confirmar()}
            data-testid="confirmar-transferencia"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {chamado.team ? 'Transferir' : 'Encaminhar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ── Tarefas ─────────────────────────────────────────────────────────────────────

function Tarefas({ escopo, chamado, tarefas }: { escopo: SupportScope; chamado: SupportTicketDetail; tarefas: SupportTask[] }) {
  const [criando, setCriando] = useState(false);
  const [concluindo, setConcluindo] = useState<SupportTask | null>(null);
  const [residual, setResidual] = useState<SupportTask | null>(null);
  const [cancelando, setCancelando] = useState<SupportTask | null>(null);
  const iniciar = useComandoDoChamado<{ taskId: string; expectedVersion: number }>(escopo, chamado.id, 'post', (b) => `/tasks/${b.taskId}/start`);
  const cancelar = useComandoDoChamado<{ taskId: string; reason: string; expectedVersion: number }>(escopo, chamado.id, 'post', (b) => `/tasks/${b.taskId}/cancel`);
  const podeCriar = !!chamado.capabilities && (chamado.capabilities.isTriage || chamado.capabilities.isAssignee) && !!chamado.team;

  return (
    <div className="flex flex-col gap-2" data-testid="tarefas">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tarefas</h3>
        {podeCriar && (
          <button
            type="button" onClick={() => setCriando(true)} data-testid="nova-tarefa"
            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            <Plus size={12} /> Nova tarefa
          </button>
        )}
      </div>
      {tarefas.length === 0 && <p className="text-xs text-slate-500">Nenhuma tarefa.</p>}
      <ul className="flex flex-col gap-1.5">
        {tarefas.map((t) => (
          <li key={t.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm" data-testid="tarefa">
            {/* No celular o título ocupa a linha inteira e QUEBRA: dividindo a linha com "categoria ·
                responsável" (que não encolhe), ele ficava com uma letra e reticências. Do `sm` para cima,
                cabe ao lado e trunca. */}
            <span className="min-w-0 basis-full break-words font-medium text-slate-800 sm:basis-0 sm:flex-1 sm:truncate" data-testid="tarefa-titulo">{t.title}</span>
            <span className="text-xs text-slate-500">{CATEGORIAS.find((c) => c.value === t.category)?.label} · {t.assignee}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700" data-testid="tarefa-status">{STATUS_TAREFA[t.status] ?? t.status}</span>
            {/* Tarefa bloqueada aponta para a solicitação que a trava (SUP-05). */}
            {t.blockedBy && (
              <a
                href={`#aprovacao-${t.blockedBy.approvalId}`} data-testid="tarefa-bloqueada"
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900 underline"
              >
                aguarda {t.blockedBy.kind === 'proposal' ? 'proposta' : 'validação'} v{t.blockedBy.revision}
                {t.blockedBy.status === 'rejected' ? ' (rejeitada)' : ''}
              </a>
            )}
            {t.canStart && (
              <button
                type="button" data-testid="iniciar-tarefa"
                onClick={() => void iniciar.mutateAsync({ taskId: t.id, expectedVersion: t.version })
                  .then(() => toast.success('Tarefa iniciada.'), (err) => avisarErro(err, erroDoServidor(err, 'Não foi possível iniciar.')))}
                className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50"
              >
                <Play size={11} /> Iniciar
              </button>
            )}
            {t.canComplete && (
              <button
                type="button" data-testid="concluir-tarefa" onClick={() => setConcluindo(t)}
                className="flex items-center gap-1 rounded border border-emerald-300 px-2 py-0.5 text-xs text-emerald-800 hover:bg-emerald-50"
              >
                <CheckCircle2 size={11} /> Concluir
              </button>
            )}
            {t.canLogResidual && (
              <button
                type="button" data-testid="registrar-residual" onClick={() => setResidual(t)}
                className="flex items-center gap-1 rounded border border-amber-300 px-2 py-0.5 text-xs text-amber-900 hover:bg-amber-50"
              >
                <Pencil size={11} /> Registrar trabalho feito
              </button>
            )}
            {t.canCancel && (
              <button
                type="button" data-testid="cancelar-tarefa" onClick={() => setCancelando(t)}
                className="flex items-center gap-1 rounded border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <XCircle size={11} /> Cancelar
              </button>
            )}
          </li>
        ))}
      </ul>

      {criando && <DialogoNovaTarefa escopo={escopo} chamado={chamado} onClose={() => setCriando(false)} />}
      {concluindo && <DialogoConcluir escopo={escopo} chamado={chamado} tarefa={concluindo} onClose={() => setConcluindo(null)} />}
      {residual && <DialogoConcluir escopo={escopo} chamado={chamado} tarefa={residual} residual onClose={() => setResidual(null)} />}
      {cancelando && (
        <DialogoMotivo
          titulo={`Cancelar "${cancelando.title}"`}
          explicacao="O trabalho já registrado fica. Se a tarefa estava em execução, o responsável ainda pode registrar o que fez."
          obrigatorio
          onClose={() => setCancelando(null)}
          onConfirm={(motivo) => cancelar.mutateAsync({ taskId: cancelando.id, reason: motivo, expectedVersion: cancelando.version })
            .then(() => { toast.success('Tarefa cancelada.'); setCancelando(null); },
              (err) => { avisarErro(err, erroDoServidor(err, 'Não foi possível cancelar.')); })}
        />
      )}
    </div>
  );
}

function DialogoNovaTarefa({ escopo, chamado, onClose }: { escopo: SupportScope; chamado: SupportTicketDetail; onClose: () => void }) {
  const limites = useLimites();
  const equipes = useEquipesElegiveis(escopo);
  const membros = (equipes.data ?? []).find((e) => e.name === chamado.team)?.members ?? [];
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [categoria, setCategoria] = useState('development');
  const criar = useComandoDoChamado<object>(escopo, chamado.id, 'post', '/tasks');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await criar.mutateAsync({ title: titulo, description: descricao, assigneeId: responsavel, category: categoria });
      toast.success('Tarefa criada.');
      onClose();
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'Não foi possível criar a tarefa.'));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nova tarefa">
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="form-tarefa">
        <Field label="Título"><TextInput name="title" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={limites.subject} required /></Field>
        <Field label="Descrição"><TextArea name="description" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Responsável" help="Precisa ser da equipe do chamado.">
            <Select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} name="assignee" placeholder="Selecione"
              options={membros.map((m) => ({ value: m.userId, label: m.name }))} />
          </Field>
          <Field label="Categoria" help="Decide a cobrança, junto com a organização.">
            <Select value={categoria} onChange={(e) => setCategoria(e.target.value)} name="category"
              options={CATEGORIAS.map((c) => ({ value: c.value, label: c.label }))} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={!titulo.trim() || !descricao.trim() || !responsavel || criar.isPending}
            data-testid="criar-tarefa" className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Criar
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * Concluir tarefa, com o AVISO que a spec pede: descrição e horas ficam visíveis ao requisitante.
 * Zero minutos exige justificativa; negativo não passa. Trava em ref contra clique duplo.
 */
function DialogoConcluir({ escopo, chamado, tarefa, residual = false, onClose }: {
  escopo: SupportScope; chamado: SupportTicketDetail; tarefa: SupportTask;
  /** Apontamento residual (SUP-06): tarefa cancelada em execução; registra SEM retomar a tarefa. */
  residual?: boolean;
  onClose: () => void;
}) {
  const [descricao, setDescricao] = useState('');
  const [minutos, setMinutos] = useState('');
  const [zero, setZero] = useState('');
  const [quando, setQuando] = useState('');
  const concluir = useComandoDoChamado<object>(escopo, chamado.id, 'post',
    residual ? `/tasks/${tarefa.id}/work-logs` : `/tasks/${tarefa.id}/complete`);
  const enviando = useRef(false);
  const n = minutos === '' ? NaN : Number(minutos);
  const valido = descricao.trim().length > 0 && Number.isInteger(n) && n >= 0 && (n > 0 || zero.trim().length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || enviando.current) return;
    enviando.current = true;
    try {
      await concluir.mutateAsync(residual
        ? { activityDescription: descricao.trim(), durationMinutes: n, zeroReason: zero.trim() || undefined,
          performedAt: quando ? new Date(quando).toISOString() : undefined }
        : { activityDescription: descricao.trim(), durationMinutes: n, zeroReason: zero.trim() || undefined, expectedVersion: tarefa.version });
      toast.success(residual ? `Trabalho registrado: ${formatarDuracao(n)}. A tarefa continua cancelada.` : `Tarefa concluída: ${formatarDuracao(n)}.`);
      onClose();
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'Não foi possível concluir.'));
    } finally {
      enviando.current = false;
    }
  }

  return (
    <Dialog open onClose={onClose} title={residual ? `Registrar trabalho em "${tarefa.title}"` : `Concluir "${tarefa.title}"`}>
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid={residual ? 'form-residual' : 'form-concluir'}>
        {residual && (
          <p className="text-xs text-slate-600" data-testid="explicacao-residual">
            O chamado foi cancelado com esta tarefa em execução. Registre o que já tinha sido feito — a tarefa
            <b> continua cancelada</b>.
          </p>
        )}
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" data-testid="aviso-publico">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          A descrição e as horas desta atividade <b>ficam visíveis para o requisitante</b>.
        </div>
        <Field label="O que foi feito"><TextArea name="activityDescription" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} required /></Field>
        <Field label="Duração (minutos)" help="Minutos inteiros. Zero é permitido com justificativa.">
          <TextInput type="number" min={0} step={1} name="durationMinutes" value={minutos} onChange={(e) => setMinutos(e.target.value)} />
        </Field>
        {minutos !== '' && n === 0 && (
          <Field label="Justificativa do zero"><TextInput name="zeroReason" value={zero} onChange={(e) => setZero(e.target.value)} /></Field>
        )}
        {minutos !== '' && n < 0 && <p className="text-xs text-rose-700" data-testid="erro-negativo">Duração negativa não é válida.</p>}
        {residual && tarefa.canceledAt && (
          <Field label="Quando foi feito (opcional)" help={`Até o cancelamento, em ${new Date(tarefa.canceledAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}. Em branco, vale o instante do cancelamento.`}>
            <TextInput type="datetime-local" name="performedAt" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={!valido || concluir.isPending} data-testid={residual ? 'confirmar-residual' : 'confirmar-concluir'}
            className="rounded-md bg-emerald-700 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {residual ? 'Registrar' : 'Concluir'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Atividades e horas (público) ────────────────────────────────────────────────

/**
 * Atividades concluídas e horas — o que o REQUISITANTE vê (S-A12), e também quem atende.
 * Estimativa: "Sem estimativa" quando o servidor manda `null` (nunca "0 min").
 */
export function AtividadesEHoras({ escopo, ticketId }: { escopo: SupportScope; ticketId: string }) {
  const logs = useApontamentos(escopo, ticketId);
  const [corrigindo, setCorrigindo] = useState<SupportWorkLog | null>(null);
  if (!logs.data) return null;
  const { items, totals } = logs.data;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid="atividades">
      <h2 className="text-sm font-semibold text-slate-900">Atividades e horas</h2>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-center" data-testid="totais">
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[11px] text-slate-500">Estimadas</dt>
          <dd className="text-sm font-semibold text-slate-800" data-testid="total-estimado">
            {totals.estimatedMinutes === null ? 'Sem estimativa' : formatarDuracao(totals.estimatedMinutes)}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[11px] text-slate-500">Executadas</dt>
          <dd className="text-sm font-semibold text-slate-800" data-testid="total-executado">{formatarDuracao(totals.executedMinutes)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[11px] text-slate-500">Cobráveis</dt>
          <dd className="text-sm font-semibold text-slate-800" data-testid="total-cobravel">{formatarDuracao(totals.billableMinutes)}</dd>
        </div>
      </dl>
      {items.length === 0 && <p className="mt-2 text-xs text-slate-500">Nenhuma atividade registrada ainda.</p>}
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((l) => (
          <li key={l.id} className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2 text-sm" data-testid="atividade">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{l.author}</span>
              <Quando iso={l.performedAt} />
              <span className="font-semibold text-slate-800" data-testid="atividade-duracao">{l.duration}</span>
              {l.billable && <span className="rounded-full bg-emerald-100 px-1.5 text-emerald-800">cobrável</span>}
              {l.revision > 1 && <span title={l.correctionReason ?? ''}>corrigida</span>}
              {l.canCorrect && (
                <button type="button" onClick={() => setCorrigindo(l)} data-testid="corrigir-apontamento" className="flex items-center gap-1 underline">
                  <Pencil size={11} /> corrigir
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">{l.activityDescription}</p>
          </li>
        ))}
      </ul>
      {corrigindo && <DialogoCorrecao escopo={escopo} ticketId={ticketId} log={corrigindo} onClose={() => setCorrigindo(null)} />}
    </section>
  );
}

function DialogoCorrecao({ escopo, ticketId, log, onClose }: { escopo: SupportScope; ticketId: string; log: SupportWorkLog; onClose: () => void }) {
  const [minutos, setMinutos] = useState(String(log.durationMinutes));
  const [motivo, setMotivo] = useState('');
  const corrigir = useComandoDoChamado<object>(escopo, ticketId, 'post', `/work-logs/${log.id}/revisions`);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await corrigir.mutateAsync({ durationMinutes: Number(minutos), reason: motivo.trim(), expectedRevision: log.revision });
      toast.success('Apontamento corrigido. A versão anterior fica no histórico.');
      onClose();
    } catch (err) {
      avisarErro(err, erroDoServidor(err, 'Não foi possível corrigir.'));
    }
  }

  return (
    <Dialog open onClose={onClose} title="Corrigir apontamento">
      <form onSubmit={submit} className="flex flex-col gap-3" data-testid="form-correcao">
        <Field label="Duração (minutos)"><TextInput type="number" min={0} name="durationMinutes" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></Field>
        <Field label="Motivo da correção" help="Obrigatório — corrigir horas sem motivo não é aceito.">
          <TextArea name="reason" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Cancelar</button>
          <button type="submit" disabled={!motivo.trim() || corrigir.isPending} data-testid="salvar-correcao"
            className="rounded-md bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            Salvar correção
          </button>
        </div>
      </form>
    </Dialog>
  );
}
